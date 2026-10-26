/* ===================== v64 : nouveautés (visite interactive à l'ouverture du site) + sondage « nom du paquet » =====================
   - À la première ouverture après une mise à jour, une petite visite (comme celle des règles : quelques diapos animées, pas toutes les nouveautés)
     annonce les points forts (NEWS_SLIDES) et propose de voter. Elle ne revient plus ensuite (localStorage rikiki_news_seen) ; la bannière de
     l'accueil rouvre le sondage. Le DÉTAIL complet (NEWS.items + NEWS.fixes) est dans les « notes de version » : toucher le numéro de version en bas de l'accueil.
   - Sondage : chaque appareil / compte a UN vote (modifiable jusqu'à la fin) : pollVotes/{sondage}/{compte}, champ en clair c = numéro
     de l'option. Seul l'organisateur peut lire tous les votes (règles Firebase) : il voit les résultats dans cette même fenêtre.
   - Pour un nouveau sondage : changer POLL.id, POLL.options, POLL.end (fin en millisecondes ; 0 = jamais fermé, pour les tests)
     ET la règle pollVotes dans regles-firebase.json (identifiant + date de fin). */
var POLL = { id:'deck1', title:'Quel nom pour le paquet Halloween ?', options:['Minuit au Café', 'Café des Damnés', 'Le Cimetière d\'Albert'], end:1791906939843,
  final:[29, 0, 71] }; // v69 : résultat final PUBLIC, en % seulement (13/10/2026) — les votes eux-mêmes restent lisibles par l'organisateur seul
var NEWS = {
  // version = le vrai numéro du jeu (affiché dans les notes) ; tour = repère de la petite visite (gardé à '64' : les diapos ne rejouent pas pour ceux qui les ont vues)
  version: APP_VERSION, tour: '64', title: '🎃 Du nouveau sur Rikiki !',
  items: [
    '<strong>Tournoi du dimanche</strong> : chaque dimanche, les parties de ligue en ligne forment un tournoi (2 parties minimum). Un bandeau sur l\'accueil t\'invite à jouer, puis annonce le résultat à 21 h. Classement et palmarès dans Ligue › En ligne.',
    '<strong>Signaler un bug</strong> : dans ⚙️ Paramètres, un bouton pour nous dire en une phrase ce qui ne va pas. Si le jeu plante, il te propose aussi d\'envoyer un rapport (jamais sans ton clic).',
    'Le jeu a <strong>sa propre adresse : rikikigame.com</strong>. En bas de l\'accueil, tu trouves les pages <strong>Confidentialité, Conditions, Cookies et Mentions légales</strong>.',
    '<strong>Supprimer mon compte</strong> : dans ton profil, tu peux effacer ton compte (il faut écrire ton pseudo et ton code).',
    '<strong>Duels</strong> : à la fin d\'une partie, tu vois qui t\'a ruiné le plus de contrats (« pire ennemi ») et à qui tu as le plus gâché les siens (« victime préférée »). Les joueurs réguliers l\'ont aussi sur leur fiche de la ligue (à partir de 5 parties ensemble).',
    '<strong>Jeu automatique</strong> : quand tu n\'as qu\'une seule carte jouable, le jeu la joue pour toi après 1 seconde. Tu peux le couper dans ⚙️ Paramètres.',
    '<strong>Reprendre ma partie</strong> : si tu quittes une partie sans faire exprès, un bouton sur l\'accueil te remet dedans (pendant 6 heures). Quitter une partie en cours demande maintenant une confirmation.',
    '<strong>Vraies cartes</strong> : une poignée ☰ pour changer l\'ordre des joueurs sans retaper les noms, et des suggestions de prénoms (tes amis, les derniers joueurs).',
    '<strong>Invités</strong> : à la fin d\'une partie, une invitation à créer un profil (pseudo + code à 4 chiffres) pour garder ta fiche de ligue et tes duels.',
    '<strong>Ligue</strong> : une couronne 👑 pour le premier, les « coupes » comptées pour chacun, et une « stat du jour » qui change chaque jour.',
    '<strong>⚙️ Paramètres</strong> : bruitages, musique, aide, grand texte et jeu automatique au même endroit. Sur l\'appli iPhone, le son marche aussi en mode silencieux.'
  ],
  fixes: [
    'La manche à une carte cachée dit maintenant « <strong>Clique sur ta carte pour la voir</strong> ».',
    'Quand tu rouvres le site, tu n\'es plus renvoyé dans une <strong>vieille partie abandonnée</strong> (plus de 6 heures sans activité).',
    'Le <strong>profil de l\'organisateur</strong> ne peut plus être pris avec « Code oublié ».',
    'Les salles d\'attente et les parties abandonnées sont <strong>nettoyées automatiquement</strong> ; les parties « en attente de confirmation » disparaissent de la ligue après 10 jours.',
    'La distribution des cartes qui restait bloquée en pleine partie est corrigée.',
    'Le <strong>paquet Halloween s\'appelle « Le Cimetière d\'Albert »</strong>, le nom choisi par vos votes (71 %).'
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
function pollFinalHtml(){ // résultat final : pourcentages seulement, le gagnant en évidence
  var best = POLL.final.indexOf(Math.max.apply(null, POLL.final));
  return '<div class="poll-res final">'
    + POLL.options.map(function(o, i){
      return '<div class="poll-bar'+(i===best?' win':'')+'"><span class="poll-lbl">'+(i===best?'🏆 ':'')+esc(o)+'</span><span class="poll-track"><i style="width:'+POLL.final[i]+'%"></i></span><span class="poll-n">'+POLL.final[i]+' %</span></div>';
    }).join('') + '</div>';
}
function pollResultsHtml(){
  if(!isAdmin() || !pollIsOpen()) return '';
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
    d:function(){ return pollIsOpen() ? ('Les cartes se jouent déjà sans nom au dos : c\'est toi qui le choisis ! Sondage ouvert'+(pollLeftText() ? ', '+pollLeftText() : '')+'.') : 'Le sondage est terminé : le paquet s\'appelle « Le Cimetière d\'Albert », choisi par 71 % des votes. Merci à tous !'; },
    s:function(){
      var open = pollIsOpen(), canVote = !!claudeDb && (usingFirebase || usingMock);
      if(!open) return pollFinalHtml();
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
    + '<p class="muted" style="font-size:12.5px; margin:0 0 10px;">Comment lire le numéro : <b>1.2.3</b>. Le 3<sup>e</sup> chiffre monte pour une petite réparation, le 2<sup>e</sup> pour une nouvelle fonction, le 1<sup>er</sup> pour un très gros changement.</p>'
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
  try{ localStorage.setItem('rikiki_news_seen', NEWS.tour); }catch(e){}
}
// bannière de l'accueil : ouvre le vote (tout le monde) ; une fois terminé, seul l'organisateur garde un accès aux résultats
function renderPollBanner(){
  if(!(usingFirebase || usingMock)) return '';
  if(pollIsOpen()) return '<button class="poll-banner" data-action="poll-open"><span class="poll-ico">🗳️</span><span><strong>Vote pour le nom du prochain paquet</strong><small>'+(pollLeftText() || 'sondage ouvert')+' · nouveautés</small></span></button>';
  return '<button class="poll-banner" data-action="poll-open"><span class="poll-ico">🏆</span><span><strong>Résultat du sondage</strong><small>Le Cimetière d\'Albert · '+POLL.final[POLL.final.indexOf(Math.max.apply(null, POLL.final))]+' %</small></span></button>';
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
  else if(a==='notes-close' || (a==='notes-bg' && e.target===el)){ notesOpen = false; renderPoll(); try{ localStorage.setItem('rikiki_news_seen', NEWS.tour); }catch(err){} }
});
// teasing : à la première ouverture après une mise à jour (jamais en pleine partie)
setTimeout(function(){
  try{ if(localStorage.getItem('rikiki_news_seen') === NEWS.tour) return; }catch(e){}
  if(typeof screen !== 'undefined' && screen === 'game') return;
  pollOpen(0);
}, 3500);
