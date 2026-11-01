/* ===================== 1.11.0 : thème sonore du Casino noir — jazz de club à la trompette (menu / accueil) et musique de parrain (parties) + bruitages de jetons et de roulette =====================
   Tout est synthétisé (Web Audio, comme le reste de 20-sons-et-musique.js, dont on réutilise les petits outils sndNoise / sndEnv / sndFilter / sndChain).
   Musique : contrebasse qui marche, cymbale ride swing, balais, piano électrique en accords syncopés, trompette bouchée qui lance une phrase de temps en temps,
   et le craquement d'un vieux disque. Appelée par musicBeat quand le paquet est « casino ». Bruitages : jeton posé, pile de jetons, bille de roulette. */
var CLUB_BPM = 92, clubProg = 0;
var CLUB_PROGS = [ // [basse, accord] en numéros MIDI ; 1 accord par mesure ; ambiance « film noir » en do mineur
  [[36,[51,55,58,62]], [41,[51,56,60,63]], [38,[53,56,60,65]], [43,[53,56,59,62]]],  // Cm9 · Fm7 · Dm7b5 · G7b9
  [[38,[53,56,60,65]], [43,[53,56,59,62]], [36,[51,55,58,62]], [36,[51,55,57,60]]]   // Dm7b5 · G7b9 · Cm9 · Cm6
];
var CLUB_SCALE = [67, 70, 72, 75, 77, 79, 82]; // pentatonique mineure de do (sol, si♭, do, mi♭, fa, sol, si♭) : aucune note qui frotte contre les accords
function musicRide(t, vol){ // cymbale ride : un « tching » court et brillant
  var g = audioCtx.createGain(); sndEnv(g.gain, t, vol, 0.004, 0.26);
  sndChain([sndNoise(t, 0.3), sndFilter('highpass', 6200), g, musicBus]);
}
function musicCrackle(t){ // craquement de vieux disque
  var g = audioCtx.createGain(); sndEnv(g.gain, t, 0.03 + Math.random() * 0.03, 0.001, 0.012);
  sndChain([sndNoise(t, 0.02), sndFilter('highpass', 3200), g, musicBus]);
}
function musicTrumpet(t, m, dur, vol){ // trompette bouchée : timbre cuivré qui s'ouvre à l'attaque, vibrato tardif, léger souffle
  var c = audioCtx, f = midiHz(m), o = c.createOscillator(), o2 = c.createOscillator(), lp = sndFilter('lowpass', 700, 2.2), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'square'; o2.frequency.value = f; o2.detune.value = 4;
  lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(2600, t + 0.05); lp.frequency.exponentialRampToValueAtTime(1500, t + 0.3);
  lfo.frequency.value = 5.1; lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + 0.22); lg.gain.linearRampToValueAtTime(11, t + Math.max(0.5, dur * 0.7)); lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.03); g.gain.exponentialRampToValueAtTime(vol * 0.75, t + dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  var m2 = c.createGain(); m2.gain.value = 0.35; o.connect(lp); o2.connect(m2); m2.connect(lp); sndChain([lp, g, musicBus]);
  var gb = c.createGain(); sndEnv(gb.gain, t, vol * 0.25, 0.02, 0.18); sndChain([sndNoise(t, 0.2), sndFilter('bandpass', 2800, 1.2), gb, musicBus]); // souffle d'attaque
  o.start(t); o2.start(t); lfo.start(t); [o, o2, lfo].forEach(function(n){ n.stop(t + dur + 0.05); });
}
function musicBeatClub(t){
  var beat = 60 / CLUB_BPM, sw = beat * 2 / 3, b = musicStep % 4, bar = Math.floor(musicStep / 4) % 4;
  if(b === 0 && bar === 0 && musicStep > 0 && Math.random() < 0.5) clubProg = Math.floor(Math.random() * CLUB_PROGS.length);
  var ch = CLUB_PROGS[clubProg][bar];
  var walk = [ch[0], ch[0] + 3, ch[0] + 7, ch[0] + (Math.random() < 0.5 ? 10 : 5)]; // contrebasse qui marche (mineur)
  if(b === 0 || (b === 2 && Math.random() < 0.3)) musicBass(t, walk[b] - (walk[b] > 50 ? 12 : 0), beat * (b === 0 ? 2.4 : 1.4), 0.13); // basse rare et douce (plus de « toum toum » à chaque temps)
  musicRide(t, b % 2 ? 0.05 : 0.04); if(b % 2 === 1) musicRide(t + sw, 0.035); // swing : ding · ding-a · ding · ding-a
  if(b === 0 && Math.random() < 0.75) ch[1].forEach(function(m, i){ musicEP(t + sw + i * 0.012, m, 0.05, beat * 2.2); }); // accord de piano syncopé, qui résonne
  if(b === 2 && Math.random() < 0.55) ch[1].forEach(function(m){ musicEP(t + sw, m, 0.035, beat * 1.4); });
  if(b === 0 && bar % 2 === 0 && Math.random() < 0.5){ // phrase de trompette : 3 ou 4 notes de la pentatonique qui descendent (ou montent), la dernière tenue
    var n = 3 + Math.floor(Math.random() * 2), i0 = 2 + Math.floor(Math.random() * (CLUB_SCALE.length - 2)), dir = Math.random() < 0.7 ? -1 : 1, k;
    for(k = 0; k < n; k++){ var idx = Math.max(0, Math.min(CLUB_SCALE.length - 1, i0 + dir * k)), last = (k === n - 1); musicTrumpet(t + k * beat * 0.66 + (k % 2 ? sw * 0.15 : 0), CLUB_SCALE[idx], last ? beat * 1.8 : beat * (0.5 + Math.random() * 0.3), last ? 0.05 : 0.042); }
  }
  if(Math.random() < 0.5) musicCrackle(t + Math.random() * beat);
  musicStep++;
}

/* ---------- musique « parrain » (en partie) : valse lente en mineur, mandoline qui trémole, guitare, violon plaintif ; air ORIGINAL dans cet esprit (pas le thème du film) ---------- */
var PARRAIN_BPM = 66, parrainPhrase = 0;
var PARRAIN_BARS = [[33,[57,60,64]], [38,[57,62,65]], [40,[56,59,62,64]], [33,[57,60,64]], [38,[57,62,65]], [33,[57,60,64]], [40,[56,59,62,64]], [33,[57,60,64]]]; // Am · Dm · E7 · Am · Dm · Am · E7 · Am
// notes de la mélodie permises sur chaque accord (notes de l'accord + notes de passage voisines) : rien ne frotte, la mélodie reste « juste »
var PARRAIN_MELODY = { 33: [64, 67, 69, 71, 72, 76, 81], 38: [65, 67, 69, 72, 74, 77, 81], 40: [64, 68, 71, 74, 76, 80, 81] };
var PARRAIN_RHYTHMS = [[2, 1, 1.5, 0.5, 1, 1], [1, 1, 1, 3], [1.5, 0.5, 1, 1, 1, 1]]; // 6 temps ou plus (2 mesures de valse)
function musicPluck(t, m, vol, dur){ // guitare / mandoline : triangle + harmonique qui s'éteint vite
  var c = audioCtx, f = midiHz(m), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
  o.type = 'triangle'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2;
  sndEnv(g.gain, t, vol, 0.004, dur); sndEnv(g2.gain, t, vol * 0.5, 0.002, dur * 0.35);
  sndChain([o, g, musicBus]); sndChain([o2, g2, musicBus]); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur * 0.4 + 0.05);
}
function musicMandolin(t, m, dur, vol){ for(var x = 0; x < dur; x += 0.085) musicPluck(t + x, m, vol * (1 - x / dur * 0.45), 0.2); } // trémolo : notes répétées très vite
function musicViolin(t, m, dur, vol){ // violon plaintif : attaque lente, vibrato large
  var c = audioCtx, f = midiHz(m), o = c.createOscillator(), o2 = c.createOscillator(), lp = sndFilter('lowpass', 2300, 0.9), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
  o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'sawtooth'; o2.frequency.value = f * 1.004; lfo.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(18, t + dur * 0.5);
  lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.16); g.gain.exponentialRampToValueAtTime(vol * 0.8, t + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(lp); o2.connect(lp); sndChain([lp, g, musicBus]);
  o.start(t); o2.start(t); lfo.start(t); [o, o2, lfo].forEach(function(n){ n.stop(t + dur + 0.05); });
}
function musicBeatParrain(t){
  var beat = 60 / PARRAIN_BPM, b = musicStep % 3, bar = Math.floor(musicStep / 3) % PARRAIN_BARS.length, ch = PARRAIN_BARS[bar];
  if(b === 0) musicBass(t, ch[0], beat * 1.6);                                          // temps 1 : la basse, grave et chaude
  else ch[1].slice(0, 3).forEach(function(m, i){ musicPluck(t + i * 0.018, m - 12, 0.05, beat * 0.9); }); // temps 2 et 3 : accord de guitare pincé
  if(b === 0 && bar % 2 === 0){ // toutes les deux mesures : une phrase (mandoline, puis violon, en alternance) ; chaque note est choisie dans celles de l'accord en cours
    var rhythm = PARRAIN_RHYTHMS[Math.floor(Math.random() * PARRAIN_RHYTHMS.length)], at = t, k, pos = 0, violin = (parrainPhrase++ % 2) === 1, idx = 2 + Math.floor(Math.random() * 3);
    for(k = 0; k < rhythm.length; k++){
      var cur = PARRAIN_BARS[(bar + Math.floor(pos / 3)) % PARRAIN_BARS.length], pool = PARRAIN_MELODY[cur[0]] || PARRAIN_MELODY[33], d = rhythm[k] * beat;
      idx = Math.max(0, Math.min(pool.length - 1, idx + [-1, -1, 0, 1, 1][Math.floor(Math.random() * 5)]));
      var note = pool[idx];
      if(violin) musicViolin(at, note, d * 0.97, 0.05); else if(d > beat * 1.2) musicMandolin(at, note, d * 0.95, 0.05); else musicPluck(at, note, 0.07, d);
      at += d; pos += rhythm[k];
    }
  }
  if(b === 0 && bar === 6 && Math.random() < 0.5) musicViolin(t, 57, beat * 3, 0.03); // une longue note de violon avant de reprendre
  if(Math.random() < 0.3) musicCrackle(t + Math.random() * beat);
  musicStep++;
}
var casinoMusicMode = '';
function casinoMusicIsGame(){ return screen === 'game' && !!gameDoc; }
var CASINO_GAME_MUSIC = 'club'; // musique pendant les parties : 'club' (jazz, comme au menu) ou 'parrain' (valse mandoline) — en attente du choix du propriétaire
function musicBeatCasino(t){ // menu et accueil : jazz à la trompette ; en partie : voir CASINO_GAME_MUSIC
  var mode = (deckTheme === 'casino' && casinoMusicIsGame() && CASINO_GAME_MUSIC === 'parrain') ? 'parrain' : 'club';
  if(mode !== casinoMusicMode){ casinoMusicMode = mode; musicStep = 0; }
  return mode === 'parrain' ? musicBeatParrain(t) : musicBeatClub(t);
}

/* ---------- bruitages du casino ---------- */
function sfxChipClink(t, vol){ // un jeton qui tombe sur les autres : deux « tings » brefs + petit clac de céramique
  var c = audioCtx, f0 = 2700 + Math.random() * 500;
  [[f0, 1], [f0 * 1.5, 0.6], [f0 * 2.4, 0.3]].forEach(function(p){
    var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = p[0];
    sndEnv(g.gain, t, vol * p[1], 0.002, 0.11); sndChain([o, g, sfxBus]); o.start(t); o.stop(t + 0.16);
  });
  var gn = c.createGain(); sndEnv(gn.gain, t, vol * 0.7, 0.001, 0.02); sndChain([sndNoise(t, 0.03), sndFilter('bandpass', 4200, 1.5), gn, sfxBus]);
}
function sfxChip(t, n){ for(var i = 0; i < (n || 1); i++) sfxChipClink(t + i * (0.055 + Math.random() * 0.03), 0.16 + Math.random() * 0.06); }
function sfxChipPile(t){ for(var i = 0; i < 9; i++) sfxChipClink(t + i * (0.07 + Math.random() * 0.03), 0.14 + Math.random() * 0.05); } // gain : une pile qui glisse vers soi
function sfxRouletteBall(t){ // la bille tourne sur la piste, ralentit, saute de case en case, puis se pose
  var x = t, gap = 0.035, i = 0;
  var gw = audioCtx.createGain(); sndEnv(gw.gain, t, 0.07, 0.4, 3.6); sndChain([sndNoise(t, 4.2), sndFilter('lowpass', 520), gw, sfxBus]); // le plateau qui ronronne
  while(x < t + 3.7){
    var g = audioCtx.createGain(); sndEnv(g.gain, x, 0.12 * Math.max(0.35, 1 - i * 0.012), 0.001, 0.02);
    sndChain([sndNoise(x, 0.03), sndFilter('bandpass', 3000 + Math.random() * 1800, 2), g, sfxBus]);
    gap *= 1.07; x += gap; i++;
  }
  for(var k = 0; k < 4; k++){ sfxFlick(x + k * (0.11 + k * 0.05), 0.5 - k * 0.1, 1400 - k * 120, 0.03); } // les derniers rebonds
  var o = audioCtx.createOscillator(), og = audioCtx.createGain(); o.type = 'sine'; o.frequency.value = 880; sndEnv(og.gain, x + 0.5, 0.1, 0.002, 0.25); sndChain([o, og, sfxBus]); o.start(x + 0.5); o.stop(x + 0.8); // « toc » final
}
function sfxJackpot(t){ // jackpot de machine à sous : montée de cloches brillantes, accord final, cascade de pièces qui tombent
  var c = audioCtx, notes = [76, 79, 83, 88, 91, 95];
  notes.forEach(function(m, i){ // arpège montant
    var f = midiHz(m), x = t + i * 0.075;
    [[1, 0.22], [2, 0.1], [3.01, 0.06]].forEach(function(p){
      var o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
      sndEnv(g.gain, x, p[1], 0.003, 0.55); sndChain([o, g, sfxBus]); o.start(x); o.stop(x + 0.6);
    });
  });
  var fin = t + notes.length * 0.075 + 0.04; // accord final qui sonne longtemps
  [83, 88, 91, 95, 100].forEach(function(m){
    var o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = midiHz(m);
    sndEnv(g.gain, fin, 0.07, 0.004, 1.1); sndChain([o, g, sfxBus]); o.start(fin); o.stop(fin + 1.2);
  });
  for(var i = 0; i < 16; i++){ sfxChipClink(fin + 0.12 + i * (0.055 + Math.random() * 0.03), 0.07 + Math.random() * 0.06); } // pièces
}
var miniSfxState = { key: '', bets: -1, board: -1, hand: -1, result: false, seen: false };
function sfxOnMini(g){ // appelé à chaque mise à jour d'une partie de poker / blackjack / roulette : on compare à ce qu'on a déjà entendu
  if(!g || !g.code) return;
  var st = g.poker || g.bj || g.rl; if(!st) return;
  var key = g.code+'|'+st.n, first = miniSfxState.key !== key, ev = [];
  var bets = 0, hands = 0, board = (g.poker && g.poker.board) ? g.poker.board.length : 0, resultNow = !!st.result;
  if(g.poker){ Object.keys(st.bets).forEach(function(id){ bets += st.bets[id] || 0; }); }
  else if(g.bj){ Object.keys(st.placed).forEach(function(id){ if(st.placed[id]) bets++; }); Object.keys(st.hands).forEach(function(id){ hands += st.hands[id].length; }); hands += st.dealer.length; }
  else { Object.keys(st.placed).forEach(function(id){ if(st.placed[id]) bets++; }); }
  var prev = miniSfxState, wasSeen = prev.seen && prev.key.split('|')[0] === g.code;
  if(wasSeen){
    if(first && g.poker) ev.push({ type: 'deal', n: 4 });
    else if(g.poker && board > prev.board) ev.push({ type: 'cards', n: board - Math.max(prev.board, 0) });
    if(g.poker && !first && bets > prev.bets) ev.push({ type: 'chip', n: 2 });
    if((g.bj || g.rl) && !first && bets > prev.bets) ev.push({ type: 'chip', n: 2 });
    if(g.bj && first) ev.push({ type: 'chip', n: 1 });
    if(g.bj && !first && hands > prev.hand && prev.hand > 0) ev.push({ type: 'cards', n: hands - prev.hand });
    if(g.bj && !first && prev.hand === 0 && hands > 0) ev.push({ type: 'deal', n: Math.min(hands, 6) });
    if(resultNow && !prev.result){
      if(g.rl){ var age = nowMs() - (st.turnAt || nowMs()); if(age < 1500) ev.push({ type: 'ball' }); }
      var mine = st.result && st.result.outcomes && st.result.outcomes[myId];
      if(mine && (mine.delta > 0 || (g.poker && st.result.won && st.result.won[myId] > 0))) ev.push({ type: 'win' });
    }
  }
  miniSfxState = { key: key, bets: bets, board: board, hand: g.bj ? hands : -1, result: resultNow, seen: true };
  if(!ev.length || !sfxOn || !audioReady()) return;
  var t = audioCtx.currentTime + 0.03;
  ev.forEach(function(e){
    if(e.type === 'deal'){ sfxDeal(t, e.n); t += 0.9; }
    else if(e.type === 'cards'){ for(var i = 0; i < Math.min(e.n, 5); i++) sfxDealCard(t + i * 0.12); t += 0.4; }
    else if(e.type === 'chip'){ sfxChip(t, e.n); t += 0.2; }
    else if(e.type === 'ball'){ sfxRouletteBall(t); }
    else if(e.type === 'win'){ sfxChipPile(t + (g.rl ? 4.4 : 0.1)); }
  });
}
