import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from './server/models/User.js';

dotenv.config();

const createTestUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.MONGO_DB_NAME || 'hacksentinel'
        });

        console.log('✅ Connected to MongoDB\n');

        // Test user credentials
        const testEmail = 'test@hacksentinel.com';
        const testPassword = 'Test@123';

        // Check if user already exists
        const existingUser = await User.findOne({ email: testEmail });
        if (existingUser) {
            console.log(`⚠️  User already exists with email: ${testEmail}`);
            console.log(`   You can sign in with:`);
            console.log(`   Email: ${testEmail}`);
            console.log(`   Password: ${testPassword}\n`);
            process.exit(0);
        }

        // Create password hash
        const passwordHash = await bcrypt.hash(testPassword, 10);

        // Create new user
        const user = await User.create({
            fullName: 'Test User',
            email: testEmail,
            phone: '+923001234567',
            passwordHash: passwordHash,
            subscription: {
                plan: 'free',
                status: 'active'
            }
        });

        console.log('🎉 Test user created successfully!\n');
        console.log('You can now sign in with these credentials:');
        console.log(`   Email: ${testEmail}`);
        console.log(`   Password: ${testPassword}\n`);
        console.log(`User Details:`);
        console.log(`   Name: ${user.fullName}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Plan: ${user.subscription.plan}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTestUser();
