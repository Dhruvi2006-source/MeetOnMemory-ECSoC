import axios from "axios";
import Decision from "../models/decisionModel.js";
import ActionItem from "../models/actionItemModel.js";
import Conflict from "../models/conflictModel.js";
import AuditLog from "../models/auditLogModel.js";
import { cosineSimilarity } from "../utils/similarity.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// Threshold for selecting candidate memory pairs to check for contradictions
const CANDIDATE_SIMILARITY_THRESHOLD = 0.65;

/**
 * Strips markdown code fences from AI responses
 */
function cleanJsonResponse(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "");
  }
  return cleaned.trim();
}

/**
 * Union-Find implementation for clustering conflicting memories
 */
class UnionFind {
  constructor() {
    this.parent = {};
  }

  find(i) {
    if (this.parent[i] === undefined) {
      this.parent[i] = i;
      return i;
    }
    if (this.parent[i] === i) {
      return i;
    }
    this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  union(i, j) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
    }
  }
}

/**
 * Evaluates whether two memory texts are contradictory using Gemini
 */
export async function areMemoriesContradictory(textA, textB) {
  if (!GEMINI_API_KEY || process.env.NODE_ENV === "test") {
    // Return mock values for tests or if API key is missing
    const cleanWords = (text) => text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").split(/\s+/);
    const wordsA = cleanWords(textA);
    const wordsB = cleanWords(textB);
    
    // Heuristic contradiction check for testing
    const hasDeadlineConflict =
      wordsA.includes("deadline") &&
      wordsB.includes("deadline") &&
      wordsA.some(w => /\d+/.test(w)) &&
      wordsB.some(w => /\d+/.test(w)) &&
      wordsA.filter(w => /\d+/.test(w))[0] !== wordsB.filter(w => /\d+/.test(w))[0];

    const hasOwnerConflict =
      (wordsA.includes("owner") || wordsA.includes("frontend") || wordsA.includes("backend")) &&
      (wordsB.includes("owner") || wordsB.includes("frontend") || wordsB.includes("backend")) &&
      ((wordsA.includes("alice") && wordsB.includes("bob")) ||
       (wordsA.includes("bob") && wordsB.includes("alice")));

    const isMockContradiction = hasDeadlineConflict || hasOwnerConflict;

    return {
      isContradictory: isMockContradiction,
      confidence: isMockContradiction ? 85 : 0,
      explanation: isMockContradiction
        ? `Detected inconsistency between "${textA}" and "${textB}".`
        : "No direct contradiction found.",
    };
  }

  const prompt = `
You are an AI contradiction detection assistant.
Your task is to analyze two statements (memories) and determine if they contain contradictory or inconsistent information.

Statements can be Decisions or Action Items.
Contradictions occur when:
1. The statements express directly opposing claims (e.g. "We will use MongoDB" vs "We will use PostgreSQL").
2. The statements specify different values for the same property, such as different dates or different owners (e.g., "Alice is owner" vs "Bob is owner", "Deadline is July 15" vs "Deadline is July 22").
3. One statement invalidates or makes the other statement impossible.

Examples of NON-contradictions:
- "The design is complete" and "We will launch on Friday" (they are unrelated or complementary).
- "Alice is writing backend" and "Bob is writing frontend" (they describe different tasks and are not contradictory).
- "We need to fix the database" and "The database needs optimization" (they are consistent/complementary).

Statements:
Statement 1: "${textA}"
Statement 2: "${textB}"

Provide your output strictly in JSON format with no markdown code fences and no other text.
The JSON object MUST contain:
- "isContradictory": boolean (true if the statements contain contradictory or inconsistent information, false otherwise)
- "confidence": number (an integer between 0 and 100, representing your confidence that they contradict. Return 0 if not contradictory)
- "explanation": string (a short, clear explanation of why they contradict or why they do not)

JSON Output:
`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 20000 }
    );
    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = cleanJsonResponse(rawText);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("❌ Gemini contradiction check failed:", error.message);
    return { isContradictory: false, confidence: 0, explanation: "Failed to evaluate contradiction." };
  }
}

/**
 * Generates a unified explanation for a cluster of conflicting memories
 */
export async function generateClusterExplanation(memories) {
  if (!GEMINI_API_KEY || process.env.NODE_ENV === "test") {
    return {
      confidence: 90,
      explanation: `Conflict group containing ${memories.length} inconsistent items: ${memories.map(m => `"${m.text}"`).join(" vs ")}`,
    };
  }

  const prompt = `
You are an AI conflict resolution assistant.
Here is a list of conflicting memories (Decisions/Action Items) that have been grouped together because they contain contradictory or inconsistent information:

${memories.map((m, i) => `${i + 1}. "${m.text}" (Source meeting: ${m.meetingTitle || 'Unknown'}, Date: ${m.meetingDate || 'Unknown'})`).join("\n")}

Identify the core contradiction/inconsistency across these memories, explain it clearly to the user, and assign a group confidence score (0 to 100).

Provide your output strictly in JSON format with no markdown code fences and no other text.
The JSON object MUST contain:
- "confidence": number (integer between 0 and 100)
- "explanation": string (a unified explanation explaining the nature of the conflict and identifying which specific points are in disagreement)

JSON Output:
`;

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }] },
      { timeout: 20000 }
    );
    const rawText = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const cleaned = cleanJsonResponse(rawText);
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("❌ Gemini cluster explanation failed:", error.message);
    return { confidence: 70, explanation: "Multiple conflicting records were identified regarding this topic." };
  }
}

/**
 * Runs the contradiction detection pipeline for a specific memory type and organization.
 */
export async function detectContradictions(organizationId, memoryType) {
  if (!organizationId) return { success: false, message: "Organization ID is required" };

  const Model = memoryType === "Decision" ? Decision : ActionItem;
  
  // 1. Fetch active memories
  const memories = await Model.find({
    organization: organizationId,
    supersededByMemory: null,
    status: { $ne: "superseded" },
  }).populate("sourceMeetingId", "title date").lean();

  if (memories.length < 2) {
    // Not enough memories to conflict
    await Conflict.deleteMany({ organization: organizationId, memoryType, status: "pending" });
    return { success: true, conflictsFound: 0 };
  }

  // 2. Identify candidate pairs based on cosine similarity
  const candidatePairs = [];
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const memA = memories[i];
      const memB = memories[j];

      if (!memA.embedding?.length || !memB.embedding?.length) continue;
      if (memA.embedding.length !== memB.embedding.length) continue;

      const sim = cosineSimilarity(memA.embedding, memB.embedding);
      
      // If they are semantically similar but do not have identical text, check them
      if (sim >= CANDIDATE_SIMILARITY_THRESHOLD && memA.text.trim() !== memB.text.trim()) {
        candidatePairs.push({ a: memA, b: memB, similarity: sim });
      }
    }
  }

  // 3. Evaluate candidate pairs for actual contradictions
  const uf = new UnionFind();
  const conflictingMemories = new Set();
  const pairwiseConflicts = [];

  for (const pair of candidatePairs) {
    const analysis = await areMemoriesContradictory(pair.a.text, pair.b.text);
    if (analysis.isContradictory && analysis.confidence >= 50) {
      uf.union(pair.a._id.toString(), pair.b._id.toString());
      conflictingMemories.add(pair.a._id.toString());
      conflictingMemories.add(pair.b._id.toString());
      pairwiseConflicts.push({
        a: pair.a,
        b: pair.b,
        confidence: analysis.confidence,
        explanation: analysis.explanation,
      });
    }
  }

  // 4. Cluster related contradictions into groups
  const groups = {};
  for (const idStr of conflictingMemories) {
    const root = uf.find(idStr);
    if (!groups[root]) groups[root] = [];
    
    const mem = memories.find(m => m._id.toString() === idStr);
    if (mem) groups[root].push(mem);
  }

  // 5. Generate explanations and save conflict groups
  const newConflicts = [];
  for (const rootId in groups) {
    const group = groups[rootId];
    if (group.length < 2) continue;

    // Build sub-memories format for schema
    const memoriesInConflict = group.map(m => ({
      memoryId: m._id,
      refModel: memoryType,
      text: m.text,
      sourceMeetingId: m.sourceMeetingId?._id || null,
    }));

    // Find the max pairwise confidence in this group as a baseline
    const groupMemberIds = group.map(m => m._id.toString());
    const relevantPairConflicts = pairwiseConflicts.filter(
      p => groupMemberIds.includes(p.a._id.toString()) && groupMemberIds.includes(p.b._id.toString())
    );
    const maxConfidence = relevantPairConflicts.length
      ? Math.max(...relevantPairConflicts.map(p => p.confidence))
      : 80;

    // Call Gemini to explain the cluster
    const clusterMeta = group.map(m => ({
      text: m.text,
      meetingTitle: m.sourceMeetingId?.title || "Unknown",
      meetingDate: m.sourceMeetingId?.date ? new Date(m.sourceMeetingId.date).toLocaleDateString() : "Unknown",
    }));
    
    const clusterAnalysis = await generateClusterExplanation(clusterMeta);

    newConflicts.push({
      organization: organizationId,
      status: "pending",
      memoryType,
      memories: memoriesInConflict,
      confidence: clusterAnalysis.confidence || maxConfidence,
      explanation: clusterAnalysis.explanation || "Conflicting information detected.",
    });
  }

  // 6. Delete old pending conflicts and write new ones
  await Conflict.deleteMany({ organization: organizationId, memoryType, status: "pending" });
  
  if (newConflicts.length > 0) {
    await Conflict.insertMany(newConflicts);
  }

  return { success: true, conflictsFound: newConflicts.length };
}

/**
 * Periodically scans both Decisions and ActionItems for conflicts in an organization
 */
export async function runFullConflictScan(organizationId) {
  const decResults = await detectContradictions(organizationId, "Decision");
  const aiResults = await detectContradictions(organizationId, "ActionItem");

  return {
    success: true,
    organization: organizationId,
    decisions: decResults,
    actionItems: aiResults,
    totalConflictsFound: (decResults.conflictsFound || 0) + (aiResults.conflictsFound || 0),
  };
}

/**
 * Manually resolves a memory conflict by choosing a canonical winner and superseding the rest.
 */
export async function resolveConflictManual(conflictId, { chosenMemoryId, rejectedMemoryIds, updatedText, resolutionDetails, userId }) {
  const conflict = await Conflict.findById(conflictId);
  if (!conflict || conflict.status === "resolved") {
    throw new Error("Conflict not found or already resolved");
  }

  const memoryType = conflict.memoryType;
  const Model = memoryType === "Decision" ? Decision : ActionItem;

  // 1. Update the chosen memory
  const winner = await Model.findOne({ _id: chosenMemoryId, organization: conflict.organization });
  if (!winner) throw new Error("Chosen winner memory not found");

  if (updatedText && updatedText.trim() && updatedText !== winner.text) {
    winner.text = updatedText.trim();
    // Re-embed the updated text if the model supports it
    // Importing dynamically to avoid circular references
    const { embedText } = await import("../utils/embeddingUtils.js");
    try {
      winner.embedding = await embedText(winner.text);
    } catch (err) {
      console.warn("⚠️ Failed to update embedding during resolution:", err.message);
    }
  }
  winner.status = "open"; // Reactivate if it was in some other state
  await winner.save();

  // 2. Supersede the rejected memories
  for (const rejId of rejectedMemoryIds) {
    const rejected = await Model.findOne({ _id: rejId, organization: conflict.organization });
    if (rejected) {
      rejected.status = "superseded";
      rejected.supersededByMemory = winner._id;
      await rejected.save();
    }
  }

  // 3. Repoint relatesTo edges pointing to the rejected memories to point to the winner instead
  const rejectedIdsStrs = rejectedMemoryIds.map(id => id.toString());
  const allActiveMemories = await Model.find({
    organization: conflict.organization,
    _id: { $ne: winner._id },
  });

  for (const item of allActiveMemories) {
    let changed = false;
    for (const rel of item.relatesTo || []) {
      if (rejectedIdsStrs.includes(rel.target.toString())) {
        rel.target = winner._id;
        rel.computedAt = new Date();
        changed = true;
      }
    }
    if (changed) {
      // Remove duplicate targets if any exist now after repointing
      const uniqueRelates = [];
      const seen = new Set();
      for (const rel of item.relatesTo) {
        const targetStr = rel.target.toString();
        if (!seen.has(targetStr)) {
          seen.add(targetStr);
          uniqueRelates.push(rel);
        } else {
          // Merge confidence by keeping max
          const match = uniqueRelates.find(r => r.target.toString() === targetStr);
          if (match) {
            match.confidence = Math.max(match.confidence, rel.confidence);
          }
        }
      }
      item.relatesTo = uniqueRelates;
      await item.save();
    }
  }

  // 4. Update the conflict document
  conflict.status = "resolved";
  conflict.resolvedAt = new Date();
  conflict.resolvedBy = userId;
  conflict.resolutionDetails = resolutionDetails || `Selected "${winner.text}" as canonical.`;
  await conflict.save();

  // 5. Log the resolution in the AuditLog
  await AuditLog.create({
    organization: conflict.organization,
    actor: userId,
    action: "RESOLVE_CONFLICT",
    entity: memoryType,
    entityId: winner._id,
    details: {
      conflictId: conflict._id,
      chosenMemoryId,
      rejectedMemoryIds,
      resolutionDetails,
    },
  });

  return { success: true, conflict };
}
