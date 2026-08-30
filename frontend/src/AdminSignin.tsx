import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./AdminSignin.css";
import Popup from "./components/Popup";

const AdminSignin = () => {
    const navigate = useNavigate();

    const [step, setStep] = useState<'signin' | 'otp-verify'>('signin');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [adminId, setAdminId] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

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

    // Handle admin signin
    const handleSignin = async (e: React.FormEvent) => {
        e.preventDefault();



        setLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/admin/signin`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setPopup({
                    isOpen: true,
                    title: "Signin Failed",
                    message: data.message || "Invalid credentials",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            // OTP flow bypassed — backend now returns { token, admin } directly on password success.
            // Original OTP trigger commented out below.
            //
            // if (data.requiresOTP) {
            //     setAdminId(data.adminId);
            //     // Automatically send email OTP
            //     sendEmailOTP(data.adminId);
            // }

            if (data.token) {
                localStorage.setItem("hs_admin_token", data.token);
                localStorage.setItem("hs_admin_info", JSON.stringify(data.admin));

                setPopup({
                    isOpen: true,
                    title: "Success",
                    message: "Admin signin successful!",
                    type: "success",
                });

                setTimeout(() => {
                    navigate("/admin/dashboard");
                }, 1000);
            }
        } catch (error) {
            setPopup({
                isOpen: true,
                title: "Error",
                message: "Something went wrong. Please try again.",
                type: "error",
            });
            setLoading(false);
        }
    };

    // Send Email OTP
    const sendEmailOTP = async (id: string) => {
        setLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/admin/send-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminId: id, method: 'email' }),
            });

            const data = await response.json();

            if (!response.ok) {
                setPopup({
                    isOpen: true,
                    title: "Error",
                    message: data.message || "Failed to send OTP",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            setPopup({
                isOpen: true,
                title: "OTP Sent",
                message: "Check your email for the verification code",
                type: "success",
            });
            setStep('otp-verify');
        } catch (error: any) {
            setPopup({
                isOpen: true,
                title: "Error",
                message: error.message || "Failed to send OTP",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    // Verify OTP
    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${import.meta.env.VITE_API_BASE || "http://localhost:5000"}/api/admin/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ adminId, otp, method: 'email' }),
            });

            const data = await response.json();

            if (!response.ok) {
                setPopup({
                    isOpen: true,
                    title: "Verification Failed",
                    message: data.message || "Invalid OTP",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            // Store token and redirect
            localStorage.setItem("hs_admin_token", data.token);
            localStorage.setItem("hs_admin_info", JSON.stringify(data.admin));

            setPopup({
                isOpen: true,
                title: "Success",
                message: "Admin signin successful!",
                type: "success",
            });

            setTimeout(() => {
                navigate("/admin/dashboard");
            }, 1500);
        } catch (error: any) {
            setPopup({
                isOpen: true,
                title: "Error",
                message: error.message || "Verification failed",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-signin-outer">
            <Popup
                isOpen={popup.isOpen}
                onClose={() => setPopup({ ...popup, isOpen: false })}
                title={popup.title}
                message={popup.message}
                type={popup.type}
            />

            <div className="admin-split-layout">
                {/* Brand Section (Left) */}
                <div className="admin-brand-section">
                    <div className="brand-content">
                        <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                            <span>HackSentinel</span>
                        </div>
                        
                        <div className="brand-hero-text">
                            <h1>Autonomous <br /><span>Cybersecurity</span><br /> Platform</h1>
                            <p>Enter the command center to manage platform security, user intelligence, and real-time threat monitoring.</p>
                        </div>

                        <div className="brand-features">
                            <div className="feature-item">
                                <i className="bi bi-check-circle-fill"></i>
                                <div>
                                    <h5>Automated Security Testing</h5>
                                    <p>Continuous vulnerability scanning and red-teaming simulations.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <i className="bi bi-cpu-fill"></i>
                                <div>
                                    <h5>AI-powered Analysis</h5>
                                    <p>Real-time threat detection using proprietary neural networks.</p>
                                </div>
                            </div>
                            <div className="feature-item">
                                <i className="bi bi-safe2-fill"></i>
                                <div>
                                    <h5>Enterprise-grade Reliability</h5>
                                    <p>99.9% uptime with global compliance and sovereign data nodes.</p>
                                </div>
                            </div>
                        </div>

                        <div className="brand-footer">
                            <p>© 2024 HackSentinel AI. All rights reserved. Secure Infrastructure V4.2</p>
                        </div>
                    </div>
                </div>

                {/* Form Section (Right) */}
                <div className="admin-form-section">
                    <div className="admin-signin-card">
                        {/* Mobile Only Logo */}
                        <div className="mobile-logo-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '30px', height: '30px', objectFit: 'contain' }} />
                            <span>HackSentinel</span>
                        </div>

                        <div className="admin-signin-header">
                            <h2>Welcome Back</h2>
                            <p>Sign-in to your administrative account to continue</p>
                        </div>

                        {step === 'signin' && (
                            <form onSubmit={handleSignin} className="admin-signin-form">
                                <div className="form-group-premium">
                                    <label>Email Address</label>
                                    <div className="input-wrapper">
                                        <i className="bi bi-envelope"></i>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@hacksentinel.com"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group-premium">
                                    <div className="label-row">
                                        <label>Password</label>
                                        <span className="forgot-link">Forgot Password?</span>
                                    </div>
                                    <div className="input-wrapper">
                                        <i className="bi bi-lock"></i>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                        />
                                        <i 
                                            className={`bi ${showPassword ? 'bi-eye' : 'bi-eye-slash'} toggle-pass`}
                                            onClick={() => setShowPassword(!showPassword)}
                                        ></i>
                                    </div>
                                </div>

                                <div className="keep-signed-in">
                                    <input type="checkbox" id="keep-signed" />
                                    <label htmlFor="keep-signed">Keep me signed in</label>
                                </div>

                                <button type="submit" className="admin-signin-btn-premium" disabled={loading}>
                                    {loading ? "Signing In..." : "Sign In"}
                                </button>
                            </form>
                        )}

                        {step === 'otp-verify' && (
                            <form onSubmit={handleVerifyOTP} className="admin-signin-form">
                                <h3>Enter Verification Code</h3>
                                <p>We sent a 6-digit code to your email</p>

                                <div className="form-group-premium">
                                    <div className="input-wrapper">
                                        <input
                                            type="text"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="000000"
                                            maxLength={6}
                                            required
                                            className="otp-input-premium"
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="admin-signin-btn-premium" disabled={loading}>
                                    {loading ? "Verifying..." : "Verify & Sign In"}
                                </button>

                                <button
                                    type="button"
                                    className="resend-btn-premium"
                                    onClick={() => sendEmailOTP(adminId)}
                                    disabled={loading}
                                >
                                    <i className="bi bi-arrow-clockwise"></i> Resend OTP
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSignin;
