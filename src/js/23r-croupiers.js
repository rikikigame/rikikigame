/* ===================== 1.11.0 : les croupiers du Mini casino =====================
   Albert tient la table de poker, Fredo celle de blackjack, Colette la roulette. Leur portrait (paquet Casino noir, 06-cartes-casino.js)
   est affiché au-dessus de la table avec une bulle qui commente le moment du jeu. Animations en CSS seulement (respiration, fumée du cigare,
   reflet des lunettes), coupées si l'appareil demande moins d'animations. */
var CROUPIERS = { albert: { name: 'Albert', rank: 'K', suit: 'S' }, fredo: { name: 'Fredo', rank: 'J', suit: 'D' }, colette: { name: 'Colette', rank: 'Q', suit: 'H' } };
var croupierPics = {};
function croupierPic(who){
  if(!croupierPics[who]){ var c = CROUPIERS[who]; croupierPics[who] = 'url(\'' + casinoArt({ rank: c.rank, suit: c.suit }) + '\'), url(\'' + cafeUri(casinoWall()) + '\')'; }
  return croupierPics[who];
}
// line : texte de la bulle ; late : texte qui le remplace après « lateStyle » (la bille de la roulette qui s'arrête)
function croupierHtml(who, line, late, lateStyle){
  var c = CROUPIERS[who];
  var bubble = late ? '<span class="cr-now"'+(lateStyle ? lateStyle.replace('rlReveal', 'crHide') : '')+'>'+line+'</span><span class="cr-late"'+(lateStyle || '')+'>'+late+'</span>' : '<span>'+line+'</span>';
  return '<div class="croupier cr-'+who+'"><div class="cr-pic" style="background-image:'+croupierPic(who)+';" role="img" aria-label="'+c.name+', le croupier">'
    + (who === 'albert' ? '<i class="cr-smoke s1"></i><i class="cr-smoke s2"></i><i class="cr-smoke s3"></i>' : '<i class="cr-glint"></i>')
    + '</div><div class="cr-txt"><div class="cr-name">'+c.name+' · croupier</div><div class="cr-bubble">'+bubble+'</div></div></div>';
}

/* ---------- ce que disent les croupiers ---------- */
function albertLine(g, st){
  if(g.status === 'poker_end'){ var w = pkRanking(st)[0]; return 'Belle partie ! Bravo '+esc(pokerName(g, w))+'.'; }
  if(st.result){
    var pot = st.result.pots[0], who = pot ? pot.to.map(function(id){ return esc(pokerName(g, id)); }).join(' et ') : '';
    return who ? (pot.to.length > 1 ? who+' se partagent le pot.' : who+' remporte le pot'+(pot.name ? ' avec '+esc(pot.name) : '')+'.') : 'Main terminée.';
  }
  if(st.turn === myId) return 'À toi de parler. Check, suivre ou relancer ?';
  var names = { preflop: 'Cartes distribuées. Bonne chance à tous.', flop: 'Voici le flop.', turn: 'Voici la turn.', river: 'Et la river… dernière enchère.' };
  return names[st.street] || 'On joue.';
}
function fredoLine(g, st){
  if(g.status === 'blackjack_end') return 'C\'est fini pour ce soir. Merci d\'être passés !';
  if(st.result){
    if(st.result.dealerBj) return 'Blackjack pour la maison, désolé…';
    if(st.result.dealerBust) return 'Je saute à '+st.dealerTotal+' ! La maison paie.';
    return 'Je reste à '+st.dealerTotal+'.';
  }
  if(st.phase === 'insurance') return st.insWait.indexOf(myId) >= 0 ? 'Un as ! Tu veux t\'assurer ?' : 'Un as… on attend les assurances.';
  if(st.phase === 'bet') return st.placed[myId] ? 'Merci, on attend les autres.' : 'Faites vos mises !';
  if(st.turn === myId) return 'Carte ou pas carte ?';
  if(st.mode[myId] === 'bj') return 'Blackjack ! Joli.';
  var t = st.turn && g.players[st.turn];
  return t ? 'À '+esc(t.name)+' de jouer.' : 'Au tour de la maison.';
}
function coletteLine(g, st){
  if(g.status === 'roulette_end') return { line: 'La roulette ferme. Merci mes chéris !' };
  if(st.result){
    var r = st.result, txt = r.number+' '+({ red: 'rouge', black: 'noir', green: '— le zéro !' }[r.color])+(r.number === 0 ? '' : ', '+(r.number % 2 ? 'impair' : 'pair')+'.');
    var reveal = rlRevealStyle(st);
    return reveal ? { line: 'Rien ne va plus…', late: txt, lateStyle: reveal } : { line: txt };
  }
  return { line: st.placed[myId] ? 'Vos jeux sont faits. On attend les autres.' : 'Faites vos jeux, mes chéris !' };
}
function croupierFor(g){
  if(pokerOn(g) && g.poker) return croupierHtml('albert', albertLine(g, g.poker));
  if(bjOn(g) && g.bj) return croupierHtml('fredo', fredoLine(g, g.bj));
  if(rlOn(g) && g.rl){ var m = coletteLine(g, g.rl); return croupierHtml('colette', m.line, m.late, m.lateStyle); }
  return '';
}
