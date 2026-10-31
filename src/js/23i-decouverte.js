/* ===================== 1.8.0 : « Découverte » (apprendre à se servir du site, sans être intrusif) =====================
   1. Écran d'arrivée simplifié pour la personne invitée par un lien (?game=CODE) qui n'a pas de profil : prénom + « Rejoindre », rien d'autre.
   2. Conseils « au bon moment » : une seule ligne, une seule fois par situation (prêt / annoncer / jouer), qui disparaît dès qu'on agit ou avec ✕.
      Jamais de fenêtre qui bloque. Réglable dans ⚙️ Paramètres (« Conseils »), mémorisé par appareil.
   3. Bouton « ? » dans la barre du haut de la partie : explique en 2-3 lignes ce qu'il faut faire À CE MOMENT-LÀ.
   4. Toucher une carte grisée explique pourquoi (« Tu dois jouer du pique »).
   Les fenêtres du « ? » vivent dans #tip-root, hors du rendu principal. */
var inviteLanding = false;
var tipsOn = true; try{ tipsOn = localStorage.getItem('rikiki_tips') !== '0'; }catch(e){}
var TIPS_SEEN_KEY = 'rikiki_tips_seen', tipState = { shown:null }, helpOpen = false, lastBlockedCardMs = 0;

// --- 1. arrivée par un lien d'invitation ---
function inviteLandingHtml(){
  if(!inviteLanding || currentProfile || !prefillCode) return '';
  return '<div class="home-c invite-landing"><div class="hc-brand"><h1 class="hc-title">Rikiki</h1></div>'
    + '<div class="card-panel invite-card"><h2>👋 Tu es invité(e) à jouer !</h2>'
    + '<p class="muted">Une partie t\'attend. Écris ton prénom, puis touche le bouton.</p>'
    + '<label for="nameInput" class="invite-lbl">Ton prénom</label>'
    + '<input type="text" id="nameInput" class="invite-input" maxlength="24" placeholder="Ex. Léa" value="'+esc(myProfile.name || '')+'" autocomplete="given-name">'
    + '<input type="hidden" id="joinCodeInput" value="'+esc(prefillCode)+'">'
    + '<button class="btn invite-go" data-action="do-join">Rejoindre la partie</button>'
    + (errorMsg ? '<div class="error-text">'+esc(errorMsg)+'</div>' : '')
    + '<button class="btn ghost small" data-action="invite-full">Voir l\'accueil complet</button></div></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="invite-full"],[data-action="do-join"]') : null; if(!el) return;
  var wasLanding = inviteLanding; inviteLanding = false;
  if(el.getAttribute('data-action') === 'invite-full'){ render(); }
  else if(wasLanding){ setTimeout(function(){ if(screen === 'entry') render(); }, 800); } // si la connexion échoue, on retombe sur l'accueil normal
});

// --- 2. conseils au bon moment ---
function tipsSeen(){ try{ return JSON.parse(localStorage.getItem(TIPS_SEEN_KEY) || '{}') || {}; }catch(e){ return {}; } }
function tipsMark(key){ if(!key) return; var s = tipsSeen(); s[key] = 1; try{ localStorage.setItem(TIPS_SEEN_KEY, JSON.stringify(s)); }catch(e){} }
var TIP_TEXT = {
  ready: 'Touche « Je suis prêt » quand tu veux. La partie commence quand tout le monde est prêt.',
  bid:   'À toi d\'annoncer : touche le nombre de plis que tu penses gagner.',
  play:  'À toi de jouer : touche une carte. Les cartes grisées sont interdites.',
  playfraud: '😈 Mode frauduleux : tu peux jouer n\'importe quelle carte. Mais si on te voit, tu perds 5 points !'
};
function tipWanted(g){
  if(!tipsOn || !g) return null;
  if(g.status === 'lobby'){ var me = g.players && g.players[myId]; return (me && !me.ready) ? 'ready' : null; }
  if(g.turnPlayerId !== myId) return null;
  if(g.status === 'bidding') return 'bid';
  if(g.status === 'playing') return fraudOn(g) ? 'playfraud' : 'play';
  return null;
}
function tipHtml(g){
  var want = tipWanted(g);
  if(tipState.shown && tipState.shown !== want) tipsMark(tipState.shown); // la situation a changé : le joueur a agi, on ne le lui redit plus
  tipState.shown = want;
  if(!want || tipsSeen()[want]) return '';
  return '<div class="tip-line" role="status"><span>💡 '+esc(TIP_TEXT[want])+'</span><button class="btn ghost small" data-action="tip-close" aria-label="Fermer">✕</button></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="tip-close"],[data-action="tips-toggle"]') : null; if(!el) return;
  if(el.getAttribute('data-action') === 'tip-close'){ tipsMark(tipState.shown); render(); return; }
  tipsOn = !tipsOn; try{ localStorage.setItem('rikiki_tips', tipsOn ? '1' : '0'); }catch(err){} render();
});

// --- 3. bouton « ? » : l'aide du moment ---
function helpLines(g){
  var mine = g.turnPlayerId === myId;
  if(g.status === 'lobby') return ['Touche « Je suis prêt » quand tu veux.', 'Quand tout le monde est prêt, l\'organisateur lance la partie.', 'Pour inviter quelqu\'un : « Inviter un nouveau joueur ».'];
  if(g.status === 'dealing') return ['Les cartes sont distribuées : un instant.'];
  if(g.status === 'bidding') return mine
    ? ['C\'est à toi d\'annoncer.', 'Touche le nombre de plis que tu penses gagner (0 si tu n\'en veux aucun).', 'Un chiffre grisé est interdit : le dernier à annoncer ne peut pas faire tomber le total juste.']
    : ['Les autres annoncent. Attends ton tour.', 'Tu verras tes cartes en bas de l\'écran.'];
  if(g.status === 'playing') return mine
    ? (fraudOn(g) ? ['C\'est à toi de jouer : touche une carte, n\'importe laquelle.', '😈 Mode frauduleux : tu peux ne pas fournir la couleur. Si un joueur t\'accuse à raison, tu perds 5 points.', 'Tu veux accuser quelqu\'un ? Touche « 🕵️ J\'accuse » sous la table.'] : ['C\'est à toi de jouer : touche une carte de ta main.', 'Si tu as la couleur demandée, tu dois la jouer : les autres cartes sont grisées.', 'Tu n\'as pas la couleur ? Joue ce que tu veux (un atout pour couper, par exemple).'])
    : ['Les autres jouent. Attends ton tour.', 'Le plus fort atout gagne le pli, sinon la plus forte carte de la couleur demandée.'];
  return ['La manche est finie : regarde les points, la suite arrive toute seule.'];
}
function tipRoot(){ var r = document.getElementById('tip-root'); if(!r){ r = document.createElement('div'); r.id = 'tip-root'; document.body.appendChild(r); } return r; }
function helpRender(){
  var r = tipRoot();
  if(!helpOpen || !gameDoc){ r.innerHTML = ''; return; }
  r.innerHTML = '<div class="modal-backdrop help-back" data-action="help-close"><div class="card-panel modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">'
    + '<h3 id="help-title">❓ Que faire maintenant ?</h3>'
    + helpLines(gameDoc).map(function(t){ return '<p style="font-size:16px; margin:8px 0;">'+esc(t)+'</p>'; }).join('')
    + '<div class="row" style="gap:8px; margin-top:12px;"><button class="btn" style="flex:1;" data-action="help-close">J\'ai compris</button>'
    + '<button class="btn secondary" data-action="toggle-rules">Les règles</button></div></div></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="help-now"],[data-action="help-close"]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a === 'help-close' && e.target !== el && el.classList.contains('help-back')) return; // un clic dans la fenêtre ne la ferme pas
  helpOpen = (a === 'help-now'); helpRender();
});
document.addEventListener('click', function(e){ if(helpOpen && e.target.closest && e.target.closest('[data-action="toggle-rules"]')){ helpOpen = false; helpRender(); } });

// --- 3 bis. partager un lien : copier sans permission, sinon l'afficher dans la page ---
async function copyTextSafe(text){
  try{ if(navigator.clipboard && navigator.clipboard.writeText){ await navigator.clipboard.writeText(text); return true; } }catch(e){}
  try{ // repli : copie « à l'ancienne » depuis un clic de l'utilisateur
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed; top:0; left:0; opacity:0;';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
    var ok = document.execCommand && document.execCommand('copy'); document.body.removeChild(ta); return !!ok;
  }catch(e){ return false; }
}
function linkBoxShow(url, text){
  tipRoot().innerHTML = '<div class="modal-backdrop link-back" data-action="link-close"><div class="card-panel modal link-modal" role="dialog" aria-modal="true" aria-labelledby="link-title">'
    + '<h3 id="link-title">👋 Invite un nouveau joueur</h3>'
    + '<p class="muted" style="font-size:14px; margin:0 0 8px;">Envoie ce lien par message : ton ami écrit son prénom et arrive directement dans ce salon.</p>'
    + '<input type="text" id="link-url" readonly value="'+esc(url)+'" style="width:100%; box-sizing:border-box; font-size:15px;">'
    + '<div class="row" style="gap:8px; margin-top:10px;"><button class="btn" style="flex:1;" data-action="link-copy" data-url="'+esc(url)+'">Copier le lien</button>'
    + '<button class="btn secondary" data-action="link-close">Fermer</button></div></div></div>';
  var i = document.getElementById('link-url'); if(i){ i.focus(); i.select(); }
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="link-copy"],[data-action="link-close"]') : null; if(!el) return;
  if(el.getAttribute('data-action') === 'link-close'){ if(e.target !== el && el.classList.contains('link-back')) return; tipRoot().innerHTML = ''; return; }
  copyTextSafe(el.getAttribute('data-url')).then(function(ok){ if(ok){ showToast('Lien copié ✓'); tipRoot().innerHTML = ''; } else { var i = document.getElementById('link-url'); if(i){ i.focus(); i.select(); } showToast('Sélectionne le lien et copie-le (appui long).'); } });
});

// --- 4. carte grisée : on explique pourquoi ---
function blockedCardTap(e){
  var g = (typeof gameDoc !== 'undefined') ? gameDoc : null;
  if(!g || screen !== 'game' || g.status !== 'playing' || Date.now() - lastBlockedCardMs < 1500) return;
  var els = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [];
  var hit = els.filter(function(x){ return x.classList && x.classList.contains('hand-card') && x.disabled; })[0];
  if(!hit) return;
  lastBlockedCardMs = Date.now();
  var led = (g.currentTrick && g.currentTrick.length) ? g.currentTrick[0].card.suit : null;
  if(g.turnPlayerId !== myId) showToast('Ce n\'est pas encore à toi de jouer.');
  else if(led) showToast('Tu dois jouer du ' + CARD_SUIT_NAME.fr[led] + ' (la couleur demandée).');
}
document.addEventListener('pointerdown', blockedCardTap, true);
