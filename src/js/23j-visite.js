/* ===================== 1.8.0 : « Visite de l'appli » =====================
   Une visite guidée de l'ACCUEIL (pas des règles : elles ont déjà leur tuto animé) : on éclaire chaque vrai bouton à tour de rôle et une bulle
   explique à quoi il sert. Mot clé en doré, main qui pointe, « Passer » toujours visible, ← / → au clavier, Échap pour quitter.
   - Jamais imposée : une carte « Première fois ? » sur l'accueil des NOUVEAUX appareils (fermable), et une ligne dans ⚙️ Paramètres (accueil) pour la revoir.
   - État mémorisé dans localStorage rikiki_visite : 'pending' (nouvel appareil, carte affichée), 'done' (terminée) ou 'dismissed' (fermée / ancien appareil).
   - Tout vit dans #visite-root, hors du rendu principal : un réaffichage de l'accueil ne la casse pas. */
var VISITE_KEY = 'rikiki_visite';
var visiteState = (function(){
  try{ var v = localStorage.getItem(VISITE_KEY); if(v === 'pending' || v === 'done' || v === 'dismissed') return v; var init = DEVICE_IS_NEW ? 'pending' : 'dismissed'; localStorage.setItem(VISITE_KEY, init); return init; }
  catch(e){ return 'dismissed'; }
})();
var visite = { open:false, steps:[], i:0 };
var VISITE_STEPS = [
  { sel:'.hc-hello',                      t:'Ton <b>prénom</b>',            d:'Écris-le ici : c\'est ce que les autres joueurs voient à la table. Pas besoin de compte pour jouer.' },
  { sel:'.hc-avatar',                     t:'Ton <b>profil</b>',            d:'Crée-le avec un pseudo et un code à 4 chiffres : tu retrouves ta fiche, ton classement et tes amis sur tous tes appareils.' },
  { sel:'[data-action="quick-create"]',   t:'Jouer <b>tout de suite</b>',   d:'Une partie rapide contre des robots, en 5 manches. C\'est le meilleur moyen d\'essayer.' },
  { sel:'.hc-join',                       t:'Rejoindre <b>un ami</b>',      d:'Il t\'a donné un code à 4 caractères ? Écris-le ici et touche « Rejoindre ». Ou ouvre simplement le lien qu\'il t\'a envoyé.' },
  { sel:'.hc-tile[data-action="do-create"]', t:'<b>Créer</b> une partie',   d:'Choisis les réglages, ajoute des robots, puis invite tes amis avec le bouton « Inviter un nouveau joueur ».' },
  { sel:'.hc-tile[data-action="sheet-open"]', t:'Les <b>vraies cartes</b>', d:'Tu joues autour d\'une table avec un vrai jeu : l\'appli compte les annonces, les plis et les points à ta place.' },
  { sel:'.hc-tile[data-action="league-openscreen"]', t:'La <b>ligue</b>',   d:'Le classement de la saison, la couronne 👑 du premier, les récompenses et le tournoi du dimanche.' },
  { sel:'.home-friends',                  t:'Tes <b>amis</b>',              d:'Avec un profil, tu ajoutes des amis, tu les vois en ligne et tu les invites en un clic.' },
  { sel:'.hc-tile[data-action="tuto-open"]', t:'Les <b>règles</b>',         d:'Un tuto animé d\'une minute pour apprendre à jouer au Rikiki.' },
  { sel:'.hc-snd',                        t:'Les <b>réglages</b>',          d:'Dans ⚙️ Paramètres : tes cartes (3 paquets), les cartes plus grandes, la vue table, les bruitages, la musique, les conseils, le jeu automatique… et « Signaler un bug » si quelque chose ne va pas.' },
  { sel:'.hc-lang',                       t:'<b>FR</b> / <b>EN</b>',        d:'Change la langue du jeu ici.' },
  { sel:null,                             t:'<b>Pendant</b> une partie',    d:'Le bouton ❓ en haut te dit quoi faire à ce moment-là. « Scores » montre les points, « Règles » rouvre l\'aide, 💬 ouvre le chat. Le jeu te donne aussi de petits conseils, une seule fois chacun.' }
];
function visiteRoot(){ var r = document.getElementById('visite-root'); if(!r){ r = document.createElement('div'); r.id = 'visite-root'; document.body.appendChild(r); } return r; }
function visiteSet(v){ visiteState = v; try{ localStorage.setItem(VISITE_KEY, v); }catch(e){} }
function visiteCanStart(){ return screen === 'entry' && !inviteLanding; }
function visiteStart(){
  if(!visiteCanStart()){ showToast('La visite se lance depuis l\'accueil.'); return; }
  showPrefs = false; homeProfileOpen = false; render();
  setTimeout(function(){
    visite.steps = VISITE_STEPS.filter(function(s){ return !s.sel || document.querySelector(s.sel); });
    visite.i = 0; visite.open = true; visiteDraw();
  }, 60);
}
function visiteEnd(done){ visite.open = false; visiteRoot().innerHTML = ''; visiteSet(done ? 'done' : (visiteState === 'done' ? 'done' : 'dismissed')); render(); }
function visiteDraw(){
  var r = visiteRoot(); if(!visite.open){ r.innerHTML = ''; return; }
  var st = visite.steps[visite.i], last = visite.i === visite.steps.length - 1, el = st.sel ? document.querySelector(st.sel) : null;
  if(el && el.scrollIntoView) el.scrollIntoView({ block:'center', behavior:'auto' });
  var rect = el ? el.getBoundingClientRect() : null, pad = 6, vw = window.innerWidth, vh = window.innerHeight;
  var hole = rect ? '<div class="vt-hole" style="left:'+Math.max(4, rect.left-pad)+'px; top:'+Math.max(4, rect.top-pad)+'px; width:'+Math.min(vw-8, rect.width+pad*2)+'px; height:'+(rect.height+pad*2)+'px;"></div>' : '<div class="vt-dimall"></div>';
  var boxStyle;
  if(rect){ var below = (rect.bottom + 230 < vh) || rect.top < 240; boxStyle = below ? 'top:'+Math.min(vh-220, rect.bottom+pad+14)+'px;' : 'bottom:'+Math.max(10, vh-rect.top+pad+14)+'px;'; }
  else boxStyle = 'top:50%; transform:translateY(-50%);';
  var finger = rect ? '<div class="vt-finger" style="left:'+Math.round(Math.min(vw-40, Math.max(8, rect.left + rect.width/2 - 14)))+'px; top:'+Math.round((rect.bottom + pad + 14 > vh-230 ? rect.top-pad-34 : rect.bottom+pad-6))+'px;" aria-hidden="true">'+((rect.bottom + pad + 14 > vh-230) ? '👇' : '👆')+'</div>' : '';
  r.innerHTML = '<div class="vt-block"></div>' + hole + finger
    + '<button class="vt-skip" data-action="visite-skip">Passer ✕</button>'
    + '<div class="vt-box" role="dialog" aria-modal="true" aria-labelledby="vt-title" style="'+boxStyle+'">'
    + '<div class="vt-step">'+(visite.i+1)+' / '+visite.steps.length+'</div><div class="vt-title" id="vt-title">'+st.t+'</div><p class="vt-text">'+st.d+'</p>'
    + '<div class="row" style="gap:8px; margin-top:10px;">'+(visite.i > 0 ? '<button class="btn ghost" data-action="visite-prev">← Retour</button>' : '')
    + '<button class="btn" style="flex:1;" data-action="visite-next" id="vt-next">'+(last ? 'Terminer ✓' : 'Suivant →')+'</button></div></div>';
  // on mesure la bulle : sous le bouton éclairé si elle y tient, sinon au-dessus, sinon calée dans l'écran ; la main se met entre les deux
  var bx = r.querySelector('.vt-box'), fg = r.querySelector('.vt-finger');
  if(bx && rect){
    var bh = bx.offsetHeight, gap = pad + 14, spaceBelow = vh - (rect.bottom + gap) - 8, spaceAbove = rect.top - gap - 8, boxBelow = true;
    bx.style.transform = 'none';
    if(spaceBelow >= bh){ bx.style.top = (rect.bottom + gap) + 'px'; bx.style.bottom = 'auto'; }
    else if(spaceAbove >= bh){ bx.style.top = 'auto'; bx.style.bottom = (vh - rect.top + gap) + 'px'; boxBelow = false; }
    else { bx.style.top = Math.max(8, vh - bh - 8) + 'px'; bx.style.bottom = 'auto'; boxBelow = rect.top < vh/2; }
    if(fg){ fg.textContent = boxBelow ? '👆' : '👇'; fg.style.top = Math.round(boxBelow ? rect.bottom + pad - 6 : rect.top - pad - 34) + 'px'; }
  }
  var nx = document.getElementById('vt-next'); if(nx) nx.focus({ preventScroll:true });
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action^="visite-"]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a === 'visite-open'){ visiteStart(); return; }
  if(a === 'visite-dismiss'){ visiteSet('dismissed'); render(); return; }
  if(!visite.open) return;
  if(a === 'visite-skip'){ visiteEnd(false); return; }
  if(a === 'visite-prev'){ visite.i = Math.max(0, visite.i - 1); visiteDraw(); return; }
  if(a === 'visite-next'){ if(visite.i >= visite.steps.length - 1) visiteEnd(true); else { visite.i++; visiteDraw(); } }
});
document.addEventListener('keydown', function(e){
  if(!visite.open) return;
  if(e.key === 'Escape') visiteEnd(false);
  else if(e.key === 'ArrowRight' || e.key === 'Enter'){ e.preventDefault(); var n = document.querySelector('[data-action="visite-next"]'); if(n) n.click(); }
  else if(e.key === 'ArrowLeft'){ var p = document.querySelector('[data-action="visite-prev"]'); if(p) p.click(); }
});
window.addEventListener('resize', function(){ if(visite.open) visiteDraw(); });
// carte « Première fois ? » de l'accueil : les deux visites, l'une à côté de l'autre
function visitePromoHtml(){
  if(visiteState !== 'pending') return '';
  return '<div class="vt-promo" role="region" aria-label="Première fois ?"><div class="vt-promo-txt"><strong>Première fois ?</strong><span>Fais le tour en 1 minute.</span></div>'
    + '<button class="btn small" data-action="visite-open">🧭 Visiter l\'appli</button>'
    + '<button class="btn secondary small" data-action="tuto-open">📖 Les règles</button>'
    + '<button class="btn ghost small" data-action="visite-dismiss" aria-label="Masquer">✕</button></div>';
}
