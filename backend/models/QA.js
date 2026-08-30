import mongoose from 'mongoose';

const qaSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    answer: {
        type: String,
        required: true
    },
    keywords: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    category: {
        type: String,
        enum: ['scanning', 'reports', 'subscription', 'security', 'account', 'general', 'technical'],
        default: 'general'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    usageCount: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for text search and keywords
qaSchema.index({ keywords: 1 });
qaSchema.index({ question: 'text', answer: 'text' });

export default mongoose.model('QA', qaSchema);
