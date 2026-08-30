import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import "./VerifyAccount.css";
import { authApi } from "./services/api";

const ResetPasswordEmail: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    useEffect(() => {
        if (!token) {
            setPopup({
                isOpen: true,
                title: "Invalid Link",
                message: "Reset link is invalid or expired. Please request a new one.",
                type: "error"
            });
            setTimeout(() => navigate("/forgot-password"), 3000);
        }
    }, [token, navigate]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 8) {
            setPopup({
                isOpen: true,
                title: "Invalid Password",
                message: "Password must be at least 8 characters long",
                type: "error"
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setPopup({
                isOpen: true,
                title: "Passwords Don't Match",
                message: "Please make sure both passwords match",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            if (!token) {
                return;
            }

            await authApi.resetPasswordEmail({
                token,
                newPassword
            });

            setPopup({
                isOpen: true,
                title: "Success! 🎉",
                message: "Your password has been reset successfully. Redirecting to sign in...",
                type: "success"
            });

            setTimeout(() => {
                navigate("/signin");
            }, 2500);
        } catch (error) {
            console.error("Password reset error:", error);
            setPopup({
                isOpen: true,
                title: "Reset Failed",
                message: error instanceof Error ? error.message : "Could not connect to server. Please try again.",
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return null; // Will redirect via useEffect
    }

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
                    <div className="verify-icon" style={{ padding: '12px' }}>
                        <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>

                    <h1 className="verify-title">Reset Your Password</h1>
                    <p className="verify-subtitle">
                        Enter your new password below
                    </p>

                    <form onSubmit={handleResetPassword} className="verify-form">
                        {/* New Password */}
                        <div className="code-input-group" style={{ position: 'relative' }}>
                            <i className="bi bi-lock-fill input-icon"></i>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="New Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="code-input"
                                style={{ paddingRight: '3rem' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94a3b8',
                                    fontSize: '1.25rem'
                                }}
                            >
                                {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                            </button>
                        </div>

                        {/* Confirm Password */}
                        <div className="code-input-group" style={{ position: 'relative' }}>
                            <i className="bi bi-lock-fill input-icon"></i>
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="Confirm New Password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="code-input"
                                style={{ paddingRight: '3rem' }}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '1rem',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94a3b8',
                                    fontSize: '1.25rem'
                                }}
                            >
                                {showConfirmPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                            </button>
                        </div>

                        <button type="submit" className="verify-btn" disabled={loading}>
                            {loading ? "Resetting..." : "Reset Password"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordEmail;
