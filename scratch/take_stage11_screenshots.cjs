const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ARTIFACT_DIR = 'C:\\Users\\ayesh\\.gemini\\antigravity-ide\\brain\\4fe1badf-2bc7-4343-8047-c1b54f0cddf8';

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  waitOpen() {
    return new Promise((resolve) => {
      if (this.ws.readyState === 1) return resolve();
      this.ws.onopen = resolve;
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true });
    return res.result ? res.result.value : null;
  }

  async screenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log('Saved screenshot:', outPath);
    return outPath;
  }

  async setViewport(width, height) {
    await this.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600
    });
  }

  close() {
    this.ws.close();
  }
}

async function main() {
  console.log('Starting Edge process...');
  const edge = spawn(EDGE_PATH, [
    '--remote-debugging-port=9222',
    '--headless=new',
    '--disable-gpu',
    '--window-size=1280,800',
    'http://localhost:3001/configuration/organization'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const targets = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const pageTarget = targets.find(t => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.waitOpen();
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');

  await new Promise(r => setTimeout(r, 2000));

  // 1. Departments desktop
  console.log('1. Departments desktop');
  await cdp.setViewport(1280, 800);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_departments_desktop.png');

  // Check scrollWidth vs clientWidth
  const orgOverflow = await cdp.eval('document.body.scrollWidth <= document.documentElement.clientWidth');
  console.log('Organization Desktop Overflow Check (<= clientWidth):', orgOverflow);

  // 2. Job Positions desktop
  console.log('2. Job Positions desktop');
  await cdp.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Job Positions'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_job_positions_desktop.png');

  // 3. Work Locations desktop
  console.log('3. Work Locations desktop');
  await cdp.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Work Locations'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_work_locations_desktop.png');

  // 4. Create Department Modal
  console.log('4. Create Department Modal');
  await cdp.eval(`
    const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Departments'));
    if (tabBtn) tabBtn.click();
  `);
  await new Promise(r => setTimeout(r, 500));
  await cdp.eval(`
    const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create Department'));
    if (createBtn) createBtn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_create_dept_modal.png');

  // Close modal
  await cdp.eval(`
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
    if (cancelBtn) cancelBtn.click();
  `);
  await new Promise(r => setTimeout(r, 500));

  // 5. Edit Job Position Modal
  console.log('5. Edit Job Position Modal');
  await cdp.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Job Positions'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 500));
  await cdp.eval(`
    const editBtn = document.querySelector('button[title="Edit Job Position"]');
    if (editBtn) editBtn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_edit_position_modal.png');

  // Close modal
  await cdp.eval(`
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
    if (cancelBtn) cancelBtn.click();
  `);
  await new Promise(r => setTimeout(r, 500));

  // 6. Departments mobile
  console.log('6. Departments mobile');
  await cdp.eval(`
    const tabBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Departments'));
    if (tabBtn) tabBtn.click();
  `);
  await cdp.setViewport(375, 812);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_departments_mobile.png');

  // 7. Job Positions mobile
  console.log('7. Job Positions mobile');
  await cdp.eval(`
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Job Positions'));
    if (btn) btn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_job_positions_mobile.png');

  // 8. Activity Types desktop
  console.log('8. Activity Types desktop');
  await cdp.setViewport(1280, 800);
  await cdp.send('Page.navigate', { url: 'http://localhost:3001/configuration/activities' });
  await new Promise(r => setTimeout(r, 2000));
  await cdp.screenshot('stage11_activities_desktop.png');

  const actOverflow = await cdp.eval('document.body.scrollWidth <= document.documentElement.clientWidth');
  console.log('Activities Desktop Overflow Check (<= clientWidth):', actOverflow);

  // 9. Create Activity Type Modal
  console.log('9. Create Activity Type Modal');
  await cdp.eval(`
    const createBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Create Activity Type'));
    if (createBtn) createBtn.click();
  `);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_create_activity_modal.png');

  // Close modal
  await cdp.eval(`
    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
    if (cancelBtn) cancelBtn.click();
  `);
  await new Promise(r => setTimeout(r, 500));

  // 10. Activity Types mobile
  console.log('10. Activity Types mobile');
  await cdp.setViewport(375, 812);
  await new Promise(r => setTimeout(r, 1000));
  await cdp.screenshot('stage11_activities_mobile.png');

  console.log('ALL 10 SCREENSHOTS CAPTURED SUCCESSFULLY!');
  cdp.close();
  edge.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
