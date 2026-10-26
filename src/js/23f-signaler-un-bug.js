/* ===================== 1.4.0 : « Signaler un bug » =====================
   - Bouton « 🐞 Signaler un bug » dans ⚙️ Paramètres : le joueur écrit une phrase, le jeu y joint des infos techniques
     (version, appareil, partie en cours, dernières erreurs) et range le tout dans Firebase : bugReports/{compte}_{date}.
   - Rapport automatique : si le jeu rencontre une erreur, une petite bannière propose « Envoyer un rapport » (jamais envoyé sans clic,
     une seule proposition par session).
   - L'organisateur lit les rapports dans Ligue › Entretien (et un message l'avertit des nouveaux). Les champs msg / v / kind sont aussi écrits
     EN CLAIR à côté du JSON : lisibles tels quels dans la console Firebase (c'est comme ça que Claude les relit).
   - Suppression automatique des rapports de plus de BUG_KEEP_DAYS jours (promesse faite dans la page de confidentialité).
   - La fenêtre du formulaire vit HORS du rendu principal (#bug-root) : ce que le joueur tape n'est jamais effacé par un réaffichage. */
var BUG_MAX_CHARS = 500, BUG_KEEP_DAYS = 180, BUG_MIN_GAP_MS = 60000, BUG_LAST_KEY = 'rikiki_bug_at', BUG_SEEN_KEY = 'rikiki_bug_seen';
var bugUi = { open:false, text:'', busy:false, msg:'', offer:false, offered:false, errors:[], list:null, loading:false, mode:'manuel' };

function bugNoteError(m){
  var t = String(m || '').slice(0, 180); if(!t) return;
  bugUi.errors = bugUi.errors.concat([{ at: nowMs(), m: t }]).slice(-5);
}
function bugAfterError(m){
  bugNoteError(m);
  if(bugUi.offered || bugUi.open || screen==='loading') return; // une seule proposition par session, jamais pendant le chargement
  bugUi.offered = true; bugUi.offer = true; bugRender();
}
window.addEventListener('error', function(e){ bugAfterError((e && e.message) || (e && e.error && e.error.message) || 'erreur'); });
window.addEventListener('unhandledrejection', function(e){ bugAfterError('promesse refusée : ' + ((e && e.reason && (e.reason.message || e.reason.code)) || e.reason || '')); });

// Contenu du rapport (fonction pure, testée). Aucun mot de passe, code ni carte : seulement des repères techniques.
function buildBugReport(text, kind, env){
  env = env || {};
  var msg = String(text || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, BUG_MAX_CHARS);
  var ctx = {
    v: String(env.version || ''), ua: String(env.ua || '').slice(0, 160), screen: String(env.size || '').slice(0, 20), lang: String(env.lang || '').slice(0, 5),
    where: String(env.where || '').slice(0, 20), game: String(env.game || '').slice(0, 4), status: String(env.status || '').slice(0, 20), round: env.round == null ? null : Number(env.round) || 0,
    deck: String(env.deck || '').slice(0, 10), who: String(env.who || '').slice(0, 30),
    errors: (env.errors || []).slice(-5).map(function(x){ return { at: x.at, m: String(x.m || '').slice(0, 180) }; })
  };
  var k = kind === 'auto' ? 'auto' : 'manuel';
  return { msg: msg, kind: k, ctx: ctx, at: env.at || 0, __plain: { msg: msg.slice(0, 200), v: ctx.v, kind: k } };
}
function bugEnv(){
  var g = (typeof gameDoc !== 'undefined') ? gameDoc : null;
  return {
    version: APP_VERSION, ua: navigator.userAgent, size: window.innerWidth + 'x' + window.innerHeight, lang: (typeof LANG !== 'undefined' ? LANG : ''),
    where: screen, game: gameCode || '', status: g ? g.status : '', round: g ? g.round : null, deck: (typeof deckTheme !== 'undefined' ? deckTheme : ''),
    who: currentProfile ? (currentProfile.pseudo || '') : '', errors: bugUi.errors, at: nowMs()
  };
}
function bugCanSend(){
  try{ var last = Number(localStorage.getItem(BUG_LAST_KEY)) || 0; return Date.now() - last > BUG_MIN_GAP_MS; }catch(e){ return true; }
}
async function bugSubmit(){
  var text = (bugUi.text || '').trim();
  if(bugUi.busy) return;
  if(bugUi.mode !== 'auto' && text.length < 5){ bugUi.msg = 'Écris au moins quelques mots pour que je comprenne.'; bugRender(); return; }
  if(!bugCanSend()){ bugUi.msg = 'Tu viens d\'en envoyer un : réessaie dans une minute.'; bugRender(); return; }
  if(!claudeDb){ bugUi.msg = 'Pas de connexion au jeu : réessaie plus tard.'; bugRender(); return; }
  bugUi.busy = true; bugUi.msg = ''; bugRender();
  try{
    var rep = buildBugReport(text || '(rapport automatique, sans texte)', bugUi.mode, bugEnv());
    var id = String(myKeyId()).replace(/[^A-Za-z0-9]/g, '').slice(0, 40) + '_' + nowMs().toString(36);
    await claudeDb.doc('bugReports/' + id).set(rep);
    try{ localStorage.setItem(BUG_LAST_KEY, String(Date.now())); }catch(e){}
    bugUi.text = ''; bugUi.open = false; bugUi.offer = false; bugUi.busy = false; bugRender();
    showToast('Merci ! Ton signalement est envoyé ✓');
  }catch(e){
    console.error(e); bugUi.busy = false; bugUi.msg = 'Envoi impossible : ' + dbErrorText(e); bugRender();
  }
}

// --- affichage (hors du rendu principal) ---
function bugRoot(){
  var r = document.getElementById('bug-root');
  if(!r){ r = document.createElement('div'); r.id = 'bug-root'; document.body.appendChild(r); }
  return r;
}
function bugRender(){
  var h = '';
  if(bugUi.offer && !bugUi.open){
    h += '<div class="bug-offer" role="alert"><span>Un petit souci vient de se produire. Tu veux le signaler ?</span>'
      + '<button class="btn small" data-action="bug-open-auto">Envoyer un rapport</button><button class="btn ghost small" data-action="bug-offer-close" aria-label="Fermer">✕</button></div>';
  }
  if(bugUi.open){
    h += '<div class="modal-backdrop bug-back" data-action="bug-close"><div class="card-panel modal bug-modal" role="dialog" aria-modal="true" aria-labelledby="bug-title">'
      + '<h3 id="bug-title">🐞 Signaler un bug</h3>'
      + '<p class="muted" style="font-size:13px; margin:0 0 8px;">'+(bugUi.mode==='auto' ? 'Ajoute une phrase si tu veux (facultatif). ' : 'Dis-nous ce qui ne va pas, en une ou deux phrases. ')
      + 'Le jeu joint automatiquement : sa version, ton appareil, l\'écran ou la partie en cours et les dernières erreurs. Jamais ton code ni tes cartes.</p>'
      + '<textarea id="bug-text" maxlength="'+BUG_MAX_CHARS+'" rows="5" style="width:100%; box-sizing:border-box;" placeholder="Ex. : après avoir cliqué sur Passer, l\'écran reste bloqué">'+esc(bugUi.text)+'</textarea>'
      + (bugUi.msg ? '<p style="font-size:13px; font-weight:700; margin:8px 0 0;">'+esc(bugUi.msg)+'</p>' : '')
      + '<div class="row" style="gap:8px; margin-top:10px;"><button class="btn" style="flex:1;" data-action="bug-send"'+(bugUi.busy?' disabled':'')+'>'+(bugUi.busy?'Envoi…':'Envoyer')+'</button>'
      + '<button class="btn secondary" data-action="bug-close">Annuler</button></div></div></div>';
  }
  var r = bugRoot();
  var keep = document.getElementById('bug-text'), had = keep && document.activeElement === keep, pos = had ? keep.selectionStart : 0;
  r.innerHTML = h;
  if(had){ var t = document.getElementById('bug-text'); if(t){ t.focus(); try{ t.setSelectionRange(pos, pos); }catch(e){} } }
}
document.addEventListener('input', function(e){ if(e.target && e.target.id === 'bug-text') bugUi.text = e.target.value; });
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action^="bug-"]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a === 'bug-close'){ if(e.target !== el && el.classList.contains('bug-back')) return; bugUi.open = false; bugUi.msg = ''; bugRender(); return; }
  if(a === 'bug-open' || a === 'bug-open-auto'){ bugUi.open = true; bugUi.mode = (a === 'bug-open-auto') ? 'auto' : 'manuel'; bugUi.msg = ''; if(typeof showPrefs !== 'undefined' && showPrefs){ showPrefs = false; render(); } bugRender(); var t = document.getElementById('bug-text'); if(t) t.focus(); return; }
  if(a === 'bug-offer-close'){ bugUi.offer = false; bugRender(); return; }
  if(a === 'bug-send'){ bugSubmit(); return; }
  if(a === 'bug-del' && isAdmin()){ bugDelete(el.getAttribute('data-id')); return; }
  if(a === 'bug-refresh' && isAdmin()){ bugLoad(true); return; }
});

// --- côté organisateur : lire, effacer, être prévenu ---
function bugSeenAt(){ try{ return Number(localStorage.getItem(BUG_SEEN_KEY)) || 0; }catch(e){ return 0; } }
function bugUnseenCount(){ var s = bugSeenAt(); return (bugUi.list || []).filter(function(r){ return (r.at || 0) > s; }).length; }
async function bugLoad(quiet){
  if(!isAdmin() || !claudeDb || bugUi.loading) return;
  bugUi.loading = true;
  try{
    var snap = await claudeDb.collection('bugReports').orderBy('at', 'desc').limit(50).get();
    bugUi.list = snap.docs.map(function(d){ var x = d.data() || {}; return Object.assign({ id: d.id }, x); });
    var oldMs = nowMs() - BUG_KEEP_DAYS * 86400000;
    bugUi.list.filter(function(r){ return (r.at || 0) && r.at < oldMs; }).slice(0, 20).forEach(function(r){ claudeDb.doc('bugReports/' + r.id).delete().catch(function(){}); });
    bugUi.list = bugUi.list.filter(function(r){ return !((r.at || 0) && r.at < oldMs); });
    var n = bugUnseenCount();
    if(n && !quiet && !bugUi.told){ bugUi.told = true; showToast('🐞 ' + n + ' nouveau' + (n>1?'x':'') + ' signalement' + (n>1?'s':'') + ' : Ligue › Entretien'); }
  }catch(e){ console.warn('signalements', e); }
  bugUi.loading = false; render();
}
async function bugDelete(id){
  if(!id || !confirmT('Supprimer ce signalement ?')) return;
  try{ await claudeDb.doc('bugReports/' + id).delete(); bugUi.list = (bugUi.list || []).filter(function(r){ return r.id !== id; }); render(); }
  catch(e){ console.error(e); showToast(dbErrorText(e)); }
}
function bugListHtml(list){
  if(!list) return '<div class="muted" style="font-size:12.5px;">Chargement…</div>';
  if(!list.length) return '<div class="muted" style="font-size:12.5px;">Aucun signalement. 🎉</div>';
  var seen = bugSeenAt();
  return list.map(function(r){
    var c = r.ctx || {}, fresh = (r.at || 0) > seen;
    return '<div style="margin-top:8px; padding:8px 10px; border-radius:10px; background:rgba(255,255,255,0.05);'+(fresh?' border:1px solid #E8A33D;':'')+'">'
      + '<div class="row between" style="gap:8px;"><span style="font-size:12px;" class="muted">'+(fresh?'🆕 ':'')+new Date(r.at||0).toLocaleString('fr-BE')+' · v'+esc(c.v||'?')+' · '+esc(c.who||'invité')+' · '+(r.kind==='auto'?'auto':'manuel')+'</span>'
      + '<button class="btn secondary small" data-action="bug-del" data-id="'+esc(r.id)+'">Supprimer</button></div>'
      + '<div style="font-size:13.5px; margin-top:4px; white-space:pre-wrap;">'+esc(r.msg||'')+'</div>'
      + '<details style="margin-top:4px;"><summary class="muted" style="font-size:12px; cursor:pointer;">Détails techniques</summary><div style="font-size:11.5px; word-break:break-word;" class="muted">'
      + 'écran : '+esc(c.where||'')+(c.game?' · partie '+esc(c.game)+' ('+esc(c.status||'')+', manche '+esc(c.round)+')':'')+' · '+esc(c.screen||'')+' · '+esc(c.lang||'')+' · paquet '+esc(c.deck||'')+'<br>'+esc(c.ua||'')
      + ((c.errors||[]).length ? '<br>Erreurs : '+(c.errors||[]).map(function(x){ return esc(x.m); }).join(' | ') : '') + '</div></details></div>';
  }).join('');
}
function renderBugPanel(){
  if(!isAdmin() || !(usingFirebase || usingMock)) return '';
  if(bugUi.list === null && !bugUi.loading) setTimeout(function(){ bugLoad(true); }, 0);
  var n = bugUnseenCount();
  var html = '<div class="card-panel" style="margin-top:16px;"><div class="row between"><h3 style="margin:0;">🐞 Signalements'+(n?' <span style="color:#E8A33D;">('+n+' nouveau'+(n>1?'x':'')+')</span>':'')+'</h3>'
    + '<button class="btn secondary small" data-action="bug-refresh">Actualiser</button></div>'
    + bugListHtml(bugUi.list) + '</div>';
  setTimeout(function(){ if(bugUi.list && bugUi.list.length){ try{ localStorage.setItem(BUG_SEEN_KEY, String(Math.max.apply(null, bugUi.list.map(function(r){ return r.at || 0; })))); }catch(e){} } }, 4000);
  return html;
}
setTimeout(function(){ bugLoad(false); }, 9000);
setInterval(function(){ bugLoad(true); }, 300000);
