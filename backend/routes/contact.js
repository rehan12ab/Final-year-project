import express from "express";
import Contact from "../models/Contact.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// Rate limiting map to prevent spam (in-memory, consider Redis for production)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const MAX_SUBMISSIONS = 5; // Max 5 submissions per hour

/**
 * Rate limiting for authenticated users
 */
const rateLimiter = (req, res, next) => {
    // If verifyToken middleware is used, userId is attached directly to req
    const userId = req.userId || (req.user && req.user.userId);
    const now = Date.now();

    if (!rateLimitMap.has(userId)) {
        rateLimitMap.set(userId, []);
    }

    const userSubmissions = rateLimitMap.get(userId);

    // Filter out submissions older than the rate limit window
    const recentSubmissions = userSubmissions.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    );

    if (recentSubmissions.length >= MAX_SUBMISSIONS) {
        return res.status(429).json({
            success: false,
            message: `Rate limit exceeded. Maximum ${MAX_SUBMISSIONS} submissions per hour.`,
        });
    }

    // Add current submission timestamp
    recentSubmissions.push(now);
    rateLimitMap.set(userId, recentSubmissions);

    next();
};

/**
 * Rate limiting for public (non-authenticated) users based on email
 */
const publicRateLimiter = (req, res, next) => {
    const email = req.body.email?.toLowerCase();
    const now = Date.now();

    if (!email) {
        return res.status(400).json({
            success: false,
            message: "Email is required",
        });
    }

    const identifier = `public_${email}`;

    if (!rateLimitMap.has(identifier)) {
        rateLimitMap.set(identifier, []);
    }

    const submissions = rateLimitMap.get(identifier);
    const recentSubmissions = submissions.filter(
        (timestamp) => now - timestamp < RATE_LIMIT_WINDOW
    );

    if (recentSubmissions.length >= MAX_SUBMISSIONS) {
        return res.status(429).json({
            success: false,
            message: `Rate limit exceeded. Maximum ${MAX_SUBMISSIONS} submissions per hour.`,
        });
    }

    recentSubmissions.push(now);
    rateLimitMap.set(identifier, recentSubmissions);

    next();
};

/**
 * POST /api/contact
 * Create a new contact form submission
 * Protected route - requires authentication
 */
router.post("/", verifyToken, rateLimiter, async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields: name, email, subject, and message.",
            });
        }

        // Additional validation
        if (name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 2 characters long.",
            });
        }

        if (message.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Message must be at least 10 characters long.",
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Create contact submission
        const contact = new Contact({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : undefined,
            subject: subject.trim(),
            message: message.trim(),
            userId: req.userId,
        });

        await contact.save();

        return res.status(201).json({
            success: true,
            message: "Your message has been sent successfully! We'll get back to you soon.",
            data: {
                id: contact._id,
                name: contact.name,
                email: contact.email,
                subject: contact.subject,
                createdAt: contact.createdAt,
            },
        });
    } catch (error) {
        console.error("Contact submission error:", error);

        // Handle mongoose validation errors
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((err) => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(", "),
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to submit contact form. Please try again later.",
        });
    }
});

/**
 * POST /api/contact/public
 * Create a new contact form submission (public - no authentication required)
 */
router.post("/public", publicRateLimiter, async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validation
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required fields: name, email, subject, and message.",
            });
        }

        // Additional validation
        if (name.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: "Name must be at least 2 characters long.",
            });
        }

        if (message.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Message must be at least 10 characters long.",
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address.",
            });
        }

        // Create contact submission (without userId for public submissions)
        const contact = new Contact({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone ? phone.trim() : undefined,
            subject: subject.trim(),
            message: message.trim(),
            // userId is not set for public submissions
        });

        await contact.save();

        return res.status(201).json({
            success: true,
            message: "Your message has been sent successfully! We'll get back to you soon.",
            data: {
                id: contact._id,
                name: contact.name,
                email: contact.email,
                subject: contact.subject,
                createdAt: contact.createdAt,
            },
        });
    } catch (error) {
        console.error("Contact submission error:", error);

        // Handle mongoose validation errors
        if (error.name === "ValidationError") {
            const messages = Object.values(error.errors).map((err) => err.message);
            return res.status(400).json({
                success: false,
                message: messages.join(", "),
            });
        }

        return res.status(500).json({
            success: false,
            message: "Failed to submit contact form. Please try again later.",
        });
    }
});

/**
 * GET /api/contact
 * Get all contact submissions (Admin only - future implementation)
 * For now, returns user's own submissions
 */
router.get("/", verifyToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Get user's own contact submissions
        const contacts = await Contact.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-__v");

        const total = await Contact.countDocuments({ userId: req.userId });

        return res.status(200).json({
            success: true,
            data: {
                contacts,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            },
        });
    } catch (error) {
        console.error("Get contacts error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve contact submissions.",
        });
    }
});

/**
 * GET /api/contact/:id
 * Get a specific contact submission by ID
 */
router.get("/:id", verifyToken, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.userId,
        }).select("-__v");

        if (!contact) {
            return res.status(404).json({
                success: false,
                message: "Contact submission not found.",
            });
        }

        return res.status(200).json({
            success: true,
            data: contact,
        });
    } catch (error) {
        console.error("Get contact error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve contact submission.",
        });
    }
});

export default router;
