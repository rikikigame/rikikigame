/* ===================== 1.11.0 : roulette européenne — moteur (fonctions pures, sans écran ni réseau) =====================
   Jetons FICTIFS. 37 cases (0 à 36). Chaque joueur mise comme il veut avant le tirage ; le croupier (appareil de l'organisateur) tire le numéro.
   Mises : plein (un numéro, 35 contre 1), rouge / noir / pair / impair / manque (1-18) / passe (19-36) (1 contre 1), douzaine / colonne (2 contre 1).
   Le zéro fait perdre toutes les mises sauf celle sur le 0. Le numéro tiré se calcule depuis une graine gardée chez le croupier (secret = { seed }).
   L'état contient pour CHAQUE joueur une valeur (la fusion des mises à jour ne sait pas effacer). */
var RL_START_STACK = 500, RL_MIN_BET = 5, RL_MAX_BETS = 12, RL_HISTORY = 12;
var RL_CHIP_STEPS = [5, 10, 25, 100];
var RL_REDS = { 1:1, 3:1, 5:1, 7:1, 9:1, 12:1, 14:1, 16:1, 18:1, 19:1, 21:1, 23:1, 25:1, 27:1, 30:1, 32:1, 34:1, 36:1 };
var RL_BET_TYPES = { num:[0, 36], dozen:[1, 3], col:[1, 3], red:[0, 0], black:[0, 0], odd:[0, 0], even:[0, 0], low:[0, 0], high:[0, 0] };

function rlColor(n){ return n === 0 ? 'green' : (RL_REDS[n] ? 'red' : 'black'); }
function rlBetWins(b, n){
  if(b.t === 'num') return n === b.v;
  if(n === 0) return false;
  switch(b.t){
    case 'red': return !!RL_REDS[n];
    case 'black': return !RL_REDS[n];
    case 'odd': return n % 2 === 1;
    case 'even': return n % 2 === 0;
    case 'low': return n <= 18;
    case 'high': return n >= 19;
    case 'dozen': return Math.ceil(n / 12) === b.v;
    case 'col': return ((n - 1) % 3) + 1 === b.v;
  }
  return false;
}
function rlBetPays(b){ return b.t === 'num' ? 35 : (b.t === 'dozen' || b.t === 'col' ? 2 : 1); }
function rlBetLabel(b){
  return { num: String(b.v), red: 'Rouge', black: 'Noir', odd: 'Impair', even: 'Pair', low: '1-18', high: '19-36', dozen: b.v + (b.v === 1 ? 're' : 'e') + ' douzaine', col: 'Colonne ' + b.v }[b.t] || '?';
}
function rlTotal(list){ return list.reduce(function(s, b){ return s + b.a; }, 0); }
// une mise valide ? { t, v, a }
function rlBetOk(b){
  if(!b || !RL_BET_TYPES[b.t]) return false;
  var r = RL_BET_TYPES[b.t], v = b.v == null ? 0 : b.v;
  if(typeof v !== 'number' || v !== Math.floor(v) || v < r[0] || v > r[1]) return false;
  return typeof b.a === 'number' && b.a === Math.floor(b.a) && b.a >= RL_MIN_BET;
}
// on regroupe les mises identiques (même type et même valeur)
function rlMerge(list){
  var out = [];
  list.forEach(function(b){
    var same = out.filter(function(x){ return x.t === b.t && (x.v || 0) === (b.v || 0); })[0];
    if(same) same.a += b.a; else out.push({ t: b.t, v: b.v || 0, a: b.a });
  });
  return out;
}

function rlStartRound(seats, stacks, n, total, history){
  var order = seats.filter(function(id){ return stacks[id] >= RL_MIN_BET; });
  if(!order.length) return null;
  var st = { n: n, total: total, seats: seats.slice(), order: order, stacks: {}, startStacks: {}, bets: {}, placed: {}, mode: {},
    phase: 'bet', number: -1, history: (history || []).slice(-RL_HISTORY), result: null, seq: 0, last: null };
  seats.forEach(function(id){
    st.stacks[id] = stacks[id]; st.startStacks[id] = stacks[id];
    st.bets[id] = []; st.placed[id] = false;
    st.mode[id] = order.indexOf(id) >= 0 ? 'bet' : 'out';
  });
  return st;
}
function rlClone(o){ return JSON.parse(JSON.stringify(o)); }

// un joueur valide ses mises (liste vide = il passe son tour) ; quand tout le monde a joué, le tirage a lieu
function rlPlace(state, id, list, secret){
  if(!state || state.phase !== 'bet' || state.mode[id] !== 'bet' || state.placed[id] || !Array.isArray(list)) return null;
  if(list.length > RL_MAX_BETS * 2) return null;
  var i;
  for(i = 0; i < list.length; i++) if(!rlBetOk(list[i])) return null;
  var bets = rlMerge(list);
  if(bets.length > RL_MAX_BETS) return null;
  var total = rlTotal(bets);
  if(total > state.stacks[id]) return null;
  var st = rlClone(state);
  st.stacks[id] -= total; st.bets[id] = bets; st.placed[id] = true; st.seq += 1;
  st.last = { id: id, type: bets.length ? 'bets' : 'pass', amount: total };
  if(st.order.every(function(p){ return st.placed[p]; })) return rlSpin(st, secret);
  return st;
}
function rlNumberFor(seed, n){ return Math.floor(mulberry32((seed + n * 7919) >>> 0)() * 37); }
function rlSpin(st, secret){
  var num = rlNumberFor(secret.seed, st.n), outcomes = {};
  st.order.forEach(function(p){
    var back = 0, wins = [];
    st.bets[p].forEach(function(b){ if(rlBetWins(b, num)){ back += b.a * (rlBetPays(b) + 1); wins.push(rlBetLabel(b)); } });
    st.stacks[p] += back;
    outcomes[p] = { bet: rlTotal(st.bets[p]), back: back, delta: back - rlTotal(st.bets[p]), wins: wins };
  });
  st.seats.forEach(function(p){ if(!outcomes[p]) outcomes[p] = { bet: 0, back: 0, delta: 0, wins: [] }; });
  st.number = num; st.history = st.history.concat([num]).slice(-RL_HISTORY);
  st.result = { number: num, color: rlColor(num), outcomes: outcomes };
  st.phase = 'done';
  return st;
}
function rlGameOver(st){
  if(!st || !st.result) return false;
  return !!st.finish || (st.total > 0 && st.n >= st.total) || !st.seats.some(function(p){ return st.stacks[p] >= RL_MIN_BET; });
}
function rlRanking(st){ return st.seats.slice().sort(function(a, b){ return st.stacks[b] - st.stacks[a]; }); }

/* ---------- robots : des mises variées, jamais plus que leur tapis ---------- */
function rlBotBets(st, id, rng){
  var stack = st.stacks[id], unit = Math.max(RL_MIN_BET, Math.round(stack * 0.08 / 5) * 5), r = rng(), out = [];
  var simple = ['red', 'black', 'odd', 'even', 'low', 'high'];
  if(r < 0.12) return []; // le robot passe parfois
  if(r < 0.62) out.push({ t: simple[Math.floor(rng() * simple.length)], v: 0, a: unit });
  else if(r < 0.85) out.push({ t: rng() < 0.5 ? 'dozen' : 'col', v: 1 + Math.floor(rng() * 3), a: unit });
  else { out.push({ t: 'num', v: Math.floor(rng() * 37), a: Math.max(RL_MIN_BET, Math.round(unit / 2 / 5) * 5) }); out.push({ t: simple[Math.floor(rng() * simple.length)], v: 0, a: unit }); }
  out = rlMerge(out);
  while(out.length && rlTotal(out) > stack) out.pop();
  if(!out.length && stack >= RL_MIN_BET) out = [{ t: 'red', v: 0, a: RL_MIN_BET }];
  return out;
}
