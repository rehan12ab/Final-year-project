import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './server/models/User.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || 'hacksentinel'
})
    .then(async () => {
        console.log('Connected to MongoDB');

        const users = await User.find({});
        console.log(`\nTotal users in database: ${users.length}\n`);

        if (users.length > 0) {
            users.forEach((user, index) => {
                console.log(`User ${index + 1}:`);
                console.log(`  Email: ${user.email}`);
                console.log(`  Name: ${user.fullName}`);
                console.log(`  Phone: ${user.phone}`);
                console.log(`  Created: ${user.createdAt}`);
                console.log('');
            });
        } else {
            console.log('No users found in database!');
            console.log('Please signup and complete phone verification first.\n');
        }

        process.exit(0);
    })
    .catch((err) => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
