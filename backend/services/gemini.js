import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { TOOL_REGISTRY } from './agent.js';

dotenv.config();

const apiKey = (process.env.GEMINI_API_KEY || '').trim();
if (!apiKey) {
    console.warn('[Gemini] GEMINI_API_KEY not set or empty — AI responses will fall back to local Ollama');
}

const genAI = new GoogleGenerativeAI(apiKey);

// Ollama-safe system prompt — NO tool-call directives.
// Ollama should never emit [TOOL_CALL: ...] tags; it just answers plainly.
const OLLAMA_SYSTEM_INSTRUCTION = `
You are HackSentinel AI, a professional cybersecurity assistant.
Provide concise, accurate, and helpful answers about web security and the HackSentinel platform.
NEVER emit internal reasoning, chain-of-thought, or meta-commentary.
NEVER output any [TOOL_CALL: ...] tags or special syntax — just reply naturally.
Speak with authority. Use Markdown (bold, lists) for clarity where appropriate.
`.trim();

// Helper to call local Ollama if Gemini fails
async function askOllama(rawPrompt) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    // Strip the enriched wrapper injected by getSystemContext so Ollama
    // receives only the actual user question — not the tool-call system context.
    // The wrapper format is: "[CURRENT SYSTEM STATE]\n...\n\nUser Question: <msg>"
    let cleanPrompt = rawPrompt;
    const userQIdx = rawPrompt.lastIndexOf('\n\nUser Question: ');
    if (userQIdx !== -1) {
        cleanPrompt = rawPrompt.slice(userQIdx + '\n\nUser Question: '.length).trim();
    }

    try {
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: 'hacksentinel',
                prompt: cleanPrompt,
                system: OLLAMA_SYSTEM_INSTRUCTION,
                stream: false
            })
        });
        clearTimeout(timeoutId);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(`Ollama Error: ${data.error}`);
        }
        
        if (!data.response || data.response.trim().length === 0) {
            throw new Error('Ollama returned an empty response.');
        }

        return data.response;
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            throw new Error('Ollama timed out after 60 seconds.');
        }
        console.error('[Ollama Error]', err.message);
        throw err;
    }
}

const SYSTEM_INSTRUCTION = `
You are HackSentinel AI, the official cybersecurity assistant for the HackSentinel platform. 
Your goal is to provide professional, concise, and actionable security guidance.

[CRITICAL DIRECTIVES]
1. NEVER reveal your internal thinking, reasoning process, or chain of thought. 
2. NEVER start your response with "Alright", "Let's break down", "I understand", or similar conversational filler.
3. If you need to switch pages or start a scan, you MUST include the [TOOL_CALL] tag as your ONLY way to control the system.
4. Speak with authority but stay helpful. Use professional cybersecurity terminology correctly.
5. Provide ONLY the final helpful response. If a tool is called, include a short, friendly sentence about the action.

[TOOL CALLING FORMAT]
If you need to perform an action, include a line in this exact format:
[TOOL_CALL: tool_name({"arg1": "value"})]

[AVAILABLE TOOLS]
${JSON.stringify(TOOL_REGISTRY, null, 2)}

[NAVIGATION MAPPING]
- Dashboard/Home -> "dashboard"
- Users/Management -> "users"
- Analytics/Charts -> "analytics"
- History/Logs -> "history"
- Notifications/Alerts -> "notifications"
- Settings/Security -> "settings"

[GUIDELINES]
1. Use 'navigate' tool for page requests.
2. Use 'start_scan' tool for scanning requests.
3. NEVER mention tools, 'TOOL_CALL', or internal technical mechanics.
4. Keep answers clear and focused on the user's security.
`.trim();

const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    systemInstruction: SYSTEM_INSTRUCTION,
});

async function _generateContentWithFallback(prompt) {
    const modelsToTry = [
        { name: 'gemini-2.0-flash', version: 'v1beta' },
        { name: 'gemini-2.0-flash-lite-preview-02-05', version: 'v1beta' },
        { name: 'gemini-1.5-flash-latest', version: 'v1' },
        { name: 'gemini-1.5-flash', version: 'v1' },
        { name: 'gemini-1.5-pro-latest', version: 'v1' },
        { name: 'gemini-1.5-pro', version: 'v1' },
        { name: 'gemini-pro', version: 'v1' }
    ];
    let lastErr = null;

    // Prepend system instruction to the prompt for universal compatibility
    const fullPrompt = `${SYSTEM_INSTRUCTION}\n\nUser Message: ${prompt}`;

    for (const modelCfg of modelsToTry) {
        try {
            const tempModel = genAI.getGenerativeModel(
                { model: modelCfg.name },
                { apiVersion: modelCfg.version }
            );
            const result = await tempModel.generateContent(fullPrompt);
            return result.response.text(); // Return raw text
        } catch (err) {
            lastErr = err;
            if (err.message.includes('404')) {
                console.warn(`[Gemini] Model ${modelCfg.name} (${modelCfg.version}) not found (404), trying next...`);
            } else if (err.message.includes('429')) {
                console.warn(`[Gemini] Model ${modelCfg.name} reached quota (429), trying next...`);
            } else {
                console.warn(`[Gemini] Model ${modelCfg.name} failed: ${err.message}, trying next...`);
            }
        }
    }

    // FINAL FALLBACK: Local Ollama
    console.log('[AI] All Gemini models failed. Falling back to local Ollama...');
    return await askOllama(prompt); // Return raw text
}

export async function askGemini(userMessage) {
    return _generateContentWithFallback(userMessage);
}

export async function explainReport(reportData, scanData, userMessage) {
  try {
    const findings = scanData?.activeScan?.findings || [];
    const findingsStr = findings.length > 0
        ? findings.map((f, i) =>
            `${i + 1}. [${(f.severity || 'UNKNOWN').toUpperCase()}] ${f.category}\n` +
            `   URL: ${f.url || 'N/A'}\n` +
            `   Description: ${f.description || 'N/A'}\n` +
            `   Payload: ${f.payload || 'N/A'}`
          ).join('\n\n')
        : 'No active vulnerabilities were confirmed.';

    const prompt = `
[CRITICAL] DO NOT explain your plan. DO NOT say "Okay" or "I will". 
[CRITICAL] PROVIDE THE FINAL SECURITY SUMMARY IMMEDIATELY.

You are a senior security consultant. Explain this report to a NON-TECHNICAL business owner.
Use Markdown (Bold, Headers, Lists) for a professional look.

REPORT DATA:
- Target: ${reportData.targetUrl || 'Unknown'}
- Overall Risk: ${scanData?.severityPrediction?.name || 'Unknown'}
- Findings Count: ${reportData.reportData?.totalFindings ?? findings.length}
- Security Headers Missing: ${(scanData?.passiveScan?.missingHeaders || []).join(', ') || 'None'}
- Technologies Detected: ${(scanData?.passiveScan?.techStack || []).join(', ') || 'Not detected'}

DETAILED FINDINGS:
${findingsStr}

User Question: ${userMessage}

STRUCTURE YOUR RESPONSE AS FOLLOWS:
1. ## Overall Security Status
   - Provide a brief, high-level summary in 2-3 sentences.
2. ## Key Findings
   - Use bullet points to list the main issues.
   - For each issue, explain WHAT it is and WHY it matters in simple terms.
3. ## Recommended Actions
   - Provide a numbered or bulleted list of clear steps the user should take.
   - Prioritize the most critical fixes first.

[MANDATORY] Use bullet points for clarity. Keep language professional but simple.`;
  
    return _generateContentWithFallback(prompt);
  } catch (error) {
    console.error('Gemini explanation error:', error);
    return "I couldn't generate a detailed explanation right now. Please check your scan report manually.";
  }
};
