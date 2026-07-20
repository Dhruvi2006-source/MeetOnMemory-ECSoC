import mongoose from "mongoose";

const conflictMemorySchema = new mongoose.Schema(
  {
    memoryId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "memories.refModel",
    },
    refModel: {
      type: String,
      enum: ["Decision", "ActionItem"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    sourceMeetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Meeting",
      default: null,
    },
  },
  { _id: false }
);

const conflictSchema = new mongoose.Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
      index: true,
    },
    memoryType: {
      type: String,
      enum: ["Decision", "ActionItem"],
      required: true,
    },
    memories: {
      type: [conflictMemorySchema],
      required: true,
      validate: [
        (val) => val.length >= 2,
        "A conflict set must contain at least 2 memories",
      ],
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    explanation: {
      type: String,
      required: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolutionDetails: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

const Conflict = mongoose.models.Conflict || mongoose.model("Conflict", conflictSchema);
export default Conflict;
