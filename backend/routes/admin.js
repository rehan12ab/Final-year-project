import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import AdminOTP from "../models/AdminOTP.js";
import User from "../models/User.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { adminSigninLimiter, otpLimiter, adminApiLimiter } from "../middleware/rateLimiter.js";
import upload from '../middleware/upload.js';
import { processNotificationImage } from '../utils/imageProcessor.js';
import ScanResult from '../models/ScanResult.js';
import ScanHistory from '../models/ScanHistory.js';
import Notification from '../models/Notification.js';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const TOKEN_TTL = "7d";

// ---------------------- ADMIN SIGNIN ----------------------
router.post("/signin", adminSigninLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        console.log(`[ADMIN LOGIN ATTEMPT] Email: ${email}`);

        // Find admin
        const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
        if (!admin) {
            console.log(`[ADMIN LOGIN FAILED] Admin not found for email: ${email}`);
            return res.status(401).json({ message: "Invalid email or password." });
        }

        console.log(`[ADMIN LOGIN DEBUG] Admin found: ${admin.fullName}, Active: ${admin.isActive}`);

        // Check if admin is active
        if (!admin.isActive) {
            console.log(`[ADMIN LOGIN FAILED] Admin account deactivated: ${email}`);
            return res.status(403).json({ message: "Admin account is deactivated." });
        }

        // Verify password
        const isMatch = await admin.comparePassword(password);
        console.log(`[ADMIN LOGIN DEBUG] Password Match: ${isMatch}`);
        
        if (!isMatch) {
            console.log(`[ADMIN LOGIN FAILED] Password mismatch for: ${email}`);
            return res.status(401).json({ message: "Invalid email or password." });
        }

        // OTP verification bypassed — issue JWT immediately after password check.
        // Original OTP-required response is commented out below.
        //
        // return res.json({
        //     message: "Admin authenticated. Please select OTP delivery method.",
        //     requiresOTP: true,
        //     adminId: admin._id,
        //     email: admin.email,
        //     phone: admin.phone,
        // });

        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign(
            {
                sub: admin._id.toString(),
                email: admin.email,
                fullName: admin.fullName,
                role: admin.role,
                isAdmin: true
            },
            process.env.JWT_SECRET || "dev-secret",
            { expiresIn: TOKEN_TTL }
        );

        return res.json({
            message: "Admin signin successful.",
            admin: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
            },
            token,
        });
    } catch (err) {
        console.error("Admin signin error:", err);
        return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ---------------------- SEND OTP ----------------------
router.post("/send-otp", otpLimiter, async (req, res) => {
    try {
        const { adminId, method } = req.body;

        if (!adminId || !method) {
            return res.status(400).json({ message: "Admin ID and method are required." });
        }

        if (!['email', 'phone'].includes(method)) {
            return res.status(400).json({ message: "Invalid OTP method." });
        }

        // Find admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete any existing OTPs for this admin
        await AdminOTP.deleteMany({ adminId: admin._id });

        // Create new OTP
        await AdminOTP.create({
            adminId: admin._id,
            otp,
            method,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        });

        // Send OTP based on method
        if (method === 'email') {
            // Import mailgun utility
            const { sendOTPEmail } = await import('../utils/mailgun.js');
            console.log(`[ADMIN EMAIL OTP] Admin: ${admin.email}, OTP: ${otp}`);
            await sendOTPEmail(admin.email, otp, admin.fullName);

            return res.json({
                message: "OTP sent to your email successfully.",
                method: 'email'
            });
        } else {
            // For phone, return phone number for Firebase verification
            console.log(`[ADMIN PHONE OTP] Admin: ${admin.phone}, OTP: ${otp}`);

            return res.json({
                message: "Please verify with OTP sent to your phone.",
                method: 'phone',
                phone: admin.phone,
            });
        }
    } catch (err) {
        console.error("Send OTP error:", err);
        return res.status(500).json({ message: "Failed to send OTP. Please try again." });
    }
});

// ---------------------- VERIFY OTP ----------------------
router.post("/verify-otp", async (req, res) => {
    try {
        const { adminId, otp, method } = req.body;

        if (!adminId || !otp) {
            return res.status(400).json({ message: "Admin ID and OTP are required." });
        }

        // Find admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        // Find OTP record
        const otpRecord = await AdminOTP.findOne({
            adminId: admin._id,
            otp,
            method,
            verified: false,
        });

        if (!otpRecord) {
            return res.status(401).json({ message: "Invalid OTP code." });
        }

        // Check if OTP expired
        if (new Date() > otpRecord.expiresAt) {
            await AdminOTP.deleteOne({ _id: otpRecord._id });
            return res.status(401).json({ message: "OTP has expired. Please request a new one." });
        }

        // Mark OTP as verified and delete
        await AdminOTP.deleteOne({ _id: otpRecord._id });

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        // Generate JWT token with admin role
        const token = jwt.sign(
            {
                sub: admin._id.toString(),
                email: admin.email,
                fullName: admin.fullName,
                role: admin.role,
                isAdmin: true
            },
            process.env.JWT_SECRET || "dev-secret",
            { expiresIn: TOKEN_TTL }
        );

        return res.json({
            message: "Admin signin successful.",
            admin: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
            },
            token,
        });
    } catch (err) {
        console.error("Verify OTP error:", err);
        return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// ---------------------- RESEND OTP ----------------------
router.post("/resend-otp", otpLimiter, async (req, res) => {
    try {
        const { adminId, method } = req.body;

        if (!adminId || !method) {
            return res.status(400).json({ message: "Admin ID and method are required." });
        }

        // Find admin
        const admin = await Admin.findById(adminId);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Delete old OTPs
        await AdminOTP.deleteMany({ adminId: admin._id });

        // Create new OTP
        await AdminOTP.create({
            adminId: admin._id,
            otp,
            method,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });

        // Send OTP
        if (method === 'email') {
            console.log(`[ADMIN EMAIL OTP RESEND] Admin: ${admin.email}, OTP: ${otp}`);
            const { sendOTPEmail } = await import('../utils/mailgun.js');
            await sendOTPEmail(admin.email, otp, admin.fullName);
        } else {
            console.log(`[ADMIN PHONE OTP RESEND] Admin: ${admin.phone}, OTP: ${otp}`);
        }

        return res.json({ message: "New OTP sent successfully." });
    } catch (err) {
        console.error("Resend OTP error:", err);
        return res.status(500).json({ message: "Failed to resend OTP. Please try again." });
    }
});

// ---------------------- GET USERS LIST (for targeting - must be before /users/:id) ----------------------
router.get("/users/list", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const users = await User.find({})
            .select('fullName email subscription.plan')
            .sort({ fullName: 1 });

        const userList = users.map(user => ({
            id: user._id,
            fullName: user.fullName,
            email: user.email,
            plan: user.subscription?.plan || 'free'
        }));

        return res.json({ users: userList });
    } catch (error) {
        console.error("Get users list error:", error);
        return res.status(500).json({ message: "Failed to fetch users" });
    }
});

// ---------------------- GET ALL USERS (Protected) ----------------------
router.get("/users", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const users = await User.find({})
            .select('-passwordHash -twoFactorOTP -twoFactorOTPExpiry')
            .sort({ createdAt: -1 });

        return res.json({
            users,
            total: users.length,
        });
    } catch (err) {
        console.error("Get users error:", err);
        return res.status(500).json({ message: "Failed to fetch users." });
    }
});

// ---------------------- UPDATE USER (Protected) ----------------------
router.put("/users/:id", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow password updates through this route
        delete updates.passwordHash;
        delete updates.twoFactorOTP;
        delete updates.twoFactorOTPExpiry;

        const user = await User.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        ).select('-passwordHash -twoFactorOTP -twoFactorOTPExpiry');

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.json({
            message: "User updated successfully.",
            user,
        });
    } catch (err) {
        console.error("Update user error:", err);
        return res.status(500).json({ message: "Failed to update user." });
    }
});

// ---------------------- DELETE USER (Protected) ----------------------
router.delete("/users/:id", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.json({
            message: "User deleted successfully.",
            userId: id,
        });
    } catch (err) {
        console.error("Delete user error:", err);
        return res.status(500).json({ message: "Failed to delete user." });
    }
});

// ---------------------- GET ANALYTICS (Protected) ----------------------
router.get("/analytics", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const activeSubscriptions = await User.countDocuments({
            'subscription.status': 'active',
            'subscription.plan': { $ne: 'free' }
        });
        const freeUsers = await User.countDocuments({ 'subscription.plan': 'free' });
        const professionalUsers = await User.countDocuments({ 'subscription.plan': 'professional' });
        const enterpriseUsers = await User.countDocuments({ 'subscription.plan': 'enterprise' });

        // Get users created in last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newUsers = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        const twoFAUsers = await User.countDocuments({ twoFactorEnabled: true });

        // --- EXTENDED ANALYTICS (DEEP AGGREGATION) ---
        const growthTrends = [];
        const vulnerabilityTrends = [];
        // Combine data from both ScanHistory and ScanResult for comprehensive analytics
        const [scansFromResults, scansFromHistory] = await Promise.all([
            ScanResult.find({}).lean(),
            ScanHistory.find({}).lean()
        ]);

        const totalScans = scansFromResults.length + scansFromHistory.length;
        
        const vulnMap = {};
        let totalIssuesFound = 0;
        let totalDuration = 0;
        let durationCount = 0;

        // Process ScanResults
        scansFromResults.forEach(scan => {
            const findings = scan.activeScan?.findings || [];
            totalIssuesFound += findings.length;
            findings.forEach(f => {
                vulnMap[f.category] = (vulnMap[f.category] || 0) + 1;
            });
            const duration = scan.scanDuration || scan.activeScan?.scanDuration || 0;
            if (duration > 0) {
                totalDuration += duration;
                durationCount++;
            }
        });

        // Process ScanHistory
        scansFromHistory.forEach(scan => {
            totalIssuesFound += (scan.vulnerabilityCount || scan.vulnerabilities?.length || 0);
            (scan.vulnerabilities || []).forEach(v => {
                const category = typeof v === 'string' ? v : (v.type || 'Other');
                vulnMap[category] = (vulnMap[category] || 0) + 1;
            });
            if (scan.scanDuration > 0) {
                totalDuration += scan.scanDuration;
                durationCount++;
            }
        });

        const avgScanDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

        const vulnerabilityDistribution = Object.entries(vulnMap)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // --- TRENDS OVER 30 DAYS ---
        const scanActivity = [];

        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            d.setHours(0, 0, 0, 0);
            const nextD = new Date(d);
            nextD.setDate(d.getDate() + 1);

            const newUserCount = await User.countDocuments({ createdAt: { $gte: d, $lt: nextD } });
            
            const dayScansResult = scansFromResults.filter(s => {
                const sDate = new Date(s.scanDate || s.createdAt);
                return sDate >= d && sDate < nextD;
            });
            const dayScansHistory = scansFromHistory.filter(s => {
                const sDate = new Date(s.scanDate || s.createdAt);
                return sDate >= d && sDate < nextD;
            });

            const dayTotalScans = dayScansResult.length + dayScansHistory.length;
            let dayTotalVulns = 0;
            dayScansResult.forEach(s => dayTotalVulns += (s.activeScan?.findings?.length || 0));
            dayScansHistory.forEach(s => dayTotalVulns += (s.vulnerabilityCount || 0));

            const avgVulns = dayTotalScans > 0 ? (dayTotalVulns / dayTotalScans).toFixed(1) : 0;
            const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            growthTrends.push({ date: dateStr, signups: newUserCount });
            vulnerabilityTrends.push({ date: dateStr, avgVulns: parseFloat(avgVulns) });
            scanActivity.push({ date: dateStr, scans: dayTotalScans, users: newUserCount });
        }

        // --- DATA STABILIZER FOR NEW DATABASES ---
        const totalGrowth = growthTrends.reduce((acc, curr) => acc + curr.signups, 0);
        if (totalGrowth === 0 && growthTrends.length > 0) {
            // Fallback: Distribute total users across the trend or show total at end
            growthTrends[growthTrends.length - 1].signups = totalUsers;
        }

        const totalVulnPoints = vulnerabilityTrends.reduce((acc, curr) => acc + curr.avgVulns, 0);
        if (totalVulnPoints === 0 && vulnerabilityTrends.length > 0 && totalIssuesFound > 0) {
            // Fallback: Show a point if total issues exist but aren't in last 30 days
            vulnerabilityTrends[vulnerabilityTrends.length - 1].avgVulns = parseFloat((totalIssuesFound / (totalScans || 1)).toFixed(1));
        }

        // Top Scanned Targets (Combined)
        const targetMap = {};
        [...scansFromResults, ...scansFromHistory].forEach(s => {
            if (s.url) targetMap[s.url] = (targetMap[s.url] || 0) + 1;
        });
        const topTargets = Object.entries(targetMap)
            .map(([url, count]) => ({ url, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        const estimatedRevenue = (professionalUsers * 49) + (enterpriseUsers * 199);

        // Recent Scans (Combined & Sorted)
        const allCombinedScans = [
            ...scansFromResults.map(s => ({ ...s, source: 'Result' })),
            ...scansFromHistory.map(s => ({ ...s, source: 'History' }))
        ].sort((a, b) => new Date(b.scanDate || b.createdAt).getTime() - new Date(a.scanDate || a.createdAt).getTime())
        .slice(0, 100);

        const populatedRecentScans = await Promise.all(allCombinedScans.map(async (scan) => {
            const user = await User.findById(scan.userId).select('email');
            return {
                ...scan,
                userEmail: user?.email || 'Unknown User',
                targetUrl: scan.url,
                scanDate: scan.scanDate || scan.createdAt
            };
        }));

        const responseData = {
            totalUsers,
            activeSubscriptions,
            planDistribution: {
                free: freeUsers,
                professional: professionalUsers,
                enterprise: enterpriseUsers,
            },
            newUsersLast30Days: newUsers,
            twoFAEnabledUsers: twoFAUsers,
            totalScans,
            scanActivity,
            vulnerabilityDistribution,
            estimatedRevenue,
            recentScans: populatedRecentScans,
            growthTrends: growthTrends || [],
            vulnerabilityTrends: vulnerabilityTrends || [],
            topTargets: topTargets || [],
            avgScanDuration,
            totalIssuesFound,
            scanSuccessRate: {
                success: (await ScanResult.countDocuments({ status: 'completed' })) + (await ScanHistory.countDocuments({ status: 'completed' })),
                failed: (await ScanResult.countDocuments({ status: 'failed' })) + (await ScanHistory.countDocuments({ status: 'failed' }))
            }
        };

        return res.json(responseData);
    } catch (err) {
        console.error("CRITICAL ANALYTICS ERROR:", err);
        return res.status(500).json({ message: "Analytics Hub synchronization failed." });
    }
});

// ---------------------- GET USER HISTORY (Protected) ----------------------
router.get("/user-history", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        // For now, return mock data since scan history isn't implemented yet
        // This can be expanded when scan history is stored in database
        const users = await User.find({})
            .select('fullName email createdAt subscription')
            .sort({ createdAt: -1 })
            .limit(50);

        const history = users.map(user => ({
            userId: user._id,
            fullName: user.fullName,
            email: user.email,
            joinedDate: user.createdAt,
            plan: user.subscription?.plan || 'free',
            status: user.subscription?.status || 'active',
        }));

        return res.json({
            history,
            total: history.length,
        });
    } catch (err) {
        console.error("Get user history error:", err);
        return res.status(500).json({ message: "Failed to fetch user history." });
    }
});

// ---------------------- UPDATE ADMIN EMAIL (Protected) ----------------------
router.put("/update-email", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        // Check if email already exists
        const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
        if (existingAdmin && existingAdmin._id.toString() !== req.admin.id) {
            return res.status(400).json({ message: "Email already in use." });
        }

        // Update admin email
        const admin = await Admin.findByIdAndUpdate(
            req.admin.id,
            { email: email.toLowerCase() },
            { new: true }
        ).select('-passwordHash');

        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        return res.json({
            message: "Email updated successfully.",
            admin: {
                id: admin._id,
                fullName: admin.fullName,
                email: admin.email,
                role: admin.role,
            },
        });
    } catch (err) {
        console.error("Update email error:", err);
        return res.status(500).json({ message: "Failed to update email." });
    }
});

// ---------------------- UPDATE ADMIN PASSWORD (Protected) ----------------------
router.put("/update-password", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new passwords are required." });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: "New password must be at least 8 characters long." });
        }

        // Find admin
        const admin = await Admin.findById(req.admin.id);
        if (!admin) {
            return res.status(404).json({ message: "Admin not found." });
        }

        // Verify current password
        const isMatch = await admin.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(401).json({ message: "Current password is incorrect." });
        }

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update password
        admin.passwordHash = passwordHash;
        await admin.save();

        return res.json({
            message: "Password updated successfully. Please sign in again.",
        });
    } catch (err) {
        console.error("Update password error:", err);
        return res.status(500).json({ message: "Failed to update password." });
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
            userType: 'Admin',
            expiresAt: new Date(decoded.exp * 1000)
        });

        return res.json({ message: 'Logged out successfully from all devices.' });
    } catch (err) {
        console.error('Admin logout error:', err);
        return res.status(200).json({ message: 'Logged out successfully.' });
    }
});

// ---------------------- NOTIFICATION MANAGEMENT ----------------------

// Upload notification image
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



router.post("/notifications/upload-image", adminAuth, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file uploaded" });
        }

        const inputPath = req.file.path;
        const outputFilename = 'processed-' + req.file.filename;
        const outputPath = path.join(path.dirname(inputPath), outputFilename);

        // Process and crop image to 500x500
        await processNotificationImage(inputPath, outputPath);

        // Return URL to access the image
        const imageUrl = `/uploads/notifications/${outputFilename}`;

        return res.json({
            message: "Image uploaded and processed successfully",
            imageUrl
        });
    } catch (error) {
        console.error("Image upload error:", error);
        return res.status(500).json({ message: "Failed to upload image" });
    }
});


// Send notification
router.post("/notifications/send", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { title, message, image, targetType, targetUsers, targetGroup } = req.body;

        if (!title || !message) {
            return res.status(400).json({ message: "Title and message are required" });
        }

        if (!targetType || !['all', 'specific', 'group'].includes(targetType)) {
            return res.status(400).json({ message: "Invalid target type" });
        }

        let recipients = [];

        // Determine recipients based on target type
        if (targetType === 'all') {
            const allUsers = await User.find({}).select('_id');
            recipients = allUsers.map(u => u._id);
        } else if (targetType === 'specific') {
            if (!targetUsers || !Array.isArray(targetUsers) || targetUsers.length === 0) {
                return res.status(400).json({ message: "Please select at least one user" });
            }
            recipients = targetUsers;
        } else if (targetType === 'group') {
            if (!targetGroup) {
                return res.status(400).json({ message: "Please select a group" });
            }
            const groupUsers = await User.find({ 'subscription.plan': targetGroup }).select('_id');
            recipients = groupUsers.map(u => u._id);
        }

        if (recipients.length === 0) {
            return res.status(400).json({ message: "No recipients found" });
        }

        // Create notifications for all recipients
        const notifications = recipients.map(userId => ({
            userId,
            type: 'admin',
            title,
            message,
            icon: 'bi-megaphone',
            image: image || null,
            sentBy: req.admin.id,
            targetType,
            targetGroup: targetGroup || null,
            read: false
        }));

        await Notification.insertMany(notifications);

        return res.json({
            message: `Notification sent successfully to ${recipients.length} user(s)`,
            recipientCount: recipients.length
        });
    } catch (error) {
        console.error("Send notification error:", error);
        return res.status(500).json({ message: "Failed to send notification" });
    }
});

// ---------------------- USER SCAN HISTORY MANAGEMENT ----------------------

// Get all users with scan counts
router.get("/user-scans", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const users = await User.find({})
            .select('fullName email subscription.plan createdAt')
            .lean();

        // Get scan count for each user
        const usersWithScans = await Promise.all(users.map(async (user) => {
            const scanCount = await ScanResult.countDocuments({ userId: user._id });
            const lastScan = await ScanResult.findOne({ userId: user._id })
                .sort({ scanDate: -1 })
                .select('scanDate')
                .lean();

            return {
                ...user,
                scanCount,
                lastScanDate: lastScan?.scanDate || null
            };
        }));

        return res.json({ users: usersWithScans });
    } catch (error) {
        console.error("Get user scans error:", error);
        return res.status(500).json({ message: "Failed to fetch user scans" });
    }
});

// Get specific user's scan history
router.get("/user-scans/:userId", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId).select('fullName email');
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const scans = await ScanResult.find({ userId })
            .sort({ scanDate: -1 })
            .lean();
        
        // Map 'url' to 'targetUrl' for frontend consistency
        const mappedScans = scans.map(s => ({
            ...s,
            targetUrl: s.url
        }));

        return res.json({
            user: {
                _id: user._id,
                fullName: user.fullName,
                email: user.email
            },
            scans: mappedScans
        });
    } catch (error) {
        console.error("Get user scan history error:", error);
        return res.status(500).json({ message: "Failed to fetch scan history" });
    }
});

// Delete specific scan
router.delete("/user-scans/:scanId", adminAuth, adminApiLimiter, async (req, res) => {
    try {
        const { scanId } = req.params;

        const scan = await ScanHistory.findByIdAndDelete(scanId);
        if (!scan) {
            return res.status(404).json({ message: "Scan not found" });
        }

        return res.json({ message: "Scan deleted successfully" });
    } catch (error) {
        console.error("Delete scan error:", error);
        return res.status(500).json({ message: "Failed to delete scan" });
    }
});

export default router;
