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
// chaque victoire en ligue (partie en ligne) ajoute CASINO_WIN_BONUS jetons à l'entrée à la table suivante.
var CASINO_RESCUE = 250, CASINO_WIN_BONUS = 500;

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
var walletMeta = { rescueDay: '', winsPaid: null };
function walletMetaFrom(d){
  var m = { rescueDay: (d && typeof d.rescueDay === 'string') ? d.rescueDay : '', winsPaid: (d && typeof d.winsPaid === 'number' && isFinite(d.winsPaid)) ? d.winsPaid : null };
  return m;
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
  if(ref){ try{ var doc = { chips: chips, at: nowMs(), rescueDay: walletMeta.rescueDay, winsPaid: walletMeta.winsPaid, __plain: { pkey: currentProfile.key, chips: chips } }; await ref.set(doc); }catch(e){ console.warn('portefeuille (envoi)', e); } }
}
var walletSaved = '';
// à chaque fin de main / manche / tour, chacun enregistre SON solde (appelé toutes les secondes par miniTimerTick)
function walletTick(g){
  var st = g && (g.poker || g.bj || g.rl);
  if(!st || !st.result || !st.stacks || !st.seats || st.seats.indexOf(myId) < 0 || typeof st.stacks[myId] !== 'number') return;
  var key = g.code + '|' + st.n + '|' + st.stacks[myId];
  if(key === walletSaved) return;
  walletSaved = key; walletSave(st.stacks[myId]);
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
// victoires de ligue EN LIGNE (confirmées) de mon profil
function myOnlineWins(){
  var m = myMember() || (currentProfile ? (league.members || []).filter(function(x){ return normName(x.name) === normName(currentProfile.pseudo); })[0] : null);
  if(!m) return null;
  var r = computeLeague('all', 'online'), all = r.ranked.concat(r.unranked), x = all.filter(function(y){ return y.id === m.id; })[0];
  return x ? x.wins : 0;
}
// jetons gagnés au Rikiki depuis la dernière fois ; la toute première fois on note juste le nombre de victoires (pas de rattrapage du passé)
async function walletWinBonus(){
  if(!currentProfile || !socialOn()) return 0;
  try{ await loadLeague(false, true); }catch(e){ console.warn('ligue (jetons gagnés)', e); return 0; }
  var wins = myOnlineWins();
  if(wins === null) return 0;
  if(walletMeta.winsPaid === null){ walletMeta = { rescueDay: walletMeta.rescueDay, winsPaid: wins }; return 0; }
  if(wins <= walletMeta.winsPaid) return 0;
  var n = wins - walletMeta.winsPaid;
  walletMeta = { rescueDay: walletMeta.rescueDay, winsPaid: wins };
  return n * CASINO_WIN_BONUS;
}
async function myCasinoBank(){
  var w = await walletRead(), before = JSON.stringify(walletMeta), bonus = await walletWinBonus();
  if(bonus > 0){ w = (w === null ? 0 : w) + bonus; await walletSave(w); }
  else if(w !== null && JSON.stringify(walletMeta) !== before) await walletSave(w); // premier repère des victoires déjà comptées
  if(w !== null && w >= CASINO_BANK_MIN) return Math.min(CASINO_BANK_MAX, Math.round(w)); // je repars avec ce que j'avais
  if(w === null){ var first = await casinoLeagueBank(); await walletSave(first); return first; } // toute première fois : départ d'après la ligue
  // faillite : une petite aide par jour, ensuite juste de quoi s'asseoir (le Rikiki est ce qui fait gagner des jetons)
  var today = dayKeyNow(), help = CASINO_BANK_MIN;
  if(walletMeta.rescueDay !== today){ help = CASINO_RESCUE; walletMeta = { rescueDay: today, winsPaid: walletMeta.winsPaid }; }
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
