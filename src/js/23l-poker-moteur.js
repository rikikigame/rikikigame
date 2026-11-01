/* ===================== 1.12.0 : poker Texas Hold'em — moteur (fonctions pures, sans écran ni réseau) =====================
   Jetons FICTIFS : aucun argent, aucun gain réel. Chaque fonction reçoit un état et en rend un nouveau (JSON), sans modifier l'ancien.
   État public « poker » (écrit dans la partie) :
     n (numéro de la main), total, sb, bb, dealer, order (joueurs encore en jeu à cette main, dans l'ordre de la table),
     seats (tous les joueurs de la partie), stacks / bets / committed / folded / allin (une valeur pour CHAQUE joueur : jamais de clé absente,
     la fusion des mises à jour ne sait pas effacer), street, board, current, minRaise, pending (qui doit encore parler), turn, seq, last, result.
   Les cartes cachées (mains, reste du tapis) ne sont jamais dans cet état : elles restent chez l'organisateur (secret) et, pour chaque joueur, dans sa case privée. */
var PK_START_STACK = 1000, PK_HANDS_PER_LEVEL = 4;
var PK_BLINDS = [10, 15, 25, 40, 60, 100, 150, 200, 300, 500];
var PK_HAND_NAMES = ['Carte haute', 'Paire', 'Double paire', 'Brelan', 'Quinte', 'Couleur', 'Full', 'Carré', 'Quinte flush'];
var PK_HAND_NAMES_EN = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
var PK_STREET_CARDS = { preflop: 0, flop: 3, turn: 4, river: 5 };
var PK_NEXT_STREET = { preflop: 'flop', flop: 'turn', turn: 'river' };

function pkClone(o){ return JSON.parse(JSON.stringify(o)); }
function pkBlinds(handNo){
  var level = Math.min(PK_BLINDS.length - 1, Math.floor((handNo - 1) / PK_HANDS_PER_LEVEL));
  return { sb: PK_BLINDS[level], bb: PK_BLINDS[level] * 2 };
}

/* ---------- évaluation des mains ---------- */
// 5 cartes → [catégorie 0..8, départages…] (comparer avec pkCompare)
function pkEval5(cs){
  var vals = cs.map(function(c){ return RANK_VALUE[c.rank]; }).sort(function(a, b){ return b - a; });
  var flush = cs.every(function(c){ return c.suit === cs[0].suit; });
  var counts = {};
  vals.forEach(function(v){ counts[v] = (counts[v] || 0) + 1; });
  var groups = Object.keys(counts).map(function(k){ return [Number(k), counts[k]]; })
    .sort(function(a, b){ return b[1] - a[1] || b[0] - a[0]; });
  var straightHigh = 0;
  if(groups.length === 5){
    if(vals[0] - vals[4] === 4) straightHigh = vals[0];
    else if(vals[0] === 14 && vals[1] === 5 && vals[4] === 2) straightHigh = 5; // la roue : A-2-3-4-5
  }
  if(straightHigh && flush) return [8, straightHigh];
  if(groups[0][1] === 4) return [7, groups[0][0], groups[1][0]];
  if(groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]];
  if(flush) return [5].concat(vals);
  if(straightHigh) return [4, straightHigh];
  if(groups[0][1] === 3) return [3, groups[0][0], groups[1][0], groups[2][0]];
  if(groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]];
  if(groups[0][1] === 2) return [1, groups[0][0], groups[1][0], groups[2][0], groups[3][0]];
  return [0].concat(vals);
}
function pkCompare(a, b){
  for(var i = 0; i < Math.max(a.length, b.length); i++){
    var d = (a[i] || 0) - (b[i] || 0);
    if(d) return d > 0 ? 1 : -1;
  }
  return 0;
}
// meilleure main de 5 cartes parmi 5 à 7
function pkBest(cards){
  var best = null, n = cards.length;
  if(n < 5) return null;
  (function pick(start, chosen){
    if(chosen.length === 5){
      var sc = pkEval5(chosen.map(function(i){ return cards[i]; }));
      if(!best || pkCompare(sc, best) > 0) best = sc;
      return;
    }
    for(var i = start; i < n; i++) pick(i + 1, chosen.concat([i]));
  })(0, []);
  return best;
}
function pkHandName(score){
  return (LANG === 'en' ? PK_HAND_NAMES_EN : PK_HAND_NAMES)[score[0]];
}

/* ---------- nouvelle main ---------- */
// seats : tous les joueurs de la partie (ordre de la table) ; stacks : jetons de chacun ; prevDealer : donneur de la main d'avant (ou null)
function pkStartHand(seats, stacks, handNo, total, prevDealer){
  var live = seats.filter(function(id){ return stacks[id] > 0; });
  if(live.length < 2) return null;
  var start = prevDealer ? seats.indexOf(prevDealer) : -1, dealer = null, i;
  for(i = 1; i <= seats.length; i++){
    var cand = seats[(start + i + seats.length) % seats.length];
    if(stacks[cand] > 0){ dealer = cand; break; }
  }
  var di = live.indexOf(dealer), n = live.length;
  var heads = n === 2;
  var sbId = heads ? dealer : live[(di + 1) % n];
  var bbId = heads ? live[(di + 1) % n] : live[(di + 2) % n];
  var firstId = heads ? dealer : live[(di + 3) % n];
  var bl = pkBlinds(handNo);
  var st = { n: handNo, total: total, sb: bl.sb, bb: bl.bb, dealer: dealer, order: live, seats: seats.slice(),
    stacks: {}, bets: {}, committed: {}, folded: {}, allin: {}, street: 'preflop', board: [], current: 0, minRaise: bl.bb,
    pending: [], turn: null, seq: 0, last: null, result: null, startStacks: {}, sbId: sbId, bbId: bbId };
  seats.forEach(function(id){
    st.stacks[id] = stacks[id]; st.startStacks[id] = stacks[id];
    st.bets[id] = 0; st.committed[id] = 0; st.allin[id] = false; st.folded[id] = live.indexOf(id) < 0;
  });
  pkPay(st, sbId, bl.sb); pkPay(st, bbId, bl.bb);
  st.current = Math.max(st.bets[sbId], st.bets[bbId]);
  // qui parle : à partir du joueur après la grosse blinde, tout le monde (la grosse blinde parle en dernier : « option »)
  var fi = live.indexOf(firstId), order = [];
  for(i = 0; i < n; i++){ var pid = live[(fi + i) % n]; if(!st.allin[pid]) order.push(pid); }
  st.pending = order;
  return pkSettle(st, null);
}
function pkPay(st, id, amount){
  var pay = Math.min(amount, st.stacks[id]);
  st.stacks[id] -= pay; st.bets[id] += pay; st.committed[id] += pay;
  if(st.stacks[id] === 0) st.allin[id] = true;
  return pay;
}

/* ---------- ce que le joueur peut faire (pour l'écran et pour les robots) ---------- */
function pkOptions(st, id){
  var stack = st.stacks[id], bet = st.bets[id];
  var toCall = Math.min(Math.max(0, st.current - bet), stack);
  var maxTo = bet + stack;
  var minTo = Math.min(st.current + st.minRaise, maxTo);
  return { toCall: toCall, canCheck: st.current - bet <= 0, canRaise: maxTo > st.current && stack > toCall, minTo: minTo, maxTo: maxTo,
    pot: pkPot(st) };
}
function pkPot(st){
  var t = 0; st.seats.forEach(function(id){ t += st.committed[id]; });
  return t;
}

/* ---------- une action : act = { type:'fold'|'check'|'call'|'raise'|'allin', to:total de la mise de ce tour } ---------- */
// secret = { board:[5 cartes], holes:{ id:[2 cartes] } } (chez l'organisateur). Rend le nouvel état, ou null si l'action est refusée.
function pkAct(state, id, act, secret){
  if(!state || state.result || state.turn !== id || !act) return null;
  var st = pkClone(state), o = pkOptions(st, id), type = act.type;
  if(type === 'fold'){ st.folded[id] = true; }
  else if(type === 'check'){ if(!o.canCheck) return null; }
  else if(type === 'call'){ if(o.canCheck) return null; pkPay(st, id, o.toCall); }
  else if(type === 'allin' || type === 'raise'){
    var to = type === 'allin' ? o.maxTo : Math.round(Number(act.to));
    if(!isFinite(to) || to > o.maxTo) return null;
    if(to <= st.current){ // tapis plus court que la mise : c'est un simple « suivre »
      if(type === 'raise') return null;
      pkPay(st, id, o.toCall);
    } else {
      if(!o.canRaise || (to < o.minTo && to < o.maxTo)) return null;
      var inc = to - st.current;
      pkPay(st, id, to - st.bets[id]);
      if(inc >= st.minRaise) st.minRaise = inc;
      st.current = st.bets[id];
      // la relance donne la parole à tous les autres encore en jeu
      var pos = st.order.indexOf(id), rest = [], k;
      for(k = 1; k < st.order.length; k++){
        var oid = st.order[(pos + k) % st.order.length];
        if(!st.folded[oid] && !st.allin[oid]) rest.push(oid);
      }
      st.pending = rest;
      st.seq += 1; st.last = { id: id, type: st.allin[id] ? 'allin' : 'raise', to: st.bets[id] };
      return pkSettle(st, secret);
    }
  }
  else return null;
  st.pending = st.pending.filter(function(p){ return p !== id; });
  st.seq += 1;
  st.last = { id: id, type: type === 'allin' ? (st.allin[id] ? 'allin' : 'call') : type, to: st.bets[id] };
  return pkSettle(st, secret);
}

// fait avancer la main tant qu'aucun joueur n'a la parole : tour suivant, tapis dévoilé, abattage, main gagnée sans combat
function pkSettle(st, secret){
  for(var guard = 0; guard < 8; guard++){
    var alive = st.order.filter(function(p){ return !st.folded[p]; });
    if(alive.length === 1){ return pkAward(st, secret, true); }
    st.pending = st.pending.filter(function(p){ return !st.folded[p] && !st.allin[p]; });
    if(st.pending.length > 0){ st.turn = st.pending[0]; return st; }
    // le tour d'enchères est fini
    st.order.forEach(function(p){ st.bets[p] = 0; });
    st.current = 0; st.minRaise = st.bb; st.turn = null;
    var actors = alive.filter(function(p){ return !st.allin[p]; });
    if(st.street === 'river' || actors.length <= 1){
      if(!secret) return st; // pas de cartes à dévoiler (ne devrait pas arriver)
      st.street = 'river'; st.board = secret.board.slice(0, 5);
      return pkAward(st, secret, false);
    }
    st.street = PK_NEXT_STREET[st.street];
    if(secret) st.board = secret.board.slice(0, PK_STREET_CARDS[st.street]);
    // on parle à partir du premier joueur à gauche du donneur
    var seatIdx = st.seats.indexOf(st.dealer), ord = [], i;
    for(i = 1; i <= st.seats.length; i++){
      var sid = st.seats[(seatIdx + i) % st.seats.length];
      if(st.order.indexOf(sid) >= 0 && !st.folded[sid] && !st.allin[sid]) ord.push(sid);
    }
    st.pending = ord;
  }
  return st;
}

/* ---------- fin de main : pots principal et annexes, partage ---------- */
function pkAward(st, secret, uncontested){
  var seats = st.seats, won = {}, shown = {}, names = {}, pots = [];
  seats.forEach(function(p){ won[p] = 0; });
  var alive = st.order.filter(function(p){ return !st.folded[p]; });
  var levels = [];
  seats.forEach(function(p){ if(st.committed[p] > 0 && levels.indexOf(st.committed[p]) < 0) levels.push(st.committed[p]); });
  levels.sort(function(a, b){ return a - b; });
  var scores = {};
  if(!uncontested){
    alive.forEach(function(p){
      var hole = secret && secret.holes ? secret.holes[p] : null;
      if(!hole) return;
      scores[p] = pkBest(hole.concat(st.board));
      shown[p] = hole; names[p] = pkHandName(scores[p]);
    });
  }
  // couches de mise : une couche est disputée par ceux qui ont misé au moins ce niveau sans se coucher ; deux couches
  // disputées par les mêmes joueurs ne font qu'UN pot (sinon une mise perdue d'un joueur couché créerait un faux « pot annexe »)
  var prev = 0, layers = [];
  levels.forEach(function(level){
    var amount = 0, eligible = [];
    seats.forEach(function(p){
      var part = Math.min(st.committed[p], level) - prev;
      if(part > 0) amount += part;
      if(!st.folded[p] && st.committed[p] >= level) eligible.push(p);
    });
    prev = level;
    if(amount <= 0) return;
    if(eligible.length === 0) eligible = alive.slice();
    var last = layers[layers.length - 1];
    if(last && last.eligible.join('|') === eligible.join('|')) last.amount += amount;
    else layers.push({ amount: amount, eligible: eligible });
  });
  layers.forEach(function(layer){
    var amount = layer.amount, eligible = layer.eligible;
    var winners = eligible;
    if(!uncontested){
      var top = null;
      eligible.forEach(function(p){ if(scores[p] && (!top || pkCompare(scores[p], top) > 0)) top = scores[p]; });
      winners = eligible.filter(function(p){ return scores[p] && pkCompare(scores[p], top) === 0; });
      if(!winners.length) winners = eligible;
    }
    // les jetons impairs vont aux premiers gagnants à gauche du donneur
    var di = seats.indexOf(st.dealer);
    winners = winners.slice().sort(function(a, b){ return ((seats.indexOf(a) - di + seats.length) % seats.length) - ((seats.indexOf(b) - di + seats.length) % seats.length); });
    var share = Math.floor(amount / winners.length), extra = amount - share * winners.length;
    winners.forEach(function(p, i){ won[p] += share + (i < extra ? 1 : 0); });
    pots.push({ amt: amount, to: winners.slice(), name: (!uncontested && scores[winners[0]]) ? pkHandName(scores[winners[0]]) : '', uncalled: !uncontested && eligible.length === 1 });
  });
  seats.forEach(function(p){ st.stacks[p] += won[p]; st.bets[p] = 0; });
  st.result = { uncontested: !!uncontested, pots: pots, won: won, shown: shown, names: names };
  st.turn = null; st.pending = []; st.street = 'done';
  return st;
}

/* ---------- fin de partie ---------- */
function pkGameOver(st){
  if(!st || !st.result) return false;
  var live = st.seats.filter(function(p){ return st.stacks[p] > 0; });
  return live.length <= 1 || !!st.finish || (st.total > 0 && st.n >= st.total); // total 0 = sans limite : on joue jusqu'au dernier jeton ou jusqu'à l'arrêt demandé par l'organisateur
}
function pkRanking(st){
  return st.seats.slice().sort(function(a, b){ return st.stacks[b] - st.stacks[a]; });
}

/* ---------- robots ---------- */
function pkPreflopStrength(hole){
  var a = RANK_VALUE[hole[0].rank], b = RANK_VALUE[hole[1].rank];
  var hi = Math.max(a, b), lo = Math.min(a, b), suited = hole[0].suit === hole[1].suit;
  var s = (hi + lo * 0.5) / 21;
  if(a === b) s = 0.5 + hi / 28;
  if(suited) s += 0.04;
  if(hi - lo === 1) s += 0.03;
  return Math.min(0.98, s);
}
function pkPostflopStrength(hole, board){
  var sc = pkBest(hole.concat(board));
  var cat = sc[0], base = [0.18, 0.5, 0.72, 0.8, 0.88, 0.92, 0.97, 0.99, 1][cat];
  if(cat === 1){ // paire : meilleure si elle utilise une carte de la main
    var pv = sc[1], mine = hole.some(function(c){ return RANK_VALUE[c.rank] === pv; });
    base = mine ? (pv >= 11 ? 0.58 : 0.5) : 0.3;
  }
  return base;
}
// rend { type, to } ; rng() entre 0 et 1
function pkBotDecide(st, id, hole, rng){
  var o = pkOptions(st, id);
  var s = st.board.length ? pkPostflopStrength(hole, st.board) : pkPreflopStrength(hole);
  s += (rng() - 0.5) * 0.18;
  var potOdds = o.toCall / Math.max(1, o.pot + o.toCall);
  var size = function(frac){ return Math.max(o.minTo, Math.min(o.maxTo, st.current + Math.round(o.pot * frac / st.bb) * st.bb)); };
  if(o.canCheck){
    if(o.canRaise && s > 0.66 && rng() < 0.65) return { type: 'raise', to: size(0.4 + rng() * 0.4) };
    if(o.canRaise && s < 0.35 && rng() < 0.06) return { type: 'raise', to: size(0.5) };
    return { type: 'check' };
  }
  if(o.canRaise && s > 0.82 && rng() < 0.6) return { type: s > 0.95 && rng() < 0.4 ? 'allin' : 'raise', to: size(0.6 + rng() * 0.6) };
  if(s > potOdds + 0.12 || (o.toCall <= st.bb && s > 0.3)) return { type: 'call' };
  if(rng() < 0.04) return { type: 'call' };
  return { type: 'fold' };
}
// tapis de 52 cartes : 2 cartes par joueur en jeu + 5 cartes communes
function pkDeal(order, seed){
  var deck = shuffle(buildDeck(), mulberry32(seed)), holes = {}, i;
  order.forEach(function(p){ holes[p] = []; });
  for(i = 0; i < 2; i++) order.forEach(function(p){ holes[p].push(deck.pop()); });
  var board = []; for(i = 0; i < 5; i++) board.push(deck.pop());
  return { holes: holes, board: board };
}
