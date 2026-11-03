/* ===================== 1.12.0 : poker Texas Hold'em entre amis — partie, organisateur, écran =====================
   JETONS FICTIFS : aucun argent. Une partie de poker est une partie comme les autres (même salon, même code), repérée par kind:'poker'.
   - L'organisateur (hôte) est le croupier : il tire les cartes, les range (mains dans hands/{partie}/{compte}, case privée de chaque joueur,
     comme le Rikiki ; tapis et mains des robots seulement dans sa mémoire), applique chaque action et écrit l'état public « poker ».
   - Un joueur n'écrit jamais l'état : il dépose son action dans pokerAct ; le croupier la vérifie avec le moteur (23l-poker-moteur.js).
   - Si le croupier disparaît, un autre joueur reprend ; la main en cours est alors recommencée avec les jetons du début de main.
   - Aucune ligue, aucune analyse, aucune règle Firebase nouvelle. Statuts : 'lobby' → 'poker' → 'poker_end'. */
function pokerOn(g){ return !!(g && g.kind === 'poker'); }
var pokerSecret = null;                 // { code, n, board, holes } — seulement chez le croupier
var pokerBusy = false, pokerSeen = { key: '', at: 0 }, pokerRaiseState = { key: '', to: 0 };
var POKER_BOT_MS = 1300, POKER_BREAK_MS = 7000, POKER_TURN_SEC = 30, POKER_STALL_MS = 70000;
var pokerStall = { key: '', since: 0, busy: false };
/* ---------- animation des cartes (poker et blackjack) ----------
   Chaque carte reçoit une clé unique (partie | manche | endroit | carte). La première fois qu'on la voit, elle arrive en glissant (« deal ») ou se retourne (« flip ») ;
   l'écran est redessiné à chaque coup, donc tant que l'animation dure on garde la classe, avec un délai négatif pour reprendre là où elle en était. */
var miniAnimSeen = {}, miniAnimCount = 0, MINI_DEAL_MS = 520, MINI_STAGGER = 130;
function miniAnim(html, key, order, kind){
  var now = nowMs(), t0 = miniAnimSeen[key];
  if(t0 === undefined){ if(++miniAnimCount > 800){ miniAnimSeen = {}; miniAnimCount = 0; } miniAnimSeen[key] = t0 = now; }
  var delay = (order || 0) * MINI_STAGGER, elapsed = now - t0;
  if(elapsed > delay + MINI_DEAL_MS + 150) return html;
  return html.replace('<div class="', '<div style="--dl:'+(delay - elapsed)+'ms;" class="mini-'+kind+' ');
}

/* ---------- salon ---------- */
function pokerHandsTotal(g){ return casinoRoundsTotal(g); }
function pokerTurnSec(g){ return (g.settings && g.settings.turnTimer) || POKER_TURN_SEC; }

function renderCasinoLobby(g){
  var ids = Object.keys(g.players).sort(function(a, b){ return g.players[a].joinedAt - g.players[b].joinedAt; });
  var isHost = g.hostId === myId, n = ids.length, bj = bjOn(g), rl = rlOn(g), minPlayers = (bj || rl) ? 1 : MIN_PLAYERS;
  var allReady = n > 0 && ids.every(function(id){ return g.players[id].ready; });
  var html = '<div class="card-panel" style="margin-bottom:12px;">';
  html += '<div class="row between"><h2 style="font-size:24px;">'+(bj ? 'Salon blackjack <span class="quick-chip">♥ Blackjack</span>' : rl ? 'Salon roulette <span class="quick-chip">🎡 Roulette</span>' : 'Salon poker <span class="quick-chip">♠ Texas Hold\'em</span>')+'</h2><span class="badge">'+n+' / '+maxPlayersOf(g)+'</span></div>';
  html += '<p class="muted" style="font-size:13.5px; margin:4px 0 8px;">Donne le code <strong style="color:var(--navy); letter-spacing:0.1em;">'+esc(g.code)+'</strong> à tes amis. <strong>Tous les jetons sont faux</strong> : on ne joue jamais avec de l\'argent.</p>';
  html += '<div class="player-list">';
  ids.forEach(function(id){
    var p = g.players[id];
    html += '<div class="player-card"><div class="avatar" style="background:'+safeColor(p.color)+'; color:'+inkOn(safeColor(p.color))+';">'+(p.isBot?'🤖':esc(initials(p.name)))+'</div>';
    html += '<div style="flex:1; min-width:0; font-weight:700;">'+esc(p.name)+(id===myId?' <span class="muted" style="font-weight:400;">(toi)</span>':'')+(id===g.hostId?' <span class="badge" style="margin-left:4px;">Organisateur</span>':'')+'</div>'+((!p.isBot && p.bank) ? '<span class="muted" style="font-size:12.5px; margin-right:8px;">'+pokerChips(p.bank)+'</span>' : '');
    if(p.isBot){
      if(isHost) html += '<button class="btn ghost" data-action="remove-bot" data-bot="'+esc(id)+'">Retirer</button>';
      else html += '<span class="badge">Bot</span>';
    } else if(id===myId){
      html += '<button class="btn small '+(p.ready?'':'secondary ready-pulse')+'" data-action="toggle-ready">'+(p.ready?'Prêt ✓':'Je suis prêt')+'</button>';
    } else {
      html += '<span class="badge '+(p.ready?'good':'bad')+'">'+(p.ready?'Prêt':'Pas prêt')+'</span>';
    }
    html += '</div>';
  });
  html += '</div>';
  if(isHost && n < maxPlayersOf(g)) html += '<button class="btn ghost" data-action="add-bot" style="margin-top:6px; padding-left:0;">+ Ajouter un bot</button>';
  html += '</div>';
  if(!rl) html += '<div class="card-panel" style="margin-bottom:12px;">'+renderDeckChoice()+'</div>'; // la roulette n'utilise pas de cartes : pas de choix de paquet dans son salon
  var START = 'Tes jetons sont sauvegardés : tu repars avec ce que tu as gagné ou perdu (750 la première fois ; +250 de bonus chaque jour où tu te connectes avec ton profil ; une victoire de ligue au Rikiki = +500) · ', LIMIT = 'On joue tant qu\'il reste des jetons : tu t\'arrêtes quand tu veux.';
  html += '<div class="card-panel" style="margin-bottom:12px;"><div class="row between"><h2 style="font-size:20px;">Partie</h2></div>';
  html += '<div class="muted" style="font-size:13.5px; line-height:1.6;">'+(rl
      ? START+'mise minimum '+RL_MIN_BET+' · rouge, noir, numéros, douzaines…<br>Seul, ou à plusieurs · '+LIMIT
      : bj
      ? START+'mise de '+BJ_MIN_BET+' à '+BJ_MAX_BET+' · blackjack payé 3 contre 2<br>Seul contre le croupier, ou à plusieurs · '+LIMIT
      : START+'blindes '+pkBlinds(1).sb+'/'+pkBlinds(1).bb+', qui montent toutes les '+PK_HANDS_PER_LEVEL+' mains<br>Tout le monde s\'assoit avec la même somme : celle du joueur le plus pauvre de la table (maintenant '+pokerBuyIn(g, Object.keys(g.players))+' jetons ; robots compris). Le reste de tes jetons reste de côté.<br>⏱ '+pokerTurnSec(g)+' s par décision · '+LIMIT)+'</div>';
  html += '</div>';
  var ready = (g.players[myId] && g.players[myId].ready);
  if(!ready) html += '<button class="btn secondary ready-pulse" style="width:100%; margin-bottom:10px;" data-action="toggle-ready">Je suis prêt</button>';
  if(isHost){
    var canStart = n >= minPlayers && allReady;
    var label = n < minPlayers ? 'Il faut au moins 2 joueurs (ajoute un bot pour t\'entraîner)' : (!allReady ? 'Tout le monde doit être prêt' : 'Distribuer !');
    html += '<button class="btn" style="width:100%;" data-action="start-game" '+(canStart?'':'disabled')+'>'+label+'</button>';
  } else {
    html += '<p class="muted" style="font-size:14px; text-align:center;">'+(allReady ? 'L\'organisateur va lancer la partie…' : 'Clique sur « Je suis prêt » pour continuer.')+'</p>';
  }
  return html;
}

async function startPoker(){
  var g = gameDoc;
  if(!pokerOn(g) || g.hostId !== myId || g.status !== 'lobby') return;
  var ids = Object.keys(g.players).sort(function(a, b){ return g.players[a].joinedAt - g.players[b].joinedAt; });
  if(ids.length < MIN_PLAYERS || !ids.every(function(id){ return g.players[id].ready; })) return;
  var buyIn = pokerBuyIn(g, ids), stacks = {}; ids.forEach(function(id){ stacks[id] = buyIn; }); // même mise de départ pour tous : celle du joueur le plus pauvre (23s)
  var st = pkStartHand(ids, stacks, 1, pokerHandsTotal(g), ids[Math.floor(Math.random() * ids.length)]); // le donneur est le joueur qui suit un joueur tiré au sort
  if(!st) return;
  st.buyIn = buyIn;
  await pokerBeginHand(g, st, { startedAt: nowMs() });
}

/* ---------- le croupier ---------- */
async function pokerBeginHand(g, st, extra){
  pokerBusy = true;
  try{
    var seed = Math.floor(Math.random() * 4294967296);
    var sec = pkDeal(st.order, seed);
    pokerSecret = { code: g.code, n: st.n, board: sec.board, holes: sec.holes };
    var jobs = [];
    st.order.forEach(function(id){
      var p = g.players[id];
      if(!p || p.isBot) return;
      jobs.push(claudeDb.doc('hands/'+g.code+'/'+keyOfPlayer(g, id)).set({ pokerHand: st.n, cards: sec.holes[id] }));
    });
    await Promise.all(jobs);
    if(st.turn === null && !st.result) st = pkSettle(st, pokerSecret); // tous tapis dès les blindes
    await pokerWrite(g, st, extra);
  }catch(e){ console.error(e); pokerSecret = null; }
  finally{ pokerBusy = false; }
}
async function pokerWrite(g, st, extra){
  st.turnAt = nowMs();
  var over = !!(st.result && pkGameOver(st));
  var patch = Object.assign({ poker: replaceWhole(st), status: over ? 'poker_end' : 'poker', pokerAct: null }, extra || {});
  await claudeDb.doc('games/'+g.code).update(patch);
}
function pokerRestartHand(g){
  var st0 = g.poker, seats = st0.seats, i = seats.indexOf(st0.dealer);
  var prev = seats[(i - 1 + seats.length) % seats.length];
  var ro = miniRoster(g, st0, st0.startStacks, st0.buyIn), st = pkStartHand(ro.seats, ro.stacks, st0.n, st0.total, prev);
  if(st){ st.buyIn = st0.buyIn; pokerBeginHand(g, st); }
}
async function pokerFinish(g, st0){
  pokerBusy = true;
  try{ await pokerWrite(g, Object.assign({}, st0, { finish: true })); }catch(e){ console.error(e); }
  finally{ pokerBusy = false; }
}
function pokerNextHand(g){
  var st0 = g.poker;
  if(g.finishAfter){ pokerFinish(g, st0); return; }
  var ro = miniRoster(g, st0, st0.stacks, st0.buyIn), st = pkStartHand(ro.seats, ro.stacks, st0.n + 1, st0.total, st0.dealer);
  if(st){ st.buyIn = st0.buyIn; pokerBeginHand(g, st); }
}
async function pokerApply(g, id, act){
  var st = g.poker, sec = pokerSecret;
  if(!sec || sec.n !== st.n) return false;
  var next = pkAct(st, id, act, sec);
  if(!next) return false;
  pokerBusy = true;
  try{ await pokerWrite(g, next); }catch(e){ console.error(e); }
  finally{ pokerBusy = false; }
  return true;
}
// appelée toutes les 400 ms par botDriverTick
function pokerHostTick(g){
  miniStallTick(g, g.poker, 'poker');
  if(g.hostId !== myId || g.status !== 'poker' || pokerBusy || !g.poker) return;
  var st = g.poker;
  if(!st.result && (!pokerSecret || pokerSecret.code !== g.code || pokerSecret.n !== st.n)){ pokerRestartHand(g); return; } // nouveau croupier ou page rechargée
  if(st.result){
    var dk = g.code+'|'+st.n;
    if(pokerSeen.key !== dk){ pokerSeen = { key: dk, at: nowMs() }; return; }
    if(nowMs() - pokerSeen.at >= POKER_BREAK_MS) pokerNextHand(g);
    return;
  }
  var id = st.turn;
  if(!id){ pokerRestartHand(g); return; }
  var key = g.code+'|'+st.n+'|'+st.seq+'|'+id;
  if(pokerSeen.key !== key){ pokerSeen = { key: key, at: nowMs() }; return; }
  var p = g.players[id];
  if(p && p.isBot){
    if(nowMs() - pokerSeen.at < POKER_BOT_MS) return;
    var d = pkBotDecide(st, id, pokerSecret.holes[id], Math.random);
    pokerApply(g, id, d).then(function(okay){ if(!okay) pokerApply(g, id, pkOptions(st, id).canCheck ? { type: 'check' } : { type: 'fold' }); });
    return;
  }
  var a = g.pokerAct && g.pokerAct[id];
  if(a && a.n === st.n && a.seq === st.seq){
    pokerApply(g, id, { type: a.type, to: a.to }).then(function(okay){ if(!okay) pokerSeen = { key: key, at: nowMs() - 1 }; });
    return;
  }
  if(nowMs() - (st.turnAt || pokerSeen.at) > pokerTurnSec(g) * 1000 + 2000){ // trop long : on checke s'il n'y a rien à payer, sinon on se couche
    pokerApply(g, id, pkOptions(st, id).canCheck ? { type: 'check' } : { type: 'fold' });
  }
}
// le croupier est parti : rien n'a bougé depuis longtemps → un autre joueur reprend (chacun attend un peu plus que le précédent)
function miniStallTick(g, st, liveStatus){
  if(g.hostId === myId || !st || g.status !== liveStatus || !g.players[myId] || g.players[myId].isBot){ pokerStall.key = ''; return; }
  var key = g.code+'|'+st.n+'|'+st.seq+'|'+(st.result ? 'r' : 't')+'|'+g.hostId;
  if(key !== pokerStall.key){ pokerStall = { key: key, since: nowMs(), busy: false }; return; }
  if(pokerStall.busy) return;
  var seats = st.seats, hi = seats.indexOf(g.hostId), cands = [], i;
  for(i = 1; i <= seats.length; i++){ var id = seats[(Math.max(0, hi) + i) % seats.length]; if(id !== g.hostId && g.players[id] && !g.players[id].isBot) cands.push(id); }
  var rank = cands.indexOf(myId); if(rank < 0) return;
  if(nowMs() - pokerStall.since < POKER_STALL_MS + rank * 8000) return;
  pokerStall.busy = true;
  claudeDb.doc('games/'+g.code).update({ hostId: myId, hostChange: { from: g.hostId, to: myId, at: nowMs(), redealt: true } })
    .catch(function(e){ console.error(e); }).then(function(){ pokerStall = { key: '', since: 0, busy: false }; });
}

/* ---------- ce que fait le joueur ---------- */
function pokerSend(type, to){
  var g = gameDoc;
  if(!pokerOn(g) || g.status !== 'poker' || !g.poker || g.poker.turn !== myId) return;
  var st = g.poker, act = { type: type, to: to || 0 };
  if(g.hostId === myId){ pokerApply(g, myId, act); return; }
  var patch = { pokerAct: {} };
  patch.pokerAct[myId] = { n: st.n, seq: st.seq, type: type, to: to || 0, at: nowMs() };
  claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); showToast('Action non envoyée : réessaie.'); });
}
function pokerMyHole(g){
  var st = g.poker;
  if(!st || st.folded[myId] === undefined) return null;
  if(myDeal && myDeal.pokerHand === st.n && Array.isArray(myDeal.cards)) return myDeal.cards;
  return null;
}
function pokerRaiseTarget(st, o){
  var key = st.n+'|'+st.seq;
  if(pokerRaiseState.key !== key) pokerRaiseState = { key: key, to: o.minTo };
  pokerRaiseState.to = Math.max(o.minTo, Math.min(o.maxTo, pokerRaiseState.to));
  return pokerRaiseState.to;
}
function pokerRaiseSet(g, how){
  var st = g.poker, o = pkOptions(st, myId), cur = pokerRaiseTarget(st, o), t = cur;
  if(how === 'min') t = o.minTo;
  else if(how === 'half') t = st.current + Math.round(o.pot / 2);
  else if(how === 'pot') t = st.current + o.pot;
  else if(how === 'max') t = o.maxTo;
  else if(how === 'plus') t = cur + st.bb;
  else if(how === 'minus') t = cur - st.bb;
  pokerRaiseState = { key: st.n+'|'+st.seq, to: Math.max(o.minTo, Math.min(o.maxTo, t)) };
  render();
}

/* ---------- écran ---------- */
// 1.11.0 : couleur du jeton selon la somme, comme dans un vrai casino (blanc 1 · rouge 5 · bleu 10 · vert 25 · noir 100 · violet 500 · or 1000)
function chipTier(a){ a = Number(a) || 0; return a >= 1000 ? 1000 : (a >= 500 ? 500 : (a >= 100 ? 100 : (a >= 25 ? 25 : (a >= 10 ? 10 : (a >= 5 ? 5 : 1))))); }
// en haut de l'écran : les jetons qu'il me reste (visibles sans descendre jusqu'à ma plaque)
function miniHeadRight(st, label){ var v = st.stacks && st.stacks[myId]; return '<div class="pk-headr">'+(v == null ? '' : '<div class="pk-mychips" title="Tes jetons">'+pokerChips(v)+'</div>')+'<div class="pk-blinds muted">'+label+'</div></div></div>'; }
function pokerChips(n){ return '<span class="chip-ico v'+chipTier(n)+'" aria-hidden="true"></span> '+Number(n).toLocaleString('fr-FR'); }
function pokerCardsHtml(cards, w, key, kind){
  return '<div class="pk-cards" style="--cw:'+w+'px;">'+cards.map(function(c, i){
    var html = cardHtml(c); return key ? miniAnim(html, key+'|'+i+c.rank+c.suit, i, kind || 'deal') : html;
  }).join('')+'</div>';
}
function pokerBacks(w, key, seatNo){
  var back = function(i){ return miniAnim('<div class="card back"></div>', key+'|'+i, seatNo * 2 + i, 'deal'); };
  return '<div class="pk-cards" style="--cw:'+w+'px;">'+back(0)+back(1)+'</div>';
}
function pokerName(g, id){ var p = g.players[id]; return p ? p.name : '?'; }

function renderPokerSeat(g, st, id, x, y){
  var p = g.players[id]; if(!p) return '';
  var out = st.order.indexOf(id) < 0, folded = !!st.folded[id] && !out, res = st.result;
  var cls = 'pk-seat' + (st.turn === id ? ' turn' : '') + (folded ? ' fold' : '') + (out ? ' out' : '') + (id === myId ? ' me' : '');
  var tags = [];
  if(id === st.dealer) tags.push('<span class="pk-tag d">D</span>');
  if(id === st.sbId && !out) tags.push('<span class="pk-tag">PB</span>');
  if(id === st.bbId && !out) tags.push('<span class="pk-tag">GB</span>');
  if(st.allin[id] && !folded) tags.push('<span class="pk-tag a">Tapis</span>');
  if(folded) tags.push('<span class="pk-tag f">Couché</span>');
  if(out && st.stacks[id] === 0) tags.push('<span class="pk-tag f">Éliminé</span>');
  var h = '<div class="'+cls+'" data-seat="'+esc(id)+'" style="left:'+x+'%; top:'+y+'%;"><div class="avatar" style="background:'+safeColor(p.color)+'; color:'+inkOn(safeColor(p.color))+';">'+(p.isBot?'🤖':esc(initials(p.name)))+'</div>';
  h += '<div class="pk-seat-txt"><div class="pk-name">'+esc(p.name)+(id===myId?' (toi)':'')+'</div><div class="pk-stack">'+pokerChips(st.stacks[id])+'</div>';
  h += '<div class="pk-tags">'+tags.join('')+'</div></div>';
  if(res && res.won && res.won[id] > 0) h += '<div class="pk-won">+'+res.won[id]+'</div>';
  if(!out && !folded && id !== myId){
    var shown = res && res.shown && res.shown[id];
    var small = st.seats.length >= PK_COMPACT_FROM;
    h += shown ? pokerCardsHtml(shown, small ? 28 : 34, g.code+'|'+st.n+'|show|'+id, 'flip') : pokerBacks(small ? 22 : 26, g.code+'|'+st.n+'|back|'+id, Math.max(0, st.seats.indexOf(id)));
  }
  return h + '</div>';
}
// vue table : les joueurs autour d'un ovale (toi en bas, sens des aiguilles d'une montre), cartes communes et pot au centre, mise devant chaque joueur
function pokerSeatOrder(st){
  var me = st.seats.indexOf(myId); if(me < 0) me = 0;
  return st.seats.slice(me).concat(st.seats.slice(0, me));
}
// place du joueur i (0 = moi, en bas) : à 2, 3 ou 4 on aligne les adversaires en haut (sinon leurs cartes retournées recouvrent le tapis),
// au-delà on les répartit sur l'ovale, sans descendre plus bas que PK_TOP_MAX_Y pour les places du haut
var PK_TOP_MAX_Y = 24, PK_ROW_Y = 20, PK_COMPACT_FROM = 7;
function pokerSeatPos(i, n){
  if(i === 0) return { x: 50, y: n <= 4 ? 87 : 92 };
  if(n <= 4){
    var k = n - 1, xs = k === 1 ? [50] : (k === 2 ? [22, 78] : [17, 50, 83]);
    return { x: xs[i - 1], y: k === 1 ? 12 : PK_ROW_Y };
  }
  if(n >= PK_COMPACT_FROM){ // 7 et 8 joueurs : trois colonnes (gauche de bas en haut, haut, droite de haut en bas)
    var side = n === 8 ? 3 : (n - 1) / 2, ys = [74, 47, 20];
    if(i <= side) return { x: 12, y: ys[i - 1] };
    if(n === 8 && i === 4) return { x: 50, y: 12 };
    return { x: 88, y: ys[(n - 1 - i)] };
  }
  var a = (90 + i * 360 / n) * Math.PI / 180, y = 50 + 42 * Math.sin(a);
  return { x: +(50 + 44.5 * Math.cos(a)).toFixed(1), y: +(y < 50 ? Math.min(y, PK_TOP_MAX_Y) : y).toFixed(1) };
}
function pokerTableHtml(g, st){
  var seats = pokerSeatOrder(st), n = seats.length;
  var h = '<div class="pk-tv'+(n >= PK_COMPACT_FROM ? ' compact' : (n <= 4 ? ' short' : ''))+'" role="group" aria-label="Table de poker"><div class="pk-tv-oval" aria-hidden="true"></div>';
  seats.forEach(function(id, i){
    var pos = pokerSeatPos(i, n);
    h += renderPokerSeat(g, st, id, pos.x, pos.y);
    var pull = (i > 0 && n <= 4) ? 0.42 : 0.55; // la mise se pose entre le joueur et le tapis (à 2-4 joueurs, sous ses cartes)
    if(st.bets[id] > 0) h += '<div class="pk-tv-bet" style="left:'+(50 + (pos.x - 50) * pull).toFixed(1)+'%; top:'+((i === 0 && n <= 4) ? '71.5' : (50 + (pos.y - 50) * pull).toFixed(1))+'%;">'+pokerChips(st.bets[id])+'</div>';
  });
  var slots = ''; for(var k = 0; k < 5; k++) slots += st.board[k] ? miniAnim(cardHtml(st.board[k]), g.code+'|'+st.n+'|board|'+k+st.board[k].rank+st.board[k].suit, k < 3 ? k : 0, 'flip') : '<div class="card pk-empty"></div>';
  h += '<div class="pk-tv-mid"><div class="pk-board" style="--cw:'+(n >= PK_COMPACT_FROM ? 34 : (n >= 6 ? 36 : (n >= 4 ? 38 : 46)))+'px;">'+slots+'</div><div class="pk-pot">Pot : '+pokerChips(pkPot(st))+'</div></div>';
  return h + '</div>';
}
function pokerResultHtml(g, st){
  var r = st.result, lines = [];
  if(r.uncontested && r.pots.length){ // tout le monde s'est couché : un seul gagnant, une seule phrase (pas de « pot annexe »)
    var win = r.pots[0].to[0], total = r.pots.reduce(function(sum, pt){ return sum + pt.amt; }, 0);
    return '<div class="pk-result"><div><strong>'+esc(pokerName(g, win))+'</strong> ramasse '+pokerChips(total)+' : tous les autres se sont couchés.</div>'
      + (pkGameOver(st) ? '' : '<div class="muted" style="margin-top:6px;">Main suivante dans <span id="pk-next">'+Math.ceil(Math.max(0, POKER_BREAK_MS - (nowMs() - (pokerSeen.key === g.code+'|'+st.n ? pokerSeen.at : nowMs()))) / 1000)+'</span> s</div>')+'</div>';
  }
  var contested = r.pots.filter(function(pt){ return !pt.uncalled; }), k = 0;
  r.pots.forEach(function(pt){
    var who = pt.to.map(function(id){ return esc(pokerName(g, id)); }).join(' et ');
    if(pt.uncalled){ lines.push('<div><strong>'+who+'</strong> récupère '+pokerChips(pt.amt)+' : personne ne pouvait suivre cette mise.</div>'); return; }
    lines.push('<div>'+(contested.length > 1 ? (k === 0 ? 'Pot principal' : 'Pot annexe '+k)+' : ' : '')+'<strong>'+who+'</strong> '+(pt.to.length > 1 ? 'se partagent' : 'gagne')+' '+pokerChips(pt.amt)
      + (pt.name ? ' avec <strong>'+esc(pt.name)+'</strong>' : (r.uncontested ? ' (tous les autres se sont couchés)' : ''))+'</div>');
    k++;
  });
  var over = pkGameOver(st);
  var left = Math.max(0, POKER_BREAK_MS - (nowMs() - (pokerSeen.key === g.code+'|'+st.n ? pokerSeen.at : nowMs())));
  return '<div class="pk-result">'+lines.join('')+(over ? '' : '<div class="muted" style="margin-top:6px;">Main suivante dans <span id="pk-next">'+Math.ceil(left / 1000)+'</span> s</div>')+'</div>';
}
function pokerActionsHtml(g, st){
  if(st.turn !== myId){
    var who = st.turn ? pokerName(g, st.turn) : '';
    return '<div class="pk-wait muted">'+(st.stacks[myId] === 0 && st.order.indexOf(myId) < 0 ? 'Tu n\'as plus de jetons : regarde les autres, ou va te refaire contre des robots 😄' : st.folded[myId] || st.order.indexOf(myId) < 0 ? 'Tu es couché : regarde la suite.' : (st.allin[myId] ? 'Tu es tapis : on attend la fin de la main.' : 'C\'est à <strong>'+esc(who)+'</strong> de parler…'))+'</div>';
  }
  var o = pkOptions(st, myId), to = o.canRaise ? pokerRaiseTarget(st, o) : 0;
  var h = '<div class="pk-actions"><div class="pk-timer">À toi ! <span id="poker-timer" class="turn-timer"></span></div><div class="pk-btns">';
  h += '<button class="btn secondary" data-action="poker-fold">Se coucher</button>';
  h += o.canCheck ? '<button class="btn" data-action="poker-check">Check</button>'
    : '<button class="btn" data-action="poker-call">Suivre '+o.toCall+(o.toCall >= st.stacks[myId] ? ' (tapis)' : '')+'</button>';
  h += '</div>';
  if(o.canRaise){
    h += '<div class="pk-raise"><div class="pk-raise-row"><button class="btn secondary small" data-action="poker-raise-set" data-how="minus" aria-label="Moins">−</button>'
      + '<button class="btn small" data-action="poker-raise">'+(st.current > 0 ? 'Relancer à ' : 'Miser ')+to+'</button>'
      + '<button class="btn secondary small" data-action="poker-raise-set" data-how="plus" aria-label="Plus">+</button></div>'
      + '<div class="pk-raise-row">'
      + '<button class="btn ghost small" data-action="poker-raise-set" data-how="min">Min</button>'
      + '<button class="btn ghost small" data-action="poker-raise-set" data-how="half">½ pot</button>'
      + '<button class="btn ghost small" data-action="poker-raise-set" data-how="pot">Pot</button>'
      + '<button class="btn ghost small" data-action="poker-allin">Tapis ('+o.maxTo+')</button></div></div>';
  }
  return h + '</div>';
}
function pokerRanking(g, st){
  var h = '<div class="card-panel pk-final"><h2 style="font-size:24px;">Fin de partie</h2><div class="player-list">';
  pkRanking(st).forEach(function(id, i){
    var p = g.players[id]; if(!p) return;
    h += '<div class="player-card"><div style="width:26px; font-weight:800;">'+(i === 0 ? '🏆' : (i+1))+'</div><div class="avatar" style="background:'+safeColor(p.color)+'; color:'+inkOn(safeColor(p.color))+';">'+(p.isBot?'🤖':esc(initials(p.name)))+'</div>'
      + '<div style="flex:1; font-weight:700;">'+esc(p.name)+'</div><div>'+pokerChips(st.stacks[id])+'</div></div>';
  });
  return h + '</div><button class="btn" data-action="leave" style="width:100%;">Retour à l\'accueil</button></div>';
}
function renderPoker(g){
  var st = g.poker;
  if(!st) return '<div class="center-wrap"><span class="muted">Distribution…</span></div>';
  var h = '<div class="pk-head"><div><div class="eyebrow">'+miniCount('Main', st)+'</div><div class="display" style="font-size:22px;">'+({ preflop:'Avant le flop', flop:'Flop', turn:'Turn', river:'River', done:'Abattage' }[st.street] || '')+'</div></div>'
    + miniHeadRight(st, 'Blindes '+st.sb+' / '+st.bb);
  h += miniFinishHtml(g, 'cette main') + croupierFor(g) + pokerTableHtml(g, st);
  var hole = pokerMyHole(g);
  if(st.result) h += pokerResultHtml(g, st);
  if(hole && !st.folded[myId]){
    var best = st.board.length >= 3 ? pkBest(hole.concat(st.board)) : null;
    h += '<div class="pk-mine"><div class="eyebrow">Tes cartes'+(best ? ' · '+esc(pkHandName(best)) : '')+'</div>'+pokerCardsHtml(hole, 84, g.code+'|'+st.n+'|hole', 'deal')+'</div>';
  } else if(hole){
    h += '<div class="pk-mine fold"><div class="eyebrow">Tes cartes (couchées)</div>'+pokerCardsHtml(hole, 60, g.code+'|'+st.n+'|hole', 'deal')+'</div>';
  }
  if(g.status === 'poker_end') h += pokerRanking(g, st);
  else if(!st.result) h += pokerActionsHtml(g, st);
  return h;
}
function pokerTimerTick(g){
  if(!g || !g.poker) return;
  var st = g.poker, el = document.getElementById('poker-timer');
  if(el && st.turn === myId){
    var left = Math.max(0, pokerTurnSec(g) - Math.floor((nowMs() - (st.turnAt || nowMs())) / 1000));
    el.textContent = '⏱ '+left+' s'; el.className = 'turn-timer'+(left <= 8 ? ' hot' : '');
  }
  var nx = document.getElementById('pk-next');
  if(nx && pokerSeen.key === g.code+'|'+st.n) nx.textContent = Math.max(0, Math.ceil((POKER_BREAK_MS - (nowMs() - pokerSeen.at)) / 1000));
}
function renderPokerRules(){
  var rows = [['Quinte flush', 'cinq cartes qui se suivent, de la même couleur'], ['Carré', 'quatre cartes identiques'], ['Full', 'un brelan + une paire'], ['Couleur', 'cinq cartes de la même couleur'],
    ['Quinte', 'cinq cartes qui se suivent'], ['Brelan', 'trois cartes identiques'], ['Double paire', 'deux paires'], ['Paire', 'deux cartes identiques'], ['Carte haute', 'rien de tout ça : la plus haute carte']];
  return '<div class="modal-backdrop" data-action="toggle-rules"><div class="card-panel modal">'
    + '<button class="btn secondary small close-x" data-action="toggle-rules">Fermer</button>'
    + '<h3>Poker Texas Hold\'em</h3>'
    + '<p>Chacun reçoit <strong>2 cartes privées</strong>. 5 cartes communes sont dévoilées au centre (3, puis 1, puis 1). Ta main = les 5 meilleures cartes parmi tes 2 et les 5 du centre.</p>'
    + '<p>À ton tour : <strong>se coucher</strong>, <strong>check</strong> (ne rien payer, si personne n\'a misé), <strong>suivre</strong> (payer la mise) ou <strong>relancer</strong>. <strong>Tapis</strong> : tout miser.</p>'
    + '<p>Les <strong>blindes</strong> (PB = petite, GB = grosse) sont des mises forcées. Le <strong>D</strong> marque le donneur. Les blindes montent toutes les '+PK_HANDS_PER_LEVEL+' mains.</p>'
    + '<div class="eyebrow">Du plus fort au plus faible</div><ol style="margin:6px 0 10px 20px; line-height:1.6;">'+rows.map(function(r){ return '<li><strong>'+r[0]+'</strong> : '+r[1]+'</li>'; }).join('')+'</ol>'
    + '<p class="muted">Tous les jetons sont faux : on ne joue jamais avec de l\'argent. On joue tant qu\'il reste des jetons : le gagnant est celui qui a le plus de jetons à la fin.</p></div></div>';
}
function pokerHelpLines(g){
  var st = g.poker;
  if(g.status === 'lobby') return ['Touche « Je suis prêt » quand tu veux.', 'Quand tout le monde est prêt, l\'organisateur lance la partie.', 'Tu peux ajouter des robots pour t\'entraîner.'];
  if(!st) return ['Les cartes arrivent : un instant.'];
  if(g.status === 'poker_end') return ['La partie est finie : le classement est affiché.'];
  if(st.result) return ['La main est finie. La suivante démarre toute seule.'];
  if(st.turn === myId) return ['C\'est à toi de parler.', 'Check : tu ne paies rien. Suivre : tu paies la mise. Relancer : tu montes la mise. Se coucher : tu abandonnes cette main.', 'Si tu ne fais rien, ça check tout seul (ou tu te couches s\'il y a une mise).'];
  return ['Ce n\'est pas ton tour : regarde la table.'];
}
