import mongoose from 'mongoose';

const UnansweredSchema = new mongoose.Schema({
    question: {
        type: String,
        required: true,
        trim: true
    },
    count: {
        type: Number,
        default: 1
    },
    lastAsked: {
        type: Date,
        default: Date.now
    }
});

const Unanswered = mongoose.model('Unanswered', UnansweredSchema);
export default Unanswered;
