/* ===================== v21 : mode coach (conseils pendant son tour) =====================
   Chacun l'active avec 🧠. L'hôte peut l'interdire (interdit par défaut en partie de ligue).
   Les manches où un joueur a utilisé le coach sont marquées (coachUsed) et exclues de l'analyse. */
var coachOn = false;
try{ coachOn = localStorage.getItem('rikiki_coach')==='1'; }catch(e){}
var coachCache = { key:null, bid:null, busy:false }, coachMarked = null;
function coachAllowedOf(g){ var s = (g && g.settings) || {}; return (typeof s.coachAllowed==='boolean') ? s.coachAllowed : !s.league; }
function coachActive(g){
  return !!(coachOn && g && coachAllowedOf(g) && g.turnPlayerId===myId && (g.status==='bidding' || g.status==='playing') && myHand && myHand.cards.length);
}
function coachMarkUse(g){
  // marque la manche comme « jouée avec le coach » pour ce joueur (une fois par donne)
  if(!coachActive(g) || coachMarked===g.dealSeed) return;
  coachMarked = g.dealSeed;
  var patch = { coachUsed:{} }; patch.coachUsed[myId] = g.dealSeed;
  claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); });
}
function coachComputeBid(g, hand){
  var H = g.roundPlan[g.round], sc = getScoring(g), bo = g.bidOrder, forbidden = -1;
  if(bo.indexOf(myId)===bo.length-1){ var so=0; bo.slice(0,-1).forEach(function(id){ so += (g.bids[id]||0); }); forbidden = H - so; }
  var rows = [];
  if(isBlindRound(g)){
    var p = blindWinProbability(myId, g);
    [0,1].forEach(function(b){ if(b===forbidden) return; var pOk = b ? p : 1-p;
      rows.push({ b:b, p:pOk, ev: pOk*scoreRound(sc,b,b) + (1-pOk)*scoreRound(sc,b,1-b) }); });
    return { est:p, rows:rows, best: rows.slice().sort(function(a,b){ return b.ev-a.ev; })[0], blind:true, forbidden:forbidden };
  }
  var est = botHeuristicEstimate(myId, g, hand), base = Math.max(0, Math.min(H, Math.round(est)));
  var okC = allowedBids(g, myId);
  var cands = []; for(var b=Math.max(0,base-2); b<=Math.min(H,base+2); b++) if(b!==forbidden && okC.indexOf(b)>=0) cands.push(b);
  if(!cands.length) cands = okC.slice();
  var mine = {}; hand.forEach(function(c){ mine[cardKey(c)]=1; });
  var pool = buildDeck().filter(function(c){ return !mine[cardKey(c)] && !(g.trumpCard && cardKey(c)===cardKey(g.trumpCard)); });
  var others = g.playerOrder.filter(function(id){ return id!==myId; }), n = g.playerOrder.length;
  var R = Math.max(20, Math.min(120, Math.floor(12000 / (cands.length * H * n))));
  var ok = {}, pts = {}, sumW = 0; cands.forEach(function(b){ ok[b]=0; pts[b]=0; });
  for(var r=0; r<R; r++){
    var deck = pool.slice();
    for(var i=deck.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=deck[i]; deck[i]=deck[j]; deck[j]=t; }
    var hands = {}, k = 0; hands[myId] = hand.slice();
    others.forEach(function(id){ hands[id] = deck.slice(k, k+H); k += H; });
    cands.forEach(function(b){ var w = botRollout(myId, g, hands, b); if(w===b) ok[b]++; pts[b] += scoreRound(sc, b, w); if(b===base) sumW += w; });
  }
  cands.forEach(function(b){ rows.push({ b:b, p: ok[b]/R, ev: pts[b]/R }); });
  return { est: cands.indexOf(base)>=0 ? sumW/R : est, rows:rows, best: rows.slice().sort(function(a,b){ return b.ev-a.ev; })[0], forbidden:forbidden };
}
function coachBidHtml(g){
  if(!coachActive(g) || g.status!=='bidding') return '';
  var key = g.code+'|'+g.dealSeed+'|'+Object.keys(g.bids).map(function(k){ return g.bids[k]; }).join(',');
  if(coachCache.key===key && coachCache.bid){
    var a = coachCache.bid, sc = getScoring(g);
    var html = '<div class="coach-box">🧠 <strong>Coach</strong> · '+(a.blind ? 'ta carte cachée gagne environ <strong>'+Math.round(a.est*100)+' %</strong> du temps'
      : 'ta main vaut environ <strong>'+(Math.round(a.est*10)/10)+'</strong> pli'+(a.est>=2?'s':''))+'. Conseil : annoncer <strong>'+a.best.b+'</strong>.'+(a.forbidden>=0 ? ' ('+a.forbidden+' est interdit pour toi.)' : '')
      + '<div class="coach-rows">'+a.rows.map(function(r){ return '<span class="'+(r.b===a.best.b?'best':'')+'">'+r.b+' → '+Math.round(r.p*100)+' % de réussite, '+(r.ev>=0?'+':'')+(Math.round(r.ev*10)/10)+' pts en moyenne</span>'; }).join('')+'</div></div>';
    return html;
  }
  if(!coachCache.busy){
    coachCache.busy = true;
    setTimeout(function(){
      try{ var gg = gameDoc; if(gg && coachActive(gg) && gg.status==='bidding'){ coachCache.bid = coachComputeBid(gg, myHand.cards); coachCache.key = key; } }
      catch(e){ console.error(e); }
      coachCache.busy = false; render();
    }, 30);
  }
  return '<div class="coach-box">🧠 Le coach réfléchit…</div>';
}
function coachPlayAdvice(g){
  if(!coachActive(g) || g.status!=='playing' || isBlindRound(g)) return null;
  var hand = myHand.cards;
  if(legalCards(g, hand).length < 2) return null;
  var card = botChooseCard(myId, g, hand); if(!card) return null;
  var trick = g.currentTrick || [], trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  var need = (g.bids[myId]||0) - (g.tricksWon[myId]||0), isLast = trick.length === g.playerOrder.length-1;
  var master = higherUnseen(card, botSeen(g, hand))===0;
  var plis = need+' pli'+(need>1?'s':'');
  var why;
  if(!trick.length){
    if(need>0) why = master ? 'Carte maîtresse : elle devrait faire le pli (il te faut encore '+plis+').' : 'Il te faut encore '+plis+' : ouvre avec une petite carte et garde tes grosses pour plus tard.';
    else why = 'Tu as ton compte : ouvre avec une carte qui a peu de chances de gagner.';
  } else {
    var led = trick[0].card.suit, wins = cardBeatsTrick(card, trick, led, trumpSuit);
    if(need>0) why = wins ? ('Il te faut encore '+plis+' : cette carte prend le pli'+(isLast ? ', au plus juste.' : (master ? ' et personne ne peut la battre.' : '.'))) : 'Tu ne peux pas prendre ce pli : débarrasse-toi d\'une petite carte.';
    else why = !wins ? 'Tu as ton compte : laisse passer ce pli en te débarrassant de ta carte la plus dangereuse.' : (isLast ? 'Toutes tes cartes gagnent : joue la plus forte pour t\'en débarrasser.' : 'Toutes tes cartes gagnent : joue la plus petite, quelqu\'un peut encore passer au-dessus.');
  }
  return { card: card, why: why };
}
function coachToggleHtml(g){
  if(!coachAllowedOf(g) || (g.status!=='bidding' && g.status!=='playing')) return '';
  return '<button class="btn ghost coach-toggle'+(coachOn?' on':'')+'" data-action="coach-toggle" aria-pressed="'+coachOn+'">🧠 Coach '+(coachOn?'activé':'désactivé')+'</button>';
}
// (v22) plus de coach pendant le jeu : voir la revue de fin de manche


/* ===================== v22 : le coach revoit TA manche, une fois qu'elle est finie =====================
   Aucune aide pendant le jeu. À la fin de la manche, il rejoue ta manche coup par coup (graine + cartes jouées)
   et la compare au robot Fort : ton annonce, puis les coups où tu as joué autrement, avec l'explication. */
var coachReviews = {};   // dealSeed -> { status:'busy'|'ready', data }
var coachOpen = {};      // dealSeed -> détail déplié
function coachWhy(g, id, hand, card){
  var trick = g.currentTrick || [], trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  var need = (g.bids[id]||0) - (g.tricksWon[id]||0), isLast = trick.length === g.playerOrder.length-1;
  var master = higherUnseen(card, botSeen(g, hand))===0, plis = need+' pli'+(need>1?'s':'');
  if(!trick.length){
    if(need>0) return master ? 'carte maîtresse : elle devait faire le pli (il te fallait encore '+plis+').' : 'il te fallait encore '+plis+' : ouvrir petit et garder les grosses cartes pour plus tard.';
    return 'tu avais ton compte : ouvrir avec une carte qui a peu de chances de gagner.';
  }
  var led = trick[0].card.suit, wins = cardBeatsTrick(card, trick, led, trumpSuit);
  if(need>0) return wins ? ('il te fallait encore '+plis+' : cette carte prenait le pli'+(isLast ? ', au plus juste.' : (master ? ' et personne ne pouvait la battre.' : '.'))) : 'tu ne pouvais pas prendre ce pli : se débarrasser d\'une petite carte.';
  if(!wins) return 'tu avais ton compte : laisser passer le pli en lâchant ta carte la plus dangereuse.';
  return isLast ? 'toutes tes cartes gagnaient : jouer la plus forte pour t\'en débarrasser.' : 'toutes tes cartes gagnaient : jouer la plus petite, quelqu\'un pouvait encore passer au-dessus.';
}
function computeCoachReview(g, log){
  var order = g.playerOrder, H = log.handSize, hands = dealCards(log.dealSeed, order, H).hands;
  var blind = H===1 && !(g.settings && g.settings.blindOne===false);
  var st = { code:g.code, playerOrder:order, roundPlan:[H], round:0, settings:{ blindOne:blind, scoring:getScoring(g), maxZeros:maxZerosOf(g) },
             dealSeed:log.dealSeed, trumpCard:log.trump||null, bids:{}, tricksWon:{}, currentTrick:[], trickNumber:0, played:[], roundLog:(g.roundLog||[]).slice(0, (g.roundLog||[]).indexOf(log)),
             bidOrder:log.bidOrder, leadPlayerId:log.bidOrder[0] };
  order.forEach(function(id){ st.bids[id] = null; st.tricksWon[id] = 0; });
  // 1) l'annonce, avec ce que tu savais à ce moment-là (les annonces faites avant toi)
  log.bidOrder.slice(0, log.bidOrder.indexOf(myId)).forEach(function(id){ st.bids[id] = log.bids[id]; });
  var bidAdv = coachComputeBid(st, hands[myId]);
  // 2) le jeu, carte par carte
  order.forEach(function(id){ st.bids[id] = log.bids[id]; });
  var rem = {}; order.forEach(function(id){ rem[id] = hands[id].slice(); });
  var lead = log.bidOrder[0], k = 0, trumpSuit = st.trumpCard ? st.trumpCard.suit : null, decisions = 0, same = 0, diffs = [];
  for(var t=0; t<H; t++){
    st.currentTrick = []; st.trickNumber = t;
    var o = trickOrderFrom(st, lead);
    for(var q=0; q<o.length; q++){
      var id = o[q], card = log.played[k++], hand = rem[id];
      var idx = hand.findIndex(function(c){ return c.suit===card.suit && c.rank===card.rank; });
      if(idx<0) throw new Error('manche incohérente');
      if(id===myId && !blind && legalCards(st, hand).length >= 2){
        decisions++;
        var best = botChooseCard(id, st, hand);
        if(best.suit===card.suit && best.rank===card.rank) same++;
        else diffs.push({ trick:t+1, played:card, best:best, why: coachWhy(st, id, hand, best) });
      }
      hand.splice(idx, 1);
      st.currentTrick.push({ playerId:id, card:card }); st.played.push(card);
    }
    var w = trickWinner(st.currentTrick, st.currentTrick[0].card.suit, trumpSuit);
    st.tricksWon[w]++; lead = w;
  }
  return { bid: log.bids[myId], won: log.tricksWon[myId], adv: bidAdv, decisions: decisions, same: same, diffs: diffs, blind: blind, round: log.round };
}
function coachReviewHtml(g, log){
  if(!log || !log.dealSeed || !Array.isArray(log.played) || !g.players[myId] || g.players[myId].isBot) return '';
  var key = log.dealSeed, rv = coachReviews[key];
  if(!rv){
    coachReviews[key] = { status:'busy' };
    setTimeout(function(){
      try{ coachReviews[key] = { status:'ready', data: computeCoachReview(g, log) }; }
      catch(e){ console.error(e); coachReviews[key] = { status:'error' }; }
      render();
    }, 60);
    rv = coachReviews[key];
  }
  if(rv.status==='busy') return '<div class="coach-box">🧠 Le coach revoit ta manche…</div>';
  if(rv.status!=='ready') return '';
  var d = rv.data, a = d.adv, okBid = d.bid===d.won;
  var html = '<div class="coach-box"><strong>🧠 Le coach · ta manche '+(d.round+1)+'</strong>';
  // annonce
  var bestB = a && a.best ? a.best.b : null;
  html += '<div style="margin-top:6px;">Tu as annoncé <strong>'+d.bid+'</strong> et fait <strong>'+d.won+'</strong> ('+(okBid?'<span class="pts-pos">réussi</span>':'<span class="pts-neg">raté</span>')+'). ';
  if(bestB===null) html += '';
  else if(bestB===d.bid) html += 'Le coach aurait annoncé pareil 👍';
  else {
    var mine = a.rows.filter(function(r){ return r.b===d.bid; })[0];
    html += 'Le coach aurait annoncé <strong>'+bestB+'</strong> ('+Math.round(a.best.p*100)+' % de réussite'+(mine ? ', contre '+Math.round(mine.p*100)+' % pour ton '+d.bid : '')+')'
      + (a.blind ? ', ta carte cachée gagnait environ '+Math.round(a.est*100)+' % du temps.' : ', ta main valait environ '+(Math.round(a.est*10)/10)+' pli'+(a.est>=2?'s':'')+'.');
  }
  html += '</div>';
  // jeu
  if(d.decisions){
    html += '<div style="margin-top:6px;">'+(d.diffs.length ? ('Sur '+d.decisions+' coup'+(d.decisions>1?'s':'')+' où tu avais le choix, '+d.same+' comme le coach.') : 'Tu as joué exactement comme le coach 🎯')+'</div>';
    if(d.diffs.length){
      var open = !!coachOpen[key];
      html += '<button class="btn ghost" style="font-size:12.5px; padding:4px 8px; margin-top:4px;" data-action="coach-detail" data-seed="'+esc(key)+'">'+(open?'Masquer le détail':(d.diffs.length>1 ? 'Voir les '+d.diffs.length+' coups différents' : 'Voir le coup différent'))+'</button>';
      if(open){
        html += '<div class="coach-rows" style="gap:8px;">'+d.diffs.map(function(x){
          return '<div class="coach-diff"><span class="muted">Pli '+x.trick+'</span> tu as joué '+cardHtml(x.played,{mini:true})+' le coach : '+cardHtml(x.best,{mini:true})+'<div style="flex-basis:100%; font-size:12.5px;">→ '+esc(x.why)+'</div></div>';
        }).join('')+'</div>';
      }
    }
  } else if(d.blind){
    html += '<div style="margin-top:6px;" class="muted">Manche à l\'aveugle : seule l\'annonce comptait.</div>';
  }
  html += '</div>';
  return html;
}
function coachReviewsListHtml(g){
  var logs = (g.roundLog||[]).filter(function(l){ var r = coachReviews[l.dealSeed]; return r && r.status==='ready'; });
  if(!logs.length) return '';
  return '<h3 style="margin:18px 0 6px;">🧠 Tes manches revues par le coach</h3>' + logs.slice().reverse().map(function(l){ return coachReviewHtml(g, l); }).join('');
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="coach-detail"]') : null; if(!el) return;
  var k = el.getAttribute('data-seed'); coachOpen[k] = !coachOpen[k]; render();
});

