/* ===================== v64 : nouveautés (visite interactive à l'ouverture du site) + sondage « nom du paquet » =====================
   - À la première ouverture après une mise à jour, une petite visite (comme celle des règles : quelques diapos animées, pas toutes les nouveautés)
     annonce les points forts (NEWS_SLIDES) et propose de voter. Elle ne revient plus ensuite (localStorage rikiki_news_seen) ; la bannière de
     l'accueil rouvre le sondage. Le DÉTAIL complet (NEWS.items + NEWS.fixes) est dans les « notes de version » : toucher le numéro de version en bas de l'accueil.
   - Sondage : chaque appareil / compte a UN vote (modifiable jusqu'à la fin) : pollVotes/{sondage}/{compte}, champ en clair c = numéro
     de l'option. Seul l'organisateur peut lire tous les votes (règles Firebase) : il voit les résultats dans cette même fenêtre.
   - Pour un nouveau sondage : changer POLL.id, POLL.options, POLL.end (fin en millisecondes ; 0 = jamais fermé, pour les tests)
     ET la règle pollVotes dans regles-firebase.json (identifiant + date de fin). */
var POLL = { id:'deck1', title:'Quel nom pour le paquet Halloween ?', options:['Minuit au Café', 'Café des Damnés', 'Le Cimetière d\'Albert'], end:1791906939843 };
var NEWS = {
  version: '64', title: '🎃 Du nouveau sur Rikiki !',
  items: [
    'Un <strong>paquet Halloween</strong> : Dracula, le zombie, la momie et la Faucheuse, avec un fond d\'araignées, de chauves-souris et de citrouilles, une musique d\'horreur et un rire diabolique quand on coupe. Choisis-le dans « Tes cartes ».',
    'La <strong>recherche de GIF</strong> est de retour dans le chat.',
    'Les parties de ligue demandent <strong>4 joueurs minimum</strong> ; l\'application s\'installe sur l\'écran d\'accueil de ton téléphone.',
    'Les demandes d\'amis et les invitations sont mieux protégées.',
    '<strong>Joueur absent</strong> : après 2 tours joués automatiquement, les autres joueurs peuvent voter pour le <strong>remplacer par un robot</strong> ou le <strong>retirer</strong> de la partie. Le jeu joue correctement à sa place en attendant ; il finit dernier, sans point de ligue.',
    'Une <strong>couronne 👑</strong> sur le nom du <strong>premier du classement de la ligue</strong>.',
    'Des <strong>récompenses</strong> dans ton profil : ⭐ à ta 1re victoire en ligue, 🍀 (trèfle à quatre feuilles) à la 3e, 🃏 (joker) à la 5e.',
    'Ajouter un ami est plus simple : un bouton <strong>➕</strong> à côté des joueurs de la partie, et des suggestions de pseudos.'
  ],
  fixes: [
    'Une invitation de partie peut maintenant être refusée, et ne reste plus affichée pendant une partie.',
    'La <strong>première carte du pli</strong> est mise en avant, avec un rappel de la couleur demandée (aide détaillée activable).',
    'Aux vraies cartes, les points se comptent comme en ligne (4 points + 4 par pli, −2 par pli d\'écart).'
  ]
};
var pollState = { open:false, mine:null, results:null, busy:false, msg:'', timer:null }, newsStep = null, notesOpen = false;
function pollIsOpen(){ return !POLL.end || nowMs() < POLL.end; }
function pollLeftText(){
  if(!POLL.end) return '';
  var ms = POLL.end - nowMs(); if(ms <= 0) return '';
  var h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000);
  return h >= 1 ? ('encore '+h+' h'+(m ? ' '+(m<10?'0':'')+m : '')) : ('encore '+m+' min');
}
function pollPath(uid){ return 'pollVotes/'+POLL.id+(uid ? '/'+uid : ''); }
async function pollLoadMine(){
  try{ var s = await claudeDb.doc(pollPath(myKeyId())).get(); var d = s.exists ? s.data() : null; pollState.mine = d ? ((d.__plain && d.__plain.c!=null) ? d.__plain.c : d.c) : null; }
  catch(e){ console.warn('sondage', e); }
}
async function pollLoadResults(){
  if(!isAdmin()) return;
  try{
    var snap = await claudeDb.collection(pollPath()).get(), counts = POLL.options.map(function(){ return 0; }), total = 0;
    snap.docs.forEach(function(d){ var x = d.data(), c = (x.__plain && x.__plain.c!=null) ? x.__plain.c : x.c; if(typeof c==='number' && counts[c]!=null){ counts[c]++; total++; } });
    pollState.results = { counts:counts, total:total };
  }catch(e){ console.warn('résultats du sondage', e); pollState.results = null; }
}
async function pollVote(i){
  if(!pollIsOpen() || !claudeDb || pollState.busy || POLL.options[i]==null) return;
  pollState.busy = true; pollState.msg = ''; renderPoll();
  try{
    await claudeDb.doc(pollPath(myKeyId())).set({ c:i, at:nowMs(), __plain:{ c:i } });
    pollState.mine = i; pollState.msg = 'Merci ! Ton vote est enregistré ✓ (tu peux encore changer d\'avis).';
    await pollLoadResults();
  }catch(e){ console.error(e); pollState.msg = 'Impossible d\'enregistrer ton vote : '+dbErrorText(e); }
  pollState.busy = false; renderPoll();
}
function pollResultsHtml(){
  if(!isAdmin()) return '';
  var r = pollState.results; if(!r) return '<div class="muted" style="font-size:12.5px; margin-top:10px;">Résultats (organisateur) : chargement…</div>';
  var max = Math.max.apply(null, r.counts.concat([1]));
  return '<div class="poll-res"><div class="eyebrow">📊 Résultats (visibles par toi seul) · '+r.total+' vote'+(r.total>1?'s':'')+'</div>'
    + POLL.options.map(function(o, i){
      var pc = r.total ? Math.round(100*r.counts[i]/r.total) : 0;
      return '<div class="poll-bar"><span class="poll-lbl">'+esc(o)+'</span><span class="poll-track"><i style="width:'+Math.round(100*r.counts[i]/max)+'%"></i></span><span class="poll-n">'+r.counts[i]+' · '+pc+' %</span></div>';
    }).join('')
    + (pollIsOpen() ? '' : '<div class="muted" style="font-size:12.5px; margin-top:6px;">Sondage terminé : annonce le gagnant aux joueurs.</div>') + '</div>';
}

// ---- visite interactive (mêmes styles que le tuto des règles : tt-*) ----
function newsShowcase(){ // quatre cartes Halloween (Roi, Dame, Valet, As de pique) : mur + portrait, comme dans le jeu
  var wall = cafeUri(halloWall()), card = function(svg, i, ace){ return '<span class="news-hcard tt-a"'+ttD(i*170)+'>'
    + (ace ? '<i style="background-image:url(\''+cafeUri(svg)+'\')"></i>' : '<i style="background-image:url(\''+wall+'\')"></i><i style="background-image:url(\''+cafeUri(svg)+'\')"></i>')+'</span>'; };
  return '<div class="news-fan">'+card(halloKing('H'), 0)+card(halloQueen('S'), 1)+card(halloJack('D'), 2)+card(halloAceSpade(), 3, true)+'</div>';
}
var NEWS_SLIDES = [
  { t:'Le paquet Halloween 🎃', d:'Dracula, le zombie, la momie et la Faucheuse, sur un fond d\'araignées, de chauves-souris et de citrouilles. À choisir dans « Tes cartes ».', s:newsShowcase },
  { t:'Un joueur absent ? On vote.', d:'Après 2 tours joués automatiquement, les autres peuvent le remplacer par un robot ou le retirer. Il finit dernier, sans point de ligue.',
    s:function(){ return '<div class="tt-row">'+['Léa|','Tom|💤','Max|'].map(function(x,i){ var p=x.split('|'); return '<span class="news-seat tt-a'+(p[1]?' off':'')+'"'+ttD(i*200)+'>'+p[0]+(p[1]?' '+p[1]:'')+'</span>'; }).join('')+'</div>'
      + '<div class="tt-bubble tt-a"'+ttD(700)+'>« Tom ne joue plus… »</div>'
      + '<div class="tt-row"><span class="tt-pick news-pick tt-a"'+ttD(1100)+'>🤖 Le remplacer</span><span class="tt-pick news-pick tt-a"'+ttD(1300)+'>🚪 Le retirer</span></div>'; } },
  { t:'Amis et couronne 👑', d:'Ajoute un ami en un clic avec ➕, dans le salon et à la fin de la partie. Le premier de la ligue porte la couronne ; tes victoires te rapportent ⭐ 🍀 🃏 dans ton profil.',
    s:function(){ return '<div class="tt-results"><div class="tt-res tt-a"'+ttD(0)+'><span>Léa 👑</span><span class="muted">dernière gagnante</span><span class="tt-ok">en ligue</span></div>'
      + '<div class="tt-res tt-a"'+ttD(350)+'><span>Tom</span><span class="muted">fin de partie</span><span class="news-addbtn">➕</span></div>'
      + '<div class="tt-res tt-a"'+ttD(700)+'><span>Max</span><span class="muted">salon</span><span class="news-addbtn">➕</span></div></div>'; } },
  { t:'Un nom pour le paquet ?', poll:true,
    d:function(){ return pollIsOpen() ? ('Les cartes se jouent déjà sans nom au dos : c\'est toi qui le choisis ! Sondage ouvert'+(pollLeftText() ? ', '+pollLeftText() : '')+'.') : 'Le sondage est terminé, merci à tous !'; },
    s:function(){
      var open = pollIsOpen(), canVote = !!claudeDb && (usingFirebase || usingMock);
      if(!canVote) return '<div class="tt-label">Le vote est disponible quand tu es connecté en ligne.</div>';
      return '<div class="news-poll">'+POLL.options.map(function(o, i){
          return '<button class="btn secondary news-opt'+(pollState.mine===i?' picked':'')+'" data-action="poll-vote" data-i="'+i+'"'+((open && !pollState.busy)?'':' disabled')+'>'+(pollState.mine===i?'✓ ':'')+esc(o)+'</button>';
        }).join('')
        + (pollState.msg ? '<div style="font-size:13px; font-weight:700;">'+esc(pollState.msg)+'</div>' : '') + pollResultsHtml() + '</div>';
    } }
];
function renderNewsTour(){
  var st = NEWS_SLIDES[newsStep], last = newsStep === NEWS_SLIDES.length-1, text = typeof st.d==='function' ? st.d() : st.d;
  return '<div class="tt-backdrop" data-noi18n><div class="tt-box" role="dialog" aria-modal="true" aria-label="Nouveautés">'
    + '<div class="tt-top"><span class="tt-count">Nouveautés · '+(newsStep+1)+' / '+NEWS_SLIDES.length+'</span><button class="btn ghost small" data-action="news-close">Fermer ✕</button></div>'
    + '<div class="tt-progress"><span style="width:'+Math.round((newsStep+1)/NEWS_SLIDES.length*100)+'%"></span></div>'
    + '<div class="tt-scene">'+st.s()+'</div>'
    + '<h3 class="tt-title">'+st.t+'</h3><p class="tt-text">'+text+'</p>'
    + '<div class="tt-nav">'+(newsStep>0 ? '<button class="btn secondary" data-action="news-prev">← Précédent</button>' : '<span></span>')
    + (last ? '<button class="btn" data-action="news-close">Terminé</button>' : '<button class="btn" data-action="news-next">Suivant →</button>')+'</div>'
    + '<button class="btn ghost small tt-more" data-action="notes-open">Voir tout le détail des nouveautés</button></div></div>';
}
function renderNotes(){ // notes de version : tout le détail (on y arrive en touchant le numéro de version, ou depuis la visite)
  return '<div class="modal-backdrop" data-action="notes-bg" data-noi18n><div class="card-panel modal news-card" role="dialog" aria-modal="true">'
    + '<h2 class="news-title">Version '+esc(NEWS.version)+'</h2>'
    + '<div class="eyebrow">Nouveautés</div><ul class="news-list">'+NEWS.items.map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul>'
    + (NEWS.fixes.length ? '<div class="eyebrow">Bugs corrigés</div><ul class="news-list">'+NEWS.fixes.map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul>' : '')
    + '<div class="row" style="justify-content:flex-end; margin-top:14px;"><button class="btn" data-action="notes-close">Fermer</button></div></div></div>';
}
function renderPoll(){ // (garde le même nom : redessine la visite ou les notes)
  var root = document.getElementById('news-root'); if(!root) return;
  root.innerHTML = newsStep!=null ? renderNewsTour() : (notesOpen ? renderNotes() : '');
}
async function pollOpen(step){
  var root = document.getElementById('news-root');
  if(!root){ root = document.createElement('div'); root.id = 'news-root'; document.body.appendChild(root); }
  newsStep = (step==null) ? NEWS_SLIDES.length-1 : step; notesOpen = false; pollState.open = true; pollState.msg = ''; renderPoll();
  if(claudeDb){ await pollLoadMine(); await pollLoadResults(); renderPoll(); }
  if(pollState.timer) clearInterval(pollState.timer);
  pollState.timer = setInterval(function(){ if(newsStep==null){ clearInterval(pollState.timer); pollState.timer = null; return; } pollLoadResults().then(renderPoll); }, 20000);
}
function pollClose(){
  newsStep = null; pollState.open = false; renderPoll();
  try{ localStorage.setItem('rikiki_news_seen', NEWS.version); }catch(e){}
}
// bannière de l'accueil : ouvre le vote (tout le monde) ; une fois terminé, seul l'organisateur garde un accès aux résultats
function renderPollBanner(){
  if(!(usingFirebase || usingMock)) return '';
  if(pollIsOpen()) return '<button class="poll-banner" data-action="poll-open"><span class="poll-ico">🗳️</span><span><strong>Vote pour le nom du prochain paquet</strong><small>'+(pollLeftText() || 'sondage ouvert')+' · nouveautés</small></span></button>';
  if(isAdmin()) return '<button class="poll-banner" data-action="poll-open"><span class="poll-ico">📊</span><span><strong>Résultats du sondage</strong><small>sondage terminé</small></span></button>';
  return '';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='poll-open') pollOpen();
  else if(a==='news-close') pollClose();
  else if(a==='news-next'){ newsStep = Math.min(NEWS_SLIDES.length-1, newsStep+1); renderPoll(); }
  else if(a==='news-prev'){ newsStep = Math.max(0, newsStep-1); renderPoll(); }
  else if(a==='poll-vote') pollVote(parseInt(el.getAttribute('data-i'), 10));
  else if(a==='notes-open'){ var root = document.getElementById('news-root'); if(!root){ root = document.createElement('div'); root.id = 'news-root'; document.body.appendChild(root); } newsStep = null; notesOpen = true; renderPoll(); }
  else if(a==='notes-close' || (a==='notes-bg' && e.target===el)){ notesOpen = false; renderPoll(); try{ localStorage.setItem('rikiki_news_seen', NEWS.version); }catch(err){} }
});
// teasing : à la première ouverture après une mise à jour (jamais en pleine partie)
setTimeout(function(){
  try{ if(localStorage.getItem('rikiki_news_seen') === NEWS.version) return; }catch(e){}
  if(typeof screen !== 'undefined' && screen === 'game') return;
  pollOpen(0);
}, 3500);
