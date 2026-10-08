/* ===================== v18 : profils pseudo + code PIN =====================
   profiles/{clé}  { pseudo, key, playerId, color, salt, pinHash, createdAt }
   Le profil fixe l'identité du joueur (playerId) sur n'importe quel appareil : même cote de ligue partout.
   Sécurité volontairement simple (jeu entre amis) : PIN haché, jamais stocké en clair. */
var currentProfile = null;
var profileUi = { open:false, err:'', busy:false, fails:0, lockUntil:0 };
function loadProfileLocal(){ try{ return JSON.parse(localStorage.getItem('rikiki_profile')||'null'); }catch(e){ return null; } }
function saveProfileLocal(p){ try{ if(p) localStorage.setItem('rikiki_profile', JSON.stringify(p)); else localStorage.removeItem('rikiki_profile'); }catch(e){} }
function profileKey(pseudo){
  return (pseudo||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'').slice(0,24);
}
async function pinHash(key, salt, pin){
  var text = 'rikiki|'+key+'|'+salt+'|'+pin;
  if(window.crypto && crypto.subtle && window.TextEncoder){
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.prototype.map.call(new Uint8Array(buf), function(b){ return ('0'+b.toString(16)).slice(-2); }).join('');
  }
  var h = 2166136261; for(var i=0;i<text.length;i++){ h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return 'f'+h.toString(16);
}
function applyProfileIdentity(){
  // appelé au démarrage : le profil connecté impose son identité
  currentProfile = (usingFirebase || usingMock) ? loadProfileLocal() : null;
  if(currentProfile && currentProfile.playerId){
    myId = currentProfile.playerId;
    myProfile.name = currentProfile.pseudo;
    if(currentProfile.color) myProfile.color = currentProfile.color;
  }
}
function readProfileForm(){
  var ps = document.getElementById('profilePseudo'), pn = document.getElementById('profilePin');
  if(ps) profileUi.pseudo = ps.value; // garde la saisie si l'écran se redessine (message d'erreur)
  return { pseudo: ps ? ps.value.trim().slice(0,24) : '', pin: pn ? pn.value.trim() : '' };
}
function validPin(pin){ return /^[0-9]{4,6}$/.test(pin); } // connexion : les anciens codes (4 à 6 chiffres) restent valables
// v60 : tout NOUVEAU code fait 6 chiffres (1 000 000 de possibilités au lieu de 10 000) et n'est pas trop simple
function validNewPin(pin){
  if(!/^[0-9]{6}$/.test(pin)) return false;
  if(/^(\d)\1{5}$/.test(pin)) return false;                       // 000000, 111111…
  if('0123456789012345'.indexOf(pin)>=0 || '9876543210987654'.indexOf(pin)>=0) return false; // 123456, 654321…
  return ['121212','696969','112233','123123'].indexOf(pin)<0;
}
// v42 : noms qui se ressemblent (Tom / tom2 / Tôm / Thom…) parmi les joueurs qui ont déjà un profil en ligne
function looseName(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z]/g,''); }
function editDistance(a, b){
  var d = []; for(var i=0;i<=a.length;i++){ d[i] = [i]; } for(var j=0;j<=b.length;j++) d[0][j] = j;
  for(i=1;i<=a.length;i++) for(j=1;j<=b.length;j++) d[i][j] = Math.min(d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + (a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
}
function similarProfiles(pseudo){
  var a = looseName(pseudo); if(a.length < 2) return [];
  return league.members.filter(function(m){
    if(!m.userId) return false; // joueur « vraies cartes » sans profil : le relier est justement le but
    var b = looseName(m.name); if(b.length < 2) return false;
    return a===b || (Math.min(a.length,b.length) >= 3 && (a.indexOf(b)===0 || b.indexOf(a)===0)) || (Math.min(a.length,b.length) >= 4 && editDistance(a,b) <= 1);
  }).map(function(m){ return m.name; });
}
async function profileCreate(){
  var f = readProfileForm(), key = profileKey(f.pseudo);
  profileUi.err = '';
  if(key.length < 2){ profileUi.err = 'Choisis un pseudo d\'au moins 2 lettres ou chiffres.'; render(); return; }
  if(!validNewPin(f.pin)){ profileUi.err = 'Le code PIN doit faire 6 chiffres, pas trop simples (ni 123456, ni 000000…).'; render(); return; }
  if(profileUi.similarOk !== key){
    try{ await loadLeague(); }catch(e){}
    var sim = similarProfiles(f.pseudo);
    if(sim.length){
      profileUi.similarOk = key; profileUi.suggestForgot = authOn();
      profileUi.err = 'Il y a déjà « '+sim.slice(0,3).join(' », « ')+' » dans la ligue. Si c\'est toi, ne crée pas de nouveau profil : connecte-toi avec ce pseudo (ou « J\'ai oublié mon code »). Si c\'est quelqu\'un d\'autre, clique encore « Créer mon profil ».';
      render(); return;
    }
  }
  profileUi.busy = true; render();
  if(authOn()){
    try{ await authProfileCreate(f, key); }
    catch(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Impossible de créer le profil : '+authErrText(e)); render(); }
    return;
  }
  try{
    var ref = claudeDb.doc('profiles/'+key);
    var snap = await ref.get();
    if(snap.exists){ profileUi.busy=false; profileUi.err = 'Ce pseudo est déjà pris. Si c\'est le tien, clique « Se connecter ».'; render(); return; }
    var salt = Math.random().toString(36).slice(2,10);
    var doc = { pseudo:f.pseudo, key:key, playerId:myId, color:myProfile.color||'#C9A24B', salt:salt, pinHash: await pinHash(key, salt, f.pin), createdAt: nowMs() };
    await ref.set(doc);
    try{ await ensureMember({ userId: myId, name: f.pseudo, pkey: key }); }catch(e){ console.error(e); } // relie un membre IRL du même prénom
    saveProfileLocal({ key:key, pseudo:f.pseudo, playerId:myId, color:doc.color });
    try{ localStorage.setItem('rikiki_fb_name', f.pseudo); }catch(e){}
    location.reload();
  }catch(e){ console.error(e); profileUi.busy=false; profileUi.err = 'Impossible de créer le profil : '+dbErrorText(e); render(); }
}
async function profileLogin(){
  var f = readProfileForm(), key = profileKey(f.pseudo);
  profileUi.err = '';
  if(nowMs() < profileUi.lockUntil){ profileUi.err = 'Trop d\'essais : réessaie dans '+Math.ceil((profileUi.lockUntil-nowMs())/1000)+' s.'; render(); return; }
  if(key.length < 2 || !validPin(f.pin)){ profileUi.err = 'Entre ton pseudo et ton code PIN (4 à 6 chiffres).'; render(); return; }
  profileUi.busy = true; render();
  if(authOn()){
    try{ await authProfileLogin(f, key); }
    catch(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Connexion impossible : '+authErrText(e)); profileUi.suggestForgot = !!(e && e.forgot); render(); }
    return;
  }
  try{
    var snap = await claudeDb.doc('profiles/'+key).get();
    if(!snap.exists){ profileUi.busy=false; profileUi.err = 'Pseudo inconnu. Pour le créer, clique « Créer mon profil ».'; render(); return; }
    var d = snap.data();
    if(await pinHash(key, d.salt, f.pin) !== d.pinHash){
      profileUi.busy=false; profileUi.fails++;
      if(profileUi.fails >= 5){ profileUi.lockUntil = nowMs() + 30000; profileUi.fails = 0; }
      profileUi.err = 'Code PIN incorrect.'; render(); return;
    }
    if(d.mergedInto){ var ts = await claudeDb.doc('profiles/'+d.mergedInto).get(); if(ts.exists){ key = d.mergedInto; d = ts.data(); } } // doublon fusionné
    saveProfileLocal({ key:key, pseudo:d.pseudo, playerId:d.playerId, color:d.color });
    try{ localStorage.setItem('rikiki_fb_name', d.pseudo); localStorage.setItem('rikiki_fb_uid', d.playerId); localStorage.removeItem('rikiki_last'); }catch(e){}
    location.reload();
  }catch(e){ console.error(e); profileUi.busy=false; profileUi.err = 'Connexion impossible : '+dbErrorText(e); render(); }
}
async function profileLogout(){
  if(authOn()){ try{ await fbAuth.signOut(); }catch(e){ console.error(e); } }
  saveProfileLocal(null);
  try{
    localStorage.setItem('rikiki_fb_uid', 'p-'+Math.random().toString(36).slice(2,10)+nowMs().toString(36));
    localStorage.removeItem('rikiki_fb_name'); localStorage.removeItem('rikiki_last');
    sessionStorage.removeItem('rikiki_mock_uid');
  }catch(e){}
  location.reload();
}
function renderProfileBox(){
  if(!(usingFirebase || usingMock)) return '';
  var html = '<div class="card-panel" style="margin-bottom:12px; padding:14px 16px;">';
  if(currentProfile && authOn() && authAnon()){
    html += '<div><strong>🔒 Sécurise ton profil « '+esc(currentProfile.pseudo)+' »</strong><div class="muted" style="font-size:12.5px; margin:2px 0 8px;">Le jeu passe aux comptes sécurisés : confirme ton code une seule fois.</div></div>'
      + '<input type="hidden" id="profilePseudo" value="'+esc(currentProfile.pseudo)+'">'
      + '<input type="password" id="profilePin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Ton code" style="margin-bottom:10px;">'
      + '<div class="row"><button class="btn" style="flex:1;" data-action="profile-login" '+(profileUi.busy?'disabled':'')+'>Confirmer</button><button class="btn ghost" data-action="profile-logout">Ce n\'est pas moi</button></div>';
    if(profileUi.err) html += '<div class="error-text">'+esc(profileUi.err)+'</div>';
  } else if(currentProfile){
    html += '<div class="row between"><div>👤 Connecté : <strong>'+esc(currentProfile.pseudo)+'</strong><div class="muted" style="font-size:12px;">Tes parties comptent pour ton profil, sur n\'importe quel appareil.</div></div>'
      + '<button class="btn ghost" data-action="profile-logout">Se déconnecter</button></div>' + renderProfileExtras();
  } else if(!profileUi.open){
    html += '<div class="row between"><div>👤 Tu joues en <strong>invité</strong><div class="muted" style="font-size:12px;">Crée un profil pour la ligue et pour te retrouver sur tous tes appareils.</div></div>'
      + '<button class="btn secondary small" data-action="profile-open">Profil</button></div>';
  } else {
    html += '<div class="row between" style="margin-bottom:8px;"><strong>Mon profil</strong><button class="btn ghost" data-action="profile-close">✕</button></div>';
    html += '<label for="profilePseudo">Pseudo</label><input type="text" id="profilePseudo" maxlength="24" autocomplete="username" placeholder="Ton pseudo" value="'+esc(profileUi.pseudo!=null ? profileUi.pseudo : (myProfile.name||''))+'" style="margin-bottom:10px;">';
    html += '<label for="profilePin">Code PIN (6 chiffres)</label><input type="password" id="profilePin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" placeholder="••••" style="margin-bottom:12px;">';
    html += '<div class="row"><button class="btn" style="flex:1;" data-action="profile-login" '+(profileUi.busy?'disabled':'')+'>Se connecter</button>'
      + '<button class="btn secondary" style="flex:1;" data-action="profile-create" '+(profileUi.busy?'disabled':'')+'>Créer mon profil</button></div>';
    if(authOn()){
      if(profileUi.mode==='forgot'){
        html += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--line);"><strong style="font-size:14px;">Code oublié</strong><p class="muted" style="font-size:12.5px; margin:4px 0 8px;">Écris ton pseudo en haut, puis choisis un nouveau code : l\'organisateur validera que tu reprends ton profil (ta cote et ton historique sont gardés).</p>'
          + '<input type="password" id="forgotPin" inputmode="numeric" pattern="[0-9]*" maxlength="6" placeholder="Nouveau code (6 chiffres)" style="margin-bottom:8px;">'
          + '<div class="row"><button class="btn secondary small" style="flex:1;" data-action="profile-forgot-send" '+(profileUi.busy?'disabled':'')+'>Envoyer la demande</button><button class="btn ghost small" data-action="profile-mode" data-mode="">Annuler</button></div></div>';
      } else if(profileUi.suggestForgot){ // v42 : après un mauvais code, on propose tout de suite la bonne porte (au lieu de recréer un profil)
        html += '<div style="margin-top:12px; padding:10px 12px; border:1.5px solid var(--line); border-radius:12px;"><strong style="font-size:14px;">Tu ne retrouves plus ton code ?</strong>'
          + '<p class="muted" style="font-size:12.5px; margin:4px 0 8px;">Ne crée pas de nouveau profil : tu perdrais ta cote et ton historique. Choisis un nouveau code, l\'organisateur le valide.</p>'
          + '<button class="btn secondary small" data-action="profile-mode" data-mode="forgot">J\'ai oublié mon code →</button></div>';
      } else html += '<button class="btn ghost" style="font-size:12.5px; margin-top:6px;" data-action="profile-mode" data-mode="forgot">Code oublié ?</button>';
      if(profileUi.ok) html += '<div style="margin-top:8px; font-size:13.5px; font-weight:700; color:var(--good, #3F8F6B);">'+esc(profileUi.ok)+'</div>';
    }
    html += '<p class="muted" style="font-size:11.5px; margin:8px 0 0;">'+(authOn() ? 'Ton code est vérifié par Google et n\'est stocké nulle part dans le jeu.' : 'Code oublié ? Demande à l\'organisateur de t\'en générer un nouveau.')+' Sécurité simple, entre amis : n\'utilise pas le code de ta carte bancaire 😉</p>';
    if(profileUi.err) html += '<div class="error-text">'+esc(profileUi.err)+'</div>';
  }
  html += '</div>';
  return html;
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='profile-open'){ profileUi.open=true; profileUi.err=''; render(); var i=document.getElementById('profilePseudo'); if(i) i.focus(); }
  else if(a==='profile-close'){ profileUi.open=false; profileUi.err=''; render(); }
  else if(a==='profile-create'){ profileCreate(); }
  else if(a==='profile-login'){ profileLogin(); }
  else if(a==='profile-logout'){ profileLogout(); }
});
document.addEventListener('keydown', function(e){
  if(e.key==='Enter' && e.target && (e.target.id==='profilePin' || e.target.id==='profilePseudo')){ e.preventDefault(); profileLogin(); }
});

/* ===================== v19 : code oublié, changement de code, déménagement du site ===================== */
// Pseudos qui peuvent réinitialiser le code PIN d'un ami (l'organisateur de la ligue).
var ADMIN_PSEUDOS = ['K.vroom'];
// Nouvelle adresse du jeu. Laisse vide tant qu'il n'y a pas de déménagement.
// Quand c'est rempli, l'ancienne adresse renvoie automatiquement chacun vers la nouvelle, avec son identité.
var MOVED_TO = 'https://rikikigame.github.io/rikikigame/';

function isAdmin(){
  if(!currentProfile) return false;
  if(authOn()) return !authAnon() && !!adminUid && adminUid===authUid(); // en ligne : l'organisateur est un COMPTE
  return ADMIN_PSEUDOS.map(profileKey).indexOf(currentProfile.key) >= 0;  // mode local de test
}

// --- déménagement : l'ancienne adresse transmet l'identité locale à la nouvelle ---
function migrationRedirectIfNeeded(){
  if(!MOVED_TO) return false;
  var target = MOVED_TO.replace(/\/+$/,'') + '/';
  var here = (location.origin + location.pathname).replace(/index\.html$/,'').replace(/\/+$/,'') + '/';
  if(here === target) return false;
  var payload = {};
  try{
    ['rikiki_fb_uid','rikiki_fb_name','rikiki_fb_color','rikiki_profile','rikiki_last'].forEach(function(k){ var v = localStorage.getItem(k); if(v!=null) payload[k] = v; });
  }catch(e){}
  location.replace(target + (location.search || '') + '#import=' + encodeURIComponent(JSON.stringify(payload))); // le code de partie (?game=…) suit aussi
  return true;
}
function migrationImportIfPresent(){
  var h = location.hash || '';
  if(h.indexOf('#import=') !== 0) return;
  try{
    var payload = JSON.parse(decodeURIComponent(h.slice(8)));
    var hasOwn = !!localStorage.getItem('rikiki_profile'); // ne pas écraser un profil déjà connecté ici
    if(!hasOwn){
      Object.keys(payload).forEach(function(k){
        if(['rikiki_fb_uid','rikiki_fb_name','rikiki_fb_color','rikiki_profile','rikiki_last'].indexOf(k) >= 0) localStorage.setItem(k, payload[k]);
      });
    }
  }catch(e){ console.error(e); }
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){ location.hash = ''; }
}

// --- changer son code ---
async function profileChangePin(){
  var cur = (document.getElementById('pinCurrent')||{}).value || '', nw = (document.getElementById('pinNew')||{}).value || '';
  profileUi.err = ''; profileUi.ok = '';
  if(!validNewPin(nw)){ profileUi.err = 'Le nouveau code doit faire 6 chiffres, pas trop simples (ni 123456, ni 000000…).'; render(); return; }
  profileUi.busy = true; render();
  if(authOn()){
    try{ await authChangePin(cur.trim(), nw.trim()); profileUi.busy=false; profileUi.mode=null; profileUi.ok='Code changé ✓'; }
    catch(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Impossible de changer le code : '+authErrText(e)); }
    render(); return;
  }
  try{
    var ref = claudeDb.doc('profiles/'+currentProfile.key);
    var snap = await ref.get(); if(!snap.exists){ throw new Error('profil introuvable'); }
    var d = snap.data();
    if(await pinHash(d.key, d.salt, cur.trim()) !== d.pinHash){ profileUi.busy=false; profileUi.err = 'Code actuel incorrect.'; render(); return; }
    var salt = Math.random().toString(36).slice(2,10);
    await ref.set(Object.assign({}, d, { salt:salt, pinHash: await pinHash(d.key, salt, nw.trim()), pinChangedAt: nowMs() }));
    profileUi.busy=false; profileUi.mode=null; profileUi.ok = 'Code changé ✓'; render();
  }catch(e){ console.error(e); profileUi.busy=false; profileUi.err = 'Impossible de changer le code : '+dbErrorText(e); render(); }
}
// --- l'admin génère un nouveau code pour un ami qui a oublié le sien ---
async function profileAdminReset(){
  if(!isAdmin()) return;
  var who = ((document.getElementById('resetPseudo')||{}).value || '').trim(), key = profileKey(who);
  profileUi.err = ''; profileUi.ok = '';
  if(key.length < 2){ profileUi.err = 'Entre le pseudo de ton ami.'; render(); return; }
  profileUi.busy = true; render();
  try{
    var ref = claudeDb.doc('profiles/'+key);
    var snap = await ref.get();
    if(!snap.exists){ profileUi.busy=false; profileUi.err = 'Aucun profil « '+who+' ».'; render(); return; }
    var d = snap.data(), pin = String(Math.floor(1000 + Math.random()*9000)), salt = Math.random().toString(36).slice(2,10);
    await ref.set(Object.assign({}, d, { salt:salt, pinHash: await pinHash(d.key, salt, pin), pinResetAt: nowMs(), pinResetBy: currentProfile.pseudo }));
    profileUi.busy=false; profileUi.ok = 'Nouveau code de '+d.pseudo+' : '+pin+' — envoie-le lui, il pourra le changer ensuite.'; render();
  }catch(e){ console.error(e); profileUi.busy=false; profileUi.err = 'Réinitialisation impossible : '+dbErrorText(e); render(); }
}
// demandes « code oublié » en attente (profil de l'organisateur ET bandeau de son accueil)
function renderClaimsList(){
  if(!(isAdmin() && authOn() && profileClaimsList.length)) return '';
  return '<div style="margin-top:8px;"><strong style="font-size:13.5px;">🔑 Demandes « code oublié »</strong>' + profileClaimsList.map(function(c){
    var mine = currentProfile && c.id === currentProfile.key; // v57 : quelqu'un demande à prendre le profil de l'organisateur
    return '<div class="row between" style="margin-top:6px; gap:6px;"><span style="flex:1; min-width:0;">'+esc(c.pseudo)+' <span class="muted" style="font-size:12px;">('+new Date(c.at).toLocaleString('fr-BE')+')</span>'
      + (mine ? '<br><strong class="pts-neg" style="font-size:12.5px;">⛔ C\'est TON profil d\'organisateur : quelqu\'un essaie de le prendre. Refuse.</strong>' : '') + '</span>'
      + (mine ? '' : '<button class="btn small" data-action="claim-approve" data-key="'+esc(c.id)+'">Valider</button>')
      + '<button class="btn ghost small" data-action="claim-refuse" data-key="'+esc(c.id)+'">Refuser</button></div>';
  }).join('') + '<div class="muted" style="font-size:11.5px; margin-top:4px;">Ne valide que si l\'ami te l\'a demandé lui-même, de vive voix ou par message. Valider donne le profil (et ses points) à la personne qui a fait la demande.</div></div>';
}
function renderProfileExtras(){
  var html = '';
  if(profileUi.mode==='change'){
    html += '<div style="margin-top:10px;"><label for="pinCurrent">Code actuel</label><input type="password" id="pinCurrent" inputmode="numeric" pattern="[0-9]*" maxlength="6" style="margin-bottom:8px;">'
      + '<label for="pinNew">Nouveau code (6 chiffres)</label><input type="password" id="pinNew" inputmode="numeric" pattern="[0-9]*" maxlength="6" style="margin-bottom:10px;">'
      + '<div class="row"><button class="btn" style="flex:1;" data-action="profile-change-pin" '+(profileUi.busy?'disabled':'')+'>Enregistrer</button><button class="btn secondary" data-action="profile-mode" data-mode="">Annuler</button></div></div>';
  } else if(profileUi.mode==='reset'){
    html += '<div style="margin-top:10px;"><label for="resetPseudo">Pseudo de l\'ami qui a oublié son code</label><input type="text" id="resetPseudo" maxlength="24" style="margin-bottom:10px;">'
      + '<div class="row"><button class="btn" style="flex:1;" data-action="profile-admin-reset" '+(profileUi.busy?'disabled':'')+'>Générer un nouveau code</button><button class="btn secondary" data-action="profile-mode" data-mode="">Fermer</button></div></div>';
  } else if(profileUi.mode==='merge' && isAdmin()){
    html += '<div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--line);"><strong style="font-size:14px;">Regrouper deux profils</strong>'
      + '<p class="muted" style="font-size:12.5px; margin:4px 0 8px;">Pour un ami qui s\'est recréé un profil. Ses parties, sa cote et ses deux pseudos mènent ensuite au profil principal.</p>'
      + '<label for="mergeDup">Doublon (le profil en trop)</label><input type="text" id="mergeDup" maxlength="24" placeholder="ex. Tom2" style="margin-bottom:8px;">'
      + '<label for="mergeMain">Profil principal (celui à garder)</label><input type="text" id="mergeMain" maxlength="24" placeholder="ex. Tom" style="margin-bottom:8px;">'
      + '<label for="mergeKeep">Code pour se connecter</label><select id="mergeKeep" style="margin-bottom:10px;"><option value="dup">celui du doublon (le code dont il se souvient)</option><option value="main">celui du profil principal</option></select>'
      + '<div class="row"><button class="btn" style="flex:1;" data-action="profile-merge" '+(profileUi.busy?'disabled':'')+'>Regrouper</button><button class="btn secondary" data-action="profile-mode" data-mode="">Fermer</button></div></div>';
  } else if(profileUi.mode==='mergeMembers' && isAdmin()){
    var opts = league.members.slice().sort(function(a,b){ return normName(a.name) < normName(b.name) ? -1 : 1; })
      .map(function(m){ return '<option value="'+esc(m.id)+'">'+esc(m.name)+(m.userId ? '' : ' (vraies cartes)')+'</option>'; }).join('');
    html += '<div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--line);"><strong style="font-size:14px;">Regrouper deux joueurs du classement</strong>'
      + '<p class="muted" style="font-size:12.5px; margin:4px 0 8px;">Pour les noms tapés deux fois en vraies cartes (« Tom » et « Thomas »). Ne touche pas aux profils.</p>'
      + (league.loaded ? '<label for="mmDup">Doublon</label><select id="mmDup" style="margin-bottom:8px;">'+opts+'</select><label for="mmMain">Compte pour</label><select id="mmMain" style="margin-bottom:10px;">'+opts+'</select>'
         + '<div class="row"><button class="btn" style="flex:1;" data-action="member-merge" '+(profileUi.busy?'disabled':'')+'>Regrouper</button><button class="btn secondary" data-action="profile-mode" data-mode="">Fermer</button></div>'
         : '<p class="muted">Chargement du classement…</p>')
      + '</div>';
  } else {
    html += '<div class="row" style="margin-top:8px; gap:6px; flex-wrap:wrap;"><button class="btn ghost" data-action="profile-mode" data-mode="change">Changer mon code</button>'
      + ((isAdmin() && !authOn()) ? '<button class="btn ghost" data-action="profile-mode" data-mode="reset">Code oublié d\'un ami</button>' : '')
      + (isAdmin() ? '<button class="btn ghost" data-action="profile-mode" data-mode="merge">Regrouper deux profils</button><button class="btn ghost" data-action="profile-mode" data-mode="mergeMembers">Regrouper deux joueurs</button>' : '') + '</div>';
  }
  if(isAdmin()){
    html += '<div class="muted" style="font-size:12px; margin-top:8px;">⭐ Tu es l\'organisateur.</div>';
    html += renderClaimsList();
  }
  if(profileUi.err) html += '<div class="error-text">'+esc(profileUi.err)+'</div>';
  if(profileUi.ok) html += '<div style="margin-top:8px; font-size:13.5px; font-weight:700; color:var(--good, #3F8F6B);">'+esc(profileUi.ok)+'</div>';
  return html;
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='profile-mode'){ readProfileForm(); profileUi.mode = el.getAttribute('data-mode') || null; profileUi.err=''; profileUi.ok=''; render();
    if(profileUi.mode==='mergeMembers') loadLeague(true); }
  else if(a==='profile-merge'){
    var dup = ((document.getElementById('mergeDup')||{}).value||'').trim(), main = ((document.getElementById('mergeMain')||{}).value||'').trim(), keep = (document.getElementById('mergeKeep')||{}).value || 'dup';
    if(!confirmT('Regrouper « '+dup+' » dans « '+main+' » ? On ne peut pas l\'annuler depuis le jeu.')) return;
    profileUi.err=''; profileUi.ok=''; profileUi.busy = true; render();
    mergeProfiles(dup, main, keep).then(function(msg){ profileUi.busy=false; profileUi.mode=null; profileUi.ok=msg; render(); })
      .catch(function(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Regroupement impossible : '+dbErrorText(e)); render(); });
  }
  else if(a==='member-merge'){
    var d1 = (document.getElementById('mmDup')||{}).value, m1 = (document.getElementById('mmMain')||{}).value;
    var n1 = memberById(d1), n2 = memberById(m1);
    if(!confirmT('Les parties de « '+(n1?n1.name:'?')+' » compteront pour « '+(n2?n2.name:'?')+' ». Continuer ?')) return;
    profileUi.err=''; profileUi.ok=''; profileUi.busy = true; render();
    mergeMembers(d1, m1).then(function(msg){ profileUi.busy=false; profileUi.mode=null; profileUi.ok=msg; render(); })
      .catch(function(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Regroupement impossible : '+dbErrorText(e)); render(); });
  }
  else if(a==='claim-refuse'){ var kr = el.getAttribute('data-key'); refuseClaim(kr).then(function(){ profileUi.ok='Demande refusée.'; render(); }).catch(function(e){ console.error(e); profileUi.err='Impossible : '+authErrText(e); render(); }); }
  else if(a==='profile-forgot-send'){
    var f = readProfileForm(), key = profileKey(f.pseudo), np = ((document.getElementById('forgotPin')||{}).value||'').trim();
    profileUi.err=''; profileUi.ok='';
    if(key.length<2){ profileUi.err='Entre ton pseudo.'; render(); return; }
    if(!validNewPin(np)){ profileUi.err='Le nouveau code doit faire 6 chiffres, pas trop simples (ni 123456, ni 000000…).'; render(); return; }
    profileUi.busy = true; render();
    authForgot({ pseudo:f.pseudo, pin:np }, key).then(function(){ profileUi.busy=false; profileUi.mode=null; profileUi.suggestForgot=false; profileUi.ok='Demande envoyée ✓ L\'organisateur la voit sur son accueil. Dès qu\'il valide, connecte-toi avec ton pseudo et ton NOUVEAU code.'; render(); })
      .catch(function(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Demande impossible : '+authErrText(e)); render(); });
  }
  else if(a==='claim-admin'){ claimAdmin().then(function(){ loadClaims().then(render); }).catch(function(e){ console.error(e); profileUi.err='Impossible : '+authErrText(e); render(); }); }
  else if(a==='claim-approve'){ var k = el.getAttribute('data-key'); approveClaim(k).then(function(){ profileUi.ok='Validé ✓ Ton ami peut se connecter avec son nouveau code.'; render(); }).catch(function(e){ console.error(e); profileUi.err='Validation impossible : '+authErrText(e); render(); }); }
  else if(a==='profile-change-pin'){ profileChangePin(); }
  else if(a==='profile-admin-reset'){ profileAdminReset(); }
});

