import jwt from "jsonwebtoken";
import TokenBlacklist from "../models/TokenBlacklist.js";

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        req.userId = decoded.sub;
        req.userEmail = decoded.email;
        req.token = token; // Store token for logout

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

export default verifyToken;
