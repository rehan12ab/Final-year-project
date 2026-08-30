import jwt from "jsonwebtoken";

/**
 * Authentication middleware to verify JWT token
 * Attaches user info to request object if token is valid
 */
const authMiddleware = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Authentication required. Please provide a valid token.",
            });
        }

        // Extract token
        const token = authHeader.split(" ")[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Authentication token not found.",
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');

        // Attach user info to request (JWT signed with `sub` field)
        req.user = {
            userId: decoded.sub || decoded.userId,
            email: decoded.email,
        };

        next();
    } catch (error) {
        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication token.",
            });
        }

        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Authentication token has expired. Please login again.",
            });
        }

        return res.status(500).json({
            success: false,
            message: "Authentication error. Please try again.",
        });
    }
};

export default authMiddleware;
