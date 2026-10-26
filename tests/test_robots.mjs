// Joue des parties complètes de robots dans Chrome (sans écran) et vérifie tout.
// Usage : node tests/test_robots.mjs   (depuis rikiki-passation, après `python3 build.py && python3 build_test_pages.py`, ou via ./tester.sh)
// Rien n'est écrit dans la vraie base : le test tourne sur la fausse base locale.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
if (!CHROME) { console.error('Chrome introuvable'); process.exit(2); }
const CAS = [[3, 'quick'], [4, 'quick'], [6, 'quick', '&table=1'], [5, 'up'], [3, 'quick', '&afk=1']];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let mal = 0;
// Une partie complète dans un Chrome neuf. Renvoie null si le navigateur n'a pas répondu (démarrage à froid lent sur les machines GitHub).
async function jouerUneFois(n, mode, extra) {
  const prof = mkdtempSync(join(tmpdir(), 'rk-test-')), port = 9300 + Math.floor(Math.random() * 500);
  const url = 'file://' + resolve('srv/bots.html') + `?n=${n}&mode=${mode}${extra}`;
  const ch = spawn(CHROME, ['--headless=new', '--lang=en-US', '--disable-gpu', '--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, `--user-data-dir=${prof}`, url], { stdio: 'ignore' });
  let res = null;
  try {
    let ws;
    for (let i = 0; i < 100 && !ws; i++) {
      try { const tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const t = tabs.find(x => x.type === 'page'); if (t) ws = new WebSocket(t.webSocketDebuggerUrl); } catch { await sleep(200); }
    }
    await new Promise((ok, ko) => { ws.onopen = ok; ws.onerror = ko; });
    let id = 0; const wait = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) wait.get(m.id)(m); };
    const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const r = await send('Runtime.evaluate', { expression: 'JSON.stringify(window.__botsResult||null)', returnByValue: true });
      const v = r.result && r.result.result && r.result.result.value;
      if (v && v !== 'null') { res = JSON.parse(v); break; }
      await sleep(500);
    }
    ws.close();
  } catch (e) { res = null; }
  ch.kill(); await sleep(300); rmSync(prof, { recursive: true, force: true });
  return res;
}
for (const [n, mode, extra = ''] of CAS) {
  let res = null;
  for (let essai = 1; essai <= 3 && !res; essai++) {
    res = await jouerUneFois(n, mode, extra);
    if (!res && essai < 3) console.log(`   (essai ${essai} sans résultat pour ${n} joueurs : on recommence)`);
  }
  if (!res) { mal++; console.log(`✗ ${n} joueurs, mode ${mode}${extra ? ' (joueur absent)' : ''} : pas de résultat (le test n'a pas fini)`); continue; }
  if (res.ok) console.log(`✓ ${n} joueurs, mode ${mode}${extra ? ' (joueur absent)' : ''} : partie complète, ${res.checks.length} contrôles réussis`);
  else {
    mal++; console.log(`✗ ${n} joueurs, mode ${mode}${extra ? ' (joueur absent)' : ''} :`);
    if (res.crash) console.log('   plantage :', res.crash);
    res.checks.filter(c => !c.ok).forEach(c => console.log('   -', c.name, c.info || ''));
    res.errors.slice(0, 5).forEach(e => console.log('   -', e));
  }
}
console.log(mal ? `\n${mal} PROBLÈME(S) ❌` : '\nTOUT EST BON ✅');
process.exit(mal ? 1 : 0);
