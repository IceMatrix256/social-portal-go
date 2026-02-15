import WebSocket from 'ws';

function testRelay(url) {
    const ws = new WebSocket(url);

    ws.on('open', function open() {
        console.log(`[${url}] Connected`);
        // Request kind 0 (metadata), limit 5
        const req = ["REQ", "test_meta_" + url, { kinds: [0], limit: 5 }];
        ws.send(JSON.stringify(req));
    });

    ws.on('message', function message(data) {
        const msg = JSON.parse(data);
        if (msg[0] === 'EVENT') {
            console.log(`[${url}] GOT META: ${msg[2].content.substring(0, 50)}...`);
            // Got one, success.
            ws.close();
        } else if (msg[0] === 'EOSE') {
            console.log(`[${url}] EOSE (No metadata found)`);
            ws.close();
        }
    });

    ws.on('error', function error(err) {
        console.error(`[${url}] Error:`, err.message);
    });
}

testRelay("wss://140.f7z.io");
