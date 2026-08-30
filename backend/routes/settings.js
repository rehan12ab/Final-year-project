import express from "express";
import User from "../models/User.js";
import verifyToken from "../middleware/auth.js";
import bcrypt from "bcrypt";
import Notification from "../models/Notification.js";

const router = express.Router();

// Helper to create notification
const createNotification = async (userId, type, title, message, icon) => {
    try {
        await Notification.create({
            userId,
            type,
            title,
            message,
            icon: icon || 'bi-bell',
            read: false
        });
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};

// Get user profile
router.get("/profile", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-passwordHash');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                phone: user.phone,
                subscription: user.subscription,
                paymentMethod: user.paymentMethod ? {
                    cardHolderName: user.paymentMethod.cardHolderName,
                    cardNumberLast4: user.paymentMethod.cardNumberLast4,
                    expiryDate: user.paymentMethod.expiryDate,
                    cardType: user.paymentMethod.cardType
                } : null
            }
        });
    } catch (error) {
        console.error("Get profile error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Update email
router.post("/update-email", verifyToken, async (req, res) => {
    try {
        const { newEmail } = req.body;

        if (!newEmail) {
            return res.status(400).json({ message: "New email is required" });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: newEmail.toLowerCase() });
        if (existingUser && existingUser._id.toString() !== req.userId) {
            return res.status(409).json({ message: "Email already in use" });
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { email: newEmail.toLowerCase() },
            { new: true }
        ).select('-passwordHash');

        return res.json({
            message: "Email updated successfully",
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email
            }
        });
    } catch (error) {
        console.error("Update email error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Update password
router.post("/update-password", verifyToken, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new passwords are required" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }

        // Hash and update new password
        const passwordHash = await bcrypt.hash(newPassword, 10);
        user.passwordHash = passwordHash;
        await user.save();

        return res.json({ message: "Password updated successfully. Please sign in again." });
    } catch (error) {
        console.error("Update password error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Update payment method
router.post("/update-payment", verifyToken, async (req, res) => {
    try {
        const { cardHolderName, cardNumberLast4, expiryDate, cardType } = req.body;

        if (!cardHolderName || !cardNumberLast4 || !expiryDate) {
            return res.status(400).json({ message: "All payment fields are required" });
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            {
                paymentMethod: {
                    cardHolderName,
                    cardNumberLast4,
                    expiryDate,
                    cardType: cardType || 'Unknown'
                }
            },
            { new: true }
        ).select('-passwordHash');

        return res.json({
            message: "Payment method updated successfully",
            paymentMethod: user.paymentMethod
        });
    } catch (error) {
        console.error("Update payment error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Toggle 2FA
router.post("/toggle-2fa", verifyToken, async (req, res) => {
    try {
        const { enable } = req.body;

        if (typeof enable !== 'boolean') {
            return res.status(400).json({ message: "Enable parameter must be a boolean" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.twoFactorEnabled = enable;

        // Clear any existing OTP when disabling 2FA
        if (!enable) {
            user.twoFactorOTP = null;
            user.twoFactorOTPExpiry = null;
        }

        await user.save();

        // Create security notification
        await createNotification(
            req.userId,
            'security',
            enable ? '2FA Enabled' : '2FA Disabled',
            enable
                ? 'Two-Factor Authentication has been enabled on your account. Your account is now more secure.'
                : 'Two-Factor Authentication has been disabled on your account.',
            enable ? 'bi-shield-check' : 'bi-shield-exclamation'
        );

        return res.json({
            message: enable ? "Two-Factor Authentication enabled" : "Two-Factor Authentication disabled",
            twoFactorEnabled: user.twoFactorEnabled
        });
    } catch (error) {
        console.error("Toggle 2FA error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Get 2FA status
router.get("/2fa-status", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('twoFactorEnabled');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({
            twoFactorEnabled: user.twoFactorEnabled || false
        });
    } catch (error) {
        console.error("Get 2FA status error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

export default router;
