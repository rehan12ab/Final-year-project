import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    messages: [{
        sender: {
            type: String,
            enum: ['user', 'bot', 'admin'],
            required: true
        },
        content: {
            type: String,
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        read: {
            type: Boolean,
            default: false
        },
        toolResults: {
            type: Array,
            default: undefined
        }
    }],
    status: {
        type: String,
        enum: ['active', 'closed'],
        default: 'active'
    },
    title: {
        type: String,
        default: 'New Chat'
    }
}, {
    timestamps: true
});

// Index for faster queries
chatSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('Chat', chatSchema);
