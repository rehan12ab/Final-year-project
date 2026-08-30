import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminDashboard.css";
import Popup from "./components/Popup";
import profilePic from "./assets/profile.jpg";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import ReactCrop, { Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import Chatbot from './components/Chatbot';
import DashboardPageHeader from './components/DashboardPageHeader';

interface User {
    _id: string;
    fullName: string;
    email: string;
    phone: string;
    subscription?: {
        plan: string;
        status: string;
    };
    twoFactorEnabled: boolean;
    createdAt: string;
}

interface Analytics {
    totalUsers: number;
    activeSubscriptions: number;
    planDistribution: {
        free: number;
        professional: number;
        enterprise: number;
    };
    newUsersLast30Days: number;
    twoFAEnabledUsers: number;
    totalScans: number;
    scanActivity: Array<{ date: string; scans: number; users: number }>;
    vulnerabilityDistribution: Array<{ name: string; value: number }>;
    estimatedRevenue: number;
    growthTrends?: Array<{ date: string; users: number }>;
    vulnerabilityTrends?: Array<{ date: string; issues: number }>;
    topTargets?: Array<{ target: string; count: number }>;
    avgScanDuration?: number;
    totalIssuesFound?: number;
    scanSuccessRate?: { success: number; failed: number };
}

const AdminDashboard = () => {
    const navigate = useNavigate();
    const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

    const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [currentTab, setCurrentTab] = useState<"dashboard" | "users" | "analytics" | "history" | "settings" | "notifications">("dashboard");
    const [users, setUsers] = useState<User[]>([]);
    const [analytics, setAnalytics] = useState<Analytics | null>(null);
    const [loading, setLoading] = useState(false);
    
    const [adminUserSearch, setAdminUserSearch] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [adminUserPage, setAdminUserPage] = useState(1);
    const [activityPage, setActivityPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [targetsPage, setTargetsPage] = useState(1);
    const [modalPage, setModalPage] = useState(1);
    const pageSize = 10;
    const modalPageSize = 5;

    const [adminInfo, setAdminInfo] = useState<any>(null);
    const [newEmail, setNewEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [notificationTitle, setNotificationTitle] = useState("");
    const [notificationMessage, setNotificationMessage] = useState("");
    const [notificationImage, setNotificationImage] = useState<string | null>(null);
    const [targetType, setTargetType] = useState<"all" | "specific" | "group">("all");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [userSearch, setUserSearch] = useState("");
    const [selectedGroup, setSelectedGroup] = useState("");
    const [usersList, setUsersList] = useState<any[]>([]);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [usersWithScans, setUsersWithScans] = useState<any[]>([]);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [selectedUserScans, setSelectedUserScans] = useState<any>(null);
    const [showScanModal, setShowScanModal] = useState(false);

    const [showCropModal, setShowCropModal] = useState(false);
    const [cropSrc, setCropSrc] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [engineStatus, setEngineStatus] = useState<'ONLINE' | 'OFFLINE' | 'CHECKING'>('CHECKING');
    const [crop, setCrop] = useState<any>({ unit: '%', width: 100, aspect: 1 });
    const [completedCrop, setCompletedCrop] = useState<any>(null);
    const [imgRef, setImgRef] = useState<HTMLImageElement | null>(null);

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

    useEffect(() => {
        const token = localStorage.getItem("hs_admin_token");
        const info = localStorage.getItem("hs_admin_info");
        if (!token) {
            navigate("/admin/signin");
        } else if (info) {
            const parsedInfo = JSON.parse(info);
            setAdminInfo(parsedInfo);
            setNewEmail(parsedInfo.email || "");
        }

        // Listen for AI-driven navigation events from Chatbot
        const handleAiNavigate = (e: any) => {
            if (e.detail && e.detail.tab) {
                setCurrentTab(e.detail.tab);
                setSidebarOpen(true); // Ensure sidebar is open to show context
            }
        };

        window.addEventListener('hs_admin_navigate', handleAiNavigate);
        return () => window.removeEventListener('hs_admin_navigate', handleAiNavigate);
    }, [navigate]);

    const fetchUsers = async () => {
        const token = localStorage.getItem("hs_admin_token");
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE}/api/admin/users`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) setUsers(data.users);
        } catch (error) { console.error("Failed to fetch users:", error); }
    };

    const checkEngineStatus = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/scan/ai-status`, {
                headers: { "Authorization": `Bearer ${localStorage.getItem("hs_admin_token")}` }
            });
            if (response.ok) {
                const data = await response.json();
                setEngineStatus(data.available ? 'ONLINE' : 'OFFLINE');
            } else { setEngineStatus('OFFLINE'); }
        } catch (error) { setEngineStatus('OFFLINE'); }
    };

    const fetchAnalytics = async () => {
        const token = localStorage.getItem("hs_admin_token");
        if (!token) return;
        setSyncing(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/analytics`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setAnalytics(data);
                if (data.recentScans) setRecentActivity(data.recentScans);
                setPopup({
                    isOpen: true,
                    title: "Sync Complete",
                    message: "Platform analytics and activity logs have been refreshed.",
                    type: "success"
                });
            }
        } catch (error) { 
            console.error("Failed to fetch analytics:", error); 
        } finally {
            setSyncing(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
        fetchUsers();
        checkEngineStatus();
        const interval = setInterval(checkEngineStatus, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (currentTab === "users") fetchUsers();
        else if (currentTab === "analytics" || currentTab === "dashboard") fetchAnalytics();
        else if (currentTab === "notifications") fetchUsersList();
        else if (currentTab === "history") fetchUsersWithScans();
    }, [currentTab]);

    const handleUpdateUserPlan = async (userId: string, newPlan: string) => {
        const token = localStorage.getItem("hs_admin_token");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ "subscription.plan": newPlan })
            });
            if (response.ok) {
                setPopup({ isOpen: true, title: "Success", message: "Plan updated!", type: "success" });
                fetchUsers();
            }
        } catch (error) { console.error("Plan update failed:", error); }
        finally { setLoading(false); }
    };

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;
        const token = localStorage.getItem("hs_admin_token");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                setPopup({ isOpen: true, title: "Success", message: "User deleted successfully", type: "success" });
                fetchUsers();
            }
        } catch (error) { console.error("Delete user failed:", error); }
        finally { setLoading(false); }
    };

    const handleUpdateEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        const token = localStorage.getItem("hs_admin_token");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/update-email`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ email: newEmail })
            });
            if (response.ok) {
                setPopup({ isOpen: true, title: "Success", message: "Email updated successfully", type: "success" });
            }
        } catch (error) { console.error("Email update failed:", error); }
        finally { setLoading(false); }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setPopup({ isOpen: true, title: "Error", message: "Passwords do not match", type: "error" });
            return;
        }
        const token = localStorage.getItem("hs_admin_token");
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/admin/update-password`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword })
            });
            if (response.ok) {
                setPopup({ isOpen: true, title: "Success", message: "Password updated successfully", type: "success" });
            }
        } catch (error) { console.error("Password update failed:", error); }
        finally { setLoading(false); }
    };

    const handleLogout = () => {
        localStorage.removeItem("hs_admin_token");
        localStorage.removeItem("hs_admin_info");
        navigate("/admin/signin");
    };

    const fetchUsersList = async () => {
        const token = localStorage.getItem("hs_admin_token");
        try {
            const response = await fetch(`${API_BASE}/api/admin/users/list`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUsersList(data.users);
            }
        } catch (error) { console.error("Fetch users list failed:", error); }
    };

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCropSrc(reader.result as string);
                setShowCropModal(true);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCropComplete = async () => {
        if (!imgRef || !completedCrop) return;
        const canvas = document.createElement('canvas');
        const scaleX = imgRef.naturalWidth / imgRef.width;
        const scaleY = imgRef.naturalHeight / imgRef.height;
        canvas.width = 500; canvas.height = 500;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(imgRef, completedCrop.x * scaleX, completedCrop.y * scaleY, completedCrop.width * scaleX, completedCrop.height * scaleY, 0, 0, 500, 500);
        }
        canvas.toBlob((blob) => {
            if (blob) {
                setImageFile(new File([blob], 'notif.jpg', { type: 'image/jpeg' }));
                setImagePreview(canvas.toDataURL());
                setShowCropModal(false);
            }
        }, 'image/jpeg');
    };

    const handleSendNotification = async () => {
        const token = localStorage.getItem("hs_admin_token");
        setLoading(true);
        try {
            let imageUrl = notificationImage;
            if (imageFile) {
                const formData = new FormData();
                formData.append('image', imageFile);
                const uploadRes = await fetch(`${API_BASE}/api/admin/notifications/upload-image`, {
                    method: "POST", headers: { "Authorization": `Bearer ${token}` }, body: formData
                });
                const uploadData = await uploadRes.json();
                imageUrl = uploadData.imageUrl;
            }

            const response = await fetch(`${API_BASE}/api/admin/notifications/send`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: notificationTitle, message: notificationMessage, image: imageUrl,
                    targetType, targetUsers: selectedUsers, targetGroup: selectedGroup
                })
            });
            if (response.ok) {
                setPopup({ isOpen: true, title: "Success", message: "Broadcast sent!", type: "success" });
                setNotificationTitle(""); setNotificationMessage(""); setImagePreview(null);
            }
        } catch (error) { console.error("Notification failed:", error); }
        finally { setLoading(false); }
    };

    const fetchUsersWithScans = async () => {
        const token = localStorage.getItem("hs_admin_token");
        try {
            const response = await fetch(`${API_BASE}/api/admin/user-scans`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) setUsersWithScans(data.users);
        } catch (error) { console.error("Fetch user scans failed:", error); }
    };

    const viewUserScans = async (userId: string) => {
        const token = localStorage.getItem("hs_admin_token");
        try {
            const response = await fetch(`${API_BASE}/api/admin/user-scans/${userId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setSelectedUserScans(data);
                setModalPage(1);
                setShowScanModal(true);
            }
        } catch (error) { console.error("View scans failed:", error); }
    };

    const deleteScan = async (scanId: string) => {
        if (!confirm("Are you sure?")) return;
        const token = localStorage.getItem("hs_admin_token");
        try {
            const response = await fetch(`${API_BASE}/api/admin/user-scans/${scanId}`, {
                method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                setPopup({ isOpen: true, title: "Deleted", message: "Scan record removed.", type: "success" });
                if (selectedUserScans) viewUserScans(selectedUserScans.user._id);
                fetchUsersWithScans();
            }
        } catch (error) { console.error("Delete scan failed:", error); }
    };

    const planData = analytics ? [
        { name: 'Free', value: analytics.planDistribution.free, color: '#94a3b8' },
        { name: 'Professional', value: analytics.planDistribution.professional, color: '#4f46e5' },
        { name: 'Enterprise', value: analytics.planDistribution.enterprise, color: '#10b981' }
    ] : [];

    const filteredAdminUsers = users.filter(u => u.fullName.toLowerCase().includes(adminUserSearch.toLowerCase()) || u.email.toLowerCase().includes(adminUserSearch.toLowerCase()));
    const paginatedAdminUsers = filteredAdminUsers.slice((adminUserPage - 1) * pageSize, adminUserPage * pageSize);

    return (
        <div className="dashboard-layout">
            <Popup isOpen={popup.isOpen} onClose={() => setPopup({ ...popup, isOpen: false })} title={popup.title} message={popup.message} type={popup.type} />

            {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}

            <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
                <div className="sidebar-title">
                    <div className="brand-box">
                        <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '55px', height: '55px', objectFit: 'contain' }} />
                        <h2>{sidebarOpen ? "HackSentinel" : "HS"}</h2>
                    </div>
                    <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                </div>
                <ul className="sidebar-menu">
                    <li onClick={() => setCurrentTab("dashboard")} className={currentTab === "dashboard" ? "active" : ""}><i className="bi bi-grid-1x2-fill"></i> {sidebarOpen && "Dashboard"}</li>
                    <li onClick={() => setCurrentTab("users")} className={currentTab === "users" ? "active" : ""}><i className="bi bi-people-fill"></i> {sidebarOpen && "Manage Users"}</li>
                    <li onClick={() => setCurrentTab("analytics")} className={currentTab === "analytics" ? "active" : ""}><i className="bi bi-bar-chart-line-fill"></i> {sidebarOpen && "Analytics Hub"}</li>
                    <li onClick={() => setCurrentTab("history")} className={currentTab === "history" ? "active" : ""}><i className="bi bi-shield-shaded"></i> {sidebarOpen && "User History"}</li>
                    <li onClick={() => setCurrentTab("notifications")} className={currentTab === "notifications" ? "active" : ""}><i className="bi bi-megaphone-fill"></i> {sidebarOpen && "Broadcast"}</li>
                    <li onClick={() => setCurrentTab("settings")} className={currentTab === "settings" ? "active" : ""}><i className="bi bi-gear-fill"></i> {sidebarOpen && "Settings"}</li>
                    {sidebarOpen && <li className="logout" onClick={handleLogout}><i className="bi bi-box-arrow-right" style={{ display: 'inline-block', opacity: 1, visibility: 'visible' }}></i> Logout</li>}
                </ul>
            </aside>

            <header className="topbar">
                <button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}><i className="bi bi-list"></i></button>
                <div className="topbar-left"><p className="subtitle">Admin Command Center</p></div>
                <div className="topbar-right">
                    <button 
                        className={`submit-btn ${syncing ? 'syncing' : ''}`} 
                        style={{ marginRight: '1rem', padding: '0.5rem 1rem', fontSize: '0.8rem' }} 
                        onClick={fetchAnalytics}
                        disabled={syncing}
                    >
                        <i className={`bi ${syncing ? 'bi-hypnotize spin' : 'bi-arrow-clockwise'} me-1`}></i> 
                        {syncing ? 'Syncing...' : 'Sync Intelligence'}
                    </button>
                    <img src={profilePic} alt="Admin" className="profile-avatar-img" onClick={() => setProfileMenuOpen(!profileMenuOpen)} />
                    {profileMenuOpen && <div className="profile-dropdown"><button onClick={handleLogout}>Logout</button></div>}
                </div>
            </header>

            <main className="main-content">
                {!analytics ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}></div>
                        <h4 className="mt-3 text-muted">Syncing Intelligence Hub...</h4>
                    </div>
                ) : (
                    <>
                    {currentTab === "dashboard" && (
                    <>
                        <DashboardPageHeader
                            badge="Overview"
                            title="Platform"
                            accent="command center"
                            subtitle="Real-time metrics, active users, and system health at a glance."
                        />
                        <div className="stats-grid">
                            <div className="stat-card"><div className="stat-icon purple" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo.png" alt="HackSentinel Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} /></div><div className="stat-info"><h3>{analytics.totalUsers}</h3><p>Total Users</p></div></div>
                            <div className="stat-card"><div className="stat-icon green"><i className="bi bi-trophy-fill"></i></div><div className="stat-info"><h3>{analytics.activeSubscriptions}</h3><p>Active Plans</p></div></div>
                            <div className="stat-card">
                                <div className={`pulse-dot ${engineStatus.toLowerCase()}`}></div>
                                <div className="stat-icon blue" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><img src="/logo.png" alt="HackSentinel Logo" style={{ width: '24px', height: '24px', objectFit: 'contain' }} /></div>
                                <div className="stat-info">
                                    <h3 style={{ color: engineStatus === 'ONLINE' ? '#10b981' : '#ef4444' }}>{engineStatus}</h3>
                                    <p>Engine Status</p>
                                </div>
                            </div>
                            <div className="stat-card"><div className="stat-icon red"><i className="bi bi-shield-check"></i></div><div className="stat-info"><h3>{analytics.twoFAEnabledUsers}</h3><p>2FA Secured</p></div></div>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="stat-icon red"><i className="bi bi-exclamation-octagon"></i></div>
                                <div className="stat-info"><h3>{analytics.totalIssuesFound}</h3><p>Total Issues</p></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon yellow"><i className="bi bi-lightning-charge"></i></div>
                                <div className="stat-info"><h3>{analytics.avgScanDuration}s</h3><p>Avg Engine Speed</p></div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon blue"><i className="bi bi-bug"></i></div>
                                <div className="stat-info"><h3>{analytics.vulnerabilityDistribution[0]?.name || 'Stable'}</h3><p>Top Threat Type</p></div>
                            </div>
                        </div>
                        <div className="dashboard-row-2">
                            <div className="card activity-feed">
                                <h3><img src="/logo.png" alt="HackSentinel Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', marginRight: '0.75rem' }} /> Live Platform Feed</h3>
                                <div className="activity-table-wrapper" style={{ overflowX: 'auto', display: 'block', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                                    {recentActivity.length > 0 ? (
                                        <>
                                        <table className="admin-table" style={{ width: 'max-content', minWidth: '1000px', tableLayout: 'auto', whiteSpace: 'nowrap' }}>
                                            <thead>
                                                <tr>
                                                    <th>Status</th>
                                                    <th>Administrator / User</th>
                                                    <th>Target URL</th>
                                                    <th>Audit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {recentActivity.slice((activityPage - 1) * pageSize, activityPage * pageSize).map((act, i) => (
                                                    <tr key={i}>
                                                        <td><span className={`status-badge ${act.status || 'completed'}`}>{act.status || 'completed'}</span></td>
                                                        <td>{act.userEmail}</td>
                                                        <td><code>{act.targetUrl}</code></td>
                                                        <td>
                                                            <div className="action-btn-group">
                                                                <button className="action-btn-premium view" title="View Audit" onClick={() => { setSelectedUserScans({ scans: [act], user: { fullName: act.userEmail, email: act.userEmail } }); setShowScanModal(true); }}>
                                                                    <i className="bi bi-eye-fill"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="table-pagination-premium">
                                            <span className="pg-info">Page {activityPage} of {Math.ceil(recentActivity.length / pageSize) || 1}</span>
                                            <div className="pg-btns-group">
                                                <button disabled={activityPage === 1} onClick={() => setActivityPage(activityPage - 1)} className="pg-btn" title="Previous"><i className="bi bi-arrow-left-circle-fill"></i></button>
                                                <button disabled={activityPage >= Math.ceil(recentActivity.length / pageSize)} onClick={() => setActivityPage(activityPage + 1)} className="pg-btn" title="Next"><i className="bi bi-arrow-right-circle-fill"></i></button>
                                            </div>
                                        </div>
                                        </>
                                    ) : <p className="text-muted text-center p-4">No recent scan activity found.</p>}
                                </div>
                            </div>
                            <div className="card charts-section">
                                <h3>Plan Distribution</h3>
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie 
                                            data={planData} 
                                            cx="50%" 
                                            cy="45%" 
                                            innerRadius={60}
                                            outerRadius={80} 
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {planData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend verticalAlign="bottom" height={36}/>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </>
                )}

                {currentTab === "analytics" && analytics && (
                    <div className="analytics-hub">
                        <DashboardPageHeader
                            badge="Analytics"
                            title="Neural"
                            accent="intelligence"
                            subtitle="Real-time platform growth, revenue, and security posture."
                        />

                        <div className="analytics-grid-premium">
                            <div className="analytics-card tall">
                                <div className="card-header"><i className="bi bi-graph-up-arrow"></i><h4>Growth Velocity</h4></div>
                                <div className="chart-container" style={{ height: 300, minHeight: '300px' }}>
                                    {analytics.growthTrends && analytics.growthTrends.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={analytics.growthTrends}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                <Line type="monotone" dataKey="signups" stroke="var(--admin-primary)" strokeWidth={3} dot={{ r: 4, fill: 'var(--admin-primary)', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="empty-chart">Loading growth data...</div>
                                    )}
                                </div>
                            </div>

                            <div className="analytics-card tall">
                                <div className="card-header"><i className="bi bi-shield-shaded"></i><h4>Security Posture</h4></div>
                                <div className="chart-container" style={{ height: 300, minHeight: '300px' }}>
                                    {(analytics.vulnerabilityTrends?.length ?? 0) > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={analytics.vulnerabilityTrends}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                                <Line type="monotone" dataKey="avgVulns" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#ef4444', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="empty-chart">No security data available</div>
                                    )}
                                </div>
                                <p className="chart-subtitle" style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', marginTop: '1rem' }}>Average vulnerabilities found per scan</p>
                            </div>

                            {/* Revenue Stream Card */}
                            <div className="analytics-card">
                                <div className="card-header"><i className="bi bi-cash-stack"></i><h4>Revenue Streams</h4></div>
                                <div className="card-body">
                                    <div className="revenue-main">${analytics.estimatedRevenue}</div>
                                    <p className="revenue-sub">Projected Monthly Income</p>
                                    <div className="revenue-breakdown">
                                        <div className="breakdown-item"><span>Professional</span><span>${(analytics.planDistribution?.professional || 0) * 49}</span></div>
                                        <div className="breakdown-item"><span>Enterprise</span><span>${(analytics.planDistribution?.enterprise || 0) * 199}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="analytics-row-bottom">
                                <div className="analytics-card">
                                    <div className="card-header"><i className="bi bi-cpu-fill"></i><h4>System Efficiency</h4></div>
                                    <div className="card-body">
                                        <div className="reliability-viz">
                                            <div className="reliability-header">
                                                <span className="reliability-percent">
                                                    {Math.round(((analytics.scanSuccessRate?.success ?? 0) / (((analytics.scanSuccessRate?.success ?? 0) + (analytics.scanSuccessRate?.failed ?? 0)) || 1)) * 100)}%
                                                </span>
                                                <span className="reliability-tag">System Efficiency</span>
                                            </div>
                                            <div className="success-bar-container-premium">
                                                <div className="success-bar-fill-premium" style={{ width: `${((analytics.scanSuccessRate?.success ?? 0) / (((analytics.scanSuccessRate?.success ?? 0) + (analytics.scanSuccessRate?.failed ?? 0)) || 1)) * 100}%` }}></div>
                                            </div>
                                            <div className="reliability-stats-footer">
                                                <div className="footer-stat"><strong>{analytics.scanSuccessRate?.success || 0}</strong> Successful</div>
                                                <div className="footer-stat"><strong>{analytics.scanSuccessRate?.failed || 0}</strong> Failed</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="analytics-card">
                                    <div className="card-header"><i className="bi bi-target"></i><h4>Hot Targets</h4></div>
                                    <div className="card-body">
                                        <div className="targets-table-wrapper">
                                            {(analytics.topTargets || []).length > 0 ? (
                                                <>
                                                <table className="admin-table mini">
                                                    <thead>
                                                        <tr>
                                                            <th>Rank</th>
                                                            <th>Target URL</th>
                                                            <th>Scans</th>
                                                            <th>Audit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(analytics.topTargets ?? []).slice((targetsPage - 1) * pageSize, targetsPage * pageSize).map((target: any, i: number) => (
                                                            <tr key={i}>
                                                                <td><span className="rank-badge">#{((targetsPage - 1) * pageSize) + i + 1}</span></td>
                                                                <td><code>{target.url}</code></td>
                                                                <td><span className="count-tag">{target.count}</span></td>
                                                                <td>
                                                                    <div className="action-btn-group">
                                                                        <button className="action-btn-premium view" title="View Target Reports" onClick={() => { setSelectedUserScans({ scans: [target], user: { fullName: target.url, email: 'System Intel' } }); setShowScanModal(true); }}>
                                                                            <i className="bi bi-eye-fill"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                                <div className="table-pagination-premium mini">
                                                    <div className="pg-btns-group">
                                                        <button disabled={targetsPage === 1} onClick={() => setTargetsPage(targetsPage - 1)} className="pg-btn"><i className="bi bi-arrow-left-circle-fill"></i></button>
                                                        <span className="pg-info">{targetsPage} / {Math.ceil((analytics.topTargets || []).length / pageSize) || 1}</span>
                                                        <button disabled={targetsPage >= Math.ceil((analytics.topTargets || []).length / pageSize)} onClick={() => setTargetsPage(targetsPage + 1)} className="pg-btn"><i className="bi bi-arrow-right-circle-fill"></i></button>
                                                    </div>
                                                </div>
                                                </>
                                            ) : (
                                                <div className="text-muted text-center p-3">No targets analyzed yet</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentTab === "users" && (
                    <div className="users-management-view">
                        <DashboardPageHeader
                            badge="Directory"
                            title="Manage"
                            accent="users"
                            subtitle="Search, review, and moderate accounts across all subscription tiers."
                        />
                        <div className="stats-grid mini">
                            <div className="stat-card mini">
                                <div className="stat-icon purple"><i className="bi bi-people-fill"></i></div>
                                <div className="stat-info"><h3>{users.length}</h3><p>Total Database</p></div>
                            </div>
                            <div className="stat-card mini">
                                <div className="stat-icon green"><i className="bi bi-star-fill"></i></div>
                                <div className="stat-info"><h3>{users.filter(u => u.subscription?.plan !== 'free').length}</h3><p>Premium Users</p></div>
                            </div>
                            <div className="stat-card mini">
                                <div className="stat-icon blue"><i className="bi bi-shield-lock-fill"></i></div>
                                <div className="stat-info"><h3>{users.filter(u => u.twoFactorEnabled).length}</h3><p>2FA Enabled</p></div>
                            </div>
                        </div>

                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <h3>Active User Directory</h3>
                                <div className="search-box">
                                    <i className="bi bi-search"></i>
                                    <input type="text" placeholder="Search by name or email..." value={adminUserSearch} onChange={(e) => setAdminUserSearch(e.target.value)} />
                                </div>
                            </div>
                        <div className="activity-table-wrapper" style={{ overflowX: 'auto', display: 'block', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                            <table className="admin-table" style={{ width: 'max-content', minWidth: '1000px', tableLayout: 'auto' }}>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Subscription</th>
                                        <th>Security</th>
                                        <th>Joined</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedAdminUsers.map(user => (
                                        <tr key={user._id}>
                                            <td><div className="user-name-cell"><div className="user-avatar-sm" style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', boxShadow: '0 4px 10px rgba(79, 70, 229, 0.3)' }}>{user.fullName.charAt(0)}</div>{user.fullName}</div></td>
                                            <td>{user.email}</td>
                                            <td><span className={`badge-plan ${user.subscription?.plan || 'free'}`}>{user.subscription?.plan?.toUpperCase() || 'FREE'}</span></td>
                                            <td>{user.twoFactorEnabled ? <span className="status-shield secured"><i className="bi bi-shield-check"></i> 2FA</span> : <span className="status-shield unsecured">Standard</span>}</td>
                                            <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <div className="action-btn-group">
                                                    <button className="action-btn-premium view" title="User History" onClick={() => viewUserScans(user._id)}>
                                                        <i className="bi bi-eye-fill"></i>
                                                    </button>
                                                    <button className="action-btn-premium delete" title="Delete User" onClick={() => handleDeleteUser(user._id)}>
                                                        <i className="bi bi-trash3-fill"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="table-pagination-premium">
                                <span className="pg-info">Page {adminUserPage} of {Math.ceil(filteredAdminUsers.length / pageSize) || 1}</span>
                                <div className="pg-btns-group">
                                    <button disabled={adminUserPage === 1} onClick={() => setAdminUserPage(adminUserPage - 1)} className="pg-btn" title="Previous"><i className="bi bi-arrow-left-circle-fill"></i></button>
                                    <button disabled={adminUserPage >= Math.ceil(filteredAdminUsers.length / pageSize)} onClick={() => setAdminUserPage(adminUserPage + 1)} className="pg-btn" title="Next"><i className="bi bi-arrow-right-circle-fill"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

                {currentTab === "notifications" && (
                    <>
                    <DashboardPageHeader
                        badge="Broadcast"
                        title="System"
                        accent="broadcast"
                        subtitle="Send targeted or platform-wide notifications to all HackSentinel users."
                    />
                    <div className="card">
                        <h3><i className="bi bi-megaphone me-2"></i> System Broadcast</h3>
                        <div className="notification-form">
                            <div className="form-group"><label>Broadcast Title</label><input type="text" value={notificationTitle} onChange={(e) => setNotificationTitle(e.target.value)} placeholder="Title..." /></div>
                            <div className="form-group"><label>Broadcast Message</label><textarea value={notificationMessage} onChange={(e) => setNotificationMessage(e.target.value)} rows={4} placeholder="Content..."></textarea></div>
                            <div className="form-group"><label>Target Audience</label>
                                <select className="form-select" value={targetType} onChange={(e: any) => setTargetType(e.target.value)}>
                                    <option value="all">Everyone</option>
                                    <option value="specific">Targeted Users</option>
                                    <option value="group">By Plan</option>
                                </select>
                            </div>
                            {targetType === 'group' && (
                                <div className="form-group">
                                    <label>Select Target Plan</label>
                                    <select className="form-select" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                                        <option value="">Choose a plan...</option>
                                        <option value="free">Free Users</option>
                                        <option value="professional">Professional Users</option>
                                        <option value="enterprise">Enterprise Users</option>
                                    </select>
                                </div>
                            )}
                            {targetType === 'specific' && (
                                <div className="user-selector-box">
                                    <div className="selector-search"><input type="text" placeholder="Search..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} /></div>
                                    <div className="selector-list">{usersList.filter(u => u.fullName.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                                        <div key={u.id} className="selector-item"><label><input type="checkbox" checked={selectedUsers.includes(u.id)} onChange={(e) => e.target.checked ? setSelectedUsers([...selectedUsers, u.id]) : setSelectedUsers(selectedUsers.filter(id => id !== u.id))} /> {u.fullName}</label></div>
                                    ))}</div>
                                </div>
                            )}
                            <div className="form-group"><label>Image Attachment</label><input type="file" onChange={handleImageSelect} className="form-control" />{imagePreview && <img src={imagePreview} style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '8px' }} />}</div>
                            <button className="submit-btn" onClick={handleSendNotification} disabled={loading}>{loading ? "Sending..." : "Send Broadcast"}</button>
                        </div>
                    </div>
                    </>
                )}

                {currentTab === "history" && (
                    <>
                    <DashboardPageHeader
                        badge="Audit"
                        title="System"
                        accent="audit vault"
                        subtitle="Chronological log of platform activity across users and scans."
                    />
                    <div className="card">
                        <div className="section-header-flex">
                            <h3><i className="bi bi-journal-text me-2"></i> System Audit Vault</h3>
                            <div className="action-btns">
                                <button className="btn-tab-small active">Historical Timeline</button>
                                <button className="btn-tab-small" onClick={() => setCurrentTab("users")}>Categorical Audit</button>
                            </div>
                        </div>
                        <div className="activity-table-wrapper" style={{ overflowX: 'auto', display: 'block', width: '100%', WebkitOverflowScrolling: 'touch' }}>
                            <table className="admin-table" style={{ width: 'max-content', minWidth: '1000px', tableLayout: 'auto', whiteSpace: 'nowrap' }}>
                                <thead>
                                    <tr>
                                        <th>Date & Time</th>
                                        <th>Target / URL</th>
                                        <th>Initiated By</th>
                                        <th>Vulnerabilities</th>
                                        <th>Security Status</th>
                                        <th>Audit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentActivity.length > 0 ? recentActivity.slice((historyPage - 1) * pageSize, historyPage * pageSize).map((scan: any) => (
                                        <tr key={scan._id}>
                                            <td>
                                                <div className="time-cell">
                                                    <span className="d-block">{new Date(scan.scanDate).toLocaleDateString()}</span>
                                                    <small className="text-muted">{new Date(scan.scanDate).toLocaleTimeString()}</small>
                                                </div>
                                            </td>
                                            <td><code>{scan.targetUrl}</code></td>
                                            <td><div className="user-email-pill">{scan.userEmail}</div></td>
                                            <td><span className="vuln-indicator">{scan.activeScan?.findings?.length || scan.vulnerabilityCount || 0} Issues</span></td>
                                            <td><span className={`status-badge ${scan.status || 'completed'}`}>{scan.status?.toUpperCase() || 'COMPLETED'}</span></td>
                                            <td>
                                                <div className="action-btn-group">
                                                    <button className="action-btn-premium view" title="View Detailed Report" onClick={() => { setSelectedUserScans({ scans: [scan], user: { fullName: scan.userEmail, email: scan.userEmail } }); setShowScanModal(true); }}>
                                                        <i className="bi bi-eye-fill"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : <tr><td colSpan={6} className="text-center p-4">No activity logs found.</td></tr>}
                                </tbody>
                            </table>
                            <div className="table-pagination-premium">
                                <span className="pg-info">Page {historyPage} of {Math.ceil(recentActivity.length / pageSize) || 1}</span>
                                <div className="pg-btns-group">
                                    <button disabled={historyPage === 1} onClick={() => setHistoryPage(historyPage - 1)} className="pg-btn" title="Previous"><i className="bi bi-arrow-left-circle-fill"></i></button>
                                    <button disabled={historyPage >= Math.ceil(recentActivity.length / pageSize)} onClick={() => setHistoryPage(historyPage + 1)} className="pg-btn" title="Next"><i className="bi bi-arrow-right-circle-fill"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </>
                )}

                {currentTab === "settings" && (
                    <div className="settings-container">
                        <DashboardPageHeader
                            badge="Preferences"
                            title="Account"
                            accent="settings"
                            subtitle="Update your admin email and security credentials."
                        />
                        <div className="card"><h3><i className="bi bi-person-badge-fill me-2"></i> Administrative Identity</h3><div className="settings-form"><div className="form-group"><label>Admin Email</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div><button className="submit-btn" onClick={handleUpdateEmail}>Save Changes</button></div></div>
                        <div className="card"><h3><i className="bi bi-shield-lock-fill me-2"></i> Security Protocol</h3><div className="settings-form"><div className="form-group"><label>New Password</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div><button className="submit-btn danger" onClick={handleUpdatePassword}>Reset Password</button></div></div>
                    </div>
                )}
                </>
            )}
        </main>

            {showScanModal && selectedUserScans && (
                <div className="modal-overlay" onClick={() => setShowScanModal(false)}>
                    <div className="modal-content wide" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowScanModal(false)}>&times;</button>
                        <div className="modal-header-premium">
                            <h3>{selectedUserScans.user.fullName}'s Audit Trail</h3>
                            <p>{selectedUserScans.user.email}</p>
                        </div>
                        <div className="modal-body">
                            <div className="activity-table-wrapper">
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Target URL</th>
                                            <th>Date & Time</th>
                                            <th>Status</th>
                                            <th>Issues</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedUserScans.scans.length > 0 ? (
                                            selectedUserScans.scans.slice((modalPage - 1) * modalPageSize, modalPage * modalPageSize).map((scan: any) => (
                                                <tr key={scan._id}>
                                                    <td><code>{scan.targetUrl}</code></td>
                                                    <td>{new Date(scan.scanDate).toLocaleString()}</td>
                                                    <td><span className={`status-badge ${scan.status || 'completed'}`}>{scan.status?.toUpperCase() || 'COMPLETED'}</span></td>
                                                    <td><span className="vuln-count-sm">{scan.activeScan?.findings?.length || 0} Issues</span></td>
                                                    <td>
                                                        <button className="action-btn-premium delete" title="Delete Record" onClick={() => deleteScan(scan._id)}>
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr><td colSpan={5} className="text-center p-4">No activity logs yet.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {selectedUserScans.scans.length > modalPageSize && (
                                <div className="table-pagination-premium">
                                    <span className="pg-info">Showing {Math.min(selectedUserScans.scans.length, (modalPage - 1) * modalPageSize + 1)} - {Math.min(selectedUserScans.scans.length, modalPage * modalPageSize)} of {selectedUserScans.scans.length} logs</span>
                                    <div className="pg-btns-group">
                                        <button disabled={modalPage === 1} onClick={() => setModalPage(modalPage - 1)} className="pg-btn"><i className="bi bi-arrow-left-circle-fill"></i></button>
                                        <button disabled={modalPage >= Math.ceil(selectedUserScans.scans.length / modalPageSize)} onClick={() => setModalPage(modalPage + 1)} className="pg-btn"><i className="bi bi-arrow-right-circle-fill"></i></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showCropModal && cropSrc && (
                <div className="modal-overlay" onClick={() => setShowCropModal(false)}>
                    <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
                        <div className="p-4"><h3>Crop Image</h3><ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={1}><img ref={ref => setImgRef(ref)} src={cropSrc} alt="Crop" style={{ maxWidth: '100%' }} /></ReactCrop><div className="mt-4"><button className="submit-btn" onClick={handleCropComplete}>Apply</button></div></div>
                    </div>
                </div>
            )}

            <Chatbot position="bottom-right" />
        </div>
    );
};

export default AdminDashboard;
