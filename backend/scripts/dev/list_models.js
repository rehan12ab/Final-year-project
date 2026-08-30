import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('GEMINI_API_KEY missing');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log('Listing models via v1beta...');
    try {
        // The SDK doesn't have a direct listModels method on the genAI instance in all versions, 
        // but we can try to fetch it via the base URL if needed, 
        // or just try a few common names.
        
        const modelsToTry = [
            'gemini-1.5-flash',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro',
            'gemini-2.0-flash-exp',
            'gemini-pro'
        ];

        for (const modelName of modelsToTry) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                await model.generateContent('test');
                console.log(`✅ SUCCESS: ${modelName} is available.`);
            } catch (err) {
                console.log(`❌ FAILED: ${modelName} - ${err.message}`);
            }
        }
    } catch (err) {
        console.error('Error listing models:', err.message);
    }
}

listModels();
