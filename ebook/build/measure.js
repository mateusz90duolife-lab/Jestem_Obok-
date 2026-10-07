// Mierzy wysokość sekcji .pg (mm) w emulacji druku przy zadanej szerokości treści (mm)
const { spawn } = require('child_process');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SRC = process.argv[2], WMM = +(process.argv[3]||180), SEL = process.argv[4] || '.pg';
const PORT = 9555, sleep = ms => new Promise(r => setTimeout(r, ms)), PX = 96/25.4;
(async () => {
  const ch = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu',`--remote-debugging-port=${PORT}`,'about:blank'], {stdio:'ignore'});
  let v=null; for (let i=0;i<60&&!v;i++){ await sleep(250); try{v=await(await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();}catch(e){} }
  const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl); let id=0; const p=new Map();
  const send=(m,q={})=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:q}));});
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m.result);p.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  await send('Emulation.setDeviceMetricsOverride',{width:Math.round(WMM*PX),height:1000,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{media:'print'});
  await send('Page.enable'); await send('Page.navigate',{url:`file://${SRC}`}); await sleep(1500);
  const r = await send('Runtime.evaluate',{returnByValue:true,expression:
    `[...document.querySelectorAll('${SEL}')].map((e,i)=>[i+1,(e.getBoundingClientRect().height/${PX}).toFixed(0),(e.querySelector('h2')||{}).textContent||e.className])`});
  for (const [i,h,t] of r.result.value) console.log(String(i).padStart(2), String(h).padStart(4)+' mm ', t);
  ws.close(); ch.kill(); process.exit(0);
})();
