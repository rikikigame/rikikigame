/* ===================== v73 : consentement (reCAPTCHA et GIF) =====================
   Rikiki ne pose aucun cookie de suivi. Deux services de sociétés extérieures ne se chargent QU'APRÈS un clic de l'utilisateur :
   - Google reCAPTCHA (via Firebase App Check) : il voit l'adresse IP. Refuser ne change rien au jeu (App Check ne fait que surveiller).
   - KLIPY (recherche et affichage des GIF) : il voit l'adresse IP et la recherche.
   Le choix est gardé 12 mois sur l'appareil (preuve du consentement), puis redemandé ; il se change à tout moment dans ⚙️ Paramètres. */
// INTERRUPTEUR : false = la partie « légale / RGPD » est en veille (pas de bannière, pas de liens vers des pages qui n'existent pas encore,
// pas de case « conditions », et reCAPTCHA (Google) n'est JAMAIS chargé : le choix le plus prudent tant qu'on ne peut pas demander l'accord).
// À passer à true quand les pages légales sont prêtes (assets/pages/legal-config.json rempli) — publier.sh le vérifie.
var LEGAL_READY = true;
var CONSENT_KEY = 'rikiki_consent', GIF_CONSENT_KEY = 'rikiki_gif_ok', CONSENT_TTL = 365*86400000;
var LEGAL_LINKS = [['confidentialite.html','Confidentialité'], ['conditions.html','Conditions'], ['cookies.html','Cookies'], ['mentions-legales.html','Mentions légales']];
function legalLinksHtml(){
  if(!LEGAL_READY) return '';
  return LEGAL_LINKS.map(function(l){ return '<a href="'+l[0]+'" target="_blank" rel="noopener">'+l[1]+'</a>'; }).join(' · ');
}
function consentRead(){
  try{ var c = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); if(c && typeof c.at==='number' && Date.now()-c.at < CONSENT_TTL) return c; }catch(e){}
  return null;
}
function securityConsent(){ var c = consentRead(); return c ? !!c.security : null; } // null = pas encore choisi
function securityConsentSet(v){ try{ localStorage.setItem(CONSENT_KEY, JSON.stringify({ v:1, security:!!v, at:Date.now() })); }catch(e){} }
function gifConsent(){
  try{ var c = JSON.parse(localStorage.getItem(GIF_CONSENT_KEY) || 'null'); return !!(c && c.ok && typeof c.at==='number' && Date.now()-c.at < CONSENT_TTL); }catch(e){ return false; }
}
function gifConsentSet(v){ try{ if(v) localStorage.setItem(GIF_CONSENT_KEY, JSON.stringify({ ok:true, at:Date.now() })); else localStorage.removeItem(GIF_CONSENT_KEY); }catch(e){} }

var appCheckStarted = false;
function startAppCheck(){
  if(appCheckStarted || !APPCHECK_SITE_KEY || !(window.firebase && firebase.appCheck)) return;
  try{ firebase.appCheck().activate(new firebase.appCheck.ReCaptchaV3Provider(APPCHECK_SITE_KEY), true); appCheckStarted = true; }
  catch(e){ console.warn('App Check', e); }
}
// au démarrage : on ne charge reCAPTCHA que si l'utilisateur a déjà dit oui
function startAppCheckIfAllowed(){ if(LEGAL_READY && securityConsent()===true) startAppCheck(); }

// bannière : seulement sur l'écran d'accueil (jamais devant les cartes), seulement si le choix n'est pas fait et si reCAPTCHA existe
var consentSig = '';
function renderConsent(){
  var root = document.getElementById('consent-root'); if(!root) return;
  var show = !!(LEGAL_READY && usingFirebase && APPCHECK_SITE_KEY && window.firebase && firebase.appCheck && securityConsent()===null && screen==='entry');
  var sig = show ? 'on' : 'off';
  if(sig === consentSig) return;
  consentSig = sig;
  root.innerHTML = !show ? '' :
    '<div class="consent" role="dialog" aria-labelledby="consent-t" aria-describedby="consent-d">'
    + '<strong id="consent-t">🔒 Ta vie privée</strong>'
    + '<p id="consent-d">Rikiki ne met aucun cookie de pub ni de suivi. Pour vérifier que les connexions viennent bien du vrai jeu, il peut utiliser <b>Google reCAPTCHA</b> : Google reçoit alors ton adresse IP. Si tu refuses, le jeu marche exactement pareil. Tu peux changer d\'avis dans ⚙️ Paramètres. <a href="confidentialite.html" target="_blank" rel="noopener">En savoir plus</a></p>'
    + '<div class="consent-btns"><button class="btn secondary" data-consent="no">Refuser</button><button class="btn secondary" data-consent="yes">Accepter</button></div></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-consent]') : null; if(!el) return;
  var yes = el.getAttribute('data-consent')==='yes';
  securityConsentSet(yes);
  if(yes) startAppCheck();
  consentSig = ''; renderConsent();
  if(typeof render==='function') render();
});
