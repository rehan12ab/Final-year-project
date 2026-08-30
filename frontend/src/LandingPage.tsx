import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './LandingPage.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import FaqSection from './components/FaqSection';
import PricingPreview from './components/PricingPreview';
import {
    ShieldCheck,
    Zap,
    Cpu,
    Activity,
    Lock,
    Terminal,
    ArrowRight,
    CheckCircle2,
    Search,
    AlertTriangle,
    FileCheck,
    Globe2,
    Sparkles,
    Eye,
    Code2,
    GitBranch,
    BarChart3,
    Layers,
    ChevronLeft,
    ChevronRight,
    Star,
    ScanLine,
    Network,
    KeyRound
} from 'lucide-react';

const LandingPage: React.FC = () => {
    const navigate = useNavigate();
    const [targetUrl, setTargetUrl] = useState('');
    const [simulatedScore] = useState(98);
    const [activeTab, setActiveTab] = useState<'radar' | 'payloads' | 'report'>('radar');
    const [activeCapability, setActiveCapability] = useState(0);
    const [scanProgress, setScanProgress] = useState(23);
    const [isHudHovered, setIsHudHovered] = useState(false);
    const reviewsRef = useRef<HTMLDivElement>(null);

    // Auto-cycle HUD tabs so the mockup showcases all three views; pause on hover.
    useEffect(() => {
        if (isHudHovered) return;
        const id = setInterval(() => {
            setActiveTab(prev => (prev === 'radar' ? 'payloads' : prev === 'payloads' ? 'report' : 'radar'));
        }, 4500);
        return () => clearInterval(id);
    }, [isHudHovered]);

    // Live-looking scan progress ticker that loops for a "work in progress" feel.
    useEffect(() => {
        const id = setInterval(() => {
            setScanProgress(p => (p >= 96 ? 18 : p + 1));
        }, 220);
        return () => clearInterval(id);
    }, []);

    const handleQuickScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (targetUrl) {
            navigate(`/signup?target=${encodeURIComponent(targetUrl)}`);
        } else {
            navigate('/signup');
        }
    };

    const scrollReviews = (dir: 'left' | 'right') => {
        if (reviewsRef.current) {
            const scrollAmt = 380;
            reviewsRef.current.scrollBy({ left: dir === 'left' ? -scrollAmt : scrollAmt, behavior: 'smooth' });
        }
    };

    const capabilities = [
        {
            icon: ScanLine,
            title: 'Passive Reconnaissance',
            tag: 'Recon',
            colorClass: 'indigo',
            description: 'Fingerprint a target without sending a single attack payload. HackSentinel inspects TLS configuration, security headers, WAF/CDN signatures, exposed ports, and scans your JavaScript bundle for leaked secrets — all safe for production.',
            bullets: [
                'TLS/cipher analysis and certificate expiry checks',
                'Header audit — CSP, HSTS, X-Frame-Options, referrer-policy',
                'WAF/CDN fingerprinting across 10+ signatures',
                'JS secret scanner — API keys, JWTs, AWS credentials, DB URLs'
            ],
            preview: [
                { color: 'amber', label: 'WARN', text: 'Missing Content-Security-Policy header' },
                { color: 'amber', label: 'WARN', text: 'Server banner disclosed: nginx/1.24.0' },
                { color: 'green', label: 'PASS', text: 'TLS 1.3 · A+ · valid until 2027-04-12' },
            ]
        },
        {
            icon: Network,
            title: 'AI-Verified Active Scanning',
            tag: 'Verified',
            colorClass: 'cyan',
            description: 'Every candidate finding is confirmed by an LLM before it reaches your dashboard. An XGBoost + LightGBM ensemble prioritizes categories to test, then Gemini generates contextual payloads and verifies exploitability — cutting false positives to near-zero.',
            bullets: [
                'OWASP Top 10 coverage — XSS, SQLi, SSRF, IDOR, CSRF',
                'XGBoost + LightGBM ensemble for category prioritization',
                'Gemini-verified proof-of-exploit before flagging',
                'Non-destructive by default — destructive opt-in per scan'
            ],
            preview: [
                { color: 'red', label: 'HIGH', text: 'Reflected XSS in /search?q= param — CVSS 7.1' },
                { color: 'amber', label: 'MED', text: 'IDOR candidate in /api/orders/{id} — needs auth check' },
                { color: 'green', label: 'AI', text: 'SQLi candidate ruled out after 3 verification passes' },
            ]
        },
        {
            icon: Code2,
            title: 'AI Security Assistant',
            tag: 'Chat',
            colorClass: 'violet',
            description: 'A Gemini-backed chatbot grounded in your scan results. Ask about specific findings, generate remediation code snippets, look up CVEs, or navigate the platform — all without leaving the page.',
            bullets: [
                'Grounded in your latest scan output',
                'Generate fix suggestions with code snippets',
                'CVE lookup and vulnerability explanations',
                'In-app navigation via natural language ("show my reports")'
            ],
            preview: [
                { color: 'blue', label: 'ASK', text: '"How do I fix the CSP finding on /login?"' },
                { color: 'green', label: 'REPLY', text: 'Suggests Content-Security-Policy header with nonce-based script-src' },
                { color: 'blue', label: 'CVE', text: 'Lookup: CVE-2024-24919 — Check Point VPN, CVSS 8.6' },
            ]
        },
        {
            icon: FileCheck,
            title: 'Professional Reporting',
            tag: 'Export',
            colorClass: 'emerald',
            description: 'Export any scan as a PDF or DOCX ready for a client or a HackerOne submission. Each finding ships with reproduction steps, evidence, CVSS score, and a plain-English fix suggestion — no template wrangling needed.',
            bullets: [
                'PDF and DOCX export formats',
                'HackerOne-style reproduction blocks',
                'CVSS 3.1 scoring with per-finding evidence',
                'Plain-English remediation for every finding'
            ],
            preview: [
                { color: 'blue', label: 'PDF', text: 'target.example — full audit (8 pages)' },
                { color: 'blue', label: 'DOCX', text: 'Executive summary + technical appendix' },
                { color: 'green', label: 'H1', text: 'HackerOne-formatted markdown ready to paste' },
            ]
        },
        {
            icon: GitBranch,
            title: 'Admin & Analytics Console',
            tag: 'Team',
            colorClass: 'blue',
            description: 'Super-admin dashboard with user management, subscription controls, scan history analytics, and notification broadcasts. Track platform activity and moderate scans across all tenants from one console.',
            bullets: [
                'User + subscription management',
                'Scan history analytics and trend charts',
                'System-wide notification broadcasts',
                'Role-based access control (super_admin, admin)'
            ],
            preview: [
                { color: 'blue', label: 'USERS', text: '42 active accounts · 3 admins · 12 professional tier' },
                { color: 'green', label: 'ANALYTICS', text: 'Scan success rate: 94% · avg 12.4s per passive scan' },
                { color: 'blue', label: 'BROADCAST', text: 'Notification queued to all users on Free plan' },
            ]
        },
        {
            icon: KeyRound,
            title: 'CI/CD Integration',
            tag: 'Roadmap',
            colorClass: 'rose',
            description: 'GitHub Actions and GitLab CI hooks that fail builds on high-severity findings and post inline PR annotations. Currently in active development — early access on request.',
            bullets: [
                'GitHub Actions step with per-PR annotations',
                'GitLab CI with security dashboard hooks',
                'Configurable severity thresholds for build gates',
                'REST API for custom pipeline runners'
            ],
            preview: [
                { color: 'blue', label: 'ROADMAP', text: 'GitHub Actions integration — in progress' },
                { color: 'blue', label: 'ROADMAP', text: 'SARIF output for GitHub Security dashboard' },
                { color: 'green', label: 'AVAILABLE', text: 'REST API — trigger scans from any CI runner today' },
            ]
        }
    ];

    const testimonials = [
        {
            stars: 5,
            quote: "HackSentinel cut our vulnerability triage time by 70%. The AI verification model accurately distinguishes real exploit paths from static noise — something no traditional DAST tool could do.",
            name: "Alex Rivera",
            role: "Head of AppSec, CloudScale Inc.",
            initials: "AR",
            color: "indigo",
            metric: "70% faster triage"
        },
        {
            stars: 5,
            quote: "Being able to generate executive-ready SOC 2 compliance documentation and HackerOne bug reports in seconds has completely transformed our quarterly audit workflow.",
            name: "Dr. Sophia Chen",
            role: "VP of Infrastructure, FinSecure Labs",
            initials: "SC",
            color: "cyan",
            metric: "SOC 2 ready in minutes"
        },
        {
            stars: 5,
            quote: "The AJAX Spider found 40+ endpoints that our previous Burp Suite scans completely missed on our React SPA. The CI/CD gate integration pays for itself every sprint.",
            name: "Marcus Vance",
            role: "Principal DevSecOps Lead, NovaTech",
            initials: "MV",
            color: "violet",
            metric: "40+ missed endpoints found"
        },
        {
            stars: 5,
            quote: "The secret scanner found a live Stripe key in our production webpack bundle the day we deployed. It would have been a catastrophic breach without HackSentinel.",
            name: "Priya Sharma",
            role: "CISO, GrowthPay Solutions",
            initials: "PS",
            color: "emerald",
            metric: "Breach prevented on Day 1"
        },
        {
            stars: 5,
            quote: "I can now run a full OWASP Top 10 audit on any new API integration before it goes live. The reports are professional enough to share directly with compliance teams.",
            name: "James O'Brien",
            role: "Senior Security Engineer, HealthStack",
            initials: "JO",
            color: "blue",
            metric: "Audit time: 4min avg"
        },
        {
            stars: 5,
            quote: "Unmatched GraphQL security testing. It discovered an introspection endpoint and BOLA vulnerability in our API that our entire red team missed in a 3-day engagement.",
            name: "Rania Al-Farsi",
            role: "Lead Security Researcher, DefenceCore",
            initials: "RA",
            color: "rose",
            metric: "Found what red team missed"
        }
    ];

    return (
        <div className="landing-page">
            <Navbar />

            {/* ---- HERO SECTION ---- */}
            <section className="hero-section">
                <div className="hero-bg-mesh"></div>
                <div className="container hero-container">
                    <div className="hero-grid">
                        {/* Left Hero Content */}
                        <div className="hero-content">
                            <div className="glow-badge hero-badge">
                                <Sparkles size={16} className="badge-sparkle" />
                                <span>Autonomous AI Threat Intelligence 3.0</span>
                            </div>

                            <h1 className="hero-title">
                                Next-Gen Vulnerability Defense Powered by <span className="text-gradient">Agentic AI</span>
                            </h1>

                            <p className="hero-subtitle">
                                Continuous, real-time automated penetration testing and threat discovery. HackSentinel deploys intelligent security agents to detect, verify, and remediate exploits before attackers can strike.
                            </p>

                            {/* Quick Scan Form */}
                            <form onSubmit={handleQuickScan} className="hero-scanner-form glass-card">
                                <div className="scanner-input-wrap">
                                    <Globe2 size={20} className="scanner-icon" />
                                    <input
                                        type="text"
                                        placeholder="Enter domain or URL (e.g. example.com)"
                                        value={targetUrl}
                                        onChange={(e) => setTargetUrl(e.target.value)}
                                        className="scanner-input"
                                    />
                                </div>
                                <button type="submit" className="scanner-btn shimmer-hover">
                                    <span>Launch Audit</span>
                                    <ArrowRight size={18} />
                                </button>
                            </form>

                            {/* Trust Metrics */}
                            <div className="hero-trust">
                                <p className="trust-title">Trusted by security teams complying with</p>
                                <div className="trust-badges">
                                    <span className="trust-item"><CheckCircle2 size={16} color="var(--primary)" /> OWASP Top 10</span>
                                    <span className="trust-item"><CheckCircle2 size={16} color="var(--primary)" /> SOC 2 / HIPAA</span>
                                    <span className="trust-item"><CheckCircle2 size={16} color="var(--primary)" /> Zero False Positives</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Hero Visual: Telemetry HUD */}
                        <div className="hero-visual">
                            <div
                                className="hud-card glass-panel"
                                onMouseEnter={() => setIsHudHovered(true)}
                                onMouseLeave={() => setIsHudHovered(false)}
                            >
                                <div className="hud-header">
                                    <div className="hud-dots">
                                        <span className="hud-dot red"></span>
                                        <span className="hud-dot yellow"></span>
                                        <span className="hud-dot green"></span>
                                    </div>
                                    <div className="hud-target-pill">
                                        <span className="hud-live-dot"></span>
                                        <span>target-system.internal</span>
                                    </div>
                                    <div className="hud-tabs">
                                        <button className={`hud-tab-btn ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => setActiveTab('radar')}>Radar</button>
                                        <button className={`hud-tab-btn ${activeTab === 'payloads' ? 'active' : ''}`} onClick={() => setActiveTab('payloads')}>Payloads</button>
                                        <button className={`hud-tab-btn ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>Audit Log</button>
                                    </div>
                                </div>

                                {/* Live scan progress bar */}
                                <div className="hud-scan-bar">
                                    <div className="hud-scan-bar-meta">
                                        <span className="hud-scan-bar-label">
                                            <span className="hud-scan-pulse"></span>
                                            Scanning · <span className="hud-scan-percent">{scanProgress}%</span>
                                        </span>
                                        <span className="hud-scan-bar-sub">Agent v3.0 · 218 checks · ETA 00:42</span>
                                    </div>
                                    <div className="hud-scan-bar-track">
                                        <div className="hud-scan-bar-fill" style={{ width: `${scanProgress}%` }}></div>
                                    </div>
                                </div>

                                <div className="hud-body">
                                    {activeTab === 'radar' && (
                                        <div className="hud-radar-view">
                                            <div className="radar-circle-wrap">
                                                <div className="radar-sweep"></div>
                                                <div className="radar-ring r1"></div>
                                                <div className="radar-ring r2"></div>
                                                <div className="radar-ring r3"></div>
                                                <div className="radar-blip b1" title="XSS Probed - Sanitized"></div>
                                                <div className="radar-blip b2" title="SQLi Prevented"></div>
                                                <div className="radar-blip b3" title="CSRF Validated"></div>
                                                <div className="radar-center-shield">
                                                    <ShieldCheck size={28} color="#4f46e5" />
                                                </div>
                                            </div>
                                            <div className="hud-stats-mini">
                                                <div className="hud-stat-box">
                                                    <span className="stat-label">Security Health</span>
                                                    <span className="stat-value text-gradient">{simulatedScore}/100</span>
                                                </div>
                                                <div className="hud-stat-box">
                                                    <span className="stat-label">Exploit Resistance</span>
                                                    <span className="stat-value text-success">99.9%</span>
                                                </div>
                                                <div className="hud-stat-box">
                                                    <span className="stat-label">Endpoints Scanned</span>
                                                    <span className="stat-value">1,247</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'payloads' && (
                                        <div className="hud-terminal-view">
                                            <div className="terminal-line"><span className="term-prompt">agent:~$</span> initializing DAST scan on target-system.internal</div>
                                            <div className="terminal-line text-info">[INFO] AJAX Spider crawled 342 unique endpoints in 4.2s</div>
                                            <div className="terminal-line text-warning">[WARN] Weak cipher suite TLS_RSA_WITH_3DES on port 443</div>
                                            <div className="terminal-line text-success">[PASS] CSRF tokens validated on all state-changing endpoints</div>
                                            <div className="terminal-line text-primary">[AI] Generating targeted exploit payload for /api/v1/auth...</div>
                                            <div className="terminal-line text-danger">[CRITICAL] SQL Injection confirmed via /api/search?q= param</div>
                                            <div className="terminal-cursor-blink">█</div>
                                        </div>
                                    )}

                                    {activeTab === 'report' && (
                                        <div className="hud-findings-view">
                                            <div className="finding-row critical-row">
                                                <span className="badge-sev critical">CRITICAL</span>
                                                <span className="finding-name">SQL Injection — /api/search</span>
                                                <span className="finding-status">CVSS: 9.8</span>
                                            </div>
                                            <div className="finding-row med">
                                                <span className="badge-sev med">MEDIUM</span>
                                                <span className="finding-name">Missing Strict-Transport-Security</span>
                                                <span className="finding-status">Fix Required</span>
                                            </div>
                                            <div className="finding-row low">
                                                <span className="badge-sev low">INFO</span>
                                                <span className="finding-name">Server banner nginx/1.24 disclosed</span>
                                                <span className="finding-status">Auto-Mitigated</span>
                                            </div>
                                            <div className="finding-row secure">
                                                <span className="badge-sev pass">PASS</span>
                                                <span className="finding-name">XSS & NoSQL injection fuzz tests</span>
                                                <span className="finding-status">Defended</span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ---- LIVE METRICS SECTION ---- */}
            <section className="stats-section">
                <div className="container">
                    <div className="stats-grid glass-panel">
                        <div className="stat-card">
                            <h3 className="stat-number text-gradient">250K+</h3>
                            <p className="stat-title">Vulnerability Checks / Day</p>
                            <span className="stat-desc">Across 50+ enterprise workloads</span>
                        </div>
                        <div className="stat-card">
                            <h3 className="stat-number text-gradient">99.9%</h3>
                            <p className="stat-title">Verified Accuracy</p>
                            <span className="stat-desc">AI-filtered false positive reduction</span>
                        </div>
                        <div className="stat-card">
                            <h3 className="stat-number text-gradient">&lt; 15ms</h3>
                            <p className="stat-title">Real-Time Threat Flagging</p>
                            <span className="stat-desc">Immediate proactive alert dispatch</span>
                        </div>
                        <div className="stat-card">
                            <h3 className="stat-number text-gradient">24/7</h3>
                            <p className="stat-title">Autonomous Monitoring</p>
                            <span className="stat-desc">Constant background penetration tests</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ---- PLATFORM CAPABILITIES (Competitor-Grade) ---- */}
            <section className="capabilities-section">
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Platform Capabilities</div>
                        <h2 className="section-title">Everything OWASP ZAP + Burp Suite + Snyk. In One Platform.</h2>
                        <p className="section-subtitle">HackSentinel combines the power of the world's top open-source and enterprise security tools into a single autonomous AI-driven platform.</p>
                    </div>

                    <div className="capabilities-layout">
                        {/* Left: Tab Navigation */}
                        <div className="cap-tab-nav">
                            {capabilities.map((cap, idx) => {
                                const Icon = cap.icon;
                                return (
                                    <button
                                        key={idx}
                                        className={`cap-tab-item ${activeCapability === idx ? 'active' : ''} ${cap.colorClass}`}
                                        onClick={() => setActiveCapability(idx)}
                                    >
                                        <div className={`cap-tab-icon-wrap ${cap.colorClass}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="cap-tab-text">
                                            <span className="cap-tab-tag">{cap.tag}</span>
                                            <span className="cap-tab-title">{cap.title}</span>
                                        </div>
                                        <ChevronRight size={16} className="cap-tab-chevron" />
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right: Active Capability Detail */}
                        <div className="cap-detail-panel glass-card">
                            {(() => {
                                const cap = capabilities[activeCapability];
                                const Icon = cap.icon;
                                return (
                                    <div className="cap-detail-content">
                                        <div className="cap-detail-header">
                                            <div className={`cap-detail-icon-halo ${cap.colorClass}`}>
                                                <Icon size={28} />
                                            </div>
                                            <div>
                                                <span className={`cap-tag-pill ${cap.colorClass}`}>{cap.tag}</span>
                                                <h3 className="cap-detail-title">{cap.title}</h3>
                                            </div>
                                        </div>

                                        <p className="cap-detail-desc">{cap.description}</p>

                                        <div className="cap-bullets-list">
                                            {cap.bullets.map((bullet, bIdx) => (
                                                <div key={bIdx} className="cap-bullet-item">
                                                    <CheckCircle2 size={17} className="cap-bullet-icon" />
                                                    <span>{bullet}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Live Preview Terminal */}
                                        <div className="cap-preview-terminal">
                                            <div className="cap-preview-terminal-header">
                                                <span className="terminal-dot red"></span>
                                                <span className="terminal-dot yellow"></span>
                                                <span className="terminal-dot green"></span>
                                                <span className="cap-preview-label">Live Results Preview</span>
                                            </div>
                                            <div className="cap-preview-rows">
                                                {cap.preview.map((row, rIdx) => (
                                                    <div key={rIdx} className={`cap-preview-row ${row.color}`}>
                                                        <span className={`cap-preview-badge ${row.color}`}>{row.label}</span>
                                                        <span className="cap-preview-text">{row.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </section>

            {/* ---- SCROLLABLE REVIEWS CAROUSEL ---- */}
            <section className="testimonials-section">
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Security Leaders</div>
                        <h2 className="section-title">Trusted by Modern Engineering Teams</h2>
                        <p className="section-subtitle">See how security teams use HackSentinel to secure APIs, microservices, and client-side assets.</p>
                    </div>

                    <div className="testimonials-carousel-wrap">
                        <button className="carousel-arrow left" onClick={() => scrollReviews('left')} aria-label="Scroll reviews left">
                            <ChevronLeft size={22} />
                        </button>
                        <div className="testimonials-carousel" ref={reviewsRef}>
                            {testimonials.map((t, idx) => (
                                <div key={idx} className="testimonial-card glass-card">
                                    <div className="testimonial-card-top">
                                        <div className="testimonial-stars">
                                            {[...Array(t.stars)].map((_, i) => (
                                                <Star key={i} size={16} fill="#f59e0b" color="#f59e0b" />
                                            ))}
                                        </div>
                                        <span className={`testimonial-metric-pill ${t.color}`}>{t.metric}</span>
                                    </div>
                                    <p className="testimonial-quote">"{t.quote}"</p>
                                    <div className="testimonial-author">
                                        <div className={`author-avatar-badge ${t.color}`}>{t.initials}</div>
                                        <div>
                                            <h4 className="author-name">{t.name}</h4>
                                            <p className="author-role">{t.role}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="carousel-arrow right" onClick={() => scrollReviews('right')} aria-label="Scroll reviews right">
                            <ChevronRight size={22} />
                        </button>
                    </div>
                </div>
            </section>

            {/* ---- PRICING PREVIEW ---- */}
            <PricingPreview />

            {/* ---- FAQ ACCORDION ---- */}
            <FaqSection />

            {/* ---- FINAL CTA BANNER ---- */}
            <section className="cta-banner-section">
                <div className="container">
                    <div className="cta-banner-card glass-panel">
                        <div className="cta-banner-content">
                            <h2 className="cta-title">Ready to Fortify Your Attack Surface?</h2>
                            <p className="cta-subtitle">Get started with HackSentinel in under 2 minutes. No credit card required.</p>
                            <div className="cta-action-group">
                                <Link to="/signup" className="btn-primary-lg shimmer-hover">
                                    <span>Start Free Vulnerability Audit</span>
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/pricing" className="btn-secondary-lg">
                                    <span>Explore Tiered Plans</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
            <Chatbot position="bottom-right" />
        </div>
    );
};

export default LandingPage;
