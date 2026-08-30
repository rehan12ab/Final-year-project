import express from "express";
import Notification from "../models/Notification.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
        req.userId = decoded.sub;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

// Get all notifications for user
router.get("/", verifyToken, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({
            userId: req.userId,
            read: false
        });

        return res.json({
            notifications,
            unreadCount
        });
    } catch (error) {
        console.error("Get notifications error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Mark single notification as read
router.put("/:id/read", verifyToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        return res.json({
            message: "Notification marked as read",
            notification
        });
    } catch (error) {
        console.error("Mark read error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Mark all notifications as read
router.put("/read-all", verifyToken, async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.userId, read: false },
            { read: true }
        );

        return res.json({ message: "All notifications marked as read" });
    } catch (error) {
        console.error("Mark all read error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Delete a notification
router.delete("/:id", verifyToken, async (req, res) => {
    try {
        const notification = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!notification) {
            return res.status(404).json({ message: "Notification not found" });
        }

        return res.json({ message: "Notification deleted" });
    } catch (error) {
        console.error("Delete notification error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Clear all notifications
router.delete("/", verifyToken, async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.userId });
        return res.json({ message: "All notifications cleared" });
    } catch (error) {
        console.error("Clear notifications error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Helper function to create notification (exported for use in other routes)
export const createNotification = async (userId, type, title, message, icon = null, link = null) => {
    try {
        const iconMap = {
            'scan': 'bi-search',
            'security': 'bi-shield-lock',
            'account': 'bi-person-circle',
            'system': 'bi-gear'
        };

        const notification = await Notification.create({
            userId,
            type,
            title,
            message,
            icon: icon || iconMap[type] || 'bi-bell',
            link
        });

        return notification;
    } catch (error) {
        console.error("Create notification error:", error);
        return null;
    }
};

export default router;
