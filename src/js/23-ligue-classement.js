/* ===================== LIGUE : base de données + classement Elo ===================== */
// Données partagées (tous les joueurs de l'artefact) :
//   leagueMembers/{memberId}  { name, userId|null, createdAt }
//   leagueGames/{gameId}      { at, season, mode:'online'|'cards', rounds, players:[{memberId,name,rank,score,contracts,absDiff}] }
// Le classement n'est jamais stocké : il est recalculé en rejouant toutes les parties dans l'ordre (déterministe).
var LEAGUE_MIN_GAMES = 3, ELO_START = 1000, ELO_K = 32, LEAGUE_MIN_HUMANS = 4; // v59 : 4 joueurs humains minimum (avant : 3)
var league = { loaded:false, loading:false, members:[], games:[], error:'' };
var leagueView = { season:null, open:null, mode:'online' };

function seasonOf(ts){ var d = new Date(ts); return d.getFullYear()+'-T'+(Math.floor(d.getMonth()/3)+1); }
function seasonLabel(key){
  if(key==='all') return 'Général (depuis le début)';
  var parts = key.split('-T'), t = parseInt(parts[1],10);
  var months = ['janv. – mars','avr. – juin','juil. – sept.','oct. – déc.'];
  return 'Saison T'+t+' '+parts[0]+' · '+months[t-1];
}
function memberById(id){ return league.members.filter(function(m){ return m.id===id; })[0] || null; }
// membre principal d'un membre éventuellement fusionné (on suit la chaîne « fusionné dans »)
function canonMember(id){
  var all = league.allMembers || league.members, seen = {};
  for(var i=0; i<10 && id && !seen[id]; i++){
    seen[id] = 1;
    var m = all.filter(function(x){ return x.id===id; })[0];
    if(!m || !m.mergedInto) return id;
    id = m.mergedInto;
  }
  return id;
}
function myMember(){ return myId ? (league.members.filter(function(m){ return m.userId===myId; })[0] || null) : null; }
function normName(s){ return (s||'').trim().toLowerCase(); }

async function loadLeague(force){
  if(league.loading || (league.loaded && !force)) return;
  league.loading = true; league.error = '';
  try{
    var ms = await claudeDb.collection('leagueMembers').get();
    var gs = await claudeDb.collection('leagueGames').orderBy('at').limit(1000).get();
    league.allMembers = ms.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); }).filter(function(m){ return m.name; }); // v58 : entrées vides ignorées
    // v47 : les fiches de la ligue ne sont plus modifiables (sauf par l'organisateur). « C'est moi » est rangé à part,
    // dans leagueLinks/{membre} : écrit une seule fois, par le propriétaire du compte (contrôlé par les règles Firebase).
    try{
      (await claudeDb.collection('leagueLinks').get()).docs.forEach(function(d){
        var l = d.data(), m = league.allMembers.filter(function(x){ return x.id===d.id; })[0];
        if(m && !m.userId && l && l.userId) m.userId = l.userId;
      });
    }catch(e){ console.warn('liens ligue', e); }
    // v42 : fusion de doublons. Les parties enregistrées ne sont jamais réécrites : on redirige en mémoire
    // chaque membre fusionné (mergedInto) vers le membre principal, et on le retire des listes.
    league.members = league.allMembers.filter(function(m){ return !m.mergedInto; });
    // v43 : confirmations des joueurs + validations de l'organisateur
    league.attest = {}; league.valid = {};
    try{ (await claudeDb.collection('leagueAttest').get()).docs.forEach(function(d){ league.attest[d.id] = d.data(); }); }catch(e){ console.warn('confirmations', e); }
    try{ (await claudeDb.collection('leagueValid').get()).docs.forEach(function(d){ league.valid[d.id] = d.data(); }); }catch(e){ console.warn('validations', e); }
    var all = gs.docs.map(function(d){
      var g = Object.assign({ id:d.id }, d.data());
      g.players = (g.players||[]).map(function(p){ return Object.assign({}, p, { memberId: canonMember(p.memberId) }); });
      g.attest = attestStatus(g);
      return g;
    }).filter(function(g){ return g.players.length; }); // v58 : entrées vides ignorées
    league.games = all.filter(function(g){ return g.attest.counts; });     // seules les parties confirmées comptent
    league.pending = all.filter(function(g){ return !g.attest.counts; });
    league.loaded = true;
  }catch(e){ console.error(e); league.error = dbErrorText(e); }
  league.loading = false;
  render();
}

// Trouve ou crée le membre d'un joueur en ligne (par son compte) ou d'un joueur en vraies cartes (par son prénom).
async function ensureMember(opts){
  await loadLeague();
  var m = null;
  if(opts.userId){ // y compris un membre fusionné : on renvoie alors le membre principal
    var any = (league.allMembers || league.members).filter(function(x){ return x.userId===opts.userId; })[0];
    if(any && any.mergedInto){ var cid = canonMember(any.id); if(memberById(cid)) return cid; }
    m = league.members.filter(function(x){ return x.userId===opts.userId; })[0];
  }
  if(!m && opts.userId){
    // premier passage en ligne : si un membre IRL du même prénom n'est relié à aucun compte, on le relie
    var same = league.members.filter(function(x){ return !x.userId && normName(x.name)===normName(opts.name); });
    if(same.length===1 && (opts.userId===myId || isAdmin())){ m = same[0]; await linkMember(m.id, opts.userId, opts.pkey); }
  }
  if(!m && opts.memberId) m = memberById(opts.memberId);
  if(!m && opts.byName) m = league.members.filter(function(x){ return normName(x.name)===normName(opts.name); })[0];
  if(m) return m.id;
  var id = 'm_' + nowMs().toString(36) + Math.random().toString(36).slice(2,6);
  var doc = { name:(opts.name||'Joueur').slice(0,24), userId: opts.userId || null, createdAt: nowMs() };
  await claudeDb.collection('leagueMembers').doc(id).set(doc);
  league.members.push(Object.assign({ id:id }, doc));
  if(league.allMembers && league.allMembers !== league.members) league.allMembers.push(Object.assign({ id:id }, doc));
  return id;
}

// relie un membre « vraies cartes » à un compte (une seule fois ; seul le propriétaire du compte ou l'organisateur peut le faire)
async function linkMember(mid, userId, pkey){
  pkey = pkey || (currentProfile && currentProfile.key) || '';
  await claudeDb.doc('leagueLinks/'+mid).set({ memberId: mid, userId: userId, at: nowMs(), __plain:{ pkey: pkey } });
  (league.allMembers || league.members).concat(league.members).forEach(function(x){ if(x.id===mid) x.userId = userId; });
}

function ranksFromScores(list){ // list: [{key, score}] -> {key: rank} (ex æquo = même rang)
  var sorted = list.slice().sort(function(a,b){ return b.score-a.score; });
  var ranks = {};
  sorted.forEach(function(x, i){ ranks[x.key] = (i>0 && sorted[i-1].score===x.score) ? ranks[sorted[i-1].key] : i+1; });
  return ranks;
}

async function recordLeagueGame(gameId, mode, rows, roundsCount, at){
  // rows: [{ memberId, name, score, contracts, absDiff }]
  var ranks = ranksFromScores(rows.map(function(r){ return { key:r.memberId, score:r.score }; }));
  var players = rows.map(function(r){ var p = { memberId:r.memberId, name:r.name, rank:ranks[r.memberId], score:r.score, contracts:r.contracts, absDiff:r.absDiff }; if(r.uid) p.uid = r.uid; return p; });
  var rec = { at: at, season: seasonOf(at), mode: mode, rounds: roundsCount, players: players };
  var gref = claudeDb.collection('leagueGames').doc(gameId);
  var already = await gref.get();
  if(!already.exists) await gref.set(rec); // une partie de ligue enregistrée n'est plus jamais réécrite (protégé par les règles)
  league.loaded = false;
}

function statsFromLog(roundLog, key){
  var ok=0, abs=0;
  roundLog.forEach(function(r){ var b=r.bids[key], w=r.tricksWon[key]; if(b===w) ok++; abs += Math.abs((b||0)-(w||0)); });
  return { contracts: ok, absDiff: abs };
}

// Partie en ligne terminée : l'hôte l'enregistre une seule fois.
function onlineLeagueCheck(g){
  if(g.settings && g.settings.direction==='quick') return 'Ne compte pas pour la ligue : partie rapide.'; // v58 : les parties rapides restent pour s'amuser
  var ids = g.playerOrder || Object.keys(g.players||{});
  var humans = ids.filter(function(id){ return !g.players[id].isBot; });
  var bots = ids.length - humans.length;
  if(bots>0) return 'Ne compte pas pour la ligue : il y avait des bots.';
  if(humans.length < LEAGUE_MIN_HUMANS) return 'Ne compte pas pour la ligue : il faut au moins '+LEAGUE_MIN_HUMANS+' joueurs.';
  return '';
}
var leagueRecording = false;
async function maybeRecordOnline(g){
  if(g && (g.roundLog||[]).length < (g.roundPlan||[]).length) return; // l'historique séparé n'est pas encore arrivé
  if(!g || g.status!=='game_over' || !(g.settings && g.settings.league) || g.leagueRecorded || g.hostId!==myId || leagueRecording) return;
  if(onlineLeagueCheck(g)) return;
  leagueRecording = true;
  try{
    var audit = await auditGameFull(g);
    if(audit.state==='bad'){ showToast('Ligue : scores suspects, partie non enregistrée'); return; } // (leagueRecording reste bloqué : on ne réessaie pas)
    var rows = [];
    for(var i=0;i<g.playerOrder.length;i++){
      var uid = g.playerOrder[i], p = g.players[uid];
      var mid = await ensureMember({ userId: uid, name: p.name });
      var st = statsFromLog(g.roundLog||[], uid);
      rows.push({ memberId: mid, name: p.name, score: audit.scores[uid]||0, contracts: st.contracts, absDiff: st.absDiff, uid: keyOfPlayer(g, uid) }); // scores recalculés, pas ceux affichés
    }
    await recordLeagueGame('o_'+g.code+'_'+(g.startedAt||g.createdAt), 'online', rows, (g.roundLog||[]).length, nowMs());
    await claudeDb.doc('games/'+g.code).update({ leagueRecorded: true });
  }catch(e){ console.error(e); showToast('Ligue : '+dbErrorText(e)); }
  leagueRecording = false;
}

async function maybeRecordSheet(){
  if(!sheet || sheet.phase!=='over' || !sheet.league || sheet.leagueRecorded) return;
  try{
    var rows = sheet.players.map(function(p){
      var st = statsFromLog(sheet.roundLog, p.id);
      return { memberId: p.memberId, name: p.name, score: sheet.scores[p.id]||0, contracts: st.contracts, absDiff: st.absDiff };
    });
    await recordLeagueGame('s_'+sheet.createdAt+'_'+(myId||'x').slice(-6), 'cards', rows, sheet.roundLog.length, nowMs());
    sheet.leagueRecorded = true; saveSheet(); render();
  }catch(e){ console.error(e); showSheetToast('Ligue : '+dbErrorText(e)); }
}

// ---- calcul du classement ----
function computeLeague(seasonKey, mode){
  var games = league.games.filter(function(g){ return (seasonKey==='all' || g.season===seasonKey) && (!mode || g.mode===mode); });
  var S = {};
  function st(id, name){
    if(!S[id]) S[id] = { id:id, name:name, elo:ELO_START, games:0, wins:0, contracts:0, rounds:0, absDiff:0, history:[], eloHistory:[ELO_START], streak:0, bestStreak:0 };
    return S[id];
  }
  games.forEach(function(g){
    var ps = g.players || []; var n = ps.length; if(n<2) return;
    var before = {}; ps.forEach(function(p){ before[p.memberId] = st(p.memberId, p.name).elo; });
    ps.forEach(function(p){
      var s = st(p.memberId, p.name), d = 0;
      ps.forEach(function(q){
        if(q===p) return;
        var score = p.rank<q.rank ? 1 : (p.rank===q.rank ? 0.5 : 0);
        var exp = 1/(1+Math.pow(10, (before[q.memberId]-before[p.memberId])/400));
        d += score - exp;
      });
      d = ELO_K/(n-1) * d;
      s.elo += d; s.games++; s.rounds += (g.rounds||0); s.contracts += (p.contracts||0); s.absDiff += (p.absDiff||0);
      var won = p.rank===1;
      if(won){ s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); } else s.streak = 0;
      s.eloHistory.push(s.elo);
      s.history.push({ at:g.at, rank:p.rank, n:n, mode:g.mode, delta:d, score:p.score });
    });
  });
  var list = Object.keys(S).map(function(k){
    var s = S[k], m = memberById(k);
    if(m) s.name = m.name;
    s.contractRate = s.rounds ? s.contracts/s.rounds : 0;
    s.precision = s.rounds ? s.absDiff/s.rounds : 0;
    return s;
  }).sort(function(a,b){ return b.elo-a.elo; });
  return { ranked: list.filter(function(s){ return s.games>=LEAGUE_MIN_GAMES; }), unranked: list.filter(function(s){ return s.games<LEAGUE_MIN_GAMES; }), games: games.length };
}

// ---- écran Ligue ----
function openLeague(){ screen='league'; leagueView.open=null; if(!leagueView.season) leagueView.season = seasonOf(nowMs()); loadLeague(true); render(); }
function pct(x){ return Math.round(x*100)+' %'; }
function fmtDate(ts){ try{ return new Date(ts).toLocaleDateString('fr-BE', { day:'numeric', month:'short' }); }catch(e){ return ''; } }
function sparkline(values){
  if(values.length<2) return '';
  var w=240, h=48, pad=4, min=Math.min.apply(null, values), max=Math.max.apply(null, values);
  if(max-min<20){ var mid=(max+min)/2; min=mid-10; max=mid+10; }
  var pts = values.map(function(v,i){ return [pad + i*(w-2*pad)/(values.length-1), h-pad-(v-min)*(h-2*pad)/(max-min)]; });
  var d = pts.map(function(p,i){ return (i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1); }).join(' ');
  var base = h-pad-(ELO_START-min)*(h-2*pad)/(max-min);
  var last = pts[pts.length-1];
  return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" height="'+h+'" role="img" aria-label="Évolution de la cote">'
    + (base>=0 && base<=h ? '<line x1="0" x2="'+w+'" y1="'+base.toFixed(1)+'" y2="'+base.toFixed(1)+'" stroke="currentColor" stroke-opacity="0.18" stroke-dasharray="3 3"/>' : '')
    + '<path d="'+d+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="3.5" fill="currentColor"/></svg>';
}
function seasonsList(){
  var set = {}; set[seasonOf(nowMs())] = true;
  league.games.forEach(function(g){ if(g.season) set[g.season]=true; });
  return Object.keys(set).sort().reverse();
}
function renderLeagueRow(s, i, ranked){
  var me = myMember(), isMe = me && me.id===s.id, open = leagueView.open===s.id;
  var html = '<div class="league-row'+(open?' open':'')+(ranked && i===0?' first':'')+'">';
  html += '<button class="league-main" data-action="league-open" data-id="'+esc(s.id)+'" aria-expanded="'+(open?'true':'false')+'">'
    + '<span class="rank-num">'+(ranked ? (i+1) : '–')+'</span>'
    + '<span class="lg-who"><span class="lg-name">'+esc(s.name)+(isMe?' <span class="muted" style="font-weight:400;">(toi)</span>':'')+'</span>'
    + '<span class="lg-meta">'+s.games+' partie'+(s.games>1?'s':'')+' · '+s.wins+' V · '+pct(s.contractRate)+' contrats</span></span>'
    + '<span class="lg-elo">'+Math.round(s.elo)+'</span></button>';
  if(open){
    var m = memberById(s.id);
    html += '<div class="lg-detail">';
    html += '<div class="lg-stats">'
      + '<div><b>'+s.wins+' / '+s.games+'</b><span>victoires</span></div>'
      + '<div><b>'+pct(s.contractRate)+'</b><span>contrats réussis</span></div>'
      + '<div><b>'+s.precision.toFixed(2).replace('.',',')+'</b><span>écart moyen / manche</span></div>'
      + '<div><b>'+s.bestStreak+'</b><span>meilleure série</span></div></div>';
    html += '<div class="lg-spark">'+sparkline(s.eloHistory)+'<div class="muted" style="font-size:11.5px;">Évolution de la cote (pointillés = 1000)</div></div>';
    html += '<div class="eyebrow" style="margin:10px 0 4px;">Dernières parties</div><table class="score-table"><tbody>';
    s.history.slice(-8).reverse().forEach(function(h){
      html += '<tr><td>'+fmtDate(h.at)+'</td><td>'+h.rank+'<sup>'+(h.rank===1?'er':'e')+'</sup> / '+h.n+'</td><td class="muted">'+h.score+' pts</td><td class="'+ptsClass(Math.round(h.delta))+'" style="font-weight:700;">'+fmtPts(Math.round(h.delta))+'</td></tr>';
    });
    html += '</tbody></table>';
    if(m && !m.userId && !myMember() && ((!usingMock && !usingFirebase) || currentProfile)) html += '<button class="btn small secondary" style="margin-top:10px;" data-action="league-claim" data-id="'+esc(s.id)+'">C\'est moi : relier à mon compte</button>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}
function renderLeague(){
  var html = '<div class="topbar"><div class="brand"><span class="display">Rikiki</span><span class="badge">Ligue</span></div>'
    + '<div class="actions"><button class="btn ghost" data-action="analysis-open">Analyse</button><button class="btn ghost" data-action="league-help">Comment ça marche</button><button class="btn ghost" data-action="league-home">Accueil</button></div></div>';
  if(!league.loaded){
    html += '<div class="center-wrap"><span class="muted">'+(league.error ? esc(league.error) : 'Chargement de la ligue…')+'</span></div>';
    return html;
  }
  var seasons = seasonsList();
  if(seasons.indexOf(leagueView.season)<0 && leagueView.season!=='all') leagueView.season = seasons[0];
  html += '<div class="toggle-row" role="tablist" style="max-width:420px;">'
    + '<button class="btn secondary'+(leagueView.mode==='online'?' active':'')+'" role="tab" aria-selected="'+(leagueView.mode==='online')+'" data-action="league-mode" data-mode="online">En ligne</button>'
    + '<button class="btn secondary'+(leagueView.mode==='cards'?' active':'')+'" role="tab" aria-selected="'+(leagueView.mode==='cards')+'" data-action="league-mode" data-mode="cards">Vraies cartes (IRL)</button></div>';
  html += '<div class="league-head"><h2 style="font-size:28px;">'+(leagueView.mode==='cards'?'Classement IRL':'Classement en ligne')+'</h2>'
    + '<select id="leagueSeason" aria-label="Saison">'
    + seasons.map(function(k){ return '<option value="'+k+'"'+(leagueView.season===k?' selected':'')+'>'+esc(seasonLabel(k))+'</option>'; }).join('')
    + '<option value="all"'+(leagueView.season==='all'?' selected':'')+'>'+seasonLabel('all')+'</option></select></div>';
  var res = computeLeague(leagueView.season, leagueView.mode);
  if(!res.games){
    html += '<div class="card-panel" style="text-align:center;"><p style="margin:0 0 6px; font-weight:700;">Aucune partie de ligue pour l\'instant</p>'
      + '<p class="muted" style="font-size:13.5px; margin:0;">'+(leagueView.mode==='cards' ? 'Coche « Partie de ligue » dans la feuille de score (Jouer avec de vraies cartes).' : 'Les parties en ligne comptent d\'office (sauf les parties rapides).')+' Il faut au moins '+LEAGUE_MIN_HUMANS+' joueurs humains et aller jusqu\'au bout.</p></div>';
  } else {
    html += '<p class="muted" style="font-size:13px; margin:0 0 10px;">'+res.games+' partie'+(res.games>1?'s':'')+' · cote Elo (départ '+ELO_START+') · classé à partir de '+LEAGUE_MIN_GAMES+' parties</p>';
    html += '<div class="league-list">';
    res.ranked.forEach(function(s,i){ html += renderLeagueRow(s,i,true); });
    html += '</div>';
    if(res.unranked.length){
      html += '<div class="eyebrow" style="margin:16px 0 6px;">Pas encore classés (moins de '+LEAGUE_MIN_GAMES+' parties)</div><div class="league-list">';
      res.unranked.forEach(function(s,i){ html += renderLeagueRow(s,i,false); });
      html += '</div>';
    }
  }
  // v43 : parties en ligne pas encore confirmées par la majorité des joueurs
  var pend = leagueView.mode==='online' ? (league.pending||[]).filter(function(g){ return leagueView.season==='all' || g.season===leagueView.season; }) : [];
  if(pend.length){
    html += '<div class="card-panel" style="margin-top:14px;"><div class="eyebrow" style="margin-bottom:6px;">⏳ En attente de confirmation</div>'
      + '<p class="muted" style="font-size:12.5px; margin:0 0 8px;">Une partie compte dès que la majorité des joueurs l\'a confirmée. C\'est automatique : à la fin de la partie, ou la prochaine fois que le joueur ouvre le jeu.</p>';
    pend.slice().reverse().slice(0, 10).forEach(function(g){
      html += '<div class="row between" style="margin-top:6px; gap:8px;"><span style="flex:1; min-width:0; font-size:13.5px;">'+new Date(g.at).toLocaleDateString('fr-BE')+' · '
        + esc((g.players||[]).map(function(p){ return p.name; }).join(', '))+' <span class="muted">('+g.attest.have+'/'+g.attest.need+' confirmations)</span></span>'
        + (isAdmin() ? '<button class="btn small" data-action="league-validate" data-id="'+esc(g.id)+'">Valider</button>' : '') + '</div>';
    });
    if(isAdmin()) html += '<p class="muted" style="font-size:11.5px; margin:8px 0 0;">Organisateur : valide à la main seulement si tu es sûr du résultat (tu as joué, ou tu as vu la partie).</p>';
    html += '</div>';
  }
  if(leagueView.help){
    html += '<div class="modal-backdrop" data-action="league-help"><div class="card-panel modal">'
      + '<button class="btn ghost close-x" data-action="league-help">Fermer</button><h3>Comment marche le classement</h3>'
      + '<p>Chaque joueur commence à '+ELO_START+'. Une partie compte comme des duels entre tous les joueurs selon le classement final : finir devant quelqu\'un, c\'est gagner le duel.</p>'
      + '<p>Battre un joueur mieux coté rapporte plus que battre un joueur moins bien coté ; perdre contre un joueur moins bien coté coûte plus. Le gain est divisé par le nombre d\'adversaires, donc une partie à 6 ne compte pas plus qu\'une partie à 3.</p>'
      + '<p>Il y a deux classements séparés : les parties en ligne et les parties avec de vraies cartes (IRL). Chacun a sa propre cote.</p>'
      + '<p>Chaque saison (un trimestre) repart de '+ELO_START+'. Le classement « Général » cumule toutes les parties.</p>'
      + '<p>Seules les parties cochées « Partie de ligue », avec au moins '+LEAGUE_MIN_HUMANS+' joueurs humains, sans bot et jouées jusqu\'au bout, comptent. Il faut '+LEAGUE_MIN_GAMES+' parties pour apparaître dans le classement.</p>'
      + '<p>Anti-triche (en ligne) : à la fin d\'une partie, chaque téléphone revérifie toutes les cartes et les points, puis confirme le résultat tout seul. La partie compte quand la majorité des joueurs l\'a confirmée ; un joueur qui a quitté trop tôt confirme à sa prochaine ouverture du jeu.</p>'
      + '<p>Contrats réussis = manches où l\'annonce était exacte. Écart moyen = différence moyenne entre annonce et plis faits (0 = parfait).</p>'
      + '</div></div>';
  }
  html += renderBackupPanel();
  html += renderMaintenancePanel();
  return html;
}

document.addEventListener('click', function(e){
  var el = e.target.closest('[data-action]'); if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='league-openscreen'){ if(el.getAttribute('data-mode')) leagueView.mode = el.getAttribute('data-mode'); openLeague(); }
  else if(a==='league-mode'){ leagueView.mode = el.getAttribute('data-mode'); leagueView.open=null; render(); }
  else if(a==='league-home'){ screen='entry'; leagueView.help=false; render(); }
  else if(a==='league-open'){ var id=el.getAttribute('data-id'); leagueView.open = leagueView.open===id ? null : id; render(); }
  else if(a==='league-help'){ leagueView.help = !leagueView.help; render(); }
  else if(a==='league-validate' && isAdmin()){
    var gid = el.getAttribute('data-id');
    if(!confirmT('Compter cette partie dans le classement, même sans la majorité des confirmations ?')) return;
    claudeDb.doc('leagueValid/'+gid).set({ by: currentProfile ? currentProfile.pseudo : '', at: nowMs() })
      .then(function(){ league.loaded = false; return loadLeague(true); })
      .catch(function(err){ console.error(err); showToast(dbErrorText(err)); });
  }
  else if(a==='league-claim'){
    var id2 = el.getAttribute('data-id');
    linkMember(id2, myId).then(function(){ render(); })
      .catch(function(err){ console.error(err); showToast(dbErrorText(err)); });
  }
});
document.addEventListener('change', function(e){
  if(e.target.id==='leagueSeason'){ leagueView.season = e.target.value; leagueView.open=null; render(); }
});

