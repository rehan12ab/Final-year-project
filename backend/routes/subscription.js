import express from "express";
import User from "../models/User.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// Get available plans
router.get("/plans", (req, res) => {
    const plans = [
        {
            id: 'free',
            name: 'Free Plan',
            price: 0,
            currency: 'USD',
            interval: 'forever',
            features: [
                'Basic vulnerability scanning',
                '5 scans per month',
                'Basic reports',
                'Community support'
            ]
        },
        {
            id: 'professional',
            name: 'Professional Plan',
            price: 49,
            currency: 'USD',
            interval: 'month',
            features: [
                'Advanced vulnerability scanning',
                'Unlimited scans',
                'Detailed PDF reports',
                'Priority support',
                'AI-powered insights',
                'Custom scan configurations'
            ]
        },
        {
            id: 'enterprise',
            name: 'Enterprise Plan',
            price: 199,
            currency: 'USD',
            interval: 'month',
            features: [
                'Everything in Professional',
                'Dedicated account manager',
                'Custom integrations',
                'SLA guarantees',
                'White-label reports',
                'Team collaboration',
                'Advanced analytics dashboard'
            ]
        }
    ];

    return res.json({ plans });
});

// Get current user's subscription
router.get("/current", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('subscription');

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.json({ subscription: user.subscription });
    } catch (error) {
        console.error("Get subscription error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Purchase a plan
router.post("/purchase", verifyToken, async (req, res) => {
    try {
        const { planId, paymentMethod } = req.body;

        if (!planId) {
            return res.status(400).json({ message: "Plan ID is required" });
        }

        const validPlans = ['free', 'professional', 'enterprise'];
        if (!validPlans.includes(planId)) {
            return res.status(400).json({ message: "Invalid plan ID" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Calculate end date (30 days from now for paid plans)
        const startDate = new Date();
        let endDate = null;
        if (planId !== 'free') {
            endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);
        }

        // Update subscription
        user.subscription = {
            plan: planId,
            status: 'active',
            startDate,
            endDate
        };

        // Update payment method if provided
        if (paymentMethod) {
            user.paymentMethod = {
                cardHolderName: paymentMethod.cardHolderName,
                cardNumberLast4: paymentMethod.cardNumberLast4,
                expiryDate: paymentMethod.expiryDate,
                cardType: paymentMethod.cardType || 'Unknown'
            };
        }

        await user.save();

        return res.json({
            message: `Successfully subscribed to ${planId} plan`,
            subscription: user.subscription
        });
    } catch (error) {
        console.error("Purchase plan error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

// Cancel subscription
router.post("/cancel", verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.subscription.plan === 'free') {
            return res.status(400).json({ message: "Cannot cancel free plan" });
        }

        user.subscription.status = 'cancelled';
        await user.save();

        return res.json({
            message: "Subscription cancelled successfully",
            subscription: user.subscription
        });
    } catch (error) {
        console.error("Cancel subscription error:", error);
        return res.status(500).json({ message: "Server error" });
    }
});

export default router;
