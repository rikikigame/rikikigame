/* ===================== 1.11.0 : blackjack — moteur (fonctions pures, sans écran ni réseau) =====================
   Jetons FICTIFS. Chaque joueur joue contre le croupier (pas contre les autres). Règles : le croupier tire jusqu'à 17 et s'arrête sur tous les 17 ;
   blackjack payé 3 contre 2 ; double possible sur les 2 premières cartes ; pas de séparation (split) ni d'assurance dans cette version.
   Les cartes du sabot restent chez le croupier (secret = { shoe }) ; l'état public ne montre que la première carte du croupier tant qu'il n'a pas joué.
   L'état contient pour CHAQUE joueur une valeur (la fusion des mises à jour ne sait pas effacer). */
var BJ_START_STACK = 500, BJ_MIN_BET = 10, BJ_MAX_BET = 500, BJ_DECKS = 6;
var BJ_CHIP_STEPS = [10, 25, 50, 100, 500];

function bjShoe(seed){
  var cards = [], d;
  for(d = 0; d < BJ_DECKS; d++) cards = cards.concat(buildDeck());
  return shuffle(cards, mulberry32(seed));
}
// valeur d'une main : { total, soft (un as compte 11), bust, bj (blackjack naturel) }
function bjValue(cards){
  var total = 0, aces = 0;
  cards.forEach(function(c){
    if(c.rank === 'A'){ aces++; total += 11; }
    else if(c.rank === 'K' || c.rank === 'Q' || c.rank === 'J' || c.rank === '10') total += 10;
    else total += Number(c.rank);
  });
  while(total > 21 && aces > 0){ total -= 10; aces--; }
  return { total: total, soft: aces > 0, bust: total > 21, bj: cards.length === 2 && total === 21 };
}

function bjStartRound(seats, stacks, n, total, lastBets){
  var order = seats.filter(function(id){ return stacks[id] >= BJ_MIN_BET; });
  if(!order.length) return null;
  var st = { n: n, total: total, seats: seats.slice(), order: order, stacks: {}, startStacks: {}, bets: {}, placed: {}, hands: {}, mode: {}, doubled: {}, split: {}, ins: {}, insWait: [], turnHand: null,
    lastBets: {}, dealer: [], dealerHole: false, dealerTotal: 0, phase: 'bet', turn: null, seq: 0, pos: 0, holeIdx: -1, result: null, last: null };
  seats.forEach(function(id){
    st.stacks[id] = stacks[id]; st.startStacks[id] = stacks[id];
    st.bets[id] = 0; st.placed[id] = false; st.hands[id] = []; st.doubled[id] = false;
    st.mode[id] = order.indexOf(id) >= 0 ? 'bet' : 'out';
    st.lastBets[id] = (lastBets && lastBets[id]) || 0;
  });
  return st;
}
function bjClone(o){ return JSON.parse(JSON.stringify(o)); }
function bjMaxBetFor(st, id){ return Math.min(BJ_MAX_BET, st.stacks[id]); }

// mise d'un joueur ; quand tout le monde a misé, la donne a lieu
function bjBet(state, id, amount, secret){
  if(!state || state.phase !== 'bet' || state.mode[id] !== 'bet' || state.placed[id]) return null;
  var a = Math.round(Number(amount));
  if(!isFinite(a) || a < BJ_MIN_BET || a > bjMaxBetFor(state, id)) return null;
  var st = bjClone(state);
  st.stacks[id] -= a; st.bets[id] = a; st.placed[id] = true; st.lastBets[id] = a; st.seq += 1;
  st.last = { id: id, type: 'bet', amount: a };
  if(st.order.every(function(p){ return st.placed[p]; })) return bjDeal(st, secret);
  return st;
}
function bjDraw(st, secret){ return secret.shoe[st.pos++]; }
function bjOwner(hid){ return String(hid).split('#')[0]; } // une main séparée s'appelle « joueur#2 » ; ses jetons sont ceux du joueur
function bjHandIds(st, id){ return st.hands[id + '#2'] ? [id, id + '#2'] : [id]; }
function bjDeal(st, secret){
  var order = st.order;
  order.forEach(function(p){ st.hands[p] = [bjDraw(st, secret)]; });
  st.dealer = [bjDraw(st, secret)];
  order.forEach(function(p){ st.hands[p].push(bjDraw(st, secret)); });
  st.holeIdx = st.pos; st.pos += 1; st.dealerHole = true;
  order.forEach(function(p){ st.mode[p] = bjValue(st.hands[p]).bj ? 'bj' : 'play'; });
  st.phase = 'play';
  if(st.dealer[0].rank === 'A'){ // le croupier montre un as : assurance (la moitié de la mise, paie 2 contre 1) pour ceux qui peuvent la payer
    var elig = order.filter(function(p){ return st.stacks[p] >= Math.floor(st.bets[p] / 2); });
    if(elig.length){ st.phase = 'insurance'; st.insWait = elig; st.turn = null; st.turnHand = null; return st; }
  }
  return bjPeek(st, secret);
}
// le croupier regarde sa carte cachée si la première est un as ou une figure : blackjack = la manche s'arrête
function bjPeek(st, secret){
  var up = st.dealer[0], peek = up.rank === 'A' || up.rank === 'K' || up.rank === 'Q' || up.rank === 'J' || up.rank === '10';
  if(peek && bjValue([up, secret.shoe[st.holeIdx]]).bj) return bjSettle(st, secret);
  return bjNext(st, secret);
}
// assurance prise (take = true) ou refusée par un joueur ; quand tout le monde a répondu, la partie continue
function bjInsure(state, id, take, secret){
  if(!state || state.phase !== 'insurance' || state.insWait.indexOf(id) < 0) return null;
  var st = bjClone(state), cost = Math.floor(st.bets[id] / 2);
  if(take){ if(st.stacks[id] < cost) return null; st.stacks[id] -= cost; st.ins[id] = cost; }
  st.insWait = st.insWait.filter(function(p){ return p !== id; });
  st.seq += 1; st.last = { id: id, type: take ? 'insure' : 'decline' };
  if(st.insWait.length) return st;
  st.phase = 'play';
  return bjPeek(st, secret);
}
// qui joue ensuite ? (les mains séparées jouent l'une après l'autre) sinon le croupier joue
function bjNext(st, secret){
  var h = st.order.filter(function(p){ return st.mode[p] === 'play'; })[0] || null;
  if(h){ st.turn = bjOwner(h); st.turnHand = h; return st; }
  st.turn = null; st.turnHand = null;
  return bjDealerPlay(st, secret);
}
function bjDealerPlay(st, secret){
  st.dealer = [st.dealer[0], secret.shoe[st.holeIdx]]; st.dealerHole = false;
  var anyLive = st.order.some(function(p){ return st.mode[p] === 'stand'; });
  while(anyLive && bjValue(st.dealer).total < 17) st.dealer.push(bjDraw(st, secret));
  return bjSettle(st, secret);
}
function bjSettle(st, secret){
  if(st.dealerHole){ st.dealer = [st.dealer[0], secret.shoe[st.holeIdx]]; st.dealerHole = false; }
  var dv = bjValue(st.dealer), outcomes = {};
  st.order.forEach(function(h){
    var p = bjOwner(h), bet = st.bets[h], hv = bjValue(st.hands[h]), natural = hv.bj && !st.split[p], res, back = 0;
    if(hv.bust){ res = 'lose'; }
    else if(natural){ if(dv.bj){ res = 'push'; back = bet; } else { res = 'bj'; back = bet + Math.floor(bet * 1.5); } }
    else if(dv.bj){ res = 'lose'; }
    else if(dv.bust || hv.total > dv.total){ res = 'win'; back = bet * 2; }
    else if(hv.total === dv.total){ res = 'push'; back = bet; }
    else { res = 'lose'; }
    st.stacks[p] += back;
    var d = back - bet, prev = outcomes[p];
    outcomes[p] = prev ? { res: (prev.delta + d) > 0 ? 'win' : ((prev.delta + d) < 0 ? 'lose' : 'push'), delta: prev.delta + d } : { res: res, delta: d };
  });
  Object.keys(st.ins).forEach(function(p){ // assurance : payée 2 contre 1 si le croupier a un blackjack, perdue sinon
    var cost = st.ins[p], back = dv.bj ? cost * 3 : 0;
    st.stacks[p] += back; if(outcomes[p]) outcomes[p].delta += back - cost;
  });
  st.seats.forEach(function(p){ if(!outcomes[p]) outcomes[p] = { res: 'out', delta: 0 }; });
  st.dealerTotal = dv.total;
  st.result = { outcomes: outcomes, dealerBust: dv.bust, dealerBj: dv.bj };
  st.phase = 'done'; st.turn = null; st.turnHand = null;
  return st;
}

// une action de joueur : 'hit' | 'stand' | 'double' | 'split' (sur la main dont c'est le tour)
function bjAct(state, id, act, secret){
  if(!state || state.phase !== 'play' || state.turn !== id || !act) return null;
  var st = bjClone(state), type = act.type, hid = st.turnHand || id, hand = st.hands[hid];
  if(type === 'stand'){ st.mode[hid] = 'stand'; }
  else if(type === 'hit'){
    hand.push(bjDraw(st, secret));
    var v = bjValue(hand);
    if(v.bust) st.mode[hid] = 'bust'; else if(v.total === 21) st.mode[hid] = 'stand';
  }
  else if(type === 'double'){
    if(hand.length !== 2 || st.stacks[id] < st.bets[hid]) return null;
    st.stacks[id] -= st.bets[hid]; st.bets[hid] *= 2; st.doubled[hid] = true;
    hand.push(bjDraw(st, secret));
    st.mode[hid] = bjValue(hand).bust ? 'bust' : 'stand';
  }
  else if(type === 'split'){
    if(!bjCanSplit(state, id)) return null;
    var h2 = id + '#2', second = hand.pop(), aces = hand[0].rank === 'A';
    st.stacks[id] -= st.bets[hid]; st.bets[h2] = st.bets[hid]; st.doubled[h2] = false; st.split[id] = true;
    hand.push(bjDraw(st, secret)); st.hands[h2] = [second, bjDraw(st, secret)];
    [hid, h2].forEach(function(x){ st.mode[x] = (aces || bjValue(st.hands[x]).total === 21) ? 'stand' : 'play'; }); // as séparés : une seule carte chacun
    st.order.splice(st.order.indexOf(hid) + 1, 0, h2);
  }
  else return null;
  st.seq += 1; st.last = { id: id, type: type };
  return bjNext(st, secret);
}
function bjCanDouble(st, id){
  var hid = st.turnHand || id, hand = st.hands[hid];
  return st.phase === 'play' && st.turn === id && !!hand && hand.length === 2 && st.stacks[id] >= st.bets[hid];
}
// séparer une paire (une seule fois par manche) : deux cartes de même rang (deux 8, deux rois…, pas un roi et une dame), et de quoi miser une seconde fois
function bjCanSplit(st, id){
  var hid = st.turnHand || id, hand = st.hands[hid];
  return st.phase === 'play' && st.turn === id && !st.split[id] && !!hand && hand.length === 2 && hand[0].rank === hand[1].rank && st.stacks[id] >= st.bets[hid];
}

function bjGameOver(st){
  if(!st || !st.result) return false;
  return !!st.finish || (st.total > 0 && st.n >= st.total) || !st.seats.some(function(p){ return st.stacks[p] >= BJ_MIN_BET; });
}
function bjRanking(st){ return st.seats.slice().sort(function(a, b){ return st.stacks[b] - st.stacks[a]; }); }

/* ---------- robots : stratégie de base simplifiée ---------- */
function bjBotBet(st, id, rng){
  var want = st.lastBets[id] || [25, 50, 50, 100][Math.floor(rng() * 4)];
  return Math.max(BJ_MIN_BET, Math.min(bjMaxBetFor(st, id), want));
}
function bjBotAct(st, id){
  var hid = st.turnHand || id, hand = st.hands[hid], hv = bjValue(hand), up = bjValue([st.dealer[0]]).total; // un as vaut 11 ici
  if(bjCanSplit(st, id) && (hand[0].rank === 'A' || hand[0].rank === '8')) return { type: 'split' };
  if(bjCanDouble(st, id) && !hv.soft && (hv.total === 11 || (hv.total === 10 && up <= 9))) return { type: 'double' };
  if(hv.soft){ return hv.total >= 18 && !(hv.total === 18 && up >= 9) ? { type: 'stand' } : { type: 'hit' }; }
  if(hv.total >= 17) return { type: 'stand' };
  if(hv.total >= 13 && up <= 6) return { type: 'stand' };
  if(hv.total === 12 && up >= 4 && up <= 6) return { type: 'stand' };
  return { type: 'hit' };
}
