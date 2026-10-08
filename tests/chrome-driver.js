// Real-time test driver: loads a page in headless Chrome over the DevTools
// protocol, waits (on the wall clock) for #r to appear, prints it.
// Optional 3rd arg: screenshot path, taken once #r or __shotReady appears.
// usage: node --experimental-websocket chrome-driver.js <file-url> <profile-dir> [shot.png] [w] [h]
// Chrome location: set CHROME_PATH, otherwise the usual install spot per OS.
// (Real wall-clock waits on purpose: headless Chrome's virtual-time mode
// stalls on IndexedDB writes and never-ending CSS animations.)
const { spawn } = require('child_process');
const fs = require('fs');

const [url, profile, shot, w = '1200', h = '900'] = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const chromePath = process.env.CHROME_PATH || {
    win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: 'google-chrome'
}[process.platform];
const chrome = spawn(chromePath, [
    '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, `--window-size=${w},${h}`, 'about:blank'
], { stdio: 'ignore' });

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    let targets;
    for (let i = 0; i < 50; i++) {
        try { targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); break; } catch (e) { await sleep(200); }
    }
    const page = targets.find(t => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    });
    const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const evaluate = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.result.value;

    await send('Page.enable');
    // headless pages never have real focus, so :focus styles wouldn't apply
    await send('Emulation.setFocusEmulationEnabled', { enabled: true });
    // headless windows can't go narrower than ~500px, so emulate a phone screen
    if (Number(w) < 600) {
        await send('Emulation.setDeviceMetricsOverride', { width: Number(w), height: Number(h), deviceScaleFactor: 1, mobile: true });
    }
    await send('Page.navigate', { url });
    let out = null;
    for (let i = 0; i < 120 && out === null; i++) {
        await sleep(500);
        out = await evaluate(`(document.getElementById('r') || {}).textContent ?? (window.__shotReady ? 'SHOT READY' : null)`);
    }
    if (shot) {
        await sleep(400);
        const res = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(shot, Buffer.from(res.result.data, 'base64'));
    }
    console.log(out === null ? 'TIMED OUT, title: ' + await evaluate('document.title') : out);
    ws.close();
    chrome.kill();
    process.exit(0);
})().catch(e => { console.error(e); chrome.kill(); process.exit(1); });
