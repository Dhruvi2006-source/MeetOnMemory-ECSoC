import Conflict from "../models/conflictModel.js";
import {
  runFullConflictScan,
  resolveConflictManual,
} from "../services/conflictDetectionService.js";

/**
 * Gets memory conflicts for the current user's organization, filterable by status.
 */
export const getConflicts = async (req, res) => {
  try {
    const organization = req.user.organization;
    const { status = "pending" } = req.query;

    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "Organization context is required",
      });
    }

    if (!["pending", "resolved"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status parameter. Must be 'pending' or 'resolved'",
      });
    }

    const conflicts = await Conflict.find({ organization, status })
      .populate("memories.sourceMeetingId", "title date")
      .populate("resolvedBy", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      conflicts,
    });
  } catch (error) {
    console.error("getConflicts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch conflicts",
    });
  }
};

/**
 * Triggers a manual conflict scan across Decisions and ActionItems for the organization.
 */
export const scanConflicts = async (req, res) => {
  try {
    const organization = req.user.organization;

    if (!organization) {
      return res.status(400).json({
        success: false,
        message: "Organization context is required",
      });
    }

    const scanResult = await runFullConflictScan(organization);

    res.status(200).json({
      success: true,
      message: "Conflict detection scan completed successfully",
      scanResult,
    });
  } catch (error) {
    console.error("scanConflicts error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to run conflict scan",
    });
  }
};

/**
 * Manually resolves a specific conflict set.
 */
export const resolveConflict = async (req, res) => {
  try {
    const { id } = req.params;
    const { chosenMemoryId, rejectedMemoryIds, updatedText, resolutionDetails } = req.body;
    const userId = req.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Conflict ID is required",
      });
    }

    if (!chosenMemoryId || !rejectedMemoryIds || !Array.isArray(rejectedMemoryIds)) {
      return res.status(400).json({
        success: false,
        message: "Invalid parameters. 'chosenMemoryId' and 'rejectedMemoryIds' (array) are required.",
      });
    }

    const result = await resolveConflictManual(id, {
      chosenMemoryId,
      rejectedMemoryIds,
      updatedText,
      resolutionDetails,
      userId,
    });

    res.status(200).json({
      success: true,
      message: "Conflict resolved successfully",
      conflict: result.conflict,
    });
  } catch (error) {
    console.error("resolveConflict error:", error);
    const statusCode = error.message?.includes("not found") ? 404 : 400;
    res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to resolve conflict",
    });
  }
};
