/* ===================== 1.9.0 : « Mode frauduleux » 😈 =====================
   Réglage du salon (settings.fraud) : la triche est PERMISE. On peut jouer n'importe quelle carte (ne pas fournir la couleur, couper alors qu'on avait
   la couleur…). Rien ne se voit : les autres voient seulement une carte posée. Ils peuvent ACCUSER (bouton « 🕵️ J'accuse ») une carte du pli en
   cours ou du pli qui vient de se terminer.
   Vérification faite par l'appareil de l'organisateur, qui connaît la donne : main du joueur avant sa carte = donne − cartes déjà jouées.
   Carte interdite (couleur demandée possédée mais non fournie) → le tricheur perd FRAUD_PENALTY points. Accusation fausse → l'accusateur les perd.
   Règles du mode : partie hors ligue (jamais comptée, jamais analysée), SANS ROBOT (entre vrais joueurs uniquement), contrôles anti-triche de la ligue coupés pour cette partie. */
var FRAUD_PENALTY = 5;
// réglages d'une partie frauduleuse : rapide (5 manches, 5 cartes au plus), 10 s par tour, hors ligue, SANS robot
var FRAUD_SETTINGS = { fraud:true, league:false, direction:'quick', startSize:5, blindOne:true, turnTimer:10 };
var fraudUi = { open:false, busy:false, seenAt:0 };
function fraudOn(g){ return !!(g && g.settings && g.settings.fraud); }

// qui a joué chaque carte de la manche (même reconstitution que l'historique des robots) : [{ k, playerId, card, led, trick }]
function fraudPlays(g){
  var order = g.playerOrder || [], n = order.length, played = g.played || [], out = [];
  if(!n) return out;
  var trump = g.trumpCard ? g.trumpCard.suit : null, lead = (g.bidOrder && g.bidOrder[0]) || order[0];
  for(var t = 0; t*n < played.length; t++){
    var li = order.indexOf(lead), trick = [];
    for(var q = 0; q < n && t*n+q < played.length; q++){
      var id = order[(li+q) % n], c = played[t*n+q];
      trick.push({ playerId:id, card:c });
      out.push({ k:t*n+q, playerId:id, card:c, led: trick[0].card.suit, trick:t, first: q===0 });
    }
    if(trick.length < n) break;
    lead = trickWinner(trick, trick[0].card.suit, trump);
  }
  return out;
}
// vrai si la carte numéro k de la manche était interdite (appareil de l'organisateur) ; null si on ne peut pas savoir
function fraudVerdict(g, k){
  var plays = fraudPlays(g), p = plays[k]; if(!p) return null;
  if(p.first) return { cheat:false, playerId:p.playerId };
  var dealt = dealtFor(g, p.playerId); if(!dealt) return null;
  var gone = {}; (g.played || []).slice(0, k).forEach(function(c){ gone[cardKey(c)] = 1; });
  var before = dealt.filter(function(c){ return !gone[cardKey(c)]; });
  var cheat = p.card.suit !== p.led && before.some(function(c){ return c.suit === p.led; });
  return { cheat:cheat, playerId:p.playerId };
}
// cartes qu'on peut encore accuser : celles du pli en cours et du pli précédent, jamais les siennes, jamais deux fois
function fraudAccusable(g){
  var done = {}; (g.fraudLog || []).forEach(function(e){ if(e.round === g.round) done[e.k] = 1; });
  var plays = fraudPlays(g), n = (g.playerOrder || []).length, last = plays.length - 1;
  return plays.filter(function(p){ return !p.first && p.playerId !== myId && !done[p.k] && p.k > last - 2*n; });
}

// --- côté organisateur : trancher une accusation ---
async function fraudHostTick(g){
  if(!fraudOn(g) || g.hostId !== myId || !g.fraudAccuse || fraudUi.busy) return;
  var acc = g.fraudAccuse; fraudUi.busy = true;
  try{
    var ref = claudeDb.doc('games/' + g.code), v = fraudVerdict(g, acc.k);
    if(!v){ await ref.update({ fraudAccuse: null }); return; }
    var loser = v.cheat ? v.playerId : acc.by, scores = Object.assign({}, g.scores);
    scores[loser] = (scores[loser] || 0) - FRAUD_PENALTY;
    var entry = { round:g.round, k:acc.k, by:acc.by, target:v.playerId, cheat:v.cheat, at:nowMs() };
    await ref.update({ scores:scores, fraudAccuse:null, fraudLast:entry, fraudLog:(g.fraudLog || []).concat([entry]) });
  }catch(e){ console.error(e); }
  fraudUi.busy = false;
}
// --- chez tout le monde : annoncer le résultat une seule fois ---
function fraudAnnounce(g){
  var r = g && g.fraudLast; if(!r || !r.at || r.at <= fraudUi.seenAt) return;
  fraudUi.seenAt = r.at;
  if(nowMs() - r.at > 15000) return; // on ne rejoue pas une vieille annonce au rechargement
  var nm = function(id){ return (g.players[id] && g.players[id].name) || '?'; };
  showToast(r.cheat ? ('🕵️ ' + nm(r.by) + ' a démasqué ' + nm(r.target) + ' : triche confirmée ! ' + nm(r.target) + ' perd ' + FRAUD_PENALTY + ' points.')
                    : ('🕵️ Fausse alerte : ' + nm(r.by) + ' accuse ' + nm(r.target) + ' à tort et perd ' + FRAUD_PENALTY + ' points.'));
}
function fraudOnUpdate(g){ try{ fraudAnnounce(g); }catch(e){} try{ fraudHostTick(g); }catch(e){} }

// --- nouveauté sur l'accueil : essayer le mode en un clic (fermable, une seule fois par appareil) ---
function fraudPromoHtml(){
  try{ if(localStorage.getItem('rikiki_fraud_promo') === '1') return ''; }catch(e){}
  if(typeof visiteState !== 'undefined' && visiteState === 'pending') return ''; // un nouveau joueur a d'abord la visite de l'appli
  if(!(usingFirebase || usingMock)) return '';
  return '<div class="fraud-promo" role="region" aria-label="Nouveauté"><span class="fraud-promo-ico" aria-hidden="true">😈</span>'
    + '<span class="fraud-promo-txt"><strong>Nouveau : le mode frauduleux</strong><small>Triche permise, accuse tes amis. 5 manches, 10 s par tour, entre vrais joueurs.</small></span>'
    + '<button class="btn small" data-action="fraud-create">Essayer</button>'
    + '<button class="btn ghost small" data-action="fraud-promo-close" aria-label="Masquer">✕</button></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="fraud-promo-close"]') : null; if(!el) return;
  try{ localStorage.setItem('rikiki_fraud_promo', '1'); }catch(err){} render();
});

// --- affichage : bouton « J'accuse » et choix de la carte ---
function fraudBarHtml(g){
  if(!fraudOn(g) || g.status !== 'playing') return '';
  return '<div class="fraud-bar"><span>😈 Mode frauduleux : tout est permis… si personne ne te voit.</span>'
    + '<button class="btn small" data-action="fraud-open">🕵️ J\'accuse</button></div>';
}
function fraudRoot(){ var r = document.getElementById('fraud-root'); if(!r){ r = document.createElement('div'); r.id = 'fraud-root'; document.body.appendChild(r); } return r; }
function fraudRender(){
  var r = fraudRoot(), g = (typeof gameDoc !== 'undefined') ? gameDoc : null;
  if(!fraudUi.open || !g){ r.innerHTML = ''; return; }
  var list = fraudAccusable(g), nm = function(id){ return (g.players[id] && g.players[id].name) || '?'; };
  r.innerHTML = '<div class="modal-backdrop fraud-back" data-action="fraud-close"><div class="card-panel modal fraud-modal" role="dialog" aria-modal="true" aria-labelledby="fraud-title">'
    + '<h3 id="fraud-title">🕵️ Qui accuses-tu ?</h3>'
    + '<p class="muted" style="font-size:13.5px; margin:0 0 8px;">Choisis la carte que tu trouves louche (pli en cours ou pli précédent). Si tu as raison, il perd '+FRAUD_PENALTY+' points. Si tu te trompes, c\'est toi qui les perds.</p>'
    + (list.length ? list.map(function(p){ return '<button class="btn secondary fraud-row" data-action="fraud-pick" data-k="'+p.k+'"><span>'+esc(nm(p.playerId))+'</span> '+cardHtml(p.card, { mini:true })+'</button>'; }).join('')
                   : '<p style="margin:10px 0;">Aucune carte à accuser pour l\'instant.</p>')
    + '<div class="row" style="margin-top:10px;"><button class="btn ghost" data-action="fraud-close">Annuler</button></div></div></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action^="fraud-"]') : null; if(!el) return;
  var a = el.getAttribute('data-action'), g = gameDoc;
  if(a === 'fraud-open'){ fraudUi.open = true; fraudRender(); return; }
  if(a === 'fraud-close'){ if(e.target !== el && el.classList.contains('fraud-back')) return; fraudUi.open = false; fraudRender(); return; }
  if(a === 'fraud-pick' && g && fraudOn(g)){
    if(g.fraudAccuse){ showToast('Une accusation est déjà en cours.'); return; }
    var k = parseInt(el.getAttribute('data-k'), 10); fraudUi.open = false; fraudRender();
    claudeDb.doc('games/' + g.code).update({ fraudAccuse:{ by:myId, k:k, round:g.round, at:nowMs() } }).catch(function(err){ console.error(err); showToast(dbErrorText(err)); });
  }
});
// réglage du salon
document.addEventListener('change', function(e){
  var el = e.target; if(!el || el.getAttribute('data-action-change') !== 'set-fraud') return;
  var g = gameDoc; if(!g || g.hostId !== myId) return;
  var hasBots = Object.keys(g.players || {}).some(function(id){ return g.players[id].isBot; });
  if(el.checked && hasBots){ el.checked = false; showToast('Retire d\'abord les robots : le mode frauduleux se joue entre vrais joueurs.'); return; }
  // le mode doit aller VITE (10 à 15 minutes au plus) : format rapide (5 manches), 5 cartes au plus, 10 secondes par tour
  var patch = el.checked ? FRAUD_SETTINGS : { fraud:false };
  updateSettings(patch).catch(function(err){ console.error(err); });
  if(el.checked) showToast('😈 Mode frauduleux : partie rapide de 5 manches, 10 s par tour.');
});
