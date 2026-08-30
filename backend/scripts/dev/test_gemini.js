import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log('Using API Key:', apiKey ? 'FOUND (starts with ' + apiKey.substring(0, 5) + '...)' : 'MISSING');

    if (!apiKey) {
        console.error('ERROR: GEMINI_API_KEY is not set in .env');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test with gemini-2.0-flash
    console.log('Testing model: gemini-2.0-flash...');
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent('Hello, say "Gemini 2.0 is working" if you receive this.');
        console.log('Response:', result.response.text());
    } catch (err) {
        console.error('Gemini 2.0 failed:', err.message);
        
        // Fallback test with gemini-1.5-flash
        console.log('Testing fallback model: gemini-1.5-flash...');
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent('Hello, say "Gemini 1.5 is working" if you receive this.');
            console.log('Response:', result.response.text());
        } catch (err2) {
            console.error('Gemini 1.5 also failed:', err2.message);
        }
    }
}

testGemini();
