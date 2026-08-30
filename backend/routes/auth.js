import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import PasswordReset from "../models/PasswordReset.js";

const router = express.Router();

const TOKEN_TTL = "7d";

// ---------------------- SIGNUP ----------------------
router.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password, phone, enable2FA } = req.body;

    if (!fullName || !email || !password || !phone) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // Check if user already exists in main User collection
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email or phone already exists."
      });
    }

    // Check if pending user exists
    const existingPending = await PendingUser.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }]
    });
    if (existingPending) {
      // Delete old pending user and create new one
      await PendingUser.deleteOne({ _id: existingPending._id });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create pending user (not verified yet)
    const pendingUser = await PendingUser.create({
      fullName,
      email: email.toLowerCase(),
      phone,
      passwordHash,
      enable2FA: enable2FA || false,
    });

    return res.status(201).json({
      message: "Please verify your phone number to complete registration.",
      pendingUser: {
        id: pendingUser._id,
        fullName: pendingUser.fullName,
        email: pendingUser.email,
        phone: pendingUser.phone,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again."
    });
  }
});

// ---------------------- SIGNIN ----------------------
router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    // 1) User find karo
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid email or password." });
    }

    // 2) Password verify karo
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Invalid email or password." });
    }

    // 3) 2FA / OTP flow bypassed — proceed straight to JWT issuance.
    // Original 2FA branch (email or phone OTP) is commented out below.
    //
    // if (user.twoFactorEnabled) {
    //   if (user.twoFactorMethod === 'email') {
    //     const { sendOTPEmail } = await import('../utils/mailgun.js');
    //     const otp = Math.floor(100000 + Math.random() * 900000).toString();
    //     user.twoFactorOTP = otp;
    //     user.twoFactorOTPExpiry = new Date(Date.now() + 5 * 60 * 1000);
    //     await user.save();
    //     await sendOTPEmail(user.email, otp, user.fullName);
    //     console.log(`[2FA EMAIL OTP] User: ${user.email}, OTP: ${otp}`);
    //     return res.json({
    //       message: "2FA verification required. OTP sent to your email.",
    //       requires2FA: true,
    //       twoFactorMethod: 'email',
    //       email: user.email,
    //     });
    //   }
    //
    //   return res.json({
    //     message: "2FA verification required. Please verify with OTP sent to your phone.",
    //     requires2FA: true,
    //     twoFactorMethod: 'phone',
    //     email: user.email,
    //     phone: user.phone,
    //   });
    // }

    // 4) JWT generate karo (OTP bypassed)
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, fullName: user.fullName },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: TOKEN_TTL }
    );

    return res.json({
      message: "Sign in successful.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("Signin error:", err);
    return res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- VERIFY 2FA OTP (Firebase) ----------------------
router.post("/verify-2fa-otp", async (req, res) => {
  try {
    const { email, firebaseUid } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if 2FA is enabled for this user
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this account." });
    }

    // Firebase has verified the OTP, we just need to generate the JWT token
    // The firebaseUid confirms that the user successfully verified via Firebase

    // Generate JWT token
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, fullName: user.fullName },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: TOKEN_TTL }
    );

    return res.json({
      message: "2FA verification successful.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("Verify 2FA OTP error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- RESEND 2FA OTP ----------------------
router.post("/resend-2fa-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this account." });
    }

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 5-minute expiry
    user.twoFactorOTP = otp;
    user.twoFactorOTPExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Log OTP for testing
    console.log(`[2FA OTP RESEND] User: ${user.email}, OTP: ${otp}`);

    return res.json({
      message: "New OTP sent successfully.",
    });
  } catch (err) {
    console.error("Resend 2FA OTP error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- VERIFY EMAIL OTP ----------------------
router.post("/verify-email-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required." });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this account." });
    }

    // Check if email OTP method is selected
    if (user.twoFactorMethod !== 'email') {
      return res.status(400).json({ message: "Email OTP is not enabled for this account." });
    }

    // Validate OTP
    if (!user.twoFactorOTP || user.twoFactorOTP !== otp) {
      return res.status(401).json({ message: "Invalid OTP code." });
    }

    // Check expiry
    if (!user.twoFactorOTPExpiry || new Date() > user.twoFactorOTPExpiry) {
      return res.status(401).json({ message: "OTP has expired. Please request a new one." });
    }

    // Clear OTP after successful verification
    user.twoFactorOTP = null;
    user.twoFactorOTPExpiry = null;
    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, fullName: user.fullName },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: TOKEN_TTL }
    );

    return res.json({
      message: "Email OTP verification successful.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    console.error("Verify email OTP error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- RESEND EMAIL OTP ----------------------
router.post("/resend-email-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "2FA is not enabled for this account." });
    }

    if (user.twoFactorMethod !== 'email') {
      return res.status(400).json({ message: "Email OTP is not enabled for this account." });
    }

    const { sendOTPEmail } = await import('../utils/mailgun.js');

    // Generate new 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP with 5-minute expiry
    user.twoFactorOTP = otp;
    user.twoFactorOTPExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    // Send OTP via email
    await sendOTPEmail(user.email, otp, user.fullName);

    console.log(`[2FA EMAIL OTP RESEND] User: ${user.email}, OTP: ${otp}`);

    return res.json({
      message: "New OTP sent to your email successfully.",
    });
  } catch (err) {
    console.error("Resend email OTP error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- VERIFY PHONE (Firebase OTP) ----------------------
router.post("/verify-phone", async (req, res) => {
  try {
    const { email, phone, firebaseUid } = req.body;

    if (!email || !phone) {
      return res.status(400).json({ message: "Email and phone are required." });
    }

    // Find pending user
    const pendingUser = await PendingUser.findOne({
      email: email.toLowerCase(),
      phone
    });

    if (!pendingUser) {
      return res.status(404).json({
        message: "Pending registration not found. Please sign up again."
      });
    }

    // Create actual user in main User collection
    const user = await User.create({
      fullName: pendingUser.fullName,
      email: pendingUser.email,
      phone: pendingUser.phone,
      passwordHash: pendingUser.passwordHash,
      twoFactorEnabled: pendingUser.enable2FA || false,
    });

    // Delete pending user
    await PendingUser.deleteOne({ _id: pendingUser._id });

    // Generate JWT token
    const token = jwt.sign(
      { sub: user._id.toString(), email: user.email, fullName: user.fullName },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: TOKEN_TTL }
    );

    return res.json({
      message: "Phone verified successfully! Account created.",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
      },
      token,
    });
  } catch (err) {
    console.error("Verify phone error:", err);
    return res.status(500).json({
      message: "Something went wrong. Please try again."
    });
  }
});

// ---------------------- FORGOT PASSWORD - EMAIL ----------------------
router.post("/forgot-password-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required." });
    }

    // Check if user exists
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Delete any existing reset tokens for this user
    await PasswordReset.deleteMany({ userId: user._id });

    // Create new reset token (valid for 1 hour)
    await PasswordReset.create({
      userId: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    });

    // In production, send email here
    // For now, just return the reset link
    const resetLink = `http://localhost:5173/reset-password-email?token=${resetToken}`;

    console.log('Password reset link:', resetLink);

    return res.json({
      message: "Password reset link sent to your email.",
      resetLink, // Remove this in production
    });
  } catch (err) {
    console.error("Forgot password email error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- RESET PASSWORD - EMAIL ----------------------
router.post("/reset-password-email", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    // Hash the token to compare with database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find valid reset token
    const resetRecord = await PasswordReset.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({ message: "Invalid or expired reset token." });
    }

    // Find user
    const user = await User.findById(resetRecord.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    // Delete used token
    await PasswordReset.deleteOne({ _id: resetRecord._id });

    return res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset password email error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- CHECK PHONE EXISTS ----------------------
router.post("/check-phone", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required." });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "No account found with this phone number." });
    }

    return res.json({ message: "Phone number verified.", exists: true });
  } catch (err) {
    console.error("Check phone error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- RESET PASSWORD - PHONE ----------------------
router.post("/reset-password-phone", async (req, res) => {
  try {
    const { phone, newPassword } = req.body;

    if (!phone || !newPassword) {
      return res.status(400).json({ message: "Phone and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters." });
    }

    // Find user by phone
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    return res.json({ message: "Password reset successful." });
  } catch (err) {
    console.error("Reset password phone error:", err);
    return res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ---------------------- LOGOUT (Protected) ----------------------
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(200).json({ message: 'Logged out successfully.' });
    }

    const token = authHeader.split(' ')[1];

    // Decode token to get expiry
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return res.status(200).json({ message: 'Logged out successfully.' });
    }

    // Import TokenBlacklist
    const TokenBlacklist = (await import('../models/TokenBlacklist.js')).default;

    // Add token to blacklist
    await TokenBlacklist.create({
      token,
      userId: decoded.sub,
      userType: 'User',
      expiresAt: new Date(decoded.exp * 1000) // Convert to milliseconds
    });

    return res.json({ message: 'Logged out successfully from all devices.' });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(200).json({ message: 'Logged out successfully.' });
  }
});

export default router;
