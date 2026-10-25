/* ===================== v18 : profils pseudo + code PIN =====================
   profiles/{clé}  { pseudo, key, playerId, color, salt, pinHash, createdAt }
   Le profil fixe l'identité du joueur (playerId) sur n'importe quel appareil : même cote de ligue partout.
   Sécurité volontairement simple (jeu entre amis) : PIN haché, jamais stocké en clair. */
var currentProfile = null;
var profileUi = { open:false, tab:null, err:'', busy:false, fails:0, lockUntil:0 };
// v73 : après « Créer mon profil » / « Se connecter », la page se recharge : on garde un message de confirmation pour l'afficher ensuite
var profileFlash = null;
try{ var pf0 = JSON.parse(localStorage.getItem('rikiki_flash') || 'null'); localStorage.removeItem('rikiki_flash'); if(pf0 && Date.now()-pf0.at < 120000) profileFlash = pf0; }catch(e){}
function setFlash(kind, pseudo){ try{ localStorage.setItem('rikiki_flash', JSON.stringify({ kind:kind, pseudo:pseudo||'', at:Date.now() })); }catch(e){} }
function renderProfileFlash(){
  if(!profileFlash) return '';
  var f = profileFlash, nm = esc(f.pseudo||'');
  var msg = f.kind==='created' ? '<strong>✅ Profil créé !</strong> Tu es connecté en tant que « '+nm+' ». Garde bien ton pseudo et ton code : ils te permettent de te reconnecter sur un autre appareil.'
    : f.kind==='login' ? '<strong>✅ Connecté</strong> en tant que « '+nm+' ». Tes parties comptent pour ton profil.'
    : f.kind==='deleted' ? '<strong>Ton compte a été supprimé.</strong> Ton accès, tes amis et ta présence sont effacés. Merci d\'avoir joué !'
    : '<strong>Tu es déconnecté.</strong> Tu joues maintenant en invité. Pour retrouver ton profil : « Me connecter ».';
  return '<div class="flash" role="status"><span>'+msg+'</span><button class="flash-x" data-action="flash-close" aria-label="Fermer ce message">✕</button></div>';
}
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
  var tm = document.getElementById('profileTerms'); if(tm) profileUi.terms = !!tm.checked; // v73 : la case survit à un réaffichage
  return { pseudo: ps ? ps.value.trim().slice(0,24) : '', pin: pn ? pn.value.trim() : '', terms: !!profileUi.terms };
}
function validPin(pin){ return /^[0-9]{4,6}$/.test(pin); } // connexion : les anciens codes (4 à 6 chiffres) restent valables
// v73 : tout NOUVEAU code fait 4 chiffres (choix du propriétaire : simple à retenir) et n'est pas trop simple.
// (v60 l'avait mis à 6 chiffres : 1 000 000 de possibilités au lieu de 10 000. Les codes de 6 chiffres déjà créés continuent de marcher à la connexion.)
// Le mot de passe Firebase est « rikiki: » + code : il dépasse toujours les 6 caractères minimum exigés par Firebase.
function validNewPin(pin){
  if(!/^[0-9]{4}$/.test(pin)) return false;
  if(/^(\d)\1{3}$/.test(pin)) return false;                                                    // 0000, 1111…
  if('01234567890123'.indexOf(pin)>=0 || '98765432109876'.indexOf(pin)>=0) return false;       // 1234, 4321, 6789…
  return ['1212','2121','6969','1122','2580','1313','2000'].indexOf(pin)<0;
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
  if(LEGAL_READY && !f.terms){ profileUi.err = 'Pour créer ton profil, coche la case : tu as 13 ans ou plus et tu acceptes les conditions.'; render(); return; }
  if(key.length < 2){ profileUi.err = 'Choisis un pseudo d\'au moins 2 lettres ou chiffres.'; render(); return; }
  if(!validNewPin(f.pin)){ profileUi.err = 'Le code PIN doit faire 4 chiffres, pas trop simples (ni 1234, ni 0000…).'; render(); return; }
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
    setFlash('created', f.pseudo); location.reload();
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
    setFlash('login', d.pseudo); location.reload();
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
  setFlash('logout', ''); location.reload();
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
    html += '<div class="row between"><div>👤 Connecté : <strong>'+esc(currentProfile.pseudo)+crownMark(myId, currentProfile.pseudo, authUid())+'</strong><div class="muted" style="font-size:12px;">Tes parties comptent pour ton profil, sur n\'importe quel appareil.</div></div>'
      + '<button class="btn ghost" data-action="profile-logout">Se déconnecter</button></div>' + renderBadges() + renderProfileExtras() + renderDeleteAccount();
  } else if(!profileUi.tab){
    // v73 : un choix clair dès l'ouverture, au lieu d'un seul formulaire avec deux boutons
    html += '<div class="row between" style="margin-bottom:6px;"><strong>👤 Tu joues en invité</strong><button class="btn ghost" data-action="profile-close" aria-label="Fermer">✕</button></div>'
      + '<p class="muted" style="font-size:13px; margin:0 0 12px;">Un profil (pseudo + code) te permet de te retrouver sur tous tes appareils et de compter dans la ligue. Sans profil, tu peux jouer quand même.</p>'
      + '<div class="profile-choice"><button class="btn" data-action="profile-tab" data-tab="create">Créer mon profil<small>Je n\'en ai pas encore</small></button>'
      + '<button class="btn secondary" data-action="profile-tab" data-tab="login">Me connecter<small>J\'ai déjà un profil</small></button></div>';
  } else {
    var creating = profileUi.tab==='create';
    html += '<div class="row between" style="margin-bottom:8px;"><strong>'+(creating ? 'Créer mon profil' : 'Me connecter')+'</strong><button class="btn ghost" data-action="profile-close" aria-label="Fermer">✕</button></div>';
    html += '<div class="toggle-row profile-tabs" role="tablist" aria-label="Profil"><button class="btn secondary small'+(creating?' active':'')+'" role="tab" aria-selected="'+creating+'" data-action="profile-tab" data-tab="create">Nouveau profil</button>'
      + '<button class="btn secondary small'+(!creating?' active':'')+'" role="tab" aria-selected="'+(!creating)+'" data-action="profile-tab" data-tab="login">J\'ai déjà un profil</button></div>';
    html += '<p class="muted" style="font-size:13px; margin:0 0 10px;">'+(creating
      ? 'Choisis un pseudo et un code à 4 chiffres que tu retiendras (ni 1234, ni 0000). Tu en auras besoin pour te reconnecter.'
      : 'Entre le pseudo et le code de ton profil.')+'</p>';
    html += '<label for="profilePseudo">Pseudo</label><input type="text" id="profilePseudo" maxlength="24" autocomplete="username" placeholder="Ton pseudo" value="'+esc(profileUi.pseudo!=null ? profileUi.pseudo : (myProfile.name||''))+'" style="margin-bottom:10px;">';
    html += '<label for="profilePin">'+(creating ? 'Code (4 chiffres)' : 'Code PIN')+'</label><input type="password" id="profilePin" inputmode="numeric" pattern="[0-9]*" maxlength="'+(creating?'4':'6')+'" autocomplete="'+(creating?'new-password':'current-password')+'" placeholder="••••" style="margin-bottom:12px;">';
    if(creating){
      if(LEGAL_READY) html += '<label class="terms-row"><input type="checkbox" id="profileTerms"'+(profileUi.terms?' checked':'')+'> <span>J\'ai 13 ans ou plus et j\'accepte les <a href="'+legalHref('conditions.html')+'" target="_blank" rel="noopener">conditions d\'utilisation</a> et la <a href="'+legalHref('confidentialite.html')+'" target="_blank" rel="noopener">politique de confidentialité</a>.</span></label>';
      html += '<button class="btn" style="width:100%;" data-action="profile-create" '+(profileUi.busy?'disabled':'')+'>Créer mon profil</button>';
    } else {
      html += '<button class="btn" style="width:100%;" data-action="profile-login" '+(profileUi.busy?'disabled':'')+'>Se connecter</button>';
    }
    if(profileUi.err){
      html += '<div class="error-text" role="alert">'+esc(profileUi.err)+'</div>';
      // v73 : la bonne porte est proposée tout de suite
      if(/^Pseudo inconnu/.test(profileUi.err)) html += '<button class="btn secondary small" style="margin-top:6px;" data-action="profile-tab" data-tab="create">Créer ce profil</button>';
      else if(/déjà pris/.test(profileUi.err)) html += '<button class="btn secondary small" style="margin-top:6px;" data-action="profile-tab" data-tab="login">C\'est moi : me connecter</button>';
    }
    if(authOn() && !creating){
      if(profileUi.mode==='forgot'){
        html += '<div style="margin-top:12px; padding-top:10px; border-top:1px solid var(--line);"><strong style="font-size:14px;">Code oublié</strong><p class="muted" style="font-size:12.5px; margin:4px 0 8px;">Écris ton pseudo en haut, puis choisis un nouveau code : l\'organisateur validera que tu reprends ton profil (ta cote et ton historique sont gardés).</p>'
          + '<input type="password" id="forgotPin" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="Nouveau code (4 chiffres)" style="margin-bottom:8px;">'
          + '<div class="row"><button class="btn secondary small" style="flex:1;" data-action="profile-forgot-send" '+(profileUi.busy?'disabled':'')+'>Envoyer la demande</button><button class="btn ghost small" data-action="profile-mode" data-mode="">Annuler</button></div></div>';
      } else if(profileUi.suggestForgot){ // v42 : après un mauvais code, on propose tout de suite la bonne porte (au lieu de recréer un profil)
        html += '<div style="margin-top:12px; padding:10px 12px; border:1.5px solid var(--line); border-radius:12px;"><strong style="font-size:14px;">Tu ne retrouves plus ton code ?</strong>'
          + '<p class="muted" style="font-size:12.5px; margin:4px 0 8px;">Ne crée pas de nouveau profil : tu perdrais ta cote et ton historique. Choisis un nouveau code, l\'organisateur le valide.</p>'
          + '<button class="btn secondary small" data-action="profile-mode" data-mode="forgot">J\'ai oublié mon code →</button></div>';
      } else html += '<button class="btn ghost" style="font-size:12.5px; margin-top:6px;" data-action="profile-mode" data-mode="forgot">Code oublié ?</button>';
      if(profileUi.ok) html += '<div style="margin-top:8px; font-size:13.5px; font-weight:700; color:var(--good, #3F8F6B);">'+esc(profileUi.ok)+'</div>';
    }
    html += '<p class="muted" style="font-size:11.5px; margin:8px 0 0;">'+(authOn() ? 'Ton code est vérifié par Google et n\'est stocké nulle part dans le jeu.' : 'Code oublié ? Demande à l\'organisateur de t\'en générer un nouveau.')+' Sécurité simple, entre amis : n\'utilise pas le code de ta carte bancaire 😉</p>';
  }
  html += '</div>';
  return html;
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='profile-open'){ profileUi.open=true; profileUi.err=''; profileUi.tab=el.getAttribute('data-tab')||profileUi.tab; render(); var i=document.getElementById('profilePseudo'); if(i) i.focus(); }
  else if(a==='profile-tab'){ readProfileForm(); profileUi.pseudo = (document.getElementById('profilePseudo')||{}).value != null ? document.getElementById('profilePseudo').value : profileUi.pseudo; profileUi.tab = el.getAttribute('data-tab'); profileUi.err=''; profileUi.mode=null; render(); var i2=document.getElementById('profilePseudo'); if(i2) i2.focus(); }
  else if(a==='flash-close'){ profileFlash = null; render(); }
  else if(a==='profile-close'){ if(profileUi.tab){ profileUi.tab=null; } else { profileUi.open=false; } profileUi.err=''; render(); }
  else if(a==='profile-create'){ profileCreate(); }
  else if(a==='profile-login'){ profileLogin(); }
  else if(a==='profile-logout'){ profileLogout(); }
  else if(a==='delete-account-open'){ profileUi.deleting = true; profileUi.err = ''; profileUi.deleteConfirm = false; profileUi.delPseudo = ''; profileUi.delPin = ''; render(); }
  else if(a==='delete-account-cancel'){ profileUi.deleting = false; profileUi.err = ''; profileUi.deleteConfirm = false; profileUi.delPseudo = ''; profileUi.delPin = ''; render(); }
  else if(a==='delete-account-go'){ deleteMyAccount(); }
});
document.addEventListener('keydown', function(e){
  if(e.key==='Enter' && e.target && (e.target.id==='profilePin' || e.target.id==='profilePseudo')){ e.preventDefault(); if(profileUi.tab==='create') profileCreate(); else profileLogin(); } // v73 : Entrée fait l'action de l'écran (créer OU se connecter)
});

/* ===================== v19 : code oublié, changement de code, déménagement du site ===================== */
// Pseudos qui peuvent réinitialiser le code PIN d'un ami (l'organisateur de la ligue).
var ADMIN_PSEUDOS = ['K.vroom'];
// Nouvelle adresse du jeu. Laisse vide tant qu'il n'y a pas de déménagement.
// Quand c'est rempli, l'ancienne adresse renvoie automatiquement chacun vers la nouvelle, avec son identité.
var MOVED_TO = ''; // v79 : VIDE. Le domaine rikikigame.com est branché sur GitHub Pages : l'ancienne adresse est redirigée par GitHub lui-même (301). Ne JAMAIS remettre une adresse ici tant que le jeu est servi à cette adresse : le jeu se renvoie en boucle (vu le 24/10).

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
  if(!validNewPin(nw)){ profileUi.err = 'Le nouveau code doit faire 4 chiffres, pas trop simples (ni 1234, ni 0000…).'; render(); return; }
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
      + '<label for="pinNew">Nouveau code (4 chiffres)</label><input type="password" id="pinNew" inputmode="numeric" pattern="[0-9]*" maxlength="4" style="margin-bottom:10px;">'
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
    if(!validNewPin(np)){ profileUi.err='Le nouveau code doit faire 4 chiffres, pas trop simples (ni 1234, ni 0000…).'; render(); return; }
    profileUi.busy = true; render();
    authForgot({ pseudo:f.pseudo, pin:np }, key).then(function(){ profileUi.busy=false; profileUi.mode=null; profileUi.suggestForgot=false; profileUi.ok='Demande envoyée ✓ L\'organisateur la voit sur son accueil. Dès qu\'il valide, connecte-toi avec ton pseudo et ton NOUVEAU code.'; render(); })
      .catch(function(e){ console.error(e); profileUi.busy=false; profileUi.err = e.ui || ('Demande impossible : '+authErrText(e)); render(); });
  }
  else if(a==='claim-admin'){ claimAdmin().then(function(){ loadClaims().then(render); }).catch(function(e){ console.error(e); profileUi.err='Impossible : '+authErrText(e); render(); }); }
  else if(a==='claim-approve'){ var k = el.getAttribute('data-key'); approveClaim(k).then(function(){ profileUi.ok='Validé ✓ Ton ami peut se connecter avec son nouveau code.'; render(); }).catch(function(e){ console.error(e); profileUi.err='Validation impossible : '+authErrText(e); render(); }); }
  else if(a==='profile-change-pin'){ profileChangePin(); }
  else if(a==='profile-admin-reset'){ profileAdminReset(); }
});


// v76 : à la fin d'une partie, un invité reçoit une invitation à créer un profil (pseudo déjà rempli avec son prénom de partie)
var signupNudgeHidden = false;
function signupNudgeHtml(g){
  if(signupNudgeHidden || currentProfile || !(usingFirebase || usingMock) || !g.players[myId]) return '';
  var name = esc(g.players[myId].name);
  return '<div class="card-panel signup-nudge" style="margin-top:14px;"><div class="row between"><div class="eyebrow">👤 Tu joues en invité</div><button class="btn ghost" data-action="signup-nudge-hide" aria-label="Fermer">✕</button></div>'
    + '<p style="margin:6px 0 10px;">Avec un profil : ta fiche dans la ligue, tes duels (pire ennemi, victime préférée), tes récompenses, et tu te retrouves sur tous tes appareils. 20 secondes, un pseudo et un code à 4 chiffres.</p>'
    + '<button class="btn" style="width:100%;" data-action="signup-nudge-go">Créer mon profil « '+name+' »</button></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="signup-nudge-go"],[data-action="signup-nudge-hide"]') : null; if(!el) return;
  if(el.getAttribute('data-action')==='signup-nudge-hide'){ signupNudgeHidden = true; render(); return; }
  if(gameDoc && gameDoc.players && gameDoc.players[myId]) myProfile.name = gameDoc.players[myId].name; // le pseudo proposé = mon prénom de partie
  leaveToEntry(); homeProfileOpen = true; profileUi.open = true; profileUi.tab = 'create'; profileUi.err = ''; profileUi.pseudo = null; render();
});

// v79 : « Supprimer mon compte » (obligatoire pour l'App Store, et droit à l'effacement). Faisable sans changer les règles Firebase :
// on efface ce que le joueur a le droit d'effacer (accès de connexion, amis, présence), on vide son profil, et on supprime son compte de connexion.
// Limites : le pseudo reste dans les parties de ligue déjà enregistrées (jamais réécrites) ; la clé du profil (le pseudo en minuscules) reste réservée jusqu'à purge par l'organisateur.
var DELETED_EMAIL = 'supprime@rikiki.invalid';
function renderDeleteAccount(){
  if(!(authOn() && currentProfile)) return '';
  if(isAdmin()) return '';
  if(!profileUi.deleting) return '<div style="margin-top:10px;"><button class="btn ghost small" data-action="delete-account-open">Supprimer mon compte</button></div>';
  var step2 = !!profileUi.deleteConfirm;
  return '<div class="delete-panel" role="group" aria-label="Supprimer mon compte"><strong>🗑️ Supprimer mon compte « '+esc(currentProfile.pseudo)+' »</strong>'
    + '<p class="muted" style="font-size:13px; margin:6px 0 8px;">Ton accès (pseudo + code), tes amis et ta présence en ligne sont effacés. <b>Ça ne se rattrape pas.</b> Ton pseudo peut rester dans l\'historique des parties de ligue déjà jouées (il reste visible comme avant).</p>'
    + '<label for="deletePseudo">Écris ton pseudo pour confirmer</label><input type="text" id="deletePseudo" maxlength="24" autocomplete="off" value="'+esc(profileUi.delPseudo||'')+'" style="margin-bottom:8px;">'
    + '<label for="deletePin">Ton code</label><input type="password" id="deletePin" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="current-password" placeholder="••••" value="'+esc(profileUi.delPin||'')+'" style="margin-bottom:10px;">'
    + (step2 ? '<div class="error-text" role="alert">⚠️ Dernière confirmation : ton compte sera supprimé pour toujours.</div>' : '')
    + (profileUi.err ? '<div class="error-text">'+esc(profileUi.err)+'</div>' : '')
    + '<div class="row"><button class="btn danger" style="flex:1;" data-action="delete-account-go" '+(profileUi.busy?'disabled':'')+'>'+(profileUi.busy ? 'Suppression en cours…' : (step2 ? 'Oui, supprimer pour toujours' : 'Supprimer définitivement'))+'</button><button class="btn ghost" data-action="delete-account-cancel">Annuler</button></div></div>';
}
// ce que le joueur écrit est gardé en mémoire (un redessin de l'écran ne l'efface plus)
document.addEventListener('input', function(e){
  if(!e.target) return;
  if(e.target.id==='deletePseudo'){ profileUi.delPseudo = e.target.value; profileUi.deleteConfirm = false; }
  else if(e.target.id==='deletePin'){ profileUi.delPin = e.target.value; profileUi.deleteConfirm = false; }
});
async function deleteMyAccount(){
  if(profileUi.busy || !currentProfile || isAdmin()) return;
  var typed = (profileUi.delPseudo || (document.getElementById('deletePseudo')||{}).value || '').trim(), pin = (profileUi.delPin || (document.getElementById('deletePin')||{}).value || '').trim();
  if(profileKey(typed) !== profileKey(currentProfile.pseudo)){ profileUi.err = 'Le pseudo ne correspond pas.'; render(); return; }
  if(!/^[0-9]{4,6}$/.test(pin)){ profileUi.err = 'Entre ton code (4 à 6 chiffres).'; render(); return; }
  if(!profileUi.deleteConfirm){ profileUi.deleteConfirm = true; profileUi.err = ''; render(); return; } // 1er clic : on demande confirmation dans la page (pas de fenêtre du navigateur : elle peut être bloquée)
  profileUi.busy = true; profileUi.err = ''; render();
  try{
    var key = currentProfile.key, ref = claudeDb.doc('profiles/'+key), snap = await ref.get(), d = snap.exists ? snap.data() : {};
    var email = (d.__plain && d.__plain.email) || authEmail(key), uid = authUid();
    if(authOn()){
      try{ await fbAuth.currentUser.reauthenticateWithCredential(firebase.auth.EmailAuthProvider.credential(email, authPw(pin))); }
      catch(e){ if(isBadCredential(e)) throw { ui:'Code incorrect.' }; throw e; }
    }
    var tombstone = { deleted:true, at:nowMs(), __plain:{ owner:uid, email:DELETED_EMAIL } }; // l'adresse technique d'origine contenait le pseudo : on la remplace par une adresse neutre (les règles exigent seulement « …@rikiki.invalid »)
    await ref.set(tombstone);                                                                     // profil vidé (pseudo, couleur, identifiant de joueur)
    try{ await claudeDb.doc('friends/'+myId).set(withOwner({ list:{} })); }catch(e){ console.warn('amis', e); }
    try{ await claudeDb.doc('presence/'+myId).set(withOwner({ name:'', at:0, code:'', status:'off' })); }catch(e){ console.warn('présence', e); }
    if(authOn()) await fbAuth.currentUser.delete();                                                // le compte de connexion disparaît
    saveProfileLocal(null);
    try{ ['rikiki_fb_name','rikiki_last','rikiki_resume','rikiki_recent_names','rikiki_claim_'+key].forEach(function(k){ localStorage.removeItem(k); }); localStorage.setItem('rikiki_fb_uid', 'p-'+Math.random().toString(36).slice(2,10)+nowMs().toString(36)); sessionStorage.removeItem('rikiki_mock_uid'); }catch(e){}
    setFlash('deleted', ''); location.reload();
  }catch(e){
    console.error(e); profileUi.busy = false; profileUi.deleteConfirm = false;
    profileUi.err = (e && e.ui) ? e.ui : 'Suppression impossible : '+dbErrorText(e); render();
  }
}
