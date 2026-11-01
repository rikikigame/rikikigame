// Tests du moteur de poker (src/js/23l-poker-moteur.js) : `node tests/test_poker.mjs`
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

const root = new URL('..', import.meta.url).pathname;
const outils = fs.readFileSync(root + 'src/js/02-outils.js', 'utf8').split('\n').slice(1, 13).join('\n');
const moteur = fs.readFileSync(root + 'src/js/23l-poker-moteur.js', 'utf8');
const pre = `var LANG='fr'; var SUITS=['S','H','D','C']; var RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
var RANK_VALUE={}; RANKS.forEach(function(r,i){ RANK_VALUE[r]=i+2; });`;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(pre + outils + moteur + `;this.api={pkEval5,pkBest,pkCompare,pkStartHand,pkAct,pkOptions,pkBotDecide,pkEquity,pkDeal,pkPot,pkGameOver,pkRanking,pkSettle,mulberry32};`, ctx);
const A = ctx.api;
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const card = s => ({ rank: s.slice(0, -1), suit: s.slice(-1) });
const hand = s => s.split(' ').map(card);
const cat = s => A.pkBest(hand(s))[0];

// --- classement des mains ---
ok(cat('AS KS QS JS 10S') === 8, 'quinte flush royale');
ok(cat('AH 2H 3H 4H 5H') === 8, 'roue flush');
ok(cat('9S 9H 9D 9C 2S') === 7, 'carré');
ok(cat('9S 9H 9D 2C 2S') === 6, 'full');
ok(cat('2S 7S 9S JS KS') === 5, 'couleur');
ok(cat('AS 2H 3D 4C 5S') === 4, 'roue');
ok(cat('10S JH QD KC AS') === 4, 'quinte à l\'as');
ok(cat('QS QH QD 2C 7S') === 3, 'brelan');
ok(cat('QS QH 7D 7C 2S') === 2, 'double paire');
ok(cat('QS QH 7D 4C 2S') === 1, 'paire');
ok(cat('QS 9H 7D 4C 2S') === 0, 'carte haute');
ok(A.pkCompare(A.pkBest(hand('AS AH 2D 3C 4S')), A.pkBest(hand('KS KH QD JC 9S'))) > 0, 'paire d\'as > paire de rois');
ok(A.pkCompare(A.pkBest(hand('AS AH KD 3C 4S')), A.pkBest(hand('AD AC QD JC 9S'))) > 0, 'kicker');
ok(A.pkCompare(A.pkBest(hand('AS 2H 3D 4C 5S')), A.pkBest(hand('2S 3H 4D 5C 6S'))) < 0, 'roue < quinte au 6');
ok(A.pkCompare(A.pkBest(hand('9S 9H 9D 2C 2S')), A.pkBest(hand('8S 8H 8D AC AS'))) > 0, 'full : brelan le plus haut');
ok(cat('2S 2H 5D 5C 9S 9H KD') === 2, 'trois paires = double paire');
ok(A.pkBest(hand('2S 2H 5D 5C 9S 9H KD'))[3] === 13, 'trois paires : meilleur kicker');

// --- une main scriptée : 3 joueurs, tapis court ---
{
  const seats = ['a', 'b', 'c'];
  const stacks = { a: 100, b: 500, c: 1000 };
  let st = A.pkStartHand(seats, stacks, 1, 10, null);
  ok(st.dealer === 'a' && st.sbId === 'b' && st.bbId === 'c', 'donneur, petite et grosse blinde');
  ok(st.turn === 'a', 'le donneur parle en premier à 3 joueurs');
  const sec = { board: hand('2S 7H 9D JC KS'), holes: { a: hand('AS AH'), b: hand('KH KD'), c: hand('3S 4S') } };
  st = A.pkAct(st, 'a', { type: 'allin' }, sec);
  ok(st.bets.a === 100 && st.allin.a, 'a est tapis');
  st = A.pkAct(st, 'b', { type: 'allin' }, sec);
  st = A.pkAct(st, 'c', { type: 'call' }, sec);
  ok(st.result, 'main terminée');
  ok(st.result.pots.length === 3 || st.result.pots.length === 2, 'pots annexes');
  const total = Object.values(st.stacks).reduce((x, y) => x + y, 0);
  ok(total === 1600, 'jetons conservés');
  ok(st.result.won.b > st.result.won.a, 'le brelan de rois bat la paire d\'as');
}

// --- un joueur couché laisse sa blinde : un SEUL pot pour les deux joueurs restants (pas de faux « pot annexe ») ---
{
  const seats = ['a', 'b', 'c'];
  let st = A.pkStartHand(seats, { a: 750, b: 750, c: 750 }, 1, 10, null);
  const sec = { board: hand('2S 7H 9D JC KS'), holes: { a: hand('AS AH'), b: hand('KH KD'), c: hand('3S 4S') } };
  st = A.pkAct(st, 'a', { type: 'allin' }, sec);
  st = A.pkAct(st, 'b', { type: 'allin' }, sec);
  st = A.pkAct(st, 'c', { type: 'fold' }, sec);
  ok(st.result && st.result.pots.length === 1, 'une seule pot : ' + JSON.stringify(st.result && st.result.pots));
  ok(st.result.pots[0].amt === 750 + 750 + 20, 'le pot contient tout, blinde de c comprise');
  ok(Object.values(st.stacks).reduce((x, y) => x + y, 0) === 2250, 'jetons conservés');
}

// --- une mise que personne ne peut suivre est marquée « rendue » ---
{
  let st = A.pkStartHand(['a', 'b', 'c'], { a: 740, b: 760, c: 750 }, 1, 10, null);
  const sec = { board: hand('2S 7H 9D JC KS'), holes: { a: hand('AS AH'), b: hand('KH KD'), c: hand('3S 4S') } };
  st = A.pkAct(st, 'a', { type: 'allin' }, sec); st = A.pkAct(st, 'b', { type: 'allin' }, sec); st = A.pkAct(st, 'c', { type: 'allin' }, sec);
  const pots = st.result.pots;
  ok(pots.length === 3 && pots[2].uncalled && pots[2].amt === 10 && !pots[0].uncalled && !pots[1].uncalled, 'mise non suivie rendue : ' + JSON.stringify(pots));
  ok(Object.values(st.stacks).reduce((x, y) => x + y, 0) === 2250, 'jetons conservés');
}

// --- refus d'actions illégales ---
{
  const st = A.pkStartHand(['a', 'b'], { a: 1000, b: 1000 }, 1, 10, null);
  ok(st.turn === 'a' && st.dealer === 'a', 'tête-à-tête : le donneur est petite blinde et parle en premier');
  const sec = A.pkDeal(['a', 'b'], 1);
  ok(A.pkAct(st, 'b', { type: 'fold' }, sec) === null, 'pas son tour');
  ok(A.pkAct(st, 'a', { type: 'check' }, sec) === null, 'ne peut pas checker face à la grosse blinde');
  ok(A.pkAct(st, 'a', { type: 'raise', to: 25 }, sec) === null, 'relance trop petite');
  ok(A.pkAct(st, 'a', { type: 'raise', to: 99999 }, sec) === null, 'relance au-dessus du tapis');
  const after = A.pkAct(st, 'a', { type: 'raise', to: 60 }, sec);
  ok(after && after.current === 60 && after.turn === 'b', 'relance acceptée');
  ok(st.current === 20 && st.bets.a === 10, 'l\'ancien état n\'est pas modifié');
  const folded = A.pkAct(after, 'b', { type: 'fold' }, sec);
  ok(folded.result && folded.result.uncontested && folded.stacks.a === 1020, 'main gagnée sans combat : a gagne la blinde de b');
}

// --- parties aléatoires : jetons conservés, jamais bloqué, toutes les actions des robots sont légales ---
let hands = 0, showdowns = 0;
for (let game = 0; game < 400; game++) {
  const rng = A.mulberry32(1000 + game);
  const n = 2 + Math.floor(rng() * 7);
  const seats = []; for (let i = 0; i < n; i++) seats.push('p' + i);
  let stacks = {}; seats.forEach(p => { stacks[p] = 1000; });
  const total = n * 1000;
  let prev = null;
  for (let h = 1; h <= 12; h++) {
    let st = A.pkStartHand(seats, stacks, h, 12, prev);
    if (!st) break;
    const sec = A.pkDeal(st.order, game * 100 + h);
    if (st.turn === null && !st.result) st = A.pkSettle(st, sec);
    let steps = 0;
    while (!st.result) {
      ok(++steps < 200, 'la main ne se termine pas');
      const id = st.turn;
      ok(id && st.order.indexOf(id) >= 0 && !st.folded[id] && !st.allin[id], 'tour d\'un joueur valide');
      const d = A.pkBotDecide(st, id, sec.holes[id], rng, 6);
      const next = A.pkAct(st, id, d, sec);
      ok(next, 'décision du robot refusée : ' + JSON.stringify(d) + ' ' + JSON.stringify(A.pkOptions(st, id)));
      st = next;
    }
    hands++; if (!st.result.uncontested) showdowns++;
    const sum = Object.values(st.stacks).reduce((x, y) => x + y, 0);
    ok(sum === total, 'jetons perdus ou créés : ' + sum + ' ≠ ' + total);
    ok(Object.values(st.stacks).every(v => v >= 0), 'jetons négatifs');
    ok(Object.values(st.result.won).reduce((x, y) => x + y, 0) === Object.values(st.committed).reduce((x, y) => x + y, 0), 'pot distribué en entier');
    stacks = st.stacks; prev = st.dealer;
    if (A.pkGameOver(st)) break;
  }
}
ok(hands > 1000 && showdowns > 100, 'assez de mains jouées');
// --- l'ancien robot (règle simple), gardé ici comme adversaire de référence ---
vm.runInContext(`
function oldPre(hole){ var a = RANK_VALUE[hole[0].rank], b = RANK_VALUE[hole[1].rank], hi = Math.max(a, b), lo = Math.min(a, b), suited = hole[0].suit === hole[1].suit; var s = (hi + lo * 0.5) / 21; if(a === b) s = 0.5 + hi / 28; if(suited) s += 0.04; if(hi - lo === 1) s += 0.03; return Math.min(0.98, s); }
function oldPost(hole, board){ var sc = pkBest(hole.concat(board)), cat = sc[0], base = [0.18, 0.5, 0.72, 0.8, 0.88, 0.92, 0.97, 0.99, 1][cat]; if(cat === 1){ var pv = sc[1], mine = hole.some(function(c){ return RANK_VALUE[c.rank] === pv; }); base = mine ? (pv >= 11 ? 0.58 : 0.5) : 0.3; } return base; }
function oldBot(st, id, hole, rng){
  var o = pkOptions(st, id), s = st.board.length ? oldPost(hole, st.board) : oldPre(hole); s += (rng() - 0.5) * 0.18;
  var potOdds = o.toCall / Math.max(1, o.pot + o.toCall);
  var size = function(frac){ return Math.max(o.minTo, Math.min(o.maxTo, st.current + Math.round(o.pot * frac / st.bb) * st.bb)); };
  if(o.canCheck){ if(o.canRaise && s > 0.66 && rng() < 0.65) return { type: 'raise', to: size(0.4 + rng() * 0.4) }; if(o.canRaise && s < 0.35 && rng() < 0.06) return { type: 'raise', to: size(0.5) }; return { type: 'check' }; }
  if(o.canRaise && s > 0.82 && rng() < 0.6) return { type: s > 0.95 && rng() < 0.4 ? 'allin' : 'raise', to: size(0.6 + rng() * 0.6) };
  if(s > potOdds + 0.12 || (o.toCall <= st.bb && s > 0.3)) return { type: 'call' };
  if(rng() < 0.04) return { type: 'call' };
  return { type: 'fold' };
}
this.api.oldBot = oldBot;`, ctx);
// --- duel : le nouveau robot doit battre l'ancien (têtes-à-têtes, puis à 3 : deux nouveaux contre un ancien) ---
function duel(newIds, oldIds, handsCount, seed, rival) {
  const ids = newIds.concat(oldIds), rngD = A.mulberry32(seed); let gain = 0, played = 0;
  for (let h = 0; h < handsCount; h++) {
    const seats = ids.slice(h % ids.length).concat(ids.slice(0, h % ids.length));
    const stacks = {}; seats.forEach(p => { stacks[p] = 1000; });
    let st = A.pkStartHand(seats, stacks, 1, 0, seats[0]);
    const sec = A.pkDeal(st.order, seed * 1000 + h);
    let steps = 0;
    while (!st.result && steps++ < 200) {
      const id = st.turn, d = newIds.indexOf(id) >= 0 ? A.pkBotDecide(st, id, sec.holes[id], rngD, Number(process.env.DUEL_SIMS) || 30) : (rival || A.oldBot)(st, id, sec.holes[id], rngD);
      const next = A.pkAct(st, id, d, sec); ok(next, 'duel : décision refusée ' + JSON.stringify(d)); st = next;
    }
    newIds.forEach(p => { gain += st.stacks[p] - 1000; }); played++;
  }
  return gain / played / newIds.length;
}
const DUEL = Number(process.env.DUEL_HANDS) || 200; // DUEL_HANDS=2000 node tests/test_poker.mjs : mesure plus sûre (plusieurs minutes)
const huGain = duel(['n'], ['o'], DUEL, 7), threeGain = duel(['n1', 'n2'], ['o'], Math.round(DUEL * 0.6), 11);
console.log('duel : le nouveau robot gagne en moyenne ' + huGain.toFixed(1) + ' jetons par main contre l\'ancien (à 2), ' + threeGain.toFixed(1) + ' (à 3)');
ok(huGain > 0, 'le nouveau robot bat l\'ancien en tête-à-tête (' + huGain.toFixed(1) + ' jetons par main)');
ok(threeGain > 0, 'à 3, deux nouveaux robots battent un ancien (' + threeGain.toFixed(1) + ')');

// adversaires « nuls » classiques : celui qui suit tout, et le fou qui relance tout
const stationBot = (st, id) => { const o = A.pkOptions(st, id); return o.canCheck ? { type: 'check' } : { type: 'call' }; };
const maniacBot = (st, id, hole, rng) => { const o = A.pkOptions(st, id); return o.canRaise && rng() < 0.7 ? { type: 'raise', to: Math.min(o.maxTo, Math.max(o.minTo, st.current + st.bb * 4)) } : (o.canCheck ? { type: 'check' } : { type: 'call' }); };
const vsStation = duel(['n'], ['o'], Math.round(DUEL * 0.5), 21, stationBot), vsManiac = duel(['n'], ['o'], Math.round(DUEL * 0.5), 23, maniacBot);
console.log('duel : contre celui qui suit tout ' + vsStation.toFixed(1) + ' jetons par main, contre le fou qui relance tout ' + vsManiac.toFixed(1));
ok(vsStation > 20, 'bat largement celui qui suit tout (' + vsStation.toFixed(1) + ')');
ok(vsManiac > 20, 'bat largement le fou qui relance tout (' + vsManiac.toFixed(1) + ')');

// sans nombre de mains fixé (total 0)
ok(!A.pkGameOver({ result: {}, n: 999, total: 0, seats: ['a', 'b'], stacks: { a: 100, b: 50 } }), 'total 0 : pas de fin tant que deux joueurs ont des jetons');
ok(A.pkGameOver({ result: {}, n: 3, total: 0, seats: ['a', 'b'], stacks: { a: 150, b: 0 } }), 'total 0 : fin quand un seul joueur a des jetons');
ok(A.pkGameOver({ result: {}, n: 3, total: 0, finish: true, seats: ['a', 'b'], stacks: { a: 100, b: 50 } }), 'total 0 : fin demandée par l\'organisateur');
console.log(`✓ moteur de poker : ${checks} contrôles réussis (${hands} mains jouées, dont ${showdowns} à l'abattage)`);
