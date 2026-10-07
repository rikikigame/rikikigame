/* ===================== v37 : donne secrète (piste 1) + historique séparé =====================
   Avant : la graine de distribution était publique (dans la partie) → n'importe qui pouvait recalculer toutes les mains,
   et tout l'historique des manches était renvoyé à chaque carte jouée.
   Maintenant :
   - l'appareil qui distribue tire une graine SECRÈTE ; la partie ne contient que l'identifiant de la donne (dealSeed),
     l'empreinte SHA-256 de la graine (dealHash) et l'atout ;
   - chaque main part dans hands/{partie}/{compte} (lisible uniquement par ce compte, cf. règles Firebase),
     les mains des robots dans botHands/{partie}/{compte de l'hôte}, la graine dans dealerSecrets/{partie}/{compte}
     (le donneur ET l'hôte, pour que l'hôte puisse jouer à la place d'un absent) ;
   - manche à 1 carte à l'aveugle : les cartes sont publiques (blindCards), comme à table ;
   - à la fin de la manche, la graine est révélée dans gameLogs/{partie} (vérifiable avec l'empreinte), ce qui permet
     le coach de fin de manche et l'analyse ;
   - l'historique des manches vit dans gameLogs/{partie} : écrit une fois par manche, plus à chaque carte. */
var myDeal = null, botDeal = null, mySecret = null, logDoc = null, localSecrets = {}, secretUnsubs = [], revealing = {};
function myKeyId(){ return (authOn() && authUid()) ? authUid() : myId; }
function keyOfPlayer(g, id){ var p = g && g.players ? g.players[id] : null; return (p && p.uid) || id; }
function isSecretDeal(g){ return !!(g && g.dealHash); }
function secretFor(dealId){
  if(!dealId) return null;
  if(localSecrets[dealId]) return localSecrets[dealId];
  if(mySecret && mySecret.dealId===dealId) return mySecret.seed;
  if(logDoc && logDoc.seeds && logDoc.seeds[dealId]) return logDoc.seeds[dealId];
  return null;
}
// la main distribuée à ce joueur pour la donne en cours (null si cet appareil n'a pas le droit de la connaître)
function dealtFor(g, id){
  if(!g || !g.dealSeed || !g.playerOrder || g.playerOrder.indexOf(id)<0 || !g.roundPlan) return null;
  var hs = g.roundPlan[g.round]; if(!hs) return null;
  if(!isSecretDeal(g)) return dealCards(g.dealSeed, g.playerOrder, hs).hands[id] || []; // partie commencée avant la v37
  if(g.blindCards && g.blindCards[id]) return [g.blindCards[id]];
  if(id===myId && myDeal && myDeal.dealId===g.dealSeed) return myDeal.cards || [];
  if(g.players[id] && g.players[id].isBot && botDeal && botDeal.dealId===g.dealSeed && botDeal.hands) return botDeal.hands[id] || [];
  var sd = secretFor(g.dealSeed);
  if(sd) return dealCards(sd, g.playerOrder, hs).hands[id] || [];
  return null;
}
async function sha256hex(t){
  try{ var b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.prototype.map.call(new Uint8Array(b), function(x){ return ('0'+x.toString(16)).slice(-2); }).join(''); }
  catch(e){ return 'sans-empreinte'; }
}
function randTok(){
  var a = new Uint32Array(4);
  try{ crypto.getRandomValues(a); }catch(e){ for(var i=0;i<4;i++) a[i] = Math.floor(Math.random()*4294967296); }
  return Array.prototype.map.call(a, function(x){ return x.toString(36); }).join('');
}
async function dealSecretly(g, ids, roundIdx, handSize, dealerId){
  var seed = dealerId+'-'+roundIdx+'-'+randTok();
  var dealId = 'd'+roundIdx+'-'+randTok().slice(0,12);
  var res = dealCards(seed, ids, handSize);
  localSecrets[dealId] = seed;
  var code = g.code, hash = await sha256hex(seed), secret = { dealId:dealId, round:roundIdx, seed:seed };
  var jobs = [claudeDb.doc('dealerSecrets/'+code+'/'+myKeyId()).set(secret)];
  var hostKey = keyOfPlayer(g, g.hostId);
  if(hostKey !== myKeyId()) jobs.push(claudeDb.doc('dealerSecrets/'+code+'/'+hostKey).set(secret)); // l'hôte doit pouvoir jouer pour un absent
  var bots = {}, anyBot = false;
  ids.forEach(function(id){
    if(g.players[id].isBot){ bots[id] = res.hands[id]; anyBot = true; }
    else jobs.push(claudeDb.doc('hands/'+code+'/'+keyOfPlayer(g, id)).set({ dealId:dealId, round:roundIdx, cards:res.hands[id] }));
  });
  if(anyBot) jobs.push(claudeDb.doc('botHands/'+code+'/'+hostKey).set({ dealId:dealId, round:roundIdx, hands:bots }));
  await Promise.all(jobs); // les mains sont en place AVANT que la partie annonce la nouvelle donne
  var blind = handSize===1 && !(g.settings && g.settings.blindOne===false), blindCards = null;
  if(blind){ blindCards = {}; ids.forEach(function(id){ blindCards[id] = res.hands[id][0]; }); }
  return { dealSeed:dealId, dealHash:hash, trumpCard:res.trumpCard, blindCards:blindCards, botHands:null };
}
function buildRoundLog(raw){
  var rounds = logDoc && logDoc.rounds ? logDoc.rounds : null;
  if(!rounds) return (raw && Array.isArray(raw.roundLog)) ? raw.roundLog.slice() : [];
  var seeds = (logDoc && logDoc.seeds) || {};
  return Object.keys(rounds).map(Number).sort(function(a,b){ return a-b; }).map(function(k){
    var e = Object.assign({}, rounds[k]);
    if(!e.dealSeed && e.dealId && seeds[e.dealId]) e.dealSeed = seeds[e.dealId];
    return e;
  });
}
/* v45 : filet de sécurité « mes cartes ne s'affichent pas ».
   1. si ma main (ou, pour l'hôte, celle des robots) n'est pas arrivée 2 s après la donne, on va la lire directement ;
   2. si elle reste introuvable (ex. : le téléphone a changé de compte anonyme pendant la veille), on demande à l'hôte
      de la renvoyer (handReq dans la partie) : l'hôte connaît toutes les mains et la réécrit à mon nouveau nom. */
var handFetch = { key:null, since:0, busy:false, tries:0 }, handReqServed = {};
function handWatchTick(){
  var g = gameDoc;
  if(!g || !g.dealSeed || !g.players || !g.players[myId] || g.players[myId].isBot || !(g.status==='dealing' || g.status==='bidding' || g.status==='playing')){ handFetch.key = null; return; }
  var missingMe = !computedHand(g, myId);
  var missingBots = g.hostId===myId && g.playerOrder.some(function(id){ return g.players[id] && g.players[id].isBot && !computedHand(g, id); });
  if(!missingMe && !missingBots){ handFetch.key = null; return; }
  var key = g.code+'|'+g.dealSeed+'|'+missingMe+'|'+missingBots;
  if(key !== handFetch.key){ handFetch = { key:key, since:nowMs(), busy:false, tries:0 }; return; }
  if(handFetch.busy || nowMs() - handFetch.since < 2000 + handFetch.tries*2000) return;
  handFetch.busy = true; handFetch.tries++;
  fetchSecretsNow(g, handFetch.tries).catch(function(e){ console.warn('main', e); }).then(function(){ handFetch.busy = false; handFetch.since = nowMs(); });
}
async function fetchSecretsNow(g, tries){
  var code = g.code, keys = [myKeyId()], pu = g.players[myId] && g.players[myId].uid;
  if(pu && keys.indexOf(pu) < 0) keys.push(pu);
  for(var i=0; i<keys.length && !computedHand(gameDoc||g, myId); i++){
    try{ var s = await claudeDb.doc('hands/'+code+'/'+keys[i]).get(), d = s.exists ? s.data() : null; if(d && d.dealId===g.dealSeed) myDeal = d; }catch(e){}
  }
  if(g.hostId===myId){
    try{ var b = await claudeDb.doc('botHands/'+code+'/'+myKeyId()).get(); if(b.exists && b.data().dealId===g.dealSeed) botDeal = b.data(); }catch(e){}
    try{ var ds = await claudeDb.doc('dealerSecrets/'+code+'/'+myKeyId()).get(); if(ds.exists) mySecret = ds.data(); }catch(e){}
  }
  subscribeSecrets(code, true);
  if(gameDoc && gameDoc.code===code){ gameDoc = Object.assign({}, gameDoc); syncHand(); onGameUpdate(); render(); }
  // toujours rien après 2 essais : on demande à l'hôte de renvoyer ma main
  if(tries >= 2 && gameDoc && gameDoc.code===code && gameDoc.hostId!==myId && !computedHand(gameDoc, myId)){
    var p = { handReq:{} }; p.handReq[myId] = { deal: g.dealSeed, uid: myKeyId(), at: nowMs() };
    try{ await claudeDb.doc('games/'+code).update(p); }catch(e){ console.warn(e); }
  }
}
// côté hôte : renvoie la main d'un joueur qui l'a demandée (seulement pour la donne en cours)
function serveHandRequests(g){
  if(!g || g.hostId!==myId || !g.handReq || !g.dealSeed) return;
  Object.keys(g.handReq).forEach(function(id){
    var r = g.handReq[id]; if(!r || r.deal!==g.dealSeed || !r.uid || !g.players[id] || g.players[id].isBot) return;
    var k = g.dealSeed+'|'+id+'|'+r.uid+'|'+r.at; if(handReqServed[k]) return;
    var cards = dealtFor(g, id);
    if(!cards || !cards.length){ refreshHostSecret(g); return; } // je ne connais pas sa main non plus : je relis la graine
    handReqServed[k] = 1;
    claudeDb.doc('hands/'+g.code+'/'+r.uid).set({ dealId:g.dealSeed, round:g.round, cards:cards }).catch(function(e){ console.warn('renvoi de main', e); handReqServed[k] = 0; });
  });
}
// v45 : au réveil du téléphone (retour sur l'onglet), le jeton de connexion Firebase a pu expirer pendant la veille :
// Firebase coupe alors toutes les écoutes privées d'un coup (main, graine, robots). On renouvelle le jeton puis on se réabonne.
var wakeAt = 0;
function onWakeUp(){
  if(document.visibilityState && document.visibilityState!=='visible') return;
  if(!gameCode || nowMs() - wakeAt < 5000) return; wakeAt = nowMs();
  var code = gameCode;
  var renew = (fbAuth && fbAuth.currentUser) ? fbAuth.currentUser.getIdToken(true).catch(function(e){ console.warn('jeton', e); }) : Promise.resolve();
  renew.then(function(){
    if(gameCode!==code) return;
    secretsResubAt = 0; subscribeSecrets(code, true);
    if(gameDoc && gameDoc.code===code) fetchSecretsNow(gameDoc, 0).catch(function(e){ console.warn(e); });
  });
}
document.addEventListener('visibilitychange', onWakeUp);
window.addEventListener('focus', onWakeUp);
window.addEventListener('online', onWakeUp);
// l'hôte relit la graine de la donne en cours (si sa propre écoute a été coupée), au plus toutes les 3 s
var hostSecretAt = 0;
function refreshHostSecret(g){
  if(nowMs() - hostSecretAt < 3000) return; hostSecretAt = nowMs();
  claudeDb.doc('dealerSecrets/'+g.code+'/'+myKeyId()).get().then(function(s){
    if(s.exists){ mySecret = s.data(); if(gameDoc && gameDoc.code===g.code){ gameDoc = Object.assign({}, gameDoc); serveHandRequests(gameDoc); } }
  }).catch(function(e){ console.warn('graine', e); });
  subscribeSecrets(g.code, true);
}
var secretsResubAt = 0;
function subscribeSecrets(code, keep){
  if(keep){ // réabonnement après une coupure : au plus une fois toutes les 3 s, et on garde ce qu'on sait déjà
    if(nowMs() - secretsResubAt < 3000) return;
    secretsResubAt = nowMs();
  }
  secretUnsubs.forEach(function(u){ try{ u(); }catch(e){} }); secretUnsubs = [];
  if(!keep){ myDeal = null; botDeal = null; mySecret = null; logDoc = null; }
  var sub = function(path, cb){
    try{
      secretUnsubs.push(claudeDb.doc(path).onSnapshot(function(snap){
        cb(snap.exists ? snap.data() : null);
        if(gameDoc && gameDoc.code===code){ gameDoc = Object.assign({}, gameDoc, { roundLog: buildRoundLog(gameDoc) }); syncHand(); onGameUpdate(); render(); }
      }, function(err){
        // v45 : Firebase coupe définitivement une écoute refusée (réseau coupé, téléphone en veille, jeton expiré…).
        // Avant, la main n'arrivait plus jamais (« Plus de cartes. ») : on se réabonne tout seul.
        console.warn(path, err);
        setTimeout(function(){ if(gameCode===code) subscribeSecrets(code, true); }, 2000);
      }));
    }catch(e){ console.warn(e); }
  };
  sub('hands/'+code+'/'+myKeyId(), function(d){ myDeal = d; });
  sub('botHands/'+code+'/'+myKeyId(), function(d){ botDeal = d; });
  sub('dealerSecrets/'+code+'/'+myKeyId(), function(d){ mySecret = d; });
  sub('gameLogs/'+code, function(d){ logDoc = d; });
}
async function maybeRevealSeed(g){
  if(!g || !isSecretDeal(g) || (g.status!=='round_end' && g.status!=='game_over')) return;
  var dealId = g.dealSeed, seed = localSecrets[dealId] || (mySecret && mySecret.dealId===dealId ? mySecret.seed : null);
  if(!seed || revealing[dealId] || (logDoc && logDoc.seeds && logDoc.seeds[dealId])) return;
  revealing[dealId] = true;
  var p = { seeds:{} }; p.seeds[dealId] = seed;
  try{ await mergeDoc('gameLogs/'+g.code, p); }catch(e){ console.error(e); revealing[dealId] = false; }
}
// vérification : la graine révélée correspond à l'empreinte annoncée ET à la main reçue
var dealChecks = {};
function checkRevealedDeal(g, log){
  if(!log || !log.dealId || !log.dealSeed || !log.dealHash || dealChecks[log.dealId]) return dealChecks[log && log.dealId];
  dealChecks[log.dealId] = 'pending';
  sha256hex(log.dealSeed).then(function(h){ dealChecks[log.dealId] = (h===log.dealHash) ? 'ok' : 'bad'; render(); });
  return 'pending';
}

