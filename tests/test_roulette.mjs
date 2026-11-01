// Tests du moteur de roulette (src/js/23p-roulette-moteur.js) : `node tests/test_roulette.mjs`
import fs from 'fs';
import vm from 'vm';
import assert from 'assert';

const root = new URL('..', import.meta.url).pathname;
const outils = fs.readFileSync(root + 'src/js/02-outils.js', 'utf8').split('\n').slice(1, 13).join('\n');
const moteur = fs.readFileSync(root + 'src/js/23p-roulette-moteur.js', 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(outils + moteur + `;this.api={rlColor,rlBetWins,rlBetPays,rlStartRound,rlPlace,rlGameOver,rlRanking,rlBotBets,rlNumberFor,rlMerge,rlTotal,mulberry32};`, ctx);
const A = ctx.api;
let checks = 0;
const ok = (c, m) => { checks++; assert.ok(c, m); };

// --- couleurs : 18 rouges, 18 noirs, un zéro vert ---
let reds = 0, blacks = 0;
for (let n = 1; n <= 36; n++) { if (A.rlColor(n) === 'red') reds++; else if (A.rlColor(n) === 'black') blacks++; }
ok(reds === 18 && blacks === 18 && A.rlColor(0) === 'green', '18 rouges, 18 noirs, un zéro vert');
ok(A.rlColor(1) === 'red' && A.rlColor(2) === 'black' && A.rlColor(36) === 'red' && A.rlColor(17) === 'black', 'couleurs connues');

// --- chaque type de mise : combien de numéros gagnants, et paiement équilibré ---
const count = b => { let c = 0; for (let n = 0; n <= 36; n++) if (A.rlBetWins(b, n)) c++; return c; };
ok(count({ t: 'red', v: 0, a: 5 }) === 18 && count({ t: 'black', v: 0, a: 5 }) === 18, 'rouge / noir : 18 numéros');
ok(count({ t: 'odd', v: 0, a: 5 }) === 18 && count({ t: 'even', v: 0, a: 5 }) === 18, 'impair / pair : 18 numéros (le zéro perd)');
ok(count({ t: 'low', v: 0, a: 5 }) === 18 && count({ t: 'high', v: 0, a: 5 }) === 18, 'manque / passe : 18 numéros');
for (let v = 1; v <= 3; v++) ok(count({ t: 'dozen', v, a: 5 }) === 12 && count({ t: 'col', v, a: 5 }) === 12, 'douzaine / colonne : 12 numéros');
ok(A.rlBetWins({ t: 'dozen', v: 1, a: 5 }, 12) && !A.rlBetWins({ t: 'dozen', v: 1, a: 5 }, 13) && A.rlBetWins({ t: 'dozen', v: 3, a: 5 }, 36), 'bornes des douzaines');
ok(A.rlBetWins({ t: 'col', v: 1, a: 5 }, 1) && A.rlBetWins({ t: 'col', v: 2, a: 5 }, 5) && A.rlBetWins({ t: 'col', v: 3, a: 5 }, 36), 'colonnes : 1, 4, 7… / 2, 5… / 3, 6…');
for (let n = 0; n <= 36; n++) ok(count({ t: 'num', v: n, a: 5 }) === 1 && A.rlBetWins({ t: 'num', v: n, a: 5 }, n), 'plein : un seul numéro');
ok(A.rlBetPays({ t: 'num' }) === 35 && A.rlBetPays({ t: 'dozen' }) === 2 && A.rlBetPays({ t: 'col' }) === 2 && A.rlBetPays({ t: 'red' }) === 1, 'paiements 35 / 2 / 1');
ok(!A.rlBetWins({ t: 'red', v: 0, a: 5 }, 0) && A.rlBetWins({ t: 'num', v: 0, a: 5 }, 0), 'le zéro ne gagne que sur le plein 0');

// --- un tirage scripté : on cherche une graine qui donne un numéro voulu ---
const seedFor = (n, target) => { for (let s = 0; s < 100000; s++) if (A.rlNumberFor(s, n) === target) return s; throw new Error('pas de graine'); };
{
  const seed = seedFor(1, 17); // 17 : noir, impair, manque, 2e douzaine, colonne 2
  let st = A.rlStartRound(['a', 'b'], { a: 500, b: 500 }, 1, 5, null);
  ok(st.phase === 'bet' && st.order.length === 2, 'tour de mises');
  st = A.rlPlace(st, 'a', [{ t: 'black', v: 0, a: 100 }, { t: 'num', v: 17, a: 10 }, { t: 'dozen', v: 1, a: 50 }], { seed });
  ok(st.phase === 'bet' && st.stacks.a === 340 && st.placed.a, 'mises déduites, en attente de b');
  ok(A.rlPlace(st, 'a', [{ t: 'red', v: 0, a: 5 }], { seed }) === null, 'on ne mise pas deux fois');
  st = A.rlPlace(st, 'b', [], { seed }); // b passe
  ok(st.phase === 'done' && st.number === 17 && st.result.color === 'black', 'tirage : 17 noir');
  // a : noir 100 → +200 ; plein 17 → 10 × 36 = 360 ; 1re douzaine perdue → total 560 ; a mis 160 : gain net 400
  ok(st.stacks.a === 340 + 200 + 360 && st.result.outcomes.a.delta === 400, 'gains : noir 1:1 + plein 35:1, douzaine perdue : ' + JSON.stringify(st.result.outcomes.a));
  ok(st.stacks.b === 500 && st.result.outcomes.b.delta === 0, 'un joueur qui passe ne perd rien');
  ok(st.history.length === 1 && st.history[0] === 17, 'historique des numéros');
}
{ // le zéro : seul le plein 0 gagne
  const seed = seedFor(1, 0);
  let st = A.rlStartRound(['a'], { a: 500 }, 1, 5, null);
  st = A.rlPlace(st, 'a', [{ t: 'red', v: 0, a: 50 }, { t: 'even', v: 0, a: 50 }, { t: 'low', v: 0, a: 50 }, { t: 'num', v: 0, a: 5 }], { seed });
  ok(st.number === 0 && st.stacks.a === 500 - 155 + 5 * 36, 'zéro : les mises simples perdent, le plein 0 gagne');
}

// --- mises illégales ---
{
  const st = A.rlStartRound(['a', 'b'], { a: 100, b: 3 }, 1, 5, null);
  ok(st.mode.b === 'out' && st.order.length === 1, 'un joueur sans jetons ne joue pas');
  const sec = { seed: 1 };
  ok(A.rlPlace(st, 'a', [{ t: 'red', v: 0, a: 101 }], sec) === null, 'mise supérieure aux jetons');
  ok(A.rlPlace(st, 'a', [{ t: 'red', v: 0, a: 3 }], sec) === null, 'mise trop petite');
  ok(A.rlPlace(st, 'a', [{ t: 'num', v: 37, a: 10 }], sec) === null && A.rlPlace(st, 'a', [{ t: 'num', v: -1, a: 10 }], sec) === null, 'numéro hors table');
  ok(A.rlPlace(st, 'a', [{ t: 'dozen', v: 4, a: 10 }], sec) === null && A.rlPlace(st, 'a', [{ t: 'zzz', v: 0, a: 10 }], sec) === null, 'type ou douzaine inconnus');
  ok(A.rlPlace(st, 'a', [{ t: 'red', v: 0, a: 10.5 }], sec) === null, 'mise non entière');
  ok(A.rlPlace(st, 'b', [{ t: 'red', v: 0, a: 5 }], sec) === null, 'joueur éliminé');
  ok(A.rlPlace(st, 'a', 'rouge', sec) === null, 'liste invalide');
  const many = []; for (let i = 0; i < 13; i++) many.push({ t: 'num', v: i, a: 5 });
  ok(A.rlPlace(st, 'a', many, sec) === null, 'trop de mises différentes');
  const merged = A.rlPlace(A.rlStartRound(['a'], { a: 100 }, 1, 5, null), 'a', [{ t: 'red', v: 0, a: 10 }, { t: 'red', v: 0, a: 15 }], sec);
  ok(merged.bets.a.length === 1 && merged.bets.a[0].a === 25, 'mises identiques regroupées');
}

// --- parties aléatoires : jetons conservés (avec le gain attendu), jamais bloqué, robots toujours légaux ---
let rounds = 0, zeros = 0, totalBet = 0, totalBack = 0;
for (let game = 0; game < 600; game++) {
  const rng = A.mulberry32(900 + game);
  const n = 1 + Math.floor(rng() * 5);
  const seats = []; for (let i = 0; i < n; i++) seats.push('p' + i);
  let stacks = {}; seats.forEach(p => { stacks[p] = 500; });
  let history = [];
  for (let r = 1; r <= 10; r++) {
    let st = A.rlStartRound(seats, stacks, r, 10, history);
    if (!st) break;
    const secret = { seed: Math.floor(rng() * 4294967296) };
    st.order.forEach(p => {
      if (st.phase !== 'bet') return;
      const bets = A.rlBotBets(st, p, rng);
      const nx = A.rlPlace(st, p, bets, secret);
      ok(nx, 'mise du robot refusée : ' + JSON.stringify(bets) + ' / ' + st.stacks[p]);
      st = nx;
    });
    ok(st.phase === 'done' && st.result, 'le tirage a eu lieu');
    rounds++; if (st.number === 0) zeros++;
    ok(st.number >= 0 && st.number <= 36, 'numéro valide');
    seats.forEach(p => {
      ok(st.stacks[p] >= 0, 'jetons négatifs');
      const o = st.result.outcomes[p];
      ok(st.stacks[p] === st.startStacks[p] + o.delta, 'jetons ≠ départ + gain');
      totalBet += o.bet; totalBack += o.back;
    });
    stacks = st.stacks; history = st.history;
    if (A.rlGameOver(st)) break;
  }
}
ok(rounds > 1500 && zeros > 10, 'assez de tirages');
// la maison garde un petit avantage (1/37 sur les mises simples) : le retour moyen doit rester raisonnable
const ret = totalBack / totalBet;
ok(ret > 0.85 && ret < 1.1, 'retour moyen plausible : ' + ret.toFixed(3));
// sans nombre de tours fixé (total 0) : la partie ne s'arrête qu'à court de jetons, ou sur demande de l'organisateur
ok(!A.rlGameOver({ result: {}, n: 999, total: 0, seats: ['a'], stacks: { a: 100 } }), 'total 0 : pas de fin tant qu\'il reste des jetons');
ok(A.rlGameOver({ result: {}, n: 3, total: 0, seats: ['a'], stacks: { a: 2 } }), 'total 0 : fin quand plus personne ne peut miser');
ok(A.rlGameOver({ result: {}, n: 3, total: 0, finish: true, seats: ['a'], stacks: { a: 100 } }), 'total 0 : fin demandée par l\'organisateur');
ok(!A.rlGameOver({ n: 3, total: 0, finish: true, seats: ['a'], stacks: { a: 100 } }), 'pas de fin au milieu d\'un tour');
console.log(`✓ moteur de roulette : ${checks} contrôles réussis (${rounds} tirages, ${zeros} zéros, retour moyen ${(ret * 100).toFixed(1)} %)`);
