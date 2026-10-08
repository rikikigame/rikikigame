/* ===================== v25 : vrais comptes (Firebase Authentication) =====================
   Même expérience pour les joueurs (pseudo + code), mais :
   - le code est vérifié par Google (anti-essais en boucle), il n'est plus stocké dans la base ;
   - chaque profil a un propriétaire (owner = compte Firebase) : seules les règles le laissent modifier son profil ;
   - l'organisateur est un COMPTE (config/admin), plus un pseudo.
   Identifiant caché : <pseudo>@rikiki.invalid (domaine réservé, aucun e-mail n'est jamais envoyé), mot de passe : « rikiki: » + code.
   Les invités sont connectés en « anonyme » pour pouvoir écrire. En mode local (tests), l'ancien système PIN reste. */
var fbAuth = null, adminUid = null, profileClaimsList = [];
function authOn(){ return !!fbAuth; }
function authEmail(key){ return key + '@rikiki.invalid'; }
function authPw(pin){ return 'rikiki:' + pin; }
function authUid(){ return fbAuth && fbAuth.currentUser ? fbAuth.currentUser.uid : null; }
function authAnon(){ return !fbAuth || !fbAuth.currentUser || fbAuth.currentUser.isAnonymous; }
async function initAuth(){
  if(!(usingFirebase || window.__TEST_AUTH) || !window.firebase || !firebase.auth) return;
  try{
    fbAuth = firebase.auth();
    if(window.__TEST_AUTH_URL && !fbAuth.__emu){ fbAuth.useEmulator(window.__TEST_AUTH_URL); fbAuth.__emu = true; }
    await new Promise(function(res){ var un = fbAuth.onAuthStateChanged(function(){ un(); res(); }); });
    if(!fbAuth.currentUser){ try{ await fbAuth.signInAnonymously(); }catch(e){ console.warn('connexion anonyme impossible (à activer dans Firebase)', e); } }
    try{ var a = await claudeDb.doc('config/admin').get(); adminUid = a.exists ? (a.data().uid || null) : null; }catch(e){ adminUid = null; }
  }catch(e){ console.error(e); fbAuth = null; }
}
function authErrText(e){
  var c = (e && e.code) || '';
  if(c==='auth/too-many-requests') return 'Trop d\'essais : réessaie dans quelques minutes.';
  if(c==='auth/operation-not-allowed' || c==='auth/admin-restricted-operation') return 'Les comptes ne sont pas encore activés dans Firebase (demande à l\'organisateur).';
  if(c==='auth/network-request-failed') return 'Pas de connexion internet.';
  return (e && e.message) ? e.message : String(e);
}
function isBadCredential(e){ var c = (e && e.code) || ''; return /invalid-credential|wrong-password|user-not-found|invalid-login-credentials|invalid-password/.test(c); }
async function authCreateOrLink(email, pw){
  var cred = firebase.auth.EmailAuthProvider.credential(email, pw);
  if(fbAuth.currentUser && fbAuth.currentUser.isAnonymous){
    try{ return (await fbAuth.currentUser.linkWithCredential(cred)).user; }
    catch(e){ if(!/credential-already-in-use|email-already-in-use|provider-already-linked/.test(e.code||'')) throw e; }
  }
  return (await fbAuth.createUserWithEmailAndPassword(email, pw)).user;
}
function stripLegacy(d){ var o = Object.assign({}, d); delete o.pinHash; delete o.salt; delete o.__plain; return o; }
function finishLogin(key, d){
  saveProfileLocal({ key:key, pseudo:d.pseudo, playerId:d.playerId, color:d.color });
  try{ localStorage.setItem('rikiki_fb_name', d.pseudo); localStorage.setItem('rikiki_fb_uid', d.playerId); localStorage.removeItem('rikiki_last'); }catch(e){}
  location.reload();
}
async function authProfileCreate(f, key){
  var ref = claudeDb.doc('profiles/'+key);
  var snap = await ref.get();
  if(snap.exists) throw { ui:'Ce pseudo est déjà pris. Si c\'est le tien, clique « Se connecter ».' };
  var email = authEmail(key), u;
  try{ u = await authCreateOrLink(email, authPw(f.pin)); }
  catch(e){
    if(/email-already-in-use/.test(e.code||'')){ // compte créé lors d'un essai précédent : on s'y connecte
      try{ u = (await fbAuth.signInWithEmailAndPassword(email, authPw(f.pin))).user; }catch(e2){ throw { ui:'Ce pseudo est déjà pris.' }; }
    } else throw e;
  }
  var doc = { pseudo:f.pseudo, key:key, playerId:myId, color:myProfile.color||'#C9A24B', createdAt: nowMs(), __plain:{ owner:u.uid, email:email } };
  await ref.set(doc);
  try{ await ensureMember({ userId: myId, name: f.pseudo, pkey: key }); }catch(e){ console.error(e); }
  finishLogin(key, doc);
}
async function authProfileLogin(f, key){
  var snap = await claudeDb.doc('profiles/'+key).get();
  if(!snap.exists) throw { ui:'Pseudo inconnu. Pour le créer, clique « Créer mon profil ».' };
  var d = snap.data(), plain = d.__plain || {}, email = plain.email || authEmail(key);
  if(plain.owner === 'aucun') throw { ui:'Ce profil a été protégé par l\'organisateur : clique « Code oublié » pour choisir un nouveau code.', forgot:true }; // v55
  try{
    await fbAuth.signInWithEmailAndPassword(email, authPw(f.pin));
    if(!plain.owner){ // conversion interrompue la dernière fois : on la termine
      d = Object.assign(stripLegacy(d), { __plain:{ owner:authUid(), email:email } });
      await claudeDb.doc('profiles/'+key).set(d);
    }
  }catch(e){
    if(!isBadCredential(e)) throw e;
    // ancien profil (code PIN maison, pas encore de compte) : on vérifie l'ancien code puis on crée le compte
    if(d.pinHash && !plain.owner){
      if(await pinHash(key, d.salt, f.pin) !== d.pinHash) throw { ui:'Code PIN incorrect.' };
      var u = await authCreateOrLink(email, authPw(f.pin));
      d = Object.assign(stripLegacy(d), { __plain:{ owner:u.uid, email:email } });
      await claudeDb.doc('profiles/'+key).set(d);
    } else throw { ui:'Code PIN incorrect.', forgot:true };
  }
  if(d.mergedInto){ // v42 : doublon fusionné par l'organisateur → on arrive sur le profil principal
    var ts = await claudeDb.doc('profiles/'+d.mergedInto).get(), t = ts.exists ? ts.data() : null;
    if(t && t.__plain && t.__plain.owner === authUid()) return finishLogin(d.mergedInto, t);
    throw { ui:'Ce profil a été regroupé avec « '+(t ? t.pseudo : d.mergedInto)+' » : connecte-toi avec ce pseudo.' };
  }
  finishLogin(key, d);
}
async function authChangePin(cur, nw){
  var key = currentProfile.key, snap = await claudeDb.doc('profiles/'+key).get(), d = snap.data(), email = (d.__plain && d.__plain.email) || authEmail(key);
  try{ await fbAuth.currentUser.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(email, authPw(cur))); }
  catch(e){ if(isBadCredential(e)) throw { ui:'Code actuel incorrect.' }; throw e; }
  await fbAuth.currentUser.updatePassword(authPw(nw));
}
// --- code oublié : l'ami crée un nouvel accès, l'organisateur valide qu'il reprend son profil ---
async function authForgot(f, key){
  var snap = await claudeDb.doc('profiles/'+key).get();
  if(!snap.exists) throw { ui:'Pseudo inconnu.' };
  var email = key + '.r' + nowMs().toString(36) + '@rikiki.invalid';
  var u = await authCreateOrLink(email, authPw(f.pin));
  await claudeDb.doc('profileClaims/'+key).set({ pseudo: snap.data().pseudo, key:key, at: nowMs(), status:'pending', __plain:{ newOwner:u.uid, email:email, st:'pending' } }); // v60 : st='pending' → une demande en attente ne peut plus être écrasée par un tiers
  try{ localStorage.setItem('rikiki_claim_'+key, '1'); }catch(e){}
}
async function loadClaims(){
  if(!authOn() || !isAdmin()){ profileClaimsList = []; return; }
  try{
    var s = await claudeDb.collection('profileClaims').limit(100).get();
    profileClaimsList = s.docs.map(function(d){ var x = Object.assign({}, d.data()); x.id = d.id; return x; }).filter(function(x){ return x.status==='pending'; });
  }catch(e){ console.error(e); profileClaimsList = []; }
}
async function approveClaim(key){
  var c = profileClaimsList.filter(function(x){ return x.id===key; })[0]; if(!c) return;
  var ref = claudeDb.doc('profiles/'+key), snap = await ref.get(); if(!snap.exists) return;
  var d = snap.data();
  // v57 : le profil de l'organisateur ne change jamais de propriétaire par le jeu (les règles Firebase l'interdisent aussi)
  if(key === (currentProfile && currentProfile.key) || (d.__plain && d.__plain.owner && d.__plain.owner === adminUid)) throw { code:'admin-profile', message:'C\'est le profil de l\'organisateur : refuse cette demande.' };
  await ref.set(Object.assign(stripLegacy(d), { __plain:{ owner:c.__plain.newOwner, email:c.__plain.email } }));
  await claudeDb.doc('profileClaims/'+key).set(Object.assign({}, c, { status:'ok', doneAt: nowMs(), __plain:Object.assign({}, c.__plain, { st:'done' }) }));
  profileClaimsList = profileClaimsList.filter(function(x){ return x.id!==key; });
}
async function refuseClaim(key){
  var c = profileClaimsList.filter(function(x){ return x.id===key; })[0]; if(!c) return;
  await claudeDb.doc('profileClaims/'+key).set(Object.assign({}, c, { status:'refused', doneAt: nowMs(), __plain:Object.assign({}, c.__plain, { st:'done' }) }));
  profileClaimsList = profileClaimsList.filter(function(x){ return x.id!==key; });
}

/* ===================== v42 : regrouper des doublons =====================
   Un ami a oublié son code et s'est recréé un profil ? L'organisateur regroupe le doublon avec le profil principal :
   - le doublon garde une étiquette mergedInto → se connecter avec l'un ou l'autre pseudo mène au profil principal ;
   - on choisit quel code garder (celui du doublon = celui dont l'ami se souvient, en général) ;
   - dans la ligue, le membre du doublon est marqué « fusionné » : ses parties comptent pour le principal
     (les parties enregistrées ne sont jamais réécrites, la redirection se fait au chargement du classement). */
async function mergeProfiles(dupName, mainName, keep){
  if(!isAdmin()) throw { ui:'Réservé à l\'organisateur.' };
  var dk = profileKey(dupName), mk = profileKey(mainName);
  if(dk.length < 2 || mk.length < 2) throw { ui:'Entre les deux pseudos.' };
  if(dk === mk) throw { ui:'C\'est deux fois le même pseudo.' };
  var dref = claudeDb.doc('profiles/'+dk), mref = claudeDb.doc('profiles/'+mk);
  var ds = await dref.get(), ms = await mref.get();
  if(!ds.exists) throw { ui:'Aucun profil « '+dupName+' ».' };
  if(!ms.exists) throw { ui:'Aucun profil « '+mainName+' ».' };
  var d = ds.data(), m = ms.data();
  if(d.mergedInto) throw { ui:'« '+d.pseudo+' » est déjà regroupé avec un autre profil.' };
  if(m.mergedInto) throw { ui:'« '+m.pseudo+' » est lui-même un doublon : choisis le profil principal.' };
  // 1. le code de connexion à garder
  if(keep === 'dup'){
    if(authOn()){
      if(!(d.__plain && d.__plain.owner)) throw { ui:'« '+d.pseudo+' » n\'a pas encore de compte sécurisé : garde plutôt le code de « '+m.pseudo+' ».' };
      await mref.set(Object.assign(stripLegacy(m), { __plain:{ owner:d.__plain.owner, email:d.__plain.email } }));
    } else await mref.set(Object.assign({}, m, { salt:d.salt, pinHash:d.pinHash }));
  }
  // 2. le doublon renvoie vers le principal
  var mark = { mergedInto: mk, mergedAt: nowMs(), mergedBy: currentProfile ? currentProfile.pseudo : '' };
  if(authOn()) await dref.set(Object.assign(stripLegacy(d), mark, { __plain: (d.__plain && d.__plain.owner != null) ? d.__plain : { owner:'', email:authEmail(dk) } }));
  else await dref.set(Object.assign({}, d, mark));
  // 3. la ligue
  await loadLeague(true);
  var mainMid = await ensureMember({ userId: m.playerId, name: m.pseudo });
  var dups = (league.allMembers || league.members).filter(function(x){ return x.userId===d.playerId && x.id!==mainMid && !x.mergedInto; });
  for(var i=0; i<dups.length; i++) await claudeDb.collection('leagueMembers').doc(dups[i].id).update({ mergedInto: mainMid });
  league.loaded = false;
  return 'Regroupé ✓ « '+d.pseudo+' » → « '+m.pseudo+' »'+(dups.length ? ' (parties de ligue reprises)' : '')+'. Ton ami se connecte avec « '+m.pseudo+' » et le code '+(keep==='dup' ? 'de « '+d.pseudo+' »' : 'de « '+m.pseudo+' »')+'.';
}
// joueurs du classement seulement (utile pour les « vraies cartes » : Tom / Thomas)
async function mergeMembers(dupId, mainId){
  if(!isAdmin()) throw { ui:'Réservé à l\'organisateur.' };
  if(!dupId || !mainId || dupId===mainId) throw { ui:'Choisis deux joueurs différents.' };
  if(canonMember(mainId) === dupId) throw { ui:'Ces deux joueurs sont déjà regroupés dans l\'autre sens.' };
  await claudeDb.collection('leagueMembers').doc(dupId).update({ mergedInto: mainId });
  var a = memberById(dupId), b = memberById(mainId);
  league.loaded = false; await loadLeague(true);
  return 'Regroupé ✓ « '+(a ? a.name : '?')+' » compte maintenant pour « '+(b ? b.name : '?')+' ».';
}
// au démarrage : si mon profil a été regroupé, je passe sur le profil principal
async function checkMergedProfile(){
  if(!currentProfile || !claudeDb) return;
  try{
    var s = await claudeDb.doc('profiles/'+currentProfile.key).get(); if(!s.exists) return;
    var d = s.data(); if(!d.mergedInto) return;
    var ts = await claudeDb.doc('profiles/'+d.mergedInto).get(); if(!ts.exists) return;
    var t = ts.data();
    if(!authOn() || (t.__plain && t.__plain.owner === authUid())) finishLogin(d.mergedInto, t);
    else { profileUi.err = 'Ton profil a été regroupé avec « '+t.pseudo+' » : déconnecte-toi puis connecte-toi avec ce pseudo.'; homeProfileOpen = true; render(); }
  }catch(e){ console.warn('profil regroupé ?', e); }
}
async function claimAdmin(){
  // réservé au profil de l'organisateur (K.vroom) ; les règles de sécurité le vérifient aussi
  if(!authOn() || authAnon() || !currentProfile || adminUid) return;
  if(ADMIN_PSEUDOS.map(profileKey).indexOf(currentProfile.key) < 0) return;
  await claudeDb.doc('config/admin').set({ pseudo: currentProfile.pseudo, uid: authUid(), at: nowMs(), __plain:{ uid: authUid() } });
  adminUid = authUid();
}

/* (v29) alertes de tour retirées à la demande des joueurs */

/* ===================== v32 : amis en ligne, invitations, lien de partie =====================
   presence/{joueur}  { name, at, code, status }  mis à jour toutes les 40 s (en ligne = vu il y a moins de 90 s)
   friends/{joueur}   { list:{ idAmi:{ name, since } } }
   friendReq/{joueur} { from:{ idDemandeur:{ name, at } | null } }   « X t'a ajouté »
   invites/{joueur}   { list:{ idInvit:{ fromId, fromName, code, at } | null } }
   Réservé aux joueurs connectés à un profil (il faut un pseudo stable pour être trouvé). */
var social = { friends:{}, presence:{}, reqs:{}, invites:{}, unsubs:[], started:false, addErr:'', addOk:'', open:false, sent:{} };
var ONLINE_MS = 90000, INVITE_MS = 15*60000;
function socialOn(){ return !!currentProfile && !(authOn() && authAnon()); }
function presenceStatus(){
  if(screen==='game' && gameDoc){ return { code: gameDoc.code, status: gameDoc.status==='lobby' ? 'lobby' : 'playing' }; }
  if(screen==='sheet') return { code:null, status:'cards' };
  return { code:null, status:'idle' };
}
async function presenceBeat(){
  if(!socialOn()) return;
  var st = presenceStatus();
  try{ await claudeDb.doc('presence/'+myId).set(withOwner({ name: myProfile.name || currentProfile.pseudo, at: nowMs(), code: st.code, status: st.status })); }catch(e){ console.warn('présence', e); }
}
var presenceTimer = null, lastPresenceKey = null;
function presenceTick(){
  // appelée à chaque affichage : on prévient les amis dès qu'on change d'écran / de partie
  if(!socialOn()) return;
  var st = presenceStatus(), key = st.status+'|'+st.code;
  if(key !== lastPresenceKey){ lastPresenceKey = key; presenceBeat(); }
}
function socialStart(){
  if(social.started || !socialOn()) return;
  social.started = true;
  presenceBeat();
  presenceTimer = setInterval(presenceBeat, 40000);
  var mine = function(path, cb){ try{ social.unsubs.push(claudeDb.doc(path).onSnapshot(function(snap){ cb(snap.exists ? snap.data() : null); render(); }, function(e){ console.warn(path, e); })); }catch(e){ console.warn(e); } };
  mine('friends/'+myId, function(d){ social.friends = (d && d.list) || {}; watchFriendsPresence(); });
  mine('friendReq/'+myId, function(d){ social.reqs = (d && d.from) || {}; });
  mine('invites/'+myId, function(d){ social.invites = (d && d.list) || {}; });
}
var presenceWatch = {};
function watchFriendsPresence(){
  Object.keys(social.friends).forEach(function(fid){
    if(!social.friends[fid] || presenceWatch[fid]) return;
    try{ presenceWatch[fid] = claudeDb.doc('presence/'+fid).onSnapshot(function(snap){ social.presence[fid] = snap.exists ? snap.data() : null; render(); }, function(){}); }catch(e){}
  });
}
function friendOnline(fid){ var p = social.presence[fid]; return !!(p && nowMs() - p.at < ONLINE_MS); }
function friendStatusText(fid){
  var p = social.presence[fid];
  if(!p || nowMs() - p.at >= ONLINE_MS) return 'hors ligne';
  if(p.status==='lobby') return 'dans un salon ('+esc(p.code)+')';
  if(p.status==='playing') return 'en partie';
  if(p.status==='cards') return 'joue aux vraies cartes';
  return 'en ligne';
}
// v48 : ma présence et ma liste d'amis portent le pseudo du profil propriétaire (pkey) ; les règles Firebase
// n'autorisent que le propriétaire de ce profil à les modifier. Les « boîtes aux lettres » (friendReq, invites)
// restent ouvertes aux autres joueurs connectés, puisque c'est eux qui y déposent les demandes.
function withOwner(o){ if(currentProfile && currentProfile.key) o.__plain = { pkey: currentProfile.key }; return o; }
async function mergeDoc(path, patch){
  var ref = claudeDb.doc(path);
  try{ await ref.update(patch); }
  catch(e){
    if(!e || e.code!=='invalid_argument') throw e; // refus des règles, réseau… : surtout ne pas écraser le document
    await ref.set(patch);
  }
}
async function addFriend(pseudo){
  social.addErr = ''; social.addOk = '';
  var key = profileKey(pseudo);
  if(key.length < 2){ social.addErr = 'Entre le pseudo de ton ami.'; render(); return; }
  if(currentProfile && key===currentProfile.key){ social.addErr = 'C\'est toi 😄'; render(); return; }
  try{
    var snap = await claudeDb.doc('profiles/'+key).get();
    if(!snap.exists){ social.addErr = 'Aucun joueur « '+pseudo+' ». Il doit d\'abord créer son profil.'; render(); return; }
    var d = snap.data();
    var p1 = { list:{} }; p1.list[d.playerId] = { name:d.pseudo, since:nowMs() };
    await mergeDoc('friends/'+myId, withOwner(p1));
    var p2 = { from:{} }; p2.from[myId] = { name: myProfile.name || currentProfile.pseudo, at: nowMs() };
    await mergeDoc('friendReq/'+d.playerId, p2); // il ne l'affiche que s'il ne t'a pas déjà en ami
    social.addOk = d.pseudo+' ajouté ✓';
  }catch(e){ console.error(e); social.addErr = 'Impossible : '+dbErrorText(e); }
  render();
}
async function acceptFriend(fid){
  var r = social.reqs[fid]; if(!r) return;
  var p1 = { list:{} }; p1.list[fid] = { name:r.name, since:nowMs() };
  await mergeDoc('friends/'+myId, withOwner(p1));
  var p2 = { from:{} }; p2.from[fid] = null; await mergeDoc('friendReq/'+myId, p2);
}
async function ignoreFriend(fid){ var p = { from:{} }; p.from[fid] = null; await mergeDoc('friendReq/'+myId, p); }
async function removeFriend(fid){ var p = { list:{} }; p.list[fid] = null; await mergeDoc('friends/'+myId, withOwner(p)); }
async function inviteFriend(fid){
  if(!gameDoc) return;
  var id = nowMs().toString(36)+Math.random().toString(36).slice(2,5);
  var p = { list:{} }; p.list[id] = { fromId: myId, fromName: myProfile.name || (currentProfile && currentProfile.pseudo) || 'Un ami', code: gameDoc.code, at: nowMs() };
  try{ await mergeDoc('invites/'+fid, p); social.sent[fid] = nowMs(); showToast('Invitation envoyée ✓'); }
  catch(e){ console.error(e); showToast('Invitation impossible'); }
  render();
}
async function dismissInvite(id){ var p = { list:{} }; p.list[id] = null; try{ await mergeDoc('invites/'+myId, p); }catch(e){} }
function activeInvites(){
  return Object.keys(social.invites).map(function(k){ var v = social.invites[k]; return v ? Object.assign({ id:k }, v) : null; })
    .filter(function(v){ return v && nowMs() - v.at < INVITE_MS && !(gameDoc && gameDoc.code===v.code); })
    .sort(function(a,b){ return b.at - a.at; });
}
async function acceptInvite(id){
  var inv = activeInvites().filter(function(v){ return v.id===id; })[0]; if(!inv) return;
  dismissInvite(id);
  if(gameDoc && gameDoc.code !== inv.code) leaveToEntry();
  entryMode = 'join';
  joinGame(inv.code, myProfile.name || (currentProfile && currentProfile.pseudo) || '');
}
function gameLink(code){ return location.origin + location.pathname + '?game=' + encodeURIComponent(code); }
async function shareGameLink(code){
  var url = gameLink(code), text = 'Viens jouer au Rikiki avec moi ! Code '+code;
  try{
    if(navigator.share){ await navigator.share({ title:'Rikiki', text:text, url:url }); return; }
  }catch(e){ if(e && e.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(url); showToast('Lien copié ✓ Colle-le dans ta conversation'); }
  catch(e){ prompt('Copie ce lien :', url); }
}
// --- affichage ---
function renderInviteBanner(){
  if(!socialOn()) return '';
  var list = activeInvites(); if(!list.length) return '';
  var v = list[0];
  return '<div class="invite-banner"><span>🃏 <strong>'+esc(v.fromName)+'</strong> t\'invite à une partie</span>'
    + '<span class="row" style="gap:6px;"><button class="btn small" data-action="invite-accept" data-id="'+esc(v.id)+'">Rejoindre</button>'
    + '<button class="btn ghost small" data-action="invite-dismiss" data-id="'+esc(v.id)+'" aria-label="Refuser">✕</button></span></div>';
}
function friendIds(){
  return Object.keys(social.friends).filter(function(k){ return social.friends[k]; })
    .sort(function(a,b){ return (friendOnline(b)-friendOnline(a)) || String(social.friends[a].name).localeCompare(String(social.friends[b].name)); });
}
function renderFriendsPanel(){
  if(!(usingFirebase || usingMock)) return '';
  var html = '<div class="card-panel" style="margin-bottom:12px; padding:14px 16px;">';
  if(!socialOn()){
    return html + '<div>👥 <strong>Amis</strong><div class="muted" style="font-size:12.5px;">Crée ou connecte ton profil pour ajouter des amis, les voir en ligne et les inviter.</div></div></div>';
  }
  var ids = friendIds(), online = ids.filter(friendOnline).length;
  var reqIds = Object.keys(social.reqs).filter(function(k){ return social.reqs[k] && !social.friends[k]; });
  html += '<div class="row between"><div>👥 <strong>Amis</strong> <span class="muted" style="font-size:12.5px;">'+(ids.length ? online+' en ligne sur '+ids.length : 'aucun pour l\'instant')+'</span></div>'
    + '<button class="btn ghost small" data-action="friends-toggle">'+(social.open?'Masquer':'Voir')+(reqIds.length?' <span class="top-badge">'+reqIds.length+'</span>':'')+'</button></div>';
  if(social.open){
    reqIds.forEach(function(fid){
      html += '<div class="row between friend-row"><span>🔔 <strong>'+esc(social.reqs[fid].name)+'</strong> t\'a ajouté</span><span class="row" style="gap:6px;"><button class="btn small" data-action="friend-accept" data-id="'+esc(fid)+'">Ajouter aussi</button><button class="btn ghost small" data-action="friend-ignore" data-id="'+esc(fid)+'">✕</button></span></div>';
    });
    ids.forEach(function(fid){
      var on = friendOnline(fid), pr = social.presence[fid];
      html += '<div class="row between friend-row"><span><span class="dot '+(on?'on':'')+'"></span> '+esc(social.friends[fid].name)+' <span class="muted" style="font-size:12px;">· '+friendStatusText(fid)+'</span></span>'
        + (on && pr && pr.status==='lobby' && pr.code ? '<button class="btn small" data-action="friend-join" data-code="'+esc(pr.code)+'">Rejoindre</button>' : '<button class="btn ghost small" data-action="friend-remove" data-id="'+esc(fid)+'" title="Retirer">✕</button>')
        + '</div>';
    });
    html += '<div class="row" style="gap:6px; margin-top:10px;"><input type="text" id="friendPseudo" maxlength="24" placeholder="Pseudo de ton ami" style="flex:1; min-width:0;"><button class="btn secondary small" data-action="friend-add">Ajouter</button></div>';
    if(social.addErr) html += '<div class="error-text">'+esc(social.addErr)+'</div>';
    if(social.addOk) html += '<div style="margin-top:6px; font-size:13px; font-weight:700; color:var(--good,#3F8F6B);">'+esc(social.addOk)+'</div>';
  }
  return html + '</div>';
}
function renderLobbyInvite(g){
  var html = '<div class="card-panel" style="margin-bottom:12px; padding:14px 16px;"><div class="row between"><strong>Inviter</strong>'
    + '<button class="btn secondary small" data-action="share-link">📤 Partager le lien</button></div>';
  if(socialOn()){
    var ids = friendIds().filter(function(fid){ return !g.players[fid]; });
    if(!ids.length) html += '<div class="muted" style="font-size:12.5px; margin-top:6px;">Ajoute des amis depuis l\'accueil pour les inviter en un clic.</div>';
    ids.forEach(function(fid){
      var on = friendOnline(fid), sent = social.sent[fid] && nowMs() - social.sent[fid] < 60000;
      html += '<div class="row between friend-row"><span><span class="dot '+(on?'on':'')+'"></span> '+esc(social.friends[fid].name)+' <span class="muted" style="font-size:12px;">· '+friendStatusText(fid)+'</span></span>'
        + '<button class="btn small'+(sent?' secondary':'')+'" data-action="friend-invite" data-id="'+esc(fid)+'" '+(sent?'disabled':'')+'>'+(sent?'Invité ✓':'Inviter')+'</button></div>';
    });
  } else html += '<div class="muted" style="font-size:12.5px; margin-top:6px;">Envoie le lien : tes amis arrivent directement dans ce salon.</div>';
  return html + '</div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action'), id = el.getAttribute('data-id');
  if(a==='friends-toggle'){ social.open = !social.open; social.addErr=''; social.addOk=''; render(); }
  else if(a==='friend-add'){ var i = document.getElementById('friendPseudo'); addFriend(i ? i.value : ''); }
  else if(a==='friend-accept'){ acceptFriend(id).catch(console.error); }
  else if(a==='friend-ignore'){ ignoreFriend(id).catch(console.error); }
  else if(a==='friend-remove'){ if(confirmT('Retirer cet ami ?')) removeFriend(id).catch(console.error); }
  else if(a==='friend-invite'){ inviteFriend(id); }
  else if(a==='friend-join'){ entryMode='join'; joinGame(el.getAttribute('data-code'), myProfile.name || ''); }
  else if(a==='invite-accept'){ acceptInvite(id); }
  else if(a==='invite-dismiss'){ dismissInvite(id); }
  else if(a==='share-link' && gameDoc){ shareGameLink(gameDoc.code); }
});
document.addEventListener('keydown', function(e){
  if(e.key==='Enter' && e.target && e.target.id==='friendPseudo'){ e.preventDefault(); addFriend(e.target.value); }
});

