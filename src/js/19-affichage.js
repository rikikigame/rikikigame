/* ===================== render ===================== */
function currentMode(){
  if(screen==='sheet') return 'game';
  if(screen==='game' && gameDoc && gameDoc.status!=='lobby') return 'game';
  return 'setup';
}
/* ---- animations : les éléments marqués data-flip glissent de leur ancienne place vers la nouvelle ---- */
var REDUCED_MOTION = false; try{ REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){}
var lastScreenKey = null, lastTrickTimer = null;
function flipCapture(){
  var m = {};
  try{ document.querySelectorAll('#app [data-flip]').forEach(function(el){ m[el.getAttribute('data-flip')] = el.getBoundingClientRect(); }); }catch(e){}
  return m;
}
function flipPlay(before, screenChanged){
  if(REDUCED_MOTION || !document.body.animate) return;
  var app = document.getElementById('app');
  if(screenChanged){
    app.animate([{ opacity:0, transform:'translateY(8px)' }, { opacity:1, transform:'none' }], { duration:320, easing:'cubic-bezier(.2,.7,.2,1)' });
  }
  document.querySelectorAll('#app [data-flip]').forEach(function(el){
    var k = el.getAttribute('data-flip'), b = before[k], a = el.getBoundingClientRect();
    if(b){
      var dx = b.left - a.left, dy = b.top - a.top;
      if(Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform:'translate('+dx+'px,'+dy+'px)' }, { transform:'none' }], { duration:420, easing:'cubic-bezier(.2,.75,.2,1)' });
    } else if(el.hasAttribute('data-enter') && !screenChanged){
      el.animate([{ opacity:0, transform:'translateY(-18px) scale(.92)' }, { opacity:1, transform:'none' }],
        { duration:360, delay: +el.getAttribute('data-enter') || 0, easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards' });
    } else if(el.hasAttribute('data-deal')){
      el.animate([{ opacity:0, transform:'translateY(40px) rotate(-6deg)' }, { opacity:1, transform:'none' }],
        { duration:420, delay: +el.getAttribute('data-deal') || 0, easing:'cubic-bezier(.2,.75,.2,1)', fill:'backwards' });
    }
  });
}
function screenKey(){
  var k = screen;
  if(screen==='game' && gameDoc){
    var st = gameDoc.status==='playing' ? 'bidding' : gameDoc.status; // annonces → jeu : même table, pas de fondu
    k += '|' + st + '|' + (gameDoc.round||0);
  }
  if(screen==='sheet' && sheet) k += '|' + sheet.round + '|' + (sheet.phase==='tricks' ? 'bid' : sheet.phase);
  return k;
}
function render(){
  var before = flipCapture();
  var sk = screenKey(), changed = sk !== lastScreenKey; lastScreenKey = sk;
  renderInner();
  flipPlay(before, changed);
  try{ renderChat(); }catch(e){ console.error(e); }
  try{ var ir = document.getElementById('invite-root'); if(ir) ir.innerHTML = renderInviteBanner(); presenceTick(); }catch(e){ console.error(e); }
  try{ musicSync(); }catch(e){} // v50 : musique seulement pendant la partie
  // fin d'affichage du dernier pli : un seul rafraîchissement programmé (plus de clignotement toutes les 400 ms)
  clearTimeout(lastTrickTimer);
  if(screen==='game' && gameDoc && gameDoc.lastTrick && gameDoc.lastTrick.at){
    var left = lastTrickAt(gameDoc) + ((gameDoc.status==='round_end'||gameDoc.status==='game_over') ? FINAL_TRICK_MS : LAST_TRICK_MS) - nowMs();
    if(left > 0) lastTrickTimer = setTimeout(render, left + 30);
  }
}
var LAST_TRICK_MS = 2600;
var FINAL_TRICK_MS = 3200; // dernier pli d'une manche : la table reste visible avant le classement
function finalTrickShowing(g){ return !!(g.lastTrick && g.lastTrick.at && g.lastTrick.cards && g.lastTrick.cards.length && (nowMs()-lastTrickAt(g)) < FINAL_TRICK_MS); }
function renderInner(){
  var app = document.getElementById('app');
  // réglages = table en verre claire ; partie = bleu nuit (verre fumé)
  try{
    document.documentElement.setAttribute('data-look', 'dark'); // v39 : le même style « Nuit » sur tout le site
    document.documentElement.classList.toggle('is-home', screen==='entry'); // v38 : accueil « Nuit »
  }catch(e){}
  renderIntroLayer();
  if(fatalError){ app.innerHTML = renderFatalError(); return; }
  if(screen==='no-identity'){ app.innerHTML = renderNoIdentity(); return; }
  if(screen==='loading'){ app.innerHTML = renderLoading(); return; }
  if(screen==='entry'){ app.innerHTML = renderEntry(); return; }
  if(screen==='sheet-setup' && sheetDraft){ app.innerHTML = renderSheetSetup() + (toastMsg ? '<div class="toast">'+esc(toastMsg)+'</div>' : ''); return; }
  if(screen==='analysis'){ app.innerHTML = renderAnalysis(); return; }
  if(screen==='league'){ app.innerHTML = renderLeague() + (toastMsg ? '<div class="toast">'+esc(toastMsg)+'</div>' : ''); return; }
  if(screen==='sheet' && sheet){ app.innerHTML = renderSheet() + (toastMsg ? '<div class="toast">'+esc(toastMsg)+'</div>' : ''); return; }
  if(screen==='game' && gameDoc){ app.innerHTML = renderGame() + (toastMsg ? '<div class="toast">'+esc(toastMsg)+'</div>' : ''); attachAutoFocus(); return; }
  app.innerHTML = renderLoading();
}
function renderFatalError(){
  return '<div class="center-wrap"><div class="card-panel entry-box" style="text-align:center;">'
    + '<h2 class="display">Ça coince…</h2>'
    + '<p class="muted" style="margin-top:10px;">'+esc(fatalError)+'</p>'
    + '<div class="row" style="justify-content:center; margin-top:14px;">'
    + '<button class="btn" data-action="retry">Réessayer</button>'
    + '<button class="btn secondary" data-action="leave">Accueil</button>'
    + '</div></div></div>';
}
function attachAutoFocus(){}

function renderNoIdentity(){
  return '<div class="center-wrap"><div class="card-panel entry-box" style="text-align:center;">'
    + '<h2 class="display">Rikiki</h2>'
    + '<p class="muted" style="margin-top:10px;">Cette appli a besoin d\'un compte Claude connecté pour synchroniser la partie entre les joueurs. Ouvre-la depuis claude.ai avec ton compte.</p>'
    + '</div></div>';
}
function renderLoading(){
  return '<div class="center-wrap"><span class="muted">Chargement…</span></div>';
}

// (v38) renderEntry : voir le nouvel accueil plus bas

