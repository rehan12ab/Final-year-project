import React from 'react';
import { Link } from 'react-router-dom';
import './Services.css';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import PricingPreview from './components/PricingPreview';
import FaqSection from './components/FaqSection';
import {
    ShieldCheck,
    Lock,
    Radar,
    FileText,
    Bot,
    GitBranch,
    ArrowRight,
    CheckCircle2,
    Zap,
    Code2,
    Briefcase
} from 'lucide-react';

const Services: React.FC = () => {
    const services = [
        {
            icon: Radar,
            title: 'Passive Reconnaissance',
            summary: 'Fingerprint a target without sending a single attack payload.',
            details: 'TLS/cipher analysis, WAF detection, security-header audit, exposed-port sweep, and JavaScript secret scanning across the client bundle.',
            colorClass: 'indigo',
            tags: ['TLS Audit', 'WAF Detect', 'Secret Scan', 'Port Sweep']
        },
        {
            icon: Zap,
            title: 'AI-Verified Active Scanning',
            summary: 'Every finding is confirmed by an LLM before it reaches your dashboard.',
            details: 'Contextual payloads generated per target with Gemini-based verification for OWASP Top 10 vulnerabilities — cutting false positives dramatically.',
            colorClass: 'cyan',
            tags: ['XSS', 'SQLi', 'SSRF', 'IDOR', 'CSRF']
        },
        {
            icon: Bot,
            title: 'AI Security Assistant',
            summary: 'Chat with a security-aware assistant grounded in your scan results.',
            details: 'Ask questions about specific findings, generate remediation code snippets, or query CVE data — all powered by a Gemini-backed chatbot.',
            colorClass: 'violet',
            tags: ['CVE Lookup', 'Fix Suggestions', 'Scan Q&A']
        },
        {
            icon: FileText,
            title: 'Professional Reporting',
            summary: 'Export scans as auditor-friendly PDF or DOCX in one click.',
            details: 'HackerOne-style reproduction steps, CVSS scoring, evidence attachments, and plain-English fix suggestions. Ready to share with clients or file publicly.',
            colorClass: 'emerald',
            tags: ['PDF', 'DOCX', 'HackerOne Format']
        },
        {
            icon: Lock,
            title: 'Role-Based Admin Console',
            summary: 'Manage users, subscriptions, and scan history from one dashboard.',
            details: 'Super-admin controls for user management, subscription tiers, scan analytics, and notification broadcasts.',
            colorClass: 'rose',
            tags: ['User Mgmt', 'Analytics', 'Subscriptions']
        },
        {
            icon: GitBranch,
            title: 'CI/CD Integration',
            summary: 'Scan-on-PR and pipeline gates. On the roadmap.',
            details: 'GitHub Actions and GitLab CI hooks that fail builds on high-severity findings and post inline PR annotations. Currently in active development.',
            colorClass: 'blue',
            tags: ['GitHub Actions', 'GitLab CI', 'Roadmap'],
            comingSoon: true
        }
    ];

    return (
        <div className="services-page">
            <Navbar />

            {/* Hero */}
            <section className="services-hero">
                <div className="container">
                    <div className="services-hero-content">
                        <div className="glow-badge">What HackSentinel Does</div>
                        <h1 className="hero-title">
                            One workflow, from <span className="text-gradient">first probe to final report</span>.
                        </h1>
                        <p className="hero-subtitle">
                            Six capabilities that work together: recon a target, verify vulnerabilities with AI, and ship a professional report — without leaving the browser.
                        </p>
                        <div className="cta-action-group" style={{ marginTop: '2rem' }}>
                            <Link to="/signup" className="btn-primary-lg shimmer-hover">
                                <span>Start Free Scan</span>
                                <ArrowRight size={18} />
                            </Link>
                            <Link to="/pricing" className="btn-secondary-lg">
                                <span>See Pricing</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services grid */}
            <section className="services-grid-section">
                <div className="container">
                    <div className="services-grid">
                        {services.map((service, index) => {
                            const IconComponent = service.icon;
                            return (
                                <div key={index} className="service-card glass-card">
                                    <div className="service-card-top">
                                        <div className={`service-icon-halo ${service.colorClass}`}>
                                            <IconComponent size={28} />
                                        </div>
                                        <div className="service-tags">
                                            {service.tags.map((tag, tIdx) => (
                                                <span key={tIdx} className="service-tag">{tag}</span>
                                            ))}
                                        </div>
                                    </div>

                                    <h3 className="service-title">
                                        {service.title}
                                        {service.comingSoon && (
                                            <span style={{
                                                marginLeft: '0.5rem',
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                letterSpacing: '0.08em',
                                                textTransform: 'uppercase',
                                                background: 'rgba(79, 70, 229, 0.12)',
                                                color: '#4f46e5',
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '999px',
                                                verticalAlign: 'middle'
                                            }}>Soon</span>
                                        )}
                                    </h3>
                                    <p className="service-description" style={{ fontWeight: 600, color: '#334155' }}>{service.summary}</p>
                                    <p className="service-description">{service.details}</p>

                                    <Link to="/signup" className="service-link">
                                        <span>{service.comingSoon ? 'Get Notified' : 'Try It'}</span>
                                        <ArrowRight size={16} className="service-arrow" />
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Who it's for */}
            <section className="services-grid-section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Choose Your Path</div>
                        <h2 className="section-title">Which service is <span className="text-gradient">right for you</span>?</h2>
                        <p className="section-subtitle">Pick the workflow that matches how you actually work.</p>
                    </div>

                    <div className="services-grid" style={{ marginTop: '2.5rem' }}>
                        <div className="service-card glass-card">
                            <div className="service-icon-halo indigo">
                                <Code2 size={28} />
                            </div>
                            <h3 className="service-title" style={{ marginTop: '1rem' }}>Developer</h3>
                            <p className="service-description">Scan your own app before launch. Get quick wins on headers, TLS, and leaked secrets in your bundle.</p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                                <li style={{ marginBottom: '0.35rem' }}>✔ Passive recon</li>
                                <li style={{ marginBottom: '0.35rem' }}>✔ Auto fix suggestions via chatbot</li>
                                <li>✔ Free tier available</li>
                            </ul>
                            <Link to="/signup" className="service-link">
                                <span>Start Free</span>
                                <ArrowRight size={16} className="service-arrow" />
                            </Link>
                        </div>

                        <div className="service-card glass-card">
                            <div className="service-icon-halo cyan">
                                <ShieldCheck size={28} />
                            </div>
                            <h3 className="service-title" style={{ marginTop: '1rem' }}>Bug Bounty Hunter</h3>
                            <p className="service-description">Pre-screen targets and generate HackerOne-ready reports. Focus time on verified findings.</p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                                <li style={{ marginBottom: '0.35rem' }}>✔ AI-verified active scans</li>
                                <li style={{ marginBottom: '0.35rem' }}>✔ HackerOne report export</li>
                                <li>✔ Scan history + notes</li>
                            </ul>
                            <Link to="/signup" className="service-link">
                                <span>Start Hunting</span>
                                <ArrowRight size={16} className="service-arrow" />
                            </Link>
                        </div>

                        <div className="service-card glass-card">
                            <div className="service-icon-halo violet">
                                <Briefcase size={28} />
                            </div>
                            <h3 className="service-title" style={{ marginTop: '1rem' }}>Security Consultant</h3>
                            <p className="service-description">Baseline every engagement with reproducible recon and client-ready PDF/DOCX reports.</p>
                            <ul style={{ listStyle: 'none', padding: 0, margin: '0.75rem 0 1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                                <li style={{ marginBottom: '0.35rem' }}>✔ Multi-target scan history</li>
                                <li style={{ marginBottom: '0.35rem' }}>✔ Branded PDF/DOCX reports</li>
                                <li>✔ Professional / Enterprise tier</li>
                            </ul>
                            <Link to="/pricing" className="service-link">
                                <span>See Tiers</span>
                                <ArrowRight size={16} className="service-arrow" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Built-in guarantees */}
            <section className="capabilities-section">
                <div className="container">
                    <div className="capabilities-card glass-panel">
                        <div className="section-header text-center">
                            <div className="glow-badge">Standard on Every Plan</div>
                            <h2 className="section-title">What you always get</h2>
                        </div>

                        <div className="capabilities-grid">
                            <div className="cap-item">
                                <CheckCircle2 size={20} className="cap-icon" />
                                <div>
                                    <h4>Non-destructive by default</h4>
                                    <p>Payloads are safe for production. Destructive tests require explicit opt-in per scan.</p>
                                </div>
                            </div>
                            <div className="cap-item">
                                <CheckCircle2 size={20} className="cap-icon" />
                                <div>
                                    <h4>OWASP Top 10 coverage</h4>
                                    <p>Detection for XSS, SQLi, SSRF, IDOR, CSRF, insecure headers, and common misconfigurations.</p>
                                </div>
                            </div>
                            <div className="cap-item">
                                <CheckCircle2 size={20} className="cap-icon" />
                                <div>
                                    <h4>Actionable fix suggestions</h4>
                                    <p>Every finding ships with reproduction steps, evidence, and a plain-English remediation.</p>
                                </div>
                            </div>
                            <div className="cap-item">
                                <CheckCircle2 size={20} className="cap-icon" />
                                <div>
                                    <h4>Your data stays yours</h4>
                                    <p>Scan results tied to your account, deletable at any time from your dashboard.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Sample terminal output */}
            <section className="services-grid-section" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">What Output Looks Like</div>
                        <h2 className="section-title">A real scan, <span className="text-gradient">in seconds</span></h2>
                    </div>

                    <div className="glass-panel" style={{
                        maxWidth: '780px',
                        margin: '2rem auto 0',
                        padding: '1.5rem',
                        background: '#0f172a',
                        color: '#cbd5e1',
                        borderRadius: 'var(--radius-2xl)',
                        fontFamily: 'SFMono-Regular, ui-monospace, monospace',
                        fontSize: '0.86rem',
                        lineHeight: 1.7
                    }}>
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '0.85rem' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }}></span>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }}></span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#64748b' }}>agent · v3.0</span>
                        </div>
                        <div><span style={{ color: '#22d3ee' }}>agent:~$</span> hacksentinel scan https://target.example</div>
                        <div style={{ color: '#94a3b8' }}>[INFO] Starting passive recon...</div>
                        <div style={{ color: '#38bdf8' }}>[PASS] TLS 1.3 · A+ · valid until 2027-04-12</div>
                        <div style={{ color: '#f59e0b' }}>[WARN] Missing Content-Security-Policy header</div>
                        <div style={{ color: '#f59e0b' }}>[WARN] Server banner disclosed: nginx/1.24.0</div>
                        <div style={{ color: '#a5b4fc' }}>[AI]   Prioritizing categories: XSS, IDOR, SSRF</div>
                        <div style={{ color: '#94a3b8' }}>[INFO] Active scan · 47 checks · verifying with LLM...</div>
                        <div style={{ color: '#f87171' }}>[HIGH] Reflected XSS confirmed in /search?q= (CVSS 7.1)</div>
                        <div style={{ color: '#10b981' }}>[DONE] Report generated · 1 high · 2 warnings · report_2026-08-30.pdf</div>
                    </div>
                </div>
            </section>

            {/* Pricing preview */}
            <PricingPreview />

            {/* FAQ */}
            <FaqSection />

            {/* CTA */}
            <section className="cta-banner-section">
                <div className="container">
                    <div className="cta-banner-card glass-panel">
                        <div className="cta-banner-content">
                            <h2 className="cta-title">Point it at a URL. See what falls out.</h2>
                            <p className="cta-subtitle">Free tier. No card. First scan in under a minute.</p>
                            <div className="cta-action-group">
                                <Link to="/signup" className="btn-primary-lg shimmer-hover">
                                    <span>Run Your First Scan</span>
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/contact" className="btn-secondary-lg">
                                    <span>Talk to Us</span>
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

export default Services;
