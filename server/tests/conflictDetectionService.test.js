import { jest } from "@jest/globals";
import mongoose from "mongoose";

const mockEmbedText = jest.fn();
const mockSearchVectorStore = jest.fn();

// Mock embedding utility before any imports load it
jest.unstable_mockModule("../utils/embeddingUtils.js", () => ({
  embedText: mockEmbedText,
  searchVectorStore: mockSearchVectorStore,
}));

// Load modules dynamically after defining the mock
const Decision = (await import("../models/decisionModel.js")).default;
const ActionItem = (await import("../models/actionItemModel.js")).default;
const Conflict = (await import("../models/conflictModel.js")).default;
const AuditLog = (await import("../models/auditLogModel.js")).default;
const {
  runFullConflictScan,
  resolveConflictManual,
} = await import("../services/conflictDetectionService.js");
const { hybridRetrieve } = await import("../services/hybridRetrievalService.js");

const organizationId = new mongoose.Types.ObjectId();
const meetingId = new mongoose.Types.ObjectId();

beforeAll(async () => {
  await mongoose.connect(
    `${process.env.TEST_MONGODB_URI}/conflict_tests`,
  );
});

// A helper to make a mock embedding
function makeEmbedding(seed) {
  return Array.from({ length: 8 }, (_, i) => Math.sin(seed * (i + 1)));
}

describe("Conflict Detection Service", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSearchVectorStore.mockResolvedValue([]);
    mockEmbedText.mockImplementation(async (text) => {
      return makeEmbedding(1); // Default dummy embedding
    });

    await Decision.deleteMany({});
    await ActionItem.deleteMany({});
    await Conflict.deleteMany({});
    await AuditLog.deleteMany({});
  });

  test("should detect contradiction between conflicting deadlines", async () => {
    // Create conflicting decisions
    await Decision.create({
      text: "Project deadline is July 15.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1),
    });

    await Decision.create({
      text: "Project deadline is July 22.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1.05), // slightly different
    });

    const result = await runFullConflictScan(organizationId);
    expect(result.totalConflictsFound).toBe(1);

    const conflict = await Conflict.findOne({ organization: organizationId, status: "pending" });
    expect(conflict).toBeDefined();
    expect(conflict.memories.length).toBe(2);
    expect(conflict.memoryType).toBe("Decision");
  });

  test("should cluster transitively conflicting memories using Union-Find", async () => {
    await Decision.create({
      text: "Project deadline is July 15.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1),
    });

    await Decision.create({
      text: "Project deadline is July 22.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1.05),
    });

    await Decision.create({
      text: "Project deadline is July 29.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1.1),
    });

    const result = await runFullConflictScan(organizationId);
    expect(result.totalConflictsFound).toBe(1); // grouped into 1 cluster!

    const conflict = await Conflict.findOne({ organization: organizationId });
    expect(conflict.memories.length).toBe(3);
  });

  test("should manually resolve a conflict and repoint relations", async () => {
    const decA = await Decision.create({
      text: "Project deadline is July 15.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1),
    });

    const decB = await Decision.create({
      text: "Project deadline is July 22.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1.05),
    });

    // Create a bystander decision that relates to decB
    const bystander = await Decision.create({
      text: "Plan launch event.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(3),
      relatesTo: [{ target: decB._id, confidence: 90 }],
    });

    await runFullConflictScan(organizationId);
    const conflict = await Conflict.findOne({ organization: organizationId });

    // Resolve manually: keep decA, supersede decB, update text to July 18
    const resolveResult = await resolveConflictManual(conflict._id, {
      chosenMemoryId: decA._id,
      rejectedMemoryIds: [decB._id],
      updatedText: "Project deadline is July 18.",
      resolutionDetails: "Settled on July 18 after client feedback.",
      userId: new mongoose.Types.ObjectId(),
    });

    expect(resolveResult.success).toBe(true);

    // Verify chosen memory
    const updatedA = await Decision.findById(decA._id);
    expect(updatedA.text).toBe("Project deadline is July 18.");
    expect(updatedA.status).toBe("open");

    // Verify rejected memory
    const updatedB = await Decision.findById(decB._id);
    expect(updatedB.status).toBe("superseded");
    expect(updatedB.supersededByMemory.toString()).toBe(decA._id.toString());

    // Verify relations repointed
    const updatedBystander = await Decision.findById(bystander._id);
    expect(updatedBystander.relatesTo[0].target.toString()).toBe(decA._id.toString());

    // Verify conflict status
    const updatedConflict = await Conflict.findById(conflict._id);
    expect(updatedConflict.status).toBe("resolved");

    // Verify audit log
    const audit = await AuditLog.findOne({ organization: organizationId });
    expect(audit).toBeDefined();
    expect(audit.action).toBe("RESOLVE_CONFLICT");
  });

  test("should penalize active conflicts and filter superseded in hybrid search", async () => {
    const decA = await Decision.create({
      text: "Frontend owner is Alice.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1),
    });

    const decB = await Decision.create({
      text: "Frontend owner is Bob.",
      sourceMeetingId: meetingId,
      organization: organizationId,
      embedding: makeEmbedding(1.05),
    });

    // Run scan to generate pending conflict
    await runFullConflictScan(organizationId);

    // Query hybrid retrieve
    const searchRes = await hybridRetrieve("frontend owner", organizationId, {
      topK: 10,
      includeTypes: ["decision"],
    });

    // Both should have hasConflict: true and a warning in explanation
    expect(searchRes.results.length).toBe(2);
    expect(searchRes.results[0].hasConflict).toBe(true);
    expect(searchRes.results[0].explanation).toContain("⚠️ Warning: This memory is currently flagged in a pending contradiction conflict.");

    // Resolve conflict
    const conflict = await Conflict.findOne({ organization: organizationId });
    await resolveConflictManual(conflict._id, {
      chosenMemoryId: decA._id,
      rejectedMemoryIds: [decB._id],
      userId: new mongoose.Types.ObjectId(),
    });

    // Query hybrid retrieve again
    const searchResAfter = await hybridRetrieve("frontend owner", organizationId, {
      topK: 10,
      includeTypes: ["decision"],
    });

    // decB should be excluded because it is superseded
    expect(searchResAfter.results.length).toBe(1);
    expect(searchResAfter.results[0].id).toBe(decA._id.toString());
    expect(searchResAfter.results[0].hasConflict).toBeUndefined();
  });
});
