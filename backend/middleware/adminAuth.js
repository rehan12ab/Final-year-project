import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import TokenBlacklist from "../models/TokenBlacklist.js";

export const adminAuth = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided. Access denied.' });
        }

        const token = authHeader.split(' ')[1];

        // Check if token is blacklisted
        const blacklisted = await TokenBlacklist.findOne({ token });
        if (blacklisted) {
            return res.status(401).json({
                message: 'Session expired. Please sign in again.',
                sessionExpired: true
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        // Check if user is admin
        const admin = await Admin.findById(decoded.sub);

        if (!admin) {
            return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
        }

        if (!admin.isActive) {
            return res.status(403).json({ message: 'Admin account is deactivated.' });
        }

        // Attach admin info to request
        req.admin = {
            id: admin._id,
            email: admin.email,
            fullName: admin.fullName,
            role: admin.role
        };
        req.token = token; // Store token for logout

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please sign in again.' });
        }
        console.error('Admin auth middleware error:', error);
        return res.status(500).json({ message: 'Authentication failed.' });
    }
};
