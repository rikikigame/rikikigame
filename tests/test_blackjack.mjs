// Tests du moteur de blackjack (src/js/23n-blackjack-moteur.js) : `node tests/test_blackjack.mjs`
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

const root = new URL('..', import.meta.url).pathname;
const outils = fs.readFileSync(root + 'src/js/02-outils.js', 'utf8').split('\n').slice(1, 13).join('\n');
const moteur = fs.readFileSync(root + 'src/js/23n-blackjack-moteur.js', 'utf8');
const pre = `var SUITS=['S','H','D','C']; var RANKS=['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
var RANK_VALUE={}; RANKS.forEach(function(r,i){ RANK_VALUE[r]=i+2; });`;
const ctx = {};
vm.createContext(ctx);
vm.runInContext(pre + outils + moteur + `;this.api={bjValue,bjShoe,bjStartRound,bjBet,bjAct,bjGameOver,bjBotBet,bjBotAct,bjCanDouble,bjCanSplit,bjInsure,bjOwner,mulberry32};`, ctx);
const A = ctx.api;
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };
const card = s => ({ rank: s.slice(0, -1), suit: s.slice(-1) });
const hand = s => s.split(' ').map(card);

// --- valeur des mains ---
ok(A.bjValue(hand('AS KH')).bj, 'blackjack');
ok(!A.bjValue(hand('AS 5H KD')).bj && A.bjValue(hand('AS 5H KD')).total === 16, 'as + 5 + roi = 16');
ok(A.bjValue(hand('AS AH 9D')).total === 21, 'deux as + 9 = 21');
ok(A.bjValue(hand('AS 6H')).soft && A.bjValue(hand('AS 6H')).total === 17, 'soft 17');
ok(A.bjValue(hand('10S 6H 9D')).bust, 'bust');
ok(A.bjValue(hand('5S 5H 5D 6C')).total === 21 && !A.bjValue(hand('5S 5H 5D 6C')).bj, '21 en 4 cartes n\'est pas un blackjack');

// sabot truqué : l'ordre des cartes tirées est p1, croupier(visible), p1, croupier(cachée), puis les tirages
const rig = list => ({ shoe: list.split(' ').map(card).concat(A.bjShoe(7).slice(0, 50)) });
{ // joueur gagne 20 contre 19
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, rig('KS 9H QS KH')); // p1:K, d:9, p1:Q, hole:K → joueur 20, croupier 19
  ok(st.turn === 'a' && st.dealerHole && st.dealer.length === 1, 'le joueur a la parole, une seule carte du croupier visible');
  st = A.bjAct(st, 'a', { type: 'stand' }, rig('KS 9H QS KH'));
  ok(st.phase === 'done' && st.result.outcomes.a.res === 'win' && st.stacks.a === 600, '20 bat 19 : 400 + 200');
}
{ // blackjack payé 3 pour 2
  const r = rig('AS 9H KS 7H');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r);
  ok(st.phase === 'done' && st.result.outcomes.a.res === 'bj' && st.stacks.a === 650, 'blackjack : +150');
}
{ // croupier a un blackjack : le joueur perd, un joueur avec blackjack fait égalité
  const r = rig('KS AH 9S KH');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r);
  ok(st.phase === 'insurance' && st.insWait.length === 1, 'un as chez le croupier : on propose l\'assurance');
  st = A.bjInsure(st, 'a', false, r);
  ok(st.phase === 'done' && st.result.dealerBj && st.result.outcomes.a.res === 'lose' && st.stacks.a === 400, 'blackjack du croupier');
  const r2 = rig('KS AH AS KH');
  let s2 = A.bjInsure(A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r2), 'a', false, r2);
  ok(s2.result.outcomes.a.res === 'push' && s2.stacks.a === 500, 'deux blackjacks : égalité');
}
{ // double puis croupier qui dépasse
  const r = rig('5S 6H 6S 10H KH QD');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r); // joueur 5+6 = 11, croupier 6 + 10
  ok(A.bjCanDouble(st, 'a'), 'double possible');
  st = A.bjAct(st, 'a', { type: 'double' }, r); // reçoit un roi : 21 ; le croupier a 16 et tire une dame → dépasse
  ok(st.bets.a === 200 && st.result.outcomes.a.res === 'win' && st.stacks.a === 700, 'double gagnant : 300 + 400');
  ok(A.bjAct(st, 'a', { type: 'hit' }, r) === null, 'plus d\'action après la fin');
}
{ // mises illégales
  const st = A.bjStartRound(['a', 'b'], { a: 500, b: 5 }, 1, 5, null);
  ok(st.mode.b === 'out' && st.order.length === 1, 'un joueur sans jetons ne joue pas');
  ok(A.bjBet(st, 'a', 5, rig('KS 9H QS KH')) === null, 'mise trop petite');
  ok(A.bjBet(st, 'a', 501, rig('KS 9H QS KH')) === null, 'mise supérieure aux jetons');
  ok(A.bjBet(st, 'b', 10, rig('KS 9H QS KH')) === null, 'joueur éliminé');
}

{ // assurance : payée 2 contre 1 si le croupier a un blackjack, perdue sinon
  const r = rig('KS AH 9S KH');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r);
  ok(A.bjAct(st, 'a', { type: 'hit' }, r) === null, 'pas de jeu avant les réponses à l\'assurance');
  st = A.bjInsure(st, 'a', true, r);
  ok(st.phase === 'done' && st.stacks.a === 500 && st.result.outcomes.a.delta === 0, 'assurance gagnante : on perd la mise mais l\'assurance paie 2 contre 1');
  const r2 = rig('KS AH 9S 6H');
  let s2 = A.bjInsure(A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r2), 'a', true, r2);
  ok(s2.phase === 'play' && s2.stacks.a === 350, 'assurance perdue : -50, la manche continue');
  s2 = A.bjAct(s2, 'a', { type: 'stand' }, r2);
  ok(s2.stacks.a === 550 && s2.result.outcomes.a.delta === 50, '19 bat 17 mais l\'assurance est perdue : 550');
  ok(A.bjInsure(s2, 'a', true, r2) === null, 'plus d\'assurance après la manche');
  const poor = A.bjBet(A.bjStartRound(['a'], { a: 10 }, 1, 5, null), 'a', 10, rig('KS AH 9S 6H')); // plus de jetons pour l'assurance : pas de proposition
  ok(poor.phase === 'play' || poor.phase === 'insurance', 'manche lancée');
}
{ // séparer une paire : deux mains, une mise chacune
  const r = rig('8S 9H 8H 7H 10D 2D 9S 4C');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r);
  ok(A.bjCanSplit(st, 'a'), 'paire de 8 : on peut séparer');
  st = A.bjAct(st, 'a', { type: 'split' }, r);
  ok(st.stacks.a === 300 && st.bets.a === 100 && st.bets['a#2'] === 100 && st.turn === 'a' && st.turnHand === 'a', 'séparation : seconde mise, première main d\'abord');
  ok(!A.bjCanSplit(st, 'a'), 'une seule séparation par manche');
  st = A.bjAct(st, 'a', { type: 'stand' }, r);
  ok(st.turnHand === 'a#2', 'puis la seconde main');
  st = A.bjAct(st, 'a', { type: 'stand' }, r);
  ok(st.phase === 'done' && st.stacks.a === 700 && st.result.outcomes.a.delta === 200 && st.result.outcomes.a.res === 'win', 'les deux mains gagnent (18 et 10 contre 25) : 300 + 400');
}
{ // pas de séparation sans vraie paire : roi + dame n'est pas une paire
  const r = rig('KS 9H QH 7H 10D 2D');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r);
  ok(!A.bjCanSplit(st, 'a') && A.bjAct(st, 'a', { type: 'split' }, r) === null, 'roi + dame : pas de séparation');
  const r2 = rig('KS 9H KH 7H 10D 2D');
  ok(A.bjCanSplit(A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r2), 'a'), 'deux rois : séparation permise');
}
{ // deux as séparés : une seule carte chacun, et 21 après séparation n'est pas un blackjack
  const r = rig('AS 6H AH 7H KD KS 9C');
  let st = A.bjBet(A.bjStartRound(['a'], { a: 500 }, 1, 5, null), 'a', 100, r);
  st = A.bjAct(st, 'a', { type: 'split' }, r);
  ok(st.phase === 'done' && st.hands.a.length === 2 && st.hands['a#2'].length === 2, 'as séparés : une carte chacun, on passe au croupier');
  ok(st.result.outcomes.a.delta === st.stacks.a - 500, 'résultat cohérent avec les jetons');
  ok(st.result.outcomes.a.res !== 'bj', 'pas de blackjack après une séparation');
}

// --- parties aléatoires : jetons cohérents, jamais bloqué ---
let rounds = 0, bjs = 0, busts = 0, splits = 0;
for (let game = 0; game < 600; game++) {
  const rng = A.mulberry32(500 + game);
  const n = 1 + Math.floor(rng() * 5);
  const seats = []; for (let i = 0; i < n; i++) seats.push('p' + i);
  let stacks = {}; seats.forEach(p => { stacks[p] = 500; });
  let lastBets = {};
  for (let r = 1; r <= 10; r++) {
    let st = A.bjStartRound(seats, stacks, r, 10, lastBets);
    if (!st) break;
    const secret = { shoe: A.bjShoe(game * 100 + r) };
    st.order.forEach(p => { if (st.phase === 'bet') { const nx = A.bjBet(st, p, A.bjBotBet(st, p, rng), secret); ok(nx, 'mise du robot refusée'); st = nx; } });
    let steps = 0;
    while (st.phase !== 'done') {
      ok(++steps < 100, 'tour qui ne finit pas');
      if (st.phase === 'insurance') { // robots : l'assurance est prise une fois sur quatre
        const w = st.insWait[0]; const nx = A.bjInsure(st, w, rng() < 0.25, secret); ok(nx, 'réponse à l\'assurance refusée'); st = nx; continue;
      }
      ok(st.phase === 'play' && st.turn && st.mode[st.turnHand] === 'play' && A.bjOwner(st.turnHand) === st.turn, 'tour d\'un joueur valide');
      const d = A.bjBotAct(st, st.turn);
      const nx = A.bjAct(st, st.turn, d, secret);
      ok(nx, 'action du robot refusée : ' + JSON.stringify(d));
      st = nx;
    }
    rounds++;
    st.order.forEach(p => { if (st.result.outcomes[A.bjOwner(p)].res === 'bj') bjs++; if (A.bjValue(st.hands[p]).bust) busts++; if (p.endsWith('#2')) splits++; });
    ok(st.dealer.length >= 2 && !st.dealerHole, 'le croupier a dévoilé');
    ok(st.result.dealerBust === (A.bjValue(st.dealer).total > 21), 'dépassement du croupier');
    seats.forEach(p => {
      ok(st.stacks[p] >= 0, 'jetons négatifs');
      const o = st.result.outcomes[p];
      ok(st.stacks[p] === st.startStacks[p] + o.delta, 'jetons ≠ départ + gain : ' + p + ' ' + JSON.stringify(o));
    });
    stacks = st.stacks; lastBets = st.lastBets;
    if (A.bjGameOver(st)) break;
  }
}
ok(rounds > 1500 && bjs > 20 && busts > 100 && splits > 10, 'assez de manches jouées, avec des séparations');
// sans nombre de manches fixé (total 0)
ok(!A.bjGameOver({ result: {}, n: 999, total: 0, seats: ['a'], stacks: { a: 100 } }), 'total 0 : pas de fin tant qu\'il reste des jetons');
ok(A.bjGameOver({ result: {}, n: 3, total: 0, seats: ['a'], stacks: { a: 5 } }), 'total 0 : fin quand plus personne ne peut miser');
ok(A.bjGameOver({ result: {}, n: 3, total: 0, finish: true, seats: ['a'], stacks: { a: 100 } }), 'total 0 : fin demandée par l\'organisateur');
console.log(`✓ moteur de blackjack : ${checks} contrôles réussis (${rounds} manches jouées, ${bjs} blackjacks, ${busts} dépassements, ${splits} séparations)`);
