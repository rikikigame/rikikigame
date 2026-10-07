/* ===================== v41 : relais automatique de l'hôte =====================
   L'hôte fait jouer les robots, joue pour les absents et lance les manches. S'il quitte (onglet fermé, téléphone en veille),
   la partie se bloque. Chaque joueur surveille donc la partie : si elle n'avance plus alors que c'est à l'hôte d'agir
   (tour d'un robot, entracte terminé, distribution en attente, joueur absent), un autre joueur devient l'hôte.
   Pas besoin d'écriture supplémentaire (ni de nouvelle règle Firebase) : on regarde seulement si la partie avance.
   Seul l'hôte connaît les cartes des robots et la graine de la manche en cours : le nouvel hôte redistribue donc
   la manche en cours (les scores des manches déjà jouées ne changent pas). */
var hostWatch = { key:null, since:0, busy:false, seenChange:null }, dealingSeen = { seed:null, at:0 };
function hostStallKey(g){
  var nb = 0; Object.keys(g.bids||{}).forEach(function(k){ if(g.bids[k]!=null) nb++; });
  var nd = 0; Object.keys(g.dealtRound||{}).forEach(function(k){ if(g.dealtRound[k]===g.round) nd++; });
  return [g.code, g.hostId, g.status, g.round, g.dealSeed, g.turnPlayerId, g.trickNumber||0, (g.currentTrick||[]).length, nb, nd, g.leagueRecorded?1:0].join('|');
}
// combien de temps (ms) la partie peut rester immobile avant qu'on considère l'hôte comme parti (null = normal d'attendre)
function hostStallLimit(g){
  if(g.status==='round_end') return ROUND_BREAK_MS + 8000;             // l'entracte dure 15 s, puis l'hôte distribue
  if(g.status==='dealing') return (g.dealtRound && g.dealtRound[g.hostId]===g.round) ? null : 20000; // bloqué par l'hôte lui-même seulement
  if(g.status==='bidding' || g.status==='playing'){
    var p = g.players[g.turnPlayerId];
    if(p && p.isBot) return 15000;                                        // un robot joue en ~1 s quand l'hôte est là
    var lim = turnLimitSec(g)*1000;
    if(lim && g.turnPlayerId!==myId && g.turnPlayerId!==g.hostId) return lim + 20000; // l'hôte aurait joué pour l'absent
    if(lim && g.turnPlayerId===g.hostId) return lim + 20000;                // c'est l'hôte lui-même qui ne joue plus
    return null;
  }
  if(g.status==='game_over' && g.settings && g.settings.league && !g.leagueRecorded && !onlineLeagueCheck(g)) return 25000; // partie de ligue à enregistrer
  return null;
}
function hostWatchTick(){
  var g = gameDoc;
  if(!g || !g.players || !g.playerOrder || g.hostId===myId || !g.players[myId] || g.players[myId].isBot) { hostWatch.key = null; return; }
  if(g.hostChange && g.hostChange.at && hostWatch.seenChange !== g.hostChange.at){
    if(nowMs() - g.hostChange.at < 30000) showToast((g.players[g.hostChange.to]||{name:'Un joueur'}).name+' reprend la main (l\'hôte est parti)'+(g.hostChange.redealt ? ' : la manche est redistribuée' : ''));
    hostWatch.seenChange = g.hostChange.at;
  }
  var key = hostStallKey(g);
  if(key !== hostWatch.key){ hostWatch.key = key; hostWatch.since = nowMs(); return; }
  var limit = hostStallLimit(g); if(limit==null || hostWatch.busy) return;
  // qui reprend ? les humains dans l'ordre de la table après l'hôte ; chacun attend un peu plus que le précédent
  var o = g.playerOrder, hi = o.indexOf(g.hostId), cands = [];
  for(var i=1; i<=o.length; i++){ var id = o[(Math.max(0,hi)+i)%o.length]; if(id!==g.hostId && g.players[id] && !g.players[id].isBot) cands.push(id); }
  var rank = cands.indexOf(myId); if(rank < 0) return;
  if(nowMs() - hostWatch.since < limit + rank*8000) return;
  hostWatch.busy = true;
  takeOverHost(g, key).catch(function(e){ console.error(e); }).then(function(){ hostWatch.busy = false; hostWatch.key = null; });
}
async function takeOverHost(g, key){
  var ref = claudeDb.doc('games/'+g.code);
  var fresh = (await ref.get()).data();
  if(!fresh || hostStallKey(fresh) !== key) return; // la partie a bougé entre-temps (l'hôte est revenu, ou un autre a repris)
  var mid = fresh.status==='dealing' || fresh.status==='bidding' || fresh.status==='playing';
  var hc = { hostId: myId, hostChange: { from: fresh.hostId, to: myId, at: nowMs(), redealt: mid } };
  if(ref.claim){ // v45 : un seul joueur reprend la main, même si deux le tentent au même moment
    if(!(await ref.claim(function(cur, tok){ return hostStallKey(cur)===key ? Object.assign({ claimTok:tok }, hc) : null; }))) return;
  } else await ref.update(hc);
  var g2 = Object.assign({}, fresh, { hostId: myId });
  gameDoc = Object.assign({}, gameDoc, { hostId: myId });
  hostWatch.seenChange = null;
  showToast('L\'hôte est parti : tu reprends la main'+(mid ? ', la manche est redistribuée' : ''));
  if(mid) await redealCurrentRound(g2);
  else if(fresh.status==='round_end'){ await dealNextRoundAs(myId); }
  // game_over : maybeRecordOnline s'en charge maintenant que je suis l'hôte
  onGameUpdate(); render();
}
// même manche, même donneur, nouvelles cartes (seul le nouvel hôte les connaît, comme n'importe quel hôte)
async function redealCurrentRound(g){
  var rref = claudeDb.doc('games/'+g.code), rk = 'redeal:'+g.dealSeed;
  if(rref.claim && !(await rref.claim(function(cur, tok){
    if(cur.dealSeed!==g.dealSeed || cur.hostId!==myId) return null;
    var c = cur.dealClaim; if(c && c.key===rk && nowMs() - c.at < 20000) return null;
    return { dealClaim:{ key:rk, by:myId, at:nowMs() }, claimTok:tok };
  }))) return;
  var order = g.playerOrder, n = order.length, round = g.round, handSize = g.roundPlan[round];
  var startIdx = (order.indexOf(g.dealerId)+1) % n;
  var bidOrder = order.slice(startIdx).concat(order.slice(0,startIdx));
  var dd = await dealSecretly(g, order, round, handSize, g.dealerId);
  var bids = {}, tricks = {}, dealtRound = {};
  order.forEach(function(id){ bids[id] = null; tricks[id] = 0; dealtRound[id] = g.players[id].isBot ? round : -1; });
  await claudeDb.doc('games/'+g.code).update({
    status:'dealing', dealSeed: dd.dealSeed, dealHash: dd.dealHash, blindCards: dd.blindCards,
    bidOrder: bidOrder, leadPlayerId: bidOrder[0], turnPlayerId: bidOrder[0],
    bids: bids, tricksWon: tricks, currentTrick: [], trickNumber:0, lastTrick:null,
    trumpCard: dd.trumpCard, botHands: null, dealtRound: dealtRound, played: []
  });
}

async function performBotAction(botId){
  var g = gameDoc;
  // main recalculée (donne publique − cartes jouées) : impossible qu'un bot joue avec une main périmée
  var hand = computedHand(g, botId) || [];
  if(!hand.length) return;
  if(g.status==='bidding'){
    await submitBidAs(botId, botLevelBid(botId, g, hand));
  } else if(g.status==='playing'){
    var card = botLevelCard(botId, g, hand);
    if(card) await playCardAs(botId, card, hand);
  }
}


async function startGame(){
  var g = gameDoc;
  if(!g || g.hostId !== myId) return;
  var ids = Object.keys(g.players).sort(function(a,b){ return g.players[a].joinedAt - g.players[b].joinedAt; });
  if(ids.length < MIN_PLAYERS) return;
  var allReady = ids.every(function(id){ return g.players[id].ready; });
  if(!allReady) return;
  var maxStart = Math.floor(52/ids.length);
  var startSize = (g.settings && g.settings.startSize) || maxStart;
  startSize = Math.max(1, Math.min(startSize, maxStart));
  var roundPlan = computeRoundPlan(ids.length, startSize, (g.settings && g.settings.direction) || 'up');
  // premier donneur tiré au sort (avant : toujours l'hôte, qui annonçait donc toujours en dernier)
  var di = Math.floor(Math.random()*ids.length), dealerId = ids[di];
  var bidOrder = ids.slice(di+1).concat(ids.slice(0, di+1));
  var gs = Object.assign({}, g, { settings: Object.assign({}, g.settings) });
  await claudeDb.doc('gameLogs/'+g.code).set({ rounds:{}, seeds:{} }); // nouvel historique (même code après « Rejouer »)
  var dd = await dealSecretly(gs, ids, 0, roundPlan[0], dealerId); // mains dans les cases privées
  var scores={}, bids={}, tricksWon={}, dealtRound={};
  ids.forEach(function(id){
    scores[id]=0; bids[id]=null; tricksWon[id]=0;
    if(g.players[id].isBot){ dealtRound[id]=0; }
  });
  var ref = claudeDb.doc('games/'+g.code);
  // robots « Humain » : on fige pour la partie le profil mesuré par l'analyse
  var botHuman = DEFAULT_HUMAN;
  if(botLevelOf(g)==='humain' && ids.some(function(id){ return g.players[id].isBot; })){
    try{ var ps = await claudeDb.doc('analysis/params').get(); if(ps.exists) botHuman = ps.data(); }catch(e){ console.error(e); }
  }
  await ref.update({
    settings: { botHuman: botHuman, scoring: getScoring(g) }, // v42 : barème figé au lancement (même calcul sur tous les appareils)
    status:'dealing', startedAt: nowMs(), playerOrder: ids, roundPlan: roundPlan, round:0, dealerId: dealerId, dealSeed: dd.dealSeed, dealHash: dd.dealHash, blindCards: dd.blindCards,
    bidOrder: bidOrder, leadPlayerId: bidOrder[0], turnPlayerId: bidOrder[0],
    bids: bids, tricksWon: tricksWon, currentTrick: [], trickNumber:0, lastTrick:null,
    trumpCard: dd.trumpCard, scores: scores, dealtRound: dealtRound, botHands: null, played: []
  });
}

async function updateSettings(patch){
  var g = gameDoc;
  if(!g || g.hostId !== myId) return;
  var ref = claudeDb.doc('games/'+g.code);
  await ref.update({ settings: patch });
}

async function submitBidAs(actorId, value){
  var g = gameDoc;
  if(!g || g.turnPlayerId !== actorId) return;
  var bidOrder = g.bidOrder;
  var idx = bidOrder.indexOf(actorId);
  var isLast = idx === bidOrder.length-1;
  var handSize = g.roundPlan[g.round];
  if(isLast){
    var sumOthers=0;
    bidOrder.slice(0,-1).forEach(function(id){ sumOthers += (g.bids[id]||0); });
    if(sumOthers + value === handSize) return;
  }
  if(allowedBids(g, actorId).indexOf(value) < 0) return; // règle des zéros
  var ref = claudeDb.doc('games/'+g.code);
  var patch = { bids:{} };
  patch.bids[actorId] = value;
  if(!isLast){ patch.turnPlayerId = bidOrder[idx+1]; }
  else { patch.status='playing'; patch.turnPlayerId = g.leadPlayerId; }
  await ref.update(patch);
}
function submitBid(value){ return submitBidAs(myId, value); }

async function playCardAs(actorId, card, handOverride){
  var g = gameDoc;
  if(!g || g.turnPlayerId !== actorId) return;
  var hand = handOverride || getHandCards(actorId);
  var handRound = (actorId===myId && myHand) ? myHand.round : g.round;
  var ledSuit = g.currentTrick.length>0 ? g.currentTrick[0].card.suit : null;
  var hasLed = ledSuit ? hand.some(function(c){ return c.suit===ledSuit; }) : false;
  if(ledSuit && hasLed && card.suit!==ledSuit) return;
  var newTrick = g.currentTrick.concat([{ playerId: actorId, card: card }]);
  var newHandCards = hand.filter(function(c){ return !(c.suit===card.suit && c.rank===card.rank); });
  var ref = claudeDb.doc('games/'+g.code);
  var seed = g.dealSeed, actorIsBot = !!(g.players[actorId] && g.players[actorId].isBot);
  var up = function(patch){
    if(actorIsBot && !isSecretDeal(g)){ patch.botHands = {}; patch.botHands[actorId] = newHandCards; } // anciennes parties seulement
    return ref.update(patch);
  };
  var order = g.playerOrder, n = order.length;
  if(newTrick.length < n){
    var idx = order.indexOf(actorId);
    var nextId = order[(idx+1)%n];
    await up({ currentTrick: newTrick, turnPlayerId: nextId, played: (g.played||[]).concat([card]) });
    if(!actorIsBot) await writeHandCards(actorId, handRound, newHandCards, seed);
    return;
  }
  var trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  var winnerId = trickWinner(newTrick, ledSuit || newTrick[0].card.suit, trumpSuit);
  var newTricksWon = Object.assign({}, g.tricksWon);
  newTricksWon[winnerId] = (newTricksWon[winnerId]||0) + 1;
  var newTrickNumber = g.trickNumber + 1;
  var handSize = g.roundPlan[g.round];
  if(newTrickNumber >= handSize){
    var points={}, newScores=Object.assign({}, g.scores), sc=getScoring(g);
    order.forEach(function(id){
      var bid=g.bids[id], won=newTricksWon[id]||0;
      var pts = scoreRound(sc, bid, won);
      points[id]=pts; newScores[id]=(newScores[id]||0)+pts;
    });
    var entry = { round:g.round, handSize:handSize, trump:g.trumpCard, bids:Object.assign({},g.bids), tricksWon:newTricksWon, points:points,
      bidOrder:(g.bidOrder||[]).slice(), played:(g.played||[]).concat([card]), dealId:g.dealSeed, dealHash:g.dealHash||null,
      coachIds: Object.keys(g.coachUsed||{}).filter(function(k){ return g.coachUsed[k]===g.dealSeed; }) }; // de quoi rejouer la manche (analyse)
    var isLastRound = g.round >= g.roundPlan.length-1;
    var endPatch = {
      currentTrick: newTrick, tricksWon:newTricksWon, trickNumber:newTrickNumber,
      lastTrick:{ cards:newTrick, winnerId:winnerId, at:nowMs() },
      scores:newScores, played: (g.played||[]).concat([card]),
      status: isLastRound ? 'game_over' : 'round_end'
    };
    if(isSecretDeal(g)){
      var lp = { rounds:{} }; lp.rounds[g.round] = entry;
      await mergeDoc('gameLogs/'+g.code, lp); // l'historique part AVANT l'annonce de fin de manche
    } else {
      entry.dealSeed = g.dealSeed; endPatch.roundLog = (g.roundLog||[]).concat([entry]); // partie commencée avant la v37
    }
    await up(endPatch);
    if(!actorIsBot) await writeHandCards(actorId, handRound, newHandCards, seed);
  } else {
    await up({
      currentTrick: [], tricksWon:newTricksWon, trickNumber:newTrickNumber,
      lastTrick:{ cards:newTrick, winnerId:winnerId, at:nowMs() },
      leadPlayerId: winnerId, turnPlayerId: winnerId, played: (g.played||[]).concat([card])
    });
    if(!actorIsBot) await writeHandCards(actorId, handRound, newHandCards, seed);
  }
}
function playCard(card){ return playCardAs(myId, card); }

