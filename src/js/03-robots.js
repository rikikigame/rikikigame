/* ===================== IA des bots (v14) =====================
   Honnête : un bot ne connaît que sa main, l'atout, les cartes déjà jouées dans la manche
   (g.played, publiques) et le pli en cours. Seule exception, voulue par la règle :
   à la manche à l'aveugle il voit les cartes des AUTRES (comme un joueur humain). */
var BOT_TUNE = { 2:{m:1.4,a:0.15}, 3:{m:1.25,a:0.06}, 4:{m:1.25,a:0}, 5:{m:1,a:0}, 6:{m:0.9,a:0}, 7:{m:0.75,a:0}, 8:{m:0.75,a:0} };
function cardKey(c){ return c.suit+c.rank; }
function botSeen(g, hand){
  var seen = {};
  (hand||[]).forEach(function(c){ seen[cardKey(c)] = 1; });
  (g.played||[]).forEach(function(c){ seen[cardKey(c)] = 1; });
  (g.currentTrick||[]).forEach(function(p){ seen[cardKey(p.card)] = 1; });
  if(g.trumpCard) seen[cardKey(g.trumpCard)] = 1;
  return seen;
}
// nombre de cartes plus fortes de la même couleur encore « dans la nature »
function higherUnseen(card, seen){
  var n = 0;
  for(var v = card.value+1; v <= 14; v++){ if(!seen[card.suit + RANKS[v-2]]) n++; }
  return n;
}
function trickOrderFrom(g, leaderId){
  var o = g.playerOrder, i = o.indexOf(leaderId);
  return o.slice(i).concat(o.slice(0, i));
}
function botBidFromEstimate(botId, g, est){
  var handSize = g.roundPlan[g.round];
  est = Math.max(0, Math.min(handSize, est));
  var allowed = allowedBids(g, botId);
  // l'annonce permise la plus proche de l'estimation (à égalité, du côté où penche l'estimation)
  return allowed.slice().sort(function(a,b){ var da = Math.abs(a-est), db = Math.abs(b-est); return (da-db) || (est < Math.round(est) ? a-b : b-a); })[0];
}
function botHeuristicEstimate(botId, g, hand){
  var handSize = g.roundPlan[g.round], n = g.playerOrder.length;
  var trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  var bySuit = {}; SUITS.forEach(function(s){ bySuit[s] = []; });
  hand.forEach(function(c){ bySuit[c.suit].push(c); });
  var crowd = Math.max(0.55, 1 - 0.07*(n-3)); // plus il y a de joueurs, plus une grosse carte se fait couper
  var est = 0;
  SUITS.forEach(function(s){
    var cards = bySuit[s].slice().sort(function(a,b){ return b.value-a.value; }), L = cards.length;
    if(!L) return;
    if(s === trumpSuit){
      cards.forEach(function(c, i){
        var p = c.value>=14 ? 1 : c.value>=13 ? 0.9 : c.value>=12 ? 0.72 : c.value>=11 ? 0.55 : c.value>=9 ? 0.4 : 0.25;
        if(i >= 2) p = Math.min(1, p + 0.2*(i-1)); // longueur à l'atout = plis de coupe
        est += p;
      });
    } else {
      var shortFactor = L<=2 ? 1 : (L<=3 ? 0.85 : 0.6); // couleur longue : les autres coupent plus vite
      cards.forEach(function(c, i){
        var p = 0;
        if(c.value===14) p = 0.9;
        else if(c.value===13) p = (L>=2 ? 0.6 : 0.35);
        else if(c.value===12 && i<=2 && L>=3) p = 0.3;
        est += p * shortFactor * crowd;
      });
    }
  });
  // courtes / absentes avec des atouts en réserve : chances de couper
  var trumps = trumpSuit ? bySuit[trumpSuit].length : 0;
  if(trumps >= 2){ SUITS.forEach(function(s){ if(s!==trumpSuit && bySuit[s].length===0) est += 0.3; }); }
  // calibrage obtenu par simulation (des milliers de manches) selon le nombre de joueurs
  var tn = BOT_TUNE[Math.max(2, Math.min(8, n))] || { m:1, a:0 };
  est = est * tn.m + tn.a * handSize;
  // tient compte des annonces déjà faites : si les autres ont beaucoup annoncé, il reste moins de plis
  var soFar = 0, count = 0; g.bidOrder.forEach(function(id){ if(g.bids[id]!=null){ soFar += g.bids[id]; count++; } });
  if(count){ var over = soFar + est - handSize * (count+1)/n; if(over > 0) est -= Math.min(0.5, over*0.25); }
  return est;
}

// Annonce « comme un bon joueur » : il imagine des centaines de répartitions possibles des cartes
// qu'il ne voit pas, joue la manche dans sa tête pour quelques annonces candidates,
// et garde celle qui rapporte le plus de points en moyenne avec le barème de la partie.
var BOT_ROLLOUTS = 90, BOT_BUDGET = 7000;
function botChooseBid(botId, g, hand){
  var handSize = g.roundPlan[g.round], n = g.playerOrder.length;
  var trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  if(isBlindRound(g)){
    // il ne voit pas sa carte : il calcule la probabilité exacte qu'une carte inconnue gagne
    var hands = dealtHands(g), seen = {};
    g.playerOrder.forEach(function(id){ if(id!==botId && hands[id] && hands[id][0]) seen[cardKey(hands[id][0])] = 1; });
    if(g.trumpCard) seen[cardKey(g.trumpCard)] = 1;
    var order = trickOrderFrom(g, g.leadPlayerId), wins = 0, total = 0;
    buildDeck().forEach(function(c){
      if(seen[cardKey(c)]) return;
      total++;
      var trick = order.map(function(id){ return { playerId:id, card: id===botId ? c : hands[id][0] }; });
      if(trickWinner(trick, trick[0].card.suit, trumpSuit) === botId) wins++;
    });
    return botBidFromEstimate(botId, g, total ? wins/total : 0);
  }
  var est = botHeuristicEstimate(botId, g, hand);
  var bo = g.bidOrder, forbidden = -1;
  if(bo.indexOf(botId)===bo.length-1){ var so=0; bo.slice(0,-1).forEach(function(id){ so += (g.bids[id]||0); }); forbidden = handSize - so; }
  var base = Math.max(0, Math.min(handSize, Math.round(est)));
  var okB = allowedBids(g, botId);
  var cands = {}; [base<=1 ? 0 : base-1, base-1, base, base+1].forEach(function(b){ if(b>=0 && b<=handSize && b!==forbidden && okB.indexOf(b)>=0) cands[b]=1; });
  if(!Object.keys(cands).length) okB.forEach(function(b){ cands[b]=1; });
  var list = Object.keys(cands).map(Number);
  if(list.length<=1) return list.length ? list[0] : botBidFromEstimate(botId, g, est);
  var sc = getScoring(g), total = {}; list.forEach(function(b){ total[b]=0; });
  var mine = {}; hand.forEach(function(c){ mine[cardKey(c)]=1; });
  var pool = buildDeck().filter(function(c){ return !mine[cardKey(c)] && !(g.trumpCard && cardKey(c)===cardKey(g.trumpCard)); });
  var others = g.playerOrder.filter(function(id){ return id!==botId; });
  // budget de calcul fixe (~0,1 s sur ordinateur, quelques dixièmes sur téléphone)
  var R = Math.max(14, Math.min(BOT_ROLLOUTS, Math.floor(BOT_BUDGET / (list.length * handSize * n))));
  for(var r=0; r<R; r++){
    var deck = pool.slice();
    for(var i=deck.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=deck[i]; deck[i]=deck[j]; deck[j]=t; }
    var hands = {}, k = 0; hands[botId] = hand.slice();
    others.forEach(function(id){ hands[id] = deck.slice(k, k+handSize); k += handSize; });
    list.forEach(function(b){ total[b] += scoreRound(sc, b, botRollout(botId, g, hands, b)); });
  }
  var best = list[0];
  list.forEach(function(b){ if(total[b] > total[best] + 1e-9 || (Math.abs(total[b]-total[best])<1e-9 && Math.abs(b-est) < Math.abs(best-est))) best = b; });
  return best;
}
// une manche jouée « dans la tête » du bot : tout le monde joue avec l'IA de jeu
function botRollout(botId, g, handsIn, myBid){
  var handSize = g.roundPlan[g.round];
  var hands = {}; Object.keys(handsIn).forEach(function(id){ hands[id] = handsIn[id].slice(); });
  var s = { playerOrder:g.playerOrder, roundPlan:[handSize], round:0, settings:{ blindOne:false }, trumpCard:g.trumpCard,
            bids:{}, tricksWon:{}, currentTrick:[], trickNumber:0, played:[], bidOrder:g.bidOrder };
  g.playerOrder.forEach(function(id){ s.tricksWon[id]=0; s.bids[id] = (g.bids[id]!=null) ? g.bids[id] : null; });
  s.bids[botId] = myBid;
  // les joueurs qui n'ont pas encore annoncé : estimation rapide sur leur main imaginée
  g.bidOrder.forEach(function(id){ if(s.bids[id]==null) s.bids[id] = botBidFromEstimate(id, s, botHeuristicEstimate(id, s, hands[id])); });
  var trumpSuit = g.trumpCard ? g.trumpCard.suit : null, lead = g.leadPlayerId;
  for(var t=0; t<handSize; t++){
    s.currentTrick = []; s.trickNumber = t;
    var o = trickOrderFrom(s, lead);
    for(var q=0; q<o.length; q++){
      var id = o[q], c = botChooseCard(id, s, hands[id]);
      hands[id] = hands[id].filter(function(x){ return x!==c; });
      s.currentTrick.push({ playerId:id, card:c });
    }
    var w = trickWinner(s.currentTrick, s.currentTrick[0].card.suit, trumpSuit);
    s.tricksWon[w]++; s.played = s.played.concat(s.currentTrick.map(function(p){ return p.card; })); lead = w;
  }
  return s.tricksWon[botId];
}
// v41 : un peu de hasard entre deux coups presque équivalents, pour que les robots soient moins prévisibles
// (coupé pendant l'analyse, qui compare les humains au robot Fort coup par coup)
var botJitter = true;
function pickNear(sorted){ return (botJitter && sorted.length > 1 && Math.random() < 0.3) ? sorted[1] : sorted[0]; }
function botChooseCard(botId, g, hand){
  if(!hand.length) return null;
  var trick = g.currentTrick || [], n = g.playerOrder.length;
  var trumpSuit = g.trumpCard ? g.trumpCard.suit : null;
  var ledSuit = trick.length ? trick[0].card.suit : null;
  var hasLed = ledSuit ? hand.some(function(c){ return c.suit===ledSuit; }) : false;
  var legal = (ledSuit && hasLed) ? hand.filter(function(c){ return c.suit===ledSuit; }) : hand.slice();
  if(legal.length===1) return legal[0];
  var asc = function(a,b){ return a.value-b.value; }, desc = function(a,b){ return b.value-a.value; };
  var isTrump = function(c){ return !!trumpSuit && c.suit===trumpSuit; };
  var seen = botSeen(g, hand);
  var isMaster = function(c){ return higherUnseen(c, seen)===0; };
  var handSize = g.roundPlan[g.round];
  var need = (g.bids[botId]||0) - (g.tricksWon[botId]||0);
  var left = handSize - (g.trickNumber||0);
  var wantWin = need > 0;
  var suitLen = {}; hand.forEach(function(c){ suitLen[c.suit] = (suitLen[c.suit]||0)+1; });

  // ---------- il ouvre le pli ----------
  if(!trick.length){
    var side = legal.filter(function(c){ return !isTrump(c); });
    if(wantWin){
      var sideMasters = side.filter(isMaster).sort(desc);
      var trumpMasters = legal.filter(function(c){ return isTrump(c) && isMaster(c); }).sort(desc);
      if(need >= left){ // il faut tout gagner : la carte la plus forte
        if(trumpMasters.length) return trumpMasters[0];
        if(sideMasters.length) return sideMasters[0];
        return legal.slice().sort(function(a,b){ return (isTrump(b)-isTrump(a)) || (b.value-a.value); })[0];
      }
      if(sideMasters.length) return sideMasters[0];          // un As (ou carte maîtresse) passe tout de suite
      if(trumpMasters.length && need >= 2) return trumpMasters[0];
      // sinon : petite carte d'une couleur courte pour se créer une coupe plus tard
      var pool = side.length ? side : legal;
      return pickNear(pool.slice().sort(function(a,b){ return (suitLen[a.suit]-suitLen[b.suit]) || (a.value-b.value); }));
    }
    // veut perdre : sa plus petite carte hors atout, dans la couleur où il a le plus de petites cartes
    var safe = (side.length ? side : legal).slice().sort(function(a,b){ return (higherUnseen(b,seen)-higherUnseen(a,seen)) || (a.value-b.value); });
    return pickNear(safe);
  }

  // ---------- il suit ----------
  var isLastToPlay = trick.length === n-1;
  var winners = legal.filter(function(c){ return cardBeatsTrick(c, trick, ledSuit, trumpSuit); });
  var losers = legal.filter(function(c){ return !cardBeatsTrick(c, trick, ledSuit, trumpSuit); });
  if(wantWin){
    // v41 : il ne coupe pas « pour rien » : si ses cartes maîtresses suffisent déjà à faire son contrat,
    // il garde ses atouts et se défausse (avant, il coupait tout ce qui passait et finissait souvent au-dessus)
    if(!hasLed && winners.length && winners.every(isTrump) && left > need){
      var sure = hand.filter(isMaster).length;
      var discard = losers.filter(function(c){ return !isTrump(c) && !isMaster(c); });
      if(sure >= need && discard.length) return discard.sort(function(a,b){ return (suitLen[a.suit]-suitLen[b.suit]) || (a.value-b.value); })[0];
    }
    if(winners.length){
      if(isLastToPlay) return winners.slice().sort(asc)[0];           // juste assez pour gagner
      var masterWin = winners.filter(isMaster).sort(asc);
      if(masterWin.length) return masterWin[0];                        // une carte que personne ne peut battre
      var trumpWin = winners.filter(isTrump).sort(asc);
      if(!hasLed && trumpWin.length) return trumpWin[0];               // coupe avec le plus petit atout suffisant
      return winners.slice().sort(desc)[0];                            // sinon la plus forte pour tenir
    }
    // ne peut pas gagner : se débarrasser de la plus petite carte, sans gâcher d'atout
    return losers.slice().sort(function(a,b){ return (isTrump(a)-isTrump(b)) || (suitLen[a.suit]-suitLen[b.suit]) || (a.value-b.value); })[0];
  }
  // veut perdre
  if(losers.length){
    // défausse la carte la plus dangereuse qui perd quand même (grosses cartes hors atout d'abord)
    return losers.slice().sort(function(a,b){ return (isTrump(a)-isTrump(b)) || (b.value-a.value); })[0];
  }
  // toutes ses cartes gagnent : dernier à jouer → il gagne de toute façon, il lâche la plus forte ;
  // sinon la plus petite, en espérant que quelqu'un passe par-dessus
  return isLastToPlay ? winners.slice().sort(desc)[0] : winners.slice().sort(asc)[0];
}

/* ===================== v42 : robot Fort qui réfléchit carte par carte =====================
   Pour chaque carte qu'il peut jouer, il imagine des répartitions possibles des cartes qu'il ne voit pas,
   termine la manche « dans sa tête » (tout le monde joue avec l'IA ci-dessus) et garde la carte qui rapporte
   le plus de points en moyenne. Il ne triche pas : il n'utilise que sa main, les cartes déjà jouées
   et les couleurs où un joueur a montré qu'il n'en avait plus (il n'a pas fourni). */
var BOT_SEARCH_BUDGET = 20000; // nombre de cartes jouées « dans la tête » par décision (~0,1 à 0,3 s sur téléphone)
// qui a joué quoi dans les plis déjà faits de la manche, et qui n'a plus quelle couleur
function roundHistory(g){
  var order = g.playerOrder, n = order.length, played = g.played || [], voids = {}, count = {};
  order.forEach(function(id){ voids[id] = {}; count[id] = 0; });
  var trump = g.trumpCard ? g.trumpCard.suit : null, lead = (g.bidOrder && g.bidOrder[0]) || order[0];
  var full = Math.floor(played.length / n), cur = g.currentTrick || [];
  for(var t=0; t<full; t++){
    var li = order.indexOf(lead), trick = [];
    for(var q=0; q<n; q++){ var id = order[(li+q)%n], c = played[t*n+q]; trick.push({ playerId:id, card:c }); count[id]++;
      if(q && c.suit!==trick[0].card.suit) voids[id][trick[0].card.suit] = 1; }
    lead = trickWinner(trick, trick[0].card.suit, trump);
  }
  cur.forEach(function(p, q){ count[p.playerId]++; if(q && p.card.suit!==cur[0].card.suit) voids[p.playerId][cur[0].card.suit] = 1; });
  return { voids: voids, count: count };
}
// une répartition possible des cartes cachées, compatible avec ce qu'on sait
function sampleHands(g, botId, hand, hist){
  var H = g.roundPlan[g.round], seen = botSeen(g, hand), pool = buildDeck().filter(function(c){ return !seen[cardKey(c)]; });
  var need = {}, others = g.playerOrder.filter(function(id){ return id!==botId; });
  others.forEach(function(id){ need[id] = Math.max(0, H - hist.count[id]); });
  for(var attempt=0; attempt<30; attempt++){
    for(var i=pool.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=pool[i]; pool[i]=pool[j]; pool[j]=t; }
    var hands = {}, left = Object.assign({}, need), ok = true, strict = attempt < 25;
    others.forEach(function(id){ hands[id] = []; });
    // on sert d'abord les cartes « difficiles » (peu de joueurs peuvent les avoir)
    var cards = pool.slice().sort(function(a,b){
      var ea = others.filter(function(id){ return !hist.voids[id][a.suit]; }).length, eb = others.filter(function(id){ return !hist.voids[id][b.suit]; }).length;
      return ea-eb; });
    var total = 0; others.forEach(function(id){ total += left[id]; });
    for(var k=0; k<cards.length && total>0; k++){
      var c = cards[k], el = others.filter(function(id){ return left[id]>0 && (!strict || !hist.voids[id][c.suit]); });
      if(!el.length){ if(strict) continue; ok = false; break; }
      var who = el[Math.floor(Math.random()*el.length)]; hands[who].push(c); left[who]--; total--;
    }
    if(ok && total===0){ hands[botId] = hand.slice(); return hands; }
  }
  return null;
}
// termine la manche à partir de l'état actuel ; renvoie le nombre de plis du robot
function finishRound(botId, g, handsIn, firstCard){
  var n = g.playerOrder.length, H = g.roundPlan[g.round], trump = g.trumpCard ? g.trumpCard.suit : null;
  var hands = {}; Object.keys(handsIn).forEach(function(id){ hands[id] = handsIn[id].slice(); });
  var s = { playerOrder:g.playerOrder, roundPlan:[H], round:0, settings:{ blindOne:false }, trumpCard:g.trumpCard, bidOrder:g.bidOrder,
            bids:Object.assign({}, g.bids), tricksWon:Object.assign({}, g.tricksWon), currentTrick:(g.currentTrick||[]).slice(),
            trickNumber:g.trickNumber||0, played:(g.played||[]).slice() };
  var play = function(id, c){ hands[id] = hands[id].filter(function(x){ return x!==c; }); s.currentTrick.push({ playerId:id, card:c }); s.played.push(c); };
  var order = g.playerOrder, turn = botId, first = true;
  while(s.trickNumber < H){
    while(s.currentTrick.length < n){
      var c = first ? firstCard : botChooseCard(turn, s, hands[turn]); first = false;
      if(!c) return s.tricksWon[botId];
      play(turn, c); turn = order[(order.indexOf(turn)+1)%n];
    }
    var w = trickWinner(s.currentTrick, s.currentTrick[0].card.suit, trump);
    s.tricksWon[w] = (s.tricksWon[w]||0)+1; s.trickNumber++; s.currentTrick = []; turn = w;
  }
  return s.tricksWon[botId];
}
function botSearchCard(botId, g, hand){
  var prevJ = botJitter;
  botJitter = false; // le Fort joue toujours son meilleur coup (pas de hasard), et imagine les autres sans fantaisie
  try{ return botSearchCardInner(botId, g, hand); } finally { botJitter = prevJ; }
}
function botSearchCardInner(botId, g, hand){
  var legal = legalCards(g, hand);
  if(legal.length < 2) return legal[0] || null;
  var base = botChooseCard(botId, g, hand);
  if(!g.bidOrder || g.bids[botId]==null) return base;
  var hist = roundHistory(g), sc = getScoring(g), n = g.playerOrder.length;
  var cardsLeft = (g.roundPlan[g.round] - (g.trickNumber||0)) * n;
  var R = Math.max(8, Math.min(60, Math.floor(BOT_SEARCH_BUDGET / (legal.length * Math.max(1, cardsLeft)))));
  var total = legal.map(function(){ return 0; }), done = 0;
  for(var r=0; r<R; r++){
    var hands = sampleHands(g, botId, hand, hist); if(!hands) continue;
    done++;
    legal.forEach(function(c, i){ total[i] += scoreRound(sc, g.bids[botId], finishRound(botId, g, hands, c)); });
  }
  if(!done) return base;
  // à égalité, on garde le choix de l'IA classique (souvent la carte la plus économe)
  var best = legal.indexOf(base) >= 0 ? legal.indexOf(base) : 0;
  total.forEach(function(v, i){ if(v > total[best] + 1e-9) best = i; });
  return legal[best];
}
function genCode(){ var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; var s=''; for(var i=0;i<4;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s; }
// v60 : échappe aussi les guillemets (sinon une valeur piégée placée dans un attribut HTML pouvait ajouter du code)
function esc(s){ var d=document.createElement('div'); d.textContent = (s==null?'':String(s)); return d.innerHTML.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
// v60 : une couleur venant d'un autre joueur n'est jamais injectée telle quelle dans le HTML
function safeColor(c){ return (typeof c==='string' && /^#[0-9a-fA-F]{3,8}$/.test(c)) ? c : '#8A93A6'; }
// v60 : une saison venant de la base ne doit ressembler qu'à 2026-T4 ou « all »
function safeSeason(k){ return (typeof k==='string' && /^(all|\d{4}(-T[1-4])?)$/.test(k)) ? k : ''; }
// Figures à la française : Roi, Dame, Valet (V, D, R dans les coins)
var RANK_LABEL = { J:'V', Q:'D', K:'R' }, RANK_NAME = { J:'Valet', Q:'Dame', K:'Roi', A:'As' };
function rankLabel(r){ return LANG==='en' ? r : (RANK_LABEL[r] || r); } // en anglais : J, Q, K
function rankName(r){ return RANK_NAME[r] || r; }

