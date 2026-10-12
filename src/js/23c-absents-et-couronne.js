/* ===================== v64 : joueur absent + couronne du dernier vainqueur + ajout d'amis en un clic =====================
   JOUEUR ABSENT (retours des joueurs) :
   - players[id].miss = nombre de tours de suite que le JEU a joués à la place du joueur (temps écoulé). Il repart à 0 dès que le joueur joue lui-même.
   - À 2 (AFK_AFTER) : le joueur est « absent ». Son tour est joué tout de suite par le cerveau d'un robot (coups corrects, plus au hasard) par l'appareil
     de l'hôte, et les autres joueurs humains voient une question : le remplacer par un robot, ou le retirer de la partie (vote, majorité des autres humains).
   - Le vote est dans la partie : afkVotes[absent][votant] = 'bot' | 'out'. L'hôte applique le résultat : players[absent].excluded = 'bot' | 'out'.
     « bot » : un robot joue à sa place jusqu'à la fin ; il finit dernier ; « out » : il disparaît du classement. Dans les deux cas : aucun point de ligue
     (il n'est plus dans l'enregistrement ; la partie compte quand même pour les autres si elle avait 4 humains au départ).
   COURONNE : 👑 sur le nom du PREMIER du classement en ligne de la ligue (crownFromLeague / crownMark). RÉCOMPENSES : ⭐ 🍀 🃏 selon les victoires de ligue (BADGES), affichées dans le profil. */
var AFK_AFTER = 2;
function isAfkPlayer(p){ return !!(p && !p.isBot && ((p.miss||0) >= AFK_AFTER || p.excluded)); }
function afkTargets(g){ // absents pas encore décidés
  return (g.playerOrder||[]).filter(function(id){ var p = g.players && g.players[id]; return p && !p.isBot && !p.excluded && (p.miss||0) >= AFK_AFTER; });
}
function afkVoters(g, target){ return (g.playerOrder||[]).filter(function(id){ var p = g.players && g.players[id]; return p && !p.isBot && !p.excluded && id!==target; }); }
function afkNeed(n){ return Math.floor(n/2) + 1; }
function afkTally(g, target){
  var votes = (g.afkVotes && g.afkVotes[target]) || {}, voters = afkVoters(g, target), t = { bot:0, out:0 };
  voters.forEach(function(v){ var c = votes[v]; if(c==='bot' || c==='out') t[c]++; });
  return { bot:t.bot, out:t.out, need:afkNeed(voters.length), voters:voters.length };
}
function afkDecision(g, target){
  var t = afkTally(g, target); if(!t.voters) return null;
  if(t.bot >= t.need) return 'bot';
  if(t.out >= t.need) return 'out';
  return null;
}
var afkApplying = {};
function afkResolveTick(g){ // appareil de l'hôte : applique le vote qui a la majorité
  if(!g || g.hostId!==myId || !g.playerOrder || (g.status!=='bidding' && g.status!=='playing' && g.status!=='dealing' && g.status!=='round_end')) return;
  afkTargets(g).forEach(function(id){
    var d = afkDecision(g, id); if(!d || afkApplying[id]) return;
    afkApplying[id] = true;
    var patch = { players:{}, afkVotes:{} }; patch.players[id] = { excluded:d }; patch.afkVotes[id] = null;
    claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); })
      .then(function(){ setTimeout(function(){ afkApplying[id] = false; }, 2500); });
  });
}
async function afkVote(target, choice){
  var g = gameDoc; if(!g || (choice!=='bot' && choice!=='out') || target===myId) return;
  var me = g.players && g.players[myId], p = g.players && g.players[target];
  if(!me || me.isBot || me.excluded || !p || p.excluded || (p.miss||0) < AFK_AFTER) return;
  var patch = { afkVotes:{} }; patch.afkVotes[target] = {}; patch.afkVotes[target][myId] = choice;
  try{ await claudeDb.doc('games/'+g.code).update(patch); }catch(e){ console.error(e); showToast('Vote impossible : '+dbErrorText(e)); }
}
// classement final : les « retirés » disparaissent, les « remplacés » finissent derniers
function rankingIds(g){
  var ids = (g.playerOrder||[]).filter(function(id){ return g.players && g.players[id] && g.players[id].excluded!=='out'; });
  return ids.sort(function(a,b){
    var ea = g.players[a].excluded ? 1 : 0, eb = g.players[b].excluded ? 1 : 0;
    return ea!==eb ? ea-eb : ((g.scores[b]||0) - (g.scores[a]||0));
  });
}
// joueurs qui comptent pour la ligue (ni remplacés ni retirés)
function leagueIdsOf(g){ return (g.playerOrder||[]).filter(function(id){ return g.players && g.players[id] && !g.players[id].excluded; }); }
function afkTag(p){ return p && p.excluded ? (p.excluded==='out' ? ' <span class="afk-tag">retiré</span>' : ' <span class="afk-tag">🤖 remplacé</span>') : ((p && !p.isBot && (p.miss||0) >= AFK_AFTER) ? ' <span class="afk-tag">💤 absent</span>' : ''); }
function renderAfkBanner(g){
  var me = g.players && g.players[myId], h = '';
  if(me && me.excluded) return '<div class="afk-banner me">'+(me.excluded==='out' ? 'Les autres joueurs t\'ont retiré de la partie (trop d\'absences).' : 'Les autres joueurs t\'ont remplacé par un robot (trop d\'absences) : tu finis dernier, sans point de ligue.')+'</div>';
  if(me && (me.miss||0) >= AFK_AFTER) h += '<div class="afk-banner me">💤 Tu n\'as pas joué 2 tours de suite : le jeu joue à ta place. Joue une carte pour reprendre la main.</div>';
  if(me && !me.isBot) afkTargets(g).forEach(function(id){
    if(id===myId) return;
    var t = afkTally(g, id), mine = ((g.afkVotes && g.afkVotes[id]) || {})[myId], nm = esc(g.players[id].name);
    h += '<div class="afk-banner"><div><strong>💤 '+nm+'</strong> n\'a pas joué 2 tours de suite (le jeu a joué à sa place). Que faire ?</div>'
      + '<div class="afk-btns"><button class="btn small'+(mine==='bot'?'':' secondary')+'" data-action="afk-vote" data-id="'+esc(id)+'" data-choice="bot">🤖 Le remplacer par un robot ('+t.bot+')</button>'
      + '<button class="btn small'+(mine==='out'?'':' secondary')+'" data-action="afk-vote" data-id="'+esc(id)+'" data-choice="out">🚪 Le retirer de la partie ('+t.out+')</button></div>'
      + '<div class="muted" style="font-size:12px;">Il faut '+t.need+' vote'+(t.need>1?'s':'')+' sur '+t.voters+' joueur'+(t.voters>1?'s':'')+' pour décider. En attendant, le jeu joue correctement à sa place.</div></div>';
  });
  return h;
}

function noteAutoPlay(id){ // le jeu vient de jouer à la place de ce joueur : +1 tour de suite
  var g = gameDoc; if(!g || !g.players || !g.players[id] || g.players[id].isBot) return;
  var patch = { players:{} }; patch.players[id] = { miss: (g.players[id].miss||0) + 1 };
  claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); });
}
function resetMiss(){ // le joueur joue lui-même : il est de retour
  var g = gameDoc, me = g && g.players && g.players[myId];
  if(!me || !(me.miss > 0) || me.excluded) return;
  var patch = { players:{} }; patch.players[myId] = { miss:0 };
  claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); });
}
// aide « couleur demandée » (1re carte du pli) : DÉSACTIVÉE par défaut (rien n'est affiché) ; le bouton 💡 à côté du son l'active (mémorisé sur l'appareil)
var ledHelpOn = false; try{ ledHelpOn = localStorage.getItem('rikiki_led_help')==='1'; }catch(e){}
// v67 : « Grand texte » pour ceux qui voient mal — tout l'écran grossit (textes ET cartes), mémorisé sur l'appareil
var bigTextOn = false; try{ bigTextOn = localStorage.getItem('rikiki_big_text')==='1'; }catch(e){}
function applyBigText(){ document.documentElement.classList.toggle('big-text', bigTextOn); }
applyBigText();
function ledHint(g){
  if(!ledHelpOn) return '';
  var led = g.currentTrick && g.currentTrick.length ? g.currentTrick[0].card.suit : null; if(!led) return '';
  var mine = (myHand && myHand.cards) || [], has = mine.some(function(c){ return c.suit===led; }), isMe = g.turnPlayerId===myId;
  return '<div class="led-hint"><span class="led-sym'+(RED_SUITS[led]?' red':'')+'">'+suitGlyph(led)+'</span> On joue à <strong>'+SUIT_NAME[led]+'</strong>'
    + (isMe ? (has ? ' : tu dois jouer '+SUIT_NAME[led] : ' : tu n\'en as pas, joue ce que tu veux (un atout coupe)') : '')+'</div>';
}

/* ---- couronne : PREMIER du classement en ligne de la ligue (saison en cours ; s'il n'y a encore personne de classé : classement général) ---- */
var crown = { holder:null, sig:'' }, crownBusy = false;
function crownMark(userId, name, authUid){ // userId = identifiant de joueur (celui des fiches de la ligue), authUid = compte ; sans identifiant : le prénom
  var h = crown.holder; if(!h) return '';
  var hit = !!((userId && h.userId && h.userId===userId) || (authUid && h.authUid && h.authUid===authUid));
  if(!hit && !userId && !authUid) hit = !!(h.name && name && normName(h.name)===normName(name));
  return hit ? ' <span class="crown" title="Premier de la ligue">👑</span>' : '';
}
function crownFromLeague(){
  var res = computeLeague(seasonOf(nowMs()), 'online'); if(!res.ranked.length) res = computeLeague('all', 'online');
  var top = res.ranked[0]; if(!top) return null;
  var m = memberById(top.id) || {}, rec = null;
  league.games.forEach(function(g){ (g.players||[]).forEach(function(p){ if(p.memberId===top.id && p.uid && (!rec || (g.at||0) > rec.at)) rec = { at:g.at||0, uid:p.uid }; }); });
  return { memberId:top.id, userId:m.userId||null, name:top.name, authUid:rec ? rec.uid : null };
}
async function loadCrown(){
  if(!claudeDb || crownBusy) return;
  crownBusy = true;
  try{
    await loadLeague(true, true);
    var h = crownFromLeague(), sig = h ? (h.memberId+'|'+(h.userId||'')+'|'+(h.authUid||'')) : '';
    if(sig !== crown.sig){ crown = { holder:h, sig:sig }; var ae = document.activeElement; if(!(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName))) render(); }
  }catch(e){ console.warn('couronne', e); }
  crownBusy = false;
}
var crownKey = '';
function crownSoon(){ var g = gameDoc, k = g ? g.code+'|'+(g.startedAt||'') : ''; if(!k || k===crownKey) return; crownKey = k; setTimeout(loadCrown, 7000); setTimeout(loadCrown, 30000); }
setTimeout(loadCrown, 4500);
setInterval(function(){ if(!document.hidden) loadCrown(); }, 150000);

/* ---- récompenses de victoires (profil) : ⭐ dès 1 victoire, 🍀 (trèfle à quatre feuilles) dès 3, 🃏 (joker) dès 5 ; victoires = parties de ligue gagnées ---- */
var BADGES = [ { min:1, icon:'⭐', name:'Étoile' }, { min:3, icon:'🍀', name:'Trèfle à quatre feuilles' }, { min:5, icon:'🃏', name:'Joker' } ];
function badgeFor(wins){ var b = null; BADGES.forEach(function(x){ if(wins >= x.min) b = x; }); return b; }
function myLeagueWins(){
  var m = myMember() || (currentProfile ? (league.members||[]).filter(function(x){ return normName(x.name)===normName(currentProfile.pseudo); })[0] : null);
  if(!m) return 0;
  var r = computeLeague('all', null), all = r.ranked.concat(r.unranked), s = all.filter(function(x){ return x.id===m.id; })[0];
  return s ? s.wins : 0;
}
function renderBadges(){
  if(!league.loaded){ if(!league.loading && claudeDb) loadLeague(); return '<div class="muted" style="font-size:12px; margin-top:8px;">Récompenses : chargement…</div>'; }
  var wins = myLeagueWins(), nxt = BADGES.filter(function(b){ return wins < b.min; })[0];
  return '<div class="badges"><div class="eyebrow">Mes récompenses · '+wins+' victoire'+(wins>1?'s':'')+' en ligue</div><div class="badge-row">'
    + BADGES.map(function(b){ return '<span class="bdg'+(wins>=b.min?' on':'')+'" title="'+esc(b.name)+'"><span class="bdg-i">'+b.icon+'</span><small>'+b.min+' victoire'+(b.min>1?'s':'')+'</small></span>'; }).join('')
    + '</div>'+(nxt ? '<div class="muted" style="font-size:12px;">Encore '+(nxt.min-wins)+' victoire'+(nxt.min-wins>1?'s':'')+' pour : '+nxt.icon+' '+esc(nxt.name)+'</div>' : '<div class="muted" style="font-size:12px;">Toutes les récompenses sont débloquées, bravo ! 🎉</div>')+'</div>';
}

/* ---- ajouter un ami en un clic (à côté des joueurs d'une partie) ---- */
var friendAdded = {};
function friendAddBtn(p, id){
  if(!socialOn() || !p || p.isBot || id===myId) return '';
  var key = profileKey(p.name||''); if(key.length < 2 || (currentProfile && key===currentProfile.key)) return '';
  if(Object.keys(social.friends).some(function(k){ return social.friends[k] && friendKey(social.friends[k])===key; })) return '';
  if(friendAdded[key]) return '<span class="friend-add-done" title="Demande envoyée">✓ ami</span>';
  return '<button class="btn ghost small friend-add-btn" data-action="friend-add-from" data-name="'+esc(p.name)+'" title="Ajouter '+esc(p.name)+' en ami" aria-label="Ajouter en ami">➕</button>';
}
async function friendAddFrom(name){
  var key = profileKey(name||''); if(key.length < 2) return;
  await addFriend(name);
  if(social.addOk){ friendAdded[key] = true; showToast(social.addOk); }
  else if(social.addErr){ showToast(social.addErr); }
  social.addOk = ''; social.addErr = '';
  render();
}
// suggestions de pseudos : joueurs de la ligue + joueurs de la partie en cours (sauf moi et mes amis)
function friendSuggestHtml(){
  var seen = {}, names = [], mine = {};
  Object.keys(social.friends).forEach(function(k){ if(social.friends[k]) mine[friendKey(social.friends[k])] = 1; });
  var add = function(n){ var k = profileKey(n||''); if(k.length<2 || seen[k] || mine[k] || (currentProfile && k===currentProfile.key)) return; seen[k] = 1; names.push(n); };
  (league.members||[]).forEach(function(m){ if(m.userId || m.name) add(m.name); });
  if(gameDoc && gameDoc.players) Object.keys(gameDoc.players).forEach(function(id){ var p = gameDoc.players[id]; if(p && !p.isBot) add(p.name); });
  return '<datalist id="friend-suggest">'+names.sort().map(function(n){ return '<option value="'+esc(n)+'"></option>'; }).join('')+'</datalist>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='afk-vote') afkVote(el.getAttribute('data-id'), el.getAttribute('data-choice'));
  else if(a==='friend-add-from') friendAddFrom(el.getAttribute('data-name'));
  else if(a==='led-help-toggle'){ ledHelpOn = !ledHelpOn; try{ localStorage.setItem('rikiki_led_help', ledHelpOn ? '1' : '0'); }catch(err){} render(); }
  else if(a==='big-text-toggle'){ bigTextOn = !bigTextOn; try{ localStorage.setItem('rikiki_big_text', bigTextOn ? '1' : '0'); }catch(err){} applyBigText(); render(); }
});
