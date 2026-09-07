const { spawn } = require('child_process');
const http = require('http');

async function check() {
  const edge = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--remote-debugging-port=9228',
    '--headless=new',
    '--window-size=1280,800',
    'http://localhost:3001/configuration/organization'
  ]);
  await new Promise(r => setTimeout(r, 2000));
  http.get('http://127.0.0.1:9228/json', res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', async () => {
      const targets = JSON.parse(data);
      const page = targets.find(t => t.type === 'page');
      const ws = new WebSocket(page.webSocketDebuggerUrl);
      ws.onopen = () => {
        ws.send(JSON.stringify({
          id: 1,
          method: 'Runtime.evaluate',
          params: {
            expression: `JSON.stringify(
              Array.from(document.querySelectorAll('*'))
                .filter(el => el.scrollWidth > document.documentElement.clientWidth)
                .map(el => ({ tag: el.tagName, cls: el.className, id: el.id, sw: el.scrollWidth, cw: el.clientWidth }))
            )`,
            returnByValue: true
          }
        }));
      };
      ws.onmessage = (msg) => {
        const res = JSON.parse(msg.data);
        console.log('Result:', JSON.parse(res.result.result.value));
        edge.kill();
        process.exit(0);
      };
    });
  });
}
check();
