// Zrzut ekranu w emulacji druku (szerokość A5) do kontroli składu
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SRC = process.argv[2], OUT = process.argv[3], Y = +(process.argv[4]||0), H = +(process.argv[5]||2200);
const PORT = 9444; const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const chrome = spawn(CHROME, ['--headless=new','--no-sandbox','--disable-gpu','--font-render-hinting=none',
    `--remote-debugging-port=${PORT}`,'about:blank'], { stdio:'ignore' });
  let ver=null; for (let i=0;i<60&&!ver;i++){ await sleep(250); try{ver=await(await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();}catch(e){} }
  const tgt = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json();
  const ws = new WebSocket(tgt.webSocketDebuggerUrl); let id=0; const p=new Map();
  const send=(m,q={})=>new Promise(r=>{const i=++id;p.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:q}));});
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&p.has(m.id)){p.get(m.id)(m.result);p.delete(m.id);}};
  await new Promise(r=>ws.onopen=r);
  await send('Emulation.setDeviceMetricsOverride',{width:559,height:794,deviceScaleFactor:2,mobile:false});
  await send('Emulation.setEmulatedMedia',{media:'print'});
  await send('Page.enable'); await send('Page.navigate',{url:`file://${SRC}`}); await sleep(2000);
  const r = await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,
    clip:{x:0,y:Y,width:559,height:H,scale:1.6}});
  fs.writeFileSync(OUT, Buffer.from(r.data,'base64'));
  console.log('zrzut', path.basename(OUT)); ws.close(); chrome.kill(); process.exit(0);
})();
