import React, { useState, useEffect, useRef } from "react";
import "./signin.css";
import Navbar from "./components/Navbar";
import Popup from "./components/Popup";
import { FaEnvelope, FaLock } from "react-icons/fa";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import { Link, useNavigate } from "react-router-dom";
import { auth } from './firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { authApi } from "./services/api";

interface SignInData {
  email: string;
  password: string;
  remember: boolean;
}

interface SignInErrors {
  email?: string;
  password?: string;
}

const SignIn: React.FC = () => {
  const navigate = useNavigate();

  // Popup State
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

  const [formData, setFormData] = useState<SignInData>({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<SignInErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // 2FA States
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [pending2FAEmail, setPending2FAEmail] = useState("");
  const [pending2FAPhone, setPending2FAPhone] = useState("");
  const [userEnteredPhone, setUserEnteredPhone] = useState("");
  const [verifying2FA, setVerifying2FA] = useState(false);
  const [resending2FA, setResending2FA] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMethod, setOtpMethod] = useState<'email' | 'phone' | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (emailRef.current && emailRef.current.value) emailRef.current.parentElement?.classList.add("filled");
    if (passwordRef.current && passwordRef.current.value) passwordRef.current.parentElement?.classList.add("filled");
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
    setApiError(null);

    if (e.target.parentElement) {
      if (value) e.target.parentElement.classList.add("filled");
      else e.target.parentElement.classList.remove("filled");
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check for admin session conflict
    const adminToken = localStorage.getItem("hs_admin_token");
    if (adminToken) {
      setPopup({
        isOpen: true,
        title: "Access Denied",
        message: "Admin session is active. Please logout from admin panel first to signin as user.",
        type: "error"
      });
      return;
    }

    const newErrors: SignInErrors = {};
    if (!formData.email) newErrors.email = "Email is required";
    if (!formData.password) newErrors.password = "Password is required";

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      return;
    }

    try {
      setSubmitting(true);
      setApiError(null);

      const data = await authApi.signin({
        email: formData.email,
        password: formData.password,
      });

      // 2FA / OTP flow bypassed — backend now returns { token, user } directly on password success.
      // Original 2FA branch commented out below.
      //
      // if (data.requires2FA) {
      //   setPending2FAEmail(data.email || "");
      //   setPending2FAPhone(data.phone || "");
      //   setOtpMethod(data.twoFactorMethod || 'phone');
      //   setShow2FAModal(true);
      //   setOtpSent(false);
      //   setConfirmationResult(null);
      //
      //   if (data.twoFactorMethod === 'phone') {
      //     setTimeout(() => { setupRecaptcha2FA(); }, 100);
      //   } else if (data.twoFactorMethod === 'email') {
      //     setOtpSent(true);
      //   }
      //
      //   const actionText = data.twoFactorMethod === 'email' ? 'OTP has been sent to your email' : "Click 'Send OTP' to receive verification code";
      //   setPopup({
      //     isOpen: true,
      //     title: "2FA Required 🔒",
      //     message: actionText,
      //     type: "info"
      //   });
      //   return;
      // }

      if (data.token) {
        localStorage.setItem("hs_auth_token", data.token);
      }

      setPopup({
        isOpen: true,
        title: "Welcome Back!",
        message: "You have successfully signed in.",
        type: "success"
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err) {
      console.error("Sign in request failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to reach the server. Please try again in a moment.";
      setApiError(message);
      setPopup({
        isOpen: true,
        title: "Sign In Failed",
        message,
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Setup reCAPTCHA for Firebase 2FA
  const setupRecaptcha2FA = () => {
    try {
      // Clear existing verifier if it exists
      if ((window as any).recaptchaVerifier2FA) {
        try {
          (window as any).recaptchaVerifier2FA.clear();
        } catch (error) {
          console.error("Error clearing existing reCAPTCHA:", error);
        }
        (window as any).recaptchaVerifier2FA = null;
      }

      // Ensure the container exists in DOM
      const container = document.getElementById('recaptcha-container-2fa');
      if (!container) {
        console.error("reCAPTCHA container not found");
        return;
      }

      // Create new verifier
      (window as any).recaptchaVerifier2FA = new RecaptchaVerifier(auth, 'recaptcha-container-2fa', {
        'size': 'invisible',
        'callback': () => {
          console.log("reCAPTCHA solved for 2FA");
        }
      });
    } catch (error) {
      console.error("reCAPTCHA setup error:", error);
    }
  };

  // Send OTP via Firebase for 2FA
  const sendOTP2FA = async () => {
    const phoneToUse = userEnteredPhone ? `+${userEnteredPhone}` : pending2FAPhone;

    if (!phoneToUse || phoneToUse.length < 10) {
      setPopup({
        isOpen: true,
        title: "Invalid Phone",
        message: "Please enter a valid phone number with country code.",
        type: "error"
      });
      return;
    }

    setResending2FA(true);

    try {
      const appVerifier = (window as any).recaptchaVerifier2FA;
      if (!appVerifier) {
        setupRecaptcha2FA();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const result = await signInWithPhoneNumber(auth, phoneToUse, (window as any).recaptchaVerifier2FA);
      setConfirmationResult(result);
      setOtpSent(true);

      setPopup({
        isOpen: true,
        title: "OTP Sent! 📱",
        message: `Verification code sent to ${phoneToUse}`,
        type: "success"
      });
    } catch (error: any) {
      console.error("Firebase SMS send error:", error);
      setPopup({
        isOpen: true,
        title: "Failed to Send OTP",
        message: error.message || "Could not send verification code. Please try again.",
        type: "error"
      });

      // Reset reCAPTCHA on error
      setupRecaptcha2FA();
    } finally {
      setResending2FA(false);
    }
  };

  // Handle 2FA OTP Verification with Firebase
  const handleVerify2FA = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setPopup({
        isOpen: true,
        title: "Invalid OTP",
        message: "Please enter a valid 6-digit OTP code.",
        type: "error"
      });
      return;
    }

    if (!confirmationResult) {
      setPopup({
        isOpen: true,
        title: "Error",
        message: "Please request OTP first.",
        type: "error"
      });
      return;
    }

    try {
      setVerifying2FA(true);

      // Verify OTP with Firebase
      const result = await confirmationResult.confirm(otpCode);
      const firebaseUid = result.user.uid;

      // Call backend to get JWT token
      const data = await authApi.verify2FAOtp({
        email: pending2FAEmail,
        firebaseUid,
      });

      if (data.token) {
        localStorage.setItem("hs_auth_token", data.token);
      }

      // Cleanup
      setShow2FAModal(false);
      setOtpCode("");
      setPending2FAEmail("");
      setPending2FAPhone("");
      setOtpSent(false);
      setConfirmationResult(null);

      setPopup({
        isOpen: true,
        title: "Welcome Back! 🎉",
        message: "2FA verification successful. Signing you in...",
        type: "success"
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error("2FA verification failed:", err);
      setPopup({
        isOpen: true,
        title: "Invalid OTP",
        message: err.message || "The code you entered is incorrect. Please try again.",
        type: "error"
      });
    } finally {
      setVerifying2FA(false);
    }
  };

  // Handle Resend OTP (same as send)
  const handleResendOTP = () => {
    setOtpCode("");
    if (otpMethod === 'email') {
      resendEmailOTP();
    } else {
      sendOTP2FA();
    }
  };

  // Send Email OTP
  const sendEmailOTP = async () => {
    setResending2FA(true);

    try {
      await authApi.resendEmailOtp({
        email: pending2FAEmail,
      });

      setOtpSent(true);
      setPopup({
        isOpen: true,
        title: "OTP Sent! 📧",
        message: `Verification code sent to ${pending2FAEmail}`,
        type: "success"
      });
    } catch (error: any) {
      console.error("Email OTP send error:", error);
      setPopup({
        isOpen: true,
        title: "Failed to Send OTP",
        message: "Could not send verification code. Please try again.",
        type: "error"
      });
    } finally {
      setResending2FA(false);
    }
  };

  // Resend Email OTP
  const resendEmailOTP = async () => {
    setOtpCode("");
    await sendEmailOTP();
  };

  // Verify Email OTP
  const handleVerifyEmailOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setPopup({
        isOpen: true,
        title: "Invalid OTP",
        message: "Please enter a valid 6-digit OTP code.",
        type: "error"
      });
      return;
    }

    try {
      setVerifying2FA(true);

      const data = await authApi.verifyEmailOtp({
        email: pending2FAEmail,
        otp: otpCode,
      });

      if (data.token) {
        localStorage.setItem("hs_auth_token", data.token);
      }

      // Cleanup
      setShow2FAModal(false);
      setOtpCode("");
      setPending2FAEmail("");
      setOtpMethod(null);
      setOtpSent(false);

      setPopup({
        isOpen: true,
        title: "Welcome Back! 🎉",
        message: "2FA verification successful. Signing you in...",
        type: "success"
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (err: any) {
      console.error("Email OTP verification failed:", err);
      setPopup({
        isOpen: true,
        title: "Invalid OTP",
        message: "The code you entered is incorrect. Please try again.",
        type: "error"
      });
    } finally {
      setVerifying2FA(false);
    }
  };

  return (
    <div className="signin-page">
      <Navbar />
      <Popup
        isOpen={popup.isOpen}
        onClose={() => setPopup({ ...popup, isOpen: false })}
        title={popup.title}
        message={popup.message}
        type={popup.type}
      />
      <div className="auth-content">
        {/* LEFT SIDE */}
        <div className="signin-left">
          <div className="glow-badge" style={{ marginBottom: '1.5rem', width: 'fit-content' }}>
            Enterprise Access
          </div>
          <h1 className="signin-left-title">Welcome Back to <span className="text-gradient">HackSentinel</span></h1>
          <p className="signin-left-desc">
            Sign in to continue monitoring your web assets, review threat alerts, and dispatch automated security scans.
          </p>

          <div className="signin-left-features">
            <div className="feature-box">
              <div className="feature-icon-halo indigo">
                <FaLock />
              </div>
              <div>
                <h4>Fortified Authentication</h4>
                <p>Protected by cryptographic JWT validation and multi-factor 2FA</p>
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-icon-halo cyan">
                <FaEnvelope />
              </div>
              <div>
                <h4>Real-Time Alert Feed</h4>
                <p>Instant telemetry notifications when vulnerabilities are discovered</p>
              </div>
            </div>
            <div className="feature-box">
              <div className="feature-icon-halo violet">
                <FaLock />
              </div>
              <div>
                <h4>Audit-Ready Reports</h4>
                <p>Export compliance PDF and DOCX reports with a single click</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE FORM */}
        <div className="signin-right">
          <form onSubmit={handleSubmit} className="signin-form glass-card">
            <div className="auth-form-header">
              <div className="auth-logo-badge">
                <img src="/logo.png" alt="HackSentinel Logo" className="auth-logo-img" />
              </div>
              <h1 className="signin-title">Sign In to Your Account</h1>
              <p className="signin-subtitle">Enter your credentials to access your security dashboard</p>
            </div>
            {apiError && <div className="api-error-banner">{apiError}</div>}

            {/* Email */}
            <div className={`form-group`}>
              <label>Email</label>
              <div className="input-wrapper">
                <FaEnvelope className="input-icon" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="form-input"
                  ref={emailRef}
                  autoComplete="email"
                />
              </div>
              {errors.email && <span className="error">{errors.email}</span>}
            </div>

            {/* Password */}
            <div className={`form-group`}>
              <label>Password</label>
              <div className="input-wrapper">
                <FaLock className="input-icon" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="form-input"
                  ref={passwordRef}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </button>
              </div>
              {errors.password && <span className="error">{errors.password}</span>}
            </div>

            {/* Remember Me */}
            <label className="terms-label">
              <input
                type="checkbox"
                name="remember"
                checked={formData.remember}
                onChange={handleChange}
              />
              Remember Me
            </label>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? "Signing in..." : "Sign In"}
            </button>

            {/* Forgot Password Link */}
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link
                to="/forgot-password"
                style={{
                  color: '#7c3aed',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: 500
                }}
              >
                Forgot Password?
              </Link>
            </div>

            <p className="signin-text">
              Don't have an account?{" "}
              <Link to="/signup" className="signin-link">
                Sign Up
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* 2FA OTP Verification Modal */}
      {show2FAModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div id="recaptcha-container-2fa"></div>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2.5rem',
            maxWidth: '420px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '70px',
                height: '70px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                padding: '10px'
              }}>
                <img src="/logo.png" alt="HackSentinel Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
              </div>
              <h2 style={{ color: '#1e1b4b', fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Two-Factor Authentication
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
                {otpSent
                  ? `Enter the 6-digit OTP sent to your ${otpMethod === 'email' ? 'email' : 'phone'}`
                  : 'Verify your identity with OTP'}
              </p>
            </div>

            {/* Phone Number Input with Country Code (Only for Phone OTP) */}
            {!otpSent && otpMethod === 'phone' && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#64748b',
                  fontSize: '0.9rem',
                  fontWeight: 500
                }}>
                  Enter your phone number
                </label>
                <PhoneInput
                  country={'pk'}
                  value={userEnteredPhone || pending2FAPhone?.replace('+', '')}
                  onChange={(phone) => setUserEnteredPhone(phone)}
                  enableSearch={true}
                  searchPlaceholder="Search country..."
                  inputStyle={{
                    width: '100%',
                    height: '50px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                    border: '2px solid #e5e7eb',
                    paddingLeft: '60px'
                  }}
                  buttonStyle={{
                    borderRadius: '12px 0 0 12px',
                    border: '2px solid #e5e7eb',
                    borderRight: 'none',
                    background: 'white'
                  }}
                  dropdownStyle={{
                    borderRadius: '12px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
                  }}
                  searchStyle={{
                    borderRadius: '8px'
                  }}
                  containerStyle={{
                    width: '100%'
                  }}
                />
                <p style={{
                  color: '#94a3b8',
                  fontSize: '0.8rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <i className="bi bi-info-circle"></i>
                  OTP will be sent to this number via SMS
                </p>
              </div>
            )}

            {/* Email OTP Info (Only for Email OTP) */}
            {!otpSent && otpMethod === 'email' && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.05) 100%)',
                padding: '1rem',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <i className="bi bi-envelope-fill" style={{ color: '#667eea', fontSize: '1.2rem' }}></i>
                <div>
                  <p style={{ color: '#1e1b4b', fontWeight: 600, margin: 0, fontSize: '0.95rem' }}>
                    OTP will be sent to:
                  </p>
                  <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>
                    {pending2FAEmail}
                  </p>
                </div>
              </div>
            )}

            {/* Show destination when OTP sent */}
            {otpSent && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <i className="bi bi-check-circle-fill" style={{ color: '#10b981' }}></i>
                <span style={{ color: '#1e1b4b', fontWeight: 500 }}>
                  {otpMethod === 'email'
                    ? `OTP sent to ${pending2FAEmail}`
                    : `OTP sent to +${userEnteredPhone || pending2FAPhone?.replace('+', '')}`}
                </span>
              </div>
            )}

            {otpSent ? (
              <>
                {/* OTP Input */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setOtpCode(value);
                    }}
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1.5rem',
                      textAlign: 'center',
                      letterSpacing: '0.5rem',
                      border: '2px solid #e5e7eb',
                      borderRadius: '12px',
                      outline: 'none',
                      fontWeight: 600,
                      color: '#1e1b4b'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#7c3aed'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>

                {/* Verify Button */}
                <button
                  onClick={otpMethod === 'email' ? handleVerifyEmailOTP : handleVerify2FA}
                  disabled={verifying2FA || otpCode.length !== 6}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: otpCode.length === 6
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : '#e5e7eb',
                    color: otpCode.length === 6 ? 'white' : '#94a3b8',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: otpCode.length === 6 ? 'pointer' : 'not-allowed',
                    marginBottom: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {verifying2FA ? (
                    <>
                      <div style={{
                        width: '18px',
                        height: '18px',
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderTop: '2px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></div>
                      Verifying...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-check-circle-fill"></i>
                      Verify OTP
                    </>
                  )}
                </button>

                {/* Resend OTP */}
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                    Didn't receive the code?
                  </p>
                  <button
                    onClick={handleResendOTP}
                    disabled={resending2FA}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#7c3aed',
                      fontWeight: 600,
                      cursor: resending2FA ? 'wait' : 'pointer',
                      fontSize: '0.95rem'
                    }}
                  >
                    {resending2FA ? 'Sending...' : 'Resend OTP'}
                  </button>
                </div>
              </>
            ) : (
              /* Send OTP Button */
              <button
                onClick={otpMethod === 'email' ? sendEmailOTP : sendOTP2FA}
                disabled={resending2FA}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: resending2FA ? 'wait' : 'pointer',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {resending2FA ? (
                  <>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <i className="bi bi-send-fill"></i>
                    Send OTP via {otpMethod === 'email' ? 'Email' : 'SMS'}
                  </>
                )}
              </button>
            )}

            {/* Cancel Button */}
            <button
              onClick={() => {
                setShow2FAModal(false);
                setOtpCode('');
                setPending2FAEmail('');
                setPending2FAPhone('');
                setUserEnteredPhone('');
                setOtpSent(false);
                setConfirmationResult(null);
                // Clear reCAPTCHA
                if ((window as any).recaptchaVerifier2FA) {
                  try {
                    (window as any).recaptchaVerifier2FA.clear();
                  } catch (e) { }
                  (window as any).recaptchaVerifier2FA = null;
                }
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: '1rem'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default SignIn;
