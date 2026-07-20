import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx";
import { knowledgeApi } from "../services";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Play,
  Calendar,
  Users,
  Loader2,
  GitCommit,
  Check,
  X,
  History,
} from "lucide-react";

/**
 * ConflictResolution.jsx
 * Allows org admins/moderators to view pending AI-detected memory conflicts,
 * run background scans, and manually resolve contradictions while maintaining auditing records.
 */
const ConflictResolution = () => {
  const [activeTab, setActiveTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  
  // Resolution Modal State
  const [resolvingConflict, setResolvingConflict] = useState(null);
  const [chosenMemoryId, setChosenMemoryId] = useState("");
  const [updatedText, setUpdatedText] = useState("");
  const [resolutionDetails, setResolutionDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await knowledgeApi.getConflicts(activeTab);
      if (res.data?.success) {
        setConflicts(res.data.conflicts || []);
      } else {
        toast.error("Failed to load conflicts.");
      }
    } catch (err) {
      console.error("Failed to fetch conflicts:", err);
      toast.error(err.response?.data?.message || "Failed to load conflicts.");
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchConflicts();
  }, [fetchConflicts]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await knowledgeApi.scanConflicts();
      if (res.data?.success) {
        toast.success(`Conflict scan completed! Found ${res.data.scanResult?.totalConflictsFound || 0} conflicts.`);
        fetchConflicts();
      } else {
        toast.error("Scan failed.");
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error(err.response?.data?.message || "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const openResolveModal = (conflict) => {
    setResolvingConflict(conflict);
    // Pre-select first memory as default winner
    const firstMem = conflict.memories[0];
    setChosenMemoryId(firstMem.memoryId);
    setUpdatedText(firstMem.text);
    setResolutionDetails("");
  };

  const handleWinnerChange = (id) => {
    setChosenMemoryId(id);
    const selectedMem = resolvingConflict.memories.find(m => m.memoryId === id);
    if (selectedMem) {
      setUpdatedText(selectedMem.text);
    }
  };

  const submitResolution = async (e) => {
    e.preventDefault();
    if (!chosenMemoryId) {
      toast.error("Please choose a canonical memory.");
      return;
    }
    setSubmitting(true);
    try {
      const rejectedMemoryIds = resolvingConflict.memories
        .map(m => m.memoryId)
        .filter(id => id !== chosenMemoryId);

      const res = await knowledgeApi.resolveConflict(resolvingConflict._id, {
        chosenMemoryId,
        rejectedMemoryIds,
        updatedText,
        resolutionDetails,
      });

      if (res.data?.success) {
        toast.success("Conflict resolved successfully.");
        setResolvingConflict(null);
        fetchConflicts();
      } else {
        toast.error("Failed to resolve conflict.");
      }
    } catch (err) {
      console.error("Resolution failed:", err);
      toast.error(err.response?.data?.message || "Failed to resolve conflict.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helper to color-code confidence score
  const getConfidenceBadgeColor = (score) => {
    if (score >= 80) return "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50";
    if (score >= 60) return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/50";
    return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/50";
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-800 dark:text-slate-200 pt-20">
      <Navbar />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Title */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              Conflict Detection & Resolution
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Detect and resolve contradictory or inconsistent decisions and action items in your knowledge graph.
            </p>
          </div>

          <button
            onClick={handleScan}
            disabled={scanning || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors shadow-xs"
          >
            {scanning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Scan for conflicts
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === "pending"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Pending Conflicts
          </button>
          <button
            onClick={() => setActiveTab("resolved")}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === "resolved"
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            Resolution History
          </button>
        </div>

        {/* Conflicts List */}
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : conflicts.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center bg-white dark:bg-slate-900/50">
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900 dark:text-white">All Clear!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              No {activeTab} conflicts found. The knowledge graph is consistent.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            {conflicts.map((conflict) => (
              <div
                key={conflict._id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-5 shadow-xs flex flex-col md:flex-row gap-5 items-start justify-between"
              >
                <div className="space-y-3 flex-1">
                  {/* Metadata Header */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-2.5 py-0.5 rounded-full font-semibold border ${getConfidenceBadgeColor(conflict.confidence)}`}>
                      {conflict.confidence}% Confidence
                    </span>
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2 py-0.5 rounded-full font-semibold">
                      {conflict.memoryType === "Decision" ? "Decision" : "Action Item"}
                    </span>
                    {conflict.resolvedAt && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/50 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        Resolved
                      </span>
                    )}
                  </div>

                  {/* AI Explanation */}
                  <p className="text-slate-700 dark:text-slate-300 font-medium text-sm leading-relaxed">
                    {conflict.explanation}
                  </p>

                  {/* Conflicting Memories */}
                  <div className="space-y-2 mt-3 pl-2 border-l-2 border-slate-100 dark:border-slate-800">
                    {conflict.memories.map((mem, index) => (
                      <div key={index} className="text-xs">
                        <div className="flex items-start gap-1.5 text-slate-900 dark:text-white font-medium">
                          <GitCommit className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                          <span>{mem.text}</span>
                        </div>
                        {mem.sourceMeetingId && (
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 ml-5 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(mem.sourceMeetingId.date).toLocaleDateString()}
                            </span>
                            <span>{mem.sourceMeetingId.title}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Resolution Details (History view) */}
                  {conflict.status === "resolved" && (
                    <div className="mt-4 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100/50 dark:border-emerald-900/30 text-xs">
                      <p className="font-semibold text-emerald-800 dark:text-emerald-400">Resolution:</p>
                      <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{conflict.resolutionDetails}</p>
                      <p className="text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1 font-semibold">
                        <Users className="w-3 h-3" />
                        By {conflict.resolvedBy?.name || "System"} • {new Date(conflict.resolvedAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                {conflict.status === "pending" && (
                  <button
                    onClick={() => openResolveModal(conflict)}
                    className="w-full md:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors shadow-xs"
                  >
                    Resolve Conflict
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Resolve Modal */}
        {resolvingConflict && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  Resolve Memory Conflict
                </h3>
                <button
                  onClick={() => setResolvingConflict(null)}
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={submitResolution}>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="p-3 bg-blue-50/50 border border-blue-100 dark:bg-blue-950/20 dark:border-blue-900/30 rounded-lg text-xs leading-relaxed text-blue-800 dark:text-blue-300">
                    <span className="font-bold">AI Explanation:</span> {resolvingConflict.explanation}
                  </div>

                  {/* Select Winner */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Choose the correct canonical statement:
                    </label>
                    <div className="grid gap-3">
                      {resolvingConflict.memories.map((mem) => {
                        const isSelected = chosenMemoryId === mem.memoryId;
                        return (
                          <div
                            key={mem.memoryId}
                            onClick={() => handleWinnerChange(mem.memoryId)}
                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? "border-blue-500 bg-blue-50/20 dark:border-blue-400 dark:bg-blue-900/10"
                                : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                                isSelected ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300 dark:border-slate-700"
                              }`}>
                                {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div className="space-y-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                                  {mem.text}
                                </p>
                                {mem.sourceMeetingId && (
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                    Source: {mem.sourceMeetingId.title} ({new Date(mem.sourceMeetingId.date).toLocaleDateString()})
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Customize Wording */}
                  <div className="space-y-1">
                    <label htmlFor="updatedText" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Canonical Wording (Optional):
                    </label>
                    <input
                      id="updatedText"
                      type="text"
                      value={updatedText}
                      onChange={(e) => setUpdatedText(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-blue-500 outline-hidden font-semibold"
                      placeholder="Customize the text of the chosen memory..."
                    />
                    <p className="text-[10px] text-slate-400">
                      You can modify the wording of the chosen memory before saving it. The other options will be superseded.
                    </p>
                  </div>

                  {/* Resolution Notes */}
                  <div className="space-y-1">
                    <label htmlFor="resolutionDetails" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Resolution Details / Notes:
                    </label>
                    <textarea
                      id="resolutionDetails"
                      rows={3}
                      value={resolutionDetails}
                      onChange={(e) => setResolutionDetails(e.target.value)}
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:border-blue-500 outline-hidden"
                      placeholder="Explain why this option was chosen (e.g., 'Per update in Q3 sync...')"
                    />
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
                  <button
                    type="button"
                    onClick={() => setResolvingConflict(null)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Confirm Resolution
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConflictResolution;
