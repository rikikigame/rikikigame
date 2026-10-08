/* ===================== constants ===================== */
// Heure commune à tous les appareils : en ligne, on corrige l'horloge du téléphone avec celle du serveur Firebase
var prefillCode = '';
var APP_VERSION = '61';
var serverOffset = 0;
function nowMs(){ return Date.now() + serverOffset; }
// Moment où CET appareil a vu la fin d'un pli : les pauses (pli affiché, entracte entre manches)
// se chronomètrent à partir de là, quelle que soit l'heure du téléphone qui a joué la carte.
var seenTimes = {};
function lastTrickAt(g){
  if(!g || !g.lastTrick || !g.lastTrick.at) return 0;
  var k = (g.code||'')+'|'+g.dealSeed+'|'+g.lastTrick.at+'|'+g.lastTrick.winnerId;
  if(!(k in seenTimes)){
    // l'heure annoncée si elle est plausible (déjà passée, moins de 3 s), sinon l'instant où on la voit
    var now = nowMs(), stated = g.lastTrick.at;
    seenTimes[k] = (stated <= now && now - stated < 3000) ? stated : now;
  }
  return seenTimes[k];
}
var SUITS = ['S','H','D','C'];
var SUIT_SYMBOL = {S:'♠',H:'♥',D:'♦',C:'♣'};
var SUIT_NAME = {S:'Pique',H:'Cœur',D:'Carreau',C:'Trèfle'};
var RED_SUITS = {H:true, D:true};
// ordre d'affichage de la main : rouge / noir / rouge / noir (cœur, trèfle, carreau, pique) pour ne pas confondre les couleurs
// (ne pas toucher à SUITS : l'ordre du paquet sert à refaire et vérifier les donnes)
var HAND_SUIT_ORDER = ['H','C','D','S'];
// v42 : quand une couleur manque, on réordonne les couleurs présentes pour alterner rouge / noir dès que possible
// (ex. cœur, carreau, pique → cœur, pique, carreau) ; à égalité, l'ordre cœur, trèfle, carreau, pique
function handSuitOrder(cards){
  var present = HAND_SUIT_ORDER.filter(function(s){ return cards.some(function(c){ return c.suit===s; }); });
  var best = present, bestScore = -1;
  (function perm(done, rest){
    if(!rest.length){
      var sc = 0; for(var i=1;i<done.length;i++) if(!!RED_SUITS[done[i]] !== !!RED_SUITS[done[i-1]]) sc++;
      if(sc > bestScore){ bestScore = sc; best = done; } // les permutations arrivent dans l'ordre préféré : la 1re meilleure gagne
      return;
    }
    rest.forEach(function(s, i){ perm(done.concat([s]), rest.slice(0,i).concat(rest.slice(i+1))); });
  })([], present);
  return best;
}
var RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
var RANK_VALUE = {}; RANKS.forEach(function(r,i){ RANK_VALUE[r]=i+2; });
var MAX_PLAYERS = 8, MIN_PLAYERS = 2;
function seatAngles(n){
  var arr=[]; var step=360/n;
  for(var i=0;i<n;i++){ arr.push(90 - i*step); }
  return arr;
}

