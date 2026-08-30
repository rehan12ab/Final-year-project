import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { auth } from "./firebase";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import "./VerifyAccount.css";
import { authApi } from "./services/api";

const ResetPasswordOTP: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const phone = searchParams.get('phone');

    const [step, setStep] = useState<'password' | 'otp'>('password');
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [otp, setOtp] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [confirmationResult, setConfirmationResult] = useState<any>(null);

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

    const setupRecaptcha = () => {
        if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(
                auth,
                "recaptcha-container",
                {
                    size: "invisible",
                    callback: () => {
                        console.log("reCAPTCHA verified");
                    },
                }
            );
        }
    };

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!phone) {
            setPopup({
                isOpen: true,
                title: "Invalid Request",
                message: "Phone number not provided",
                type: "error"
            });
            return;
        }

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

        const resolvedPhone = phone;
        setLoading(true);

        try {
            // First verify phone exists in database
            await authApi.checkPhone({ phone: resolvedPhone });

            // Send OTP via Firebase
            setupRecaptcha();
            const appVerifier = (window as any).recaptchaVerifier;
            const result = await signInWithPhoneNumber(auth, resolvedPhone, appVerifier);
            setConfirmationResult(result);

            setPopup({
                isOpen: true,
                title: "OTP Sent! 📱",
                message: `Verification code sent to ${phone}`,
                type: "success"
            });

            setStep('otp');
        } catch (error: any) {
            console.error("Send OTP error:", error);
            let errorMessage = "Failed to send OTP. Please try again.";

            if (error.code === 'auth/too-many-requests') {
                errorMessage = "Too many attempts. Please try again later.";
            } else if (error.code === 'auth/invalid-phone-number') {
                errorMessage = "Invalid phone number format.";
            }

            setPopup({
                isOpen: true,
                title: "Error",
                message: errorMessage,
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!otp || otp.length !== 6) {
            setPopup({
                isOpen: true,
                title: "Invalid OTP",
                message: "Please enter the 6-digit code",
                type: "error"
            });
            return;
        }

        setLoading(true);

        try {
            // Verify OTP with Firebase
            await confirmationResult.confirm(otp);

            // Update password in database
            if (!phone) {
                return;
            }

            await authApi.resetPasswordPhone({
                phone,
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
        } catch (error: any) {
            console.error("Verify OTP error:", error);
            let errorMessage = "Invalid verification code. Please try again.";

            if (error.code === 'auth/invalid-verification-code') {
                errorMessage = "Invalid or expired OTP code.";
            }

            setPopup({
                isOpen: true,
                title: "Verification Failed",
                message: errorMessage,
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    // Password entry screen
    if (step === 'password') {
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
                <div id="recaptcha-container"></div>

                <div className="verify-content">
                    <div className="verify-card">
                        <div className="verify-icon" style={{ padding: '12px' }}>
                            <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                        </div>

                        <h1 className="verify-title">Enter New Password</h1>
                        <p className="verify-subtitle">
                            Phone: {phone}
                        </p>

                        <form onSubmit={handleSendOTP} className="verify-form">
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
                                {loading ? "Sending OTP..." : "Send OTP to Phone"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    // OTP verification screen
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
            <div id="recaptcha-container"></div>

            <div className="verify-content">
                <div className="verify-card">
                    <div className="verify-icon" style={{ padding: '12px' }}>
                        <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>

                    <h1 className="verify-title">Verify OTP</h1>
                    <p className="verify-subtitle">
                        Enter the 6-digit code sent to {phone}
                    </p>

                    <form onSubmit={handleVerifyOTP} className="verify-form">
                        <div className="code-input-group">
                            <i className="bi bi-shield-lock-fill input-icon"></i>
                            <input
                                type="text"
                                placeholder="Enter 6-digit OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="code-input"
                                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                                required
                                maxLength={6}
                            />
                        </div>

                        <button type="submit" className="verify-btn" disabled={loading}>
                            {loading ? "Verifying..." : "Verify & Reset Password"}
                        </button>

                        <div className="verify-footer">
                            <button
                                type="button"
                                onClick={() => setStep('password')}
                                className="resend-link"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                ← Back to Password Entry
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordOTP;
