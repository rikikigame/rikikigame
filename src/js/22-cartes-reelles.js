/* ===================== mode "cartes réelles" : feuille de score ===================== */
// Une seule personne tient la feuille pour toute la table. Pas de comptes : on tape les prénoms.
// La feuille est enregistrée dans le stockage privé du joueur (data/users/{id}/sheet) pour survivre à un rechargement.
var sheet = null;          // feuille en cours
var sheetDraft = null;     // brouillon de l'écran de configuration
var sheetSaving = false, sheetSavePending = false;
var sheetConfirmNew = false;

function sheetRef(){ return claudeDb.doc('data/users/'+myId+'/sheet'); }
function saveSheet(){
  if(!sheet) return;
  if(sheetSaving){ sheetSavePending = true; return; }
  sheetSaving = true;
  var snapshot = JSON.parse(JSON.stringify(sheet));
  sheetRef().set(snapshot).catch(function(e){ console.error(e); showSheetToast(dbErrorText(e)); })
    .then(function(){ sheetSaving=false; if(sheetSavePending){ sheetSavePending=false; saveSheet(); } });
}
function showSheetToast(msg){ toastMsg = msg; render(); clearTimeout(toastTimer); toastTimer = setTimeout(function(){ toastMsg=''; render(); }, 5000); }

async function openSheet(){
  errorMsg='';
  try{
    var snap = await sheetRef().get();
    var d = snap.exists ? snap.data() : null;
    if(d && d.phase && d.phase !== 'over'){ sheet = JSON.parse(JSON.stringify(d)); screen='sheet'; render(); return; }
    if(d && d.phase==='over' && d.league && !d.leagueRecorded){ sheet = JSON.parse(JSON.stringify(d)); screen='sheet'; render(); maybeRecordSheet(); return; }
  }catch(e){ console.error(e); }
  newSheetDraft();
}
function newSheetDraft(){
  var prevNames = (sheet && sheet.players) ? sheet.players.map(function(p){ return p.name; }) : [];
  sheetDraft = {
    names: prevNames.length ? prevNames : [myProfile.name || '', '', ''],
    direction: (sheet && sheet.settings && sheet.settings.direction) || 'up',
    startSize: (sheet && sheet.settings && sheet.settings.startSize) || null,
    scoring: Object.assign({}, DEFAULT_SCORING, (sheet && sheet.settings && sheet.settings.scoring) || {}),
    league: !!(sheet && sheet.league),
    maxZeros: (sheet && sheet.settings && sheet.settings.maxZeros!=null) ? sheet.settings.maxZeros : 3
  };
  loadLeague();
  sheet = null; sheetConfirmNew = false;
  screen='sheet-setup'; render();
}
function readDraftFromDom(){
  if(!sheetDraft) return;
  var inputs = document.querySelectorAll('[data-sheet-name]');
  if(inputs.length){ sheetDraft.names = Array.prototype.map.call(inputs, function(el){ return el.value; }); }
  var ss = document.getElementById('sheetStartSize'); if(ss){ var v=parseInt(ss.value,10); sheetDraft.startSize = isFinite(v)? v : null; }
  var dir = document.getElementById('sheetDirection'); if(dir) sheetDraft.direction = dir.value;
  var lg = document.getElementById('sheetLeague'); if(lg) sheetDraft.league = lg.checked;
  var mz = document.getElementById('sheetMaxZeros'); if(mz) sheetDraft.maxZeros = mz.checked ? 3 : 0;
  var dl = document.getElementById('sheetDealer'); if(dl){ var dv = parseInt(dl.value,10); sheetDraft.dealerStart = isFinite(dv) ? dv : 0; }
  SCORING_FIELDS.forEach(function(f){
    var el = document.querySelector('[data-sheet-scoring="'+f.key+'"]');
    if(el){ var n=parseInt(el.value,10); sheetDraft.scoring[f.key] = isFinite(n) ? Math.max(f.min, Math.min(f.max, n)) : DEFAULT_SCORING[f.key]; }
  });
}
function draftMaxStart(n){ return Math.max(1, Math.floor(52/Math.max(n,2))); }
var sheetStarting = false;
async function startSheet(){
  readDraftFromDom();
  if(sheetStarting) return;
  var names = sheetDraft.names.map(function(s){ return (s||'').trim().slice(0,24); }).filter(function(s){ return s; });
  if(names.length < MIN_PLAYERS){ errorMsg = 'Il faut au moins 2 joueurs.'; render(); return; }
  if(names.length > MAX_PLAYERS){ errorMsg = 'Maximum '+MAX_PLAYERS+' joueurs.'; render(); return; }
  var seen = {}, dup = names.filter(function(n){ var k=normName(n); if(seen[k]) return true; seen[k]=1; return false; });
  if(dup.length){ errorMsg = 'Deux joueurs ont le même prénom : '+dup[0]+'.'; render(); return; }
  if(sheetDraft.league && names.length < LEAGUE_MIN_HUMANS){ errorMsg = 'Une partie de ligue demande au moins '+LEAGUE_MIN_HUMANS+' joueurs.'; render(); return; }
  var maxStart = draftMaxStart(names.length);
  var startSize = Math.max(1, Math.min(sheetDraft.startSize || maxStart, maxStart));
  var players = names.map(function(n,i){ return { id:'p'+i, name:n }; });
  var dealerName = ((sheetDraft.names[sheetDraft.dealerStart||0])||'').trim();
  var dealerStart = Math.max(0, names.indexOf(dealerName));
  if(sheetDraft.league){
    sheetStarting = true; errorMsg=''; render();
    try{
      for(var k=0;k<players.length;k++){ players[k].memberId = await ensureMember({ name: players[k].name, byName: true }); }
    }catch(e){ console.error(e); sheetStarting=false; errorMsg = 'Ligue : '+dbErrorText(e); render(); return; }
    sheetStarting = false;
  }
  var scores = {}; players.forEach(function(p){ scores[p.id]=0; });
  sheet = {
    createdAt: nowMs(),
    players: players,
    settings: { direction: sheetDraft.direction, startSize: startSize, scoring: sheetDraft.scoring, maxZeros: sheetDraft.maxZeros==null ? 3 : sheetDraft.maxZeros },
    roundPlan: computeRoundPlan(players.length, startSize, sheetDraft.direction),
    round: 0, phase: 'bid', bids: {}, tricks: {}, roundLog: [], scores: scores, dealerStart: dealerStart,
    league: !!sheetDraft.league
  };
  errorMsg=''; screen='sheet';
  maybeStartIntro('s|'+sheet.createdAt, { rounds:sheet.roundPlan.length, plan:planText(sheet.roundPlan), names:sheet.players.map(function(p){ return p.name; }) });
  saveSheet(); render();
}
function sheetHandSize(){ return sheet.roundPlan[sheet.round]; }
// donneur de la manche en cours : tourne d'un cran à chaque manche (y compris les tours rejoués)
function sheetDealerIdx(){ var n = sheet.players.length; return (((sheet.dealerStart||0) + sheet.round) % n + n) % n; }
function sheetBidOrder(){ var n = sheet.players.length, d = sheetDealerIdx(), o = []; for(var k=1; k<=n; k++) o.push(sheet.players[(d+k)%n]); return o; }
function sheetSum(obj){ return sheet.players.reduce(function(a,p){ return a + (obj[p.id]||0); }, 0); }
function sheetAllSet(obj){ return sheet.players.every(function(p){ return typeof obj[p.id]==='number'; }); }
function sheetSetValue(pid, v){
  var hs = sheetHandSize();
  v = Math.max(0, Math.min(hs, v));
  if(sheet.phase==='bid' && v===0 && sheetZeroBanned(pid)) return;
  if(sheet.phase==='bid') sheet.bids[pid]=v; else if(sheet.phase==='tricks') sheet.tricks[pid]=v;
  saveSheet(); render();
}
function sheetMaxZeros(){ return (sheet && sheet.settings && sheet.settings.direction==='quick') ? 0 : 3; } // règle officielle, aussi en vraies cartes (sauf partie rapide)
function sheetZeroBanned(pid){
  var mz = sheetMaxZeros(); if(!mz || zeroStreakIn(sheet.roundLog, pid) < mz) return false;
  // exception : manche à 1 carte où le donneur ne peut pas annoncer 1 → le zéro reste permis
  var hs = sheetHandSize(), bo = sheetBidOrder(), dealer = bo[bo.length-1];
  if(hs===1 && dealer && dealer.id===pid){ var so = bo.slice(0,-1).reduce(function(a,q){ return a + (sheet.bids[q.id]||0); }, 0); if(so===0) return false; }
  return true;
}
function sheetAllowedNoZero(hs){ var a=[]; for(var v=1; v<=hs; v++) a.push(v); return a; }
function sheetValidateBids(){
  var hs = sheetHandSize();
  if(!sheetAllSet(sheet.bids)) return;
  if(sheet.players.some(function(p){ return sheet.bids[p.id]===0 && sheetZeroBanned(p.id); })) return;
  if(sheetSum(sheet.bids) === hs) return;
  sheet.phase='tricks'; sheet.tricks={}; saveSheet(); render();
}
function sheetValidateTricks(){
  var hs = sheetHandSize();
  if(!sheetAllSet(sheet.tricks) || sheetSum(sheet.tricks)!==hs) return;
  var sc = sheet.settings.scoring, points={};
  sheet.players.forEach(function(p){
    var pts = scoreRound(sc, sheet.bids[p.id], sheet.tricks[p.id]);
    points[p.id]=pts; sheet.scores[p.id]=(sheet.scores[p.id]||0)+pts;
  });
  sheet.roundLog.push({ round: sheet.round, handSize: hs, bids: Object.assign({}, sheet.bids), tricksWon: Object.assign({}, sheet.tricks), points: points });
  sheet.phase = 'done'; saveSheet(); render();
}
function sheetNextRound(){
  if(sheet.round >= sheet.roundPlan.length-1){ sheet.phase='over'; setTimeout(maybeRecordSheet, 0); }
  else { sheet.round++; sheet.phase='bid'; sheet.bids={}; sheet.tricks={}; }
  saveSheet(); render(); window.scrollTo(0,0);
}
// Adaptateur : réutilise le récap de fin de partie du jeu en ligne.
function sheetAsGame(){
  var players={}, order=sheet.players.map(function(p){ players[p.id]={ name:p.name, color:'#C9A24B' }; return p.id; });
  return { playerOrder: order, players: players, scores: sheet.scores, roundLog: sheet.roundLog, roundPlan: sheet.roundPlan };
}

function renderSheetTopbar(){
  return '<div class="topbar"><div class="brand"><span class="display">Rikiki</span>'
    + '<span class="badge">Vraies cartes</span></div>'
    + '<div class="actions"><button class="btn ghost" data-action="sheet-home">Accueil</button></div></div>';
}
function renderSheetSetup(){
  var d = sheetDraft;
  var n = d.names.filter(function(s){ return (s||'').trim(); }).length || d.names.length;
  var maxStart = draftMaxStart(n);
  var startSize = Math.min(d.startSize || maxStart, maxStart);
  var html = renderSheetTopbar();
  html += '<div class="card-panel" style="max-width:560px; margin:0 auto;">';
  html += '<h2 style="font-size:24px; margin-bottom:4px;">Feuille de score</h2>';
  html += '<p class="muted" style="font-size:13.5px; margin:0 0 16px;">Vous jouez avec un vrai paquet. À chaque manche, tape les annonces puis les plis : les points sont calculés.</p>';
  html += '<label>Joueurs (dans l\'ordre autour de la table)</label>';
  html += '<div style="display:flex; flex-direction:column; gap:8px; margin-bottom:10px;">';
  d.names.forEach(function(name, i){
    var hint = '<span id="sheetHint'+i+'">'+memberHint(name, d.league)+'</span>';
    html += '<div class="row"><input type="text" maxlength="24" placeholder="Joueur '+(i+1)+'" value="'+esc(name)+'" data-sheet-name="'+i+'" id="sheetName'+i+'"'+(d.league?' list="leagueMemberList"':'')+'>'+hint
      + (d.names.length>2 ? '<button class="btn secondary small" data-action="sheet-remove-player" data-index="'+i+'" aria-label="Retirer">✕</button>' : '') + '</div>';
  });
  html += '</div>';
  if(d.names.length < MAX_PLAYERS) html += '<button class="btn secondary small" data-action="sheet-add-player" style="margin-bottom:6px;">+ Ajouter un joueur</button>';
  html += '<div id="sheetDealerWrap">'+dealerSelectHtml(d)+'</div>';
  if(d.league) html += '<datalist id="leagueMemberList">'+league.members.map(function(m){ return '<option value="'+esc(m.name)+'"></option>'; }).join('')+'</datalist>';
  html += '<label style="display:flex; align-items:center; gap:10px; font-size:14px; color:var(--navy); font-weight:700; margin:12px 0 0;"><input type="checkbox" id="sheetLeague" '+(d.league?'checked':'')+'> Partie de ligue (compte pour le classement)</label>';
  html += '<p class="muted" style="font-size:12.5px; margin:8px 0 0;">'+(d.direction==='quick' ? 'Partie rapide : pas de limite de zéros.' : 'Règle : pas plus de 3 zéros d\'affilée.')+'</p>';
  if(d.league) html += '<p class="muted" style="font-size:12.5px; margin:4px 0 0;">Tape le prénom d\'un membre (proposé automatiquement) ; un prénom inconnu crée un nouveau membre. Minimum '+LEAGUE_MIN_HUMANS+' joueurs.</p>';
  html += '<div class="divider"></div>';
  html += '<div class="settings-grid">';
  html += '<div><label>Cartes max (jusqu\'à '+maxStart+')</label><input type="number" id="sheetStartSize" min="1" max="'+maxStart+'" value="'+startSize+'"></div>';
  html += '<div><label>Format des manches</label><select id="sheetDirection">'
    + '<option value="up"'+(d.direction==='up'?' selected':'')+'>Montant (1 → max)</option>'
    + '<option value="updown"'+(d.direction==='updown'?' selected':'')+'>Montant puis descendant</option>'
    + '<option value="down"'+(d.direction==='down'?' selected':'')+'>Descendant (max → 1)</option>'
    + '<option value="pyramid"'+(d.direction==='pyramid'?' selected':'')+'>Pyramide (max → 1 → max)</option>'
    + '<option value="quick"'+(d.direction==='quick'?' selected':'')+'>⚡ Partie rapide (5 manches, cartes au hasard)</option>'
    + '</select></div></div>';
  html += '<div class="divider"></div><div class="row between"><div><div class="eyebrow">Points</div><div class="muted" style="font-size:13px; margin-top:2px;">'+esc(scoringSummary(d.scoring))+'</div></div><button class="btn ghost" data-action="sheet-toggle-scoring">'+(sheetShowScoring?'Fermer':'Modifier')+'</button></div>';
  if(sheetShowScoring){
    html += '<div class="settings-grid" style="margin:10px 0 6px;">';
    SCORING_FIELDS.forEach(function(f){
      html += '<div><label for="ssc-'+f.key+'">'+esc(f.label)+'</label><input type="number" id="ssc-'+f.key+'" min="'+f.min+'" max="'+f.max+'" value="'+d.scoring[f.key]+'" data-sheet-scoring="'+f.key+'"></div>';
    });
    html += '</div>';
    html += '<div class="row between"><p class="muted" style="font-size:12.5px; margin:0;">'+esc(scoringExample(d.scoring))+'</p><button class="btn ghost" data-action="sheet-reset-scoring">Par défaut</button></div>';
  }
  html += '<div style="height:14px;"></div>';
  html += '<button class="btn" style="width:100%;" data-action="sheet-start" '+(sheetStarting?'disabled':'')+'>'+(sheetStarting?'Préparation…':'Commencer la partie')+'</button>';
  if(errorMsg) html += '<div class="error-text">'+esc(errorMsg)+'</div>';
  html += '</div>';
  return html;
}
function dealerSelectHtml(d){
  var named = d.names.map(function(nm, i){ return { i:i, nm:(nm||'').trim() }; }).filter(function(x){ return x.nm; });
  if(named.length < 2) return '';
  if(!named.some(function(x){ return x.i===(d.dealerStart||0); })) d.dealerStart = named[0].i;
  return '<div style="margin:10px 0 2px;"><label for="sheetDealer">Qui distribue la première manche ?</label><select id="sheetDealer">'
    + named.map(function(x){ return '<option value="'+x.i+'"'+((d.dealerStart||0)===x.i?' selected':'')+'>'+esc(x.nm)+'</option>'; }).join('')
    + '</select><p class="muted" style="font-size:12px; margin:4px 0 0;">Ensuite ça tourne tout seul, dans l\'ordre de la liste (sens des aiguilles d\'une montre).</p></div>';
}
function memberHint(name, on){
  if(!on || !(name||'').trim() || !league.loaded) return '';
  var mm = league.members.filter(function(m){ return normName(m.name)===normName(name); })[0];
  return mm ? (mm.userId ? '<span class="badge good">profil ✓</span>' : '<span class="badge good">membre</span>') : '<span class="badge">nouveau</span>';
}
function renderStepperRow(p, value, hs, note, allowed){
  var set = typeof value==='number';
  var html = '<div class="sheet-row"><div class="sheet-name">'+esc(p.name)+(note?' <span class="muted" style="font-weight:400; font-size:12.5px;">· '+esc(note)+'</span>':'')+'</div><div class="sheet-picks">';
  for(var v=0; v<=hs; v++){
    var dis = allowed && allowed.indexOf(v) < 0;
    html += '<button class="bid-btn'+(set && value===v ? ' picked' : '')+'" data-action="sheet-set" data-pid="'+esc(p.id)+'" data-value="'+v+'" '+(dis?'disabled title="Interdit : déjà 3 zéros d\'affilée"':'')+'>'+v+'</button>';
  }
  html += '</div></div>';
  return html;
}
function renderSheet(){
  var s = sheet, hs = sheetHandSize();
  var html = renderSheetTopbar();
  if(s.phase==='over'){
    var g = sheetAsGame();
    var order = g.playerOrder.slice().sort(function(a,b){ return (g.scores[b]||0)-(g.scores[a]||0); });
    html += '<div class="card-panel" style="text-align:center; margin-bottom:18px;"><div class="display" style="font-size:26px;">Partie terminée</div><p class="muted" style="margin-top:6px;">'+s.roundPlan.length+' manches jouées</p></div>';
    order.forEach(function(id,i){
      html += '<div class="ranking-row'+(i===0?' first':'')+'"><div class="rank-num">'+(i+1)+'</div><div style="flex:1; font-weight:600;">'+esc(g.players[id].name)+'</div><div class="display num" style="font-size:20px;">'+(g.scores[id]||0)+'</div></div>';
    });
    if(s.league) html += '<p class="muted" style="text-align:center; font-size:13.5px; margin:10px 0 0;">'+(s.leagueRecorded ? 'Partie de ligue enregistrée ✓ <button class="link-btn" data-action="league-openscreen" data-mode="cards">Voir le classement IRL</button>' : 'Enregistrement dans la ligue…')+'</p>';
    html += renderGameRecap(g);
    html += '<div style="text-align:center; margin-top:18px;"><button class="btn" data-action="sheet-new">Nouvelle partie</button></div>';
    return html;
  }
  var isReplay = s.round>0 && s.roundPlan[s.round]===s.roundPlan[s.round-1] && s.replays;
  html += '<div class="card-panel sheet-banner"><div class="muted" style="font-size:12px; text-transform:uppercase; letter-spacing:0.08em;">Manche '+(s.round+1)+' / '+s.roundPlan.length+(isReplay?' · tour rejoué':'')+'</div>'
    + '<div class="display" style="font-size:24px; margin-top:2px;">Donne '+hs+' carte'+(hs>1?'s':'')+' à chacun</div>'
    + (s.phase!=='over' ? (function(){ var bo = sheetBidOrder(), dealer = bo[bo.length-1], first = bo[0];
        return '<div style="margin-top:8px; font-size:14.5px; line-height:1.5;">🃏 <strong>'+esc(dealer.name)+'</strong> distribue · 📦 il reste <strong>'+deckLeft(s.players.length, hs)+'</strong> cartes dans le paquet<br>🗣 <strong>'+esc(first.name)+'</strong> annonce en premier et ouvre le 1<sup>er</sup> pli</div>'; })() : '')
    + '</div>';
  if(s.phase==='bid' || s.phase==='tricks'){
    var isBid = s.phase==='bid';
    var obj = isBid ? s.bids : s.tricks;
    var sum = sheetSum(obj), all = sheetAllSet(obj);
    html += '<div class="card-panel" style="margin-top:14px;">';
    html += '<h3 style="font-size:16px; margin-bottom:2px;">'+(isBid ? '1. Annonces' : '2. Plis remportés')+'</h3>';
    html += '<p class="muted" style="font-size:12.5px; margin:0 0 12px;">'+(isBid ? 'Combien de plis chacun pense remporter.' : 'Combien de plis chacun a vraiment faits.')+'</p>';
    var bo = sheetBidOrder();
    bo.forEach(function(p, i){
      var role = i===0 ? 'annonce en 1er' : (i===bo.length-1 ? 'donneur' : '');
      var note;
      if(isBid){
        note = role;
        if(i===bo.length-1){
          var others = bo.slice(0,-1), ready = others.every(function(q){ return typeof s.bids[q.id]==='number'; });
          if(ready){ var forb = hs - others.reduce(function(a,q){ return a + s.bids[q.id]; }, 0); if(forb>=0 && forb<=hs) note = 'donneur · ne peut pas dire '+forb; }
        }
      } else note = (role ? role+' · ' : '') + 'a annoncé '+s.bids[p.id];
      var zb = isBid && sheetZeroBanned(p.id);
      if(zb) note = (note ? note+' · ' : '') + '0 interdit (3 zéros d\'affilée)';
      html += renderStepperRow(p, obj[p.id], hs, note, zb ? sheetAllowedNoZero(hs) : null);
    });
    var msg='', ok=false;
    if(isBid){
      if(!all) msg = 'Total annoncé : '+sum+' (il manque des annonces)';
      else if(sum===hs) msg = 'Total annoncé = '+hs+' : interdit ! Le dernier à annoncer doit changer son annonce.';
      else { msg = 'Total annoncé : '+sum+' pour '+hs+' pli'+(hs>1?'s':'')+' ('+(sum>hs?'ça va se battre':'il y aura des plis en trop')+')'; ok=true; }
    } else {
      if(!all) msg = 'Total : '+sum+' / '+hs+' (il manque des joueurs)';
      else if(sum!==hs) msg = 'Total : '+sum+' / '+hs+' — le total des plis doit faire '+hs+'.';
      else { msg = 'Total : '+sum+' / '+hs+' ✓'; ok=true; }
    }
    html += '<div class="sheet-total'+(ok?' ok':(all?' bad':''))+'">'+esc(msg)+'</div>';
    html += '<div class="row" style="margin-top:12px;">';
    if(!isBid) html += '<button class="btn secondary" data-action="sheet-back">← Annonces</button>';
    html += '<button class="btn" style="flex:1;" data-action="'+(isBid?'sheet-validate-bids':'sheet-validate-tricks')+'" '+(ok?'':'disabled')+'>'+(isBid?'Valider les annonces — on joue !':'Valider les plis')+'</button>';
    html += '</div></div>';
  } else if(s.phase==='done'){
    var last = s.roundLog[s.roundLog.length-1];
    html += '<div class="card-panel" style="margin-top:14px;"><h3 style="margin-bottom:10px;">Résultat de la manche '+(last.round+1)+'</h3>';
    html += '<table class="score-table"><thead><tr><th>Joueur</th><th>Annoncé</th><th>Réalisé</th><th>Points</th></tr></thead><tbody>';
    s.players.forEach(function(p){
      var pv = last.points[p.id];
      html += '<tr><td>'+esc(p.name)+'</td><td>'+last.bids[p.id]+'</td><td>'+last.tricksWon[p.id]+'</td><td class="display" style="color:'+(pv>0?'var(--good)':(pv<0?'var(--danger)':'var(--cream-dim)'))+';">'+(pv>0?'+':'')+pv+'</td></tr>';
    });
    html += '</tbody></table>';
    var isLast = s.round >= s.roundPlan.length-1;
    html += '<button class="btn" style="width:100%; margin-top:14px;" data-action="sheet-next">'+(isLast?'Voir le résultat final':'Manche suivante ('+s.roundPlan[s.round+1]+' carte'+(s.roundPlan[s.round+1]>1?'s':'')+')')+'</button>';
    html += '<button class="btn secondary" style="width:100%; margin-top:8px;" data-action="sheet-replay">↻ Refaire un tour à '+hs+' carte'+(hs>1?'s':'')+'</button>';
    html += '<p class="muted" style="font-size:12px; text-align:center; margin:6px 0 0;">Ajoute une manche de plus à '+hs+' carte'+(hs>1?'s':'')+' juste après celle-ci ; la suite ne change pas.</p>';
    html += '</div>';
  }
  // classement en cours
  var ids = s.players.map(function(p){ return p.id; }).sort(function(a,b){ return (s.scores[b]||0)-(s.scores[a]||0); });
  html += '<div class="card-panel" style="margin-top:16px;"><h3 style="font-size:15px; margin-bottom:10px;">Scores</h3><table class="score-table"><tbody>';
  ids.forEach(function(id){ var p = s.players.filter(function(x){ return x.id===id; })[0]; html += '<tr><td>'+esc(p.name)+'</td><td class="display num">'+(s.scores[id]||0)+'</td></tr>'; });
  html += '</tbody></table></div>';
  if(s.roundLog.length) html += renderGameRecap(sheetAsGame());
  html += '<div style="text-align:center; margin-top:18px;"><button class="btn secondary small" data-action="sheet-new-confirm">'+(sheetConfirmNew?'Sûr ? La partie en cours sera effacée — confirmer':'Abandonner et recommencer')+'</button></div>';
  return html;
}

document.addEventListener('click', function(e){
  var el = e.target.closest('[data-action]');
  if(!el) return;
  var a = el.getAttribute('data-action');
  if(a.indexOf('sheet-')!==0) return;
  if(a==='sheet-open'){ openSheet(); }
  else if(a==='sheet-home'){ sheetConfirmNew=false; errorMsg=''; screen='entry'; render(); }
  else if(a==='sheet-add-player'){ readDraftFromDom(); sheetDraft.names.push(''); render(); var ins=document.querySelectorAll('[data-sheet-name]'); if(ins.length) ins[ins.length-1].focus(); }
  else if(a==='sheet-remove-player'){ readDraftFromDom(); sheetDraft.names.splice(parseInt(el.getAttribute('data-index'),10),1); render(); }
  else if(a==='sheet-toggle-scoring'){ readDraftFromDom(); sheetShowScoring=!sheetShowScoring; render(); }
  else if(a==='sheet-reset-scoring'){ readDraftFromDom(); sheetDraft.scoring = Object.assign({}, DEFAULT_SCORING); render(); }
  else if(a==='sheet-start'){ startSheet(); }
  else if(a==='sheet-set'){ sheetSetValue(el.getAttribute('data-pid'), parseInt(el.getAttribute('data-value'),10)); }
  else if(a==='sheet-validate-bids'){ sheetValidateBids(); }
  else if(a==='sheet-validate-tricks'){ sheetValidateTricks(); }
  else if(a==='sheet-back'){ sheet.phase='bid'; saveSheet(); render(); }
  else if(a==='sheet-next'){ sheetNextRound(); }
  else if(a==='sheet-replay'){
    // la table relance un tour avec le même nombre de cartes (souvent au sommet, ex. 10 cartes à 5)
    var hsr = sheet.roundPlan[sheet.round];
    sheet.roundPlan.splice(sheet.round+1, 0, hsr);
    sheet.replays = (sheet.replays||0) + 1;
    sheetNextRound();
  }
  else if(a==='sheet-new'){ newSheetDraft(); }
  else if(a==='sheet-new-confirm'){ if(sheetConfirmNew){ newSheetDraft(); } else { sheetConfirmNew=true; render(); } }
});
document.addEventListener('change', function(e){
  if(screen!=='sheet-setup' || !sheetDraft) return;
  if(e.target.hasAttribute('data-sheet-name')){ // pas de re-rendu : on garde le focus sur la saisie
    readDraftFromDom();
    var hs = document.getElementById('sheetHint'+e.target.getAttribute('data-sheet-name'));
    if(hs) hs.innerHTML = memberHint(e.target.value, sheetDraft.league);
    var dw = document.getElementById('sheetDealerWrap'); if(dw) dw.innerHTML = dealerSelectHtml(sheetDraft);
    return;
  }
  if(e.target.id==='sheetDealer' || e.target.id==='sheetDirection' || e.target.id==='sheetStartSize' || e.target.id==='sheetLeague' || e.target.hasAttribute('data-sheet-scoring')){ readDraftFromDom(); render(); }
});

