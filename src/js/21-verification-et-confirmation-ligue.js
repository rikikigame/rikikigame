/* ===================== v41 : vérification croisée des scores =====================
   Sans serveur, n'importe quel appareil peut écrire dans la partie : un joueur doué pourrait modifier les scores.
   Chaque téléphone vérifie donc tout seul :
   - il rejoue chaque manche à partir de la graine révélée (contrôlée avec l'empreinte annoncée AVANT la manche) :
     chaque carte jouée était bien dans la main du joueur, il a suivi la couleur, les plis et les points sont justes ;
   - il compare avec ce qu'il a VU en direct (annonces, plis) : réécrire l'historique après coup se voit ;
   - le total doit être égal à la somme des manches, et le barème ne doit pas changer en cours de partie.
   Si quelque chose cloche, tout le monde voit l'alerte, et la ligue n'enregistre que des scores recalculés et vérifiés. */
var witnessed = { tricks:{}, bids:{}, scoring:{} };
function witnessGame(g){
  if(!g || !g.dealSeed || !g.playerOrder) return;
  var n = g.playerOrder.length, gid = g.code+'|'+(g.startedAt||g.createdAt);
  if(g.status!=='lobby' && g.settings && !witnessed.scoring[gid]) witnessed.scoring[gid] = JSON.stringify(getScoring(g));
  if(g.status==='playing' && g.bids && !witnessed.bids[g.dealSeed] && g.playerOrder.every(function(id){ return g.bids[id]!=null; })){
    witnessed.bids[g.dealSeed] = JSON.stringify(g.playerOrder.map(function(id){ return g.bids[id]; }));
  }
  var lt = g.lastTrick;
  if(lt && lt.cards && lt.cards.length===n && (g.status==='playing' || g.status==='round_end' || g.status==='game_over')){
    var w = witnessed.tricks[g.dealSeed] || (witnessed.tricks[g.dealSeed] = {});
    w[lt.cards.map(function(p){ return p.playerId+':'+cardKey(p.card); }).join(',')] = 1;
  }
}
// rejoue une manche de l'historique ; renvoie la liste des problèmes (vide = tout est juste)
function auditRound(g, e, sc){
  var issues = [], order = g.playerOrder, H = e.handSize, label = 'Manche '+(e.round+1)+' : ';
  if(!e.dealSeed) return { issues:[], unverified:true };
  if(!Array.isArray(e.played) || e.played.length !== H*order.length || !Array.isArray(e.bidOrder) || !e.bidOrder.length) return { issues:[label+'historique incomplet'] };
  var hands = dealCards(e.dealSeed, order, H).hands, rem = {}, won = {};
  order.forEach(function(id){ rem[id] = hands[id].slice(); won[id] = 0; });
  var trumpSuit = e.trump ? e.trump.suit : null, real = dealCards(e.dealSeed, order, H).trumpCard;
  if((real ? cardKey(real) : null) !== (e.trump ? cardKey(e.trump) : null)) issues.push(label+'l\'atout ne correspond pas à la donne');
  var lead = e.bidOrder[0], k = 0, seenTricks = {};
  for(var t=0; t<H && !issues.length; t++){
    var i0 = order.indexOf(lead), trick = [];
    for(var q=0; q<order.length; q++){
      var id = order[(i0+q)%order.length], c = e.played[k++], hand = rem[id];
      var idx = hand.findIndex(function(x){ return c && x.suit===c.suit && x.rank===c.rank; });
      if(idx < 0){ issues.push(label+(g.players[id]||{name:'?'}).name+' a joué une carte qu\'il n\'avait pas'); break; }
      var led = trick.length ? trick[0].card.suit : null;
      if(led && c.suit!==led && hand.some(function(x){ return x.suit===led; })){ issues.push(label+(g.players[id]||{name:'?'}).name+' n\'a pas suivi la couleur'); break; }
      hand.splice(idx, 1); trick.push({ playerId:id, card:c });
    }
    if(issues.length) break;
    seenTricks[trick.map(function(p){ return p.playerId+':'+cardKey(p.card); }).join(',')] = 1;
    lead = trickWinner(trick, trick[0].card.suit, trumpSuit); won[lead]++;
  }
  if(issues.length) return { issues:issues };
  var pts = {};
  order.forEach(function(id){
    if((e.tricksWon||{})[id] !== won[id]) issues.push(label+'plis de '+(g.players[id]||{name:'?'}).name+' faux ('+(e.tricksWon||{})[id]+' au lieu de '+won[id]+')');
    pts[id] = scoreRound(sc, e.bids[id], won[id]);
    if((e.points||{})[id] !== pts[id]) issues.push(label+'points de '+(g.players[id]||{name:'?'}).name+' faux');
  });
  // ce que j'ai vu en direct doit se retrouver dans l'historique
  var wb = witnessed.bids[e.dealId];
  if(wb && wb !== JSON.stringify(order.map(function(id){ return e.bids[id]; }))) issues.push(label+'les annonces ont été modifiées après coup');
  var wt = witnessed.tricks[e.dealId];
  if(wt && Object.keys(wt).some(function(key){ return !seenTricks[key]; })) issues.push(label+'les plis ne correspondent pas à ce qui a été joué');
  return { issues:issues, points:pts };
}
// bilan de toute la partie : { state:'ok'|'bad'|'partial', issues, scores recalculés }
function auditGame(g){
  var out = { state:'ok', issues:[], scores:{} };
  if(!g || !g.playerOrder) return out;
  var sc = getScoring(g), log = g.roundLog || [], unverified = 0, gid = g.code+'|'+(g.startedAt||g.createdAt);
  g.playerOrder.forEach(function(id){ out.scores[id] = 0; });
  if(witnessed.scoring[gid] && witnessed.scoring[gid] !== JSON.stringify(sc)) out.issues.push('le barème a été modifié en cours de partie');
  log.forEach(function(e){
    var r = auditRound(g, e, sc);
    if(r.unverified){ unverified++; g.playerOrder.forEach(function(id){ out.scores[id] += scoreRound(sc, e.bids[id], (e.tricksWon||{})[id]||0); }); return; }
    out.issues = out.issues.concat(r.issues);
    if(r.points) g.playerOrder.forEach(function(id){ out.scores[id] += r.points[id]; });
    if(e.dealHash && e.dealId && dealChecks[e.dealId]==='bad') out.issues.push('Manche '+(e.round+1)+' : la graine révélée ne correspond pas à l\'empreinte');
    else if(e.dealHash && e.dealId) checkRevealedDeal(g, e); // lance la vérification de l'empreinte (asynchrone)
  });
  var complete = log.length && log[log.length-1].round === g.round && (g.status==='round_end' || g.status==='game_over');
  if(complete) g.playerOrder.forEach(function(id){
    if((g.scores[id]||0) !== out.scores[id]) out.issues.push('score affiché de '+(g.players[id]||{name:'?'}).name+' : '+(g.scores[id]||0)+' au lieu de '+out.scores[id]);
  });
  out.state = out.issues.length ? 'bad' : (unverified || !complete ? 'partial' : 'ok');
  return out;
}
// version complète (attend les empreintes) : utilisée avant d'enregistrer dans la ligue
async function auditGameFull(g){
  var log = g.roundLog || [];
  for(var i=0; i<log.length; i++){
    var e = log[i];
    if(e.dealHash && e.dealId && e.dealSeed && !dealChecks[e.dealId]) dealChecks[e.dealId] = (await sha256hex(e.dealSeed))===e.dealHash ? 'ok' : 'bad';
  }
  return auditGame(g);
}
/* ===================== v43 : confirmation des parties de ligue en ligne =====================
   Avant, l'hôte écrivait seul le résultat dans la ligue : un joueur doué pouvait y inscrire une fausse partie.
   Maintenant chaque téléphone de joueur, après avoir revérifié toute la partie (auditGame), dépose tout seul une
   confirmation à SON nom : leagueAttest/{partie}__{compte} (les règles Firebase interdisent d'écrire au nom d'un autre
   et de modifier une confirmation). Une partie de ligue en ligne compte quand la MAJORITÉ des joueurs l'a confirmée.
   Filets de sécurité si quelqu'un ferme l'appli trop tôt :
   1. confirmation immédiate dès la fin de la partie (pendant l'affichage du classement) ;
   2. rattrapage : la partie est notée sur le téléphone dès son lancement ; à la prochaine ouverture du jeu,
      le téléphone relit la partie terminée, la revérifie et confirme ;
   3. majorité seulement (2 sur 3, 3 sur 4 ou 5…) ;
   4. l'organisateur peut valider à la main une partie restée en attente (leagueValid/{partie}).
   Les parties enregistrées avant ATTEST_FROM (et les vraies cartes) comptent comme avant. */
var ATTEST_FROM = Date.UTC(2026, 9, 1); // 1er octobre 2026
var attestDone = {}, attestBusy = {};
function leagueGameId(g){ return 'o_'+g.code+'_'+(g.startedAt||g.createdAt); }
function resultDigest(pairs){ // [[compte, score]] → texte comparable, indépendant de l'ordre
  return pairs.map(function(p){ return String(p[0])+':'+Number(p[1]); }).sort().join('|');
}
function attestTodos(){ try{ return JSON.parse(localStorage.getItem('rikiki_attest_todo_'+myId)||'{}') || {}; }catch(e){ return {}; } }
function saveAttestTodos(t){ try{ localStorage.setItem('rikiki_attest_todo_'+myId, JSON.stringify(t)); }catch(e){} }
function iPlayLeague(g){
  return !!(g && g.settings && g.settings.league && g.players && g.players[myId] && !g.players[myId].isBot && g.status!=='lobby' && !onlineLeagueCheck(g));
}
// noté dès le lancement : si je quitte avant la fin, je confirmerai à la prochaine ouverture
function rememberLeagueGame(g){
  if(!iPlayLeague(g) || g.status==='game_over') return;
  var gid = leagueGameId(g), t = attestTodos(); if(t[gid]) return;
  t[gid] = { code:g.code, startedAt:g.startedAt||g.createdAt, at:nowMs() }; saveAttestTodos(t);
}
async function attestResult(g){
  var gid = leagueGameId(g);
  if(attestDone[gid] || attestBusy[gid]) return attestDone[gid] || 'busy';
  attestBusy[gid] = true;
  try{
    var audit = await auditGameFull(g);
    if(audit.state==='bad'){ attestDone[gid] = 'bad'; return 'bad'; } // jamais de confirmation pour une partie suspecte
    if(audit.state!=='ok') return 'wait';                               // graines pas encore révélées : on réessaiera
    var digest = resultDigest(g.playerOrder.map(function(id){ return [keyOfPlayer(g, id), audit.scores[id]||0]; }));
    try{ await claudeDb.doc('leagueAttest/'+gid+'__'+myKeyId()).set({ gid:gid, digest:digest, at:nowMs() }); }
    catch(e){ // déjà confirmé (les règles refusent de réécrire) : c'est bon aussi
      var ex = await claudeDb.doc('leagueAttest/'+gid+'__'+myKeyId()).get().catch(function(){ return null; });
      if(!(ex && ex.exists)) throw e;
    }
    attestDone[gid] = 'ok';
    var t = attestTodos(); delete t[gid]; saveAttestTodos(t);
    return 'ok';
  }catch(e){ console.warn('confirmation de ligue', e); return 'wait'; }
  finally{ attestBusy[gid] = false; }
}
// appelée en continu pendant la partie : note la partie, puis confirme dès que c'est possible
function maybeAttest(g){
  if(!iPlayLeague(g)) return;
  rememberLeagueGame(g);
  if(g.status==='game_over') attestResult(g);
}
// rattrapage au démarrage : parties de ligue que j'ai quittées avant la fin
async function processAttestTodos(){
  var t = attestTodos(), ids = Object.keys(t); if(!ids.length || !claudeDb) return;
  for(var i=0; i<ids.length; i++){
    var gid = ids[i], it = t[gid];
    try{
      if(nowMs() - it.at > 14*86400000){ delete t[gid]; continue; } // trop vieux : l'organisateur validera
      var gs = await claudeDb.doc('games/'+it.code).get(), gd = gs.exists ? gs.data() : null;
      if(!gd || (gd.startedAt||gd.createdAt) !== it.startedAt){ delete t[gid]; continue; } // partie remplacée par « Rejouer »
      if(gd.status!=='game_over') continue;                                                  // pas encore finie : on garde
      var ls = await claudeDb.doc('gameLogs/'+it.code).get(), ld = ls.exists ? ls.data() : null;
      var rounds = (ld && ld.rounds) || {}, seeds = (ld && ld.seeds) || {};
      var log = Object.keys(rounds).map(Number).sort(function(a,b){ return a-b; }).map(function(k){
        var e = Object.assign({}, rounds[k]); if(!e.dealSeed && e.dealId && seeds[e.dealId]) e.dealSeed = seeds[e.dealId]; return e; });
      if(!log.length && Array.isArray(gd.roundLog)) log = gd.roundLog;
      var g2 = Object.assign({}, gd, { roundLog: log });
      if(!iPlayLeague(g2)){ delete t[gid]; continue; }
      var r = await attestResult(g2);
      if(r==='ok' || r==='bad') delete t[gid];
    }catch(e){ console.warn('rattrapage de confirmation', e); }
  }
  var cur = attestTodos(); ids.forEach(function(id){ if(!(id in t)) delete cur[id]; }); saveAttestTodos(cur); // retire ce qui est réglé
}
// dans le classement : une partie en ligne récente compte-t-elle ?
function attestStatus(rec){
  // v60 : « en ligne » se lit dans l'identifiant (o_… imposé par les règles Firebase), pas dans le texte de la partie ;
  // la date est celle du serveur (__serverAt). Une partie en ligne sans date serveur ne compte jamais d'office.
  var online = String(rec.id||'').indexOf('o_')===0;
  var at = typeof rec.__serverAt==='number' ? rec.__serverAt : null;
  if(!online) return { counts:true, legacy:true };
  if(at!==null && at < ATTEST_FROM) return { counts:true, legacy:true };
  if(at===null) return { counts:false, need:Math.floor((rec.players||[]).length/2)+1, have:0, noDate:true };
  var ps = rec.players || [], need = Math.floor(ps.length/2) + 1;
  if(league.valid && league.valid[rec.id]) return { counts:true, byAdmin:true, need:need, have:need };
  if(!ps.every(function(p){ return p.uid; })) return { counts:false, need:need, have:0 };
  var digest = resultDigest(ps.map(function(p){ return [p.uid, p.score]; })), have = 0;
  ps.forEach(function(p){ var a = league.attest && league.attest[rec.id+'__'+p.uid]; if(a && a.digest===digest) have++; });
  return { counts: have >= need, need:need, have:have };
}

function auditHtml(g){
  var a = auditGame(g);
  if(a.state==='bad') return '<div class="error-text" style="text-align:center; margin:8px 0 0;">⚠️ Scores suspects : '+esc(a.issues.slice(0,3).join(' · '))+(a.issues.length>3?' …':'')+'<br><span style="font-weight:400;">Les points ont peut-être été trafiqués. Cette partie ne comptera pas pour la ligue.</span></div>';
  if(a.state==='ok') return '<div class="muted" style="text-align:center; font-size:12px; margin:6px 0 0;">✓ Scores vérifiés par ton téléphone : chaque carte et chaque point ont été recontrôlés.</div>';
  return '';
}

function renderGameOver(g){
  var order = g.playerOrder.filter(function(id){ return g.players[id]; }).sort(function(a,b){ return (g.scores[b]||0)-(g.scores[a]||0); });
  var html = '<div style="text-align:center; margin:6px 0 16px;"><div class="eyebrow">'+g.roundPlan.length+' manches jouées</div>';
  html += '<div class="display" style="font-size:32px; margin-top:4px;">Partie terminée</div></div>';
  order.forEach(function(id, i){
    var p = g.players[id];
    html += '<div class="ranking-row'+(i===0?' first':'')+'"><div class="rank-num">'+(i+1)+'</div>'
      + '<span class="dot" style="background:'+safeColor(p.color)+';"></span>'
      + '<div style="flex:1; font-weight:700;">'+esc(p.name)+(id===myId?' <span class="muted" style="font-weight:400;">(toi)</span>':'')+'</div>'
      + '<div class="display num" style="font-size:22px;">'+(g.scores[id]||0)+'</div></div>';
  });
  html += auditHtml(g);
  if(g.settings && g.settings.league){
    var why = onlineLeagueCheck(g);
    html += '<p class="muted" style="text-align:center; font-size:13.5px; margin:10px 0 0;">'+(why ? esc(why) : (g.leagueRecorded ? 'Partie de ligue enregistrée ✓ <button class="link-btn" data-action="league-openscreen" data-mode="online">Voir le classement en ligne</button>' : 'Enregistrement dans la ligue…'))+'</p>';
    if(!why && iPlayLeague(g)){ var ad = attestDone[leagueGameId(g)];
      html += '<p class="muted" style="text-align:center; font-size:12px; margin:4px 0 0;">'+(ad==='ok' ? '🔒 Ton téléphone a confirmé le résultat.' : (ad==='bad' ? '⚠️ Ton téléphone ne confirme pas ce résultat.' : '🔒 Confirmation du résultat en cours…'))+'</p>'; }
  }
  html += '<div style="text-align:center; margin:18px 0 6px;">'
    + (g.hostId===myId ? '<button class="btn" data-action="replay">↻ Rejouer (mêmes joueurs, mêmes règles)</button>'
                       : '<p class="muted" style="font-size:13.5px;">L\'hôte peut relancer une partie avec les mêmes joueurs.</p>')
    + '</div>';
  html += coachReviewHtml(g, (g.roundLog||[])[(g.roundLog||[]).length-1]);
  html += renderGameRecap(g);
  html += coachReviewsListHtml(g);
  html += '<div style="text-align:center; margin-top:18px;"><button class="btn secondary" data-action="leave">Retour à l\'accueil</button></div>';
  return html;
}

function renderGameRecap(g){
  var log = g.roundLog || [];
  if(!log.length) return '';
  var order = g.playerOrder.slice().sort(function(a,b){ return (g.scores[b]||0)-(g.scores[a]||0); });
  // stats par joueur
  var html = '<div class="card-panel" style="margin-top:18px;">';
  html += '<h3 style="font-size:17px; margin-bottom:12px;">Récap de la partie</h3>';
  html += '<div class="recap-scroll"><table class="score-table recap-stats"><thead><tr><th>Joueur</th><th>Contrats</th><th>Plis</th><th>Points</th></tr></thead><tbody>';
  order.forEach(function(id){
    var p = g.players[id], ok=0, plis=0, best=null;
    log.forEach(function(r){
      if(r.bids[id]===r.tricksWon[id]) ok++;
      plis += (r.tricksWon[id]||0);
      if(best===null || r.points[id]>best) best=r.points[id];
    });
    html += '<tr><td>'+esc(p.name)+(id===myId?' <span class="muted">(toi)</span>':'')+'</td>'
      + '<td>'+ok+' / '+log.length+'</td><td>'+plis+'</td>'
      + '<td class="display num" style="font-size:16px;">'+(g.scores[id]||0)+'</td></tr>';
  });
  html += '</tbody></table></div>';
  // détail manche par manche
  html += '<h3 style="font-size:15px; margin:20px 0 4px;">Manche par manche</h3>';
  html += '<p class="muted" style="font-size:12px; margin:0 0 10px;">Dans chaque case : annoncé / réalisé, les points de la manche, et le total cumulé en dessous.</p>';
  html += '<div class="recap-scroll"><table class="score-table recap-rounds"><thead><tr><th>Manche</th>';
  order.forEach(function(id){ html += '<th>'+esc(g.players[id].name)+'</th>'; });
  html += '</tr></thead><tbody>';
  var totals = {}; order.forEach(function(id){ totals[id]=0; });
  log.forEach(function(r){
    html += '<tr><td><div style="font-weight:600;">'+(r.round+1)+'</div><div class="muted" style="font-size:11px; white-space:nowrap;">'+r.handSize+' carte'+(r.handSize>1?'s':'')+(r.trump ? ' · <span style="color:'+(RED_SUITS[r.trump.suit]?'var(--brick)':'var(--navy)')+';">'+SUIT_SYMBOL[r.trump.suit]+'</span>' : (r.trump===null ? ' · sans atout' : ''))+'</div></td>';
    order.forEach(function(id){
      var pv = r.points[id]; totals[id] += pv;
      var ok = r.bids[id]===r.tricksWon[id];
      html += '<td class="'+(ok?'hit':'miss')+'"><div>'+r.bids[id]+' / '+r.tricksWon[id]+'</div>'
        + '<div class="display" style="font-size:14px; color:'+(pv>0?'var(--good)':(pv<0?'var(--danger)':'var(--cream-dim)'))+';">'+(pv>0?'+':'')+pv+'</div>'
        + '<div class="muted" style="font-size:11px;">= '+totals[id]+'</div></td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div></div>';
  return html;
}

function renderRulesModal(){
  var html = '<div class="modal-backdrop" data-action="toggle-rules">';
  html += '<div class="card-panel modal">';
  html += '<button class="btn secondary small close-x" data-action="toggle-rules">Fermer</button>';
  html += '<div style="margin:0 0 12px; padding-right:70px;">'+renderDeckChoice()+'</div>';
  html += '<h3>Règles de cette version</h3>';
  html += '<button class="btn small" style="margin:6px 0 4px;" data-action="tuto-open">▶ Voir le tuto animé</button>';
  html += '<p>Le nombre de cartes distribuées change à chaque manche : par défaut on commence à 1 carte et on monte d\'une carte par manche (l\'hôte peut aussi choisir montant puis descendant, descendant, ou pyramide).</p>';
  html += '<p>Manche à 1 carte (si l\'option est cochée) : on joue à l\'aveugle. Tu ne vois pas ta propre carte, mais tu vois celles de tous les autres joueurs, et tu annonces en fonction.</p>';
  html += '<p>À chaque manche, une carte est retournée pour indiquer l\'atout — sauf quand toutes les cartes du paquet sont distribuées.</p>';
  html += '<p>Chacun annonce, à tour de rôle, le nombre de plis qu\'il pense remporter. Le dernier à annoncer (le donneur) ne peut pas choisir le nombre qui ferait tomber le total exactement sur le nombre de plis de la manche.</p>';
  html += '<p>On doit fournir la couleur demandée si possible ; sinon on peut couper ou défausser librement.</p>';
  var scR = getScoring(gameDoc);
  html += '<p>Points (réglables par l\'hôte dans le salon) — contrat réalisé exactement : '+scR.bonus+' points + '+scR.perTrick+' par pli remporté. Contrat manqué : '+(scR.missFixed?('−'+scR.missFixed+' points, plus '):'')+'−'+scR.missPerTrick+' par pli d\'écart entre l\'annonce et le résultat.</p>';
  html += '<p>Dans le salon, chaque joueur doit se déclarer prêt avant que l\'hôte puisse lancer la partie.</p>';
  html += '</div></div>';
  return html;
}

