// Render HTML -> PDF (A5) przez Chrome DevTools Protocol
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = path.resolve(__dirname, '..');
const SRC = process.argv[2] || path.join(ROOT, 'Prokrastynacja-w-Kobiecym-Zaciszu.html');
const OUT = process.argv[3] || path.join(ROOT, 'Prokrastynacja-w-Kobiecym-Zaciszu.pdf');
const PORT = 9333;

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--font-render-hinting=none', `--remote-debugging-port=${PORT}`, 'about:blank'
  ], { stdio: 'ignore' });

  let ver = null;
  for (let i = 0; i < 60 && !ver; i++) {
    await sleep(250);
    try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); } catch (e) {}
  }
  if (!ver) { console.error('Chromium nie wystartował'); process.exit(1); }

  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?file://${SRC}`, { method: 'PUT' })).json();
  const ws = new WebSocket(tgt.webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  const send = (method, params = {}) => new Promise(res => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const events = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
    else if (m.method) events.push(m.method);
  };
  await new Promise(r => ws.onopen = r);

  await send('Page.enable');
  await send('Page.navigate', { url: `file://${SRC}` });
  for (let i = 0; i < 80 && !events.includes('Page.loadEventFired'); i++) await sleep(150);
  await sleep(1200);

  const foot = `<div style="width:100%;font-family:'DejaVu Sans',sans-serif;font-size:7pt;
    color:#8A7F92;padding:0 16mm;display:flex;justify-content:center;">
    <span class="pageNumber"></span></div>`;

  const { data } = await send('Page.printToPDF', {
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: foot,
    marginBottom: 0.55
  });
  fs.writeFileSync(OUT, Buffer.from(data, 'base64'));
  console.log('napisano', path.basename(OUT), (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB');
  ws.close(); chrome.kill();
  process.exit(0);
})();
