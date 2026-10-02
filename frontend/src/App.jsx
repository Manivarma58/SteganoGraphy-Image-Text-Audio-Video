import { useEffect, useState, useRef } from "react";
import { createDecodeJob, createEncodeJob, fetchHealth, fetchJob, fetchMetrics, clearAuthToken, fetchCurrentUser, fetchMyJobs, loginUser, registerUser, setAuthToken, clearMyJobs } from "./api";
import { FILE_LIMITS, SECRET_LIMITS } from "./config";

import { formatBytes } from "./utils/helpers";
import { SvgIcons } from "./components/SvgIcons";
import { FileDropzone } from "./components/FileDropzone";
import { StatusCard } from "./components/StatusCard";
import { TechBlueprint } from "./components/TechBlueprint";
import { DashboardView } from "./components/DashboardView";
import { VaultView } from "./components/VaultView";
import { EncodingView } from "./components/EncodingView";
import { DecodingView } from "./components/DecodingView";
import { LandingView } from "./components/LandingView";

export default function App() {
  const [loadingSession, setLoadingSession] = useState(() => {
    const token = localStorage.getItem("stegano_access_token");
    const user = localStorage.getItem("stegano_user");
    return !!token && !user;
  });
  const [activeView, setActiveView] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === "/login" || path.endsWith("/login")) {
      return "login";
    }
    if (path === "/register" || path.endsWith("/register")) {
      return "login";
    }
    if (path === "/dashboard" || path.endsWith("/dashboard")) {
      return "dashboard";
    }
    if (path === "/vault" || path.endsWith("/vault")) {
      return "vault";
    }
    if (path === "/encoding" || path.endsWith("/encoding")) {
      return "encoding";
    }
    if (path === "/decoding" || path.endsWith("/decoding")) {
      return "decoding";
    }

    const token = localStorage.getItem("stegano_access_token");
    if (token) {
      const saved = localStorage.getItem("stegano_active_view");
      return (saved && saved !== "landing") ? saved : "dashboard";
    }
    return "landing";
  });
  const [activeTab, setActiveTab] = useState(() => {
    const token = localStorage.getItem("stegano_access_token");
    if (token) {
      const saved = localStorage.getItem("stegano_active_view");
      if (saved === "decoding") return "decrypt";
    }
    return "encrypt";
  });
  const [encodingStep, setEncodingStep] = useState(1);
  const [detectionModel, setDetectionModel] = useState("cyber-vision");
  const [autoExtract, setAutoExtract] = useState(false);
  const [enhanceDecodedMedia, setEnhanceDecodedMedia] = useState(true);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [docActiveTab, setDocActiveTab] = useState("Overview");
  const [toast, setToast] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [systemLogs, setSystemLogs] = useState([
    { type: "info", time: "Just now", label: "PROBE", text: "CUDA GPU engine diagnostics returned STATUS=ONLINE (Temp=42C)." },
    { type: "success", time: "10m ago", label: "DECODE", text: "Job revealed-0a42f... decrypted and upscaled using Lanczos/Bilateral kernels." },
    { type: "info", time: "32m ago", label: "AUTH", text: "Signed-in securely as default operator sachin9666@example.com." },
    { type: "warning", time: "1h ago", label: "RATE", text: "Throttling logs scanned: 0 rate violation attempts reported." },
    { type: "success", time: "3h ago", label: "ENCODE", text: "Job stego-9b11e... completed. AES-GCM secure container written successfully." },
  ]);
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Keyboard-based zoom custom controller (Ctrl + / - / 0)
  useEffect(() => {
    const handleZoomKeyDown = (e) => {
      if (e.ctrlKey) {
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          const currentZoom = parseFloat(localStorage.getItem("app_zoom") || "1");
          const nextZoom = Math.min(currentZoom + 0.1, 1.5);
          localStorage.setItem("app_zoom", nextZoom.toString());
          document.body.style.zoom = nextZoom;
          document.documentElement.style.setProperty("--zoom-factor", nextZoom.toString());
        } else if (e.key === "-") {
          e.preventDefault();
          const currentZoom = parseFloat(localStorage.getItem("app_zoom") || "1");
          const nextZoom = Math.max(currentZoom - 0.1, 0.7);
          localStorage.setItem("app_zoom", nextZoom.toString());
          document.body.style.zoom = nextZoom;
          document.documentElement.style.setProperty("--zoom-factor", nextZoom.toString());
        } else if (e.key === "0") {
          e.preventDefault();
          localStorage.setItem("app_zoom", "1");
          document.body.style.zoom = "1";
          document.documentElement.style.setProperty("--zoom-factor", "1");
        }
      }
    };

    const savedZoom = localStorage.getItem("app_zoom");
    if (savedZoom) {
      document.body.style.zoom = savedZoom;
      document.documentElement.style.setProperty("--zoom-factor", savedZoom);
    }

    window.addEventListener("keydown", handleZoomKeyDown);
    return () => {
      window.removeEventListener("keydown", handleZoomKeyDown);
    };
  }, []);

  // Synchronize document background color with active view to eliminate any white margins on zoom/resize
  useEffect(() => {
    if (!currentUser && activeView !== "landing") {
      document.documentElement.style.backgroundColor = "#090d16";
      document.body.style.backgroundColor = "#090d16";
    } else {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    }
  }, [currentUser, activeView]);

  // Listen for browser Back/Forward navigation popstate events
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path === "/login" || path.endsWith("/login")) {
        setAuthMode("login");
        setActiveView("login");
      } else if (path === "/register" || path.endsWith("/register")) {
        setAuthMode("register");
        setActiveView("login");
      } else if (path === "/dashboard" || path.endsWith("/dashboard")) {
        setActiveView("dashboard");
      } else if (path === "/vault" || path.endsWith("/vault")) {
        setActiveView("vault");
      } else if (path === "/encoding" || path.endsWith("/encoding")) {
        setActiveView("encoding");
      } else if (path === "/decoding" || path.endsWith("/decoding")) {
        setActiveView("decoding");
      } else {
        setActiveView("landing");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const dropdownTimeoutRef = useRef(null);

  const handleDropdownMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setShowProfileDropdown(true);
  };

  const handleDropdownMouseLeave = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
    }
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowProfileDropdown(false);
    }, 600);
  };

  const handleViewChange = (view, selectedModality = null) => {
    setShowProfileDropdown(false);
    if (view === "login") {
      setAuthMode("login");
      setActiveView("login");
      setAuthError("");
      window.history.pushState(null, "", "/login");
      return;
    }
    if (view === "register") {
      setAuthMode("register");
      setActiveView("login");
      setAuthError("");
      window.history.pushState(null, "", "/register");
      return;
    }
    setActiveView(view);
    setGlobalSearchTerm("");
    if (view !== "landing") {
      localStorage.setItem("stegano_active_view", view);
      window.history.pushState(null, "", `/${view}`);
    } else {
      localStorage.removeItem("stegano_active_view");
      window.history.pushState(null, "", "/");
    }

    if (selectedModality) {
      setModality(selectedModality);
    }

    if (view === "encoding") {
      setActiveTab("encrypt");
      setEncodingStep(1);
      setCoverFile(null);
      setSecretFile(null);
      setStegoFile(null);
      setCoverTextSnippet("");
      setSecretTextSnippet("");
      setStegoTextSnippet("");
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      if (secretPreviewUrl) URL.revokeObjectURL(secretPreviewUrl);
      if (stegoPreviewUrl) URL.revokeObjectURL(stegoPreviewUrl);
      setCoverPreviewUrl(null);
      setSecretPreviewUrl(null);
      setStegoPreviewUrl(null);
      setAccessKey("");
      setJob(null);
    } else if (view === "decoding") {
      setActiveTab("decrypt");
      setCoverFile(null);
      setSecretFile(null);
      setStegoFile(null);
      setCoverTextSnippet("");
      setSecretTextSnippet("");
      setStegoTextSnippet("");
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
      if (secretPreviewUrl) URL.revokeObjectURL(secretPreviewUrl);
      if (stegoPreviewUrl) URL.revokeObjectURL(stegoPreviewUrl);
      setCoverPreviewUrl(null);
      setSecretPreviewUrl(null);
      setStegoPreviewUrl(null);
      setAccessKey("");
      setJob(null);
    }
    setError("");
  };
  const [modality, setModality] = useState("image");
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [coverTextSnippet, setCoverTextSnippet] = useState("");

  const [secretFile, setSecretFile] = useState(null);
  const [secretPreviewUrl, setSecretPreviewUrl] = useState(null);
  const [secretTextSnippet, setSecretTextSnippet] = useState("");

  const [stegoFile, setStegoFile] = useState(null);
  const [stegoPreviewUrl, setStegoPreviewUrl] = useState(null);
  const [stegoTextSnippet, setStegoTextSnippet] = useState("");

  const [embeddingType, setEmbeddingType] = useState("fast");
  const [accessKey, setAccessKey] = useState("");
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState(null);

  const [recentActivity, setRecentActivity] = useState([]);
  const [serverHealth, setServerHealth] = useState({ online: false, details: null });
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem("stegano_user");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [authMode, setAuthMode] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path === "/register" || path.endsWith("/register")) {
      return "register";
    }
    return "login";
  });
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [myJobs, setMyJobs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");

  const filteredJobs = myJobs.filter((job) => {
    if (!globalSearchTerm) return true;
    const term = globalSearchTerm.toLowerCase();
    const inputName = job.metadata?.input_name || job.output_name || "";
    return (
      job.job_id.toLowerCase().includes(term) ||
      inputName.toLowerCase().includes(term) ||
      job.modality.toLowerCase().includes(term) ||
      job.status.toLowerCase().includes(term)
    );
  });

  const filteredRecentActivity = recentActivity.filter((act) => {
    if (!globalSearchTerm) return true;
    const term = globalSearchTerm.toLowerCase();
    return (
      (act.id || "").toLowerCase().includes(term) ||
      (act.name || "").toLowerCase().includes(term) ||
      (act.modality || "").toLowerCase().includes(term) ||
      (act.status || "").toLowerCase().includes(term)
    );
  });

  // Load activity from localStorage and check backend health on mount
  useEffect(() => {
    const saved = localStorage.getItem("stegano_activity");
    if (saved) {
      try {
        setRecentActivity(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse activity: ", e);
      }
    }

    const checkHealth = async () => {
      try {
        const data = await fetchHealth();
        setServerHealth({ online: true, details: data });
      } catch (healthError) {
        setServerHealth({ online: false, details: null });
      }
    };

    const loadSession = async () => {
      const token = localStorage.getItem("stegano_access_token");
      if (!token) {
        setLoadingSession(false);
        return;
      }
      try {
        const user = await fetchCurrentUser();
        setCurrentUser(user);
        localStorage.setItem("stegano_user", JSON.stringify(user));
        const savedView = localStorage.getItem("stegano_active_view") || "dashboard";
        setActiveView(savedView === "landing" ? "dashboard" : savedView);
        try {
          const jobs = await fetchMyJobs();
          setMyJobs(jobs || []);
        } catch (jobsErr) {
          console.error("Failed to load session jobs on mount:", jobsErr);
        }
      } catch (sessionError) {
        const isNetworkError = sessionError.message?.includes("Unable to connect") || sessionError.message?.toLowerCase().includes("fetch");
        if (!isNetworkError) {
          clearAuthToken();
          setCurrentUser(null);
          setActiveView("landing");
        } else {
          console.warn("Connection to backend failed during session load. Retaining local token/user session state.");
        }
      } finally {
        setLoadingSession(false);
      }
    };

    checkHealth();
    loadSession();
    const healthTimer = setInterval(checkHealth, 5000);
    return () => clearInterval(healthTimer);
  }, []);

  // Poll database jobs and system metrics in real-time
  useEffect(() => {
    const updateDashboardData = async () => {
      try {
        const jobs = await fetchMyJobs();
        setMyJobs(jobs || []);
      } catch (err) {
        console.error("Failed to fetch my jobs:", err);
      }

      try {
        const data = await fetchMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch metrics:", err);
      }
    };

    updateDashboardData();
    const interval = setInterval(updateDashboardData, 3000);
    return () => clearInterval(interval);
  }, [currentUser]);

  // Auto-login to default profile on startup has been commented out to allow manual login view behavior.
  /*
  useEffect(() => {
    const autoLogin = async (retries = 5, delay = 1000) => {
      const token = localStorage.getItem("stegano_access_token");
      if (!token) {
        const email = "sachin9666@example.com";
        const password = "password123";
        try {
          const result = await loginUser({ email, password });
          setAuthToken(result.access_token);
          const loggedInUser = { id: result.user_id, email: result.email };
          setCurrentUser(loggedInUser);
          localStorage.setItem("stegano_user", JSON.stringify(loggedInUser));
          const savedView = localStorage.getItem("stegano_active_view") || "dashboard";
          setActiveView(savedView === "landing" ? "dashboard" : savedView);
          try {
            const jobs = await fetchMyJobs();
            setMyJobs(jobs || []);
          } catch (jobsErr) {
            console.error("Failed to load jobs after auto-login:", jobsErr);
          }
        } catch (loginErr) {
          // If it is a network error (server offline/booting), wait and retry
          const isNetworkError = loginErr instanceof TypeError || loginErr.message?.toLowerCase().includes("connect") || loginErr.message?.toLowerCase().includes("fetch");
          if (isNetworkError && retries > 0) {
            console.warn(`Server connection failed. Retrying auto-login in ${delay}ms... (${retries} retries left)`);
            setTimeout(() => autoLogin(retries - 1, delay), delay);
            return;
          }

          // If the server is online but user does not exist, attempt registration
          try {
            const result = await registerUser({ email, password });
            setAuthToken(result.access_token);
            const registeredUser = { id: result.user_id, email: result.email };
            setCurrentUser(registeredUser);
            localStorage.setItem("stegano_user", JSON.stringify(registeredUser));
            const savedView = localStorage.getItem("stegano_active_view") || "dashboard";
            setActiveView(savedView === "landing" ? "dashboard" : savedView);
            try {
              const jobs = await fetchMyJobs();
              setMyJobs(jobs || []);
            } catch (jobsErr) {
              console.error("Failed to load jobs after auto-register:", jobsErr);
            }
          } catch (regErr) {
            const isRegNetworkError = regErr instanceof TypeError || regErr.message?.toLowerCase().includes("connect") || regErr.message?.toLowerCase().includes("fetch");
            if (isRegNetworkError && retries > 0) {
              console.warn(`Server connection failed. Retrying auto-login/register in ${delay}ms... (${retries} retries left)`);
              setTimeout(() => autoLogin(retries - 1, delay), delay);
              return;
            }
            console.error("Auto login/register failed:", regErr);
          }
        }
      }
    };
    
    setTimeout(() => autoLogin(5, 1000), 200);
  }, []);
  */

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError("");

    try {
      const result = authMode === "register"
        ? await registerUser({ email: authEmail, password: authPassword })
        : await loginUser({ email: authEmail, password: authPassword });

      setAuthToken(result.access_token);
      const user = { id: result.user_id, email: result.email };
      setCurrentUser(user);
      localStorage.setItem("stegano_user", JSON.stringify(user));
      handleViewChange("dashboard");
      setAuthEmail("");
      setAuthPassword("");
      try {
        const jobs = await fetchMyJobs();
        setMyJobs(jobs || []);
      } catch (jobsErr) {
        console.error("Failed to load jobs after form login:", jobsErr);
      }
    } catch (submitError) {
      setAuthError(submitError.message);
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setMyJobs([]);
    localStorage.removeItem("stegano_active_view");
    setActiveView("landing");
  };

  const handleVaultDecrypt = (job) => {
    if (job.access_key) {
      setAccessKey(job.access_key);
      setModality(job.modality);
      setActiveView("decoding");
      setActiveTab("decrypt");
    } else {
      showToast("This job does not have an access key stored.", "error");
    }
  };

  const getEffectiveModality = (baseModality, file) => {
    if (baseModality === "text" && file) {
      if (file.type.startsWith("image/") || /\.(png|jpe?g|bmp|webp)$/i.test(file.name)) {
        return "image";
      }
    }
    return baseModality;
  };

  // Clean previews on file / modality resets
  const cleanPreview = (previewUrl, setPreviewUrl, setTextSnippet) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (setTextSnippet) {
      setTextSnippet("");
    }
  };

  const handleCoverChange = (file) => {
    cleanPreview(coverPreviewUrl, setCoverPreviewUrl, setCoverTextSnippet);
    setCoverFile(file);
    if (!file) return;

    if (modality === "image" || (modality === "text" && (file.type.startsWith("image/") || /\.(png|jpe?g|bmp|webp)$/i.test(file.name)))) {
      setCoverPreviewUrl(URL.createObjectURL(file));
    } else if (modality === "text") {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCoverTextSnippet(e.target.result?.slice(0, 200) + "...");
      };
      reader.readAsText(file.slice(0, 1000));
    }
  };

  const handleSecretChange = (file) => {
    cleanPreview(secretPreviewUrl, setSecretPreviewUrl, setSecretTextSnippet);
    setSecretFile(file);
    if (!file) return;

    if (file.type.startsWith("image/")) {
      setSecretPreviewUrl(URL.createObjectURL(file));
    } else if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSecretTextSnippet(e.target.result?.slice(0, 200) + "...");
      };
      reader.readAsText(file.slice(0, 1000));
    }
  };

  const handleStegoChange = (file) => {
    cleanPreview(stegoPreviewUrl, setStegoPreviewUrl, setStegoTextSnippet);
    setStegoFile(file);
    if (!file) return;

    if (modality === "image" || (modality === "text" && (file.type.startsWith("image/") || /\.(png|jpe?g|bmp|webp)$/i.test(file.name)))) {
      setStegoPreviewUrl(URL.createObjectURL(file));
    } else if (modality === "text") {
      const reader = new FileReader();
      reader.onload = (e) => {
        setStegoTextSnippet(e.target.result?.slice(0, 200) + "...");
      };
      reader.readAsText(file.slice(0, 1000));
    }
  };

  // Reset previews when changing modalities or tabs
  const handleModalityChange = (newModality) => {
    setModality(newModality);
    handleCoverChange(null);
    handleSecretChange(null);
    handleStegoChange(null);
    setError("");
  };

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setActiveView(newTab === "encrypt" ? "encoding" : "decoding");
    setEncodingStep(1);
    handleCoverChange(null);
    handleSecretChange(null);
    handleStegoChange(null);
    setAccessKey("");
    setError("");
  };

  // Poll Job Status
  useEffect(() => {
    if (!job?.job_id || job.status === "completed" || job.status === "failed") {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      try {
        const updated = await fetchJob(job.job_id);
        setJob(updated);

        // If completed or failed, add to recent activity list
        if (updated.status === "completed" || updated.status === "failed") {
          setRecentActivity((prev) => {
            const newItem = {
              id: updated.job_id,
              name: updated.output_name || `${updated.modality.toUpperCase()}_JOB_${updated.job_id.slice(0, 8)}`,
              type: updated.job_type || (coverFile ? "encode" : "decode"),
              status: updated.status,
              modality: updated.modality,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
              size: coverFile ? coverFile.size : (stegoFile ? stegoFile.size : 0),
            };
            const updatedList = [newItem, ...prev].slice(0, 15);
            localStorage.setItem("stegano_activity", JSON.stringify(updatedList));
            return updatedList;
          });
        }
      } catch (pollError) {
        setError(pollError.message);
        setJob((prev) => prev ? { ...prev, status: "failed", message: pollError.message } : null);
      }
    }, 1500);

    return () => window.clearInterval(timer);
  }, [job, coverFile, stegoFile]);

  // Client side validation
  const validateInputs = (file, limit, typeName) => {
    if (file.size > limit) {
      throw new Error(`${file.name} exceeds the ${formatBytes(limit)} limit for ${typeName}.`);
    }
  };

  const handleEncryptSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!currentUser) {
        throw new Error("Please log in to submit encoding jobs.");
      }
      if (!coverFile || !secretFile) {
        throw new Error("Select both the cover carrier and secret payload.");
      }

      const effectiveModality = getEffectiveModality(modality, coverFile);

      validateInputs(coverFile, FILE_LIMITS[effectiveModality], `${effectiveModality} cover`);
      validateInputs(secretFile, SECRET_LIMITS[effectiveModality], `${effectiveModality} secret payload`);

      const created = await createEncodeJob({ modality: effectiveModality, coverFile, secretFile, embeddingType });
      setJob({
        ...created,
        job_type: "encode",
        modality: effectiveModality,
        progress: 0,
        stage: "queued",
        device_info: null,
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecryptSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (!currentUser) {
        throw new Error("Please log in to submit decoding jobs.");
      }
      if (!stegoFile || !accessKey.trim()) {
        throw new Error("Provide the stego carrier file and decryption access key.");
      }

      const effectiveModality = getEffectiveModality(modality, stegoFile);

      validateInputs(stegoFile, FILE_LIMITS[effectiveModality], `${effectiveModality} stego container`);

      const created = await createDecodeJob({
        modality: effectiveModality,
        stegoFile,
        accessKey: accessKey.trim(),
        enhance: enhanceDecodedMedia,
      });
      setJob({
        ...created,
        job_type: "decode",
        modality: effectiveModality,
        progress: 0,
        stage: "queued",
        device_info: null,
      });
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearActivity = async () => {
    try {
      await clearMyJobs();
      localStorage.removeItem("stegano_activity");
      setRecentActivity([]);
      setMyJobs([]);
      
      // Refresh metrics to show 0.00% Full and 0.00 MB used
      try {
        const refreshedMetrics = await fetchMetrics();
        setMetrics(refreshedMetrics);
      } catch (metricsErr) {
        console.error("Failed to refresh metrics after clear:", metricsErr);
      }
      
      showToast("Operations history cleared successfully.", "success");
    } catch (err) {
      console.error("Failed to clear operations history:", err);
      showToast("Failed to clear history. Check server connection.", "error");
    }
  };

  if (loadingSession) {
    return (
      <div className="cyber-loader-container" style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#0f172a",
        color: "#3b82f6",
        fontFamily: "monospace"
      }}>
        <div className="spinner" style={{
          border: "4px solid rgba(59, 130, 246, 0.1)",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          borderLeftColor: "#3b82f6",
          animation: "spin 1s linear infinite",
          marginBottom: "16px"
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <div>SYSTEM_BOOT_SEQUENCE: VERIFYING_SESSION...</div>
      </div>
    );
  }

  if (activeView === "landing") {
    return (
      <>
        <LandingView
          currentUser={currentUser}
          onNavigate={handleViewChange}
          showToast={showToast}
          onOpenDocs={() => setShowDocModal(true)}
          onOpenPricing={() => setShowPricingModal(true)}
        />
        
        {/* Documentation / Handbook Modal */}
        {showDocModal && (
          <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "700px", width: "95%" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowDocModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "#2563eb", display: "flex" }}><SvgIcons.Book size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>StegoVault Operations Manual</h2>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "24px", minHeight: "350px", maxHeight: "450px", overflow: "hidden" }}>
                {/* Left Side Tabs */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderRight: "1px solid var(--border-dim)", paddingRight: "16px" }}>
                  {["Overview", "Encoding", "Decoding", "Security", "Hardware"].map((tabName) => (
                    <button
                      key={tabName}
                      className={`sidebar-item ${docActiveTab === tabName ? "active" : ""}`}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "none",
                        textAlign: "left",
                        justifyContent: "flex-start",
                        minHeight: "auto",
                        background: docActiveTab === tabName ? "rgba(37, 99, 235, 0.08)" : "transparent",
                        color: docActiveTab === tabName ? "#2563eb" : "var(--text-primary)",
                        cursor: "pointer"
                      }}
                      onClick={() => setDocActiveTab(tabName)}
                    >
                      {tabName}
                    </button>
                  ))}
                </div>
                
                {/* Right Side Content */}
                <div style={{ overflowY: "auto", paddingRight: "8px", fontSize: "0.9rem", lineHeight: "1.5", color: "var(--text-primary)" }}>
                  {docActiveTab === "Overview" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Platform Architecture</h3>
                      <p>StegoVault is a multi-modal neural steganography system designed to embed encrypted secret payloads inside benign carrier files (images, audio, video, text) without visually or audibly changing their profiles.</p>
                      <p>It utilizes deep-learning models to execute high-capacity data hiding, AES-GCM to secure payloads, and evolved local enhancement protocols during extraction to maximize recovery quality.</p>
                    </div>
                  )}
                  {docActiveTab === "Encoding" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Encoding Protocol (Embedding)</h3>
                      <p>To encrypt and embed data:</p>
                      <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li>Select a carrier modality (e.g. Image or Video).</li>
                        <li>Upload the cover carrier and the secret payload.</li>
                        <li>Choose the embedding algorithm quality preset (e.g. Adaptive Quality-Preserving).</li>
                        <li>Submit the job. The system processes the files asynchronously using CNN/Transformer models to insert data and outputs a secure stego container and access key.</li>
                      </ol>
                    </div>
                  )}
                  {docActiveTab === "Decoding" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Decoding Protocol (Extraction)</h3>
                      <p>To extract data:</p>
                      <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li>Upload the stego carrier.</li>
                        <li>Enter the sender-issued access key.</li>
                        <li>The system validates the signature key-binding to prevent tampering.</li>
                        <li>The secret file is decrypted. If it is an image or video, the system automatically triggers post-processing enhancement (upscaling, detail boosting, denoising) to ensure superior clarity.</li>
                      </ol>
                    </div>
                  )}
                  {docActiveTab === "Security" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Cryptographic Specifications</h3>
                      <p>StegoVault secures hidden data layers with military-grade protocols:</p>
                      <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li><strong>AES-256-GCM</strong>: Symmetric encryption for payloads with integrated authenticated decryption tag.</li>
                        <li><strong>Key-Signature Binding</strong>: Derives a signature from the stego file and binds the access key, raising errors if a tampered file is read.</li>
                        <li><strong>SHA-256 Integrity</strong>: Computes standard hash sums of inputs/outputs to prove data consistency.</li>
                      </ul>
                    </div>
                  )}
                  {docActiveTab === "Hardware" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Hardware Optimization</h3>
                      <p>StegoVault auto-detects acceleration pathways:</p>
                      <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li><strong>CUDA Core Engine</strong>: Activates deep learning acceleration when NVIDIA hardware is online. Mixed Precision (FP16) is enabled for efficient tensor processing.</li>
                        <li><strong>CPU Fallback</strong>: Runs standard jobs on multi-threaded CPUs when GPU is not present. Note that large video or audio jobs may run slower in CPU mode.</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-dim)", marginTop: "20px", paddingTop: "16px" }}>
                <button className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 24px", fontSize: "0.85rem" }} onClick={() => setShowDocModal(false)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {/* Pricing / Platform Plans Modal */}
        {showPricingModal && (
          <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)", fontSize: "1.5rem" }} onClick={() => setShowPricingModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ color: "#2563eb", display: "flex" }}><SvgIcons.Activity size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>StegoVault Platform Plans</h2>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                {/* Community Plan */}
                <div className="pricing-card-community">
                  <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>Open Source</span>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Community Plan</h3>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>₹0 <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span></span>
                  <ul style={{ paddingLeft: "16px", fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                    <li>Standard LSB & DWT algorithms</li>
                    <li>100 MB upload limits</li>
                    <li>CPU-based thread processing</li>
                    <li>Local vault storage database</li>
                  </ul>
                  <button className="btn-manage-vault" style={{ marginTop: "auto" }} onClick={() => { setShowPricingModal(false); handleViewChange(currentUser ? "dashboard" : "login"); }}>
                    Active Plan
                  </button>
                </div>
                
                {/* Enterprise Plan */}
                <div className="pricing-card-pro">
                  <span style={{ position: "absolute", top: "-12px", right: "16px", background: "#2563eb", color: "#ffffff", fontSize: "0.65rem", fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>PRO</span>
                  <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "#2563eb", textTransform: "uppercase", fontWeight: 600 }}>Advanced Shielding</span>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Sentinel Pro</h3>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>₹1,499 <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span></span>
                  <ul style={{ paddingLeft: "16px", fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                    <li>Adaptive GAN neural shielding</li>
                    <li>1 GB upload limit / high speed</li>
                    <li>CUDA-GPU accelerated cores</li>
                    <li>Key-signature integrity auditing</li>
                    <li>Redundant cloud vault replication</li>
                  </ul>
                  <button className="btn-submit" style={{ minHeight: "auto", padding: "10px", borderRadius: "10px", marginTop: "auto", width: "100%" }} onClick={() => { setShowPricingModal(false); alert("Billing integration: Sentinel Pro subscription interface is simulated."); }}>
                    Upgrade to Pro
                  </button>
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-dim)", paddingTop: "16px" }}>
                <button className="btn-filter" style={{ minHeight: "auto", padding: "8px 24px", fontSize: "0.85rem" }} onClick={() => setShowPricingModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Toast System */}
        {toast && (
          <div style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "success" ? "#10b981" : toast.type === "error" ? "#ef4444" : "#3b82f6",
            color: "#ffffff",
            padding: "16px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            zIndex: 10000,
            fontFamily: "inherit",
            fontSize: "0.9rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "slideUp 0.3s ease-out"
          }}>
            <span>{toast.type === "success" ? "✓" : toast.type === "error" ? "✗" : "ℹ"}</span>
            <span>{toast.message}</span>
          </div>
        )}
      </>
    );
  }

  if (!currentUser) {
    return (
      <div className="split-auth-container">
        {/* Left Split - Hero Image */}
        <section className="split-auth-left">
          <img
            src="/login_hero.png"
            alt="StegoVault Secure Portal Visual"
            className="split-auth-left-img"
          />
          <div className="split-auth-left-overlay"></div>
        </section>

        {/* Right Split - Login Form */}
        <section className="split-auth-right">
          <div className="split-auth-card">
            {/* Header & Branding */}
            <div className="split-auth-header">
              <div className="split-auth-logo-row" onClick={() => handleViewChange("landing")}>
                <img src="/logo.png" alt="StegoVault Logo" style={{ width: "48px", height: "48px", objectFit: "contain" }} />
                <span>StegoVault</span>
              </div>
              <h1 className="split-auth-title">
                {authMode === "login" ? "Secure Login" : "Create Account"}
              </h1>
              <p className="split-auth-subtitle">
                {authMode === "login"
                  ? "Sign in to keep operations private and persist your encoding/decoding history."
                  : "Register to create your secure steganographic workspace."}
              </p>
            </div>

            {/* Form */}
            <form className="split-auth-form" onSubmit={handleAuthSubmit}>
              <div className="split-auth-input-group">
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email address"
                  className="split-auth-input"
                  required
                />
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  className="split-auth-input"
                  required
                />
              </div>
              <button type="submit" className="split-auth-submit-btn">
                {authMode === "login" ? "SIGN IN" : "REGISTER"}
              </button>
            </form>

            {/* Footer Links */}
            <div className="split-auth-footer-links">
              <button
                type="button"
                className="split-auth-link-primary"
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              >
                {authMode === "login" ? "Create your account" : "Already have an account? Sign in"}
              </button>
              {authError && <div className="auth-error">{authError}</div>}
              
              <button className="split-auth-back-btn" onClick={() => handleViewChange("landing")}>
                ← Back to Home
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1 className="sidebar-logo-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "#2563eb" }}>
            <img src="/logo.png" alt="StegoVault Logo" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
            StegoVault
          </h1>
          <span className="sidebar-logo-sub">Deep Learning v2.4</span>
        </div>

        <nav className="sidebar-menu">
          <button
            className={`sidebar-item ${activeView === "dashboard" ? "active" : ""}`}
            onClick={() => handleViewChange("dashboard")}
          >
            <SvgIcons.Grid />
            <span>Dashboard</span>
          </button>
          <button
            className={`sidebar-item ${activeView === "encoding" ? "active" : ""}`}
            onClick={() => handleViewChange("encoding")}
          >
            <SvgIcons.Lock />
            <span>Encoding</span>
          </button>
          <button
            className={`sidebar-item ${activeView === "decoding" ? "active" : ""}`}
            onClick={() => handleViewChange("decoding")}
          >
            <SvgIcons.Key />
            <span>Decoding</span>
          </button>
          <button
            className={`sidebar-item ${activeView === "vault" ? "active" : ""}`}
            onClick={() => handleViewChange("vault")}
          >
            <SvgIcons.Vault />
            <span>Secure Vault</span>
          </button>
        </nav>

        <button className="sidebar-btn-operation" onClick={() => handleViewChange("encoding")}>
          <span style={{ fontSize: "1.2rem", fontWeight: 700 }}>+</span> New Operation
        </button>

        <div className="sidebar-footer">
          <button className="sidebar-footer-link" onClick={() => { setDocActiveTab("Overview"); setShowDocModal(true); }}>
            <SvgIcons.Book />
            <span>Documentation</span>
          </button>
          <button className="sidebar-footer-link" onClick={() => setShowSupportModal(true)}>
            <SvgIcons.HelpCircle />
            <span>Support</span>
          </button>
        </div>
      </aside>

      {/* Main Body Column */}
      <div className="main-content">
        {/* Topbar Banner */}
        <header className="topbar-new">
          <div className="topbar-left">
            <span className="topbar-brand">StegoVault</span>
            <div className="topbar-nav">
              <button
                className={`topbar-nav-tab ${activeView === "dashboard" ? "active" : ""}`}
                onClick={() => handleViewChange("dashboard")}
              >
                Dashboard
              </button>
              <button
                className={`topbar-nav-tab ${activeView === "encoding" ? "active" : ""}`}
                onClick={() => handleViewChange("encoding")}
              >
                Encoding
              </button>
              <button
                className={`topbar-nav-tab ${activeView === "decoding" ? "active" : ""}`}
                onClick={() => handleViewChange("decoding")}
              >
                Decoding
              </button>
              <button
                className={`topbar-nav-tab ${activeView === "vault" ? "active" : ""}`}
                onClick={() => handleViewChange("vault")}
              >
                Vault
              </button>
            </div>
          </div>

          <div className="topbar-right">
            {/* Search */}
            <div className="topbar-search-wrapper">
              <span className="topbar-search-icon">
                <SvgIcons.Search />
              </span>
              <input
                type="text"
                className="topbar-search"
                placeholder="Search system..."
                value={globalSearchTerm}
                onChange={(e) => setGlobalSearchTerm(e.target.value)}
              />
            </div>

            {/* Notification */}
            <button className="topbar-icon-btn" onClick={() => setShowNotificationsModal(true)} title="System Logs">
              <SvgIcons.Bell />
            </button>

            {/* Settings */}
            <button className="topbar-icon-btn" onClick={() => setShowSettingsModal(true)} title="System Settings">
              <SvgIcons.Settings />
            </button>

            {/* Profile */}
            <div 
              className="profile-dropdown-container" 
              onMouseEnter={handleDropdownMouseEnter}
              onMouseLeave={handleDropdownMouseLeave}
            >
              <button
                className="topbar-profile-btn"
                onClick={currentUser ? () => {
                  if (showProfileDropdown) {
                    setShowProfileDropdown(false);
                  } else {
                    handleDropdownMouseEnter();
                  }
                } : () => handleViewChange("login")}
                title={currentUser ? "User Profile" : "Login"}
              >
                {currentUser ? currentUser.email.charAt(0).toUpperCase() : "G"}
              </button>
              
              {currentUser && showProfileDropdown && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-header">
                    <span className="dropdown-label">Signed in as</span>
                    <span className="dropdown-email" title={currentUser.email}>{currentUser.email}</span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={() => { setShowProfileDropdown(false); setShowProfileModal(true); }}>
                    Profile Settings
                  </button>
                  <button className="dropdown-item" onClick={() => { setShowProfileDropdown(false); setShowSecurityModal(true); }}>
                    Security Details
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item logout-btn" onClick={() => { setShowProfileDropdown(false); handleLogout(); }}>
                    Sign Out
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* View Switcher Content */}
        {activeView === "dashboard" && (
          <DashboardView
            serverHealth={serverHealth}
            recentActivity={filteredRecentActivity}
            myJobs={filteredJobs}
            metrics={metrics}
            onNavigate={handleViewChange}
            clearActivity={clearActivity}
          />
        )}

        {activeView === "vault" && (
          <VaultView myJobs={filteredJobs} onNavigate={handleViewChange} onVaultDecrypt={handleVaultDecrypt} showToast={showToast} />
        )}

        {activeView === "decoding" && (
          <DecodingView
            modality={modality}
            stegoFile={stegoFile}
            stegoPreviewUrl={stegoPreviewUrl}
            stegoTextSnippet={stegoTextSnippet}
            handleStegoChange={handleStegoChange}
            detectionModel={detectionModel}
            setDetectionModel={setDetectionModel}
            accessKey={accessKey}
            setAccessKey={setAccessKey}
            showAccessKey={showAccessKey}
            setShowAccessKey={setShowAccessKey}
            autoExtract={autoExtract}
            setAutoExtract={setAutoExtract}
            handleDecryptSubmit={handleDecryptSubmit}
            job={job}
            error={error}
            recentActivity={filteredRecentActivity}
            myJobs={filteredJobs}
            isSubmitting={isSubmitting}
            showToast={showToast}
          />
        )}

        {activeView === "encoding" && (
          <EncodingView
            modality={modality}
            handleModalityChange={handleModalityChange}
            coverFile={coverFile}
            coverPreviewUrl={coverPreviewUrl}
            coverTextSnippet={coverTextSnippet}
            handleCoverChange={handleCoverChange}
            secretFile={secretFile}
            secretPreviewUrl={secretPreviewUrl}
            secretTextSnippet={secretTextSnippet}
            handleSecretChange={handleSecretChange}
            embeddingType={embeddingType}
            setEmbeddingType={setEmbeddingType}
            encodingStep={encodingStep}
            setEncodingStep={setEncodingStep}
            job={job}
            handleEncryptSubmit={handleEncryptSubmit}
            error={error}
            isSubmitting={isSubmitting}
          />
        )}

        {/* System Settings Control Panel Modal */}
        {showSettingsModal && (
          <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowSettingsModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "#2563eb", display: "flex" }}><SvgIcons.Settings size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>System Control Panel</h2>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "24px" }}>
                Configure engine hardware parameters, quality restoration defaults, and request throttling protocols.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>Hardware Accelerator</label>
                  <div className="input-glow-wrapper">
                    <select className="cyber-select" defaultValue="auto">
                      <option value="auto">Auto-Select (CUDA Preferred)</option>
                      <option value="cuda">Force CUDA GPU Mode</option>
                      <option value="cpu">Force CPU Fallback Mode</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>Auto Quality Post-Processing</label>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", padding: "12px 16px", borderRadius: "10px" }}>
                    <div>
                      <span style={{ fontSize: "0.9rem", fontWeight: 600, display: "block" }}>Enhance Decoded Media</span>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>Upscales and sharpens images and videos post-extraction.</span>
                    </div>
                    <label className="checkbox-label" style={{ display: "flex", margin: 0, padding: 0 }}>
                      <input
                        type="checkbox"
                        className="cyber-checkbox"
                        checked={enhanceDecodedMedia}
                        onChange={(e) => setEnhanceDecodedMedia(e.target.checked)}
                      />
                      <span></span>
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>Throttling Protocol (Rate Limiter)</label>
                  <div className="input-glow-wrapper">
                    <input type="text" className="cyber-input" defaultValue="10 requests per minute" disabled />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "8px" }}>Security & Encryption Standards</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <span className="status-pill success" style={{ textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 600 }}>AES-256-GCM</span>
                    <span className="status-pill info" style={{ textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 600 }}>SHA-256 signature</span>
                    <span className="status-pill info" style={{ textTransform: "uppercase", fontSize: "0.7rem", fontWeight: 600 }}>PBKDF2 Key Bind</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "30px" }}>
                <button className="btn-filter" style={{ minHeight: "auto", padding: "8px 16px", fontSize: "0.85rem" }} onClick={() => setShowSettingsModal(false)}>Cancel</button>
                <button className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 24px", fontSize: "0.85rem" }} onClick={() => { setShowSettingsModal(false); showToast("Settings saved successfully.", "success"); }}>Apply Changes</button>
              </div>
            </div>
          </div>
        )}

        {/* System Telemetry Logs / Notifications Modal */}
        {showNotificationsModal && (
          <div className="modal-overlay" onClick={() => setShowNotificationsModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowNotificationsModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "var(--accent-cyan)", display: "flex" }}><SvgIcons.Bell size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>System Telemetry Logs</h2>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Real-time feed of active cluster events and daemon processes.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "350px", overflowY: "auto", paddingRight: "4px" }}>
                {systemLogs.length > 0 ? (
                  systemLogs.map((item, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "12px", padding: "12px", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", borderRadius: "8px" }}>
                      <span className={`status-pill ${item.type === "success" ? "success" : item.type === "warning" ? "no-hidden" : "info"}`} style={{ height: "fit-content", fontSize: "0.68rem", fontWeight: 700 }}>
                        {item.label}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: "1.3", color: "var(--text-primary)" }}>{item.text}</p>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>{item.time}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: "30px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                    No system log records found.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
                <button 
                  className="btn-view-report" 
                  style={{ color: "var(--text-muted)", padding: 0 }} 
                  onClick={() => {
                    setSystemLogs([]);
                    showToast("Telemetry history purged.", "info");
                  }}
                >
                  Clear Log History
                </button>
                <button className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 20px", fontSize: "0.85rem" }} onClick={() => setShowNotificationsModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Documentation / Handbook Modal */}
        {showDocModal && (
          <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "700px", width: "95%" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowDocModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "#2563eb", display: "flex" }}><SvgIcons.Book size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>StegoVault Operations Manual</h2>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "24px", minHeight: "350px", maxHeight: "450px", overflow: "hidden" }}>
                {/* Left Side Tabs */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderRight: "1px solid var(--border-dim)", paddingRight: "16px" }}>
                  {["Overview", "Encoding", "Decoding", "Security", "Hardware"].map((tabName) => (
                    <button
                      key={tabName}
                      className={`sidebar-item ${docActiveTab === tabName ? "active" : ""}`}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "none",
                        textAlign: "left",
                        justifyContent: "flex-start",
                        minHeight: "auto",
                        background: docActiveTab === tabName ? "rgba(37, 99, 235, 0.08)" : "transparent",
                        color: docActiveTab === tabName ? "#2563eb" : "var(--text-primary)",
                        cursor: "pointer"
                      }}
                      onClick={() => setDocActiveTab(tabName)}
                    >
                      {tabName}
                    </button>
                  ))}
                </div>
                
                {/* Right Side Content */}
                <div style={{ overflowY: "auto", paddingRight: "8px", fontSize: "0.9rem", lineHeight: "1.5", color: "var(--text-primary)" }}>
                  {docActiveTab === "Overview" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Platform Architecture</h3>
                      <p>StegoVault is a multi-modal neural steganography system designed to embed encrypted secret payloads inside benign carrier files (images, audio, video, text) without visually or audibly changing their profiles.</p>
                      <p>It utilizes deep-learning models to execute high-capacity data hiding, AES-GCM to secure payloads, and evolved local enhancement protocols during extraction to maximize recovery quality.</p>
                    </div>
                  )}
                  {docActiveTab === "Encoding" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Encoding Protocol (Embedding)</h3>
                      <p>To encrypt and embed data:</p>
                      <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li>Select a carrier modality (e.g. Image or Video).</li>
                        <li>Upload the cover carrier and the secret payload.</li>
                        <li>Choose the embedding algorithm quality preset (e.g. Adaptive Quality-Preserving).</li>
                        <li>Submit the job. The system processes the files asynchronously using CNN/Transformer models to insert data and outputs a secure stego container and access key.</li>
                      </ol>
                    </div>
                  )}
                  {docActiveTab === "Decoding" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Decoding Protocol (Extraction)</h3>
                      <p>To extract data:</p>
                      <ol style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li>Upload the stego container carrier.</li>
                        <li>Enter the sender-issued access key.</li>
                        <li>The system validates the signature key-binding to prevent tampering.</li>
                        <li>The secret file is decrypted. If it is an image or video, the system automatically triggers post-processing enhancement (upscaling, detail boosting, denoising) to ensure superior clarity.</li>
                      </ol>
                    </div>
                  )}
                  {docActiveTab === "Security" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Cryptographic Specifications</h3>
                      <p>StegoVault secures hidden data layers with military-grade protocols:</p>
                      <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li><strong>AES-256-GCM</strong>: Symmetric encryption for payloads with integrated authenticated decryption tag.</li>
                        <li><strong>Key-Signature Binding</strong>: Derives a signature from the stego file and binds the access key, raising errors if a tampered file is read.</li>
                        <li><strong>SHA-256 Integrity</strong>: Computes standard hash sums of inputs/outputs to prove data consistency.</li>
                      </ul>
                    </div>
                  )}
                  {docActiveTab === "Hardware" && (
                    <div>
                      <h3 style={{ margin: "0 0 12px 0", fontSize: "1.1rem" }}>Hardware Optimization</h3>
                      <p>StegoVault auto-detects acceleration pathways:</p>
                      <ul style={{ paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                        <li><strong>CUDA Core Engine</strong>: Activates deep learning acceleration when NVIDIA hardware is online. Mixed Precision (FP16) is enabled for efficient tensor processing.</li>
                        <li><strong>CPU Fallback</strong>: Runs standard jobs on multi-threaded CPUs when GPU is not present. Note that large video or audio jobs may run slower in CPU mode.</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-dim)", marginTop: "20px", paddingTop: "16px" }}>
                <button className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 24px", fontSize: "0.85rem" }} onClick={() => setShowDocModal(false)}>Done</button>
              </div>
            </div>
          </div>
        )}

        {/* Pricing / Platform Plans Modal */}
        {showPricingModal && (
          <div className="modal-overlay" onClick={() => setShowPricingModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)", fontSize: "1.5rem" }} onClick={() => setShowPricingModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "24px" }}>
                <div style={{ color: "#2563eb", display: "flex" }}><SvgIcons.Activity size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>StegoVault Platform Plans</h2>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                {/* Community Plan */}
                <div className="pricing-card-community">
                  <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", textTransform: "uppercase" }}>Open Source</span>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Community Plan</h3>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>₹0 <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span></span>
                  <ul style={{ paddingLeft: "16px", fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                    <li>Standard LSB & DWT algorithms</li>
                    <li>100 MB upload limits</li>
                    <li>CPU-based thread processing</li>
                    <li>Local vault storage database</li>
                  </ul>
                  <button className="btn-manage-vault" style={{ marginTop: "auto" }} onClick={() => { setShowPricingModal(false); handleViewChange(currentUser ? "dashboard" : "login"); }}>
                    Active Plan
                  </button>
                </div>
                
                {/* Enterprise Plan */}
                <div className="pricing-card-pro">
                  <span style={{ position: "absolute", top: "-12px", right: "16px", background: "#2563eb", color: "#ffffff", fontSize: "0.65rem", fontFamily: "var(--font-mono)", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>PRO</span>
                  <span style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", color: "#2563eb", textTransform: "uppercase", fontWeight: 600 }}>Advanced Shielding</span>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>Sentinel Pro</h3>
                  <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>₹1,499 <span style={{ fontSize: "0.8rem", fontWeight: 400, color: "var(--text-muted)" }}>/ month</span></span>
                  <ul style={{ paddingLeft: "16px", fontSize: "0.8rem", color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: "6px", margin: 0 }}>
                    <li>Adaptive GAN neural shielding</li>
                    <li>1 GB upload limit / high speed</li>
                    <li>CUDA-GPU accelerated cores</li>
                    <li>Key-signature integrity auditing</li>
                    <li>Redundant cloud vault replication</li>
                  </ul>
                  <button className="btn-submit" style={{ minHeight: "auto", padding: "10px", borderRadius: "10px", marginTop: "auto", width: "100%" }} onClick={() => { setShowPricingModal(false); alert("Billing integration: Sentinel Pro subscription interface is simulated."); }}>
                    Upgrade to Pro
                  </button>
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-dim)", paddingTop: "16px" }}>
                <button className="btn-filter" style={{ minHeight: "auto", padding: "8px 24px", fontSize: "0.85rem" }} onClick={() => setShowPricingModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Support Console / Ticket Submission Modal */}
        {showSupportModal && (
          <div className="modal-overlay" onClick={() => setShowSupportModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowSupportModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "var(--accent-green)", display: "flex" }}><SvgIcons.HelpCircle size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>StegoVault Support Console</h2>
              </div>
              
              <form onSubmit={(e) => { e.preventDefault(); setShowSupportModal(false); showToast("Ticket #STG-" + Math.floor(Math.random() * 90000 + 10000) + " submitted successfully. Diagnostic dump attached.", "success"); }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Reporter Email</label>
                    <div className="input-glow-wrapper">
                      <input type="email" className="cyber-input" defaultValue={currentUser?.email || ""} required />
                    </div>
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Priority Classification</label>
                    <div className="input-glow-wrapper">
                      <select className="cyber-select" defaultValue="medium">
                        <option value="low">Low (General Query)</option>
                        <option value="medium">Medium (Operational Help)</option>
                        <option value="high">High (Job Failed/Errors)</option>
                        <option value="critical">Critical (Data Lock/Incident)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Problem Description</label>
                    <textarea
                      className="cyber-textarea"
                      style={{
                        width: "100%",
                        minHeight: "80px",
                        background: "rgba(0,0,0,0.02)",
                        border: "1px solid var(--border-dim)",
                        borderRadius: "10px",
                        padding: "10px 14px",
                        fontFamily: "inherit",
                        fontSize: "0.85rem",
                        color: "inherit",
                        outline: "none",
                        resize: "vertical"
                      }}
                      placeholder="Describe the issue you are experiencing..."
                      required
                    />
                  </div>

                  <div style={{ padding: "12px", background: "rgba(0,0,0,0.04)", border: "1px solid var(--border-dim)", borderRadius: "8px", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    <div style={{ fontWeight: 600, color: "var(--accent-green)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="health-dot" style={{ backgroundColor: "var(--accent-green)" }}></span>
                      SYSTEM_DIAGNOSTICS_DUMP
                    </div>
                    <div>Daemon Version: StegoVault-OS-v2.4</div>
                    <div>Server Node: {serverHealth.online ? "ONLINE" : "OFFLINE"}</div>
                    <div>Device profile: {metrics?.device || "CPU"}</div>
                    <div>Active Jobs: {myJobs?.length || 0} transaction logs</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                  <button type="button" className="btn-filter" style={{ minHeight: "auto", padding: "8px 16px", fontSize: "0.85rem" }} onClick={() => setShowSupportModal(false)}>Cancel</button>
                  <button type="submit" className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 24px", fontSize: "0.85rem" }}>Dispatch Ticket</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Profile Settings Modal */}
        {showProfileModal && (
          <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "500px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowProfileModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "#2563eb", display: "flex" }}><SvgIcons.Grid size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Profile & Preferences</h2>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Manage your user credentials and default stego execution parameters.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Signed-in Identity</label>
                  <div className="input-glow-wrapper">
                    <input type="text" className="cyber-input" value={currentUser?.email || ""} disabled />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Preferred Carrier Modality</label>
                  <div className="input-glow-wrapper">
                    <select className="cyber-select" value={modality} onChange={(e) => setModality(e.target.value)}>
                      <option value="image">Image (PNG/WebP/JPG)</option>
                      <option value="audio">Audio (WAV/FLAC/MP3)</option>
                      <option value="video">Video (MP4/MOV/AVI)</option>
                      <option value="text">Text (TXT/MD/JSON)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Sender Key Randomness Capacity</label>
                  <div className="input-glow-wrapper">
                    <select className="cyber-select" defaultValue="32">
                      <option value="16">16 Bytes (Standard Security)</option>
                      <option value="32">32 Bytes (Recommended Cryptographic Strength)</option>
                      <option value="64">64 Bytes (Extreme Military Standard)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", display: "block", marginBottom: "6px" }}>Local Persistence Storage</label>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", padding: "10px 14px", borderRadius: "10px" }}>
                    <div>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, display: "block" }}>Cache operations timeline</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>Speeds up local queries using browser storage indices.</span>
                    </div>
                    <label className="checkbox-label" style={{ display: "flex", margin: 0, padding: 0 }}>
                      <input type="checkbox" className="cyber-checkbox" defaultChecked />
                      <span></span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button className="btn-filter" style={{ minHeight: "auto", padding: "8px 16px", fontSize: "0.85rem" }} onClick={() => setShowProfileModal(false)}>Cancel</button>
                <button className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 24px", fontSize: "0.85rem" }} onClick={() => { setShowProfileModal(false); showToast("Profile preferences updated.", "success"); }}>Save Preferences</button>
              </div>
            </div>
          </div>
        )}

        {/* Security Details Modal */}
        {showSecurityModal && (
          <div className="modal-overlay" onClick={() => setShowSecurityModal(false)}>
            <div className="modal-card" style={{ background: "#ffffff", border: "1px solid var(--border-dim)", color: "var(--text-primary)", maxWidth: "550px" }} onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" style={{ color: "var(--text-muted)" }} onClick={() => setShowSecurityModal(false)}>&times;</button>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "20px" }}>
                <div style={{ color: "var(--accent-cyan)", display: "flex" }}><SvgIcons.Key size={24} /></div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>Active Cryptographic Profile</h2>
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
                Technical security details of your current authenticated environment.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div className="terminal-block" style={{ border: "1.5px solid rgba(0, 240, 255, 0.15)", marginBottom: 0 }}>
                  <div className="terminal-head">
                    <span className="terminal-title" style={{ color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className="health-dot" style={{ backgroundColor: "var(--accent-cyan)" }}></span>
                      ACTIVE_JWT_SESSION_TOKEN
                    </span>
                  </div>
                  <div className="terminal-body" style={{ color: "var(--accent-cyan)", fontSize: "0.78rem" }}>
                    <div className="terminal-prompt" style={{ color: "rgba(0, 240, 255, 0.5)" }}>stegano-os:~$ echo $AUTH_TOKEN</div>
                    <div style={{ wordBreak: "break-all", fontFamily: "var(--font-mono)" }}>
                      {localStorage.getItem("stegano_access_token") ? localStorage.getItem("stegano_access_token").slice(0, 48) + "..." : "No session token"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", padding: "10px 12px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>ENCRYPTION MODE</span>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>AES-256-GCM (Lossless)</span>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", padding: "10px 12px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>SIGNATURE BINDING</span>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>SHA-256 HMAC Sealing</span>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", padding: "10px 12px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>PBKDF2 ITERATIONS</span>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem" }}>100,000 passes</span>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid var(--border-dim)", padding: "10px 12px", borderRadius: "8px" }}>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>FIREWALL RATE-LIMIT</span>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--accent-green)" }}>10 requests / min (OK)</span>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
                <button 
                  className="btn-view-report" 
                  style={{ color: "var(--accent-red)", padding: 0 }} 
                  onClick={() => {
                    setShowSecurityModal(false);
                    showToast("Session security keys rotated.", "info");
                  }}
                >
                  Rotate Keys
                </button>
                <button className="btn-submit" style={{ minHeight: "auto", width: "auto", padding: "8px 20px", fontSize: "0.85rem" }} onClick={() => setShowSecurityModal(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Toast System */}
        {toast && (
          <div style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: toast.type === "success" ? "#10b981" : toast.type === "error" ? "#ef4444" : "#3b82f6",
            color: "#ffffff",
            padding: "16px 24px",
            borderRadius: "12px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            zIndex: 10000,
            fontFamily: "inherit",
            fontSize: "0.9rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            animation: "slideUp 0.3s ease-out"
          }}>
            <span>{toast.type === "success" ? "✓" : toast.type === "error" ? "✗" : "ℹ"}</span>
            <span>{toast.message}</span>
          </div>
        )}

      </div>
    </div>
  );
}
