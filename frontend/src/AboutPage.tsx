import React from 'react';
import './AboutPage.css';
import {
    Shield,
    Target,
    CheckCircle2,
    ArrowRight,
    Compass,
    Layers,
    Sparkles,
    Users,
    Rocket
} from 'lucide-react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import PricingPreview from './components/PricingPreview';
import FaqSection from './components/FaqSection';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => {
    return (
        <div className="about-page">
            <Navbar />

            {/* Hero */}
            <section className="about-hero">
                <div className="container about-hero-container">
                    <div className="about-hero-content">
                        <div className="glow-badge">About HackSentinel</div>
                        <h1 className="hero-title">
                            Web security that acts like a <span className="text-gradient">teammate</span>, not a scanner.
                        </h1>
                        <p className="hero-subtitle">
                            HackSentinel pairs a passive reconnaissance engine with an AI-verified active testing layer, so security teams and solo developers get findings they can act on — not noise they have to triage.
                        </p>
                        <div className="cta-action-group" style={{ marginTop: '2rem' }}>
                            <Link to="/signup" className="btn-primary-lg shimmer-hover">
                                <span>Start a Free Scan</span>
                                <ArrowRight size={18} />
                            </Link>
                            <Link to="/services" className="btn-secondary-lg">
                                <span>See What We Do</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* The problem we're solving */}
            <section className="about-story">
                <div className="container story-container">
                    <div className="story-text">
                        <div className="glow-badge">The Problem</div>
                        <h2 className="section-title">Traditional scanners are loud. Real attackers are quiet.</h2>
                        <p className="section-description">
                            Open-source scanners like ZAP or Nikto often surface hundreds of findings — most of which are unreachable, misconfigured, or already mitigated. Security engineers spend more time filtering false positives than fixing real risk.
                        </p>
                        <p className="section-description">
                            HackSentinel takes the opposite approach. Every finding is verified against the live target by an AI reasoning layer before it reaches your dashboard. If it's flagged, it's actionable.
                        </p>
                        <ul className="story-list">
                            <li><CheckCircle2 className="story-icon" size={20} /> Passive reconnaissance — TLS, headers, WAF, JS secret scanning</li>
                            <li><CheckCircle2 className="story-icon" size={20} /> Active AI-verified payload testing across OWASP Top 10 categories</li>
                            <li><CheckCircle2 className="story-icon" size={20} /> Export-ready reports (PDF / DOCX / HackerOne format)</li>
                        </ul>
                    </div>

                    <div className="story-visual">
                        <div className="story-visual-card glass-panel">
                            <div className="visual-shield-halo">
                                <Shield size={80} className="shield-icon" />
                            </div>
                            <div className="story-badge-chip">
                                <span className="pulse-dot"></span>
                                <span>Signal over noise</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="about-timeline">
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">How It Works</div>
                        <h2 className="section-title">Four stages, <span className="text-gradient">one workflow</span></h2>
                        <p className="section-subtitle">From URL to executive-ready report in a single autonomous pass.</p>
                    </div>

                    <div className="timeline-grid">
                        <div className="timeline-card glass-card">
                            <div className="timeline-year-badge">01</div>
                            <h4>Passive Recon</h4>
                            <p>Fingerprint the target — TLS cipher, WAF, headers, exposed ports, and secret patterns in JS bundles.</p>
                        </div>
                        <div className="timeline-card glass-card">
                            <div className="timeline-year-badge">02</div>
                            <h4>AI Suggests</h4>
                            <p>An XGBoost classifier scores the target and suggests the most likely vulnerability categories to test.</p>
                        </div>
                        <div className="timeline-card glass-card">
                            <div className="timeline-year-badge">03</div>
                            <h4>Active Verify</h4>
                            <p>Gemini generates contextual payloads and verifies exploitability — cutting false positives dramatically.</p>
                        </div>
                        <div className="timeline-card glass-card">
                            <div className="timeline-year-badge">04</div>
                            <h4>Report</h4>
                            <p>Findings are packaged into a professional report you can hand to a client or file on HackerOne.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Who it's for */}
            <section className="about-values">
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Who It's For</div>
                        <h2 className="section-title">Built for the <span className="text-gradient">people doing the work</span></h2>
                    </div>

                    <div className="values-grid">
                        <div className="value-card glass-card">
                            <div className="value-icon-halo indigo">
                                <Users size={28} />
                            </div>
                            <h4>Bug Bounty Hunters</h4>
                            <p>Pre-screen targets before you spend hours poking. Export findings in HackerOne-ready format.</p>
                        </div>

                        <div className="value-card glass-card">
                            <div className="value-icon-halo cyan">
                                <Layers size={28} />
                            </div>
                            <h4>Solo Developers</h4>
                            <p>Get a sanity check on your own app before you launch — headers, secrets, and easy misconfigurations.</p>
                        </div>

                        <div className="value-card glass-card">
                            <div className="value-icon-halo violet">
                                <Target size={28} />
                            </div>
                            <h4>Security Consultants</h4>
                            <p>Baseline every engagement with reproducible recon and verified findings you can hand to a client.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values / Principles */}
            <section className="about-values" style={{ paddingTop: 0 }}>
                <div className="container">
                    <div className="section-header text-center">
                        <div className="glow-badge">Principles</div>
                        <h2 className="section-title">What we <span className="text-gradient">refuse to compromise on</span></h2>
                    </div>

                    <div className="values-grid">
                        <div className="value-card glass-card">
                            <div className="value-icon-halo emerald">
                                <Compass size={28} />
                            </div>
                            <h4>Signal, not noise</h4>
                            <p>Findings are AI-verified before you see them. Fewer alerts, higher confidence.</p>
                        </div>

                        <div className="value-card glass-card">
                            <div className="value-icon-halo rose">
                                <Shield size={28} />
                            </div>
                            <h4>Non-destructive by default</h4>
                            <p>Payloads are safe for production. Destructive tests require an explicit opt-in.</p>
                        </div>

                        <div className="value-card glass-card">
                            <div className="value-icon-halo blue">
                                <Sparkles size={28} />
                            </div>
                            <h4>Reports that ship</h4>
                            <p>Every finding includes reproduction steps, evidence, and a plain-English fix suggestion.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Roadmap - honest about being WIP */}
            <section className="about-story">
                <div className="container story-container">
                    <div className="story-text">
                        <div className="glow-badge">Roadmap</div>
                        <h2 className="section-title">Where HackSentinel is heading</h2>
                        <p className="section-description">
                            The platform ships as a working passive-and-active scanner today. Here's what's being built next — feedback from early users directly shapes what we prioritize.
                        </p>
                        <ul className="story-list">
                            <li><CheckCircle2 className="story-icon" size={20} /> GitHub Actions integration for scan-on-PR workflows</li>
                            <li><CheckCircle2 className="story-icon" size={20} /> SARIF export for GitHub Security dashboards</li>
                            <li><CheckCircle2 className="story-icon" size={20} /> Recurring scheduled scans with diff-based alerting</li>
                            <li><CheckCircle2 className="story-icon" size={20} /> API and GraphQL introspection-driven testing</li>
                        </ul>
                    </div>

                    <div className="story-visual">
                        <div className="story-visual-card glass-panel">
                            <div className="visual-shield-halo">
                                <Rocket size={80} className="shield-icon" />
                            </div>
                            <div className="story-badge-chip">
                                <span className="pulse-dot"></span>
                                <span>Active development</span>
                            </div>
                        </div>
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
                            <h2 className="cta-title">Try HackSentinel on a real target</h2>
                            <p className="cta-subtitle">Free tier, no card required. Point it at a URL you own and see what falls out.</p>
                            <div className="cta-action-group">
                                <Link to="/signup" className="btn-primary-lg shimmer-hover">
                                    <span>Get Started for Free</span>
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/contact" className="btn-secondary-lg">
                                    <span>Talk to the Team</span>
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

export default AboutPage;
