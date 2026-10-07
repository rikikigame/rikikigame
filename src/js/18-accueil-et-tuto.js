/* ===================== v38 : nouvel accueil (direction « Nuit ») ===================== */
var homeProfileOpen = false;
var HOME_COLORS = ['#5E7CE2','#B3372B','#3F8F6B','#C9772F','#8A5CC7','#2F8FA3','#C24E86','#7A8A2E'];
function homeColorFor(id){ var h = 0; String(id).split('').forEach(function(c){ h = (h*31 + c.charCodeAt(0)) >>> 0; }); return HOME_COLORS[h % HOME_COLORS.length]; }
function homeIcon(name, size, color){
  var p = {
    bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"></path>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"></path>',
    plus:'<path d="M12 5v14M5 12h14"></path>',
    sheet:'<rect x="4" y="3" width="16" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"></path><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"></path>',
    book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"></path><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5"></path>',
    lock:'<rect x="5" y="11" width="14" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path>'
  }[name] || '';
  return '<svg width="'+(size||20)+'" height="'+(size||20)+'" viewBox="0 0 24 24" fill="none" stroke="'+(color||'currentColor')+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>';
}
function homeFanCard(rank, suit, red, cls){
  var sym = { S:'♠︎', H:'♥︎', D:'♦︎', C:'♣︎' }[suit];
  if(LANG==='en') rank = { D:'Q', R:'K', V:'J' }[rank] || rank; // figures anglaises
  return '<span class="hc-card '+cls+(red?' red':'')+'"><span class="hc-idx">'+rank+'<br>'+sym+'</span><span class="hc-mid">'+sym+'</span><span class="hc-idx hc-rot">'+rank+'<br>'+sym+'</span></span>';
}
function renderHomeFriends(){
  if(!socialOn()){
    return '<div class="home-friends"><div class="hf-head"><span class="hf-title">Amis en ligne</span></div>'
      + '<p class="hf-empty">Crée ou connecte ton profil pour ajouter des amis, les voir en ligne et les inviter.</p></div>';
  }
  var ids = friendIds(), online = ids.filter(friendOnline).length;
  var reqIds = Object.keys(social.reqs).filter(function(k){ return social.reqs[k] && !social.friends[k]; });
  var html = '<div class="home-friends"><div class="hf-head"><span class="hf-title">Amis en ligne'
    + (ids.length ? ' <span class="hf-count">· '+online+' sur '+ids.length+'</span>' : '') + '</span>'
    + '<button class="hf-link" data-action="friends-toggle">'+(social.open ? 'Fermer' : 'Ajouter')+(reqIds.length ? ' <span class="top-badge">'+reqIds.length+'</span>' : '')+'</button></div>';
  html += '<div class="hf-row">';
  ids.slice(0, 4).forEach(function(fid){
    var on = friendOnline(fid), pr = social.presence[fid], name = social.friends[fid].name || '?';
    var inLobby = on && pr && pr.status==='lobby' && pr.code;
    var st = !on ? 'hors ligne' : (pr && pr.status==='lobby' ? 'en salon' : (pr && pr.status==='playing' ? 'en partie' : (pr && pr.status==='cards' ? 'vraies cartes' : 'en ligne')));
    var av = '<span class="hf-av'+(on?'':' off')+'" style="background:'+(on ? homeColorFor(fid) : '#2A3247')+'">'+esc(name.charAt(0).toUpperCase())+(on?'<span class="hf-dot"></span>':'')+'</span>';
    var label = '<span class="hf-name">'+esc(name)+'</span><span class="hf-st'+(inLobby?' join':'')+'">'+(inLobby ? 'Rejoindre' : st)+'</span>';
    html += inLobby
      ? '<button class="hf-item" data-action="friend-join" data-code="'+esc(pr.code)+'" aria-label="Rejoindre '+esc(name)+' dans son salon">'+av+label+'</button>'
      : '<div class="hf-item">'+av+label+'</div>';
  });
  html += '<button class="hf-item" data-action="friends-toggle" aria-label="Ajouter un ami"><span class="hf-av add">'+homeIcon('plus', 18)+'</span><span class="hf-name">'+(ids.length ? 'Ajouter' : 'Ajoute')+'</span><span class="hf-st">'+(ids.length ? 'un ami' : 'tes amis')+'</span></button>';
  html += '</div>';
  if(social.open) html += '<div class="home-panel">'+renderFriendsPanel()+'</div>';
  return html + '</div>';
}
function renderEntry(){
  var html = '<div class="home-c">';
  // --- en-tête ---
  var pseudo = currentProfile ? currentProfile.pseudo : '';
  html += '<div class="hc-head">';
  if(currentProfile){
    html += '<div class="hc-hello"><span class="hc-hi">Salut</span><span class="hc-name">'+esc(pseudo)+'</span></div>'
      + '<input type="hidden" id="nameInput" value="'+esc(myProfile.name || pseudo)+'">';
  } else {
    html += '<div class="hc-hello"><label class="hc-hi" for="nameInput">Salut, ton prénom ?</label>'
      + '<input type="text" id="nameInput" class="hc-name-input" maxlength="24" placeholder="Ton prénom" value="'+esc(myProfile.name)+'" autocomplete="given-name"></div>';
  }
  var init = (pseudo || myProfile.name || '?').charAt(0).toUpperCase();
  html += '<button class="hc-avatar'+(currentProfile?'':' guest')+'" data-action="home-profile" aria-label="'+(currentProfile ? 'Mon profil' : 'Créer ou connecter mon profil')+'" aria-expanded="'+(homeProfileOpen?'true':'false')+'">'
    + (currentProfile ? esc(init) : '<span class="hc-avatar-txt">Profil</span>') + '</button>';
  html += '</div>';
  var mustShowProfile = homeProfileOpen || (currentProfile && authOn() && authAnon()) || !!profileUi.err || !!profileUi.ok || !!profileUi.mode;
  if(mustShowProfile) html += '<div class="home-panel">'+renderProfileBox()+'</div>';
  else if(isAdmin() && authOn() && profileClaimsList.length) // v42 : l'organisateur voit les demandes dès l'accueil
    html += '<div class="home-panel"><div class="card-panel" style="margin-bottom:12px; padding:12px 16px;">'+renderClaimsList()+'</div></div>';
  // --- titre ---
  html += '<div class="hc-brand"><div class="hc-suits" aria-hidden="true"><span>♠︎</span><span class="r">♥︎</span><span>♣︎</span><span class="r">♦︎</span></div>'
    + '<h1 class="hc-title">Rikiki</h1><div class="hc-tag">Le jeu de plis à annonces</div></div>';
  if(!tutoSeen()) html += '<div class="tt-hello"><span class="tt-hello-txt"><strong>Nouveau au Rikiki ?</strong>Les règles en 1 minute, en animation.</span>'
    + '<button class="btn small" data-action="tuto-open">Voir le tuto</button><button class="btn ghost small" data-action="tuto-dismiss" aria-label="Masquer">✕</button></div>';
  // --- partie rapide ---
  html += '<button class="hc-hero" data-action="quick-create">'
    + '<span class="hc-fan" aria-hidden="true">'
    + homeFanCard('7','C',false,'f1') + homeFanCard('D','D',true,'f2') + homeFanCard('A','S',false,'f3') + homeFanCard('R','H',true,'f4') + homeFanCard('V','S',false,'f5')
    + '</span>'
    + '<span class="hc-hero-txt"><span class="hc-kicker">'+homeIcon('bolt', 16)+' Mode rapide</span>'
    + '<span class="hc-hero-title">Partie rapide</span><span class="hc-hero-sub">5 manches · cartes au hasard</span>'
    + '<span class="hc-play">Jouer '+homeIcon('arrow', 18)+'</span></span></button>';
  // --- rejoindre avec un code ---
  html += '<div class="hc-join"><label for="joinCodeInput">Code</label>'
    + '<input type="text" id="joinCodeInput" maxlength="4" placeholder="K7QT" value="'+esc(prefillCode||'')+'" autocapitalize="characters" autocomplete="off">'
    + '<button data-action="do-join">Rejoindre</button></div>';
  if(errorMsg) html += '<div class="error-text hc-error">'+esc(errorMsg)+'</div>';
  // --- modes ---
  var tile = function(action, icon, title, sub){ return '<button class="hc-tile" data-action="'+action+'">'+homeIcon(icon, 22, '#7CC4FF')+'<span class="hc-tile-txt"><span class="hc-tile-title">'+title+'</span><span class="hc-tile-sub">'+sub+'</span></span></button>'; };
  html += '<div class="hc-tiles">'
    + tile('do-create', 'plus', 'Créer une partie', 'Un code à partager')
    + tile('sheet-open', 'sheet', 'Vraies cartes', 'Le téléphone compte')
    + tile('league-openscreen', 'trophy', 'Ligue', 'Classement de la saison')
    + tile('tuto-open', 'book', 'Règles', 'Tuto animé · 1 min')
    + '</div>';
  // --- amis ---
  html += renderHomeFriends();
  // --- pied de page ---
  html += '<div class="hc-foot"><span class="hc-status">'
    + (usingFirebase ? '<span class="hc-dot"></span>En ligne' : (usingMock ? 'Mode local : synchronisé entre les onglets de ce navigateur' : ''))
    + '</span><span class="hc-ver">'+(BEER_URL ? '<button class="hc-beer" data-action="beer-open" aria-label="Offrir une bière au créateur">🍺</button>' : '')+'<span class="hc-lang" data-noi18n>'
    + '<button data-action="set-lang" data-lang="fr" aria-pressed="'+(LANG==='fr')+'"'+(LANG==='fr'?' class="on"':'')+'>FR</button>'
    + '<button data-action="set-lang" data-lang="en" aria-pressed="'+(LANG==='en')+'"'+(LANG==='en'?' class="on"':'')+'>EN</button></span> v'+APP_VERSION+'</span></div>';
  html += '</div>';
  if(showRules) html += renderRulesModal();
  if(beerOpen) html += renderBeerModal();
  return html;
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="home-profile"]') : null; if(!el) return;
  homeProfileOpen = !homeProfileOpen;
  if(!homeProfileOpen){ profileUi.err=''; profileUi.ok=''; profileUi.mode=null; }
  else if(isAdmin()) loadClaims().then(render); // l'organisateur voit les nouvelles demandes « code oublié » sans recharger
  render();
});
document.addEventListener('keydown', function(e){
  if(e.key==='Enter' && e.target && e.target.id==='joinCodeInput' && screen==='entry'){ e.preventDefault(); var b = document.querySelector('[data-action="do-join"]'); if(b) b.click(); }
});

/* ===================== v40 : tuto animé des règles (sans les points) ===================== */
var tutoStep = null;
function ttCard(rank, suit, extra){
  var val = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,A:14 }[rank] || 0;
  return '<span class="tt-c'+(extra?' '+extra:'')+'">'+cardHtml({ suit:suit, rank:rank, value:val }, { size:'trick-size' })+'</span>';
}
function ttBack(extra){ return '<span class="tt-c tt-backc'+(extra?' '+extra:'')+'"><span class="tt-back"></span></span>'; }
function ttD(ms){ return ' style="animation-delay:'+ms+'ms"'; }
var TUTO_STEPS = [
  { t:'Le but du jeu', d:'À chaque manche, annonce <strong>exactement</strong> combien de plis tu vas gagner. Ni plus, ni moins.',
    s:function(){ return '<div class="tt-row">'+['7|C','R|H','A|S'].map(function(x,i){ var p=x.split('|'); return '<span class="tt-a"'+ttD(i*140)+'>'+ttCard(p[0],p[1])+'</span>'; }).join('')+'</div>'
      + '<div class="tt-bubble tt-a"'+ttD(650)+'>« Je fais <strong>2</strong> plis »</div>'; } },
  { t:'La donne', d:'Chaque manche, on distribue un nombre de cartes différent : 1 carte, puis 2, puis 3… Ici, c\'est la manche à <strong>3 cartes</strong>.',
    s:function(){
      var seats = ['Léa','Tom','Max','Toi'], html = '<div class="tt-table">';
      seats.forEach(function(n, i){
        html += '<div class="tt-seat s'+i+'"><span class="tt-name">'+n+'</span><span class="tt-mini">';
        for(var k=0;k<3;k++) html += '<span class="tt-minib tt-deal"'+ttD((k*4+i)*110)+'></span>';
        html += '</span></div>';
      });
      return html + '<div class="tt-deck">'+ttBack()+'</div></div>'; } },
  { t:'L\'atout', d:'Après la donne, on retourne la carte suivante du paquet : sa couleur devient <strong>l\'atout</strong>. Quand toutes les cartes sont distribuées, il n\'y a pas d\'atout.',
    s:function(){ return '<div class="tt-row">'+ttBack()+'<span class="tt-flip">'+ttCard('7','H','tt-glow')+'</span></div><div class="tt-label tt-a"'+ttD(700)+'>Atout : <span class="tt-red">♥︎ cœur</span></div>'; } },
  { t:'Les annonces', d:'Chacun annonce à son tour combien de plis il pense faire, en commençant par le joueur à gauche du donneur. <strong>Le donneur parle en dernier.</strong>',
    s:function(){ return '<div class="tt-bids">'+[['Léa','1'],['Tom','0'],['Max','2'],['Toi · donneur','?']].map(function(x,i){ return '<div class="tt-bid tt-a"'+ttD(i*450)+'><span class="tt-name">'+x[0]+'</span><span class="tt-num'+(x[1]==='?'?' q':'')+'">'+x[1]+'</span></div>'; }).join('')+'</div>'; } },
  { t:'Le total ne tombe jamais juste', d:'Le dernier à annoncer ne peut pas choisir le nombre qui rendrait le total égal au nombre de cartes. Résultat : <strong>au moins un joueur ratera</strong> forcément !',
    s:function(){ return '<div class="tt-label">3 cartes · les autres ont annoncé 1 + 0 + 1</div>'
      + '<div class="tt-picks">'+['0','1','2','3'].map(function(v,i){ var no = v==='1'; return '<span class="tt-pick tt-a'+(no?' no':'')+'"'+ttD(i*120)+'><span class="tt-dig">'+v+'</span>'+(no?'<span class="tt-x">✕</span>':'')+'</span>'; }).join('')+'</div>'
      + '<div class="tt-label tt-a"'+ttD(700)+'>1 est interdit : 1 + 0 + 1 + <strong>1</strong> = 3</div>'; } },
  { t:'Fournir la couleur', d:'Le premier joueur pose une carte. Les autres <strong>doivent jouer la même couleur</strong> s\'ils en ont.',
    s:function(){ return '<div class="tt-label">Carte demandée</div><div class="tt-row">'+ttCard('R','S','tt-a')+'</div>'
      + '<div class="tt-label">Ta main</div><div class="tt-row tt-hand">'+ttCard('9','D','tt-dim')+ttCard('4','S','tt-glow tt-lift')+ttCard('V','C','tt-dim')+'</div>'
      + '<div class="tt-label tt-a"'+ttD(500)+'>Tu as du pique ? Tu dois jouer ton <strong>4♠︎</strong>.</div>'; } },
  { t:'Pas la couleur ? Coupe !', d:'Si tu n\'as pas la couleur demandée, tu joues <strong>ce que tu veux</strong> : un atout pour couper, ou n\'importe quelle autre carte pour te défausser.',
    s:function(){ return '<div class="tt-label">Carte demandée : pique · atout : cœur</div><div class="tt-row">'+ttCard('R','S')+'</div>'
      + '<div class="tt-row tt-hand">'+'<span class="tt-opt tt-a"'+ttD(200)+'>'+ttCard('3','H','tt-glow')+'<span class="tt-tag">couper</span></span>'
      + '<span class="tt-opt tt-a"'+ttD(450)+'>'+ttCard('9','C')+'<span class="tt-tag muted">se défausser</span></span></div>'; } },
  { t:'Qui gagne le pli ?', d:'Le plus fort atout gagne. S\'il n\'y a pas d\'atout dans le pli, c\'est la plus forte carte de la couleur demandée. <strong>Le gagnant commence le pli suivant.</strong>',
    s:function(){ return '<div class="tt-row tt-trick">'
      + '<span class="tt-a"'+ttD(0)+'>'+ttCard('R','S')+'<span class="tt-who">Léa</span></span>'
      + '<span class="tt-a"'+ttD(300)+'>'+ttCard('A','S')+'<span class="tt-who">Tom</span></span>'
      + '<span class="tt-a tt-winner"'+ttD(600)+'>'+ttCard('3','H','tt-glow')+'<span class="tt-who">Toi</span></span>'
      + '<span class="tt-a"'+ttD(900)+'>'+ttCard('8','S')+'<span class="tt-who">Max</span></span></div>'
      + '<div class="tt-label tt-a"'+ttD(1200)+'>Ton petit <strong>3♥︎</strong> bat l\'As : c\'est un atout !</div>'
      + '<div class="tt-order">2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · V · D · R · <strong>A</strong></div>'; } },
  { t:'Fin de la manche', d:'Tu as fait <strong>exactement</strong> ton annonce ? Contrat réussi ! Sinon, c\'est raté. Puis on passe à la manche suivante.',
    s:function(){ return '<div class="tt-results">'
      + '<div class="tt-res tt-a"'+ttD(0)+'><span>Léa</span><span class="muted">annonce 1 · fait 1</span><span class="tt-ok">réussi</span></div>'
      + '<div class="tt-res tt-a"'+ttD(300)+'><span>Tom</span><span class="muted">annonce 0 · fait 1</span><span class="tt-ko">raté</span></div>'
      + '<div class="tt-res tt-a"'+ttD(600)+'><span>Toi</span><span class="muted">annonce 1 · fait 1</span><span class="tt-ok">réussi</span></div></div>'; } },
  { t:'Pas plus de 3 zéros d\'affilée', d:'Annoncer 0 est permis… mais <strong>pas plus de 3 manches de suite</strong>. Au 4e zéro, c\'est interdit : il faudra tenter au moins un pli.',
    s:function(){ return '<div class="tt-picks">'+['0','0','0','0'].map(function(v,i){ var no = i===3; return '<span class="tt-pick tt-a'+(no?' no':'')+'"'+ttD(i*350)+'><span class="tt-mt">manche '+(i+1)+'</span><span class="tt-dig">'+v+'</span>'+(no?'<span class="tt-x">✕</span>':'')+'</span>'; }).join('')+'</div>'; } },
  { t:'La manche à l\'aveugle', d:'À 1 carte, tu <strong>ne vois pas ta propre carte</strong>… mais tu vois celles de tous les autres, comme si chacun la tenait sur son front. Annonce en fonction !',
    s:function(){ return '<div class="tt-row tt-trick">'
      + '<span class="tt-a"'+ttD(0)+'>'+ttCard('A','S')+'<span class="tt-who">Léa</span></span>'
      + '<span class="tt-a"'+ttD(200)+'>'+ttCard('4','D')+'<span class="tt-who">Tom</span></span>'
      + '<span class="tt-a"'+ttD(400)+'>'+ttCard('D','H')+'<span class="tt-who">Max</span></span>'
      + '<span class="tt-a"'+ttD(600)+'>'+ttBack('tt-q')+'<span class="tt-who">Toi</span></span></div>'
      + '<div class="tt-label tt-a"'+ttD(900)+'>Léa a l\'As de pique… tu annonces 0 ou 1 ?</div>'; } },
  { t:'À toi de jouer !', d:'Tu connais l\'essentiel. Pour commencer en douceur : une <strong>partie rapide</strong>, 5 manches avec un nombre de cartes au hasard.',
    s:function(){ return '<div class="tt-row">'+['7|C','D|D','A|S','R|H','V|S'].map(function(x,i){ var p=x.split('|'); return '<span class="tt-a tt-fan f'+i+'"'+ttD(i*120)+'>'+ttCard(p[0],p[1])+'</span>'; }).join('')+'</div>'; } }
];
function renderTutorial(){
  var st = TUTO_STEPS[tutoStep], last = tutoStep === TUTO_STEPS.length-1;
  var html = '<div class="tt-backdrop"><div class="tt-box" role="dialog" aria-modal="true" aria-label="Tuto des règles">'
    + '<div class="tt-top"><span class="tt-count">'+(tutoStep+1)+' / '+TUTO_STEPS.length+'</span><button class="btn ghost small" data-action="tuto-close">Passer</button></div>'
    + '<div class="tt-progress"><span style="width:'+Math.round((tutoStep+1)/TUTO_STEPS.length*100)+'%"></span></div>'
    + '<div class="tt-scene">'+st.s()+'</div>'
    + '<h3 class="tt-title">'+st.t+'</h3><p class="tt-text">'+st.d+'</p>'
    + '<div class="tt-nav">'
    + (tutoStep>0 ? '<button class="btn secondary" data-action="tuto-prev">← Précédent</button>' : '<span></span>')
    + (last ? (screen==='entry' ? '<button class="btn" data-action="tuto-quick">⚡ Partie rapide</button>' : '<button class="btn" data-action="tuto-close">C\'est parti !</button>')
            : '<button class="btn" data-action="tuto-next">Suivant →</button>')
    + '</div>'
    + (last ? '<button class="btn ghost small tt-more" data-action="tuto-rules">Voir les règles détaillées</button>' : '')
    + '</div></div>';
  return html;
}
function renderTutoLayer(){
  var root = document.getElementById('tuto-root');
  if(!root){ root = document.createElement('div'); root.id = 'tuto-root'; document.body.appendChild(root); }
  root.innerHTML = tutoStep==null ? '' : renderTutorial();
}
function openTutorial(){ tutoStep = 0; try{ localStorage.setItem('rikiki_tuto_seen', '1'); }catch(e){} showRules = false; render(); renderTutoLayer(); }
function tutoSeen(){ try{ return !!localStorage.getItem('rikiki_tuto_seen'); }catch(e){ return true; } }
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='tuto-open'){ openTutorial(); }
  else if(a==='tuto-next'){ tutoStep = Math.min(TUTO_STEPS.length-1, tutoStep+1); renderTutoLayer(); }
  else if(a==='tuto-prev'){ tutoStep = Math.max(0, tutoStep-1); renderTutoLayer(); }
  else if(a==='tuto-close'){ tutoStep = null; renderTutoLayer(); }
  else if(a==='tuto-rules'){ tutoStep = null; renderTutoLayer(); showRules = true; render(); }
  else if(a==='tuto-dismiss'){ try{ localStorage.setItem('rikiki_tuto_seen', '1'); }catch(err){} render(); }
  else if(a==='tuto-quick'){
    tutoStep = null; renderTutoLayer();
    var q = document.querySelector('[data-action="quick-create"]'); if(q) q.click();
  }
});
document.addEventListener('keydown', function(e){
  if(tutoStep==null) return;
  if(e.key==='ArrowRight' && tutoStep < TUTO_STEPS.length-1){ tutoStep++; renderTutoLayer(); }
  else if(e.key==='ArrowLeft' && tutoStep > 0){ tutoStep--; renderTutoLayer(); }
  else if(e.key==='Escape'){ tutoStep = null; renderTutoLayer(); }
});

var ROUND_BREAK_MS = 15000;
var dealingNext = false;
async function dealNextRoundAs(actorId){
  var g = gameDoc;
  if(!g || g.status!=='round_end' || dealingNext) return;
  dealingNext = true;
  try{ await dealNextRoundInner(g); } finally { dealingNext = false; }
}
async function dealNextRoundInner(g){
  // v45 : UN SEUL appareil distribue. Avant, si deux joueurs cliquaient « Passer » en même temps, deux donnes
  // différentes partaient : la partie en gardait une, certains recevaient les cartes de l'autre → « Plus de cartes. ».
  var gref = claudeDb.doc('games/'+g.code), ck = 'next:'+g.round;
  if(gref.claim){
    var won = await gref.claim(function(cur, tok){
      if(cur.status!=='round_end' || cur.round!==g.round) return null;                 // déjà distribuée
      var c = cur.dealClaim; if(c && c.key===ck && nowMs() - c.at < 20000) return null; // quelqu'un est en train de distribuer
      return { dealClaim:{ key:ck, by:myId, at:nowMs() }, claimTok:tok };
    });
    if(!won) return;
  } else {
    var freshSnap = await gref.get(), fresh = freshSnap.data();
    if(!fresh || fresh.status!=='round_end' || fresh.round!==g.round) return;
  }
  var order = g.playerOrder, n = order.length;
  var prevIdx = order.indexOf(g.dealerId);
  var nextDealerId = order[(prevIdx+1)%n];
  var nextRound = g.round + 1;
  var handSize = g.roundPlan[nextRound];
  var startIdx = (order.indexOf(nextDealerId)+1) % n;
  var bidOrder = order.slice(startIdx).concat(order.slice(0,startIdx));
  var dd = await dealSecretly(g, order, nextRound, handSize, nextDealerId);
  var resetBids={}, resetTricks={}, dealtRound={};
  order.forEach(function(id){
    resetBids[id]=null; resetTricks[id]=0;
    if(g.players[id].isBot){ dealtRound[id]=nextRound; }
  });
  var ref = claudeDb.doc('games/'+g.code);
  await ref.update({
    status:'dealing', round: nextRound, dealerId: nextDealerId, dealSeed: dd.dealSeed, dealHash: dd.dealHash, blindCards: dd.blindCards,
    bidOrder: bidOrder, leadPlayerId: bidOrder[0], turnPlayerId: bidOrder[0],
    bids: resetBids, tricksWon: resetTricks, currentTrick: [], trickNumber:0, lastTrick:null,
    trumpCard: dd.trumpCard, botHands: null, dealtRound: dealtRound, played: []
  });
}
function dealNextRound(){ return dealNextRoundAs(myId); } // bouton « Passer » : n'importe quel joueur

