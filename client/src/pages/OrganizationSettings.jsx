import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Building2,
  Globe,
  Mail,
  MapPin,
  Briefcase,
  Shield,
  Save,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Info,
  Calendar,
  Users,
  Key,
  ChevronRight,
  Sparkles,
  Lock,
} from "lucide-react";
import Navbar from "../components/Navbar.jsx";
import AppContent from "../context/AppContent";
import { organizationApi } from "../services/organizationApi";

const OrganizationSettings = () => {
  const navigate = useNavigate();
  const { userData, setUserData, getUserData } = useContext(AppContent);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgData, setOrgData] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    about: "",
    website: "",
    contactEmail: "",
    industry: "",
    location: "",
    logo: "",
    visibility: "private",
  });

  const [initialData, setInitialData] = useState({});
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("general");

  const currentOrgId = userData?.organization?._id || userData?.organization;

  // Check if current user is Owner or Admin
  const userRole = (userData?.role || "").toLowerCase();
  const isOwnerOrAdmin =
    userRole === "admin" ||
    userRole === "owner" ||
    (orgData?.owner &&
      (orgData.owner._id === userData?._id || orgData.owner === userData?._id));

  // Fetch current organization details
  const fetchOrganizationDetails = useCallback(async () => {
    if (!currentOrgId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data } = await organizationApi.getOrganizationById(currentOrgId);
      if (data.success && data.organization) {
        const org = data.organization;
        setOrgData(org);

        const loadedForm = {
          name: org.name || "",
          description: org.description || "",
          about: org.about || "",
          website: org.website || "",
          contactEmail: org.contactEmail || "",
          industry: org.industry || "",
          location: org.location || "",
          logo: org.logo || "",
          visibility: org.visibility || "private",
        };

        setFormData(loadedForm);
        setInitialData(loadedForm);
      }
    } catch (err) {
      console.error("Failed to load organization settings:", err);
      toast.error("Failed to load organization details");
    } finally {
      setLoading(false);
    }
  }, [currentOrgId]);

  useEffect(() => {
    fetchOrganizationDetails();
  }, [fetchOrganizationDetails]);

  // Check if form is dirty (unsaved changes)
  const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);

  // Unsaved changes prompt before tab unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Form input validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Organization name is required.";
    } else if (formData.name.trim().length > 100) {
      newErrors.name = "Organization name cannot exceed 100 characters.";
    }

    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Short description cannot exceed 500 characters.";
    }

    if (formData.about && formData.about.length > 2000) {
      newErrors.about = "About bio cannot exceed 2000 characters.";
    }

    if (formData.contactEmail && formData.contactEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.contactEmail.trim())) {
        newErrors.contactEmail = "Please enter a valid email address.";
      }
    }

    if (formData.website && formData.website.trim()) {
      const urlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/.*)?$/i;
      if (!urlPattern.test(formData.website.trim())) {
        newErrors.website =
          "Please enter a valid website URL (e.g. https://example.com).";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleReset = () => {
    setFormData(initialData);
    setErrors({});
    toast.info("Form reset to original settings.");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOwnerOrAdmin) {
      toast.error(
        "You do not have permission to update organization settings.",
      );
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix form errors before saving.");
      return;
    }

    try {
      setSaving(true);
      const { data } = await organizationApi.updateOrganization(
        currentOrgId,
        formData,
      );

      if (data.success) {
        toast.success(
          data.message || "Organization settings updated successfully!",
        );
        setInitialData(formData);
        setOrgData((prev) => ({ ...prev, ...data.organization }));

        // Refresh global user data context
        const updatedUser = await getUserData();
        if (updatedUser) {
          setUserData(updatedUser);
          localStorage.setItem("userData", JSON.stringify(updatedUser));
        }
      } else {
        toast.error(data.message || "Failed to update organization settings.");
      }
    } catch (err) {
      console.error("Error updating organization settings:", err);
      toast.error(
        err.response?.data?.message ||
          "Failed to update organization settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <Navbar />
        <div className="flex-1 flex justify-center items-center">
          <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
        </div>
      </div>
    );
  }

  if (!currentOrgId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col">
        <Navbar />
        <div className="flex-1 container mx-auto px-4 pt-24 pb-12 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full text-center border border-slate-200 dark:border-slate-700 shadow-xl">
            <Building2 className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
              No Organization Selected
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              You must belong to an organization to view or manage its settings.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => navigate("/create-organization")}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all shadow-md"
              >
                Create Organization
              </button>
              <button
                onClick={() => navigate("/browse-organizations")}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold rounded-xl transition-all"
              >
                Browse Organizations
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Navbar />

      <main className="flex-grow container mx-auto px-4 sm:px-6 lg:px-10 pt-24 pb-16 max-w-6xl">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6">
          <span
            onClick={() => navigate("/dashboard")}
            className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
          >
            Dashboard
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span
            onClick={() => navigate("/organizations")}
            className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors"
          >
            Organization
          </span>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-blue-600 dark:text-blue-400 font-bold">
            Settings
          </span>
        </nav>

        {/* Page Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                {formData.logo ? (
                  <img
                    src={formData.logo}
                    alt={formData.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    {formData.name || "Organization Settings"}
                  </h1>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 backdrop-blur-md border border-white/30 uppercase tracking-wider text-white">
                    {formData.visibility}
                  </span>
                </div>
                <p className="text-blue-100 text-sm mt-1 max-w-xl line-clamp-2">
                  {formData.description ||
                    "Manage your organization profile, contact information, bio, and system metadata."}
                </p>
              </div>
            </div>

            {/* Role Badge Indicator */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 shrink-0">
              <Shield className="w-4 h-4 text-amber-300" />
              <div className="text-left">
                <p className="text-[10px] uppercase font-bold text-blue-200 tracking-wider">
                  Your Access Role
                </p>
                <p className="text-xs font-extrabold capitalize text-white">
                  {userData?.role || "Member"}
                </p>
              </div>
            </div>
          </div>

          {/* Background Decorative Graphic */}
          <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* Read-Only Access Warning for non-Admin/Owner */}
        {!isOwnerOrAdmin && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 flex items-start gap-3 text-amber-800 dark:text-amber-300">
            <Lock className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Read-Only Mode</p>
              <p className="text-xs mt-0.5">
                You have member permissions. Only organization Owners and Admins
                can update organization settings.
              </p>
            </div>
          </div>
        )}

        {/* Unsaved Changes Floating Banner */}
        {isDirty && isOwnerOrAdmin && (
          <div className="sticky top-20 z-30 mb-6 p-4 rounded-2xl bg-blue-500 text-white shadow-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300 border border-blue-400">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 shrink-0" />
              <p className="text-sm font-semibold">
                You have unsaved changes in your organization settings.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleReset}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-1.5 rounded-xl bg-white text-blue-700 hover:bg-blue-50 text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
            <Loader2 className="animate-spin w-10 h-10 text-blue-600 mb-3" />
            <p className="text-sm text-slate-500 font-medium">
              Loading organization settings...
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Settings Sidebar Navigation */}
            <div className="lg:col-span-1 space-y-2">
              <div className="bg-white dark:bg-slate-800 rounded-3xl p-3 border border-slate-200 dark:border-slate-700 shadow-xs">
                <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Settings Sections
                </p>
                <nav className="space-y-1">
                  <button
                    onClick={() => setActiveTab("general")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "general"
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    General Info
                  </button>
                  <button
                    onClick={() => setActiveTab("contact")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "contact"
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Contact & Info
                  </button>
                  <button
                    onClick={() => setActiveTab("about")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "about"
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    About & Bio
                  </button>
                  <button
                    onClick={() => setActiveTab("metadata")}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === "metadata"
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Key className="w-4 h-4" />
                    Metadata & Stats
                  </button>
                </nav>
              </div>

              {/* Quick Info Box */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-3xl p-5 text-white shadow-lg border border-slate-800 hidden lg:block">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Organization Info
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Keep your organization details up to date to ensure proper
                  team collaboration and identity across MeetOnMemory.
                </p>
                <div className="space-y-2 text-[11px] text-slate-400 pt-3 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span>Members:</span>
                    <span className="font-bold text-white">
                      {orgData?.memberCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="font-bold text-white">
                      {orgData?.createdAt
                        ? new Date(orgData.createdAt).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Content Area */}
            <div className="lg:col-span-3 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* ── GENERAL INFORMATION SECTION ── */}
                {(activeTab === "general" || activeTab === "all") && (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          General Information
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Basic identity details for your organization.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Organization Name */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Organization Name{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!isOwnerOrAdmin}
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          placeholder="e.g. Acme Corporation"
                          className={`w-full px-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                            errors.name
                              ? "border-red-500 focus:ring-red-500"
                              : "border-slate-200 dark:border-slate-700"
                          } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                        />
                        {errors.name && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.name}
                          </p>
                        )}
                      </div>

                      {/* Short Description */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Short Description
                        </label>
                        <textarea
                          rows={3}
                          disabled={!isOwnerOrAdmin}
                          value={formData.description}
                          onChange={(e) =>
                            handleChange("description", e.target.value)
                          }
                          placeholder="Briefly describe what your organization does..."
                          className={`w-full px-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                            errors.description
                              ? "border-red-500"
                              : "border-slate-200 dark:border-slate-700"
                          } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                        />
                        <div className="flex justify-between items-center mt-1">
                          {errors.description ? (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {errors.description}
                            </p>
                          ) : (
                            <span />
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formData.description.length}/500
                          </span>
                        </div>
                      </div>

                      {/* Logo URL */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Logo Image URL
                        </label>
                        <input
                          type="url"
                          disabled={!isOwnerOrAdmin}
                          value={formData.logo}
                          onChange={(e) => handleChange("logo", e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className={`w-full px-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                            !isOwnerOrAdmin
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        />
                      </div>

                      {/* Visibility Selector */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Visibility Setting
                        </label>
                        <select
                          disabled={!isOwnerOrAdmin}
                          value={formData.visibility}
                          onChange={(e) =>
                            handleChange("visibility", e.target.value)
                          }
                          className={`w-full px-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                            !isOwnerOrAdmin
                              ? "opacity-60 cursor-not-allowed"
                              : ""
                          }`}
                        >
                          <option value="private">
                            Private (Members only)
                          </option>
                          <option value="public">
                            Public (Visible in directory)
                          </option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── CONTACT DETAILS SECTION ── */}
                {(activeTab === "contact" || activeTab === "all") && (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          Contact & Location Details
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Optional communication channels and location metadata.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {/* Website */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Official Website
                        </label>
                        <div className="relative">
                          <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="url"
                            disabled={!isOwnerOrAdmin}
                            value={formData.website}
                            onChange={(e) =>
                              handleChange("website", e.target.value)
                            }
                            placeholder="https://example.com"
                            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                              errors.website
                                ? "border-red-500"
                                : "border-slate-200 dark:border-slate-700"
                            } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                          />
                        </div>
                        {errors.website && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.website}
                          </p>
                        )}
                      </div>

                      {/* Contact Email */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Contact Email
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="email"
                            disabled={!isOwnerOrAdmin}
                            value={formData.contactEmail}
                            onChange={(e) =>
                              handleChange("contactEmail", e.target.value)
                            }
                            placeholder="contact@organization.com"
                            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                              errors.contactEmail
                                ? "border-red-500"
                                : "border-slate-200 dark:border-slate-700"
                            } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                          />
                        </div>
                        {errors.contactEmail && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.contactEmail}
                          </p>
                        )}
                      </div>

                      {/* Industry */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Industry Sector
                        </label>
                        <div className="relative">
                          <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            disabled={!isOwnerOrAdmin}
                            value={formData.industry}
                            onChange={(e) =>
                              handleChange("industry", e.target.value)
                            }
                            placeholder="e.g. Information Technology"
                            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                              !isOwnerOrAdmin
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </div>
                      </div>

                      {/* Location */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                          Headquarters / Location
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            disabled={!isOwnerOrAdmin}
                            value={formData.location}
                            onChange={(e) =>
                              handleChange("location", e.target.value)
                            }
                            placeholder="e.g. San Francisco, CA"
                            className={`w-full pl-10 pr-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                              !isOwnerOrAdmin
                                ? "opacity-60 cursor-not-allowed"
                                : ""
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ABOUT ORGANIZATION SECTION ── */}
                {(activeTab === "about" || activeTab === "all") && (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <div className="p-2.5 rounded-2xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                        <Briefcase className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          About & Biography
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Provide detailed context, history, or mission
                          statements.
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                        About Organization (Bio)
                      </label>
                      <textarea
                        rows={6}
                        disabled={!isOwnerOrAdmin}
                        value={formData.about}
                        onChange={(e) => handleChange("about", e.target.value)}
                        placeholder="Write a detailed description of your organization's mission, team, and goals..."
                        className={`w-full px-4 py-3 rounded-2xl border text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all ${
                          errors.about
                            ? "border-red-500"
                            : "border-slate-200 dark:border-slate-700"
                        } ${!isOwnerOrAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                      />
                      <div className="flex justify-between items-center mt-1">
                        {errors.about ? (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {errors.about}
                          </p>
                        ) : (
                          <span />
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formData.about.length}/2000
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── METADATA & READ-ONLY STATS SECTION ── */}
                {(activeTab === "metadata" || activeTab === "all") && (
                  <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                      <div className="p-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          System Metadata & Overview
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Read-only organization identifiers and administrative
                          statistics.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Organization ID */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Organization ID
                        </p>
                        <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 truncate mt-1">
                          {orgData?._id || "N/A"}
                        </p>
                      </div>

                      {/* Organization Slug */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Organization Slug
                        </p>
                        <p className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 truncate mt-1">
                          {orgData?.slug || "N/A"}
                        </p>
                      </div>

                      {/* Created Date */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Created On
                          </p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {orgData?.createdAt
                              ? new Date(orgData.createdAt).toLocaleDateString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  },
                                )
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Last Updated */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-200/50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Last Updated
                          </p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {orgData?.updatedAt
                              ? new Date(orgData.updatedAt).toLocaleDateString(
                                  undefined,
                                  {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  },
                                )
                              : "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Owner Info */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                          <Shield className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Organization Owner
                          </p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate mt-0.5">
                            {typeof orgData?.owner === "object"
                              ? orgData.owner.name || orgData.owner.email
                              : orgData?.owner || "N/A"}
                          </p>
                        </div>
                      </div>

                      {/* Active Members Count */}
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Total Members
                          </p>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                            {orgData?.memberCount || 0} Members
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Action Controls */}
                {isOwnerOrAdmin && (
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={handleReset}
                      disabled={!isDirty || saving}
                      className={`px-5 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
                        isDirty
                          ? "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600"
                          : "opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Changes
                    </button>
                    <button
                      type="submit"
                      disabled={!isDirty || saving}
                      className={`px-6 py-2.5 rounded-2xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                        isDirty
                          ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/25"
                          : "opacity-40 cursor-not-allowed bg-blue-400 shadow-none"
                      }`}
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Save Settings
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default OrganizationSettings;
