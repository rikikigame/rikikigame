/* ===================== nouveautés : visite interactive à l'ouverture du site =====================
   - À la première ouverture après une mise à jour, une petite visite (comme celle des règles : quelques diapos animées) annonce les points forts (NEWS_SLIDES).
     Elle ne revient plus ensuite (localStorage rikiki_news_seen) ; la bannière « Il y a du nouveau ! » de l'accueil la rouvre. Le DÉTAIL complet
     (NEWS.items + NEWS.fixes) est dans les « notes de version » : toucher le numéro de version en bas de l'accueil.
   - (Le sondage « nom du paquet » a été retiré en 1.11.0 : la maison s'appelle « Le Casino de Fredo ». Les anciennes règles Firebase pollVotes restent inchangées.) */
var NEWS = {
  // version = le vrai numéro du jeu (affiché dans les notes) ; tour = repère de la petite visite (gardé à '64' : les diapos ne rejouent pas pour ceux qui les ont vues)
  version: APP_VERSION, tour: '1.11', title: '🎰 Du nouveau sur Rikiki !',
  items: [
    '<!--casino--><strong>🎰 Le Casino de Fredo</strong> : Fredo a toujours aimé les jeux d\'argent. Un soir, il s\'est dit qu\'un casino au café, ce serait quand même sympa. Il a ouvert une table, puis deux, puis trois. Tout se joue avec des jetons pour de faux, jamais avec de l\'argent. Tu le trouves sur l\'accueil, dans « Mini casino ».',
    '<!--casino--><strong>🎟️ Tes jetons de départ</strong> : au casino, tu démarres avec tes points de ligue du mois dernier (750 si tu débutes). Et chaque jour passé en haut du classement du mois en cours te rapporte un petit bonus pour tes prochaines parties : 3 jetons en 1re place, 2 dans les 3 premiers, 1 dans les 10 premiers. On joue ensuite tant qu\'il reste des jetons, et l\'organisateur peut arrêter la partie quand il veut.',
    '<!--casino--><strong>🃏 Poker</strong> : Texas Hold\'em de 2 à 8 joueurs, avec des blindes qui montent au fil des mains, le tapis et les pots annexes. Tes cartes restent secrètes, et celui qui a le plus de jetons à la fin gagne.',
    '<!--casino--><strong>🂡 Blackjack</strong> : seul contre le croupier ou à plusieurs. Mise de 10 à 500, blackjack payé 3 pour 2, et tu peux doubler. De 5 à 20 manches.',
    '<!--casino--><strong>🎡 Roulette</strong> : roulette européenne à 37 cases, seul ou à plusieurs. Pose tes jetons sur un numéro (35 contre 1), une couleur, pair ou impair, une douzaine ou une colonne, puis regarde la bille tourner. De 5 à 20 tours.',
    '<!--casino--><strong>🎴 Nouvelles cartes</strong> : un nouveau jeu où les symboles de couleur sont de vrais jetons de casino. Tu le choisis dans ⚙️ Paramètres, rubrique « Tes cartes ».',
    '<!--casino--><strong>🎷 Une vraie ambiance de casino</strong> : un décor animé, du jazz de club, des bruitages de jetons, de cartes et de roulette, et un croupier à chaque table. Tout se coupe dans ⚙️ Paramètres.',
    '<strong>🏆 La ligue repart chaque mois</strong> : le classement du mois repart de zéro (1000 points) le 1er de chaque mois, pour que chacun ait sa chance. Tes stats et le classement « Général » restent, et tu peux toujours revoir les mois passés.',
    '<strong>✨ Un site plus soigné</strong> : titre en or, panneaux, boutons, menus et champs de nombres plus agréables, jetons de couleur selon leur valeur.',
    '<strong>Salon</strong> : le bouton « Je suis prêt » pulse tant que tu n\'as pas cliqué, et un second bouton apparaît en bas de l\'écran.',
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
    '<strong>⚙️ Paramètres</strong> : bruitages, musique, aide, grand texte et jeu automatique au même endroit. Sur l\'appli iPhone, le son marche aussi en mode silencieux.',
    '<strong>😈 Mode frauduleux</strong> : en fin de soirée, on regarde un peu moins les cartes. Alors pourquoi ne pas en glisser quelques-unes, des vraies et des fausses, et oublier de temps en temps les règles ? Attention : si un joueur te surprend, tu perds 5 points. Entre vrais joueurs, 5 manches rapides de 10 secondes par tour, hors ligue. Tu le coches dans le salon d\'une partie.',
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
var pollState = { open:false }, newsStep = null, notesOpen = false;
// tant que le Mini casino est caché (lien secret #casino), la visite et les notes n'en parlent pas
function newsSlides(){ var on = casinoVisible(); return NEWS_SLIDES.filter(function(sl){ return on || !sl.casino; }); }
function newsItems(){ var on = casinoVisible(); return NEWS.items.filter(function(t){ return on || t.indexOf('<!--casino-->') < 0; }); }
// ---- visite interactive (mêmes styles que le tuto des règles : tt-*) ----
function newsShowcase(){ // quatre cartes Halloween (Roi, Dame, Valet, As de pique) : mur + portrait, comme dans le jeu
  var wall = cafeUri(halloWall()), card = function(svg, i, ace){ return '<span class="news-hcard tt-a"'+ttD(i*170)+'>'
    + (ace ? '<i style="background-image:url(\''+cafeUri(svg)+'\')"></i>' : '<i style="background-image:url(\''+wall+'\')"></i><i style="background-image:url(\''+cafeUri(svg)+'\')"></i>')+'</span>'; };
  return '<div class="news-fan">'+card(halloKing('H'), 0)+card(halloQueen('S'), 1)+card(halloJack('D'), 2)+card(halloAceSpade(), 3, true)+'</div>';
}
function newsCards(){ // trois cartes du nouveau jeu (Roi, Dame, Valet), sans prénoms
  var wall = cafeUri(casinoWall()), cs = [{ rank:'K', suit:'S' }, { rank:'Q', suit:'H' }, { rank:'J', suit:'D' }];
  return '<div class="news-casino">'+cs.map(function(c, i){ return '<figure class="tt-a"'+ttD(i*220)+'><span class="news-ccard"><i style="background-image:url(\''+wall+'\')"></i><i style="background-image:url(\''+casinoArt(c)+'\')"></i></span></figure>'; }).join('')+'</div>';
}
function newsChips(){ return '<div class="news-chips tt-a" aria-hidden="true">'+['H','C','D','S'].map(function(su){ return '<span>'+casinoSymInline(su)+'</span>'; }).join('')+'</div>'; }
var NEWS_SLIDES = [
  { casino:true, t:'Le Casino de Fredo 🎰', d:'Fredo a toujours adoré les jeux d\'argent. Un soir, au café, il s\'est dit : « Et si j\'ouvrais un casino ? » Eh bien voilà, c\'est fait ! Tout se joue avec des jetons pour de faux, jamais avec de l\'argent.',
    s:function(){ return '<div class="news-sign tt-a" data-noi18n>Casino de Fredo</div><div class="news-chips tt-a"'+ttD(500)+' aria-hidden="true">'+['H','C','D','S'].map(function(su){ return '<span>'+casinoSymInline(su)+'</span>'; }).join('')+'</div>'; } },
  { casino:true, t:'Trois jeux à la table', d:'Seul, entre amis ou avec des robots. On joue tant qu\'il reste des jetons. Tu choisis ton jeu dans « Mini casino », sur l\'accueil.',
    s:function(){ return '<div class="tt-results">'+[['♠ Poker', 'Texas Hold\'em'], ['🃏 Blackjack', 'contre le croupier'], ['🎡 Roulette', 'rouge, noir, numéros…']].map(function(r, i){ return '<div class="tt-res tt-a"'+ttD(i*320)+'><span>'+r[0]+'</span><span class="muted">'+r[1]+'</span></div>'; }).join('')+'</div>'; } },
  { casino:true, t:'Tes jetons de départ 🎟️', d:'Tu démarres avec tes points de ligue du mois dernier (750 si tu débutes). Et chaque jour passé en haut du classement du mois en cours te rapporte un petit bonus pour tes prochaines parties.',
    s:function(){ return '<div class="tt-results">'+[['Tes points du mois dernier', '1180'], ['Bonus de ce mois-ci', '+24'], ['Si tu débutes', '750']].map(function(r, i){ return '<div class="tt-res tt-a"'+ttD(i*320)+'><span>'+r[0]+'</span><span class="tt-ok">'+r[1]+'</span></div>'; }).join('')+'</div>'; } },
  { casino:true, t:'Nouvelles cartes 🎴', d:'Un nouveau jeu de cartes, où les symboles sont de vrais jetons de casino. Tu le choisis dans ⚙️ Paramètres, rubrique « Tes cartes ».', s:newsCards },
  { casino:true, t:'Une vraie ambiance 🎷', d:'Un décor animé, du jazz de club, des bruitages de jetons, de cartes et de roulette, et un croupier à chaque table. Tu peux tout couper dans ⚙️ Paramètres.', s:newsChips },
  { t:'La ligue repart chaque mois 🏆', d:'Le classement du mois repart de zéro le 1er de chaque mois : chacun a sa chance. Tes stats et le classement « Général » restent, et tu peux revoir les mois passés.',
    s:function(){ return '<div class="tt-results"><div class="tt-res tt-a"'+ttD(0)+'><span>Octobre</span><span class="muted">terminé</span><span class="tt-ok">à revoir</span></div>'
      + '<div class="tt-res tt-a"'+ttD(350)+'><span>Novembre</span><span class="muted">nouveau départ</span><span class="tt-ok">1000</span></div>'
      + '<div class="tt-res tt-a"'+ttD(700)+'><span>Général</span><span class="muted">depuis le début</span><span class="tt-ok">conservé</span></div></div>'; } },
  { t:'Le mode frauduleux 😈', d:'En fin de soirée, on regarde un peu moins les cartes. Alors pourquoi ne pas en glisser quelques-unes, des vraies et des fausses, et oublier de temps en temps les règles ? Mais attention : si un joueur te surprend, tu perds 5 points. Tu le coches dans le salon, entre vrais joueurs.',
    s:function(){ return '<div class="tt-row">'+['🃏 Carte glissée','👀 Vu !','−5 points'].map(function(x, i){ return '<span class="tt-pick news-pick tt-a"'+ttD(i*260)+'>'+x+'</span>'; }).join('')+'</div>'; } }
];
function renderNewsTour(){
  var SL = newsSlides(), st = SL[newsStep], last = newsStep === SL.length-1, text = typeof st.d==='function' ? st.d() : st.d;
  return '<div class="tt-backdrop" data-noi18n><div class="tt-box" role="dialog" aria-modal="true" aria-label="Nouveautés">'
    + '<div class="tt-top"><span class="tt-count">Nouveautés · '+(newsStep+1)+' / '+SL.length+'</span><button class="btn ghost small" data-action="news-close">Fermer ✕</button></div>'
    + '<div class="tt-progress"><span style="width:'+Math.round((newsStep+1)/SL.length*100)+'%"></span></div>'
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
    + '<div class="eyebrow">Nouveautés</div><ul class="news-list">'+newsItems().map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul>'
    + (NEWS.fixes.length ? '<div class="eyebrow">Bugs corrigés</div><ul class="news-list">'+NEWS.fixes.map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul>' : '')
    + '<div class="row" style="justify-content:flex-end; margin-top:14px;"><button class="btn" data-action="notes-close">Fermer</button></div></div></div>';
}
function renderPoll(){ // (garde le même nom : redessine la visite ou les notes)
  var root = document.getElementById('news-root'); if(!root) return;
  root.innerHTML = newsStep!=null ? renderNewsTour() : (notesOpen ? renderNotes() : '');
}
function pollOpen(step){ // ouvre la visite des nouveautés (nom d'origine « poll » conservé : plusieurs endroits l'appellent)
  var root = document.getElementById('news-root');
  if(!root){ root = document.createElement('div'); root.id = 'news-root'; document.body.appendChild(root); }
  newsStep = (step==null) ? 0 : step; notesOpen = false; pollState.open = true; renderPoll();
}
function pollClose(){
  newsStep = null; pollState.open = false; renderPoll();
  try{ localStorage.setItem('rikiki_news_seen', NEWS.tour); }catch(e){}
}
// bannière de l'accueil : ouvre le vote (tout le monde) ; une fois terminé, seul l'organisateur garde un accès aux résultats
function renderPollBanner(){ // bannière « Il y a du nouveau ! » de l'accueil : ouvre la visite des nouveautés
  if(!(usingFirebase || usingMock)) return '';
  return '<button class="poll-banner" data-action="poll-open"><span class="poll-ico">🎰</span><span><strong>Il y a du nouveau !</strong><small>'+(casinoVisible() ? 'Le Casino de Fredo, ligue mensuelle, mode frauduleux…' : 'Ligue mensuelle, mode frauduleux…')+'</small></span></button>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='poll-open') pollOpen();
  else if(a==='news-close') pollClose();
  else if(a==='news-next'){ newsStep = Math.min(newsSlides().length-1, newsStep+1); renderPoll(); }
  else if(a==='news-prev'){ newsStep = Math.max(0, newsStep-1); renderPoll(); }
  else if(a==='notes-open'){ var root = document.getElementById('news-root'); if(!root){ root = document.createElement('div'); root.id = 'news-root'; document.body.appendChild(root); } newsStep = null; notesOpen = true; renderPoll(); }
  else if(a==='notes-close' || (a==='notes-bg' && e.target===el)){ notesOpen = false; renderPoll(); try{ localStorage.setItem('rikiki_news_seen', NEWS.tour); }catch(err){} }
});
// teasing : à la première ouverture après une mise à jour (jamais en pleine partie)
setTimeout(function(){
  try{ if(localStorage.getItem('rikiki_news_seen') === NEWS.tour) return; }catch(e){}
  if(DEVICE_IS_NEW){ try{ localStorage.setItem('rikiki_news_seen', NEWS.tour); }catch(e){} return; } // 1.8.0 : un nouveau joueur n'a pas à voir « Du nouveau » : rien à comparer
  if(typeof screen !== 'undefined' && screen === 'game') return;
  pollOpen(0);
}, 3500);
