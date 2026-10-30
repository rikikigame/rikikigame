/* ===================== 1.6.0 : « Vue table » (TEST) =====================
   Autre façon d'afficher la partie : les joueurs sont assis autour d'une table (toi en bas), chacun avec un avatar d'animal,
   sa carte du pli devant lui, ses annonces et son score. Même jeu, mêmes données : seul l'affichage change.
   Option dans ⚙️ Paramètres (« Vue table (test) »), éteinte par défaut, mémorisée sur l'appareil (rikiki_table_view).
   Appelée par renderTable (20-sons-et-musique.js) à la place du « rouleau » + tapis quand elle est activée. */
// 1.8.0 : activée d'office pour les NOUVEAUX joueurs (appareil sans aucune trace d'une visite précédente), plus simple à comprendre.
// Ceux qui jouent déjà gardent leur réglage actuel (éteinte tant qu'ils ne l'ont pas allumée). La décision est prise une seule fois puis mémorisée.
var tableViewOn = false;
try{
  var tvStored = localStorage.getItem('rikiki_table_view');
  if(tvStored === null){
    tvStored = DEVICE_IS_NEW ? '1' : '0';
    localStorage.setItem('rikiki_table_view', tvStored);
  }
  tableViewOn = tvStored === '1';
}catch(e){}
var TABLE_ANIMALS = ['🐼','🐵','🐷','🐔','🦊','🐸','🐯','🦁','🐨','🐰','🐶','🐱','🐮','🦄','🐙','🦉'];

// avatar stable : le même joueur garde le même animal sur tous les appareils (calculé depuis son nom)
function tableAvatar(id, p){
  if(p && p.isBot) return '🤖';
  var s = String((p && p.name) || id), h = 0;
  for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TABLE_ANIMALS[h % TABLE_ANIMALS.length];
}
// places autour de la table : la place 0 (moi) est en bas, puis dans le sens des aiguilles d'une montre
function tableSeatPositions(n){
  var out = [];
  for(var i = 0; i < n; i++){
    var a = (90 + i * 360 / n) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    var rx = n >= 6 ? 21 : 19, ry = n >= 6 ? 21 : 17; // à 6 joueurs ou plus, les cartes du pli sont posées plus loin du centre
    out.push({ x: +(50 + 41 * c).toFixed(1), y: +(50 + 40 * s).toFixed(1), cx: +(50 + rx * c).toFixed(1), cy: +(50 + ry * s).toFixed(1) });
  }
  return out;
}
function tableSeatOrder(g){
  var order = (g.playerOrder || []).filter(function(id){ return g.players && g.players[id]; });
  var me = order.indexOf(myId); if(me < 0) me = 0;
  return order.slice(me).concat(order.slice(0, me));
}
function tableViewHtml(g, ending, bidding, isMe, blind, blindHands, handSize){
  var seats = tableSeatOrder(g), pos = tableSeatPositions(seats.length);
  var showTrick = !ending && g.currentTrick && g.currentTrick.length > 0;
  var elapsed = g.lastTrick ? nowMs() - lastTrickAt(g) : 1e9;
  var showLast = g.lastTrick && (ending || (elapsed < LAST_TRICK_MS && !showTrick));
  var trickToShow = showTrick ? g.currentTrick : (showLast ? g.lastTrick.cards : []);
  var played = {}; trickToShow.forEach(function(pl){ played[pl.playerId] = pl; });

  var html = '<div class="table-view" role="group" aria-label="Table de jeu"><div class="tv-oval" aria-hidden="true"></div>';
  seats.forEach(function(id, i){
    var p = g.players[id], bid = g.bids ? g.bids[id] : null, won = g.tricksWon ? (g.tricksWon[id] || 0) : 0;
    var active = id === g.turnPlayerId && !ending, pt = pos[i], col = safeColor(p.color);
    var meta = bid == null ? 'annonce ?' : ('annonce ' + bid + ' · ' + won + ' pli' + (won > 1 ? 's' : ''));
    html += '<div class="tv-seat'+(active ? ' active' : '')+(id === myId ? ' me' : '')+'" style="left:'+pt.x+'%; top:'+pt.y+'%;">'
      + '<div class="tv-av" style="border-color:'+col+';">'+tableAvatar(id, p)+(g.dealerId === id ? '<span class="tv-dealer" title="Donneur">D</span>' : '')+'</div>'
      + '<div class="tv-nm">'+esc(p.name)+crownMark(id, p.name, p.uid)+afkTag(p)+'</div>'
      + '<div class="tv-mt">'+meta+'</div><div class="tv-sc" title="Score">'+(g.scores[id] || 0)+' pts</div>';
    if(blind && !playedThisTrick(g, id)){
      html += '<div class="tv-blind">'+(id === myId ? '<div class="card mini back"></div>' : (blindHands[id] && blindHands[id][0] ? cardHtml(blindHands[id][0], { mini:true }) : ''))+'</div>';
    }
    html += '</div>';
    var pl = played[id];
    if(pl){
      var win = showLast && g.lastTrick.winnerId === id;
      html += '<div class="tv-card'+(win ? ' win' : '')+'" style="left:'+pt.cx+'%; top:'+pt.cy+'%;">'+cardHtml(pl.card, { size: seats.length >= 6 ? 'tv-size-s' : 'tv-size' })+'</div>';
    }
  });
  html += '</div><div class="felt tv-felt">';
  if(bidding && isMe){
    html += renderBidPanel(g);
  } else if(showTrick){
    html += ledHint(g);
  } else if(showLast){
    html += '<div class="hint"><strong style="color:var(--navy);">'+esc(g.players[g.lastTrick.winnerId].name)+'</strong> remporte le pli</div>';
  } else if(bidding){
    var total = 0; Object.keys(g.bids || {}).forEach(function(k){ total += (g.bids[k] || 0); });
    html += '<div class="hint">Annonces en cours · <strong style="color:var(--navy);">'+total+'</strong> pli'+(total > 1 ? 's' : '')+' annoncé'+(total > 1 ? 's' : '')+' sur '+handSize+'</div>';
  } else {
    html += '<div class="hint">'+(isMe ? 'Ouvre le pli : choisis une carte' : 'En attente de la première carte')+'</div>';
  }
  return html + '</div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="table-view-toggle"]') : null; if(!el) return;
  tableViewOn = !tableViewOn; try{ localStorage.setItem('rikiki_table_view', tableViewOn ? '1' : '0'); }catch(err){}
  render();
});
