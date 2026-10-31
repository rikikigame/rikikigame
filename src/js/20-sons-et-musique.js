/* ===================== v50 : bruitages et musique de café (Web Audio : tout est synthétisé, aucun fichier son) =====================
   Chaque appareil regarde la partie évoluer et joue les sons lui-même : tous les joueurs les entendent en même temps.
   - un joueur coupe à l'atout            → « shiiiing » de katana (souffle filtré qui monte + tintement métallique)
   - un As prend un pli où le Roi de sa couleur était maître → gros impact
   - nouvelle donne                         → mélange (riffle) puis distribution
   - pendant la partie                      → petite musique de café douce (réglage séparé)
   Réglages mémorisés sur l'appareil : rikiki_sfx / rikiki_music ('0' = coupé, activés par défaut). Pas de vibration. */
var sfxOn = true, musicOn = true;
try{ sfxOn = localStorage.getItem('rikiki_sfx') !== '0'; musicOn = localStorage.getItem('rikiki_music') !== '0'; }catch(e){}
var audioCtx = null, sfxBus = null, musicBus = null, noiseBuf = null, sfxShaper = null;
// v68 : dans l'appli iPhone (window.__RIKIKI_APP, posé par l'appli), le son joue même en mode silencieux.
// Pas dans Safari : là, « playback » couperait la musique écoutée à côté.
var unmuteAudio = null, unmuteState = 'pas encore';
// Astuce connue (iOS) : un petit son MUET joué en boucle par un vrai lecteur audio fait passer toute la page en mode « lecture »,
// donc le Web Audio (bruitages, musique) sort aussi quand l'iPhone est en mode silencieux. Seulement dans l'appli.
function unmuteForApp(){
  if(!window.__RIKIKI_APP || unmuteAudio) return;
  try{
    var n = 4000, bytes = new Uint8Array(44 + n), dv = new DataView(bytes.buffer);
    var str = function(o, t){ for(var i=0;i<t.length;i++) dv.setUint8(o+i, t.charCodeAt(i)); };
    str(0,'RIFF'); dv.setUint32(4, 36+n, true); str(8,'WAVE'); str(12,'fmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
    dv.setUint32(24,8000,true); dv.setUint32(28,8000,true); dv.setUint16(32,1,true); dv.setUint16(34,8,true); str(36,'data'); dv.setUint32(40,n,true);
    for(var i=0;i<n;i++) bytes[44+i] = 128; // silence (8 bits non signés)
    var a = new Audio(URL.createObjectURL(new Blob([bytes], { type:'audio/wav' })));
    a.loop = true; a.setAttribute('playsinline', ''); unmuteAudio = a;
    var pr = a.play();
    if(pr && pr.then) pr.then(function(){ unmuteState = 'ok'; }).catch(function(){ unmuteState = 'refusé'; unmuteAudio = null; }); // refusé = pas de geste : on réessaiera au prochain toucher
  }catch(e){ unmuteState = 'erreur'; unmuteAudio = null; }
}
function audioSessionForApp(){
  try{ if(window.__RIKIKI_APP && navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; }catch(e){}
  unmuteForApp();
}
function audioInit(){
  audioSessionForApp();
  if(audioCtx) return audioCtx;
  var AC = window.AudioContext || window.webkitAudioContext; if(!AC) return null;
  try{
    var c = new AC();
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 4; comp.connect(c.destination);
    sfxBus = c.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(comp);
    musicBus = c.createGain(); musicBus.gain.value = 0.0001; musicBus.connect(comp);
    var len = c.sampleRate * 2; noiseBuf = c.createBuffer(1, len, c.sampleRate);
    var d = noiseBuf.getChannelData(0); for(var i=0;i<len;i++) d[i] = Math.random()*2-1;
    var curve = new Float32Array(1024); for(var j=0;j<1024;j++){ var x = j/511.5-1; curve[j] = Math.tanh(3*x); } sfxShaper = curve;
    audioCtx = c;
  }catch(e){ audioCtx = null; }
  return audioCtx;
}
// les navigateurs n'autorisent le son qu'après un geste : on « déverrouille » au premier toucher / clic / touche
function audioUnlock(){
  if(!sfxOn && !musicOn) return;
  var c = audioInit(); if(c && c.state==='suspended') c.resume().then(musicSync).catch(function(){});
  if(c && deckTheme==='hallo') halloLoadSamples(); // v64 : rire de sorcière, etc.
  musicSync();
}
['pointerdown','touchend','keydown'].forEach(function(ev){ document.addEventListener(ev, audioUnlock, true); });
document.addEventListener('visibilitychange', function(){
  if(!audioCtx) return;
  if(document.hidden) audioCtx.suspend().catch(function(){});
  else if(sfxOn || musicOn) audioCtx.resume().then(musicSync).catch(function(){});
});
function audioReady(){ return !!(audioCtx && audioCtx.state==='running' && !document.hidden); }
function sndNoise(t, dur){ var s = audioCtx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.start(t, Math.random()*1.5); s.stop(t+dur+0.05); return s; }
function sndEnv(param, t, peak, attack, decay){ // monte en « attack » puis s'éteint en « decay »
  param.value = 0.0001; // sinon le volume vaut 1 avant le début de l'enveloppe (gros « clic »)
  param.setValueAtTime(0.0001, t); param.exponentialRampToValueAtTime(peak, t+attack); param.exponentialRampToValueAtTime(0.0001, t+attack+decay);
}
function sndFilter(type, freq, q){ var f = audioCtx.createBiquadFilter(); f.type = type; f.frequency.value = freq; if(q!=null) f.Q.value = q; return f; }
function sndChain(nodes){ for(var i=0;i<nodes.length-1;i++) nodes[i].connect(nodes[i+1]); return nodes[nodes.length-1]; }

// --- « shiiiing » de katana ---
function sfxKatana(t){
  var c = audioCtx;
  var bp = sndFilter('bandpass', 700, 5), g = c.createGain();       // 1. souffle qui monte (la lame sort du fourreau)
  bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(7500, t+0.36);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.55, t+0.32); g.gain.exponentialRampToValueAtTime(0.0001, t+0.42);
  sndChain([sndNoise(t, 0.45), bp, g, sfxBus]);
  var t2 = t + 0.3;                                                  // 2. tintement métallique bref
  [[2637,0.20,1.1],[2651,0.12,1.0],[3951,0.13,0.75],[5274,0.09,0.55],[6890,0.06,0.4],[9120,0.04,0.25]].forEach(function(p){
    var o = c.createOscillator(), og = c.createGain(); o.type = 'sine';
    o.frequency.setValueAtTime(p[0]*1.012, t2); o.frequency.exponentialRampToValueAtTime(p[0], t2+0.06);
    sndEnv(og.gain, t2, p[1], 0.004, p[2]);
    sndChain([o, og, sfxBus]); o.start(t2); o.stop(t2+p[2]+0.05);
  });
  var g2 = c.createGain(); sndEnv(g2.gain, t2, 0.3, 0.002, 0.04);   // petit « tchk » du contact
  sndChain([sndNoise(t2, 0.06), sndFilter('highpass', 4500), g2, sfxBus]);
}
// --- gros impact : l'As tombe sur le Roi ---
function sfxImpact(t){
  var c = audioCtx;
  var o = c.createOscillator(), ws = c.createWaveShaper(), g = c.createGain(); // coup grave qui descend, un peu saturé
  o.type = 'sine'; o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(40, t+0.45);
  ws.curve = sfxShaper; sndEnv(g.gain, t, 0.5, 0.006, 0.8);
  sndChain([o, ws, g, sfxBus]); o.start(t); o.stop(t+0.9);
  var lp = sndFilter('lowpass', 6000), gn = c.createGain();          // claquement
  lp.frequency.setValueAtTime(6000, t); lp.frequency.exponentialRampToValueAtTime(250, t+0.25);
  sndEnv(gn.gain, t, 0.38, 0.003, 0.28);
  sndChain([sndNoise(t, 0.32), lp, gn, sfxBus]);
  [110, 164.8, 220, 277.2].forEach(function(f, i){                   // accord « cuivré » bref, audible sur un petit haut-parleur
    var s = c.createOscillator(), sf = sndFilter('lowpass', 1600, 1), sg = c.createGain();
    s.type = 'sawtooth'; s.frequency.value = f; sf.frequency.setValueAtTime(2200, t); sf.frequency.exponentialRampToValueAtTime(400, t+0.7);
    sndEnv(sg.gain, t+0.01, 0.045 - i*0.006, 0.01, 0.75);
    sndChain([s, sf, sg, sfxBus]); s.start(t); s.stop(t+0.9);
  });
  var o2 = c.createOscillator(), g3 = c.createGain(); o2.type = 'triangle'; o2.frequency.value = 55; // grondement
  sndEnv(g3.gain, t+0.02, 0.18, 0.04, 1.3); sndChain([o2, g3, sfxBus]); o2.start(t); o2.stop(t+1.5);
}
// --- cartes ---
function sfxFlick(t, vol, freq, dur){
  var g = audioCtx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  sndChain([sndNoise(t, dur+0.02), sndFilter('bandpass', freq, 1.3), g, sfxBus]);
}
function sfxShuffle(t){ // riffle : rafale de petits clics qui s'accélère, puis le paquet se referme
  var x = t;
  for(var i=0;i<32;i++){ sfxFlick(x, 0.28 + Math.random()*0.14, 2200 + Math.random()*2600, 0.014); x += 0.034 - i*0.0005 + Math.random()*0.008; }
  var g = audioCtx.createGain(); sndEnv(g.gain, x, 0.35, 0.05, 0.3);
  sndChain([sndNoise(x, 0.4), sndFilter('bandpass', 1500, 0.7), g, sfxBus]);
  return x + 0.4;
}
function sfxDealCard(t){ // carte lancée : petit souffle puis claquement sur la table
  var bp = sndFilter('bandpass', 1200, 1.5), g = audioCtx.createGain();
  bp.frequency.setValueAtTime(1200, t); bp.frequency.exponentialRampToValueAtTime(3800, t+0.07);
  sndEnv(g.gain, t, 0.22, 0.03, 0.05);
  sndChain([sndNoise(t, 0.1), bp, g, sfxBus]);
  sfxFlick(t+0.075, 0.55, 900, 0.035);
}
function sfxDeal(t, n){ var x = sfxShuffle(t) + 0.1; for(var i=0;i<n;i++) sfxDealCard(x + i*0.11); }

// --- qui déclenche quoi : on compare la partie à ce qu'on a déjà vu ---
var sfxGame = null, sfxRoundKey = null, sfxSeen = {}, sfxLast = [];
function aceTakesMasterKing(cards, winnerId, trump){
  var led = cards[0].card.suit;
  for(var i=1;i<cards.length;i++){
    var p = cards[i]; if(p.playerId!==winnerId || p.card.rank!=='A') continue;
    var prefix = cards.slice(0, i), mid = trickWinner(prefix, led, trump);
    var master = prefix.filter(function(x){ return x.playerId===mid; })[0];
    return !!(master && master.card.rank==='K' && master.card.suit===p.card.suit);
  }
  return false;
}
// --- v64 (thème Halloween) : trois sons possibles pour la coupe, après le bruit de lame (le rire était trop robotique) ---
function sfxBell(t, bus, vol){ // cloche d'église / d'enterrement : deux coups graves, partiels inharmoniques, longue résonance
  var c = audioCtx, out = bus || sfxBus, vv = vol==null ? 1 : vol;
  [[0, 196, 1], [1.05, 164.8, 0.8]].forEach(function(s){
    var st = t + s[0];
    [[1, 0.5, 3.4], [2.0, 0.28, 2.6], [2.76, 0.3, 2.2], [4.07, 0.16, 1.6], [5.4, 0.12, 1.2], [8.93, 0.05, 0.7]].forEach(function(p){
      var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = s[1]*p[0];
      sndEnv(g.gain, st, p[1]*0.5*s[2]*vv, 0.004, p[2]);
      sndChain([o, g, out]); o.start(st); o.stop(st+p[2]+0.1);
    });
    var gn = c.createGain(); sndEnv(gn.gain, st, 0.12*s[2]*vv, 0.002, 0.05);   // « tong » du battant
    sndChain([sndNoise(st, 0.08), sndFilter('bandpass', 1400, 1.2), gn, out]);
  });
}
// ---- sons enregistrés (thème Halloween) : petits fichiers du site (dossier sons/), chargés à la demande ; s'ils manquent, on joue un son fabriqué ----
var HALLO_SAMPLES = { witch:'sons/witch.m4a', scream:'sons/scream.m4a', creak:'sons/creak.m4a' }, halloBuf = {}, halloBufState = {};
function halloLoadSamples(){
  if(!audioCtx) return;
  Object.keys(HALLO_SAMPLES).forEach(function(k){
    if(halloBufState[k]) return; halloBufState[k] = 'chargement';
    fetch(HALLO_SAMPLES[k]).then(function(r){ if(!r.ok) throw new Error(String(r.status)); return r.arrayBuffer(); })
      .then(function(ab){ return new Promise(function(ok, ko){ audioCtx.decodeAudioData(ab, ok, ko); }); }) // forme avec rappels : vieux Safari
      .then(function(buf){ halloBuf[k] = buf; halloBufState[k] = 'ok'; })
      .catch(function(){ halloBufState[k] = 'absent'; });
  });
}
function sfxSample(name, t, vol, bus){ // false si le son n'est pas (encore) chargé
  var b = halloBuf[name]; if(!b || !audioCtx) return false;
  var s = audioCtx.createBufferSource(), g = audioCtx.createGain(); s.buffer = b; g.gain.value = vol==null ? 0.9 : vol; s.connect(g); g.connect(bus || sfxBus); s.start(t); return true;
}
// --- v64 (thème Halloween) : cri grave quand l'As prend le Roi ---
function sfxRoar(t){
  var c = audioCtx, dur = 1.15;
  var lfo = c.createOscillator(), lg = c.createGain(), am = c.createGain(), env = c.createGain(), lp = sndFilter('lowpass', 1100, 1.2), ws = c.createWaveShaper();
  lfo.frequency.value = 27; lg.gain.value = 0.38; am.gain.value = 0.62; lfo.connect(lg); lg.connect(am.gain);       // vibration rauque (grognement)
  ws.curve = sfxShaper;
  lp.frequency.setValueAtTime(1300, t); lp.frequency.exponentialRampToValueAtTime(380, t+dur);
  sndEnv(env.gain, t, 0.55, 0.09, dur);
  [94, 99, 47].forEach(function(f0){
    var o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0*1.35, t); o.frequency.exponentialRampToValueAtTime(f0*0.72, t+dur);
    o.connect(ws); o.start(t); o.stop(t+dur+0.1);
  });
  sndChain([ws, lp, am, env, sfxBus]); lfo.start(t); lfo.stop(t+dur+0.1);
  var gn = c.createGain(); sndEnv(gn.gain, t, 0.2, 0.08, dur*0.9);        // souffle rauque
  sndChain([sndNoise(t, dur), sndFilter('bandpass', 520, 0.8), gn, sfxBus]);
}
function sfxOnGame(g){
  if(!g || !g.code) return;
  var first = sfxGame !== g.code;
  if(first){ sfxGame = g.code; sfxSeen = {}; sfxRoundKey = null; }
  var rk = g.code+'|'+g.round+'|'+(g.dealSeed||''), ev = [];
  if(sfxRoundKey !== rk){ // nouvelle donne (pas quand on recharge la page en pleine manche)
    var noBid = !Object.keys(g.bids||{}).some(function(id){ return g.bids[id]!=null; });
    if(g.dealSeed && (g.status==='dealing' || (g.status==='bidding' && noBid && !first))){
      var H = (g.roundPlan && g.roundPlan[g.round]) || 1, np = (g.playerOrder||[]).length || 2;
      ev.push({ type:'deal', n: Math.max(3, Math.min(12, H*np)) });
    }
    sfxRoundKey = rk;
  }
  var trump = g.trumpCard ? g.trumpCard.suit : null;
  var tricks = [];
  if(g.currentTrick && g.currentTrick.length) tricks.push(g.currentTrick);
  if(g.lastTrick && g.lastTrick.cards && g.lastTrick.cards.length) tricks.push(g.lastTrick.cards);
  tricks.forEach(function(trick){ // une carte n'est jouée qu'une fois par donne : clé = donne + joueur + carte
    var led = trick[0].card.suit;
    trick.forEach(function(play, i){
      var k = rk+'|'+play.playerId+'|'+play.card.suit+play.card.rank;
      if(sfxSeen[k]) return; sfxSeen[k] = 1;
      if(!first && i>0 && trump && play.card.suit===trump && led!==trump) ev.push({ type:'ruff' });
    });
  });
  var lt = g.lastTrick;
  if(lt && lt.at && lt.cards && lt.cards.length){
    var tk = rk+'|T|'+lt.at+'|'+lt.winnerId;
    if(!sfxSeen[tk]){ sfxSeen[tk] = 1; if(!first && aceTakesMasterKing(lt.cards, lt.winnerId, trump)) ev.push({ type:'impact' }); }
  }
  if(!ev.length) return;
  sfxLast = sfxLast.concat(ev.map(function(e){ return e.type; })).slice(-30);
  if(ev.length > 6 || !sfxOn || !audioReady()) return; // rattrapage après une coupure réseau : on ne rejoue pas tout
  var t = audioCtx.currentTime + 0.03;
  ev.forEach(function(e){
    if(e.type==='deal'){ sfxDeal(t, e.n); }
    else if(e.type==='ruff'){ sfxKatana(t); if(deckTheme==='hallo'){ if(!sfxSample('witch', t+0.3, 0.95)) sfxBell(t+0.35); t += 1.7; } else t += 0.45; }
    else if(e.type==='impact'){ sfxImpact(t); if(deckTheme==='hallo'){ sfxRoar(t+0.05); t += 1.3; } else t += 0.3; }
  });
}

// --- musique de café : jazz doux généré à la volée (piano électrique, contrebasse, balais, quelques notes de vibraphone) ---
var MUSIC_BPM = 76, musicTimer = null, musicNext = 0, musicStep = 0, musicProg = 0;
var MUSIC_PROGS = [ // [basse, notes de l'accord] en numéros MIDI ; 1 accord par mesure
  [[38,[53,57,60,64]], [43,[53,57,59,64]], [36,[52,55,59,62]], [45,[55,60,64,71]]],  // Dm9 · G13 · Cmaj9 · Am9
  [[41,[52,57,60,64]], [40,[50,55,59,62]], [45,[55,60,64,67]], [43,[53,57,62,65]]],  // Fmaj7 · Em7 · Am7 · G7sus
  [[36,[52,55,59,62]], [45,[55,60,64,67]], [38,[53,57,60,64]], [43,[53,59,62,65]]]   // Cmaj9 · Am7 · Dm9 · G7
];
var MUSIC_SCALE = [72,74,76,79,81,84]; // pentatonique de do, octave du haut
function midiHz(m){ return 440*Math.pow(2, (m-69)/12); }
function musicEP(t, m, vol, dur){ // piano électrique (type Rhodes) : sinus + « tine » qui s'éteint vite
  var c = audioCtx, f = midiHz(m), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
  o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f*4.0;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+0.015); g.gain.exponentialRampToValueAtTime(vol*0.35, t+0.6); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  sndEnv(g2.gain, t, vol*0.25, 0.005, 0.25);
  o.connect(g); o2.connect(g2); g.connect(musicBus); g2.connect(musicBus);
  o.start(t); o2.start(t); o.stop(t+dur+0.05); o2.stop(t+0.4);
}
function musicBass(t, m, dur){
  var c = audioCtx, o = c.createOscillator(), lp = sndFilter('lowpass', 500, 0.7), g = c.createGain();
  o.type = 'triangle'; o.frequency.value = midiHz(m);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t+0.02); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  sndChain([o, lp, g, musicBus]); o.start(t); o.stop(t+dur+0.05);
}
function musicBrush(t, vol, dur){
  var g = audioCtx.createGain(); sndEnv(g.gain, t, vol, 0.02, dur);
  sndChain([sndNoise(t, dur+0.05), sndFilter('bandpass', 6500, 0.8), g, musicBus]);
}
function musicVibes(t, m){
  var c = audioCtx, o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sine'; o.frequency.value = midiHz(m); lfo.frequency.value = 5.5; lg.gain.value = 0.02;
  sndEnv(g.gain, t, 0.07, 0.01, 1.4);
  lfo.connect(lg); lg.connect(g.gain); o.connect(g); g.connect(musicBus);
  o.start(t); lfo.start(t); o.stop(t+1.5); lfo.stop(t+1.5);
}
// --- v64 (thème Halloween) : musique d'horreur de l'accueil — orgue grave, piano clairsemé un peu faux, vent ---
var horrorProg = 0, horrorFx = null;
var HORROR_PROGS = [ // [basse, accord d'orgue] : La mineur · Si bémol (napolitaine) · Mi majeur · La mineur
  [[33,[57,60,64]], [34,[58,62,65]], [28,[56,59,64]], [33,[57,60,64]]],
  [[33,[57,60,64]], [29,[57,60,65]], [31,[55,59,62,65]], [28,[56,59,64]]],   // Am · F · G7 · E
  [[38,[57,62,65]], [37,[56,61,64]], [33,[57,60,63]], [28,[56,59,62,65]]]    // Dm · C#dim7 · Adim · E7
];
var HORROR_NOTES = [76, 75, 72, 71, 69, 68, 64, 63]; // mi, mi bémol, do, si, la, sol dièse, mi, mi bémol : notes qui rampent
function horrorEcho(){ // petit écho long (comme une grande salle vide), créé une seule fois
  if(horrorFx && horrorFx.ctx===audioCtx) return horrorFx.input;
  var c = audioCtx, d = c.createDelay(1.5), fb = c.createGain(), lp = sndFilter('lowpass', 1700), out = c.createGain();
  d.delayTime.value = 0.46; fb.gain.value = 0.5; out.gain.value = 0.6;
  d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(out); out.connect(musicBus);
  horrorFx = { ctx:c, input:d }; return d;
}
function horrorOrgan(t, m, vol, dur){ // orgue : dents de scie douces filtrées, trémolo lent
  var c = audioCtx, f = midiHz(m), o = c.createOscillator(), o2 = c.createOscillator(), lp = sndFilter('lowpass', 760, 0.8), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f*2.003;
  lfo.frequency.value = 4.2; lg.gain.value = vol*0.18; lfo.connect(lg); lg.connect(g.gain);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+dur*0.35); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  var m2 = c.createGain(); m2.gain.value = 0.35;
  o.connect(lp); o2.connect(m2); m2.connect(lp); sndChain([lp, g, musicBus]); g.connect(horrorEcho());
  o.start(t); o2.start(t); lfo.start(t); [o, o2, lfo].forEach(function(n){ n.stop(t+dur+0.05); });
}
function horrorPiano(t, m, vol){ // piano clairsemé, légèrement désaccordé, qui résonne longtemps
  var c = audioCtx, f = midiHz(m), g = c.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+0.012); g.gain.exponentialRampToValueAtTime(vol*0.3, t+0.7); g.gain.exponentialRampToValueAtTime(0.0001, t+3.4);
  [[1, 'sine', 1], [2, 'sine', 0.3], [3, 'triangle', 0.12], [4.01, 'sine', 0.08]].forEach(function(p){
    var o = c.createOscillator(), pg = c.createGain(); o.type = p[1]; o.frequency.value = f*p[0]; o.detune.value = (Math.random()-0.5)*40; pg.gain.value = p[2];
    o.connect(pg); pg.connect(g); o.start(t); o.stop(t+3.5);
  });
  g.connect(musicBus); g.connect(horrorEcho());
}
function horrorWind(t, dur, vol){ // souffle de vent qui monte et retombe
  var bp = sndFilter('bandpass', 380, 1.4), g = audioCtx.createGain();
  bp.frequency.setValueAtTime(260, t); bp.frequency.linearRampToValueAtTime(620, t+dur*0.5); bp.frequency.linearRampToValueAtTime(300, t+dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t+dur*0.5); g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  sndChain([sndNoise(t, dur), bp, g, musicBus]);
}
// piano creepy (en partie) : note grave, phrase clairsemée qui descend en mineur, boîte à musique rare, accord dissonant, et de loin en loin une cloche d'église ou un cri
var pianoMotif = null, pianoNextAmb = 0;
var PIANO_BASS = [33, 33, 29, 28, 33, 31, 28, 33];
var PIANO_MOTIFS = [[81, 80, 76, 72], [76, 75, 72, 71, 69], [88, 87, 84, 83], [69, 72, 71, 68], [84, 81, 80, 76, 75]];
function musicBpm(){ return deckTheme==='hallo' ? ((screen==='game' && gameDoc) ? 54 : 46) : MUSIC_BPM; }
function musicBeatPiano(t){
  var beat = 60/54, b = musicStep % 4, bar = Math.floor(musicStep/4);
  if(b===0){
    var bass = PIANO_BASS[bar % PIANO_BASS.length]; horrorPiano(t, bass, 0.08); if(Math.random()<0.5) horrorPiano(t + beat*2, bass+7, 0.04);
    pianoMotif = PIANO_MOTIFS[Math.floor(Math.random()*PIANO_MOTIFS.length)];
  }
  if(pianoMotif && b < pianoMotif.length && Math.random() < 0.72) horrorPiano(t + (Math.random()-0.3)*0.12, pianoMotif[b], 0.05 + Math.random()*0.02);
  if(b===3 && pianoMotif && pianoMotif.length > 4 && Math.random() < 0.6) horrorPiano(t + beat*0.5, pianoMotif[4], 0.04);
  if(Math.random() < 0.12) horrorPiano(t + beat*Math.random(), 91 + Math.floor(Math.random()*7), 0.025);
  if(b===0 && bar > 0 && bar % 11 === 0) [64, 65, 70].forEach(function(m, i){ horrorPiano(t + i*0.03, m, 0.04); });
  if(t >= pianoNextAmb){
    var r = Math.random();
    if(r < 0.55 || !halloBuf.scream) sfxBell(t + 0.3, musicBus, 0.5);
    else if(r < 0.85) sfxSample('scream', t + 0.3, 0.3, musicBus);
    else if(halloBuf.creak) sfxSample('creak', t + 0.3, 0.35, musicBus);
    pianoNextAmb = t + 18 + Math.random()*30;
  }
  musicStep++;
}
function musicBeatHorror(t){
  var b = musicStep % 4, bar = Math.floor(musicStep/4) % 4, beat = 60/46;
  if(b===0 && bar===0 && musicStep>0 && Math.random()<0.6) horrorProg = Math.floor(Math.random()*HORROR_PROGS.length);
  var ch = HORROR_PROGS[horrorProg][bar];
  if(b===0){
    ch[1].forEach(function(m, i){ horrorOrgan(t + i*0.04, m, 0.05, beat*4.2); });
    horrorOrgan(t, ch[0], 0.07, beat*4.2); horrorOrgan(t, ch[0]+12, 0.03, beat*4.2);
    if(Math.random()<0.55) horrorWind(t + beat, beat*3, 0.05);
  }
  if(Math.random()<0.34) horrorPiano(t + (Math.random()<0.4 ? beat*0.5 : 0), HORROR_NOTES[Math.floor(Math.random()*HORROR_NOTES.length)], 0.05 + Math.random()*0.02);
  if(b===3 && bar===3 && Math.random()<0.45){ [76, 75, 76, 72].forEach(function(m, i){ horrorPiano(t + i*beat*0.9, m, 0.045); }); } // petit motif qui revient
  musicStep++;
}
function musicBeat(t){
  if(deckTheme==='hallo') return (screen==='game' && gameDoc) ? musicBeatPiano(t) : musicBeatHorror(t); // piano creepy en partie, orgue à l'accueil
  var beat = 60/MUSIC_BPM, b = musicStep % 4, bar = Math.floor(musicStep/4) % 4;
  if(b===0 && bar===0 && musicStep>0 && Math.random()<0.5) musicProg = Math.floor(Math.random()*MUSIC_PROGS.length);
  var ch = MUSIC_PROGS[musicProg][bar], sw = beat*2/3; // croches « swing »
  if(b===0){ ch[1].forEach(function(m, i){ musicEP(t + i*0.012, m, 0.06, beat*3.2); }); }
  if(b===2 && Math.random()<0.45){ ch[1].forEach(function(m){ musicEP(t + sw, m, 0.035, beat*1.2); }); } // petit rappel d'accord
  var walk = [ch[0], ch[0]+7, ch[0]+12, ch[0]+(Math.random()<0.5 ? 10 : 5)]; // basse qui marche
  musicBass(t, walk[b] - (walk[b] > 52 ? 12 : 0), beat*0.9);
  musicBrush(t, b%2 ? 0.05 : 0.03, b%2 ? 0.18 : 0.1); if(Math.random()<0.5) musicBrush(t+sw, 0.02, 0.08);
  if(Math.random()<0.28) musicVibes(t + (Math.random()<0.5 ? 0 : sw), MUSIC_SCALE[Math.floor(Math.random()*MUSIC_SCALE.length)]);
  musicStep++;
}
function musicTick(){
  if(!audioCtx) return;
  if(musicNext < audioCtx.currentTime) musicNext = audioCtx.currentTime + 0.05;
  while(musicNext < audioCtx.currentTime + 0.5){ musicBeat(musicNext); musicNext += 60/musicBpm(); }
}
function musicSync(){ // la musique tourne seulement pendant une partie en ligne, si elle est activée
  var want = musicOn && audioReady() && ((screen==='game' && !!gameDoc) || (deckTheme==='hallo' && screen==='entry')); // thème Halloween : aussi à l'accueil
  if(want && !musicTimer){
    musicNext = audioCtx.currentTime + 0.1; musicStep = 0; musicProg = Math.floor(Math.random()*MUSIC_PROGS.length); pianoNextAmb = audioCtx.currentTime + 12;
    musicBus.gain.cancelScheduledValues(audioCtx.currentTime);
    musicBus.gain.setValueAtTime(0.0001, audioCtx.currentTime); musicBus.gain.exponentialRampToValueAtTime(0.5, audioCtx.currentTime + 2.5);
    musicTick(); musicTimer = setInterval(musicTick, 120);
  } else if(!want && musicTimer){
    clearInterval(musicTimer); musicTimer = null;
    if(audioCtx){ musicBus.gain.cancelScheduledValues(audioCtx.currentTime); musicBus.gain.setValueAtTime(musicBus.gain.value || 0.0001, audioCtx.currentTime); musicBus.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.6); }
  }
}
function toggleSfx(){
  sfxOn = !sfxOn; try{ localStorage.setItem('rikiki_sfx', sfxOn ? '1' : '0'); }catch(e){}
  if(sfxOn){ audioUnlock(); if(audioReady()) sfxDealCard(audioCtx.currentTime + 0.02); }
  render();
}
function toggleMusic(){
  musicOn = !musicOn; try{ localStorage.setItem('rikiki_music', musicOn ? '1' : '0'); }catch(e){}
  audioUnlock(); musicSync(); render();
}
// v67 : un seul bouton ⚙️ dans la barre du haut (avant : 🔊 🎵 💡 Aa côte à côte, trop chargé) — les réglages sont dans la fenêtre « Paramètres »
var showPrefs = false;
function renderSoundButtons(){
  return '<button class="btn ghost snd-btn" data-action="prefs-toggle" title="Paramètres" aria-label="Paramètres">⚙️<span class="chat-lbl"> Paramètres</span></button>';
}
var PREF_ROWS = [
  { action:'sfx-toggle',      on:function(){ return sfxOn; },     icon:function(){ return sfxOn ? '🔊' : '🔇'; }, title:'Bruitages',     hint:'Cartes, coupes, rire de sorcière…' },
  { action:'music-toggle',    on:function(){ return musicOn; },   icon:function(){ return '🎵'; },                  title:'Musique',       hint:'Petite musique pendant la partie' },
  { action:'led-help-toggle', on:function(){ return ledHelpOn; }, icon:function(){ return '💡'; },                  title:'Aide',          hint:'Rappelle la couleur à jouer et entoure la 1re carte du pli' },
  { action:'table-view-toggle', on:function(){ return tableViewOn; }, icon:function(){ return '🎴'; }, title:'Vue table', hint:'Les joueurs autour d\'une table, comme au poker' },
  { action:'big-cards-toggle', on:function(){ return bigCardsOn; }, icon:function(){ return '🂡'; }, title:'Grandes cartes', hint:'Cartes plus grandes : tablette, personnes qui voient moins bien' },
  { action:'visite-open', plain:true, show:function(){ return screen==='entry'; }, icon:function(){ return '🧭'; }, title:'Visite de l\'appli', hint:'Un petit tour pour comprendre chaque bouton (1 minute)' },
  { action:'tips-toggle', on:function(){ return tipsOn; }, icon:function(){ return '💡'; }, title:'Conseils', hint:'Petites phrases qui expliquent quoi faire, une seule fois chacune' },
  { action:'autoplay-toggle', on:function(){ return autoPlayOn; }, icon:function(){ return '🃏'; }, title:'Jeu automatique', hint:'Joue pour toi la carte quand tu n\'as pas le choix' },
  { action:'big-text-toggle', on:function(){ return bigTextOn; }, icon:function(){ return '<b>Aa</b>'; },           title:'Grand texte',   hint:'Textes et boutons plus gros, pour mieux lire' },
  { action:'gif-consent-toggle', on:function(){ return gifConsent(); }, icon:function(){ return '🖼️'; }, title:'GIF (KLIPY)', hint:'Chercher et voir des GIF. Le service KLIPY voit ton adresse IP.' },
  { action:'sec-consent-toggle', on:function(){ return securityConsent()===true; }, icon:function(){ return '🔒'; }, title:'Vérification Google reCAPTCHA', hint:'Sécurité. Google voit ton adresse IP. Refuser ne change rien au jeu.' }
];
function renderPrefsModal(){
  var html = '<div class="modal-backdrop" data-action="prefs-toggle"><div class="card-panel modal prefs-modal">'
    + '<button class="btn ghost close-x" data-action="prefs-toggle">Fermer</button><h3>⚙️ Paramètres</h3>'
    + '<div style="margin:0 0 10px; padding-right:70px;">'+renderDeckChoice()+'</div>'; // 1.8.0 : changer de paquet, même en pleine partie
  PREF_ROWS.forEach(function(r){
    if(r.action==='sec-consent-toggle' && !LEGAL_READY) return; // reCAPTCHA n'est pas chargé tant que la partie légale est en veille
    if(r.show && !r.show()) return; // 1.8.0 : ligne affichée seulement dans certains écrans (ex. la visite, sur l'accueil)
    if(r.plain){ html += '<button class="pref-row" data-action="'+r.action+'"><span class="pref-ico">'+r.icon()+'</span><span class="pref-txt"><b>'+r.title+'</b><small>'+r.hint+'</small></span></button>'; return; }
    var on = r.on();
    html += '<button class="pref-row" data-action="'+r.action+'" aria-pressed="'+on+'">'
      + '<span class="pref-ico">'+r.icon()+'</span>'
      + '<span class="pref-txt"><b>'+r.title+'</b><small>'+r.hint+'</small></span>'
      + '<span class="pref-sw'+(on ? ' on' : '')+'" aria-hidden="true"></span></button>';
  });
  html += '<button class="pref-row" data-action="bug-open"><span class="pref-ico">🐞</span><span class="pref-txt"><b>Signaler un bug</b><small>Un souci, une idée ? Dis-le en une phrase.</small></span></button>';
  var diag = window.__RIKIKI_APP ? '<p class="pref-note">Appli iPhone · session audio : '+(navigator.audioSession ? navigator.audioSession.type : 'absente')+' · lecteur muet : '+unmuteState+'</p>' : '';
  return html + '<p class="pref-note">Réglages gardés sur cet appareil.</p>'+diag+(LEGAL_READY ? '<p class="pref-note pref-legal">'+legalLinksHtml()+'</p>' : '')+'</div></div>';
}

function renderTopbar(g){
  return '<div class="topbar"><div class="brand"><span class="display hide-narrow">Rikiki</span>'
    + '<span class="code-pill" title="Code de la partie : tes amis l\'entrent dans « Rejoindre »"><small>CODE</small>'+esc(g.code)+'</span></div>'
    + '<div class="actions">'
    + '<button class="btn ghost" data-chat="open" aria-label="Chat">💬<span class="chat-lbl"> Chat</span><span class="top-badge" id="chat-badge-top">'+(chatUnread() ? (chatUnread()>9?'9+':chatUnread()) : '')+'</span></button>'
    + (g.status!=='lobby' ? '<button class="btn ghost" data-action="toggle-scores">Scores</button>' : '')
    + '<button class="btn ghost" data-action="help-now" aria-label="Que faire maintenant ?" title="Que faire maintenant ?">❓</button>'
    + '<button class="btn ghost" data-action="toggle-rules">Règles</button>'
    + renderSoundButtons()
    + '<button class="btn ghost" data-action="leave">Quitter</button>'
    + '</div></div>';
}

function renderGame(){
  var g = gameDoc;
  var html = renderTopbar(g);
  if(g.status!=='lobby' && g.round===0 && g.startedAt && (nowMs()-g.startedAt) < 6000){
    maybeStartIntro('g|'+g.code+'|'+g.startedAt, { rounds:g.roundPlan.length, plan:planText(g.roundPlan), names:g.playerOrder.filter(function(id){ return g.players && g.players[id]; }).map(function(id){ return g.players[id].name; }) });
  }
  if(g.status==='lobby') html += tipHtml(g) + renderLobbyInvite(g) + renderLobby(g);
  else if(g.status==='dealing') html += renderDealing(g);
  else if(g.status==='bidding' || g.status==='playing') html += renderTable(g);
  else if((g.status==='round_end' || g.status==='game_over') && finalTrickShowing(g)) html += renderTable(g);
  else if(g.status==='round_end') html += renderRoundEnd(g);
  else if(g.status==='game_over') html += renderGameOver(g);
  if(showScores && g.status!=='lobby') html += renderScoresModal(g);
  if(showPrefs) html += renderPrefsModal();
  if(showRules) html += renderRulesModal();
  return html;
}

var DIRECTION_LABEL = { up:'Montant', updown:'Montant puis descendant', down:'Descendant', pyramid:'Pyramide', quick:'Partie rapide' };
function planText(plan){ return plan.length<=6 ? plan.join(' → ') : (plan.slice(0,3).join(' → ')+' … '+plan[plan.length-1]); }

function renderLobby(g){
  var ids = Object.keys(g.players).sort(function(a,b){ return g.players[a].joinedAt - g.players[b].joinedAt; });
  var isHost = g.hostId === myId;
  var n = ids.length;
  var maxStart = Math.max(1, Math.floor(52/Math.max(n,2)));
  var startSize = (g.settings && g.settings.startSize) ? Math.min(g.settings.startSize, maxStart) : maxStart;
  var direction = (g.settings && g.settings.direction) || 'up';
  var blindOne = !(g.settings && g.settings.blindOne === false);
  var allReady = n>0 && ids.every(function(id){ return g.players[id].ready; });
  var plan = computeRoundPlan(Math.max(n,2), startSize, direction);
  var sc = getScoring(g);

  var html = '<div class="card-panel" style="margin-bottom:12px;">';
  html += '<div class="row between"><h2 style="font-size:24px;">Salon'+(direction==='quick' ? '<span class="quick-chip">⚡ Partie rapide</span>' : '')+'</h2><span class="badge">'+n+' / '+MAX_PLAYERS+'</span></div>';
  html += '<p class="muted" style="font-size:13.5px; margin:4px 0 8px;">Donne le code <strong style="color:var(--navy); letter-spacing:0.1em;">'+esc(g.code)+'</strong> à tes amis.</p>';
  var newer = ids.some(function(id){ return versionIsNewer(g.players[id].v, APP_VERSION); });
  if(newer) html += '<p class="pts-neg" style="font-size:13.5px; font-weight:700; margin:0 0 8px;">⚠ Une nouvelle version du jeu est en ligne : recharge la page avant de jouer.</p>';
  html += '<div class="player-list">';
  ids.forEach(function(id){
    var p = g.players[id];
    html += '<div class="player-card"><div class="avatar" style="background:'+safeColor(p.color)+'; color:'+inkOn(safeColor(p.color))+';">'+(p.isBot?'🤖':esc(initials(p.name)))+'</div>';
    html += '<div style="flex:1; min-width:0; font-weight:700;">'+esc(p.name)+crownMark(id, p.name, p.uid)+(id===myId?' <span class="muted" style="font-weight:400;">(toi)</span>':'')+(id===g.hostId?' <span class="badge" style="margin-left:4px;">Hôte</span>':'')+((!p.isBot && id!==myId && playerIsBehind(p.v)) ? '<div class="pts-neg" style="font-size:12px; font-weight:600;">⚠ ancienne version : doit recharger la page</div>' : '')+'</div>';
    if(p.isBot){
      if(isHost) html += '<button class="btn ghost" data-action="remove-bot" data-bot="'+esc(id)+'">Retirer</button>';
      else html += '<span class="badge">Bot</span>';
    } else if(id===myId){
      html += '<button class="btn small '+(p.ready?'':'secondary')+'" data-action="toggle-ready">'+(p.ready?'Prêt ✓':'Je suis prêt')+'</button>';
    } else {
      html += friendAddBtn(p, id)+'<span class="badge '+(p.ready?'good':'bad')+'">'+(p.ready?'Prêt':'Pas prêt')+'</span>';
    }
    html += '</div>';
  });
  html += '</div>';
  if(isHost && n<MAX_PLAYERS && !fraudOn(g)) html += '<button class="btn ghost" data-action="add-bot" style="margin-top:6px; padding-left:0;">+ Ajouter un bot</button>';
  html += '</div>';

  html += '<div class="card-panel" style="margin-bottom:12px;">'+renderDeckChoice()+'</div>'; // v51 : chacun choisit ses cartes
  // réglages : un résumé, le détail replié
  html += '<div class="card-panel" style="margin-bottom:12px;">';
  html += '<div class="row between"><h3 style="font-size:18px;">Partie</h3>'
    + (isHost ? '<button class="btn ghost" data-action="toggle-settings">'+(showSettings?'Fermer':'Modifier')+'</button>' : '') + '</div>';
  html += '<div class="settings-summary muted" style="margin-top:6px;">'
    + (direction==='quick' ? ('⚡ Partie rapide · 5 manches, de 1 à '+startSize+' cartes au hasard<br>')
       : (esc(DIRECTION_LABEL[direction]||'')+' · '+plan.length+' manche'+(plan.length>1?'s':'')+' ('+esc(planText(plan))+' cartes)<br>'))
    + ('⏱ Durée estimée : environ '+estimateMinutes(plan, Math.max(n,2))+' min<br>')
    + (fraudOn(g) ? '<strong style="color:var(--navy);">😈 Mode frauduleux</strong> : triche permise, on peut s\'accuser · hors ligue · sans robot<br>' : '')
    + (maxZerosOf(g) ? ('Pas plus de '+maxZerosOf(g)+' zéros d\'affilée<br>') : '')
    + (blindOne ? 'Manche à 1 carte à l\'aveugle<br>' : '')
    + (direction==='quick' ? '⚡ Partie rapide : hors ligue<br>' : '')
    + ((g.settings && g.settings.league && direction!=='quick') ? ('<strong style="color:var(--navy);">Partie de ligue</strong>'+(onlineLeagueCheck(g) ? ' <span class="pts-neg">· '+esc(onlineLeagueCheck(g).replace('Ne compte pas pour la ligue : ','ne comptera pas : '))+'</span>' : '')+'<br>') : (direction==='quick' ? '' : 'Partie d\'entraînement (hors ligue)<br>'))
    + 'Points : '+esc(scoringSummary(sc))+'<br>'
    + (turnLimitSec(g) ? ('Temps par tour : '+turnLimitSec(g)+' s, puis coup au hasard') : 'Pas de limite de temps par tour')+'<br>'
    + 'Robots : niveau '+BOT_LEVEL_LABEL[botLevelOf(g)]+'</div>';
  if(isHost && showSettings){
    html += '<div class="divider"></div>';
    html += '<div class="settings-grid">';
    html += '<div><label for="startSizeInput">Cartes max (jusqu\'à '+maxStart+')</label><input type="number" id="startSizeInput" min="1" max="'+maxStart+'" value="'+startSize+'" data-action-change="set-start-size"></div>';
    html += '<div><label for="directionSelect">Format</label><select id="directionSelect" data-action-change="set-direction">'
      + '<option value="up"'+(direction==='up'?' selected':'')+'>Montant (1 → '+startSize+')</option>'
      + '<option value="updown"'+(direction==='updown'?' selected':'')+'>1 → '+startSize+' → 1</option>'
      + '<option value="down"'+(direction==='down'?' selected':'')+'>Descendant ('+startSize+' → 1)</option>'
      + '<option value="pyramid"'+(direction==='pyramid'?' selected':'')+'>'+startSize+' → 1 → '+startSize+'</option>'
      + '<option value="quick"'+(direction==='quick'?' selected':'')+'>⚡ Partie rapide (5 manches, cartes au hasard)</option>'
      + '</select></div></div>';
    if(direction==='quick') html += '<p class="muted" style="font-size:13px; margin:0 0 10px;">⚡ Les parties rapides ne comptent pas pour la ligue.</p>';
    else html += '<label style="display:flex; align-items:center; gap:10px; font-size:14px; color:var(--navy); font-weight:700; margin:0 0 10px;"><input type="checkbox" id="leagueInput" data-action-change="set-league" '+((g.settings && g.settings.league)?'checked':'')+'> Partie de ligue (compte pour le classement)</label>';
    html += '<label style="display:flex; align-items:center; gap:10px; font-size:14px; color:var(--navy); font-weight:700; margin:0 0 10px;"><input type="checkbox" id="fraudInput" data-action-change="set-fraud" '+(fraudOn(g)?'checked':'')+'> 😈 Mode frauduleux : la triche est permise (hors ligue, sans robot)</label>';
    var bl = botLevelOf(g);
    html += '<div style="margin:0 0 10px;"><label for="botLevelSelect">Niveau des robots</label><select id="botLevelSelect" data-action-change="set-botlevel">'
      + ['facile','humain','fort'].map(function(v){ return '<option value="'+v+'"'+(v===bl?' selected':'')+'>'+BOT_LEVEL_LABEL[v]+(v==='humain'?' (calé sur vos parties)':'')+'</option>'; }).join('') + '</select></div>';
    var tl = turnLimitSec(g);
    html += '<div style="margin:0 0 10px;"><label for="timerSelect">Temps par tour (ensuite une annonce / carte est jouée au hasard)</label><select id="timerSelect" data-action-change="set-timer">'
      + [0,10,15,30,45,60,90].map(function(v){ return '<option value="'+v+'"'+(v===tl?' selected':'')+'>'+(v ? v+' secondes' : 'Pas de limite')+'</option>'; }).join('') + '</select></div>';
    html += '<label style="display:flex; align-items:center; gap:10px; font-size:14px; color:var(--navy); font-weight:400; margin:0 0 4px;"><input type="checkbox" id="blindInput" data-action-change="set-blind" '+(blindOne?'checked':'')+'> Manche à 1 carte à l\'aveugle</label>';

    html += '<div class="divider"></div><div class="row between"><div class="eyebrow">Barème des points</div><button class="btn ghost" data-action="reset-scoring">Par défaut</button></div>';
    html += '<div class="settings-grid" style="margin-top:6px;">';
    SCORING_FIELDS.forEach(function(f){
      html += '<div><label for="sc-'+f.key+'">'+esc(f.label)+'</label><input type="number" id="sc-'+f.key+'" min="'+f.min+'" max="'+f.max+'" value="'+sc[f.key]+'" data-action-change="set-scoring" data-key="'+f.key+'"></div>';
    });
    html += '</div>';
    html += '<p class="muted" style="font-size:12.5px; margin:0;">'+esc(scoringExample(sc))+'</p>';
  }
  html += '</div>';

  if(isHost){
    var fraudBots = fraudOn(g) && ids.some(function(id){ return g.players[id].isBot; });
    var canStart = n>=MIN_PLAYERS && allReady && !fraudBots;
    var label = n<MIN_PLAYERS ? 'Il faut au moins 2 joueurs' : (fraudBots ? 'Retire les robots (mode frauduleux)' : (!allReady ? 'Tout le monde doit être prêt' : 'Lancer la partie'));
    html += '<button class="btn" style="width:100%;" data-action="start-game" '+(canStart?'':'disabled')+'>'+label+'</button>';
  } else {
    html += '<p class="muted" style="font-size:14px; text-align:center;">'+(allReady ? 'L\'hôte va lancer la partie…' : 'Clique sur « Je suis prêt » pour continuer.')+'</p>';
  }
  return html;
}

function renderDealing(g){
  var hs = g.roundPlan[g.round];
  return '<div class="center-wrap"><div style="text-align:center;"><div class="eyebrow">Manche '+(g.round+1)+' / '+g.roundPlan.length+'</div>'
    + '<div class="display" style="font-size:26px; margin-top:6px;">Distribution…</div>'
    + '<p class="muted" style="margin-top:6px;">'+hs+' carte'+(hs>1?'s':'')+' chacun</p></div></div>';
}

// Ordre du "rouleau" : le joueur qui doit agir en haut, puis les suivants dans l'ordre de jeu.
function rollOrder(g){
  var order = g.playerOrder, n = order.length;
  var start = order.indexOf(g.turnPlayerId); if(start<0) start = 0;
  if(g.status==='bidding'){
    // pendant les annonces on suit l'ordre des annonces
    var bo = g.bidOrder, s2 = bo.indexOf(g.turnPlayerId); if(s2<0) s2=0;
    return bo.slice(s2).concat(bo.slice(0,s2));
  }
  var r=[]; for(var i=0;i<n;i++) r.push(order[(start+i)%n]);
  return r;
}
var lastRollKey = null;
var introKey = null, introData = null, introTimer = null;
function maybeStartIntro(key, data){
  if(introKey === key) return;
  introKey = key; introData = data;
  clearTimeout(introTimer);
  introTimer = setTimeout(function(){ introData = null; renderIntroLayer(); }, 3200);
}
function renderIntroLayer(){
  var el = document.getElementById('intro-layer');
  if(!el){ el = document.createElement('div'); el.id='intro-layer'; document.body.appendChild(el); }
  if(!introData){ el.innerHTML=''; return; }
  if(el.getAttribute('data-key') === introKey && el.innerHTML) return; // ne pas relancer l'animation
  el.setAttribute('data-key', introKey);
  var d = introData;
  el.innerHTML = '<div class="intro" data-action="skip-intro"><div><div class="suits" aria-hidden="true"><span>'+suitGlyph('S')+'</span><span>'+suitGlyph('H')+'</span><span>'+suitGlyph('C')+'</span><span>'+suitGlyph('D')+'</span></div>'
    + '<h1>La partie commence</h1><p>'+d.rounds+' manche'+(d.rounds>1?'s':'')+' · '+esc(d.plan)+' cartes</p>'
    + '<div class="names">'+d.names.map(esc).join(' · ')+'</div></div></div>';
}

function renderTable(g){
  var handSize = g.roundPlan[g.round];
  var blind = isBlindRound(g);
  var blindHands = blind ? dealtHands(g) : null;
  var isMe = g.turnPlayerId === myId;
  var turnName = g.players[g.turnPlayerId] ? g.players[g.turnPlayerId].name : '';
  var bidding = g.status==='bidding';

  var ending = g.status==='round_end' || g.status==='game_over';
  var status;
  if(ending){ isMe = false; var wn = g.players[g.lastTrick.winnerId]; status = (g.lastTrick.winnerId===myId ? 'Tu remportes' : esc(wn ? wn.name : '?')+' remporte')+' le dernier pli'; }
  else if(isMe) status = bidding ? 'À toi d\'annoncer' : 'À toi de jouer';
  else status = esc(turnName) + (bidding ? ' annonce…' : ' joue…');

  var tricksLeft = Math.max(0, handSize - (g.trickNumber||0));
  var ts = turnState(g);
  var html = '<div class="play-head"><div><div class="eyebrow">'+((g.settings && g.settings.direction==='quick') ? '⚡ ' : '')+'Manche '+(g.round+1)+' / '+g.roundPlan.length+' · '+handSize+' carte'+(handSize>1?'s':'')+(bidding ? '' : ' · <strong>'+tricksLeft+' pli'+(tricksLeft>1?'s':'')+' restant'+(tricksLeft>1?'s':'')+'</strong>')+' · paquet : '+deckLeft(g.playerOrder.length, handSize)+' carte'+(deckLeft(g.playerOrder.length, handSize)>1?'s':'')+'</div>'
    + '<div class="status'+(isMe?' me':'')+'">'+status+'<span id="turn-timer" class="'+ts.cls+'">'+ts.text+'</span></div></div>';
  html += '<div class="trump">'+(g.trumpCard ? cardHtml(g.trumpCard, {size:'trump-size'}) : '<div class="none">Sans<br>atout</div>')+'<div class="eyebrow">Atout</div></div></div>';
  html += renderAfkBanner(g); // v64 : joueur absent (vote)

  if(tableViewOn){ html += tableViewHtml(g, ending, bidding, isMe, blind, blindHands, handSize); } else {
  // colonne des joueurs en rouleau
  var rollKey = g.round+'|'+g.status+'|'+g.turnPlayerId;
  lastRollKey = rollKey;
  html += '<div class="play-main"><ol class="roll">';
  rollOrder(g).forEach(function(id, i){
    var p = g.players[id];
    var bid = g.bids ? g.bids[id] : null;
    var won = g.tricksWon ? (g.tricksWon[id]||0) : 0;
    var active = i===0 && !ending;
    var meta = (bid==null ? 'annonce ?' : ('annonce '+bid+' · '+won+' pli'+(won>1?'s':'')));
    html += '<li class="roll-row'+(active?' active':'')+'" data-flip="r-'+esc(id)+'">';
    html += '<span class="dot" style="background:'+safeColor(p.color)+';"></span>';
    html += '<div class="who">'+(active?'<div class="tag">'+(bidding?'annonce':'joue')+'</div>':'')
      + '<div class="nm">'+esc(p.name)+crownMark(id, p.name, p.uid)+afkTag(p)+(id===myId?' <span style="font-weight:400; opacity:0.7;">(toi)</span>':'')+(g.dealerId===id?' <span class="muted" title="Donneur" style="font-weight:400;">· D</span>':'')+'</div>'
      + '<div class="mt">'+meta+'</div></div>';
    if(blind && !playedThisTrick(g, id)){
      html += id===myId ? '<div class="card mini back"></div>' : (blindHands[id] && blindHands[id][0] ? cardHtml(blindHands[id][0], {mini:true}) : '');
    } else {
      html += '<div class="sc" title="Score">'+(g.scores[id]||0)+'</div>';
    }
    html += '</li>';
  });
  html += '</ol>';

  // tapis : annonce, pli en cours ou dernier pli
  html += '<div class="felt">';
  if(bidding && isMe){
    html += renderBidPanel(g);
  } else {
    var showTrick = !ending && g.currentTrick && g.currentTrick.length>0;
    var elapsed = g.lastTrick ? nowMs()-lastTrickAt(g) : 1e9;
    var showLast = g.lastTrick && (ending || (elapsed < LAST_TRICK_MS && !showTrick));
    var trickToShow = showTrick ? g.currentTrick : (showLast ? g.lastTrick.cards : []);
    if(trickToShow.length){
      // le pli terminé reste visible, puis part en douceur (délai calculé : pas de redémarrage à chaque rendu)
      html += '<div class="trick'+(showLast?' collect':'')+'"'+(showLast?' style="animation-delay:'+Math.round((ending?FINAL_TRICK_MS:LAST_TRICK_MS)-550-elapsed)+'ms"':'')+'>';
      trickToShow.forEach(function(play, pi){
        var p = g.players[play.playerId];
        var win = showLast && g.lastTrick.winnerId===play.playerId;
        html += '<div class="trick-slot'+(win?' win':'')+(pi===0 && ledHelpOn?' lead':'')+'" data-flip="c-'+play.card.suit+play.card.rank+'" data-enter="0">'+cardHtml(play.card, {size:'trick-size'})+(pi===0 && ledHelpOn?'<span class="lead-badge">1<sup>re</sup></span>':'')+'<div class="who">'+esc(p.name)+crownMark(play.playerId, p.name, p.uid)+'</div></div>';
      });
      html += '</div>';
      if(showTrick) html += ledHint(g); // v64 : on rappelle la couleur demandée
      if(showLast) html += '<div class="hint"><strong style="color:var(--navy);">'+esc(g.players[g.lastTrick.winnerId].name)+'</strong> remporte le pli</div>';
    } else if(bidding){
      var total = 0; Object.keys(g.bids||{}).forEach(function(k){ total += (g.bids[k]||0); });
      html += '<div class="hint">Annonces en cours<br><strong style="color:var(--navy); font-size:18px;">'+total+'</strong> pli'+(total>1?'s':'')+' annoncé'+(total>1?'s':'')+' sur '+handSize+'</div>';
    } else {
      html += '<div class="hint">'+(isMe ? 'Ouvre le pli : choisis une carte' : 'En attente de la première carte')+'</div>';
    }
  }
  html += '</div></div>';
  }

  html += fraudBarHtml(g); // 1.9.0 : mode frauduleux (bouton « J'accuse »)
  html += tipHtml(g); // 1.8.0 : conseil du moment (une fois, discret)
  html += '<div class="hand-zone"><div class="eyebrow">Ta main</div>'+renderHand(g)+'</div>';
  return html;
}

function renderBidPanel(g){
  var handSize = g.roundPlan[g.round];
  var bidOrder = g.bidOrder;
  var idx = bidOrder.indexOf(myId);
  var isLast = idx === bidOrder.length-1;
  var forbidden = -1;
  if(isLast){
    var sumOthers=0;
    bidOrder.slice(0,-1).forEach(function(id){ sumOthers += (g.bids[id]||0); });
    forbidden = handSize - sumOthers;
  }
  var allowed = allowedBids(g, myId), zb = zeroBanned(g, myId) && allowed.indexOf(0) < 0;
  var html = '<div class="bid-title">Combien de plis ?</div><div class="bid-row">';
  for(var v=0; v<=handSize; v++){
    var dis = allowed.indexOf(v) < 0;
    html += '<button class="bid-btn" data-action="bid" data-value="'+v+'" '+(dis?('disabled title="'+(v===forbidden?'Interdit : le total tomberait juste':'Interdit : déjà '+maxZerosOf(g)+' zéros d\'affilée')+'"'):'')+'>'+v+'</button>';
  }
  html += '</div>';
  if(zb) html += '<div class="hint" style="font-size:12px;">0 interdit : tu as déjà annoncé '+maxZerosOf(g)+' zéros d\'affilée</div>';
  if(isLast && forbidden>=0 && forbidden<=handSize) html += '<div class="hint" style="font-size:12px;">'+forbidden+' interdit (tu annonces en dernier)</div>';
  return html;
}

function renderHand(g){
  if(!myHand && (g.status==='dealing' || g.status==='bidding' || g.status==='playing')) // v45 : main pas encore arrivée (≠ plus de cartes)
    return '<p class="muted" style="text-align:center; font-size:13px;">Chargement de ta main…</p>';
  if(!myHand || !myHand.cards.length) return '<p class="muted" style="text-align:center; font-size:13px;">Plus de cartes.</p>';
  var canPlay = g.status==='playing' && g.turnPlayerId===myId;
  if(isBlindRound(g)){
    var c0 = myHand.cards[0];
    return '<div class="hand-row blind'+(canPlay?' playable':'')+'" style="--cw:86px;"><button class="hand-card" '+(canPlay?'':'disabled')+' data-action="play-card" data-suit="'+esc(c0.suit)+'" data-rank="'+esc(c0.rank)+'" aria-label="Jouer ta carte cachée"><div class="card back"></div></button></div>'
      + (canPlay ? '<p class="blind-hint">👆 Clique sur ta carte pour la voir</p>'
                 : '<p class="muted" style="text-align:center; font-size:12.5px; margin:8px 0 0;">À ton tour, clique sur ta carte pour la voir.</p>')
      + '<p class="muted" style="text-align:center; font-size:12.5px; margin:6px 0 0;">À l\'aveugle : tu vois les cartes des autres, pas la tienne.</p>';
  }
  var ledSuit = (g.currentTrick && g.currentTrick.length>0) ? g.currentTrick[0].card.suit : null;
  var hasLed = ledSuit ? myHand.cards.some(function(c){ return c.suit===ledSuit; }) : false;
  var suitOrder = handSuitOrder(myHand.cards);
  var sorted = myHand.cards.slice().sort(function(a,b){
    if(a.suit!==b.suit) return suitOrder.indexOf(a.suit)-suitOrder.indexOf(b.suit);
    return a.value-b.value;
  });
  var n = sorted.length;
  var adv = null; // pas d'aide pendant le jeu
  // grandes cartes qui se chevauchent (on voit toujours le coin : chiffre + couleur)
  var appEl = document.getElementById('app');
  var avail = Math.max(260, Math.min(bigCardsOn ? 1000 : 720, (appEl ? appEl.clientWidth : 390) - 32));
  var W = Math.round((avail < 440 ? (n<=3 ? 90 : 78) : (n<=3 ? 110 : 96)) * bigCardsFactor()); // 1.7.0 : « Grandes cartes »
  var rowsCount = 1, perRow = n, step = n>1 ? Math.min(W + 8, (avail - W)/(n-1)) : 0;
  if(n>1 && step < W*0.36){ rowsCount = 2; perRow = Math.ceil(n/2); step = Math.min(W + 8, (avail - W)/Math.max(1, perRow-1)); }
  var html = '<div class="hand-fan'+(canPlay?' playable':'')+'" style="--cw:'+W+'px; --ov:'+(step - W).toFixed(1)+'px;">';
  sorted.forEach(function(c, i){
    var illegal = canPlay && ledSuit && hasLed && c.suit!==ledSuit && !fraudOn(g); // 1.9.0 : aucune carte grisée en mode frauduleux
    var disabled = !canPlay || illegal;
    if(i===0 || (rowsCount===2 && i===perRow)) html += (i>0 ? '</div>' : '') + '<div class="hand-row">';
    var pick = adv && adv.card.suit===c.suit && adv.card.rank===c.rank;
    html += '<button class="hand-card'+(pick?' coach-pick':'')+'" data-flip="c-'+esc(c.suit+c.rank)+'" data-deal="'+(i*55)+'" '+(disabled?'disabled':'')+' data-action="play-card" data-suit="'+esc(c.suit)+'" data-rank="'+esc(c.rank)+'" aria-label="'+esc(rankName(c.rank))+' de '+SUIT_NAME[c.suit]+'">'
      + cardHtml(c, {trump: !!(g.trumpCard && c.suit===g.trumpCard.suit)}) + '</button>';
  });
  html += '</div></div>';
  if(adv) html += '<div class="coach-box" style="margin-top:10px;">🧠 <strong>Coach</strong> · conseille la carte en surbrillance. '+esc(adv.why)+'</div>';
  return html;
}

function roundBreakLeft(g){
  var at = lastTrickAt(g);
  return at ? (at + ROUND_BREAK_MS - nowMs()) : 0;
}
function updateCountdown(){
  var g = gameDoc; if(!g || g.status!=='round_end') return;
  var left = Math.max(0, roundBreakLeft(g));
  var t = document.getElementById('cd-text'), b = document.getElementById('cd-bar');
  if(t) t.textContent = left>0 ? ('Manche suivante dans '+Math.ceil(left/1000)+' s') : 'Distribution…';
  if(b) b.style.width = (100*left/ROUND_BREAK_MS)+'%';
}
function ptsClass(v){ return v>0?'pts-pos':(v<0?'pts-neg':'pts-zero'); }
function fmtPts(v){ return (v>0?'+':'')+v; }

function renderScorePanel(g){
  var order = g.playerOrder.slice().sort(function(a,b){ return (g.scores[b]||0)-(g.scores[a]||0); });
  var html = '<table class="score-table"><thead><tr><th>Joueur</th><th>Score</th></tr></thead><tbody>';
  order.forEach(function(id){
    var p = g.players[id];
    html += '<tr><td>'+esc(p.name)+(id===myId?' <span class="muted">(toi)</span>':'')+'</td><td class="display num" style="font-size:17px;">'+(g.scores[id]||0)+'</td></tr>';
  });
  html += '</tbody></table>';
  return html;
}

function renderScoresModal(g){
  var html = '<div class="modal-backdrop" data-action="toggle-scores"><div class="card-panel modal">';
  html += '<button class="btn ghost close-x" data-action="toggle-scores">Fermer</button>';
  html += '<h3>Scores</h3>' + renderScorePanel(g);
  if(g.roundLog && g.roundLog.length) html += renderGameRecap(g);
  html += coachReviewsListHtml(g);
  html += '</div></div>';
  return html;
}

function renderRoundEnd(g){
  var lastLog = g.roundLog[g.roundLog.length-1];
  if(!lastLog || lastLog.round !== g.round) return '<div class="play-head"><div><div class="eyebrow">Fin de la manche '+(g.round+1)+' / '+g.roundPlan.length+'</div><div class="status">Calcul des scores…</div></div></div>';
  var nh = g.roundPlan[g.round+1];
  var ranked = g.playerOrder.slice().sort(function(a,b){ return (g.scores[b]||0)-(g.scores[a]||0); });
  var html = '<div class="play-head"><div><div class="eyebrow">Fin de la manche '+(lastLog.round+1)+' / '+g.roundPlan.length+'</div>'
    + '<div class="status">Classement</div></div>'
    + '<div class="trump">'+(lastLog.trump ? cardHtml(lastLog.trump, {size:'trump-size'}) : '<div class="none">Sans<br>atout</div>')+'<div class="eyebrow">Atout</div></div></div>';
  if(g.lastTrick && g.lastTrick.cards && g.lastTrick.cards.length){
    var wasBlind = lastLog.handSize===1 && !(g.settings && g.settings.blindOne===false);
    html += '<div class="eyebrow" style="text-align:center; margin-top:4px;">'+(wasBlind ? 'Manche à l\'aveugle : la carte de chacun (dont la tienne)' : 'Dernier pli')+'</div><div class="end-trick">';
    g.lastTrick.cards.forEach(function(play){
      var pp = g.players[play.playerId] || {name:'?'};
      html += '<div class="slot'+(g.lastTrick.winnerId===play.playerId?' win':'')+(play.playerId===myId?' me':'')+'">'+cardHtml(play.card, {mini:true})+'<div class="nm">'+(play.playerId===myId?'Toi':esc(pp.name))+'</div></div>';
    });
    html += '</div>';
  }
  ranked.forEach(function(id, i){
    var p = g.players[id], pv = lastLog.points[id];
    var ok = lastLog.bids[id]===lastLog.tricksWon[id];
    html += '<div class="ranking-row'+(i===0?' first':'')+'"><div class="rank-num">'+(i+1)+'</div>'
      + '<span class="dot" style="background:'+safeColor(p.color)+';"></span>'
      + '<div style="flex:1; min-width:0;"><div style="font-weight:700;">'+esc(p.name)+(id===myId?' <span class="muted" style="font-weight:400;">(toi)</span>':'')+'</div>'
      + '<div class="muted" style="font-size:12.5px;">annonce '+lastLog.bids[id]+' · fait '+lastLog.tricksWon[id]+(ok?' · <span class="pts-pos">réussi</span>':' · <span class="pts-neg">raté</span>')+'</div></div>'
      + '<div style="text-align:right;"><div class="display num" style="font-size:22px;">'+(g.scores[id]||0)+'</div><div class="delta '+ptsClass(pv)+'">'+fmtPts(pv)+'</div></div></div>';
  });
  var dc = checkRevealedDeal(g, lastLog);
  if(dc==='ok') html += '<div class="muted" style="text-align:center; font-size:12px; margin:6px 0 0;">🔒 Donne vérifiée : personne ne connaissait vos cartes, et la distribution n\'a pas été modifiée.</div>';
  else if(dc==='bad') html += '<div class="error-text" style="text-align:center;">⚠️ La distribution de cette manche ne correspond pas à son empreinte.</div>';
  html += auditHtml(g);
  html += coachReviewHtml(g, lastLog);
  var left = Math.max(0, roundBreakLeft(g));
  html += '<div class="countdown"><div class="bar"><i id="cd-bar" style="width:'+(100*left/ROUND_BREAK_MS)+'%"></i></div>'
    + '<div class="row between"><span class="muted" id="cd-text" style="font-size:13.5px;">'+(left>0?('Manche suivante dans '+Math.ceil(left/1000)+' s'):'Distribution…')+'</span>'
    + '<button class="btn small" data-action="deal-next" title="Lancer tout de suite la manche '+(g.round+2)+' ('+nh+' carte'+(nh>1?'s':'')+')">Passer →</button></div></div>';
  return html;
}

