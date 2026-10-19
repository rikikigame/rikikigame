/* ===================== v74 : pire ennemi / victime préférée =====================
   « Contrat ruiné » : une manche où V rate son annonce parce qu'il a PERDU des plis (il en a fait moins que prévu)
   et où un autre joueur T (humain OU robot) est celui qui lui en a volé le plus (T gagne le pli, V était le 2e meilleur).
   Égalité entre deux voleurs = personne n'est accusé. Reconstitué depuis les cartes jouées (comme les coupes). */
var RIVAL_MIN_SHARED = 5; // parties jouées ensemble avant d'afficher un « pire ennemi » sur une fiche
var RIVALS_HISTORY = {"49KW_1790851103662":{"mullwg9wk8qw":{"mul5tnvlb5fa":4,"muo82azxw149":3,"mulmpz0lcgvx":4},"mul5tnvlb5fa":{"mulmpz0lcgvx":1,"muo82azxw149":1,"mullwg9wk8qw":1},"mulmpz0lcgvx":{"muo82azxw149":2,"mul5tnvlb5fa":2}},"6H47_1791717816430":{"muo82azxw149":{"mul5tnvlb5fa":2},"mulmpz0lcgvx":{"mv3qidur16zh":5},"mv3qidur16zh":{"mulmpz0lcgvx":1},"mul5tnvlb5fa":{"mv3qidur16zh":1,"muo82azxw149":2}},"9JWU_1791400833947":{"mulmpz0lcgvx":{"mullwg9wk8qw":1,"mus91lbcyzol":1,"muo82azxw149":2},"mus91lbcyzol":{"mulmpz0lcgvx":1},"mullwg9wk8qw":{"mulmpz0lcgvx":2,"mus91lbcyzol":1},"muo82azxw149":{"mullwg9wk8qw":3}},"9REB_1791451846914":{"mus91lbcyzol":{"mulmpz0lcgvx":3,"muo82azxw149":1},"mullwg9wk8qw":{"mulmpz0lcgvx":2,"muo82azxw149":2},"muo82azxw149":{"mus91lbcyzol":1}},"9REB_1791452951554":{"mullwg9wk8qw":{"mulmpz0lcgvx":2},"mus6yenkw9mg":{"muo82azxw149":1,"mus91lbcyzol":1},"mulmpz0lcgvx":{"muo82azxw149":1,"mus91lbcyzol":1,"mullwg9wk8qw":1},"mus91lbcyzol":{"mus6yenkw9mg":1,"muo82azxw149":1}},"AS3X_1791232068148":{"muo82azxw149":{"mullwg9wk8qw":1,"mul5tnvlb5fa":2,"mulmpz0lcgvx":1},"mulmpz0lcgvx":{"mullwg9wk8qw":1},"mullwg9wk8qw":{"mul5tnvlb5fa":1,"mulmpz0lcgvx":1},"mul5tnvlb5fa":{"mullwg9wk8qw":1}},"AWK4_1791287683570":{"muo82azxw149":{"mullwg9wk8qw":7,"mus91lbcyzol":1},"mullwg9wk8qw":{"muo82azxw149":2,"mus91lbcyzol":2},"mus91lbcyzol":{"mullwg9wk8qw":2,"muo82azxw149":1}},"D5Y6_1792057554534":{"muy6un9tpvqs":{"muo82azxw149":1},"muo82azxw149":{"mul5tnvlb5fa":2,"muy6un9tpvqs":1},"mullwg9wk8qw":{"muo82azxw149":1,"muy6un9tpvqs":1}},"EN8F_1791544970129":{"muo82azxw149":{"muzwnxfkhrnb":2,"mus91lbcyzol":1},"mullwg9wk8qw":{"mul5tnvlb5fa":1,"muo82azxw149":1,"muzwnxfkhrnb":1},"mul5tnvlb5fa":{"muzwnxfkhrnb":1,"mullwg9wk8qw":2},"muzwnxfkhrnb":{"mullwg9wk8qw":1},"mus91lbcyzol":{"mul5tnvlb5fa":1}},"FVZM_1791486386451":{"mul5tnvlb5fa":{"mus6yenkw9mg":1},"muo82azxw149":{"muzxdyfiai6d":2},"muzwnxfkhrnb":{"mulmpz0lcgvx":1},"mulmpz0lcgvx":{"muzwnxfkhrnb":1}},"G25V_1791229274505":{"muo82azxw149":{"mul5tnvlb5fa":1,"mus6yenkw9mg":1},"mulmpz0lcgvx":{"mul5tnvlb5fa":1,"muo82azxw149":1},"mullwg9wk8qw":{"mulmpz0lcgvx":1},"mul5tnvlb5fa":{"mulmpz0lcgvx":1,"muo82azxw149":1}},"GPDA_1791220833884":{"mullwg9wk8qw":{"mulmpz0lcgvx":3,"muo82azxw149":1},"muo82azxw149":{"mullwg9wk8qw":6,"mulmpz0lcgvx":3},"mulmpz0lcgvx":{"mullwg9wk8qw":2}},"JJTR_1791230585833":{"mulmpz0lcgvx":{"muo82azxw149":1,"mullwg9wk8qw":1,"mul5tnvlb5fa":1},"mullwg9wk8qw":{"muo82azxw149":1,"mul5tnvlb5fa":1},"mul5tnvlb5fa":{"muo82azxw149":1,"mullwg9wk8qw":1},"mus6yenkw9mg":{"mul5tnvlb5fa":1}},"LRF8_1791402654119":{"mus91lbcyzol":{"muo82azxw149":1,"mullwg9wk8qw":2},"mulmpz0lcgvx":{"muo82azxw149":1},"mullwg9wk8qw":{"mus91lbcyzol":1},"muo82azxw149":{"mulmpz0lcgvx":1}},"NSJF_1791903305588":{"mullwg9wk8qw":{"mus6yenkw9mg":1,"mus91lbcyzol":1},"mus6yenkw9mg":{"mv6tny12xktd":2},"mus91lbcyzol":{"mv6tny12xktd":1}},"NSJF_1791904506978":{"mulmpz0lcgvx":{"mullwg9wk8qw":2,"mus91lbcyzol":1},"mus6yenkw9mg":{"mus91lbcyzol":1,"mullwg9wk8qw":1},"muo82azxw149":{"mv6tny12xktd":1,"mullwg9wk8qw":1},"mullwg9wk8qw":{"mus6yenkw9mg":1,"muo82azxw149":1},"mv6tny12xktd":{"mus91lbcyzol":1}},"NSJF_1791905436299":{"mulmpz0lcgvx":{"mv6tny12xktd":1,"muo82azxw149":1},"mv6tny12xktd":{"mus6yenkw9mg":1,"mulmpz0lcgvx":1},"mus91lbcyzol":{"muo82azxw149":1}},"NSJF_1791906414084":{"mus6yenkw9mg":{"mv6tny12xktd":2,"mus91lbcyzol":1},"mus91lbcyzol":{"muo82azxw149":1,"mv6tny12xktd":1},"mullwg9wk8qw":{"muo82azxw149":1},"mv6tny12xktd":{"muo82azxw149":1},"muo82azxw149":{"mv6tny12xktd":1,"mulmpz0lcgvx":1}},"NSJF_1791907334672":{"mv6tny12xktd":{"mulmpz0lcgvx":1},"mus6yenkw9mg":{"mus91lbcyzol":1}},"NVG2_1792008054895":{"muo82azxw149":{"munzmoujhcka":2,"mulmpz0lcgvx":1},"munzmoujhcka":{"mulmpz0lcgvx":1,"mullwg9wk8qw":2,"muo82azxw149":1},"mus91lbcyzol":{"mullwg9wk8qw":2,"munzmoujhcka":1},"mullwg9wk8qw":{"muo82azxw149":2,"mulmpz0lcgvx":2,"mus91lbcyzol":1},"mulmpz0lcgvx":{"munzmoujhcka":1}},"NZVD_1791398831365":{"mulmpz0lcgvx":{"muo82azxw149":1,"mus91lbcyzol":1,"mullwg9wk8qw":1},"mullwg9wk8qw":{"mulmpz0lcgvx":4},"muo82azxw149":{"mullwg9wk8qw":1}},"PM9A_1791397328532":{"mulmpz0lcgvx":{"mus91lbcyzol":1,"mullwg9wk8qw":1},"muygkt0v6yfc":{"mus91lbcyzol":1,"mullwg9wk8qw":2},"muo82azxw149":{"mus91lbcyzol":1,"mulmpz0lcgvx":1},"mus91lbcyzol":{"muygkt0v6yfc":2},"mullwg9wk8qw":{"muygkt0v6yfc":2}},"QKYX_1791023752333":{"mullwg9wk8qw":{"mul5tnvlb5fa":3},"mul5tnvlb5fa":{"mus91lbcyzol":3,"mus6yenkw9mg":1},"mus6yenkw9mg":{"mus91lbcyzol":1,"mul5tnvlb5fa":1}},"RSE4_1790622175174":{"mullwg9wk8qw":{"mulm3599ra5u":1,"mul5tnvlb5fa":1},"mulm3599ra5u":{"mullwg9wk8qw":1},"mulmpz0lcgvx":{"mul5tnvlb5fa":2}},"S3HH_1791488624457":{"mullwg9wk8qw":{"mul5tnvlb5fa":2},"muzwnxfkhrnb":{"mullwg9wk8qw":1,"mul5tnvlb5fa":1},"mulmpz0lcgvx":{"mullwg9wk8qw":2},"muo82azxw149":{"mullwg9wk8qw":1}},"SG6Z_1791473356912":{"muo82azxw149":{"mul5tnvlb5fa":1,"mulmpz0lcgvx":3},"mulmpz0lcgvx":{"muo82azxw149":3,"mullwg9wk8qw":1},"mul5tnvlb5fa":{"mullwg9wk8qw":2,"muo82azxw149":1},"mullwg9wk8qw":{"mulmpz0lcgvx":2,"muo82azxw149":1}},"T6Z3_1792005816559":{"mus91lbcyzol":{"mullwg9wk8qw":1,"munzmoujhcka":1},"muu6gkr5fssv":{"munzmoujhcka":1},"mulmpz0lcgvx":{"munzmoujhcka":1,"mus91lbcyzol":1},"munzmoujhcka":{"mulmpz0lcgvx":1},"mullwg9wk8qw":{"munzmoujhcka":2}},"TUE9_1792351950104":{"mul5tnvlb5fa":{"mv0rejqdr8dw":2},"mulmpz0lcgvx":{"muy6un9tpvqs":1,"mul5tnvlb5fa":2},"muy6un9tpvqs":{"mulmpz0lcgvx":1,"mul5tnvlb5fa":1}},"TUWX_1791198886464":{"muo82azxw149":{"mus6yenkw9mg":2,"mul5tnvlb5fa":1},"mul5tnvlb5fa":{"muo82azxw149":3,"mus6yenkw9mg":1}},"TUWX_1791201128995":{"mul5tnvlb5fa":{"mus6yenkw9mg":1,"muo82azxw149":2},"muo82azxw149":{"mul5tnvlb5fa":3,"mus6yenkw9mg":3},"mus6yenkw9mg":{"mul5tnvlb5fa":2,"muo82azxw149":1}},"TUWX_1791203323756":{"mus6yenkw9mg":{"muo82azxw149":2},"mul5tnvlb5fa":{"muo82azxw149":3,"mus6yenkw9mg":1},"muo82azxw149":{"mus6yenkw9mg":1,"mul5tnvlb5fa":2}},"UL8X_1792354131185":{"mulmpz0lcgvx":{"mul5tnvlb5fa":2,"mv0rejqdr8dw":1,"muo82azxw149":1,"muy6un9tpvqs":1},"mul5tnvlb5fa":{"mulmpz0lcgvx":2},"muo82azxw149":{"muy6un9tpvqs":1,"mulmpz0lcgvx":1},"muy6un9tpvqs":{"mulmpz0lcgvx":1},"mv0rejqdr8dw":{"muy6un9tpvqs":1}},"UL8X_1792355227289":{"mul5tnvlb5fa":{"muy6un9tpvqs":2,"mv0rejqdr8dw":1}},"XAT6_1791484769464":{"muzwnxfkhrnb":{"muo82azxw149":1,"mul5tnvlb5fa":1,"mullwg9wk8qw":1},"muo82azxw149":{"mul5tnvlb5fa":1},"mullwg9wk8qw":{"muo82azxw149":2,"mulmpz0lcgvx":1,"muzwnxfkhrnb":1},"mul5tnvlb5fa":{"muo82azxw149":1},"mulmpz0lcgvx":{"mullwg9wk8qw":1}},"Y2VG_1791454147320":{"mullwg9wk8qw":{"muo82azxw149":1},"muo82azxw149":{"mulmpz0lcgvx":2,"mus91lbcyzol":1}},"Z85P_1791385316485":{"mulmpz0lcgvx":{"mullwg9wk8qw":4,"muo82azxw149":3},"mullwg9wk8qw":{"mulmpz0lcgvx":1,"muo82azxw149":2},"muo82azxw149":{"mulmpz0lcgvx":1}},"Z9CB_1792055949912":{"muy6un9tpvqs":{"muo82azxw149":1},"mullwg9wk8qw":{"muy6un9tpvqs":1,"mul5tnvlb5fa":1,"muo82azxw149":1},"mul5tnvlb5fa":{"muo82azxw149":3,"muy6un9tpvqs":1,"mullwg9wk8qw":1},"muo82azxw149":{"mul5tnvlb5fa":1,"mullwg9wk8qw":1}},"ZH9X_1791138257358":{"muu6gkpu2gv5":{"muo82azxw149":1,"mus6yenkw9mg":2,"munzmoujhcka":1},"munzmoujhcka":{"mus6yenkw9mg":1,"mus91lbcyzol":1},"mus6yenkw9mg":{"muu6gkr5fssv":2,"mus91lbcyzol":1},"muu6gkr5fssv":{"munzmoujhcka":1,"muo82azxw149":1},"muo82azxw149":{"muu6gkpu2gv5":1}},"ZXDD_1790875775080":{"mul5tnvlb5fa":{"muo82azxw149":1,"mulmpz0lcgvx":1},"mulmpz0lcgvx":{"mul5tnvlb5fa":1,"mullwg9wk8qw":1},"muo82azxw149":{"mulmpz0lcgvx":3,"mullwg9wk8qw":1},"mullwg9wk8qw":{"mulmpz0lcgvx":1}}};  // parties déjà jouées : { id de partie sans « o_ » : { id de membre sans « m_ » : { id du voleur sans « m_ » : n } } }

// roundLog -> { victimId : { thiefId : contrats ruinés } }
function rivalStatsFromLog(roundLog){
  var out = {};
  (roundLog||[]).forEach(function(r){
    var order = r.bidOrder || [], n = order.length, played = r.played || [], trump = r.trump && r.trump.suit ? r.trump.suit : null;
    if(n<2 || !played.length || played.length % n) return;
    var steals = {}, leader = order[0];
    for(var t=0; t*n<played.length; t++){
      var trick = played.slice(t*n, (t+1)*n), start = order.indexOf(leader), led = trick[0].suit;
      var plays = trick.map(function(card, k){ return { playerId: order[(start+k)%n], card: card }; });
      var winner = trickWinner(plays, led, trump);
      var second = trickWinner(plays.filter(function(p){ return p.playerId!==winner; }), led, trump);
      if(second){ steals[second] = steals[second] || {}; steals[second][winner] = (steals[second][winner]||0) + 1; }
      leader = winner;
    }
    order.forEach(function(v){
      if(!((r.tricksWon[v]||0) < (r.bids[v]||0)) || !steals[v]) return;
      var best = null, tie = false;
      Object.keys(steals[v]).forEach(function(w){
        if(best===null || steals[v][w]>steals[v][best]){ best = w; tie = false; } else if(steals[v][w]===steals[v][best]) tie = true;
      });
      if(best===null || tie) return;
      out[v] = out[v] || {}; out[v][best] = (out[v][best]||0) + 1;
    });
  });
  return out;
}

// Fin de partie : détail pour MOI (qui m'a ruiné, qui j'ai ruiné) ; les robots comptent
function rivalsHtml(g){
  var log = g.roundLog || [];
  if(!log.length || !g.players[myId]) return '';
  var st = rivalStatsFromLog(log);
  var tag = function(id){ var p = g.players[id]; return p ? (p.isBot ? '🤖 ' : '') + esc(p.name) : '?'; };
  var top = function(map){ var b = null; Object.keys(map||{}).forEach(function(k){ if(b===null || map[k]>map[b]) b = k; }); return b; };
  var mine = st[myId] || {}, enemy = top(mine), lines = [];
  if(enemy) lines.push('😈 <b>'+tag(enemy)+'</b> t\'a ruiné '+mine[enemy]+' contrat'+(mine[enemy]>1?'s':'')+' cette partie');
  var victims = {};
  Object.keys(st).forEach(function(v){ if(v!==myId && st[v][myId]) victims[v] = st[v][myId]; });
  var vic = top(victims);
  if(vic) lines.push('🎯 Tu as ruiné '+victims[vic]+' contrat'+(victims[vic]>1?'s':'')+' de <b>'+tag(vic)+'</b>');
  if(!lines.length) lines.push('🕊️ Personne ne t\'a vraiment ruiné cette partie.');
  return '<div class="card-panel rivals-panel" style="margin-top:14px;"><div class="eyebrow">Duels de la partie</div>'
    + lines.map(function(l){ return '<p class="rival-line">'+l+'</p>'; }).join('')
    + '<p class="muted" style="font-size:11.5px; margin:6px 0 0;">Contrat ruiné = tu rates ton annonce parce que cette personne t\'a pris le plus de plis.</p></div>';
}

// Fiche d'un joueur de la ligue : pire ennemi / victime préférée sur toutes ses parties (>= RIVAL_MIN_SHARED parties ensemble)
function rivalsOfMember(memberId){
  var ruinedBy = {}, ruined = {}, shared = {};
  (league.games||[]).forEach(function(g){
    var ids = (g.players||[]).map(function(p){ return p.memberId; });
    if(ids.indexOf(memberId)<0) return;
    ids.forEach(function(o){ if(o!==memberId) shared[o] = (shared[o]||0)+1; });
    var hist = RIVALS_HISTORY[String(g.id||'').replace(/^o_/,'')];
    (g.players||[]).forEach(function(p){
      var r = p.rivals || (hist && hist[String(p.origMemberId||p.memberId).replace(/^m_/,'')]) || null; if(!r) return;
      Object.keys(r).forEach(function(t){
        var tid = canonMember(t.indexOf('m_')===0 ? t : 'm_'+t);
        if(p.memberId===memberId) ruinedBy[tid] = (ruinedBy[tid]||0) + r[t];
        else if(tid===memberId) ruined[p.memberId] = (ruined[p.memberId]||0) + r[t];
      });
    });
  });
  function best(map){
    var b = null;
    Object.keys(map).forEach(function(k){
      if((shared[k]||0) < RIVAL_MIN_SHARED) return;
      var rate = map[k]/shared[k];
      if(!b || rate>b.rate) b = { id:k, n:map[k], games:shared[k], rate:rate };
    });
    return b;
  }
  return { enemy: best(ruinedBy), victim: best(ruined) };
}
function rivalCardHtml(memberId){
  var r = rivalsOfMember(memberId), one = function(x){ return x.toFixed(1).replace('.',','); };
  var nm = function(id){ var m = memberById(id); return m ? m.name : '?'; };
  var cells = '';
  if(r.enemy) cells += '<div><b>😈 '+esc(nm(r.enemy.id))+'</b><span>pire ennemi : t\'a ruiné '+r.enemy.n+' contrats en '+r.enemy.games+' parties ('+one(r.enemy.rate)+' par partie)</span></div>';
  if(r.victim) cells += '<div><b>🎯 '+esc(nm(r.victim.id))+'</b><span>victime préférée : ruiné '+r.victim.n+' fois en '+r.victim.games+' parties ('+one(r.victim.rate)+' par partie)</span></div>';
  return cells ? '<div class="lg-stats rival-card">'+cells+'</div>' : '';
}
