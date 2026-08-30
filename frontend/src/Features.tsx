import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import './Features.css';
import {
    Zap,
    FileText,
    Layers,
    AlertTriangle,
    Code,
    BarChart3,
    Bell,
    TrendingUp,
    CheckCircle2,
    GitBranch,
    ShieldCheck,
    ArrowRight,
    Search,
    Sparkles
} from 'lucide-react';

const Features: React.FC = () => {
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'scanning' | 'cicd' | 'reports'>('all');

    const features = [
        {
            category: 'scanning',
            icon: Zap,
            title: 'Real-Time Vulnerability Detection',
            description: 'AI agents continuously scan your target web surfaces for security threats. Get instant alerts with severity ratings, CVSS scores, and reproducible attack vectors.',
            benefits: ['24/7 Monitoring', 'Instant Real-Time Alerts', 'AI-Filtered Zero False Positives'],
            colorClass: 'indigo',
            stats: { value: '99.9%', label: 'Detection Rate' }
        },
        {
            category: 'reports',
            icon: FileText,
            title: 'Automated Executive Reports',
            description: 'Generate compliance-ready PDF and Word bug bounty reports automatically. Track historical trends and executive risk summaries with high visual clarity.',
            benefits: ['PDF & DOCX Export', 'SOC 2 Alignment', 'Instant Download'],
            colorClass: 'cyan',
            stats: { value: '< 2min', label: 'Report Generation' }
        },
        {
            category: 'cicd',
            icon: Layers,
            title: 'Multi-Platform Cloud Integrations',
            description: 'Seamlessly integrate with GitHub, GitLab, Bitbucket, Jira, Slack, and cloud providers. One unified security intelligence hub for your DevOps stack.',
            benefits: ['50+ Integrations', 'REST API Access', 'Webhook Web-Events'],
            colorClass: 'violet',
            stats: { value: '50+', label: 'Supported Integrations' }
        },
        {
            category: 'scanning',
            icon: AlertTriangle,
            title: 'Smart Risk & Exploit Prioritization',
            description: 'Intelligent scoring models prioritize vulnerabilities by real exploitability rather than theoretical risk, saving engineering teams hundreds of triage hours.',
            benefits: ['Exploitability Scoring', 'Impact Analysis', 'Fix Recommendation'],
            colorClass: 'amber',
            stats: { value: '80%', label: 'Triage Time Saved' }
        },
        {
            category: 'scanning',
            icon: Code,
            title: 'Client-Side Script & Secret Scanner',
            description: 'Deep inspection of JS webpack bundles and source maps for leaked API keys, tokens, exposed staging paths, and prototype pollution vulnerabilities.',
            benefits: ['Secret Extraction', 'Webpack Map Parsing', 'API Token Alerting'],
            colorClass: 'blue',
            stats: { value: '25+', label: 'Secret Signatures' }
        },
        {
            category: 'reports',
            icon: BarChart3,
            title: 'Compliance Posture Dashboard',
            description: 'Track security compliance metrics against industry standards including OWASP Top 10, PCI-DSS, HIPAA, and ISO 27001 at a glance.',
            benefits: ['Multiple Frameworks', 'Visual Radar Metrics', 'Historical Audit Trails'],
            colorClass: 'emerald',
            stats: { value: '100%', label: 'Audit Trail' }
        },
        {
            category: 'cicd',
            icon: Bell,
            title: 'Intelligent Alert Dispatcher',
            description: 'Instant security alerts delivered via email, Slack webhooks, and in-app feeds with custom routing rules based on vulnerability severity.',
            benefits: ['Multi-Channel Dispatch', 'Custom Rules', 'Role-Based Routing'],
            colorClass: 'rose',
            stats: { value: '< 5s', label: 'Alert Dispatch' }
        },
        {
            category: 'reports',
            icon: TrendingUp,
            title: 'Historical Security Health Trends',
            description: 'Visualize vulnerability resolution velocity, mean-time-to-remediate (MTTR), and overall posture evolution across quarters.',
            benefits: ['Posture Velocity', 'Team Benchmarking', 'Vulnerability Delta'],
            colorClass: 'indigo',
            stats: { value: '100%', label: 'Visibility' }
        },
        {
            category: 'cicd',
            icon: GitBranch,
            title: 'CI/CD Pipeline Security Gates',
            description: 'Prevent vulnerable code from reaching staging or production by embedding automated security tests directly into your pull request pipelines.',
            benefits: ['Automated PR Blocking', 'GitHub Actions Step', 'DevSecOps Native'],
            colorClass: 'cyan',
            stats: { value: '0', label: 'Breaches in Prod' }
        }
    ];

    const filteredFeatures = selectedCategory === 'all'
        ? features
        : features.filter(f => f.category === selectedCategory);

    return (
        <div className="features-page">
            <Navbar />

            {/* Hero Section */}
            <section className="features-hero">
                <div className="container">
                    <div className="features-hero-content">
                        <div className="glow-badge">Enterprise Capabilities</div>
                        <h1 className="hero-title">
                            Next-Generation <span className="text-gradient">Platform Features</span>
                        </h1>
                        <p className="hero-subtitle">
                            Every tool and automated agent required to defend your attack surface, satisfy compliance requirements, and streamline vulnerability triage.
                        </p>

                        {/* Interactive Category Filter Pills */}
                        <div className="feature-category-tabs">
                            <button
                                className={`category-tab ${selectedCategory === 'all' ? 'active' : ''}`}
                                onClick={() => setSelectedCategory('all')}
                            >
                                All Capabilities
                            </button>
                            <button
                                className={`category-tab ${selectedCategory === 'scanning' ? 'active' : ''}`}
                                onClick={() => setSelectedCategory('scanning')}
                            >
                                Vulnerability Scanning
                            </button>
                            <button
                                className={`category-tab ${selectedCategory === 'cicd' ? 'active' : ''}`}
                                onClick={() => setSelectedCategory('cicd')}
                            >
                                CI/CD & DevOps
                            </button>
                            <button
                                className={`category-tab ${selectedCategory === 'reports' ? 'active' : ''}`}
                                onClick={() => setSelectedCategory('reports')}
                            >
                                Intelligence & Reports
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="features-grid-section">
                <div className="container">
                    <div className="features-grid">
                        {filteredFeatures.map((feature, index) => {
                            const IconComponent = feature.icon;
                            return (
                                <div key={index} className="feature-card glass-card">
                                    <div className="feature-card-header">
                                        <div className={`feature-icon-halo ${feature.colorClass}`}>
                                            <IconComponent size={26} />
                                        </div>
                                        <div className="feature-stat-pill">
                                            <span className="stat-val">{feature.stats.value}</span>
                                            <span className="stat-lbl">{feature.stats.label}</span>
                                        </div>
                                    </div>

                                    <h3 className="feature-title">{feature.title}</h3>
                                    <p className="feature-description">{feature.description}</p>

                                    <div className="feature-benefits-list">
                                        {feature.benefits.map((b, bIdx) => (
                                            <div key={bIdx} className="benefit-item">
                                                <CheckCircle2 size={16} className="benefit-icon" />
                                                <span>{b}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* Why Choose HackSentinel */}
            <section className="why-choose-section">
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Competitive Advantage</div>
                        <h2 className="section-title">Why Leading Teams Choose HackSentinel</h2>
                        <p className="section-subtitle">A platform built from the ground up for developer efficiency and zero false positives.</p>
                    </div>

                    <div className="why-grid">
                        <div className="why-card glass-card">
                            <div className="why-num-badge">01</div>
                            <h3>Neural Verification</h3>
                            <p>Dual-model AI that simulates and confirms actual exploitability rather than relying on brittle regex rules.</p>
                        </div>
                        <div className="why-card glass-card">
                            <div className="why-num-badge">02</div>
                            <h3>Enterprise Isolation</h3>
                            <p>Zero data retention on sensitive source code with 256-bit encryption for all audit telemetry.</p>
                        </div>
                        <div className="why-card glass-card">
                            <div className="why-num-badge">03</div>
                            <h3>Instant Code Fixes</h3>
                            <p>Automated remediation code patches generated for Express, Django, Next.js, FastAPI, and more.</p>
                        </div>
                        <div className="why-card glass-card">
                            <div className="why-num-badge">04</div>
                            <h3>24/7 Autonomous Guard</h3>
                            <p>Around-the-clock threat discovery and instant notification dispatch across Slack and email.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Pre-Footer CTA */}
            <section className="cta-banner-section">
                <div className="container">
                    <div className="cta-banner-card glass-panel">
                        <div className="cta-banner-content">
                            <h2 className="cta-title">Start Protecting Your Infrastructure Today</h2>
                            <p className="cta-subtitle">Launch your first autonomous scan in less than two minutes.</p>
                            <div className="cta-action-group">
                                <Link to="/signup" className="btn-primary-lg shimmer-hover">
                                    <span>Start Free Vulnerability Audit</span>
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/pricing" className="btn-secondary-lg">
                                    <span>View Pricing Plans</span>
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

export default Features;
