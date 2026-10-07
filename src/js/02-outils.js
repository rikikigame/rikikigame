/* ===================== utils ===================== */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function seedFromString(s){ var seed=0; for(var i=0;i<s.length;i++){ seed=(seed*31 + s.charCodeAt(i)) >>> 0; } return seed; }
function rngFromSeed(s){ return mulberry32(seedFromString(String(s))); }
function buildDeck(){ var d=[]; SUITS.forEach(function(s){ RANKS.forEach(function(r){ d.push({suit:s, rank:r, value:RANK_VALUE[r]}); }); }); return d; }
function shuffle(arr, rng){ for(var i=arr.length-1;i>0;i--){ var j=Math.floor(rng()*(i+1)); var tmp=arr[i]; arr[i]=arr[j]; arr[j]=tmp; } return arr; }
function dealCards(dealSeed, order, handSize){
  var deck = shuffle(buildDeck(), rngFromSeed(dealSeed));
  var hands = {}; order.forEach(function(id){ hands[id]=[]; });
  var idx=0;
  for(var r=0;r<handSize;r++){ for(var k=0;k<order.length;k++){ hands[order[k]].push(deck[idx++]); } }
  var trumpCard = idx < deck.length ? deck[idx] : null;
  return { hands: hands, trumpCard: trumpCard };
}
// Règle maison : on ne peut pas annoncer 0 plus de N fois de suite (N = 3 par défaut, 0 = pas de limite)
function maxZerosOf(g){ return (g && g.settings && g.settings.direction==='quick') ? 0 : 3; } // règle officielle ; pas en partie rapide (v42, choix du propriétaire)
function zeroStreakIn(log, id){ var n = 0; for(var i=(log||[]).length-1; i>=0; i--){ if(log[i] && log[i].bids && log[i].bids[id]===0) n++; else break; } return n; }
function zeroBanned(g, id){ var mz = maxZerosOf(g); return !!mz && zeroStreakIn(g.roundLog, id) >= mz; }
// annonces permises pour ce joueur maintenant (total interdit pour le dernier + règle des zéros)
function allowedBids(g, id){
  var H = g.roundPlan[g.round], bo = g.bidOrder || [], forbidden = -1;
  if(bo.indexOf(id)===bo.length-1){ var so=0; bo.slice(0,-1).forEach(function(x){ so += (g.bids[x]||0); }); forbidden = H - so; }
  var all = []; for(var v=0; v<=H; v++) if(v!==forbidden) all.push(v);
  if(zeroBanned(g, id)){ var nz = all.filter(function(v){ return v!==0; }); if(nz.length) return nz; } // si plus rien d'autre n'est possible, le zéro reste permis
  return all;
}
function computeRoundPlan(n, startSize, direction){
  var plan=[];
  var k, m;
  if(direction==='quick'){ // partie rapide : 5 manches, nombre de cartes tiré au hasard (différent à chaque manche si possible)
    var pool=[]; for(k=1;k<=startSize;k++) pool.push(k);
    for(k=0;k<5;k++){
      if(!pool.length){ for(m=1;m<=startSize;m++) pool.push(m); }
      plan.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    }
    return plan;
  }
  if(direction==='up' || direction==='updown'){
    for(k=1;k<=startSize;k++) plan.push(k);
    if(direction==='updown'){ for(m=startSize-1;m>=1;m--) plan.push(m); }
    return plan;
  }
  for(k=startSize;k>=1;k--) plan.push(k);
  if(direction==='pyramid'){ for(m=2;m<=startSize;m++) plan.push(m); }
  return plan;
}
function trickWinner(trick, ledSuit, trumpSuit){
  var best=null;
  trick.forEach(function(play){
    if(!best){ best=play; return; }
    var c=play.card, b=best.card;
    var cT = trumpSuit && c.suit===trumpSuit;
    var bT = trumpSuit && b.suit===trumpSuit;
    if(cT && !bT){ best=play; }
    else if(cT && bT){ if(c.value>b.value) best=play; }
    else if(!cT && !bT){
      if(c.suit===ledSuit && b.suit===ledSuit){ if(c.value>b.value) best=play; }
      else if(c.suit===ledSuit && b.suit!==ledSuit){ best=play; }
    }
  });
  return best ? best.playerId : null;
}
function cardBeatsTrick(card, trick, ledSuit, trumpSuit){
  var sim = trick.concat([{playerId:'__sim__', card:card}]);
  return trickWinner(sim, ledSuit, trumpSuit) === '__sim__';
}
// Manche à 1 carte "à l'aveugle" : on ne voit pas sa propre carte, mais on voit celles des autres.
function isBlindRound(g){
  if(!g || !g.roundPlan) return false;
  var blind = !(g.settings && g.settings.blindOne === false);
  return blind && g.roundPlan[g.round] === 1;
}
// Tout le monde peut recalculer la donne (seed déterministe) : on en déduit les cartes des autres.
function dealtHands(g){
  if(g && g.blindCards){ var h = {}; Object.keys(g.blindCards).forEach(function(id){ h[id] = [g.blindCards[id]]; }); return h; }
  if(g && !isSecretDeal(g)) return dealCards(g.dealSeed, g.playerOrder, g.roundPlan[g.round]).hands;
  var sd = g ? secretFor(g.dealSeed) : null; if(sd) return dealCards(sd, g.playerOrder, g.roundPlan[g.round]).hands;
  var out = {}; ((g && g.playerOrder) || []).forEach(function(id){ out[id] = dealtFor(g, id) || []; }); return out;
}
function playedThisTrick(g, id){
  var t = (g.currentTrick && g.currentTrick.length) ? g.currentTrick : ((g.lastTrick && g.lastTrick.cards) || []);
  return t.some(function(p){ return p.playerId===id; });
}
/* ---- barème des points (réglable par l'hôte) ---- */
// v42 : barèmes par défaut choisis par le propriétaire
var DEFAULT_SCORING = { bonus:10, perTrick:5, missFixed:0, missPerTrick:5 };        // vraies cartes
var ONLINE_DEFAULT_SCORING = { bonus:4, perTrick:4, missFixed:0, missPerTrick:2 };  // en ligne
var SCORING_FIELDS = [
  { key:'bonus',        label:'Bonus contrat réussi',        min:0, max:100 },
  { key:'perTrick',     label:'+ par pli (si réussi)',       min:0, max:50 },
  { key:'missFixed',    label:'Pénalité fixe si raté',       min:0, max:100 },
  { key:'missPerTrick', label:'Pénalité par pli d\'écart',   min:0, max:50 }
];
function getScoring(g){
  var s = (g && g.settings && g.settings.scoring) || {};
  var r = {};
  Object.keys(ONLINE_DEFAULT_SCORING).forEach(function(k){ r[k] = (typeof s[k]==='number' && isFinite(s[k])) ? s[k] : ONLINE_DEFAULT_SCORING[k]; });
  return r;
}
function scoreRound(sc, bid, won){
  if(bid===won) return sc.bonus + sc.perTrick*won;
  return -(sc.missFixed + sc.missPerTrick*Math.abs(bid-won));
}
function scoringSummary(sc){
  return 'Réussi : '+sc.bonus+' + '+sc.perTrick+' × plis · Raté : −'+(sc.missFixed?sc.missFixed+' − ':'')+sc.missPerTrick+' × écart';
}
function scoringExample(sc){
  var a = scoreRound(sc,2,2), b = scoreRound(sc,2,0);
  return 'Ex. : annonce 2, fait 2 → '+(a>0?'+':'')+a+' · annonce 2, fait 0 → '+(b>0?'+':'')+b;
}
var BOT_NAMES = ['Robot Léon','Robot Zoé','Robot Max','Robot Nina','Robot Théo','Robot Ana'];
var BOT_COLORS = ['#8B6F47','#5E7CE2','#C4544A','#3F8F6B','#B48A3D','#7A5FA0'];
