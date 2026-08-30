import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hacksentinel';

async function diagnose() {
    try {
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('Collections:', collections.map(c => c.name));

        const historyCount = await mongoose.connection.db.collection('scanhistories').countDocuments();
        console.log('ScanHistory Count:', historyCount);

        if (historyCount > 0) {
            const sample = await mongoose.connection.db.collection('scanhistories').findOne();
            console.log('ScanHistory Sample:', JSON.stringify(sample, null, 2));
        }

        const resultCount = await mongoose.connection.db.collection('scanresults').countDocuments();
        console.log('ScanResult Count:', resultCount);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

diagnose();
