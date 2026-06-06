const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

let agentSocket = null;
let viewerSockets = [];

console.log('RemoteDesk Server started on port 8080');

wss.on('connection', (ws) => {
    console.log('New connection...');

    ws.on('message', (message) => {
        const msg = message.toString();

        // Agent connected
        if (msg.startsWith('REGISTER:AGENT')) {
            agentSocket = ws;
            ws.type = 'agent';
            console.log('Agent connected');
            return;
        }

        // Viewer connected
        if (msg.startsWith('REGISTER:VIEWER')) {
            viewerSockets.push(ws);
            ws.type = 'viewer';
            console.log('Viewer connected. Total viewers: ' + viewerSockets.length);
            return;
        }

        // Agent ne screen bheja -> sab viewers ko forward karo
        if (msg.startsWith('SCREEN:') && ws.type === 'agent') {
            viewerSockets.forEach(viewer => {
                if (viewer.readyState === WebSocket.OPEN) {
                    viewer.send(msg);
                }
            });
            return;
        }

        // Viewer ne command bheja (mouse/keyboard) -> agent ko forward karo
        if (ws.type === 'viewer' && agentSocket && agentSocket.readyState === WebSocket.OPEN) {
            agentSocket.send(msg);
        }
    });

    ws.on('close', () => {
        if (ws.type === 'agent') {
            agentSocket = null;
            console.log('Agent disconnected');
        }
        if (ws.type === 'viewer') {
            viewerSockets = viewerSockets.filter(v => v !== ws);
            console.log('Viewer disconnected. Total viewers: ' + viewerSockets.length);
        }
    });

    ws.on('error', (err) => {
        console.log('Error: ' + err.message);
    });
});