/* ===================== state ===================== */
var claudeDb=null, claudeUser=null, myId=null, myProfile={name:'',color:'#C9A24B'};
var gameCode=null, gameDoc=null, myHand=null, myHandRaw=null;
var gameUnsub=null, handUnsub=null;
var screen='loading';
var entryMode='create'; // create | join
var errorMsg='';
var processedDealRound=-1;
var showRules=false, showScores=false, showSettings=false, sheetShowScoring=false;
var tickTimer=null;
var loadWatchdog=null;
var fatalError=null;
var usingMock=false;
var usingFirebase=false;
var toastMsg='', toastTimer=null, busy=false;
var botActing=false, lastBotTurnKey=null, lastBotTurnAt=0;

function persistLocal(){ try{ localStorage.setItem('rikiki_last', JSON.stringify({code:gameCode})); }catch(e){} }
function clearLocal(){ try{ localStorage.removeItem('rikiki_last'); }catch(e){} }

/* ===================== init ===================== */
// v55 : clé de site reCAPTCHA v3 pour App Check (elle est publique, ce n'est pas un secret). Vide = App Check pas encore branché.
var APPCHECK_SITE_KEY = '6LcJXt0tAAAAAMSq35fmuxfcHb00iIDo2MCkGX9p';
async function init(){
  migrationImportIfPresent();              // arrivée depuis l'ancienne adresse : on reprend son identité
  if(migrationRedirectIfNeeded()) return;  // ancienne adresse : on part vers la nouvelle
  armWatchdog();
  try{
    if(firebaseConfigured()){
      firebase.initializeApp(window.FIREBASE_CONFIG);
      // v55 : App Check — seul le vrai site (et pas un programme qui imite le jeu) peut parler à la base
      if(APPCHECK_SITE_KEY && firebase.appCheck){ try{ firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(APPCHECK_SITE_KEY), true); }catch(e){ console.warn('App Check', e); } }
      try{ firebase.database().ref('.info/serverTimeOffset').on('value', function(snap){ serverOffset = Number(snap.val()) || 0; }); }catch(e){ console.error(e); }
      claudeDb = firebaseDbFactory();
      claudeUser = firebaseUserFactory();
      usingFirebase = true;
    } else if(window.claude && window.claude.use){
      // en parallèle : chaque use() peut mettre jusqu'à 10 s avant de renvoyer null
      var caps = await Promise.all([window.claude.use('user'), window.claude.use('db')]);
      claudeUser = caps[0]; claudeDb = caps[1];
    }
  }catch(e){ console.error(e); }
  if(!claudeDb || !claudeUser){
    usingMock = true;
    claudeDb = mockDbFactory();
    claudeUser = mockUserFactory();
  }
  if(claudeUser){
    try{
      var me = await claudeUser.me();
      myProfile.name = me.name || '';
      myProfile.color = me.color || '#C9A24B';
      myId = me.id;
    }catch(e){ console.error(e); }
  }
  await initAuth();
  applyProfileIdentity();
  if(authOn() && !adminUid){ try{ await claimAdmin(); }catch(e){ console.error(e); } }
  if(isAdmin()){ loadClaims().then(render); setInterval(function(){ if(screen==='entry') loadClaims().then(render); }, 60000); }
  checkMergedProfile(); // v42 : si mon profil a été regroupé avec un autre, on bascule dessus
  setTimeout(function(){ processAttestTodos().catch(function(e){ console.warn(e); }); }, 3000); // v43 : confirmations en retard
  socialStart();
  if(!claudeDb || !myId){
    clearTimeout(loadWatchdog);
    screen='no-identity';
    render();
    return;
  }
  var saved=null;
  try{ saved = JSON.parse(localStorage.getItem('rikiki_last')||'null'); }catch(e){}
  var qCode=null;
  try{
    var params = new URLSearchParams(window.location.search);
    if(params.get('game')) qCode = params.get('game').toUpperCase();
  }catch(e){}
  if(saved && saved.code){
    gameCode = saved.code;
    subscribeGame(gameCode);
  } else if(qCode){
    clearTimeout(loadWatchdog);
    entryMode='join'; prefillCode = qCode;
    try{ history.replaceState(null, '', location.pathname); }catch(e){}
    screen='entry';
    render();
    if(myProfile.name) joinGame(qCode, myProfile.name); // prénom connu : on rejoint tout de suite
  } else {
    clearTimeout(loadWatchdog);
    screen='entry';
    render();
  }
  if(tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(function(){
    botDriverTick();
    updateCountdown();
    turnTick();
    try{ handWatchTick(); }catch(e){ console.warn(e); } // v45 : mes cartes n'arrivent pas → on va les chercher
  }, 400);
}
function armWatchdog(){
  clearTimeout(loadWatchdog);
  loadWatchdog = setTimeout(function(){
    if(screen==='loading' && !fatalError){
      fatalError = "Le chargement prend plus de temps que prévu. Ta connexion Claude ou le stockage partagé ne répond pas.";
      render();
    }
  }, 15000);
}
function showToast(msg){
  toastMsg = msg; render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function(){ toastMsg=''; render(); }, 5000);
}
function dbErrorText(e){
  var c = e && e.code;
  if(c==='not_granted' || c==='permission_denied' || c==='forbidden') return "Tu n'as pas le droit d'écrire dans cette partie : demande à l'hôte de te donner un accès « Contributeur » à l'artefact.";
  if(c==='resource_exhausted') return "Trop d'écritures d'un coup, réessaie dans un instant.";
  if(c==='unavailable') return "Connexion au stockage partagé perdue, réessaie.";
  return "Une action a échoué (" + (c || (e && e.message) || 'erreur') + ").";
}
function retryInit(){
  fatalError=null; screen='loading';
  if(gameUnsub){ gameUnsub(); gameUnsub=null; }
  if(handUnsub){ handUnsub(); handUnsub=null; }
  render();
  init();
}
window.addEventListener('unhandledrejection', function(e){
  console.error('Unhandled rejection', e.reason);
  if(screen==='game' || screen==='league' || screen==='sheet') showToast(dbErrorText(e.reason));
});
window.addEventListener('error', function(e){
  console.error('Uncaught error', e.error||e.message);
  if(screen==='loading' && !fatalError){
    fatalError = "Une erreur inattendue est survenue pendant le chargement.";
    try{ render(); }catch(e2){}
  }
});

