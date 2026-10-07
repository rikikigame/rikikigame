/* ===================== game actions ===================== */
async function createGame(name, mode){
  if(busy) return; busy=true;
  try{ await createGameInner(name, mode); }
  catch(e){ console.error(e); errorMsg = dbErrorText(e); screen='entry'; render(); }
  finally{ busy=false; }
}
async function createGameInner(name, mode){
  name = (name||'').trim().slice(0,24) || 'Joueur';
  errorMsg='';
  if(usingFirebase){ try{ localStorage.setItem('rikiki_fb_name', name); }catch(e){} }
  var code, ref, snap;
  for(var i=0;i<8;i++){
    code = genCode();
    ref = claudeDb.doc('games/'+code);
    snap = await ref.get();
    if(!snap.exists) break;
  }
  var now = nowMs();
  var players = {}; players[myId] = { name:name, color:myProfile.color, joinedAt:now, ready:false };
  await ref.set({
    code: code, createdAt: now, hostId: myId, status:'lobby',
    settings: { direction: mode==='quick' ? 'quick' : 'up', startSize: null, blindOne: true, league: true }, // v58 : ligue cochée d'office
    players: players
  });
  gameCode = code;
  persistLocal();
  subscribeGame(code);
}

async function joinGame(codeRaw, name){
  if(busy) return; busy=true;
  try{ await joinGameInner(codeRaw, name); }
  catch(e){ console.error(e); errorMsg = dbErrorText(e); screen='entry'; render(); }
  finally{ busy=false; }
}
async function joinGameInner(codeRaw, name){
  var code = (codeRaw||'').trim().toUpperCase();
  errorMsg='';
  if(!code){ errorMsg='Entre un code de partie.'; render(); return; }
  var ref = claudeDb.doc('games/'+code);
  var snap;
  try{ snap = await ref.get(); }catch(e){ errorMsg="Impossible de charger cette partie."; render(); return; }
  if(!snap.exists){ errorMsg="Cette partie n'existe pas."; render(); return; }
  var data = snap.data();
  if(data.players && data.players[myId]){ gameCode=code; persistLocal(); subscribeGame(code); return; }
  if(data.status !== 'lobby'){ errorMsg='Cette partie a déjà commencé.'; render(); return; }
  if(Object.keys(data.players||{}).length >= MAX_PLAYERS){ errorMsg='Cette partie est complète.'; render(); return; }
  name = (name||'').trim().slice(0,24) || 'Joueur';
  if(usingFirebase){ try{ localStorage.setItem('rikiki_fb_name', name); }catch(e){} }
  var patch = { players:{} };
  patch.players[myId] = { name:name, color:myProfile.color, joinedAt:nowMs(), ready:false };
  await ref.update(patch);
  gameCode = code;
  persistLocal();
  subscribeGame(code);
}

function leaveToEntry(){
  fatalError=null;
  unsubscribeChat();
  if(gameUnsub){ gameUnsub(); gameUnsub=null; }
  if(handUnsub){ handUnsub(); handUnsub=null; }
  gameDoc=null; myHand=null; myHandRaw=null; gameCode=null; processedDealRound=-1;
  clearLocal();
  screen='entry';
  render();
}

var versionSent = false;
function subscribeGame(code){
  versionSent = false;
  screen='loading'; render();
  armWatchdog();
  if(gameUnsub){ gameUnsub(); gameUnsub=null; }
  if(handUnsub){ handUnsub(); handUnsub=null; }
  var ref = claudeDb.doc('games/'+code);
  subscribeChat(code);
  gameUnsub = ref.onSnapshot(function(snap){
    clearTimeout(loadWatchdog);
    subscribeGame.retries = 0;
    try{
      if(!snap.exists){ clearLocal(); gameDoc=null; screen='entry'; errorMsg='Cette partie a été fermée.'; render(); return; }
      gameDoc = Object.assign({}, snap.data(), { code: code }); // snap.data() est gelé : ne jamais le muter
      gameDoc.roundLog = buildRoundLog(snap.data());
      if(!gameDoc.players || !gameDoc.players[myId]){
        screen='entry'; errorMsg="Tu ne fais plus partie de cette partie."; clearLocal(); render(); return;
      }
      screen='game';
      if((gameDoc.players[myId].v !== APP_VERSION || gameDoc.players[myId].uid !== myKeyId()) && !versionSent){
        versionSent = true; var vp = { players:{} }; vp.players[myId] = { v: APP_VERSION, uid: myKeyId() };
        claudeDb.doc('games/'+code).update(vp).catch(function(e){ console.error(e); });
      }
      syncHand();
      onGameUpdate();
      render();
    }catch(e){
      console.error(e);
      clearLocal();
      fatalError = "Cette partie utilise un format incompatible avec la version actuelle. Reviens à l'accueil et recrée une partie.";
      render();
    }
  }, function(err){
    console.error(err);
    clearTimeout(loadWatchdog);
    // v45 : écoute coupée (souvent jeton expiré pendant la veille) → on renouvelle le jeton et on se réabonne (2 essais)
    if((subscribeGame.retries = (subscribeGame.retries||0) + 1) <= 2){
      var renew = (fbAuth && fbAuth.currentUser) ? fbAuth.currentUser.getIdToken(true).catch(function(){}) : Promise.resolve();
      renew.then(function(){ setTimeout(function(){ if(gameCode===code) subscribeGame(code); }, 1500); });
      return;
    }
    fatalError = "Impossible de synchroniser la partie (" + (err&&err.code||'erreur') + "). Vérifie ta connexion et réessaie.";
    render();
  });
  subscribeSecrets(code); // ma main privée, celles des robots (hôte), la graine si je distribue, l'historique
}

// Le doc "main" est privé et persiste d'une partie à l'autre : on ne le prend en compte
// que s'il correspond à la donne en cours (même dealSeed), sinon c'est une main périmée.
// La main d'un joueur se déduit de la donne (graine publique) moins les cartes déjà jouées dans la manche.
// Plus fiable que le document privé, qui pouvait se retrouver vide ou périmé entre deux manches.
function computedHand(g, id){
  if(!g || !g.dealSeed || !Array.isArray(g.played) || !g.playerOrder || g.playerOrder.indexOf(id)<0 || !g.roundPlan) return null;
  var hs = g.roundPlan[g.round]; if(!hs) return null;
  var gone = {}; g.played.forEach(function(c){ gone[c.suit+c.rank] = 1; });
  var dealt = dealtFor(g, id); if(!dealt) return null; // main inconnue de cet appareil (donne secrète)
  return dealt.filter(function(c){ return !gone[c.suit+c.rank]; });
}
function syncHand(){
  var g = gameDoc;
  var calc = (g && (g.status==='dealing' || g.status==='bidding' || g.status==='playing')) ? computedHand(g, myId) : null;
  if(calc){ myHand = { round:g.round, cards:calc, dealSeed:g.dealSeed }; return; }
  myHand = (myHandRaw && g && myHandRaw.dealSeed && myHandRaw.dealSeed === g.dealSeed) ? myHandRaw : null;
}
function onGameUpdate(){
  if(!gameDoc) return;
  try{ sfxOnGame(gameDoc); }catch(e){ console.warn('bruitages', e); } // v50
  witnessGame(gameDoc);
  try{ maybeAttest(gameDoc); }catch(e){ console.warn(e); } // v43 : confirmation de ligue
  try{ serveHandRequests(gameDoc); }catch(e){ console.warn(e); } // v45 : l'hôte renvoie une main demandée
  if(gameDoc.status === 'dealing'){
    handleDealing();
    // filet de sécurité : dès que quelqu'un voit que tout le monde est servi, on passe aux annonces
    var gd = gameDoc;
    if(gd.playerOrder && gd.playerOrder.every(function(id){ return gd.dealtRound && gd.dealtRound[id]===gd.round; })){
      claudeDb.doc('games/'+gd.code).update({ status:'bidding' }).catch(function(e){ console.error(e); });
    }
  }
  if(gameDoc.status === 'round_end' || gameDoc.status === 'game_over') maybeRevealSeed(gameDoc);
  if(gameDoc.status === 'game_over'){ maybeRecordOnline(gameDoc); maybeRecordAnalysis(gameDoc); }
}

async function handleDealing(){
  var g = gameDoc;
  var round = g.round;
  if(processedDealRound === g.dealSeed) return;
  if(!computedHand(g, myId)) return; // ma main privée n'est pas encore arrivée : on réessaie à la prochaine mise à jour
  processedDealRound = g.dealSeed;
  var alreadyMarked = g.dealtRound && g.dealtRound[myId] === round;
  if(alreadyMarked) return;
  var ref = claudeDb.doc('games/'+g.code);
  var patch = { dealtRound:{} };
  patch.dealtRound[myId] = round;
  await ref.update(patch);
  try{
    // écritures simultanées : on vérifie que notre marque est bien là, sinon on la réécrit
    var fresh, f;
    for(var attempt=0; attempt<5; attempt++){
      fresh = await ref.get(); f = fresh.data();
      if(!f || f.status!=='dealing' || f.round!==round || (f.dealtRound && f.dealtRound[myId]===round)) break;
      await new Promise(function(r){ setTimeout(r, 150 + Math.random()*350); });
      await ref.update(patch);
    }
    if(f && f.status==='dealing' && f.round===round){
      var allDealt = f.playerOrder.every(function(id){ return f.dealtRound && f.dealtRound[id]===round; });
      if(allDealt){ await ref.update({ status:'bidding' }); }
    }
  }catch(e){ console.error(e); }
}

async function toggleReady(){
  var g = gameDoc;
  if(!g || !g.players[myId]) return;
  var ref = claudeDb.doc('games/'+g.code);
  var patch = { players:{} };
  patch.players[myId] = { ready: !g.players[myId].ready };
  await ref.update(patch);
}

async function addBot(){
  var g = gameDoc;
  if(!g || g.hostId !== myId || g.status!=='lobby') return;
  var ids = Object.keys(g.players);
  if(ids.length >= MAX_PLAYERS) return;
  var usedNames = ids.map(function(id){ return g.players[id].name; });
  var name = BOT_NAMES.filter(function(n){ return usedNames.indexOf(n)===-1; })[0] || ('Robot '+Math.random().toString(36).slice(2,5));
  var color = BOT_COLORS[ids.length % BOT_COLORS.length];
  var botId = 'bot-' + Math.random().toString(36).slice(2,8);
  var ref = claudeDb.doc('games/'+g.code);
  var patch = { players:{} };
  patch.players[botId] = { name:name, color:color, joinedAt:nowMs(), ready:true, isBot:true };
  await ref.update(patch);
}

async function removeBot(botId){
  var g = gameDoc;
  if(!g || g.hostId !== myId || g.status!=='lobby') return;
  if(!g.players[botId] || !g.players[botId].isBot) return;
  var ref = claudeDb.doc('games/'+g.code);
  var snap = await ref.get();
  var data = JSON.parse(JSON.stringify(snap.data())); // copie modifiable (snapshot gelé)
  delete data.players[botId];
  await ref.set(data);
}

function getHandCards(actorId){
  if(actorId===myId) return myHand ? myHand.cards : [];
  return computedHand(gameDoc, actorId) || [];
}
async function writeHandCards(actorId, round, cards, seed){
  if(isSecretDeal(gameDoc)) return; // v37 : la main courante = main distribuée − cartes jouées, rien à écrire
  var ap = gameDoc && gameDoc.players ? gameDoc.players[actorId] : null;
  if(actorId===myId || (ap && !ap.isBot)){
    var handRef = claudeDb.doc('data/users/'+actorId+'/hand');
    // la graine de la manche où le coup a été joué : une écriture en retard ne peut plus écraser la main de la manche suivante
    await handRef.set({ round: round, cards: cards, dealSeed: seed || gameDoc.dealSeed });
  } else {
    var ref = claudeDb.doc('games/'+gameDoc.code);
    var patch = { botHands:{} };
    patch.botHands[actorId] = cards;
    await ref.update(patch);
  }
}

function botDriverTick(){
  var g = gameDoc;
  hostWatchTick(); // v41 : si l'hôte est parti, un autre joueur reprend la main
  if(!g || g.hostId !== myId){ lastBotTurnKey=null; return; }
  if(g.status==='dealing'){
    // v41 : un joueur absent ne confirme jamais « servi » → au bout de 10 s l'hôte passe aux annonces
    // (l'absent a quand même sa main ; l'hôte jouera pour lui à la fin de son temps)
    if(dealingSeen.seed !== g.dealSeed){ dealingSeen = { seed:g.dealSeed, at:nowMs() }; return; }
    if(nowMs() - dealingSeen.at < 10000 || botActing) return;
    botActing = true;
    var dr = {}; g.playerOrder.forEach(function(id){ dr[id] = g.round; });
    claudeDb.doc('games/'+g.code).get().then(function(s){
      var f = s.data(); if(!f || f.status!=='dealing' || f.dealSeed!==g.dealSeed) return;
      return claudeDb.doc('games/'+g.code).update({ dealtRound: dr, status:'bidding' });
    }).catch(function(e){ console.error(e); }).then(function(){ botActing = false; });
    return;
  }
  if(g.status==='round_end'){
    // entracte : l'hôte relance automatiquement la manche suivante après 15 s
    if(roundBreakLeft(g) > 0 || botActing) return;
    botActing = true;
    dealNextRoundAs(null).catch(function(e){ console.error(e); }).then(function(){ botActing = false; });
    return;
  }
  if(g.status!=='bidding' && g.status!=='playing'){ lastBotTurnKey=null; return; }
  var turnId = g.turnPlayerId;
  if(!turnId || !g.players[turnId] || !g.players[turnId].isBot){ lastBotTurnKey=null; return; }
  var key = g.status+'|'+g.round+'|'+turnId+'|'+(g.currentTrick?g.currentTrick.length:0)+'|'+Object.keys(g.bids||{}).length;
  if(key !== lastBotTurnKey){ lastBotTurnKey = key; lastBotTurnAt = nowMs(); return; }
  if(botActing) return;
  if(nowMs()-lastBotTurnAt < 1150) return; // laisse le temps de voir chaque carte arriver
  botActing = true;
  performBotAction(turnId).catch(function(e){ console.error(e); }).then(function(){ botActing = false; });
}

