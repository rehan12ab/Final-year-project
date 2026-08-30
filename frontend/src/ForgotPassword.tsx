import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import { FaEnvelope, FaPhone } from "react-icons/fa";
import "./VerifyAccount.css";
import { authApi } from "./services/api";

type ResetMethod = 'email' | 'phone' | null;

const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const [resetMethod, setResetMethod] = useState<ResetMethod>(null);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [countryCode, setCountryCode] = useState("+92");
    const [loading, setLoading] = useState(false);

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

    const handleEmailReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email) {
            setPopup({
                isOpen: true,
                title: "Email Required",
                message: "Please enter your email address",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            await authApi.forgotPasswordEmail({ email });

            setPopup({
                isOpen: true,
                title: "Email Sent! 📧",
                message: "Password reset link has been sent to your email. Please check your inbox.",
                type: "success"
            });

            setTimeout(() => {
                navigate("/signin");
            }, 3000);
        } catch (error) {
            console.error("Password reset error:", error);
            setPopup({
                isOpen: true,
                title: "Error",
                message: error instanceof Error ? error.message : "Could not connect to server. Please try again.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handlePhoneReset = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!phone) {
            setPopup({
                isOpen: true,
                title: "Phone Required",
                message: "Please enter your phone number",
                type: "error"
            });
            return;
        }

        const fullPhone = countryCode + phone;

        // Navigate to OTP reset page
        navigate(`/reset-password-otp?phone=${encodeURIComponent(fullPhone)}`);
    };

    // Method selection screen
    if (!resetMethod) {
        return (
            <div className="verify-account-page">
                <Navbar />
                <Popup
                    isOpen={popup.isOpen}
                    onClose={() => setPopup({ ...popup, isOpen: false })}
                    title={popup.title}
                    message={popup.message}
                    type={popup.type}
                />

                <div className="verify-content">
                    <div className="verify-card">
                        <div className="verify-icon" style={{ padding: '15px' }}>
                            <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>

                        <h1 className="verify-title">Forgot Password</h1>
                        <p className="verify-subtitle">
                            Choose how you want to reset your password
                        </p>

                        <div className="method-selection-grid">
                            <button
                                onClick={() => setResetMethod('email')}
                                className="method-btn email"
                            >
                                <div className="method-icon-wrap">
                                    <FaEnvelope />
                                </div>
                                <div className="method-info">
                                    <strong>Reset via Email</strong>
                                    <span>We'll send a secure link to your inbox</span>
                                </div>
                                <i className="bi bi-chevron-right"></i>
                            </button>

                            <button
                                onClick={() => setResetMethod('phone')}
                                className="method-btn phone"
                            >
                                <div className="method-icon-wrap">
                                    <FaPhone />
                                </div>
                                <div className="method-info">
                                    <strong>Reset via Phone</strong>
                                    <span>Receive a one-time OTP code</span>
                                </div>
                                <i className="bi bi-chevron-right"></i>
                            </button>
                        </div>

                        <div className="verify-footer" style={{ marginTop: '2rem' }}>
                            <Link to="/signin" className="resend-link">
                                Back to Sign In
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Email reset screen
    if (resetMethod === 'email') {
        return (
            <div className="verify-account-page">
                <Navbar />
                <Popup
                    isOpen={popup.isOpen}
                    onClose={() => setPopup({ ...popup, isOpen: false })}
                    title={popup.title}
                    message={popup.message}
                    type={popup.type}
                />

                <div className="verify-content">
                    <div className="verify-card">
                        <div className="verify-icon secondary" style={{ padding: '12px' }}>
                            <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>

                        <h1 className="verify-title">Reset via Email</h1>
                        <p className="verify-subtitle">
                            Enter your email to receive a password reset link
                        </p>

                        <form onSubmit={handleEmailReset} className="verify-form">
                            <div className="code-input-group">
                                <i className="bi bi-envelope-fill input-icon"></i>
                                <input
                                    type="email"
                                    placeholder="Enter your email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="code-input"
                                    required
                                />
                            </div>

                            <button type="submit" className="verify-btn" disabled={loading}>
                                {loading ? "Sending..." : "Send Reset Link"}
                            </button>

                            <div className="verify-footer">
                                <button
                                    type="button"
                                    onClick={() => setResetMethod(null)}
                                    className="resend-link"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    ← Choose Another Method
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // Phone reset screen
    if (resetMethod === 'phone') {
        return (
            <div className="verify-account-page">
                <Navbar />
                <Popup
                    isOpen={popup.isOpen}
                    onClose={() => setPopup({ ...popup, isOpen: false })}
                    title={popup.title}
                    message={popup.message}
                    type={popup.type}
                />

                <div className="verify-content">
                    <div className="verify-card">
                        <div className="verify-icon secondary" style={{ padding: '12px' }}>
                            <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>

                        <h1 className="verify-title">Reset via Phone</h1>
                        <p className="verify-subtitle">
                            Enter your phone number to receive an OTP
                        </p>

                        <form onSubmit={handlePhoneReset} className="verify-form">
                            <div className="phone-reset-group">
                                <select
                                    value={countryCode}
                                    onChange={(e) => setCountryCode(e.target.value)}
                                    className="country-select-minimal"
                                >
                                    <option value="+92">+92 (PK)</option>
                                    <option value="+91">+91 (IN)</option>
                                    <option value="+1">+1 (US)</option>
                                    <option value="+44">+44 (UK)</option>
                                </select>
                                <input
                                    type="tel"
                                    placeholder="Phone number"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                    className="phone-input-minimal"
                                    required
                                    maxLength={10}
                                />
                            </div>

                            <button type="submit" className="verify-btn">
                                Continue
                            </button>

                            <div className="verify-footer">
                                <button
                                    type="button"
                                    onClick={() => setResetMethod(null)}
                                    className="resend-link"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                >
                                    ← Choose Another Method
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default ForgotPassword;
