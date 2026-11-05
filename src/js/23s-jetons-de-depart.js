/* ===================== 1.11.0 : jetons de départ du Casino de Fredo, calculés depuis la ligue du MOIS D'AVANT =====================
   Au casino (poker, blackjack, roulette), chaque joueur commence avec :
   - son Elo du classement en ligne du mois PRÉCÉDENT (ex. 1180) ; 750 pour un joueur sans profil, nouveau ou pas assez classé (3 parties minimum) ;
   - + un petit bonus selon le TEMPS passé en haut du classement du mois EN COURS (il grandit au fil du mois, pour les parties à venir) : 3 jetons par
     jour en 1re place, 2 par jour dans les 3 premiers, 1 par jour dans les 10 premiers (cumulables), 150 au maximum.
   Rien n'est enregistré : tout se recalcule depuis les parties de la ligue (publiques). Chaque joueur écrit son propre nombre dans players[id].bank quand
   il entre dans le salon ; l'organisateur le lit au lancement (bornes 100 à 5000 ; 750 pour les robots et les valeurs absentes). */
var CASINO_BASE_NEW = 750, CASINO_BANK_MIN = 100, CASINO_BANK_MAX = 100000000, CASINO_BONUS_MAX = 150; // plafond : le solde sauvegardé peut grandir (voir le portefeuille ci-dessous)
var CASINO_BONUS_FIRST = 3, CASINO_BONUS_TOP3 = 2, CASINO_BONUS_TOP10 = 1;
// 1.14.0 : le casino est un bonus, c'est le Rikiki qui fait gagner des jetons. Faillite = petite aide (une fois par jour), puis juste de quoi s'asseoir ;
// chaque partie de ligue en ligne finie rapporte jetons selon la place : 1er 500, 2e 250, 3e 150, les autres CASINO_GAME_BONUS (100). Pas les points de la partie : les parties courtes en donneraient plus à l'entrée à la table suivante.
var CASINO_RESCUE = 250, CASINO_DAILY = 250, CASINO_GAME_BONUS = 100, CASINO_RANK_PAY = [500, 250, 150]; // CASINO_DAILY : bonus du jour pour tout joueur connecté avec son profil

function prevMonthKey(ts){ var d = new Date(ts || nowMs()); return seasonOf(new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime()); }
function monthBounds(key){ var p = key.split('-'), y = Number(p[0]), m = Number(p[1]) - 1; return [new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime()]; }

// jours passés à la 1re place / dans les 3 / dans les 10 premiers du classement en ligne pendant le mois `key`, jusqu'à maintenant (le classement est rejoué après chaque partie)
function leagueTopDays(key, memberId){
  var b = monthBounds(key), now = nowMs(), DAY = 86400000, out = { first: 0, top3: 0, top10: 0 };
  var games = league.games.filter(function(g){ return g.mode === 'online' && gameSeason(g) === key && g.at; }).sort(function(x, y){ return x.at - y.at; });
  var saved = league.games, k, i;
  try{
    for(k = 0; k < games.length; k++){
      league.games = games.slice(0, k + 1);
      var ranked = computeLeague(key, 'online').ranked, idx = -1;
      for(i = 0; i < ranked.length; i++) if(ranked[i].id === memberId){ idx = i; break; }
      var end = k + 1 < games.length ? games[k + 1].at : b[1], len = Math.max(0, (Math.min(end, b[1], now) - games[k].at) / DAY);
      if(idx === 0) out.first += len;
      if(idx >= 0 && idx < 3) out.top3 += len;
      if(idx >= 0 && idx < 10) out.top10 += len;
    }
  } finally { league.games = saved; }
  return out;
}
function casinoBonusFromDays(d){ return Math.min(CASINO_BONUS_MAX, Math.round(d.first * CASINO_BONUS_FIRST + d.top3 * CASINO_BONUS_TOP3 + d.top10 * CASINO_BONUS_TOP10)); }
function casinoBankFrom(elo, days){ return Math.max(CASINO_BANK_MIN, Math.min(CASINO_BANK_MAX, Math.round(elo) + casinoBonusFromDays(days))); }

// 1.13.0 : PORTEFEUILLE. Les jetons gagnés ou perdus sont sauvegardés : avec un profil dans `wallets/{profil}` (suit le joueur sur tous ses appareils ;
// règle Firebase « wallets »), toujours aussi sur l'appareil (`rikiki_wallet`, seule sauvegarde sans profil). Les points de ligue ne servent plus que pour
// la TOUTE première fois. Après une faillite (moins de CASINO_BANK_MIN jetons) : petite aide de CASINO_RESCUE une fois par jour, puis CASINO_BANK_MIN.
function walletRef(){ return (currentProfile && currentProfile.key && socialOn()) ? claudeDb.doc('wallets/' + currentProfile.key) : null; }
// petites notes rangées avec le solde (dans __json, sans changer les règles) : jour de la dernière aide de faillite, victoires de ligue déjà payées
var walletMeta = { rescueDay: '', winsPaid: null, gamesPaid: null, gift: '' };
function walletMetaFrom(d){
  return { rescueDay: (d && typeof d.rescueDay === 'string') ? d.rescueDay : '', winsPaid: (d && typeof d.winsPaid === 'number' && isFinite(d.winsPaid)) ? d.winsPaid : null, gamesPaid: (d && typeof d.gamesPaid === 'number' && isFinite(d.gamesPaid)) ? d.gamesPaid : null, gift: (d && typeof d.gift === 'string') ? d.gift : '' };
}
async function walletRead(){
  var ref = walletRef(), remote = null, local = null, meta = null;
  if(ref){ try{ var s = await ref.get(); if(s.exists){ var d = s.data(); if(d && typeof d.chips === 'number' && isFinite(d.chips)){ remote = d.chips; meta = walletMetaFrom(d); } } }catch(e){ console.warn('portefeuille', e); } }
  try{ var raw = localStorage.getItem('rikiki_wallet'); if(raw !== null && isFinite(Number(raw))) local = Number(raw); }catch(e){}
  if(!meta){ try{ meta = walletMetaFrom(JSON.parse(localStorage.getItem('rikiki_wallet_meta') || '{}')); }catch(e){ meta = walletMetaFrom(null); } }
  walletMeta = meta;
  return remote !== null ? remote : local;
}
async function walletSave(chips){
  chips = Math.max(0, Math.min(CASINO_BANK_MAX, Math.round(Number(chips))));
  if(!isFinite(chips)) return;
  try{ localStorage.setItem('rikiki_wallet', String(chips)); localStorage.setItem('rikiki_wallet_meta', JSON.stringify(walletMeta)); }catch(e){}
  var ref = walletRef();
  if(ref){ try{ var doc = { chips: chips, at: nowMs(), rescueDay: walletMeta.rescueDay, winsPaid: walletMeta.winsPaid, gamesPaid: walletMeta.gamesPaid, gift: walletMeta.gift, __plain: { pkey: currentProfile.key, chips: chips } }; await ref.set(doc); }catch(e){ console.warn('portefeuille (envoi)', e); } }
}
var walletSaved = '';
// à chaque fin de main / manche / tour, chacun enregistre SON solde (appelé toutes les secondes par miniTimerTick)
function walletTick(g){
  var st = g && (g.poker || g.bj || g.rl);
  if(!st || !st.result || !st.stacks || !st.seats || st.seats.indexOf(myId) < 0 || typeof st.stacks[myId] !== 'number') return;
  var key = g.code + '|' + st.n + '|' + st.stacks[myId];
  if(key === walletSaved) return;
  walletSaved = key;
  // poker : seule la mise de départ de la table (st.buyIn) est en jeu, le reste de mes jetons est resté de côté
  var reserve = (g.poker === st && typeof st.buyIn === 'number') ? Math.max(0, miniStartStack(g, myId) - st.buyIn) : 0;
  walletSave(reserve + st.stacks[myId]);
}
// 1.16.0 : au poker, tout le monde s'assoit avec la même somme = le solde du joueur le plus pauvre de la table (les robots reçoivent la même somme) ; le reste de leurs jetons reste de côté
function pokerBuyIn(g, ids){
  var banks = ids.filter(function(id){ return g.players[id] && !g.players[id].isBot; }).map(function(id){ return miniStartStack(g, id); });
  return banks.length ? Math.min.apply(null, banks) : CASINO_BASE_NEW;
}
// jetons de départ d'après la ligue : l'Elo du mois dernier (750 si on débute) + le petit bonus du mois en cours
async function casinoLeagueBank(){
  try{ await loadLeague(false, true); }catch(e){ console.warn('ligue (jetons de départ)', e); }
  var me = myMember(); if(!me) return CASINO_BASE_NEW;
  var prev = prevMonthKey(), row = computeLeague(prev, 'online').ranked.filter(function(r){ return r.id === me.id; })[0];
  var base = row ? row.elo : CASINO_BASE_NEW;
  return casinoBankFrom(base, leagueTopDays(seasonOf(nowMs()), me.id));
}
function dayKeyNow(){ var d = new Date(nowMs()); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
// mes parties de ligue en ligne finies, de la plus ancienne à la plus récente : [{ at, rank, n }] (null si je ne suis pas encore dans la ligue)
function myOnlineHistory(){
  var m = myMember() || (currentProfile ? (league.members || []).filter(function(x){ return normName(x.name) === normName(currentProfile.pseudo); })[0] : null);
  if(!m) return null;
  var r = computeLeague('all', 'online'), all = r.ranked.concat(r.unranked), x = all.filter(function(y){ return y.id === m.id; })[0];
  return x ? x.history.slice().sort(function(a, b){ return (a.at || 0) - (b.at || 0); }) : [];
}
function casinoRankPay(rank){ return CASINO_RANK_PAY[(Number(rank) || 0) - 1] || CASINO_GAME_BONUS; }
// cadeau ponctuel : tous ceux qui ont fini une partie de ligue en ligne pendant la fenêtre `from`..`to` reçoivent `amount` jetons + leurs points de ces parties, à réclamer avant `until`
var CASINO_GIFT = { id: 'rikiki-2026-11-01', amount: 250, from: new Date(2026, 10, 1).getTime(), to: new Date(2026, 10, 2).getTime(), until: new Date(2026, 10, 9).getTime() };
// mes parties de ligue en ligne finies entre a et b : { played: nombre, points: somme de mes points }
function myGamesBetween(a, b){
  var out = { played: 0, points: 0 }, m = myMember() || (currentProfile ? (league.members || []).filter(function(x){ return normName(x.name) === normName(currentProfile.pseudo); })[0] : null);
  if(!m) return out;
  (league.games || []).forEach(function(g){
    if(g.mode !== 'online' || !(g.at >= a && g.at < b)) return;
    var me = (g.players || []).filter(function(p){ return p.memberId === m.id; })[0];
    if(me){ out.played++; out.points += Math.max(0, Math.round(Number(me.score) || 0)); }
  });
  return out;
}
// bonus quotidien + jetons gagnés au Rikiki depuis la dernière fois (+ le cadeau ponctuel) ; la toute première fois on note juste le nombre de victoires (pas de rattrapage du passé)
async function walletWinBonus(){
  if(!currentProfile || !socialOn()) return 0;
  var total = 0, today = dayKeyNow();
  if(walletMeta.rescueDay !== today){ walletMeta = Object.assign({}, walletMeta, { rescueDay: today }); total += CASINO_DAILY; } // bonus quotidien : une fois par jour, à la première entrée à une table (le même repère sert à l'aide de faillite)
  try{ await loadLeague(true, true); }catch(e){ console.warn('ligue (jetons gagnés)', e); return total; } // 1.17.3 : on force le rechargement, sinon la ligue en mémoire ignore la partie qui vient de finir
  if(walletMeta.gift !== CASINO_GIFT.id && nowMs() < CASINO_GIFT.until){
    var gp = myGamesBetween(CASINO_GIFT.from, CASINO_GIFT.to);
    if(gp.played > 0){ walletMeta = Object.assign({}, walletMeta, { gift: CASINO_GIFT.id }); total += CASINO_GIFT.amount + gp.points; }
  }
  var hist = myOnlineHistory();
  if(hist === null) return total;
  var paid = walletMeta.gamesPaid;
  walletMeta = Object.assign({}, walletMeta, { gamesPaid: hist.length });
  if(paid === null) return total; // la toute première fois : simple repère, pas de rattrapage du passé
  return total + hist.slice(Math.min(paid, hist.length)).reduce(function(sum, h){ return sum + casinoRankPay(h.rank); }, 0);
}
async function myCasinoBank(){
  var w = await walletRead(), before = JSON.stringify(walletMeta), bonus = await walletWinBonus();
  if(w === null){ var first = Math.min(CASINO_BANK_MAX, (await casinoLeagueBank()) + bonus); await walletSave(first); return first; } // toute première fois : départ d'après la ligue (+ le bonus du jour)
  if(bonus > 0){ w += bonus; await walletSave(w); }
  else if(JSON.stringify(walletMeta) !== before) await walletSave(w); // premier repère des victoires déjà comptées
  if(w >= CASINO_BANK_MIN) return Math.min(CASINO_BANK_MAX, Math.round(w)); // je repars avec ce que j'avais
  // faillite : une petite aide par jour, ensuite juste de quoi s'asseoir (le Rikiki est ce qui fait gagner des jetons)
  var today = dayKeyNow(), help = CASINO_BANK_MIN;
  if(walletMeta.rescueDay !== today){ help = CASINO_RESCUE; walletMeta = Object.assign({}, walletMeta, { rescueDay: today }); }
  await walletSave(help);
  return help;
}
// bouton « Remettre mes jetons au départ » (⚙️ Paramètres)
async function walletReset(){ var b = await casinoLeagueBank(); await walletSave(b); return b; }

// chaque joueur annonce ses jetons de départ une seule fois par salon (le champ players[id].bank est écrit par lui-même)
var miniBankSent = '';
function miniSendBank(g){
  if(!g || g.status !== 'lobby' || !g.players || !g.players[myId] || g.players[myId].isBot || miniBankSent === g.code) return;
  miniBankSent = g.code;
  myCasinoBank().then(function(bank){
    var patch = { players: {} }; patch.players[myId] = { bank: bank };
    return claudeDb.doc('games/'+g.code).update(patch);
  }).catch(function(e){ miniBankSent = ''; console.warn('jetons de départ', e); });
}
// jetons de départ d'un joueur, lus par l'organisateur au lancement (robots, absents et valeurs bizarres : 750)
function miniStartStack(g, id){
  var p = g.players[id], b = p && !p.isBot ? Number(p.bank) : 0;
  return (b >= CASINO_BANK_MIN) ? Math.min(CASINO_BANK_MAX, Math.round(b)) : CASINO_BASE_NEW;
}
