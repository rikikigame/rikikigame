/* ===================== v20 : analyse des parties en ligne + niveau des robots =====================
   analysisGames/{id} : { at, code, playerOrder, players:{id:{name,isBot}}, settings:{scoring,blindOne,botLevel}, rounds:[roundLog enrichi] }
   Chaque manche garde la graine de la donne, l'ordre d'annonce et la suite exacte des cartes jouées :
   l'analyse peut ainsi rejouer la manche coup par coup.
   analysis/params : { agree, bidBias, bidSd, n } — le profil « humain » moyen, appliqué aux robots de niveau Humain. */
var BOT_LEVEL_LABEL = { facile:'Facile', humain:'Humain', fort:'Fort' };
var DEFAULT_HUMAN = { agree:0.7, mix:0.5, bidBias:0, bidSd:0.8, ruff:0.6, n:0 };
function botLevelOf(g){ var l = g && g.settings && g.settings.botLevel; return BOT_LEVEL_LABEL[l] ? l : 'humain'; }
function humanParams(g){ return Object.assign({}, DEFAULT_HUMAN, (g && g.settings && g.settings.botHuman) || {}); }
function gaussian(){ var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2*Math.log(u)) * Math.cos(2*Math.PI*v); }
function legalCards(g, hand){
  var led = (g.currentTrick && g.currentTrick.length) ? g.currentTrick[0].card.suit : null;
  return (led && hand.some(function(c){ return c.suit===led; })) ? hand.filter(function(c){ return c.suit===led; }) : hand.slice();
}
// ancien robot simple : pas de mémoire, pas de stratégie d'ouverture
function botNaiveCard(botId, g, hand){
  if(!hand.length) return null;
  var ledSuit = g.currentTrick.length>0 ? g.currentTrick[0].card.suit : null;
  var trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  var sorted = legalCards(g, hand).sort(function(a,b){ return a.value-b.value; });
  if(g.currentTrick.length===0) return sorted[Math.floor(sorted.length/2)];
  var needsWin = (g.tricksWon[botId]||0) < (g.bids[botId]||0);
  var winners = sorted.filter(function(c){ return cardBeatsTrick(c, g.currentTrick, ledSuit, trumpSuit); });
  if(needsWin) return winners.length ? winners[0] : sorted[0];
  var losers = sorted.filter(function(c){ return !cardBeatsTrick(c, g.currentTrick, ledSuit, trumpSuit); });
  return losers.length ? losers[losers.length-1] : sorted[0];
}
function blindWinProbability(botId, g){
  var hands = dealtHands(g), seen = {}, trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  g.playerOrder.forEach(function(id){ if(id!==botId && hands[id] && hands[id][0]) seen[cardKey(hands[id][0])] = 1; });
  if(g.trumpCard) seen[cardKey(g.trumpCard)] = 1;
  var order = trickOrderFrom(g, g.leadPlayerId), wins = 0, total = 0;
  buildDeck().forEach(function(c){
    if(seen[cardKey(c)]) return; total++;
    var trick = order.map(function(id){ return { playerId:id, card: id===botId ? c : hands[id][0] }; });
    if(trickWinner(trick, trick[0].card.suit, trumpSuit) === botId) wins++;
  });
  return total ? wins/total : 0;
}
function botLevelBid(botId, g, hand){
  var lvl = botLevelOf(g);
  if(lvl==='fort'){ var pj = botJitter; botJitter = false; try{ return botChooseBid(botId, g, hand); } finally { botJitter = pj; } }
  var hp = lvl==='humain' ? humanParams(g) : { bidBias:0, bidSd:1.2 };
  var est = isBlindRound(g) ? blindWinProbability(botId, g) : botHeuristicEstimate(botId, g, hand);
  return botBidFromEstimate(botId, g, est + (hp.bidBias||0) + gaussian()*(hp.bidSd||0));
}
// v41 : situation de coupe (il n'a plus la couleur demandée, il lui faut des plis, et un atout gagnerait)
function ruffChoice(botId, g, hand){
  var trick = g.currentTrick || [], trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  if(!trick.length || !trumpSuit) return null;
  var led = trick[0].card.suit;
  if(led===trumpSuit || hand.some(function(c){ return c.suit===led; })) return null;
  if((g.bids[botId]||0) - (g.tricksWon[botId]||0) <= 0) return null;
  var ruffs = hand.filter(function(c){ return c.suit===trumpSuit && cardBeatsTrick(c, trick, led, trumpSuit); }).sort(function(a,b){ return a.value-b.value; });
  var others = hand.filter(function(c){ return c.suit!==trumpSuit; }).sort(function(a,b){ return a.value-b.value; });
  if(!ruffs.length || !others.length) return null;
  return { ruff: ruffs[0], discard: others[0] };
}
function botLevelCard(botId, g, hand){
  var lvl = botLevelOf(g);
  if(lvl==='fort') return botSearchCard(botId, g, hand); // v42 : réfléchit carte par carte
  if(legalCards(g, hand).length < 2) return botChooseCard(botId, g, hand);
  var rc = ruffChoice(botId, g, hand);
  if(rc){ // coupe aussi souvent que vous (taux mesuré par l'analyse) ; le Facile coupe presque toujours
    var rate = lvl==='facile' ? 0.9 : humanParams(g).ruff;
    return Math.random() < rate ? rc.ruff : rc.discard;
  }
  if(lvl==='facile') return Math.random() < 0.35 ? botChooseCard(botId, g, hand) : botNaiveCard(botId, g, hand);
  var hp = humanParams(g), mix = (typeof hp.mix==='number') ? hp.mix : Math.max(0, (hp.agree-0.4)/0.6);
  return Math.random() < mix ? botChooseCard(botId, g, hand) : botNaiveCard(botId, g, hand);
}

// --- enregistrement (l'hôte, une fois par partie terminée) ---
var analysisRecording = false;
async function maybeRecordAnalysis(g){
  if(!g || g.status!=='game_over' || g.hostId!==myId || g.analysisRecorded || analysisRecording) return;
  var lg0 = g.roundLog || [], waitMs = g.lastTrick ? nowMs() - g.lastTrick.at : 99999;
  if((lg0.length < g.roundPlan.length || lg0.some(function(r){ return !r.dealSeed; })) && waitMs < 20000){ // graines pas encore toutes révélées
    setTimeout(function(){ if(gameDoc && gameDoc.code===g.code) onGameUpdate(); }, 4000); return;
  }
  var rounds = (g.roundLog||[]).filter(function(r){ return r.dealSeed && Array.isArray(r.played) && Array.isArray(r.bidOrder); });
  var ids = g.playerOrder || [];
  if(!rounds.length || !ids.some(function(id){ return g.players[id] && !g.players[id].isBot; })) return;
  analysisRecording = true;
  try{
    var players = {}; ids.forEach(function(id){ var p = g.players[id]||{}; players[id] = { name:p.name||'?', isBot:!!p.isBot }; });
    var aref = claudeDb.collection('analysisGames').doc('a_'+g.code+'_'+(g.startedAt||g.createdAt));
    if(!(await aref.get()).exists) await aref.set({
      at: nowMs(), code: g.code, playerOrder: ids, players: players,
      settings: { scoring: getScoring(g), blindOne: !(g.settings && g.settings.blindOne===false), botLevel: botLevelOf(g) },
      rounds: rounds,
      __plain: { code: g.code } // v49 : les règles Firebase vérifient que cette partie existe bien
    });
    await claudeDb.doc('games/'+g.code).update({ analysisRecorded: true });
  }catch(e){ console.error(e); }
  analysisRecording = false;
}

// --- l'analyse : rejoue chaque manche coup par coup ---
function newStat(name, isBot, level){ return { name:name, isBot:isBot, level:level, rounds:0, ok:0, absErr:0, bias:0, bidN:0, bidDelta:0, bidDelta2:0, dec:0, agree:0, naiveSame:0, lastDec:0, avoidable:0, missed:0, ruffOpp:0, ruffYes:0 }; }
function analyzeRecords(recs){
  botJitter = false; try{ return analyzeRecordsInner(recs); } finally { botJitter = true; }
}
function analyzeRecordsInner(recs){
  var by = {}, all = { humans: newStat('Tous les humains', false), bots:{} };
  function statFor(rec, id){
    var p = rec.players[id] || { name:'?', isBot:false };
    if(p.isBot){ var lv = (rec.settings && rec.settings.botLevel) || 'fort'; return all.bots[lv] || (all.bots[lv] = newStat('Robots · '+(BOT_LEVEL_LABEL[lv]||lv), true, lv)); }
    return by[id] || (by[id] = newStat(p.name, false));
  }
  function addOuter(s, f){ f(s); if(!s.isBot) f(all.humans); }
  var seenCode = {};
  recs.forEach(function(rec){
    var ck = rec.code+'_'+(rec.playerOrder||[]).join(','); // une partie enregistrée deux fois ne compte qu'une fois
    if(seenCode[ck]) return; seenCode[ck] = 1;
    (rec.rounds||[]).forEach(function(r){
      // v49 : une manche ne compte que si elle se rejoue entièrement sans tricher (cartes distribuées par la graine,
      // cartes autorisées, plis gagnés identiques) : les fausses parties envoyées à la main n'entraînent pas les robots.
      var later = [], add = function(s, f){ later.push([s, f]); };
      try{
        var order = rec.playerOrder, H = r.handSize, hands = dealCards(r.dealSeed, order, H).hands;
        var blind = H===1 && rec.settings && rec.settings.blindOne!==false;
        var g = { code:'A', playerOrder:order, roundPlan:[H], round:0, settings:{ blindOne: blind }, dealSeed:r.dealSeed, trumpCard:r.trump||null,
                  bids:r.bids, tricksWon:{}, currentTrick:[], trickNumber:0, played:[], bidOrder:r.bidOrder, leadPlayerId:r.bidOrder[0] };
        order.forEach(function(id){ g.tricksWon[id] = 0; });
        var assisted = r.coachIds || [];
        // annonces
        r.bidOrder.forEach(function(id, i){
          if(assisted.indexOf(id) >= 0) return; // manche jouée avec le coach : pas représentative
          var s = statFor(rec, id), b = r.bids[id], w = r.tricksWon[id];
          add(s, function(x){ x.rounds++; if(b===w) x.ok++; x.absErr += Math.abs(w-b); x.bias += (w-b); });
          if(!blind){
            var gb = Object.assign({}, g, { bids:{} }); order.forEach(function(q){ gb.bids[q] = null; });
            r.bidOrder.slice(0,i).forEach(function(q){ gb.bids[q] = r.bids[q]; });
            var ref = Math.max(0, Math.min(H, Math.round(botHeuristicEstimate(id, gb, hands[id]))));
            add(s, function(x){ x.bidN++; x.bidDelta += (b-ref); x.bidDelta2 += (b-ref)*(b-ref); });
          }
        });
        // le jeu, carte par carte
        var rem = {}; order.forEach(function(id){ rem[id] = hands[id].slice(); });
        var lead = r.bidOrder[0], k = 0, trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
        for(var t=0; t<H; t++){
          g.currentTrick = []; g.trickNumber = t;
          var o = trickOrderFrom(g, lead);
          for(var q=0; q<o.length; q++){
            var id = o[q], card = r.played[k++], hand = rem[id];
            var idx = hand.findIndex(function(c){ return c.suit===card.suit && c.rank===card.rank; });
            if(idx<0) throw new Error('manche incohérente');
            var legal = legalCards(g, hand);
            if(!legal.some(function(c){ return c.suit===card.suit && c.rank===card.rank; })) throw new Error('carte interdite');
            if(legal.length >= 2 && !blind && assisted.indexOf(id) < 0){
              var s2 = statFor(rec, id), strong = botChooseCard(id, g, hand), same = strong && strong.suit===card.suit && strong.rank===card.rank;
              var nv = botNaiveCard(id, g, hand), naiveSame = nv && strong && nv.suit===strong.suit && nv.rank===strong.rank;
              var led = g.currentTrick.length ? g.currentTrick[0].card.suit : card.suit;
              var isLast = q===o.length-1, need = (r.bids[id]||0) - g.tricksWon[id];
              var wins = isLast && cardBeatsTrick(card, g.currentTrick, led, trumpSuit);
              var canLose = isLast && legal.some(function(c){ return !cardBeatsTrick(c, g.currentTrick, led, trumpSuit); });
              var canWin = isLast && legal.some(function(c){ return cardBeatsTrick(c, g.currentTrick, led, trumpSuit); });
              var rc = ruffChoice(id, g, hand), ruffed = !!rc && card.suit===trumpSuit;
              add(s2, function(x){ x.dec++; if(same) x.agree++; if(naiveSame) x.naiveSame++; if(rc){ x.ruffOpp++; if(ruffed) x.ruffYes++; }
                if(isLast){ x.lastDec++; if(need<=0 && wins && canLose) x.avoidable++; if(need>0 && !wins && canWin) x.missed++; } });
            }
            hand.splice(idx, 1);
            g.currentTrick.push({ playerId:id, card:card }); g.played.push(card);
          }
          var w2 = trickWinner(g.currentTrick, g.currentTrick[0].card.suit, trumpSuit);
          g.tricksWon[w2]++; lead = w2;
        }
        if(order.some(function(id){ var b = r.bids[id]; return g.tricksWon[id]!==r.tricksWon[id] || !(b>=0 && b<=H && b===Math.floor(b)); })) throw new Error('plis incohérents');
        later.forEach(function(x){ addOuter(x[0], x[1]); });
      }catch(e){ console.warn('analyse : manche ignorée', e); }
    });
  });
  var rows = Object.keys(by).map(function(k){ return by[k]; }).filter(function(x){ return x.rounds > 0; }).sort(function(a,b){ return b.rounds-a.rounds; });
  return { humans: rows, all: all.humans, bots: Object.keys(all.bots).map(function(k){ return all.bots[k]; }), games: recs.length };
}
function paramsFromStat(s){
  var mean = s.bidN ? s.bidDelta/s.bidN : 0;
  var sd = s.bidN > 1 ? Math.sqrt(Math.max(0, s.bidDelta2/s.bidN - mean*mean)) : DEFAULT_HUMAN.bidSd;
  var A = s.dec ? s.agree/s.dec : DEFAULT_HUMAN.agree, q = s.dec ? s.naiveSame/s.dec : 0.4;
  // le coup « humain » du robot coïncide parfois avec celui du Fort : on corrige pour viser exactement le taux mesuré
  var mix = q < 0.99 ? Math.max(0, Math.min(1, (A - q)/(1 - q))) : A;
  var ruff = s.ruffOpp >= 5 ? s.ruffYes/s.ruffOpp : DEFAULT_HUMAN.ruff; // v41 : à quel point vous coupez quand vous pouvez
  return { agree: Math.round(1000*A)/1000, mix: Math.round(1000*mix)/1000, bidBias: Math.round(mean*100)/100, bidSd: Math.round(sd*100)/100, ruff: Math.round(100*ruff)/100, ruffN: s.ruffOpp, n: s.rounds };
}

// --- écran Analyse ---
var analysis = { loading:false, loaded:false, error:'', res:null, params:null, msg:'' };
async function loadAnalysis(){
  analysis.loading = true; analysis.error=''; render();
  try{
    var snap = await claudeDb.collection('analysisGames').orderBy('at', 'desc').limit(400).get(); // v42 : les 400 plus RÉCENTES (avant : les 400 plus anciennes)
    var recs = snap.docs.map(function(d){ return d.data(); });
    analysis.res = analyzeRecords(recs);
    try{ var ps = await claudeDb.doc('analysis/params').get(); analysis.params = ps.exists ? ps.data() : null; }catch(e){ analysis.params = null; }
    analysis.loaded = true;
  }catch(e){ console.error(e); analysis.error = 'Analyse impossible : '+dbErrorText(e); }
  analysis.loading = false; render();
}
function openAnalysis(){ screen='analysis'; analysis.msg=''; loadAnalysis(); }
async function applyHumanParams(){
  if(!isAdmin() || !analysis.res) return;
  var p = paramsFromStat(analysis.res.all); p.at = nowMs();
  try{ await claudeDb.doc('analysis/params').set(p); analysis.params = p; analysis.msg = 'Appliqué ✓ : les robots de niveau Humain suivront ce profil dans les prochaines parties.'; }
  catch(e){ analysis.msg = 'Impossible : '+dbErrorText(e); }
  render();
}
function pctOf(a, b){ return b ? Math.round(100*a/b)+' %' : '–'; }
function signedNum(x, d){ var v = Math.round(x*Math.pow(10,d||1))/Math.pow(10,d||1); return (v>0?'+':'')+v; }
function renderAnalysisRow(s){
  var bias = s.rounds ? s.bias/s.rounds : 0;
  return '<tr><td style="text-align:left;"><strong>'+esc(s.name)+'</strong></td><td>'+s.rounds+'</td><td>'+pctOf(s.ok, s.rounds)+'</td>'
    + '<td>'+(s.rounds ? (Math.round(10*s.absErr/s.rounds)/10) : '–')+'</td>'
    + '<td>'+(s.rounds ? (Math.abs(bias)<0.1 ? 'juste' : (bias>0 ? 'sous-annonce ('+signedNum(bias)+' pli/manche)' : 'sur-annonce ('+signedNum(bias)+' pli/manche)')) : '–')+'</td>'
    + '<td>'+pctOf(s.agree, s.dec)+'</td><td>'+pctOf(s.avoidable, s.lastDec)+'</td><td>'+pctOf(s.missed, s.lastDec)+'</td></tr>';
}
function renderAnalysis(){
  var html = '<div class="topbar"><div class="brand"><span class="display">Rikiki</span><span class="badge">Analyse</span></div>'
    + '<div class="actions"><button class="btn ghost" data-action="analysis-back">Ligue</button><button class="btn ghost" data-action="league-home">Accueil</button></div></div>';
  if(analysis.error) return html + '<div class="card-panel"><p class="error-text">'+esc(analysis.error)+'</p></div>';
  if(!analysis.loaded) return html + '<div class="center-wrap"><span class="muted">Analyse des parties…</span></div>';
  var r = analysis.res;
  html += '<div class="card-panel" style="margin-bottom:14px;"><h2 style="font-size:24px; margin:0 0 6px;">Comment vous jouez</h2>'
    + '<p class="muted" style="font-size:13.5px; margin:0;">'+r.games+' partie'+(r.games>1?'s':'')+' en ligne analysée'+(r.games>1?'s':'')+'. Chaque manche est rejouée coup par coup et comparée au robot Fort.</p></div>';
  if(!r.all.rounds){
    return html + '<div class="card-panel"><p style="margin:0;">Pas encore de données : jouez quelques parties en ligne (avec au moins un humain) jusqu\'au bout, elles apparaîtront ici.</p></div>';
  }
  html += '<div class="card-panel" style="margin-bottom:14px; overflow-x:auto;"><table class="score-table" style="min-width:640px;"><thead><tr>'
    + '<th style="text-align:left;">Joueur</th><th>Manches</th><th>Contrats</th><th>Écart moyen</th><th>Tendance</th><th>Comme le robot Fort</th><th>Plis pris évitables</th><th>Plis ratés</th></tr></thead><tbody>';
  r.humans.forEach(function(s){ html += renderAnalysisRow(s); });
  if(r.humans.length > 1) html += renderAnalysisRow(r.all);
  r.bots.forEach(function(s){ html += renderAnalysisRow(s); });
  html += '</tbody></table>'
    + '<p class="muted" style="font-size:12px; margin:10px 0 0;">« Comme le robot Fort » : part des coups (avec au moins 2 cartes possibles) où le joueur a joué la même carte que le robot le plus fort. '
    + '« Plis pris évitables » : en dernier à jouer, déjà à son contrat, il a pris le pli alors qu\'il pouvait le perdre. « Plis ratés » : en dernier, il lui fallait un pli et il pouvait le prendre, mais ne l\'a pas pris (en % des coups joués en dernier).</p></div>';
  var p = paramsFromStat(r.all);
  html += '<div class="card-panel"><h3 style="margin:0 0 6px;">Robots niveau Humain</h3>'
    + '<p style="font-size:14px; margin:0 0 6px;">Profil mesuré sur vous : joue comme le robot Fort <strong>'+Math.round(p.agree*100)+' %</strong> du temps, annonce en moyenne <strong>'+signedNum(p.bidBias,2)+'</strong> pli par rapport à l\'estimation du robot (dispersion ± '+p.bidSd+'), sur '+p.n+' manches. '
    + (p.ruffN >= 5 ? 'Quand vous pouvez couper, vous coupez <strong>'+Math.round(p.ruff*100)+' %</strong> du temps ('+p.ruffN+' occasions).' : 'Pas encore assez d\'occasions de coupe mesurées (il en faut 5).')+'</p>'
    + '<p class="muted" style="font-size:13px; margin:0 0 10px;">Actuellement appliqué : '+(analysis.params ? ('comme le Fort '+Math.round(analysis.params.agree*100)+' %, annonces '+signedNum(analysis.params.bidBias,2)+' ± '+analysis.params.bidSd+' ('+analysis.params.n+' manches)') : 'profil par défaut (70 %, ± 0,8)')+'.</p>';
  if(isAdmin()) html += '<button class="btn" data-action="analysis-apply" '+(r.all.rounds < 10 ? 'disabled' : '')+'>'+(r.all.rounds < 10 ? 'Il faut au moins 10 manches humaines' : 'Appliquer ce profil aux robots « Humain »')+'</button>';
  else html += '<p class="muted" style="font-size:13px; margin:0;">Seul l\'organisateur ('+esc(ADMIN_PSEUDOS[0]||'')+') peut appliquer le profil.</p>';
  if(analysis.msg) html += '<p style="font-size:13.5px; font-weight:700; margin:10px 0 0;">'+esc(analysis.msg)+'</p>';
  html += '</div>';
  return html;
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action]') : null; if(!el) return;
  var a = el.getAttribute('data-action');
  if(a==='analysis-open') openAnalysis();
  else if(a==='analysis-back'){ openLeague(); }
  else if(a==='analysis-apply') applyHumanParams();
});

