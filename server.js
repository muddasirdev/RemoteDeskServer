const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

// Connected agents store karo
const agents = new Map(); // agentId -> {ws, name}
let viewerSockets = [];

console.log('RemoteDesk Server started on port 8080');

wss.on('connection', (ws) => {
    console.log('New connection...');

    ws.on('message', (message, isBinary) => {
        // Binary = screen frame, forward karo
        if (isBinary) {
            if (ws.type === 'agent') {
                viewerSockets.forEach(viewer => {
                    if (viewer.readyState === WebSocket.OPEN && viewer.selectedAgent === ws.agentId) {
                        viewer.send(message, { binary: true });
                    }
                });
            }
            return;
        }

        const msg = message.toString();

        // Agent register: REGISTER:AGENT:agentId:agentName
        if (msg.startsWith('REGISTER:AGENT:')) {
            const parts = msg.split(':');
            const agentId = parts[2];
            const agentName = parts[3] || 'Unknown PC';
            ws.type = 'agent';
            ws.agentId = agentId;
            agents.set(agentId, { ws, name: agentName });
            console.log(`Agent connected: ${agentName} (${agentId})`);

            // Sab viewers ko updated list bhejo
            broadcastAgentList();
            return;
        }

        // Viewer register: REGISTER:VIEWER
        if (msg.startsWith('REGISTER:VIEWER')) {
            ws.type = 'viewer';
            viewerSockets.push(ws);
            console.log('Viewer connected. Total viewers: ' + viewerSockets.length);

            // Viewer ko current agent list bhejo
            sendAgentList(ws);
            return;
        }

        // Viewer ne kisi agent ko select kiya: SELECT:agentId
        if (msg.startsWith('SELECT:') && ws.type === 'viewer') {
            const agentId = msg.split(':')[1];
            ws.selectedAgent = agentId;
            console.log(`Viewer selected agent: ${agentId}`);
            return;
        }

        // Agent ne screen bheja -> selected viewers ko forward karo
        if (ws.type === 'agent') {
            viewerSockets.forEach(viewer => {
                if (viewer.readyState === WebSocket.OPEN && viewer.selectedAgent === ws.agentId) {
                    viewer.send(msg); // binary as-is forward
                }
            });
            return;
        }

        // Viewer ne command bheja -> selected agent ko forward karo
        if (ws.type === 'viewer' && ws.selectedAgent) {
            const agent = agents.get(ws.selectedAgent);
            if (agent && agent.ws.readyState === WebSocket.OPEN) {
                agent.ws.send(msg);
            }
        }
    });

    ws.on('close', () => {
        if (ws.type === 'agent') {
            agents.delete(ws.agentId);
            console.log(`Agent disconnected: ${ws.agentId}`);

            // Sab viewers ko notify karo
            viewerSockets.forEach(viewer => {
                if (viewer.readyState === WebSocket.OPEN) {
                    if (viewer.selectedAgent === ws.agentId) {
                        viewer.send('AGENT_DISCONNECTED');
                        viewer.selectedAgent = null;
                    }
                }
            });
            broadcastAgentList();
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

function getAgentList() {
    const list = [];
    agents.forEach((agent, id) => {
        list.push({ id, name: agent.name });
    });
    return list;
}

function sendAgentList(viewerWs) {
    viewerWs.send('AGENT_LIST:' + JSON.stringify(getAgentList()));
}

function broadcastAgentList() {
    const msg = 'AGENT_LIST:' + JSON.stringify(getAgentList());
    viewerSockets.forEach(viewer => {
        if (viewer.readyState === WebSocket.OPEN) {
            viewer.send(msg);
        }
    });
}