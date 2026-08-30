// Dashboard.tsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import "./Dashboard.css";
import Popup from "./components/Popup";
import SessionManager from "./utils/sessionManager";
import Chatbot from "./components/Chatbot";
import ChatModal from "./components/ChatModal";
import DashboardPageHeader from "./components/DashboardPageHeader";

// Bootstrap
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";

// Assets
import profilePic from "./assets/profile.jpg"; // Profile avatar

interface HistoryItem {
  id: string;
  time: string;
  url: string;
  vulnerabilities: string[];
  status: "in_progress" | "completed" | "failed";
  totalFindings: number;
}

interface Notification {
  _id: string;
  type: 'scan' | 'security' | 'account' | 'system' | 'admin';
  title: string;
  message: string;
  icon: string;
  read: boolean;
  createdAt: string;
  link?: string;
  image?: string;
}

interface DashboardProps {
  children?: React.ReactNode; // âœ… allow child components like ScanProcess
}


const Dashboard: React.FC<DashboardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

  // Initialize sidebar based on screen width (closed on mobile by default)
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false); // Dropdown state

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [url, setUrl] = useState("");
  const [currentTab, setCurrentTab] = useState<
    "dashboard" | "history" | "help" | "settings" | "reports" | "plans" | "notifications" | "chatHistory"
  >("dashboard");

  // Handle Tab changes from URL (AI Navigation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab') as any;
    if (tab && ["dashboard", "history", "help", "settings", "reports", "plans", "notifications", "chatHistory"].includes(tab)) {
      setCurrentTab(tab);
    } else {
      // Fallback to location state if no query param
      const stateTab = (location.state as any)?.tab;
      if (stateTab) setCurrentTab(stateTab);
    }
  }, [location.search, location.state]);

  // Chat States
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatHistoryList, setChatHistoryList] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };


  // Toast notification state
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Popup State
  const [popup, setPopup] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // Basic client-side auth guard: redirect to signin if no token
  useEffect(() => {
    const token = localStorage.getItem("hs_auth_token");
    if (!token) {
      navigate("/signin");
    }
  }, [navigate]);

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // Fetch 2FA status when settings tab is opened
  useEffect(() => {
    const fetch2FAStatus = async () => {
      if (currentTab === "settings") {
        const token = localStorage.getItem("hs_auth_token");
        if (!token) return;

        try {
          const response = await fetch(`${API_BASE}/api/settings/2fa-status`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          const data = await response.json();
          if (response.ok) {
            setTwoFactorEnabled(data.twoFactorEnabled);
          }
        } catch (error) {
          console.error("Failed to fetch 2FA status:", error);
        }
      }
    };
    fetch2FAStatus();
  }, [currentTab]);

  // Fetch notifications
  const fetchNotifications = async () => {
    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        const newNotifications = data.notifications;
        const oldNotifications = notifications;

        // Check for new notifications
        if (oldNotifications.length > 0 && newNotifications.length > oldNotifications.length) {
          const latestNotification = newNotifications[0];
          // Show toast only if it's a new unread notification
          if (!latestNotification.read) {
            setToastNotification(latestNotification);
            setShowToast(true);
            // Auto-hide toast after 5 seconds
            setTimeout(() => setShowToast(false), 5000);
          }
        }

        setNotifications(newNotifications);
        setUnreadCount(data.unreadCount);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Mark notification as read
  const markAsRead = async (id: string) => {
    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      await fetch(`${API_BASE}/api/notifications/${id}/read`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      await fetch(`${API_BASE}/api/notifications/read-all`, {
        method: "PUT",
        headers: { "Authorization": `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (id: string) => {
    if (!window.confirm("Do you want to delete this notification?")) return;

    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications/${id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n._id !== id));
        setUnreadCount(prev => {
          // Only decrement if the deleted one was unread (checked by filtering previous state)
          const deleted = notifications.find(n => n._id === id);
          return deleted && !deleted.read ? Math.max(0, prev - 1) : prev;
        });
        setPopup({ isOpen: true, title: "Success", message: "Notification deleted", type: "success" });
      }
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  // Clear all notifications
  const clearAllNotifications = async () => {
    if (!window.confirm("Are you sure you want to delete ALL notifications? This cannot be undone.")) return;

    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        setNotifications([]);
        setUnreadCount(0);
        setPopup({ isOpen: true, title: "Success", message: "All notifications cleared", type: "success" });
      }
    } catch (error) {
      console.error("Failed to clear notifications:", error);
      setPopup({ isOpen: true, title: "Error", message: "Failed to clear notifications", type: "error" });
    }
  };

  // Format time ago
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const [history, setHistory] = useState<HistoryItem[]>([
  ]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [viewHistoryItem, setViewHistoryItem] = useState<HistoryItem | null>(null);

  const fetchScanHistory = async () => {
    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    setHistoryLoading(true);
    setHistoryError("");

    try {
      const response = await fetch(`${API_BASE}/api/scan/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch scan history");
      }

      const mappedHistory: HistoryItem[] = (data || []).map((scan: any) => ({
        id: scan._id,
        time: new Date(scan.scanDate || scan.createdAt).toLocaleString(),
        url: scan.url,
        vulnerabilities: (scan.activeScan?.findings || []).map((finding: any) => finding.category),
        status: scan.status || "completed",
        totalFindings: scan.activeScan?.findings?.length || 0,
      }));

      setHistory(mappedHistory);
    } catch (error: any) {
      console.error("Failed to fetch scan history:", error);
      setHistoryError(error.message || "Failed to fetch scan history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === "dashboard" || currentTab === "history") {
      fetchScanHistory();
    }
  }, [currentTab]);

  const handleDeleteHistoryItem = async (scanId: string) => {
    if (!window.confirm("Do you want to delete this scan history entry?")) return;

    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/scan/${scanId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete scan history");
      }

      setHistory((prev) => prev.filter((item) => item.id !== scanId));
      setPopup({ isOpen: true, title: "Success", message: "Scan history deleted", type: "success" });
      if (viewHistoryItem?.id === scanId) {
        setViewHistoryItem(null);
      }
    } catch (error: any) {
      console.error("Failed to delete scan history:", error);
      setPopup({ isOpen: true, title: "Error", message: error.message || "Failed to delete scan history", type: "error" });
    }
  };

  // Purchase Plan State
  const [showPurchase, setShowPurchase] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [paymentData, setPaymentData] = useState({
    cardHolderName: "",
    cardNumber: "",
    expiryDate: "",
    cvv: ""
  });
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal' | 'bank'>('card');
  const [paymentDataExtended, setPaymentDataExtended] = useState({
    cardHolderName: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    paypalEmail: '',
    accountHolderName: '',
    accountNumber: '',
    bankName: ''
  });

  const [reports, setReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);

  // Download format modal state
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [pendingDownloadReport, setPendingDownloadReport] = useState<any | null>(null);
  const [downloadFormat, setDownloadFormat] = useState("pdf");
  const [downloadingReport, setDownloadingReport] = useState(false);

  // Pagination & Filtering States
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState("all");
  const [historyPage, setHistoryPage] = useState(1);

  const [reportsSearch, setReportsSearch] = useState("");
  const [reportsFormatFilter, setReportsFormatFilter] = useState("all");
  const [reportsPage, setReportsPage] = useState(1);

  const pageSize = 10;

  // Fetch reports when reports tab is active or after a new one is generated
  useEffect(() => {
    if (currentTab !== "reports") return;
    const fetchReports = async () => {
      setReportsLoading(true);
      const token = localStorage.getItem("hs_auth_token");
      if (!token) { setReportsLoading(false); return; }
      try {
        const resp = await fetch(`${API_BASE}/api/report/list`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setReports(data);
        }
      } catch (err) {
        console.error("Failed to fetch reports:", err);
      } finally {
        setReportsLoading(false);
      }
    };
    fetchReports();
  }, [currentTab, reportsRefreshKey]);

  const handleReportDownload = async (reportId: string, fileName: string) => {
    const token = localStorage.getItem("hs_auth_token");
    const resp = await fetch(`${API_BASE}/api/report/download/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.message || `Download failed (${resp.status})`);
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleModalDownload = async () => {
    if (!pendingDownloadReport) return;
    setDownloadingReport(true);
    const token = localStorage.getItem("hs_auth_token");
    try {
      if (downloadFormat === pendingDownloadReport.format) {
        await handleReportDownload(pendingDownloadReport._id, pendingDownloadReport.fileName);
      } else {
        const genResp = await fetch(`${API_BASE}/api/report/generate`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ scanId: pendingDownloadReport.scanId, format: downloadFormat }),
        });
        if (!genResp.ok) {
          const errData = await genResp.json().catch(() => ({}));
          throw new Error(errData.message || "Report generation failed");
        }
        const genData = await genResp.json();
        await handleReportDownload(genData.reportId, genData.fileName);
        setReportsRefreshKey(k => k + 1);
      }
      setShowDownloadModal(false);
    } catch (err: any) {
      console.error("Modal download failed:", err);
      setPopup({ isOpen: true, title: "Download Failed", message: err.message || "Could not download the report. Please try again.", type: "error" });
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleReportView = async (reportId: string) => {
    // Open a new tab immediately to bypass popup blockers
    const newWindow = window.open('', '_blank');
    if (!newWindow) {
      setPopup({ isOpen: true, title: "Popup Blocked", message: "Please enable popups to view the report.", type: "error" });
      return;
    }
    newWindow.document.write('<html><head><title>Loading Report...</title><style>body{display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;color:#64748b;background:#f8fafc;}</style></head><body><div style="text-align:center;"><h2>Loading Report...</h2><p>Preparing your security document</p></div></body></html>');

    const token = localStorage.getItem("hs_auth_token");
    try {
      const resp = await fetch(`${API_BASE}/api/report/view/${reportId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!resp.ok) {
        throw new Error(`Failed to load report (${resp.status})`);
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      
      // Update the already opened window
      newWindow.location.href = url;
      
      // Clean up the URL after some time
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err: any) {
      console.error("View failed:", err);
      newWindow.close();
      setPopup({ isOpen: true, title: "View Failed", message: err.message || "Could not open the report.", type: "error" });
    }
  };

  const handleReportDelete = async (reportId: string) => {
    const token = localStorage.getItem("hs_auth_token");
    try {
      const resp = await fetch(`${API_BASE}/api/report/${reportId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setReports((prev) => prev.filter((r: any) => r._id !== reportId));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleLogout = async () => {
    const token = localStorage.getItem("hs_auth_token");

    // Call backend logout to blacklist token
    if (token) {
      try {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          headers: { "Authorization": `Bearer ${token}` }
        });
      } catch (error) {
        console.error("Logout API failed:", error);
      }
    }

    setPopup({
      isOpen: true,
      title: "Logging Out",
      message: "You have been successfully logged out from all devices.",
      type: "success"
    });

    setTimeout(() => {
      // Clear all session tokens for clean state
      localStorage.removeItem("hs_auth_token");
      localStorage.removeItem("hs_admin_token");
      localStorage.removeItem("hs_admin_info");
      navigate("/signin");
    }, 2000);
  };

  // ---------------- CHAT FUNCTIONS ----------------
  const fetchChatHistory = async () => {
    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/chat/history`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setChatHistoryList(data.chats);
      }
    } catch (error) {
      console.error("Failed to fetch chat history:", error);
    }
  };

  const openChat = (chatId?: string) => {
    setSelectedChatId(chatId || null);
    setShowChatModal(true);
  };

  const deleteChat = async (chatId: string) => {
    if (!confirm("Are you sure you want to delete this chat?")) return;

    const token = localStorage.getItem("hs_auth_token");
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/chat/history/${chatId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        setPopup({
          isOpen: true,
          title: "Success",
          message: "Chat deleted successfully",
          type: "success"
        });
        fetchChatHistory(); // Refresh list
      }
    } catch (error) {
      console.error("Delete chat error:", error);
      setPopup({
        isOpen: true,
        title: "Error",
        message: "Failed to delete chat",
        type: "error"
      });
    }
  };

  // Fetch chat history when tab is opened
  useEffect(() => {
    if (currentTab === "chatHistory") {
      fetchChatHistory();
    }
  }, [currentTab]);


  // ---------------- START SCAN ----------------
  const handleStartScan = () => {
    if (!url) {
      setPopup({ isOpen: true, title: "Error", message: "Please enter a target URL", type: "error" });
      return;
    }
    if (!authorized) {
      setPopup({ isOpen: true, title: "Error", message: "Please confirm you have authorization to scan this target", type: "error" });
      return;
    }
    navigate("/scan", { state: { targetUrl: url } });
    setUrl("");
    setAuthorized(false);
  };

  // ---------------- FILTERING & PAGINATION LOGIC ----------------
  const filteredHistory = history.filter(item => {
    const matchesSearch = item.url.toLowerCase().includes(historySearch.toLowerCase());
    const matchesStatus = historyStatusFilter === "all" || item.status === historyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalHistoryPages = Math.ceil(filteredHistory.length / pageSize);
  const paginatedHistory = filteredHistory.slice((historyPage - 1) * pageSize, historyPage * pageSize);

  const filteredReports = reports.filter(rep => {
    const matchesSearch = rep.fileName?.toLowerCase().includes(reportsSearch.toLowerCase()) || 
                         rep.targetUrl?.toLowerCase().includes(reportsSearch.toLowerCase());
    const matchesFormat = reportsFormatFilter === "all" || rep.format === reportsFormatFilter;
    return matchesSearch && matchesFormat;
  });

  const totalReportsPages = Math.ceil(filteredReports.length / pageSize);
  const paginatedReports = filteredReports.slice((reportsPage - 1) * pageSize, reportsPage * pageSize);

  return (
    <div className="dashboard-layout">
      <Popup
        isOpen={popup.isOpen}
        onClose={() => setPopup({ ...popup, isOpen: false })}
        title={popup.title}
        message={popup.message}
        type={popup.type}
      />

      {/* Toast Notification */}
      {showToast && toastNotification && (
        <div style={{
          position: 'fixed',
          top: '100px',
          right: showToast ? '20px' : '-400px',
          width: '350px',
          background: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          padding: '1rem',
          zIndex: 9999,
          transition: 'right 0.3s ease-in-out',
          border: '2px solid #4f46e5'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e1b4b' }}>
              <i className="bi bi-bell-fill" style={{ marginRight: '0.5rem', color: '#4f46e5' }}></i>
              New Notification
            </h4>
            <button
              onClick={() => setShowToast(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#64748b',
                padding: 0
              }}
            >
              Ã—
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(79, 70, 229, 0.1)',
              flexShrink: 0
            }}>
              <i className={`bi ${toastNotification.icon}`} style={{ fontSize: '1.1rem', color: '#4f46e5' }}></i>
            </div>
            <div style={{ flex: 1 }}>
              <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e1b4b', marginBottom: '0.25rem' }}>
                {toastNotification.title}
              </h5>
              {toastNotification.image && (
                <img
                  src={`${API_BASE}${toastNotification.image}`}
                  alt="Notification"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100px',
                    borderRadius: '8px',
                    marginBottom: '0.5rem',
                    objectFit: 'cover'
                  }}
                />
              )}
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b', lineHeight: 1.4 }}>
                {toastNotification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SIDEBAR ---------------- */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-title">
          <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '50px', height: '50px', objectFit: 'contain', marginRight: '0.75rem' }} />
          <h2>{sidebarOpen ? "HackSentinel" : "HS"}</h2>
        </div>
        <ul className="sidebar-menu">
          <li onClick={() => setCurrentTab("dashboard")} className={currentTab === "dashboard" ? "active" : ""}>
            <i className="bi bi-speedometer2 me-2"></i> {sidebarOpen && "Dashboard"}
          </li>
          <li onClick={() => setCurrentTab("history")} className={currentTab === "history" ? "active" : ""}>
            <i className="bi bi-clock-history me-2"></i> {sidebarOpen && "Scan History"}
          </li>
          <li onClick={() => setCurrentTab("help")} className={currentTab === "help" ? "active" : ""}>
            <i className="bi bi-question-circle me-2"></i> {sidebarOpen && "Help"}
          </li>
          <li onClick={() => setCurrentTab("settings")} className={currentTab === "settings" ? "active" : ""}>
            <i className="bi bi-gear-fill me-2"></i> {sidebarOpen && "Settings"}
          </li>

          <li
            onClick={() => setCurrentTab("plans")}
            className={currentTab === "plans" ? "active" : ""}
          >
            <i className="bi bi-trophy-fill me-2"></i>
            {sidebarOpen && "Subscription"}
          </li>

          <li
            onClick={() => setCurrentTab("reports")}
            className={currentTab === "reports" ? "active" : ""}
          >
            <i className="bi bi-file-earmark-text me-2"></i>
            {sidebarOpen && "Reports"}
          </li>

          <li
            onClick={() => setCurrentTab("chatHistory")}
            className={currentTab === "chatHistory" ? "active" : ""}
          >
            <i className="bi bi-chat-left-dots-fill me-2"></i>
            {sidebarOpen && "Chat History"}
          </li>

          <li
            onClick={() => setCurrentTab("notifications")}
            className={currentTab === "notifications" ? "active" : ""}
            style={{ position: 'relative' }}
          >
            <i className="bi bi-bell-fill me-2"></i>
            {sidebarOpen && "Notifications"}
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '50%',
                right: sidebarOpen ? '1rem' : '50%',
                transform: sidebarOpen ? 'translateY(-50%)' : 'translate(50%, -50%)',
                background: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                fontSize: '0.7rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </li>

          {sidebarOpen && (
            <>
              <li
                className="logout"
                onClick={handleLogout}
              >
                <i className="bi bi-box-arrow-right me-2"></i> Logout
              </li>
            </>
          )}
        </ul>
      </aside>

      {/* ---------------- TOPBAR ---------------- */}
      <header className="topbar">
        <button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <i className="bi bi-list"></i>
        </button>
        <div className="topbar-left">
          <p className="subtitle">Ethical AI Vulnerability Scanner</p>
          {/* Navbar removed as per request */}
        </div>
        <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setNotificationOpen(!notificationOpen);
                setProfileMenuOpen(false); // Close profile menu if open
              }}
              style={{
                background: notificationOpen ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                border: 'none',
                borderRadius: '50%',
                width: '45px',
                height: '45px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s'
              }}
            >
              <i className={`bi ${notificationOpen ? 'bi-bell-fill' : 'bi-bell'}`} style={{ fontSize: '1.3rem', color: notificationOpen ? '#4f46e5' : '#64748b' }}></i>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid white'
                }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {notificationOpen && (
              <div style={{
                position: 'absolute',
                top: '60px',
                right: '-10px',
                width: '380px',
                background: 'white',
                borderRadius: '16px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid #e2e8f0',
                zIndex: 1000,
                overflow: 'hidden',
                animation: 'slideDown 0.2s ease-out'
              }}>
                <div style={{
                  padding: '1rem 1.25rem',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fafc'
                }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e1b4b' }}>
                    Notifications
                  </h4>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      style={{
                        fontSize: '0.75rem',
                        color: '#4f46e5',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{
                  maxHeight: '400px',
                  overflowY: 'auto',
                  background: 'white'
                }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '3rem 1rem', textAlign: 'center', color: '#94a3b8' }}>
                      <i className="bi bi-bell-slash" style={{ fontSize: '2.5rem', marginBottom: '0.5rem', display: 'block', color: '#cbd5e1' }}></i>
                      <p style={{ margin: 0 }}>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => {
                          if (!notification.read) markAsRead(notification._id);
                          setCurrentTab('notifications');
                          setNotificationOpen(false);
                        }}
                        style={{
                          padding: '1rem 1.25rem',
                          borderBottom: '1px solid #f1f5f9',
                          cursor: 'pointer',
                          background: notification.read ? 'white' : 'rgba(79, 70, 229, 0.02)',
                          transition: 'background 0.2s',
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'start'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={(e) => e.currentTarget.style.background = notification.read ? 'white' : 'rgba(79, 70, 229, 0.02)'}
                      >
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: notification.type === 'security' ? 'rgba(16, 185, 129, 0.1)' :
                            notification.type === 'scan' ? 'rgba(59, 130, 246, 0.1)' :
                              'rgba(79, 70, 229, 0.1)',
                          flexShrink: 0
                        }}>
                          <i className={`bi ${notification.icon}`} style={{
                            fontSize: '1rem',
                            color: notification.type === 'security' ? '#10b981' :
                              notification.type === 'scan' ? '#3b82f6' :
                                '#4f46e5'
                          }}></i>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{
                            margin: '0 0 0.25rem 0',
                            fontSize: '0.9rem',
                            fontWeight: notification.read ? 500 : 600,
                            color: '#1e1b4b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {notification.title}
                          </p>
                          <p style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            color: '#64748b',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}>
                            {notification.message}
                          </p>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem', display: 'block' }}>
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        {!notification.read && (
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#ef4444',
                            flexShrink: 0,
                            marginTop: '0.5rem'
                          }}></span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div style={{
                  padding: '0.75rem',
                  borderTop: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  textAlign: 'center'
                }}>
                  <button
                    onClick={() => {
                      setCurrentTab('notifications');
                      setNotificationOpen(false);
                    }}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: '#4f46e5',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    View All Notifications
                    <i className="bi bi-arrow-right" style={{ marginLeft: '0.5rem' }}></i>
                  </button>
                </div>
              </div>
            )}
          </div >

          <img
            src={profilePic}
            alt="Profile"
            className="profile-avatar-img"
            onClick={() => {
              setProfileMenuOpen(!profileMenuOpen);
            }}
          />
          {
            profileMenuOpen && (
              <div className="profile-dropdown">
                <button
                  className="logout-btn"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-2"></i> Logout
                </button>
              </div>
            )
          }
        </div >
      </header >

      {/* ---------------- MAIN CONTENT ---------------- */}
      < main className={`main-content ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        {/* If a child component is passed (like ScanProcess), render it */}
        {
          children ? (
            children
          ) : (
            // Otherwise render dashboard tabs
            <>
              {currentTab === "dashboard" && (
                <>
                  <DashboardPageHeader
                    badge="Overview"
                    title="Your security"
                    accent="dashboard"
                    subtitle="Recent scans, active findings, and quick access to a fresh scan."
                  />
                  {/* Stats Cards */}
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div className="stat-icon purple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                      </div>
                      <div className="stat-info">
                        <h3>{history.length}</h3>
                        <p>Total Scans</p>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon red">
                        <i className="bi bi-bug-fill"></i>
                      </div>
                      <div className="stat-info">
                        <h3>{history.reduce((acc, item) => acc + item.vulnerabilities.length, 0)}</h3>
                        <p>Vulnerabilities Found</p>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon blue">
                        <i className="bi bi-file-earmark-text-fill"></i>
                      </div>
                      <div className="stat-info">
                        <h3>{reports.length}</h3>
                        <p>Reports Generated</p>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-icon green">
                        <i className="bi bi-graph-up-arrow"></i>
                      </div>
                      <div className="stat-info">
                        <h3>98%</h3>
                        <p>Success Rate</p>
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Scan Input Card */}
                  <div className="card scan-card">
                    <h3 className="scan-title" style={{ display: 'flex', alignItems: 'center' }}>
                      <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '28px', height: '28px', objectFit: 'contain', marginRight: '0.75rem' }} />
                      Start New Vulnerability Scan
                    </h3>

                    {/* URL Input */}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#1e1b4b' }}>
                        Target URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="url-input"
                        style={{
                          width: '100%',
                          padding: '0.875rem 1rem',
                          fontSize: '1rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '8px',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      />
                    </div>

                    {/* Authorization Checkbox */}
                    <label className="consent" style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '1rem',
                      background: '#fef3c7',
                      border: '2px solid #fbbf24',
                      borderRadius: '8px',
                      marginBottom: '1.5rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={authorized}
                        onChange={(e) => setAuthorized(e.target.checked)}
                        style={{ width: '18px', height: '18px', marginRight: '0.75rem', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.95rem', color: '#92400e', fontWeight: 500 }}>
                        <i className="bi bi-exclamation-triangle-fill" style={{ marginRight: '0.5rem', color: '#f59e0b' }}></i>
                        I have authorization to test this website
                      </span>
                    </label>

                    {/* Start Scan Button */}
                    <button
                      className={`submit-btn ${authorized && url ? 'scan-btn-pulse' : ''}`}
                      disabled={!authorized || !url}
                      onClick={handleStartScan}
                      style={{
                        width: '100%',
                        padding: '1rem 2rem',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        background: (!authorized || !url)
                          ? '#e5e7eb'
                          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: (!authorized || !url) ? '#9ca3af' : 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (!authorized || !url) ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <i className="bi bi-play-circle-fill" style={{ marginRight: '0.75rem', fontSize: '1.2rem' }}></i>
                      Start Passive Scan
                    </button>
                  </div>
                </>
              )}

              {currentTab === "history" && (
                <>
                <DashboardPageHeader
                    badge="History"
                    title="All your"
                    accent="past scans"
                    subtitle="Search, filter, and revisit every scan you've run."
                />
                <div className="card history-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Scan History</h3>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div className="search-box">
                        <i className="bi bi-search"></i>
                        <input 
                          type="text" 
                          placeholder="Search by URL..." 
                          value={historySearch}
                          onChange={(e) => { setHistorySearch(e.target.value); setHistoryPage(1); }}
                        />
                      </div>
                      <select 
                        className="filter-select"
                        value={historyStatusFilter}
                        onChange={(e) => { setHistoryStatusFilter(e.target.value); setHistoryPage(1); }}
                      >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="in_progress">In Progress</option>
                        <option value="failed">Failed</option>
                      </select>
                    </div>
                  </div>

                  {historyLoading ? (
                    <p style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Loading scan history...</p>
                  ) : historyError ? (
                    <p style={{ textAlign: "center", padding: "2rem", color: "#ef4444" }}>{historyError}</p>
                  ) : (
                    <>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Time</th>
                            <th>URL</th>
                            <th>Status</th>
                            <th>Vulnerabilities</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedHistory.length > 0 ? (
                            paginatedHistory.map((item, index) => (
                              <tr key={item.id}>
                                <td>{(historyPage - 1) * pageSize + index + 1}</td>
                                <td>{item.time}</td>
                                <td>
                                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-link" style={{ maxWidth: '200px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.url}
                                  </a>
                                </td>
                                <td>
                                  <span style={{
                                    padding: "0.25rem 0.6rem",
                                    borderRadius: "20px",
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    background:
                                      item.status === "completed" ? "rgba(16, 185, 129, 0.1)" :
                                        item.status === "failed" ? "rgba(239, 68, 68, 0.1)" :
                                          "rgba(245, 158, 11, 0.1)",
                                    color: 
                                      item.status === "completed" ? "#10b981" :
                                        item.status === "failed" ? "#ef4444" :
                                          "#f59e0b",
                                    border: `1px solid ${
                                      item.status === "completed" ? "#10b981" :
                                        item.status === "failed" ? "#ef4444" :
                                          "#f59e0b"
                                    }`
                                  }}>
                                    {item.status.replace("_", " ")}
                                  </span>
                                </td>
                                <td>
                                  <div className="vulnerabilities" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                    {item.vulnerabilities.length > 0 ? (
                                      item.vulnerabilities.slice(0, 3).map((vul, i) => (
                                        <span key={`${item.id}-${i}`} className="vul-badge" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{vul}</span>
                                      ))
                                    ) : (
                                      <span style={{ color: "#94a3b8", fontSize: '0.8rem' }}>
                                        {item.status === "completed" ? "No findings" : "Pending"}
                                      </span>
                                    )}
                                    {item.vulnerabilities.length > 3 && (
                                      <span style={{ fontSize: '0.7rem', color: '#4f46e5', fontWeight: 600 }}>+{item.vulnerabilities.length - 3} more</span>
                                    )}
                                  </div>
                                </td>
                                <td className="history-actions">
                                  <button onClick={() => setViewHistoryItem(item)} title="View Detail" className="action-btn view">
                                    <i className="bi bi-eye"></i>
                                  </button>
                                  <button
                                    onClick={() => handleCopyId(item.id)}
                                    title="Copy Scan ID for AI Chatbot"
                                    className="action-btn"
                                    style={{ background: copiedId === item.id ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.1)', color: copiedId === item.id ? '#10b981' : '#0ea5e9', border: `1px solid ${copiedId === item.id ? '#10b981' : '#0ea5e9'}` }}
                                  >
                                    <i className={`bi ${copiedId === item.id ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
                                  </button>
                                  <button onClick={() => handleDeleteHistoryItem(item.id)} title="Delete" className="action-btn delete">
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: '#64748b' }}>
                                <i className="bi bi-inbox" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', opacity: 0.5 }}></i>
                                No matching scan history found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalHistoryPages > 1 && (
                      <div className="pagination">
                        <button 
                          disabled={historyPage === 1} 
                          onClick={() => setHistoryPage(p => p - 1)}
                          className="page-btn"
                        >
                          <i className="bi bi-chevron-left"></i>
                        </button>
                        {[...Array(totalHistoryPages)].map((_, i) => (
                          <button 
                            key={i} 
                            onClick={() => setHistoryPage(i + 1)}
                            className={`page-btn ${historyPage === i + 1 ? 'active' : ''}`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button 
                          disabled={historyPage === totalHistoryPages} 
                          onClick={() => setHistoryPage(p => p + 1)}
                          className="page-btn"
                        >
                          <i className="bi bi-chevron-right"></i>
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </div>
                </>
              )}
              {currentTab === "reports" && (
                <>
                <DashboardPageHeader
                    badge="Reports"
                    title="Exported"
                    accent="reports"
                    subtitle="Download PDF or DOCX audits, or share with clients."
                />
                <div className="card reports-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Generated Reports</h3>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div className="search-box">
                        <i className="bi bi-search"></i>
                        <input 
                          type="text" 
                          placeholder="Search reports..." 
                          value={reportsSearch}
                          onChange={(e) => { setReportsSearch(e.target.value); setReportsPage(1); }}
                        />
                      </div>
                      <select
                        className="filter-select"
                        value={reportsFormatFilter}
                        onChange={(e) => { setReportsFormatFilter(e.target.value); setReportsPage(1); }}
                      >
                        <option value="all">All Formats</option>
                        <option value="pdf">PDF</option>
                        <option value="docx">DOCX</option>
                        <option value="md">Markdown</option>
                        <option value="json">JSON</option>
                        <option value="hackerone">HackerOne</option>
                        <option value="bugcrowd">Bugcrowd</option>
                        <option value="intigriti">Intigriti</option>
                        <option value="yeswehack">YesWeHack</option>
                      </select>
                    </div>
                  </div>

                  {reportsLoading ? (
                    <p style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Loading reports...</p>
                  ) : (
                    <>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="history-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Report Name</th>
                            <th>Format</th>
                            <th>Target URL</th>
                            <th>Findings</th>
                            <th>Created</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedReports.length > 0 ? (
                            paginatedReports.map((rep: any, index: number) => (
                              <tr key={rep._id}>
                                <td>{(reportsPage - 1) * pageSize + index + 1}</td>
                                <td>
                                  <span title={rep.fileName} style={{ maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                                    {rep.fileName}
                                  </span>
                                </td>
                                <td>
                                  {(() => {
                                    const FMT_COLOR: Record<string, string> = {
                                      pdf: '#ef4444', docx: '#3b82f6', md: '#8b5cf6', json: '#10b981',
                                      hackerone: '#000000', bugcrowd: '#cc0000', intigriti: '#3b82f6', yeswehack: '#f59e0b',
                                    };
                                    const c = FMT_COLOR[rep.format] || '#64748b';
                                    return (
                                      <span style={{
                                        padding: '0.25rem 0.6rem', borderRadius: '20px',
                                        fontSize: '0.65rem', fontWeight: 700,
                                        background: `${c}18`, color: c,
                                        border: `1px solid ${c}`,
                                        textTransform: 'uppercase',
                                      }}>
                                        {rep.format}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td>
                                  <a
                                    href={rep.targetUrl?.startsWith('http') ? rep.targetUrl : `https://${rep.targetUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-link"
                                    style={{ maxWidth: '150px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                                  >
                                    {rep.targetUrl}
                                  </a>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, color: (rep.reportData?.totalFindings || 0) > 0 ? '#ef4444' : '#64748b' }}>
                                    {rep.reportData?.totalFindings || 0}
                                  </span>
                                </td>
                                <td style={{ fontSize: '0.85rem' }}>{new Date(rep.createdAt).toLocaleDateString()}</td>
                                <td className="history-actions">
                                  <button onClick={() => handleReportView(rep._id)} title="View" className="action-btn view">
                                    <i className="bi bi-eye"></i>
                                  </button>
                                  <button onClick={() => { setPendingDownloadReport(rep); setDownloadFormat(rep.format); setShowDownloadModal(true); }} title="Download" className="action-btn download">
                                    <i className="bi bi-download"></i>
                                  </button>
                                  <button
                                    onClick={() => handleCopyId(rep._id)}
                                    title="Copy Report ID for AI Chatbot"
                                    className="action-btn"
                                    style={{ background: copiedId === rep._id ? 'rgba(16,185,129,0.15)' : 'rgba(14,165,233,0.1)', color: copiedId === rep._id ? '#10b981' : '#0ea5e9', border: `1px solid ${copiedId === rep._id ? '#10b981' : '#0ea5e9'}` }}
                                  >
                                    <i className={`bi ${copiedId === rep._id ? 'bi-check-lg' : 'bi-clipboard'}`}></i>
                                  </button>
                                  <button onClick={() => handleReportDelete(rep._id)} title="Delete" className="action-btn delete">
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: '#64748b' }}>
                                <i className="bi bi-file-earmark-x" style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem', opacity: 0.5 }}></i>
                                No matching reports found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalReportsPages > 1 && (
                      <div className="pagination">
                        <button 
                          disabled={reportsPage === 1} 
                          onClick={() => setReportsPage(p => p - 1)}
                          className="page-btn"
                        >
                          <i className="bi bi-chevron-left"></i>
                        </button>
                        {[...Array(totalReportsPages)].map((_, i) => (
                          <button 
                            key={i} 
                            onClick={() => setReportsPage(i + 1)}
                            className={`page-btn ${reportsPage === i + 1 ? 'active' : ''}`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button 
                          disabled={reportsPage === totalReportsPages} 
                          onClick={() => setReportsPage(p => p + 1)}
                          className="page-btn"
                        >
                          <i className="bi bi-chevron-right"></i>
                        </button>
                      </div>
                    )}
                    </>
                  )}
                </div>
                </>
              )}

              {currentTab === "plans" && (
                <>
                <DashboardPageHeader
                    badge="Pricing"
                    title="Choose your"
                    accent="plan"
                    subtitle="Upgrade for AI-verified active scans, team seats, and priority support."
                />
                <div className="card plans-card">
                  <h3>Subscription Plans</h3>
                  <p style={{ color: '#64748b', marginBottom: '2rem' }}>Choose the perfect plan for your needs</p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                    {/* Free Plan */}
                    <div className="plan-card" style={{ border: '2px solid #e5e7eb', borderRadius: '16px', padding: '2rem', background: 'white' }}>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ color: '#1e1b4b', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Free Plan</h4>
                        <div style={{ fontSize: '3rem', fontWeight: 700, color: '#4f46e5' }}>$0</div>
                        <p style={{ color: '#94a3b8' }}>forever</p>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Basic vulnerability scanning</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ 5 scans per month</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Basic reports</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Community support</li>
                      </ul>
                      <button
                        className="plan-btn"
                        style={{ width: '100%', padding: '0.75rem', background: '#e5e7eb', color: '#64748b', border: 'none', borderRadius: '8px', cursor: 'not-allowed' }}
                        disabled
                      >
                        Current Plan
                      </button>
                    </div>

                    {/* Professional Plan */}
                    <div className="plan-card" style={{ border: '3px solid #4f46e5', borderRadius: '16px', padding: '2rem', background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(79, 70, 229, 0.1) 100%)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: '-12px', right: '20px', background: '#4f46e5', color: 'white', padding: '0.25rem 1rem', borderRadius: '20px', fontSize: '0.875rem', fontWeight: 600 }}>
                        POPULAR
                      </div>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ color: '#1e1b4b', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Professional</h4>
                        <div style={{ fontSize: '3rem', fontWeight: 700, color: '#4f46e5' }}>$49</div>
                        <p style={{ color: '#94a3b8' }}>per month</p>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Advanced vulnerability scanning</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Unlimited scans</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Detailed PDF reports</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Priority support</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ AI-powered insights</li>
                      </ul>
                      <button
                        className="plan-btn"
                        style={{ width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => {
                          setSelectedPlan({ id: 'professional', name: 'Professional Plan', price: 49, currency: 'USD', interval: 'month', features: ['Advanced vulnerability scanning', 'Unlimited scans', 'Detailed PDF reports', 'Priority support', 'AI-powered insights'] });
                          setShowPurchase(true);
                        }}
                      >
                        Purchase Plan
                      </button>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="plan-card" style={{ border: '2px solid #e5e7eb', borderRadius: '16px', padding: '2rem', background: 'white' }}>
                      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                        <h4 style={{ color: '#1e1b4b', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Enterprise</h4>
                        <div style={{ fontSize: '3rem', fontWeight: 700, color: '#4f46e5' }}>$199</div>
                        <p style={{ color: '#94a3b8' }}>per month</p>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, marginBottom: '1.5rem' }}>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Everything in Professional</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Dedicated account manager</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Custom integrations</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ SLA guarantees</li>
                        <li style={{ padding: '0.5rem 0', color: '#64748b' }}>âœ“ Team collaboration</li>
                      </ul>
                      <button
                        className="plan-btn"
                        style={{ width: '100%', padding: '0.75rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                        onClick={() => {
                          setSelectedPlan({ id: 'enterprise', name: 'Enterprise Plan', price: 199, currency: 'USD', interval: 'month', features: ['Everything in Professional', 'Dedicated account manager', 'Custom integrations', 'SLA guarantees', 'Team collaboration'] });
                          setShowPurchase(true);
                        }}
                      >
                        Purchase Plan
                      </button>
                    </div>
                  </div>

                  {/* Inline Purchase Modal */}
                  {showPurchase && selectedPlan && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', maxWidth: '500px', width: '90%', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
                        <button onClick={() => { setShowPurchase(false); setSelectedPlan(null); }} style={{ position: 'absolute', top: '1rem', left: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', fontWeight: 600 }}>
                          <i className="bi bi-arrow-left"></i> Back
                        </button>
                        <h2 style={{ textAlign: 'center', color: '#1e1b4b', marginTop: '2.5rem', marginBottom: '1rem' }}>Purchase {selectedPlan.name}</h2>
                        <div style={{ background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', textAlign: 'center' }}>
                          <p style={{ fontSize: '2rem', fontWeight: 700, color: '#4f46e5', margin: 0 }}>${selectedPlan.price}/{selectedPlan.interval}</p>
                        </div>

                        {/* Payment Method Selection */}
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                            Select Payment Method
                          </label>
                          <select
                            value={paymentMethod}
                            onChange={(e) => setPaymentMethod(e.target.value as any)}
                            style={{
                              width: '100%',
                              padding: '0.9rem 1rem',
                              border: '2px solid #e5e7eb',
                              borderRadius: '10px',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              background: 'white'
                            }}
                          >
                            <option value="card">ðŸ’³ Credit/Debit Card</option>
                            <option value="paypal">ðŸ…¿ï¸ PayPal</option>
                            <option value="bank">ðŸ¦ Bank Account</option>
                          </select>
                        </div>

                        <form onSubmit={async (e) => {
                          e.preventDefault();
                          const token = SessionManager.getInstance().getToken();

                          // Build payment method data based on selected method
                          let paymentMethodData: any = { type: paymentMethod };

                          if (paymentMethod === 'card') {
                            if (!paymentDataExtended.cardHolderName || !paymentDataExtended.cardNumber || !paymentDataExtended.expiryDate || !paymentDataExtended.cvv) {
                              setPopup({ isOpen: true, title: "Error", message: "All card fields are required", type: "error" });
                              return;
                            }
                            paymentMethodData = {
                              ...paymentMethodData,
                              cardHolderName: paymentDataExtended.cardHolderName,
                              cardNumber: paymentDataExtended.cardNumber,
                              expiryDate: paymentDataExtended.expiryDate,
                              cvv: paymentDataExtended.cvv
                            };
                          } else if (paymentMethod === 'paypal') {
                            if (!paymentDataExtended.paypalEmail) {
                              setPopup({ isOpen: true, title: "Error", message: "PayPal email is required", type: "error" });
                              return;
                            }
                            paymentMethodData = { ...paymentMethodData, paypalEmail: paymentDataExtended.paypalEmail };
                          } else if (paymentMethod === 'bank') {
                            if (!paymentDataExtended.accountHolderName || !paymentDataExtended.accountNumber || !paymentDataExtended.bankName) {
                              setPopup({ isOpen: true, title: "Error", message: "All bank fields are required", type: "error" });
                              return;
                            }
                            paymentMethodData = {
                              ...paymentMethodData,
                              accountHolderName: paymentDataExtended.accountHolderName,
                              accountNumber: paymentDataExtended.accountNumber,
                              bankName: paymentDataExtended.bankName
                            };
                          }

                          try {
                            const response = await fetch(`${API_BASE}/api/subscription/purchase`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                              body: JSON.stringify({ planId: selectedPlan.id, paymentMethod: paymentMethodData }),
                            });
                            const data = await response.json();
                            if (response.ok) {
                              setPopup({ isOpen: true, title: "Success! ðŸŽ‰", message: `Subscribed to ${selectedPlan.name}`, type: "success" });
                              setShowPurchase(false);
                              setSelectedPlan(null);
                              setPaymentDataExtended({ cardHolderName: '', cardNumber: '', expiryDate: '', cvv: '', paypalEmail: '', accountHolderName: '', accountNumber: '', bankName: '' });
                            } else {
                              setPopup({ isOpen: true, title: "Error", message: data.message || "Purchase failed", type: "error" });
                            }
                          } catch (error) {
                            setPopup({ isOpen: true, title: "Error", message: "Connection failed", type: "error" });
                          }
                        }}>
                          {/* Dynamic Form Fields */}
                          {paymentMethod === 'card' && (
                            <>
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                  Card Holder Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter card holder name"
                                  value={paymentDataExtended.cardHolderName}
                                  onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, cardHolderName: e.target.value })}
                                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                  required
                                />
                              </div>
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                  Card Number
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter 16-digit card number"
                                  value={paymentDataExtended.cardNumber}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                                    setPaymentDataExtended({ ...paymentDataExtended, cardNumber: value });
                                  }}
                                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                  maxLength={16}
                                  required
                                />
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                    Expiry Date
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="MM/YY"
                                    value={paymentDataExtended.expiryDate}
                                    onChange={(e) => {
                                      let value = e.target.value.replace(/\D/g, '');
                                      if (value.length >= 2) {
                                        value = value.slice(0, 2) + '/' + value.slice(2, 4);
                                      }
                                      setPaymentDataExtended({ ...paymentDataExtended, expiryDate: value });
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                    maxLength={5}
                                    required
                                  />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                    CVV
                                  </label>
                                  <input
                                    type="password"
                                    placeholder="CVV"
                                    value={paymentDataExtended.cvv}
                                    onChange={(e) => {
                                      const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                      setPaymentDataExtended({ ...paymentDataExtended, cvv: value });
                                    }}
                                    style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                    maxLength={4}
                                    required
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {paymentMethod === 'paypal' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                PayPal Email
                              </label>
                              <input
                                type="email"
                                placeholder="Enter your PayPal email address"
                                value={paymentDataExtended.paypalEmail}
                                onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, paypalEmail: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                required
                              />
                            </div>
                          )}

                          {paymentMethod === 'bank' && (
                            <>
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                  Account Holder Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter account holder name"
                                  value={paymentDataExtended.accountHolderName}
                                  onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, accountHolderName: e.target.value })}
                                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                  required
                                />
                              </div>
                              <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                  Account Number
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter account number"
                                  value={paymentDataExtended.accountNumber}
                                  onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '');
                                    setPaymentDataExtended({ ...paymentDataExtended, accountNumber: value });
                                  }}
                                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                  required
                                />
                              </div>
                              <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                                  Bank Name
                                </label>
                                <input
                                  type="text"
                                  placeholder="Enter bank name"
                                  value={paymentDataExtended.bankName}
                                  onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, bankName: e.target.value })}
                                  style={{ width: '100%', padding: '0.75rem', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '1rem' }}
                                  required
                                />
                              </div>
                            </>
                          )}

                          <button type="submit" style={{ width: '100%', padding: '1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer' }}>Pay ${selectedPlan.price}</button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
                </>
              )}

              {currentTab === "settings" && (
                <>
                <DashboardPageHeader
                    badge="Preferences"
                    title="Account"
                    accent="settings"
                    subtitle="Update your profile, security, and notification preferences."
                />
                <div className="settings-card">
                  <h3>Account Settings</h3>

                  {/* Current Plan Display */}
                  <div className="settings-section" style={{ background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>Current Subscription</h4>
                    <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4f46e5', margin: 0 }}>Free Plan</p>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.5rem' }}>Upgrade to unlock premium features</p>
                  </div>

                  {/* 2FA Security Section */}
                  <div className="settings-section" style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                    padding: '1.5rem',
                    borderRadius: '12px',
                    marginBottom: '2rem',
                    border: '1px solid rgba(16, 185, 129, 0.2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <i className="bi bi-shield-lock-fill" style={{ fontSize: '1.5rem', color: '#10b981' }}></i>
                        <div>
                          <h4 style={{ margin: 0, color: '#1e1b4b' }}>Two-Factor Authentication (2FA)</h4>
                          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
                            Add an extra layer of security to your account
                          </p>
                        </div>
                      </div>
                      <label style={{
                        position: 'relative',
                        display: 'inline-block',
                        width: '60px',
                        height: '32px',
                        cursor: twoFactorLoading ? 'wait' : 'pointer'
                      }}>
                        <input
                          type="checkbox"
                          checked={twoFactorEnabled}
                          disabled={twoFactorLoading}
                          onChange={async (e) => {
                            const newValue = e.target.checked;
                            setTwoFactorLoading(true);

                            const token = localStorage.getItem("hs_auth_token");
                            try {
                              const response = await fetch(`${API_BASE}/api/settings/toggle-2fa`, {
                                method: "POST",
                                headers: {
                                  "Content-Type": "application/json",
                                  "Authorization": `Bearer ${token}`
                                },
                                body: JSON.stringify({ enable: newValue })
                              });
                              const data = await response.json();

                              if (response.ok) {
                                setTwoFactorEnabled(data.twoFactorEnabled);
                                setPopup({
                                  isOpen: true,
                                  title: newValue ? "2FA Enabled! ðŸ”’" : "2FA Disabled",
                                  message: newValue
                                    ? "Two-Factor Authentication has been enabled. You'll need to verify with OTP on your next signin."
                                    : "Two-Factor Authentication has been disabled.",
                                  type: "success"
                                });
                              } else {
                                setPopup({
                                  isOpen: true,
                                  title: "Error",
                                  message: data.message || "Failed to update 2FA setting",
                                  type: "error"
                                });
                              }
                            } catch (error) {
                              setPopup({
                                isOpen: true,
                                title: "Error",
                                message: "Connection failed. Please try again.",
                                type: "error"
                              });
                            } finally {
                              setTwoFactorLoading(false);
                            }
                          }}
                          style={{ opacity: 0, width: 0, height: 0 }}
                        />
                        <span style={{
                          position: 'absolute',
                          cursor: twoFactorLoading ? 'wait' : 'pointer',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: twoFactorEnabled ? '#10b981' : '#cbd5e1',
                          transition: '0.4s',
                          borderRadius: '32px'
                        }}>
                          <span style={{
                            position: 'absolute',
                            content: '""',
                            height: '24px',
                            width: '24px',
                            left: twoFactorEnabled ? '32px' : '4px',
                            bottom: '4px',
                            backgroundColor: 'white',
                            transition: '0.4s',
                            borderRadius: '50%',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                          }}></span>
                        </span>
                      </label>
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      background: twoFactorEnabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                      borderRadius: '8px',
                      marginTop: '1rem'
                    }}>
                      <i className={`bi ${twoFactorEnabled ? 'bi-check-circle-fill' : 'bi-info-circle-fill'}`}
                        style={{ color: twoFactorEnabled ? '#10b981' : '#64748b' }}></i>
                      <span style={{ fontSize: '0.85rem', color: twoFactorEnabled ? '#059669' : '#64748b' }}>
                        {twoFactorEnabled
                          ? 'Your account is protected with 2FA. OTP will be required on signin.'
                          : 'Enable 2FA to add an extra layer of security to your account.'}
                      </span>
                    </div>
                  </div>

                  {/* Update Email  */}
                  <div className="settings-section">
                    <h4>Change Email Address</h4>
                    <input
                      type="email"
                      placeholder="Enter new email"
                      className="settings-input"
                      onChange={(e) => {
                        const newEmail = e.target.value;
                        const updateBtn = e.target.nextElementSibling as HTMLButtonElement;
                        if (updateBtn) {
                          updateBtn.onclick = async () => {
                            if (!newEmail) {
                              setPopup({ isOpen: true, title: "Error", message: "Please enter email", type: "error" });
                              return;
                            }
                            const token = SessionManager.getInstance().getToken();
                            try {
                              const response = await fetch(`${API_BASE}/api/settings/update-email`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                                body: JSON.stringify({ newEmail }),
                              });
                              const data = await response.json();
                              if (response.ok) {
                                setPopup({ isOpen: true, title: "Success!", message: "Email updated successfully", type: "success" });
                              } else {
                                setPopup({ isOpen: true, title: "Error", message: data.message || "Update failed", type: "error" });
                              }
                            } catch (error) {
                              setPopup({ isOpen: true, title: "Error", message: "Connection failed", type: "error" });
                            }
                          };
                        }
                      }}
                    />
                    <button className="settings-btn">
                      Update Email
                    </button>
                  </div>

                  {/* Update Password */}
                  <div className="settings-section">
                    <h4>Change Password</h4>
                    <input
                      type="password"
                      placeholder="Current password"
                      className="settings-input"
                      id="currentPass"
                    />
                    <input
                      type="password"
                      placeholder="New password"
                      className="settings-input"
                      id="newPass"
                    />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      className="settings-input"
                      id="confirmPass"
                    />
                    <button className="settings-btn" onClick={async () => {
                      const currentPassword = (document.getElementById('currentPass') as HTMLInputElement)?.value;
                      const newPassword = (document.getElementById('newPass') as HTMLInputElement)?.value;
                      const confirmPassword = (document.getElementById('confirmPass') as HTMLInputElement)?.value;

                      if (!currentPassword || !newPassword || !confirmPassword) {
                        setPopup({ isOpen: true, title: "Error", message: "All fields are required", type: "error" });
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        setPopup({ isOpen: true, title: "Error", message: "Passwords do not match", type: "error" });
                        return;
                      }
                      if (newPassword.length < 8) {
                        setPopup({ isOpen: true, title: "Error", message: "Password must be at least 8 characters", type: "error" });
                        return;
                      }

                      const token = SessionManager.getInstance().getToken();
                      try {
                        const response = await fetch(`${API_BASE}/api/settings/update-password`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                          body: JSON.stringify({ currentPassword, newPassword }),
                        });
                        const data = await response.json();
                        if (response.ok) {
                          setPopup({ isOpen: true, title: "Success!", message: "Password updated. Please sign in again.", type: "success" });
                          SessionManager.getInstance().logout();
                          setTimeout(() => navigate("/signin"), 2000);
                        } else {
                          setPopup({ isOpen: true, title: "Error", message: data.message || "Update failed", type: "error" });
                        }
                      } catch (error) {
                        setPopup({ isOpen: true, title: "Error", message: "Connection failed", type: "error" });
                      }
                    }}>
                      Update Password
                    </button>
                  </div>

                  {/* Add/Update Payment Method */}
                  <div className="settings-section">
                    <h4>Payment Method</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      Add or update your payment information for premium subscriptions
                    </p>

                    {/* Payment Method Selection */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 500 }}>
                        Select Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        style={{
                          width: '100%',
                          padding: '0.9rem 1rem',
                          border: '2px solid #e5e7eb',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          background: 'white'
                        }}
                      >
                        <option value="card">ðŸ’³ Credit/Debit Card</option>
                        <option value="paypal">ðŸ…¿ï¸ PayPal</option>
                        <option value="bank">ðŸ¦ Bank Account</option>
                      </select>
                    </div>

                    {/* Dynamic Form based on Payment Method */}
                    {paymentMethod === 'card' && (
                      <>
                        <input
                          type="text"
                          placeholder="Card Holder Name"
                          value={paymentDataExtended.cardHolderName}
                          onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, cardHolderName: e.target.value })}
                          className="settings-input"
                        />
                        <input
                          type="text"
                          placeholder="Card Number (16 digits)"
                          value={paymentDataExtended.cardNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 16);
                            setPaymentDataExtended({ ...paymentDataExtended, cardNumber: value });
                          }}
                          className="settings-input"
                          maxLength={16}
                        />
                        <div style={{ display: 'flex', gap: '1rem' }}>
                          <input
                            type="text"
                            placeholder="MM/YY"
                            value={paymentDataExtended.expiryDate}
                            onChange={(e) => {
                              let value = e.target.value.replace(/\D/g, '');
                              if (value.length >= 2) {
                                value = value.slice(0, 2) + '/' + value.slice(2, 4);
                              }
                              setPaymentDataExtended({ ...paymentDataExtended, expiryDate: value });
                            }}
                            className="settings-input"
                            maxLength={5}
                          />
                          <input
                            type="password"
                            placeholder="CVV"
                            value={paymentDataExtended.cvv}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setPaymentDataExtended({ ...paymentDataExtended, cvv: value });
                            }}
                            className="settings-input"
                            maxLength={4}
                          />
                        </div>
                      </>
                    )}

                    {paymentMethod === 'paypal' && (
                      <input
                        type="email"
                        placeholder="PayPal Email Address"
                        value={paymentDataExtended.paypalEmail}
                        onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, paypalEmail: e.target.value })}
                        className="settings-input"
                      />
                    )}

                    {paymentMethod === 'bank' && (
                      <>
                        <input
                          type="text"
                          placeholder="Account Holder Name"
                          value={paymentDataExtended.accountHolderName}
                          onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, accountHolderName: e.target.value })}
                          className="settings-input"
                        />
                        <input
                          type="text"
                          placeholder="Account Number"
                          value={paymentDataExtended.accountNumber}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setPaymentDataExtended({ ...paymentDataExtended, accountNumber: value });
                          }}
                          className="settings-input"
                        />
                        <input
                          type="text"
                          placeholder="Bank Name"
                          value={paymentDataExtended.bankName}
                          onChange={(e) => setPaymentDataExtended({ ...paymentDataExtended, bankName: e.target.value })}
                          className="settings-input"
                        />
                      </>
                    )}

                    <button className="settings-btn" onClick={async () => {
                      let dataToSend: any = { paymentMethod };

                      if (paymentMethod === 'card') {
                        if (!paymentDataExtended.cardHolderName || !paymentDataExtended.cardNumber || !paymentDataExtended.expiryDate || !paymentDataExtended.cvv) {
                          setPopup({ isOpen: true, title: "Error", message: "All card fields are required", type: "error" });
                          return;
                        }
                        if (paymentDataExtended.cardNumber.length !== 16) {
                          setPopup({ isOpen: true, title: "Error", message: "Invalid card number", type: "error" });
                          return;
                        }
                        dataToSend = {
                          ...dataToSend,
                          cardHolderName: paymentDataExtended.cardHolderName,
                          cardNumber: paymentDataExtended.cardNumber,
                          expiryDate: paymentDataExtended.expiryDate,
                          cvv: paymentDataExtended.cvv
                        };
                      } else if (paymentMethod === 'paypal') {
                        if (!paymentDataExtended.paypalEmail) {
                          setPopup({ isOpen: true, title: "Error", message: "PayPal email is required", type: "error" });
                          return;
                        }
                        dataToSend = { ...dataToSend, paypalEmail: paymentDataExtended.paypalEmail };
                      } else if (paymentMethod === 'bank') {
                        if (!paymentDataExtended.accountHolderName || !paymentDataExtended.accountNumber || !paymentDataExtended.bankName) {
                          setPopup({ isOpen: true, title: "Error", message: "All bank account fields are required", type: "error" });
                          return;
                        }
                        dataToSend = {
                          ...dataToSend,
                          accountHolderName: paymentDataExtended.accountHolderName,
                          accountNumber: paymentDataExtended.accountNumber,
                          bankName: paymentDataExtended.bankName
                        };
                      }

                      const token = SessionManager.getInstance().getToken();
                      try {
                        const response = await fetch(`${API_BASE}/api/settings/update-payment`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                          body: JSON.stringify(dataToSend),
                        });
                        const data = await response.json();
                        if (response.ok) {
                          setPopup({ isOpen: true, title: "Success!", message: "Payment method updated successfully", type: "success" });
                          // Clear form
                          setPaymentDataExtended({
                            cardHolderName: '',
                            cardNumber: '',
                            expiryDate: '',
                            cvv: '',
                            paypalEmail: '',
                            accountHolderName: '',
                            accountNumber: '',
                            bankName: ''
                          });
                        } else {
                          setPopup({ isOpen: true, title: "Error", message: data.message || "Update failed", type: "error" });
                        }
                      } catch (error) {
                        setPopup({ isOpen: true, title: "Error", message: "Connection failed", type: "error" });
                      }
                    }}>
                      Save Payment Method
                    </button>
                  </div>
                </div>
                </>
              )}

              {currentTab === "help" && (
                <>
                <DashboardPageHeader
                    badge="Support"
                    title="Help &"
                    accent="documentation"
                    subtitle="Common questions, quick guides, and how to reach the team."
                />
                <div className="help-card">
                  <h3>Help & Support</h3>

                  <div className="help-section">
                    <h4><i className="bi bi-question-circle-fill me-2"></i>Frequently Asked Questions</h4>

                    <div className="faq-item">
                      <div className="faq-question">
                        <i className="bi bi-chevron-right"></i>
                        <strong>How do I start a vulnerability scan?</strong>
                      </div>
                      <p className="faq-answer">
                        Go to the Dashboard tab, enter the target URL, check the authorization checkbox, and click "Start Scan".
                        Make sure you have permission to test the website.
                      </p>
                    </div>

                    <div className="faq-item">
                      <div className="faq-question">
                        <i className="bi bi-chevron-right"></i>
                        <strong>How can I view my scan history?</strong>
                      </div>
                      <p className="faq-answer">
                        Click on "Scan History" in the sidebar to view all your previous scans, including URLs tested and vulnerabilities found.
                      </p>
                    </div>

                    <div className="faq-item">
                      <div className="faq-question">
                        <i className="bi bi-chevron-right"></i>
                        <strong>How do I download reports?</strong>
                      </div>
                      <p className="faq-answer">
                        Navigate to the "Reports" tab, find your report, and click the PDF or Word icon to download in your preferred format.
                      </p>
                    </div>

                    <div className="faq-item">
                      <div className="faq-question">
                        <i className="bi bi-chevron-right"></i>
                        <strong>What types of vulnerabilities can be detected?</strong>
                      </div>
                      <p className="faq-answer">
                        Our AI-powered scanner detects XSS, SQL Injection, CSRF, Open Redirects, and many other common web vulnerabilities.
                      </p>
                    </div>
                  </div>

                  <div className="help-section">
                    <h4><i className="bi bi-headset me-2"></i>Contact Support</h4>
                    <p>Need more help? Our support team is here for you!</p>
                    <div className="contact-options">
                      <button
                        className="contact-btn"
                        onClick={() => window.location.href = 'mailto:contact@hacksentinel.com?subject=HackSentinel Support Request'}
                      >
                        <i className="bi bi-envelope-fill"></i>
                        Email Support
                      </button>
                      <button
                        className="contact-btn"
                        onClick={() => openChat()}
                      >
                        <i className="bi bi-chat-dots-fill"></i>
                        Live Chat
                      </button>
                    </div>
                  </div>
                </div>
                </>
              )}




              {/* ---------------- MODAL ---------------- */}
              {viewHistoryItem && (
                <div className="modal" onClick={() => setViewHistoryItem(null)}>
                  <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                    <button className="close-modal" onClick={() => setViewHistoryItem(null)}>
                      <i className="bi bi-x-lg"></i>
                    </button>
                    <h3>Scan Details</h3>
                    <p>
                      <strong>URL:</strong> {viewHistoryItem.url}
                    </p>
                    <p>
                      <strong>Time:</strong> {viewHistoryItem.time}
                    </p>
                    <p><strong>Vulnerabilities:</strong></p>
                    <ul>
                      {viewHistoryItem.vulnerabilities.map((v, i) => (
                        <li key={i}>{v}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* CHAT HISTORY TAB */}
              {currentTab === "chatHistory" && (
                <>
                <DashboardPageHeader
                    badge="Conversations"
                    title="Chat"
                    accent="history"
                    subtitle="Every conversation you've had with the HackSentinel assistant."
                />
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h3 style={{ margin: 0, color: '#1e1b4b', fontSize: '1.75rem' }}>
                      <i className="bi bi-chat-left-dots-fill" style={{ marginRight: '0.75rem', color: '#4f46e5' }}></i>
                      Chat History
                    </h3>
                    <button
                      onClick={() => openChat()}
                      style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        fontSize: '1rem',
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <i className="bi bi-plus-circle"></i>
                      New Chat
                    </button>
                  </div>

                  {chatHistoryList.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '4rem 2rem',
                      color: '#94a3b8'
                    }}>
                      <i className="bi bi-chat-left-text" style={{ fontSize: '4rem', marginBottom: '1rem', display: 'block', color: '#cbd5e1' }}></i>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>No Chat History Yet</h4>
                      <p style={{ margin: 0 }}>Start a conversation by clicking the "New Chat" button above!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      {chatHistoryList.map((chat) => (
                        <div
                          key={chat._id}
                          style={{
                            padding: '1.5rem',
                            border: '2px solid #e5e7eb',
                            borderRadius: '12px',
                            background: 'white',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#4f46e5';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(79, 70, 229, 0.15)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }} onClick={() => openChat(chat._id)}>
                              <h4 style={{
                                margin: '0 0 0.5rem 0',
                                fontSize: '1.1rem',
                                fontWeight: 600,
                                color: '#1e1b4b',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}>
                                <i className="bi bi-chat-dots-fill" style={{ color: '#4f46e5' }}></i>
                                {chat.title}
                              </h4>
                              <p style={{
                                margin: '0.25rem 0 0.75rem 0',
                                fontSize: '0.9rem',
                                color: '#64748b',
                                lineHeight: 1.5
                              }}>
                                {chat.lastMessage}...
                              </p>
                              <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: '#94a3b8' }}>
                                <span>
                                  <i className="bi bi-envelope"></i> {chat.messageCount} messages
                                </span>
                                <span>
                                  <i className="bi bi-clock"></i> {new Date(chat.updatedAt).toLocaleDateString()}
                                </span>
                                <span style={{
                                  background: chat.status === 'active' ? '#10b981' : '#94a3b8',
                                  color: 'white',
                                  padding: '0.1rem 0.5rem',
                                  borderRadius: '12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  textTransform: 'uppercase'
                                }}>
                                  {chat.status}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat._id);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                fontSize: '1.2rem',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                borderRadius: '8px',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#fee2e2';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                              title="Delete chat"
                            >
                              <i className="bi bi-trash-fill"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </>
              )}

              {currentTab === "notifications" && (
                <>
                <DashboardPageHeader
                    badge="Inbox"
                    title="Your"
                    accent="notifications"
                    subtitle="Scan alerts, account updates, and platform announcements."
                />
                <div className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h3 style={{ margin: 0, color: '#1e1b4b', fontSize: '1.75rem' }}>
                      <i className="bi bi-bell-fill" style={{ marginRight: '0.75rem', color: '#4f46e5' }}></i>
                      Notifications
                    </h3>
                    {notifications.length > 0 && (
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                          onClick={markAllAsRead}
                          style={{
                            background: 'white',
                            border: '1px solid #4f46e5',
                            color: '#4f46e5',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <i className="bi bi-check-all" style={{ marginRight: '0.5rem' }}></i>
                          Mark all as read
                        </button>
                        <button
                          onClick={clearAllNotifications}
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #ef4444',
                            color: '#ef4444',
                            padding: '0.6rem 1.2rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}
                        >
                          <i className="bi bi-trash"></i> Clear All
                        </button>
                      </div>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '4rem 2rem',
                      color: '#94a3b8'
                    }}>
                      <i className="bi bi-bell-slash" style={{ fontSize: '4rem', marginBottom: '1rem', display: 'block', color: '#cbd5e1' }}></i>
                      <h4 style={{ margin: '0 0 0.5rem 0', color: '#64748b' }}>No notifications</h4>
                      <p>You're all caught up!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {notifications.map((notification) => (
                        <div
                          key={notification._id}
                          onClick={() => !notification.read && markAsRead(notification._id)}
                          style={{
                            padding: '1.25rem',
                            border: '2px solid',
                            borderColor: notification.read ? '#f1f5f9' : '#e9d5ff',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            background: notification.read ? 'white' : 'rgba(79, 70, 229, 0.02)',
                            transition: 'all 0.2s',
                            boxShadow: notification.read ? 'none' : '0 2px 8px rgba(79, 70, 229, 0.08)',
                            opacity: notification.read ? 0.8 : 1
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'}
                          onMouseLeave={(e) => e.currentTarget.style.boxShadow = notification.read ? 'none' : '0 2px 8px rgba(79, 70, 229, 0.08)'}
                          className="notification-item"
                        >
                          <div style={{ display: 'flex', gap: '1rem' }}>
                            <div style={{
                              width: '50px',
                              height: '50px',
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: notification.type === 'security' ? 'rgba(16, 185, 129, 0.1)' :
                                notification.type === 'scan' ? 'rgba(59, 130, 246, 0.1)' :
                                  notification.type === 'account' ? 'rgba(79, 70, 229, 0.1)' :
                                    notification.type === 'admin' ? 'rgba(239, 68, 68, 0.1)' :
                                      'rgba(245, 158, 11, 0.1)',
                              flexShrink: 0,
                              color: notification.type === 'security' ? '#10b981' :
                                notification.type === 'scan' ? '#3b82f6' :
                                  notification.type === 'account' ? '#4f46e5' :
                                    notification.type === 'admin' ? '#ef4444' :
                                      '#f59e0b'
                            }}>
                              <i className={`bi ${notification.icon}`} style={{ fontSize: '1.5rem' }}></i>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                <h5 style={{
                                  margin: 0,
                                  fontSize: '1.1rem',
                                  fontWeight: notification.read ? 500 : 700,
                                  color: '#1e1b4b'
                                }}>
                                  {notification.title}
                                </h5>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  {!notification.read && (
                                    <span style={{
                                      background: '#4f46e5',
                                      color: 'white',
                                      padding: '0.2rem 0.6rem',
                                      borderRadius: '20px',
                                      fontSize: '0.7rem',
                                      fontWeight: 600,
                                      flexShrink: 0
                                    }}>
                                      NEW
                                    </span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteNotification(notification._id);
                                    }}
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: '#cbd5e1',
                                      cursor: 'pointer',
                                      padding: '0.25rem',
                                      transition: 'color 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = '#cbd5e1'}
                                    title="Delete"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                </div>
                              </div>
                              {notification.image && (
                                <div style={{ marginBottom: '0.75rem' }}>
                                  <img
                                    src={`http://localhost:5000${notification.image}`}
                                    alt="Notification"
                                    style={{
                                      maxWidth: '300px',
                                      maxHeight: '300px',
                                      borderRadius: '8px',
                                      objectFit: 'cover',
                                      border: '1px solid #e5e7eb'
                                    }}
                                  />
                                </div>
                              )}
                              <p style={{
                                margin: 0,
                                fontSize: '0.95rem',
                                color: '#64748b',
                                lineHeight: 1.6,
                                marginBottom: '0.5rem'
                              }}>
                                {notification.message}
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                                <span style={{
                                  fontSize: '0.8rem',
                                  color: '#94a3b8',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <i className="bi bi-clock"></i>
                                  {formatTimeAgo(notification.createdAt)}
                                </span>
                                {notification.type === 'admin' && (
                                  <span style={{
                                    fontSize: '0.75rem',
                                    color: '#ef4444',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem'
                                  }}>
                                    <i className="bi bi-megaphone-fill"></i>
                                    Admin Announcement
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </>
              )}

            </>
          )
        }
      </main >

      {/* ---------------- DOWNLOAD FORMAT MODAL ---------------- */}
      {showDownloadModal && pendingDownloadReport && (
        <div className="modal" onClick={() => !downloadingReport && setShowDownloadModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <button className="close-modal" onClick={() => setShowDownloadModal(false)} disabled={downloadingReport}>
              <i className="bi bi-x-lg"></i>
            </button>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <i className="bi bi-download" style={{ color: 'var(--primary)', fontSize: '1.25rem' }}></i>
              Download Report
            </h3>
            <p><strong>{pendingDownloadReport.fileName}</strong></p>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.5rem' }}>
              Target: {pendingDownloadReport.targetUrl}&nbsp;&middot;&nbsp;
              {pendingDownloadReport.reportData?.totalFindings || 0} findings
            </p>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#1e293b', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Export Format
              </label>
              <select
                value={downloadFormat}
                onChange={e => setDownloadFormat(e.target.value)}
                disabled={downloadingReport}
                style={{ width: '100%', padding: '0.75rem 1rem', border: '2px solid #e2e8f0', borderRadius: '10px', fontSize: '1rem', outline: 'none', cursor: 'pointer', background: 'white', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
                onFocus={e => (e.target.style.borderColor = 'var(--primary)')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              >
                <option value="pdf">PDF â€” Portable Document Format</option>
                <option value="docx">DOCX â€” Microsoft Word Document</option>
                <option value="md">Markdown â€” Plain Text Report</option>
                <option value="json">JSON â€” Raw Data Export</option>
                <option value="hackerone">HackerOne â€” Bug Bounty Template</option>
                <option value="bugcrowd">Bugcrowd â€” Bug Bounty Template</option>
                <option value="intigriti">Intigriti â€” Bug Bounty Template</option>
                <option value="yeswehack">YesWeHack â€” Bug Bounty Template</option>
              </select>
              {downloadFormat !== pendingDownloadReport.format && (
                <p style={{ fontSize: '0.8rem', color: '#f59e0b', marginTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <i className="bi bi-info-circle"></i>
                  A new {downloadFormat.toUpperCase()} report will be generated from the original scan data.
                </p>
              )}
            </div>

            <button
              onClick={handleModalDownload}
              disabled={downloadingReport}
              style={{
                width: '100%', padding: '0.9rem',
                background: 'linear-gradient(135deg, var(--primary) 0%, #0891b2 100%)',
                color: 'white', border: 'none', borderRadius: '10px',
                fontWeight: 600, fontSize: '1rem',
                cursor: downloadingReport ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                opacity: downloadingReport ? 0.75 : 1,
                transition: 'all 0.2s',
              }}
            >
              {downloadingReport ? (
                <><span className="spinner-border spinner-border-sm" role="status"></span>&nbsp;Generating...</>
              ) : (
                <><i className="bi bi-download"></i>Download as {downloadFormat.toUpperCase()}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ---------------- MODAL ---------------- */}
      {
        viewHistoryItem && (
          <div className="modal" onClick={() => setViewHistoryItem(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="close-modal" onClick={() => setViewHistoryItem(null)}>
                <i className="bi bi-x-lg"></i>
              </button>
              <h3>Scan Details</h3>
              <p>
                <strong>URL:</strong> {viewHistoryItem.url}
              </p>
              <p>
                <strong>Time:</strong> {viewHistoryItem.time}
              </p>
              <p><strong>Vulnerabilities:</strong></p>
              <ul>
                {viewHistoryItem.vulnerabilities.map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            </div>
          </div>
        )
      }

      {/* Chat Modal */}
      <ChatModal
        isOpen={showChatModal}
        onClose={() => {
          setShowChatModal(false);
          setSelectedChatId(null);
          // Refresh chat history if on that tab
          if (currentTab === "chatHistory") {
            fetchChatHistory();
          }
        }}
        chatId={selectedChatId}
      />

      {/* Chatbot Widget */}
      <Chatbot position="bottom-right" />
    </div >
  );
};

export default Dashboard;
