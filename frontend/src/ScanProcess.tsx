import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./ScanProcess.css";
import profilePic from "./assets/profile.jpg";

// Types
interface PredictionResult {
  name: string;
  confidence: number;
  percentage?: number;
  risk_level?: string;
  reasons?: string[];
  evidence_count?: number;
}

interface ExposedPath {
  path: string;
  status: number;
}

interface SslInfo {
  enabled: boolean;
  protocol: string;
  cipher: string;
  cert_expiry_days: number | null;
  cert_cn: string;
  san_domains: string[];
  self_signed: boolean;
  weak_protocol: boolean;
  issues: string[];
}
interface CorsResult {
  misconfigured: boolean;
  allow_origin: string;
  allow_credentials: boolean;
  details: string;
}
interface JsSecret {
  type: string;
  file: string;
  sample: string;
}
interface OpenPort {
  port: number;
  service: string;
  vuln_signal: string;
}
interface ClickjackingResult {
  vulnerable: boolean;
  x_frame_options: string | null;
  csp_frame_ancestors: boolean;
}
interface CspAnalysis {
  present: boolean;
  quality: string;
  issues: string[];
  score: number;
  value?: string;
}
interface HttpMethods {
  allowed_methods: string[];
  dangerous: string[];
  issues: string[];
}
interface CookieInfo {
  name: string;
  httponly: boolean;
  secure: boolean;
  samesite: string | null;
}
interface CookieAnalysis {
  cookies: CookieInfo[];
  issues: string[];
}
interface ContentTypeAnalysis {
  issues: string[];
}

interface PassiveScanResponse {
  scanId: string;
  target: string;
  status_code: number | null;
  headers: Record<string, string>;
  tech_stack: string[];
  meta_generator: string;
  missing_headers: string[];
  server_info: string;
  exposed_paths: ExposedPath[];
  robots_disallowed: string[];
  predictions: PredictionResult[];
  severity_prediction: { name: string; confidence: number };
  scan_duration: number;
  risk_score?: number;
  waf_detected?: string | null;
  ssl_info?: SslInfo;
  cors_result?: CorsResult;
  clickjacking?: ClickjackingResult;
  csp_analysis?: CspAnalysis;
  http_methods?: HttpMethods;
  cookie_analysis?: CookieAnalysis;
  content_type_analysis?: ContentTypeAnalysis;
  js_secrets?: JsSecret[];
  open_ports?: OpenPort[];
}

interface Methodology {
  name: string;
  vulnerability: string;
  url: string;
  payload: string;
  status: 'pass' | 'fail' | 'potential';
  evidence?: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const TIMELINE_STEPS = [
  { label: "Connecting to target...",         sublabel: "HTTP HEAD + GET, SSL/TLS handshake" },
  { label: "Probing & fingerprinting...",     sublabel: "28 paths, WAF/CDN, tech detection, CORS check" },
  { label: "Scanning JS files & ports...",    sublabel: "Secret scanner, 21 common port checks" },
  { label: "Running AI prediction model...",  sublabel: "XGBoost + LightGBM ensemble + rule overrides" },
];

const ScanProcess: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get data from navigation
  const targetUrl = location.state?.targetUrl || "Unknown URL";

  // Scan Phase States
  const [currentPhase, setCurrentPhase] = useState<'passive' | 'results' | 'decision' | 'active' | 'completed'>('passive');
  const [currentStep, setCurrentStep] = useState(0);
  const [passiveScanData, setPassiveScanData] = useState<PassiveScanResponse | null>(null);
  const [passiveError, setPassiveError] = useState<string | null>(null);
  const [passiveComplete, setPassiveComplete] = useState(false);

  const [selectedPredictions, setSelectedPredictions] = useState<string[]>([]);

  const [activeProgress, setActiveProgress] = useState(0);
  const [activeMethodologies, setActiveMethodologies] = useState<Methodology[]>([]);
  const [activeComplete, setActiveComplete] = useState(false);
  const [activeError, setActiveError] = useState<string | null>(null);

  // AI model status
  const [ollamaStatus, setOllamaStatus] = useState<{
    available: boolean;
    models: { llama3: boolean; 'hacksentinel-8b': boolean };
    python_api: boolean;
  } | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // UI States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Report States
  const [reportGenerated, setReportGenerated] = useState(false);
  const [reportFileName, setReportFileName] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [lastReportId, setLastReportId] = useState<string | null>(null);

  // Compute progress from currentStep
  const passiveProgress = passiveComplete ? 100 : Math.min((currentStep / TIMELINE_STEPS.length) * 100, 90);

  // PHASE 1: PASSIVE SCANNING - Animated timeline + real API call
  useEffect(() => {
    if (currentPhase !== 'passive' || passiveComplete) return;

    // Step animation timers
    const stepTimers = [
      setTimeout(() => setCurrentStep(1), 0),
      setTimeout(() => setCurrentStep(2), 1200),
      setTimeout(() => setCurrentStep(3), 2800),
      setTimeout(() => setCurrentStep(4), 4200),
    ];

    // Make real API call
    const token = localStorage.getItem("hs_auth_token");
    fetch(`${API_BASE}/api/scan/passive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ url: targetUrl }),
    })
      .then(async (resp) => {
        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          throw new Error(errData.message || `Scan failed (${resp.status})`);
        }
        return resp.json();
      })
      .then((data: PassiveScanResponse) => {
        setPassiveScanData(data);
        setPassiveComplete(true);
        setCurrentStep(TIMELINE_STEPS.length);

        // Pre-select predictions with confidence > 30%
        const preSelected = data.predictions
          .filter(p => p.confidence > 0.3)
          .map(p => p.name);
        setSelectedPredictions(preSelected);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        setReportFileName(`passive_scan_${timestamp}.json`);

        // Auto-transition to results after a brief pause
        setTimeout(() => setCurrentPhase('results'), 800);
      })
      .catch((err) => {
        setPassiveError(err.message);
        setPassiveComplete(true);
        setCurrentStep(TIMELINE_STEPS.length);
      });

    return () => stepTimers.forEach(t => clearTimeout(t));
  }, [currentPhase, passiveComplete, targetUrl]);

  // Fetch Ollama/AI status when entering decision phase
  useEffect(() => {
    if (currentPhase !== 'decision' && currentPhase !== 'results') return;
    if (ollamaStatus !== null) return;
    const token = localStorage.getItem("hs_auth_token");
    fetch(`${API_BASE}/api/scan/ai-status`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setOllamaStatus(data); })
      .catch(() => {});
  }, [currentPhase, ollamaStatus]);

  // ACTIVE SCANNING - Real API call to Python active scanner
  const handleStartActiveScanning = async () => {
    setCurrentPhase('active');
    setActiveProgress(10);

    const token = localStorage.getItem("hs_auth_token");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 900000); // 15 minutes for active scan

    try {
      const response = await fetch(`${API_BASE}/api/scan/active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scanId: passiveScanData?.scanId,
          url: targetUrl,
          categories: selectedPredictions,
          tech_stack: passiveScanData?.tech_stack || [],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      setActiveProgress(50);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || errData.detail || `Active scan failed (${response.status})`);
      }

      const data = await response.json();
      setActiveProgress(90);

      // Map findings to Methodology[] format for existing UI
      const methodologies: Methodology[] = (data.findings || []).map((f: any) => ({
        name: f.description || `Vulnerability found in ${f.category}`,
        vulnerability: f.category,
        url: f.url,
        payload: f.payload,
        status: f.status === 'CONFIRMED' ? 'fail' : (f.status === 'POTENTIAL' ? 'potential' : 'pass'),
        evidence: f.evidence,
      }));

      setActiveMethodologies(methodologies);
      setActiveProgress(100);
      setActiveComplete(true);
      setCurrentPhase('completed');

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      setReportFileName(`full_scan_report_${timestamp}.pdf`);
      setReportFileName(`full_scan_report_${timestamp}.pdf`);
      setReportGenerated(true);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Active scan failed:', err);
      setActiveError(err.name === 'AbortError' ? "Scan timed out (15 mins). The engine might still be working in background. Check 'Scan History' later." : (err.message || "An unexpected error occurred during the active scan."));
      setActiveProgress(100);
      setActiveComplete(true);
      // Don't transition to completed if it's a real error, stay in 'active' to show error
      if (err.name === 'AbortError') {
         setCurrentPhase('completed');
         const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
         setReportFileName(`timeout_scan_${timestamp}.json`);
      }
    }
  };

  // REPORT GENERATION
  const handleDownloadReport = async (format: string) => {
    if (!passiveScanData?.scanId) return;
    setReportLoading(true);

    try {
      const token = localStorage.getItem("hs_auth_token");
      const apiFormat = format === 'word' ? 'docx' : format;

      const resp = await fetch(`${API_BASE}/api/report/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scanId: passiveScanData.scanId, format: apiFormat }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to generate report");
      }

      const data = await resp.json();
      setLastReportId(data.reportId);
      setReportFileName(data.fileName);
      setReportGenerated(true);

      // Trigger download
      const downloadResp = await fetch(`${API_BASE}${data.downloadUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!downloadResp.ok) throw new Error("Failed to download file");
      
      const blob = await downloadResp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Report generation failed:", err);
      alert(`Report error: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleViewReport = async () => {
    if (!passiveScanData?.scanId) return;
    setReportLoading(true);

    try {
      const token = localStorage.getItem("hs_auth_token");

      // If we already have a report, view it directly
      if (lastReportId) {
        const viewResp = await fetch(`${API_BASE}/api/report/view/${lastReportId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!viewResp.ok) {
          throw new Error("Failed to load report for viewing");
        }
        const blob = await viewResp.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setReportLoading(false);
        return;
      }

      // Generate PDF first, then view
      const resp = await fetch(`${API_BASE}/api/report/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scanId: passiveScanData.scanId, format: "pdf" }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to generate report");
      }

      const data = await resp.json();
      setLastReportId(data.reportId);
      setReportFileName(data.fileName);
      setReportGenerated(true);

      const viewResp = await fetch(`${API_BASE}${data.viewUrl}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!viewResp.ok) {
        throw new Error("Failed to load report for viewing");
      }
      const blob = await viewResp.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (err: any) {
      console.error("Report view failed:", err);
      alert(`Report view failed: ${err.message}`);
    } finally {
      setReportLoading(false);
    }
  };

  const handleBackToDashboard = (tab?: string) => {
    navigate('/dashboard', { state: { tab: tab || 'dashboard' } });
  };

  // Toggle prediction selection
  const togglePrediction = (name: string) => {
    setSelectedPredictions(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]
    );
  };

  // Helper: get confidence bar color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return '#ef4444';
    if (confidence >= 0.6) return '#f97316';
    if (confidence >= 0.4) return '#eab308';
    return '#10b981';
  };

  // Helper: get severity badge color
  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#3b82f6';
      default: return '#64748b';
    }
  };

  const isScanInProgress = currentPhase === 'passive' || currentPhase === 'active';

  return (
    <div className="dashboard-layout">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="sidebar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
          <h2>{sidebarOpen ? "HackSentinel" : "HS"}</h2>
        </div>
        <ul className="sidebar-menu">
          <li onClick={() => handleBackToDashboard('dashboard')}>
            <i className="bi bi-speedometer2 me-2"></i> {sidebarOpen && "Dashboard"}
          </li>
          <li className="active">
            <i className="bi bi-radar me-2"></i> {sidebarOpen && "Scan Process"}
          </li>
          <li onClick={() => handleBackToDashboard('history')}>
            <i className="bi bi-clock-history me-2"></i> {sidebarOpen && "Scan History"}
          </li>
          <li onClick={() => handleBackToDashboard('help')}>
            <i className="bi bi-question-circle me-2"></i> {sidebarOpen && "Help"}
          </li>
          <li onClick={() => handleBackToDashboard('settings')}>
            <i className="bi bi-gear-fill me-2"></i> {sidebarOpen && "Settings"}
          </li>
          <li onClick={() => handleBackToDashboard('plans')}>
            <i className="bi bi-trophy-fill me-2"></i> {sidebarOpen && "Subscription"}
          </li>
          <li onClick={() => handleBackToDashboard('reports')}>
            <i className="bi bi-file-earmark-text me-2"></i> {sidebarOpen && "Reports"}
          </li>
          <li onClick={() => handleBackToDashboard('chatHistory')}>
            <i className="bi bi-chat-left-dots-fill me-2"></i> {sidebarOpen && "Chat History"}
          </li>
          <li onClick={() => handleBackToDashboard('notifications')}>
            <i className="bi bi-bell-fill me-2"></i> {sidebarOpen && "Notifications"}
          </li>
          {sidebarOpen && (
            <li className="logout" onClick={() => navigate("/signin")}>
              <i className="bi bi-box-arrow-right me-2"></i> Logout
            </li>
          )}
        </ul>
      </aside>



      {/* MAIN CONTENT */}
      <main className={`main-content ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`} style={{ marginTop: 0, paddingTop: 0 }}>
        {/* TOPBAR MOVED INSIDE FOR SCROLLING */}
        <header className="topbar" style={{ position: 'static', width: '100%', left: 0, padding: '0 2rem', marginBottom: '1rem', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <i className="bi bi-list"></i>
          </button>
          <div className="topbar-left">
            <p className="subtitle">Ethical AI Vulnerability Scanner</p>
          </div>
          <div className="topbar-right">
            <img
              src={profilePic}
              alt="Profile"
              className="profile-avatar-img"
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            />
            {profileMenuOpen && (
              <div className="profile-dropdown">
                <button className="logout-btn" onClick={() => navigate("/signin")}>
                  <i className="bi bi-box-arrow-right me-2"></i> Logout
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="scan-process-container">
          {/* Back Button */}
          <button className="sp-back-btn" onClick={() => handleBackToDashboard()}>
            <i className="bi bi-arrow-left"></i>
            Back to Dashboard
          </button>

          {/* Scan Header */}
          <div className="sp-header">
            <h2>
              <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '40px', height: '40px', objectFit: 'contain', marginRight: '10px', verticalAlign: 'middle' }} />
              Vulnerability Scan {currentPhase === 'completed' ? 'Complete' : 'In Progress'}
            </h2>
            <p><strong>Target:</strong> {targetUrl}</p>
            <p><strong>Phase:</strong> {currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)}</p>
          </div>

          {/* Overall Progress Bar */}
          <div>
            <div className="sp-progress-bar-wrap">
              <div
                className={`sp-progress-bar-fill ${passiveComplete && !passiveError ? 'complete' : ''}`}
                style={{ width: `${currentPhase === 'active' || currentPhase === 'completed' ? activeProgress : passiveProgress}%` }}
              ></div>
            </div>
            <div className="sp-progress-text">
              <span>
                {currentPhase === 'passive' && !passiveComplete && 'Scanning...'}
                {currentPhase === 'passive' && passiveComplete && passiveError && 'Error'}
                {currentPhase === 'results' && 'Passive scan complete'}
                {currentPhase === 'decision' && 'Select vulnerabilities'}
                {currentPhase === 'active' && 'Active testing...'}
                {currentPhase === 'completed' && 'All done'}
              </span>
              <span>
                {currentPhase === 'active' || currentPhase === 'completed'
                  ? `${Math.round(activeProgress)}%`
                  : `${Math.round(passiveProgress)}%`
                }
              </span>
            </div>
          </div>

          {/* ===================== PASSIVE PHASE — Animated Timeline ===================== */}
          {currentPhase === 'passive' && (
            <div className="sp-card">
              <h3>
                <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '24px', height: '24px', objectFit: 'contain', marginRight: '8px' }} />
                Passive Scanning {passiveComplete ? 'Complete' : 'in Progress'}
              </h3>

              <div className="sp-timeline">
                <div
                  className="sp-timeline-connector"
                  style={{ 
                    height: `${Math.min((currentStep / TIMELINE_STEPS.length) * 100, 100)}%`,
                    boxShadow: '0 0 15px var(--primary)',
                    background: 'var(--primary)'
                  }}
                ></div>
                {TIMELINE_STEPS.map((step, idx) => {
                  const stepNum = idx + 1;
                  const isDone = currentStep > stepNum || (passiveComplete && !passiveError);
                  const isActive = currentStep === stepNum && !passiveComplete;
                  const isPending = currentStep < stepNum;

                  return (
                    <div
                      key={idx}
                      className={`sp-timeline-step ${isDone ? 'done' : isActive ? 'active' : 'pending'} ${currentStep >= stepNum ? 'visible' : ''}`}
                      style={{ transitionDelay: `${idx * 0.15}s` }}
                    >
                      <div className={`sp-timeline-icon ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}>
                        {isDone ? (
                          <i className="bi bi-check-lg"></i>
                        ) : isActive ? (
                          <div className="sp-step-spinner"></div>
                        ) : (
                          <span>{stepNum}</span>
                        )}
                      </div>
                      <div className="sp-step-label">{step.label}</div>
                      <div className="sp-step-sublabel">{step.sublabel}</div>
                    </div>
                  );
                })}
              </div>

              {/* Error State */}
              {passiveComplete && passiveError && (
                <div className="sp-error">
                  <h4>
                    <i className="bi bi-exclamation-triangle-fill"></i>
                    Scan Error
                  </h4>
                  <p>{passiveError}</p>
                  <p className="sp-error-hint">
                    Make sure the Python prediction API is running on port 8000.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ===================== RESULTS PHASE ===================== */}
          {currentPhase === 'results' && passiveScanData && (
            <div className="sp-results">
              <div className="sp-card">
                <h3>
                  <i className="bi bi-clipboard-data" style={{ color: '#7c3aed' }}></i>
                  Scan Results
                </h3>

                {/* Risk Score Gauge */}
                {passiveScanData.risk_score !== undefined && (
                  <div className="sp-risk-gauge-wrap">
                    <div className="sp-risk-gauge-label">
                      <span>Overall Risk Score</span>
                      <span className="sp-risk-gauge-value" style={{
                        color: passiveScanData.risk_score >= 61 ? '#ef4444'
                             : passiveScanData.risk_score >= 31 ? '#f97316' : '#10b981'
                      }}>{passiveScanData.risk_score}/100</span>
                    </div>
                    <div className="sp-risk-gauge-track">
                      <div className="sp-risk-gauge-fill" style={{
                        width: `${passiveScanData.risk_score}%`,
                        background: passiveScanData.risk_score >= 61 ? '#ef4444'
                                  : passiveScanData.risk_score >= 31 ? '#f97316' : '#10b981',
                      }} />
                    </div>
                    <div className="sp-risk-gauge-labels">
                      <span style={{ color: '#10b981' }}>LOW</span>
                      <span style={{ color: '#f97316' }}>MEDIUM</span>
                      <span style={{ color: '#ef4444' }}>HIGH</span>
                    </div>
                  </div>
                )}

                {/* Summary Stats Bar */}
                <div className="sp-summary-bar">
                  <div className="sp-summary-stat">
                    <span className="stat-value">{passiveScanData.tech_stack.length}</span>
                    <span className="stat-label">Technologies</span>
                  </div>
                  <div className="sp-summary-stat">
                    <span className="stat-value">{passiveScanData.missing_headers.length}</span>
                    <span className="stat-label">Missing Headers</span>
                  </div>
                  <div className="sp-summary-stat">
                    <span className="stat-value">{passiveScanData.exposed_paths?.length ?? 0}</span>
                    <span className="stat-label">Exposed Paths</span>
                  </div>
                  <div className="sp-summary-stat">
                    <span className="stat-value">
                      {passiveScanData.predictions.filter(p => p.confidence > 0.3).length}
                    </span>
                    <span className="stat-label">High-Confidence Predictions</span>
                  </div>
                  {(passiveScanData.open_ports?.length ?? 0) > 0 && (
                    <div className="sp-summary-stat" style={{ borderColor: '#ef4444' }}>
                      <span className="stat-value" style={{ color: '#ef4444' }}>{passiveScanData.open_ports!.length}</span>
                      <span className="stat-label">Open Ports</span>
                    </div>
                  )}
                  {(passiveScanData.js_secrets?.length ?? 0) > 0 && (
                    <div className="sp-summary-stat" style={{ borderColor: '#ef4444' }}>
                      <span className="stat-value" style={{ color: '#ef4444' }}>{passiveScanData.js_secrets!.length}</span>
                      <span className="stat-label">JS Secrets Exposed</span>
                    </div>
                  )}
                </div>

                {/* Info Cards Grid */}
                <div className="sp-info-cards">
                  {/* Tech Stack Card */}
                  {passiveScanData.tech_stack.length > 0 && (
                    <div className="sp-info-card tech">
                      <h5>
                        <i className="bi bi-cpu"></i>
                        Tech Stack Detected
                      </h5>
                      {passiveScanData.meta_generator && (
                        <p style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '8px' }}>
                          <i className="bi bi-info-circle"></i> {passiveScanData.meta_generator}
                        </p>
                      )}
                      <div className="sp-tag-list">
                        {passiveScanData.tech_stack.map((tech, idx) => (
                          <span key={idx} className="sp-tag tech-tag">{tech}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Missing Headers Card */}
                  {passiveScanData.missing_headers.length > 0 && (
                    <div className="sp-info-card headers">
                      <h5>
                        <i className="bi bi-shield-exclamation"></i>
                        Missing Security Headers ({passiveScanData.missing_headers.length})
                      </h5>
                      <div className="sp-tag-list">
                        {passiveScanData.missing_headers.map((header, idx) => (
                          <span key={idx} className="sp-tag header-tag">{header}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exposed Paths Card */}
                  {(passiveScanData.exposed_paths?.length > 0 || passiveScanData.robots_disallowed?.length > 0) && (
                    <div className="sp-info-card" style={{ borderColor: '#ef4444' }}>
                      <h5>
                        <i className="bi bi-folder2-open" style={{ color: '#ef4444' }}></i>
                        Exposed Paths ({passiveScanData.exposed_paths?.length ?? 0})
                      </h5>
                      <div className="sp-tag-list">
                        {passiveScanData.exposed_paths?.map((ep, idx) => (
                          <span key={idx} className="sp-tag" style={{
                            background: ep.status === 200 ? 'rgba(239,68,68,0.15)' : 'rgba(251,146,60,0.15)',
                            color: ep.status === 200 ? '#ef4444' : '#fb923c',
                            border: `1px solid ${ep.status === 200 ? '#ef4444' : '#fb923c'}`,
                          }}>
                            {ep.path} <span style={{ opacity: 0.7 }}>[{ep.status}]</span>
                          </span>
                        ))}
                      </div>
                      {passiveScanData.robots_disallowed?.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '6px' }}>
                            robots.txt Sensitive Disallows:
                          </p>
                          <div className="sp-tag-list">
                            {passiveScanData.robots_disallowed.map((p, idx) => (
                              <span key={idx} className="sp-tag" style={{
                                background: 'rgba(251,146,60,0.1)', color: '#fb923c',
                                border: '1px solid #fb923c',
                              }}>{p}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Server Info Card */}
                  {passiveScanData.server_info && (
                    <div className="sp-info-card server">
                      <h5><i className="bi bi-hdd-rack"></i> Server</h5>
                      <p className="sp-server-value">{passiveScanData.server_info}</p>
                      {passiveScanData.status_code && (
                        <p className="sp-server-status">Status: {passiveScanData.status_code}</p>
                      )}
                    </div>
                  )}

                  {/* WAF Card */}
                  {passiveScanData.waf_detected !== undefined && (
                    <div className="sp-info-card" style={{ borderColor: passiveScanData.waf_detected ? '#10b981' : '#475569' }}>
                      <h5><i className="bi bi-shield-fill-check"></i> WAF / CDN</h5>
                      {passiveScanData.waf_detected
                        ? <span className="sp-tag" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>
                            <i className="bi bi-shield-check"></i> {passiveScanData.waf_detected} detected
                          </span>
                        : <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>No WAF detected — active testing may succeed</span>
                      }
                    </div>
                  )}

                  {/* SSL Card */}
                  {passiveScanData.ssl_info?.enabled && (
                    <div className="sp-info-card" style={{ borderColor: passiveScanData.ssl_info.issues.length ? '#f97316' : '#10b981' }}>
                      <h5><i className="bi bi-lock-fill"></i> SSL / TLS</h5>
                      <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0' }}>
                        Protocol: <strong style={{ color: passiveScanData.ssl_info.weak_protocol ? '#ef4444' : '#10b981' }}>
                          {passiveScanData.ssl_info.protocol}
                        </strong>
                        {passiveScanData.ssl_info.cert_cn && <> | CN: {passiveScanData.ssl_info.cert_cn}</>}
                        {passiveScanData.ssl_info.cert_expiry_days !== null && (
                          <> | Expires in <strong style={{ color: (passiveScanData.ssl_info.cert_expiry_days ?? 999) < 30 ? '#ef4444' : '#10b981' }}>
                            {passiveScanData.ssl_info.cert_expiry_days}d
                          </strong></>
                        )}
                      </p>
                      {passiveScanData.ssl_info.issues.length > 0 && (
                        <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '0.8rem', color: '#f97316' }}>
                          {passiveScanData.ssl_info.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                        </ul>
                      )}
                      {(passiveScanData.ssl_info.san_domains?.length ?? 0) > 0 && (
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Attack Surface (SAN): </span>
                          <div className="sp-tag-list" style={{ marginTop: '4px' }}>
                            {passiveScanData.ssl_info.san_domains.slice(0, 8).map((d, i) => (
                              <span key={i} className="sp-tag" style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid #4f46e5', fontSize: '0.72rem' }}>{d}</span>
                            ))}
                            {passiveScanData.ssl_info.san_domains.length > 8 && (
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>+{passiveScanData.ssl_info.san_domains.length - 8} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CORS Card */}
                  {passiveScanData.cors_result?.misconfigured && (
                    <div className="sp-info-card" style={{ borderColor: '#ef4444' }}>
                      <h5><i className="bi bi-globe2" style={{ color: '#ef4444' }}></i> CORS Misconfiguration</h5>
                      <p style={{ fontSize: '0.82rem', color: '#ef4444', margin: '4px 0' }}>
                        {passiveScanData.cors_result.details}
                      </p>
                      <div className="sp-tag-list" style={{ marginTop: '6px' }}>
                        <span className="sp-tag" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>
                          Allow-Origin: {passiveScanData.cors_result.allow_origin || '*'}
                        </span>
                        {passiveScanData.cors_result.allow_credentials && (
                          <span className="sp-tag" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444' }}>
                            Allow-Credentials: true
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Open Ports Card */}
                  {(passiveScanData.open_ports?.length ?? 0) > 0 && (
                    <div className="sp-info-card" style={{ borderColor: '#ef4444' }}>
                      <h5><i className="bi bi-ethernet" style={{ color: '#ef4444' }}></i> Open Sensitive Ports ({passiveScanData.open_ports!.length})</h5>
                      <div className="sp-tag-list">
                        {passiveScanData.open_ports!.map((p, i) => (
                          <span key={i} className="sp-tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid #ef4444' }}>
                            {p.port}/{p.service}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* JS Secrets Card */}
                  {(passiveScanData.js_secrets?.length ?? 0) > 0 && (
                    <div className="sp-info-card" style={{ borderColor: '#dc2626' }}>
                      <h5><i className="bi bi-key-fill" style={{ color: '#dc2626' }}></i> Secrets Exposed in JS ({passiveScanData.js_secrets!.length})</h5>
                      {passiveScanData.js_secrets!.map((s, i) => (
                        <div key={i} style={{ marginBottom: '6px', fontSize: '0.8rem' }}>
                          <span style={{ color: '#dc2626', fontWeight: 600 }}>{s.type}</span>
                          <span style={{ color: '#94a3b8' }}> in {s.file}</span>
                          <code style={{ display: 'block', color: '#fbbf24', marginTop: '2px', wordBreak: 'break-all' }}>{s.sample}…</code>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Clickjacking Card */}
                  {passiveScanData.clickjacking?.vulnerable && (
                    <div className="sp-info-card" style={{ borderColor: '#f97316' }}>
                      <h5><i className="bi bi-layers" style={{ color: '#f97316' }}></i> Clickjacking Vulnerable</h5>
                      <p style={{ fontSize: '0.82rem', color: '#f97316', margin: '4px 0' }}>
                        X-Frame-Options missing and no CSP frame-ancestors — page can be embedded in iframes
                      </p>
                    </div>
                  )}

                  {/* CSP Quality Card */}
                  {passiveScanData.csp_analysis && (
                    <div className="sp-info-card" style={{ borderColor: passiveScanData.csp_analysis.present
                      ? (passiveScanData.csp_analysis.quality === 'strong' ? '#10b981' : passiveScanData.csp_analysis.quality === 'weak' ? '#f97316' : '#ef4444')
                      : '#ef4444' }}>
                      <h5><i className="bi bi-file-lock2" style={{ color: passiveScanData.csp_analysis.present ? '#a78bfa' : '#ef4444' }}></i> Content Security Policy</h5>
                      {passiveScanData.csp_analysis.present ? (
                        <>
                          <span className="sp-tag" style={{
                            background: passiveScanData.csp_analysis.quality === 'strong' ? 'rgba(16,185,129,0.15)' : passiveScanData.csp_analysis.quality === 'weak' ? 'rgba(249,115,22,0.15)' : 'rgba(239,68,68,0.15)',
                            color: passiveScanData.csp_analysis.quality === 'strong' ? '#10b981' : passiveScanData.csp_analysis.quality === 'weak' ? '#f97316' : '#ef4444',
                            border: `1px solid ${passiveScanData.csp_analysis.quality === 'strong' ? '#10b981' : passiveScanData.csp_analysis.quality === 'weak' ? '#f97316' : '#ef4444'}`,
                          }}>Quality: {passiveScanData.csp_analysis.quality} (score {passiveScanData.csp_analysis.score}/10)</span>
                          {passiveScanData.csp_analysis.issues.length > 0 && (
                            <ul style={{ margin: '6px 0 0', paddingLeft: '16px', fontSize: '0.78rem', color: '#f97316' }}>
                              {passiveScanData.csp_analysis.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p style={{ fontSize: '0.82rem', color: '#ef4444', margin: '4px 0' }}>CSP header absent — XSS fully unmitigated</p>
                      )}
                    </div>
                  )}

                  {/* HTTP Methods Card */}
                  {(passiveScanData.http_methods?.dangerous?.length ?? 0) > 0 && (
                    <div className="sp-info-card" style={{ borderColor: '#ef4444' }}>
                      <h5><i className="bi bi-arrow-left-right" style={{ color: '#ef4444' }}></i> Dangerous HTTP Methods</h5>
                      <div className="sp-tag-list" style={{ marginBottom: '6px' }}>
                        {passiveScanData.http_methods!.dangerous.map((m, i) => (
                          <span key={i} className="sp-tag" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid #ef4444' }}>{m}</span>
                        ))}
                      </div>
                      {passiveScanData.http_methods!.issues.length > 0 && (
                        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: '#f97316' }}>
                          {passiveScanData.http_methods!.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Cookie Security Card */}
                  {(passiveScanData.cookie_analysis?.issues?.length ?? 0) > 0 && (
                    <div className="sp-info-card" style={{ borderColor: '#f97316' }}>
                      <h5><i className="bi bi-cookie" style={{ color: '#f97316' }}></i> Cookie Security Issues ({passiveScanData.cookie_analysis!.issues.length})</h5>
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: '#f97316' }}>
                        {passiveScanData.cookie_analysis!.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Content-Type / Smuggling Card */}
                  {(passiveScanData.content_type_analysis?.issues?.length ?? 0) > 0 && (
                    <div className="sp-info-card" style={{ borderColor: '#f59e0b' }}>
                      <h5><i className="bi bi-file-earmark-x" style={{ color: '#f59e0b' }}></i> Content-Type / Smuggling ({passiveScanData.content_type_analysis!.issues.length})</h5>
                      <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.78rem', color: '#f59e0b' }}>
                        {passiveScanData.content_type_analysis!.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Security Header Scorecard */}
                  <div className="sp-info-card" style={{ borderColor: '#7c3aed', gridColumn: '1 / -1' }}>
                    <h5><i className="bi bi-card-checklist" style={{ color: '#7c3aed' }}></i> Security Header Scorecard</h5>
                    {(() => {
                      const all = ['Content-Security-Policy','Strict-Transport-Security','X-Frame-Options',
                                   'X-Content-Type-Options','X-XSS-Protection','Referrer-Policy','Permissions-Policy'];
                      const missing = new Set(passiveScanData.missing_headers);
                      const score = all.filter(h => !missing.has(h)).length;
                      const color = score >= 6 ? '#10b981' : score >= 4 ? '#f97316' : '#ef4444';
                      return (
                        <>
                          <p style={{ color, fontSize: '0.85rem', marginBottom: '8px' }}>
                            Score: <strong>{score}/{all.length}</strong> — {score >= 6 ? 'Good' : score >= 4 ? 'Fair' : 'Poor'}
                          </p>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: '4px' }}>
                            {all.map(h => (
                              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                                <i className={`bi ${missing.has(h) ? 'bi-x-circle-fill' : 'bi-check-circle-fill'}`}
                                   style={{ color: missing.has(h) ? '#ef4444' : '#10b981' }} />
                                <span style={{ color: missing.has(h) ? '#ef4444' : '#94a3b8' }}>{h}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Severity Badge Row */}
                {passiveScanData.severity_prediction && passiveScanData.severity_prediction.name !== 'unknown' && (
                  <div className="sp-severity-row">
                    <span className="sp-severity-label">Overall Severity:</span>
                    <span
                      className="sp-severity-badge"
                      style={{ background: getSeverityColor(passiveScanData.severity_prediction.name) }}
                    >
                      {passiveScanData.severity_prediction.name}
                    </span>
                    <span className="sp-severity-confidence">
                      ({(passiveScanData.severity_prediction.confidence * 100).toFixed(1)}% confidence)
                    </span>
                  </div>
                )}

                {/* Prediction Cards */}
                <h4 className="sp-predictions-title">
                  <i className="bi bi-graph-up"></i>
                  AI Vulnerability Predictions
                </h4>
                <div>
                  {passiveScanData.predictions
                    .filter(p => p.confidence > 0.01)
                    .map((prediction, idx) => (
                      <div
                        key={idx}
                        className={`sp-prediction-card ${prediction.confidence >= 0.3 ? 'high-conf' : ''}`}
                      >
                        <div className="sp-prediction-header">
                          <span className="sp-prediction-name">
                            {prediction.name.replace(/_/g, ' ')}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {/* Evidence badge: green if rule-backed, gray if ML-only */}
                            {(prediction.evidence_count ?? 0) >= 2 ? (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px',
                                background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>
                                ✓ Confirmed Signal
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px',
                                background: 'rgba(148,163,184,0.1)', color: '#64748b', border: '1px solid #334155' }}>
                                AI Suggestion
                              </span>
                            )}
                            {prediction.risk_level && (
                              <span className={`sp-risk-badge sp-risk-${prediction.risk_level}`}>
                                {prediction.risk_level.toUpperCase()}
                              </span>
                            )}
                            <span
                              className="sp-prediction-badge"
                              style={{ background: getConfidenceColor(prediction.confidence) }}
                            >
                              {(prediction.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        <div className="sp-confidence-bar-track">
                          <div
                            className="sp-confidence-bar-fill"
                            style={{
                              width: `${prediction.confidence * 100}%`,
                              background: getConfidenceColor(prediction.confidence),
                              animationDelay: `${idx * 0.1}s`
                            }}
                          ></div>
                        </div>
                        {/* Reasons Section */}
                        {prediction.reasons && prediction.reasons.length > 0 && (
                          <div className="sp-reasons-section">
                            <div className="sp-reasons-header">
                              <i className="bi bi-info-circle-fill"></i>
                              <span>Why this vulnerability was flagged ({prediction.evidence_count} evidence{(prediction.evidence_count || 0) !== 1 ? 's' : ''}):</span>
                            </div>
                            <ul className="sp-reasons-list">
                              {prediction.reasons.map((reason, rIdx) => (
                                <li key={rIdx} className="sp-reason-item">
                                  <i className="bi bi-chevron-right"></i>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                </div>

                {/* Scan Complete Banner */}
                <div className="sp-complete-banner">
                  <i className="bi bi-check-circle-fill"></i>
                  <span>
                    <strong>Passive scan complete</strong> in {passiveScanData.scan_duration}s — AI predictions ready
                  </span>
                </div>

                {/* Decision Prompt */}
                <div className="sp-decision">
                  <h4>What would you like to do next?</h4>
                  <p>
                    Our AI model has identified potential vulnerabilities. You can proceed to active
                    scanning to test them, or download the passive scan report.
                  </p>
                  <div className="sp-decision-actions">
                    <button
                      className="sp-btn-active-scan"
                      onClick={() => setCurrentPhase('decision')}
                    >
                      <i className="bi bi-lightning-charge-fill"></i>
                      Select & Start Active Scan
                    </button>
                    <button
                      className="sp-btn-download-exit"
                      onClick={() => handleDownloadReport('json')}
                    >
                      <i className="bi bi-download"></i>
                      Download Report & Exit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== DECISION PHASE — Vulnerability Selection ===================== */}
          {currentPhase === 'decision' && passiveScanData && (
            <div className="sp-card">
              <h3>
                <i className="bi bi-ui-checks-grid" style={{ color: '#7c3aed' }}></i>
                Select Vulnerabilities to Test
              </h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                Our AI model predicted the following vulnerabilities. Select which ones to actively test.
                Items with &gt;30% confidence are pre-selected.
              </p>

              <div style={{ marginBottom: '2rem' }}>
                {passiveScanData.predictions
                  .filter(p => p.confidence > 0.01)
                  .map((prediction, idx) => {
                    const isSelected = selectedPredictions.includes(prediction.name);
                    return (
                      <div
                        key={idx}
                        className={`sp-prediction-card ${isSelected ? 'high-conf' : ''}`}
                        style={{ cursor: 'pointer' }}
                      >
                        <label style={{ display: 'block', cursor: 'pointer' }}>
                          <div className="sp-prediction-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePrediction(prediction.name)}
                                style={{ width: '18px', height: '18px', accentColor: '#7c3aed', cursor: 'pointer' }}
                              />
                              <span className="sp-prediction-name">
                                {prediction.name.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {prediction.risk_level && (
                                <span className={`sp-risk-badge sp-risk-${prediction.risk_level}`}>
                                  {prediction.risk_level.toUpperCase()}
                                </span>
                              )}
                              <span
                                className="sp-prediction-badge"
                                style={{ background: getConfidenceColor(prediction.confidence) }}
                              >
                                {(prediction.confidence * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                          <div className="sp-confidence-bar-track" style={{ marginTop: '0.5rem' }}>
                            <div
                              className="sp-confidence-bar-fill"
                              style={{
                                width: `${prediction.confidence * 100}%`,
                                background: getConfidenceColor(prediction.confidence)
                              }}
                            ></div>
                          </div>
                        </label>
                        {/* Reasons Section */}
                        {prediction.reasons && prediction.reasons.length > 0 && (
                          <div className="sp-reasons-section">
                            <div className="sp-reasons-header">
                              <i className="bi bi-info-circle-fill"></i>
                              <span>Evidence ({prediction.evidence_count}):</span>
                            </div>
                            <ul className="sp-reasons-list">
                              {prediction.reasons.map((reason, rIdx) => (
                                <li key={rIdx} className="sp-reason-item">
                                  <i className="bi bi-chevron-right"></i>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* AI Model Status */}
              {ollamaStatus !== null && (
                <div style={{ marginBottom: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', background: ollamaStatus.available ? '#f0fdf4' : '#fff7ed', border: `1px solid ${ollamaStatus.available ? '#86efac' : '#fed7aa'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <i className={`bi ${ollamaStatus.available ? 'bi-cpu-fill' : 'bi-exclamation-triangle-fill'}`} style={{ color: ollamaStatus.available ? '#16a34a' : '#ea580c' }}></i>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: ollamaStatus.available ? '#15803d' : '#c2410c' }}>
                      {ollamaStatus.available ? 'AI Engine Online' : 'AI Engine Offline — Fallback Mode'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Llama 3 (Payload Gen)', key: 'llama3' as const },
                      { label: 'hacksentinel-8b (Verifier)', key: 'hacksentinel-8b' as const },
                    ].map(({ label, key }) => (
                      <span key={key} style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: ollamaStatus.models[key] ? '#dcfce7' : '#fee2e2', color: ollamaStatus.models[key] ? '#166534' : '#991b1b', border: `1px solid ${ollamaStatus.models[key] ? '#86efac' : '#fca5a5'}` }}>
                        <i className={`bi bi-circle-fill me-1`} style={{ fontSize: '0.55rem', color: ollamaStatus.models[key] ? '#22c55e' : '#ef4444' }}></i>
                        {label}
                      </span>
                    ))}
                  </div>
                  {!ollamaStatus.available && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#9a3412' }}>
                      Ollama is not running. Active scan will use hardcoded payloads without AI verification. Start Ollama and pull <code>llama3</code> + <code>hacksentinel-8b</code> for full AI-powered scanning.
                    </p>
                  )}
                </div>
              )}

              <div className="sp-decision-actions">
                <button
                  className="sp-btn-active-scan"
                  disabled={selectedPredictions.length === 0}
                  onClick={handleStartActiveScanning}
                >
                  <i className="bi bi-lightning-charge-fill"></i>
                  Start Active Scan ({selectedPredictions.length} selected)
                </button>
                <button
                  className="sp-btn-download-exit"
                  onClick={() => handleDownloadReport('json')}
                >
                  <i className="bi bi-download"></i>
                  Download Report & Exit
                </button>
              </div>
            </div>
          )}

          {/* ===================== ACTIVE SCANNING PHASE ===================== */}
          {(currentPhase === 'active' || currentPhase === 'completed') && (
            <div className="sp-active-card">
              <h3 style={{ color: '#1e1b4b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <i className="bi bi-lightning-charge-fill" style={{ color: '#ef4444' }}></i>
                Active Vulnerability Testing
              </h3>

              {/* Progress */}
              <div style={{ marginBottom: '2rem' }}>
                <div className="sp-progress-text">
                  <span>Testing methodologies...</span>
                  <span>{Math.round(activeProgress)}%</span>
                </div>
                <div className="sp-method-progress-bar">
                  <div
                    className="sp-method-progress-fill"
                    style={{
                      width: `${activeProgress}%`,
                      background: 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                    }}
                  ></div>
                </div>
              </div>

              {/* AI model active banner */}
              {ollamaStatus && (
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '6px', background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: '0.82rem', color: '#5b21b6' }}>
                  <i className="bi bi-cpu-fill"></i>
                  <span>
                    <strong>Llama 3 8B</strong> generating payloads &nbsp;|&nbsp; <strong>hacksentinel-8b</strong> verifying responses
                    {!ollamaStatus.available && <span style={{ color: '#c2410c' }}> — offline, using fallback payloads</span>}
                  </span>
                </div>
              )}

              {/* Methodology Results */}
              {activeError && (
                <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '10px', color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <i className="bi bi-exclamation-triangle-fill me-2"></i>
                  {activeError}
                </div>
              )}

              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {activeMethodologies.map((method, idx) => (
                  <div key={idx} className={`sp-active-result ${method.status}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          background: method.status === 'fail' ? '#ef4444' : (method.status === 'potential' ? '#f59e0b' : '#10b981'),
                          color: 'white'
                        }}>
                          {method.status === 'fail' ? 'CONFIRMED' : (method.status === 'potential' ? 'POTENTIAL' : 'SAFE')}
                        </span>
                        {method.status !== 'pass' && (
                          <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' }}>
                            <i className="bi bi-cpu-fill me-1" style={{ fontSize: '0.7rem' }}></i>
                            hacksentinel-8b verified
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e1b4b' }}>
                        {method.vulnerability}
                      </span>
                    </div>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                      <strong>URL:</strong> {method.url}
                    </p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                      <strong>Methodology:</strong> {method.name}
                    </p>
                    <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#64748b' }}>
                      <strong>Payload:</strong> <code style={{ background: '#f3f4f6', padding: '0.125rem 0.375rem', borderRadius: '4px' }}>{method.payload}</code>
                    </p>
                    {method.evidence && (
                      <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
                        {method.evidence}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Completion Actions */}
              {activeComplete && (
                <div style={{ marginTop: '2rem' }}>
                  <div className="sp-complete-banner">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>
                      <strong>Scan Complete!</strong>{' '}
                      {reportGenerated && reportFileName
                        ? <>Last export: <code style={{ fontSize: '0.8rem' }}>{reportFileName}</code></>
                        : 'Select a format below to export your report.'}
                      {ollamaStatus?.available && (
                        <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', color: '#7c3aed' }}>
                          | AI-powered by Llama 3 + hacksentinel-8b
                        </span>
                      )}
                    </span>
                  </div>

                  {/* New Dropdown Export Hub */}
                  <div className="sp-export-container">
                    <button 
                      className={`sp-export-dropdown-trigger ${showExportMenu ? 'active' : ''}`}
                      onClick={() => setShowExportMenu(!showExportMenu)}
                    >
                      <i className="bi bi-download"></i>
                      <span>Export Security Report</span>
                      <i className={`bi bi-chevron-${showExportMenu ? 'up' : 'down'} ms-auto`}></i>
                    </button>

                    {showExportMenu && (
                      <div className="sp-export-dropdown-menu">
                        <div className="sp-dropdown-category">Advisory Formats</div>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('pdf'); setShowExportMenu(false); }}>
                          <i className="bi bi-file-earmark-pdf text-danger"></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">Professional PDF Advisory</span>
                            <span className="sp-item-desc">Executive summary & visual risk charts</span>
                          </div>
                        </button>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('docx'); setShowExportMenu(false); }}>
                          <i className="bi bi-file-earmark-word text-primary"></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">MS Word Document</span>
                            <span className="sp-item-desc">Editable technical report for clients</span>
                          </div>
                        </button>

                        <div className="sp-dropdown-category">Bug Bounty Standards</div>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('hackerone'); setShowExportMenu(false); }}>
                          <i className="bi bi-shield-shaded" style={{ color: '#000' }}></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">HackerOne Disclosure</span>
                            <span className="sp-item-desc">Standardized triage-ready template</span>
                          </div>
                        </button>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('bugcrowd'); setShowExportMenu(false); }}>
                          <i className="bi bi-bug-fill" style={{ color: '#cc0000' }}></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">Bugcrowd Submission</span>
                            <span className="sp-item-desc">Researcher disclosure format</span>
                          </div>
                        </button>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('intigriti'); setShowExportMenu(false); }}>
                          <i className="bi bi-check-all" style={{ color: '#3b82f6' }}></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">Intigriti Advisor</span>
                            <span className="sp-item-desc">CVSS-focused security report</span>
                          </div>
                        </button>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('yeswehack'); setShowExportMenu(false); }}>
                          <i className="bi bi-lightning-fill" style={{ color: '#f59e0b' }}></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">YesWeHack Template</span>
                            <span className="sp-item-desc">VDP-compliant technical summary</span>
                          </div>
                        </button>

                        <div className="sp-dropdown-divider"></div>
                        <button className="sp-dropdown-item" onClick={() => { handleDownloadReport('json'); setShowExportMenu(false); }}>
                          <i className="bi bi-code-slash text-secondary"></i>
                          <div className="sp-item-info">
                            <span className="sp-item-title">Raw JSON Data</span>
                            <span className="sp-item-desc">Full machine-readable scan dump</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button className="sp-view-report-btn" onClick={handleViewReport} disabled={reportLoading}>
                    <i className={reportLoading ? "bi bi-hourglass-split" : "bi bi-eye"}></i>
                    {reportLoading ? "Generating..." : "View Full Report"}
                  </button>

                  <button className="sp-back-btn" onClick={() => handleBackToDashboard()} style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
                    <i className="bi bi-speedometer2"></i>
                    Return to Dashboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ScanProcess;
