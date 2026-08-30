import ScanResult from '../models/ScanResult.js';
import Report from '../models/Report.js';
import User from '../models/User.js';

/**
 * The Tool Registry defines what the AI Agent can do.
 */
export const TOOL_REGISTRY = [
    {
        name: 'start_scan',
        description: 'Initiates a new vulnerability scan on a target URL.',
        parameters: { url: 'string' }
    },
    {
        name: 'navigate',
        description: 'Switches the UI to a different page.',
        parameters: { page: 'Dashboard | Reports | Settings | Scans | Subscription | Help' }
    },
    {
        name: 'get_system_status',
        description: 'Returns the current status of the scanning engine and AI models.',
        parameters: {}
    },
    {
        name: 'list_recent_scans',
        description: 'Returns the last 5 vulnerability scans run by the user.',
        parameters: {}
    },
    {
        name: 'get_scan_details',
        description: 'Fetches full details of a specific scan by its ID.',
        parameters: { scanId: 'string' }
    },
    {
        name: 'list_reports',
        description: 'Returns a list of available security reports.',
        parameters: {}
    }
];

/**
 * Executes a tool call from the AI.
 */
export async function executeTool(name, args, userId) {
    console.log(`[Agent] Executing tool: ${name}`, args);

    try {
        switch (name) {
            case 'start_scan':
                // Call the internal scan API
                const scanResp = await fetch(`http://localhost:5000/api/scan/passive`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'x-internal-key': process.env.JWT_SECRET // Simple internal auth
                    },
                    body: JSON.stringify({ url: args.url, userId })
                });
                const scanData = await scanResp.json();
                return { 
                    success: scanResp.ok, 
                    type: 'ui_action', 
                    action: 'navigate', 
                    target: 'Scans',
                    message: `I have started a new scan for ${args.url}. Redirecting you to the scan progress page...`,
                    data: scanData 
                };

            case 'navigate':
                return { 
                    success: true, 
                    type: 'ui_action', 
                    action: 'navigate', 
                    target: args.page,
                    message: `Navigating you to the ${args.page} page...` 
                };

            case 'get_system_status':
                return {
                    success: true,
                    engine: 'Active',
                    ai_models: ['gemini-1.5-flash', 'llama3-70b', 'hacksentinel-8b'],
                    status: 'Ready for scanning'
                };

            case 'list_recent_scans':
                const scans = await ScanResult.find({ userId })
                    .sort({ scanDate: -1 })
                    .limit(5)
                    .select('url status scanDate severityPrediction');
                return { success: true, scans };

            case 'get_scan_details':
                const scan = await ScanResult.findOne({ _id: args.scanId, userId });
                return scan ? { success: true, scan } : { success: false, error: 'Scan not found' };

            case 'list_reports':
                const reports = await Report.find({ userId })
                    .sort({ createdAt: -1 })
                    .limit(5);
                return { success: true, reports };

            default:
                return { success: false, error: `Tool ${name} not implemented.` };
        }
    } catch (error) {
        console.error(`[Agent] Tool execution failed: ${name}`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Generates the context string to be injected into the AI's prompt.
 */
export async function getSystemContext(userId) {
    try {
        const user = await User.findById(userId).select('name email subscription');
        const lastScan = await ScanResult.findOne({ userId }).sort({ scanDate: -1 }).select('url status');
        
        return `
[CURRENT SYSTEM STATE]
User: ${user?.name || 'Unknown'} (${user?.subscription?.plan || 'Free'} Plan)
Last Scan: ${lastScan ? `${lastScan.url} (${lastScan.status})` : 'None'}
Time: ${new Date().toLocaleString()}
Available Tools: ${TOOL_REGISTRY.map(t => t.name).join(', ')}
`.trim();
    } catch (err) {
        return '[SYSTEM STATE UNAVAILABLE]';
    }
}
