/* ===================== v64 : jeu de cartes « Halloween » (dessins SVG générés dans le code) =====================
   Roi = Dracula, Valet = zombie-Frankenstein, Dame = momie (coiffure noire et visière façon Kikyo Zoldyck).
   Fond rouge sang et noir mystique, toiles d'araignée dans les 4 coins. La couleur des symboles et des accents change avec
   la couleur de la carte (palette au choix : voir HALLO_PAL). Les cartes à points restent classiques.
   Utilise cafeSym / CAFE_SUIT_PATH / qTiara du jeu Café Jacquet (fichier 06-cartes-cafe.js, chargé avant). */
var HALLO_PAL = {
  citrouille: { name:'Citrouille',   H:'#FF7A1A', D:'#FFC21A', S:'#A66BFF', C:'#5BE35B' }, // orange, jaune, violet, vert : 4 familles faciles à distinguer
  sang:       { name:'Sang & os',    H:'#E31B3C', D:'#FF6A3D', S:'#F2EAD8', C:'#9AA7B8' }, // rouge sang, rouge-orangé, ivoire, gris cendre
  poison:     { name:'Poison',       H:'#FF4FA3', D:'#B6FF3B', S:'#9B6BFF', C:'#3DE0FF' }  // rose néon, vert toxique, violet, cyan fantôme
};
var halloPal = 'citrouille';
var HALLO_DECK_NAME = 'Le Cimetière|d\'Albert'; // nom du paquet (dos des cartes + néon des Rois et Valets), choisi par sondage le 13/10/2026 : 5 votes sur 7 (« | » = retour à la ligne sur le dos)
try{ document.documentElement.style.setProperty('--hallo-back-name', HALLO_DECK_NAME ? '"'+HALLO_DECK_NAME.replace('|','\\A ')+'"' : 'none'); }catch(e){} // nom au dos (posé ici : applyDeckTheme peut s'exécuter avant que ce fichier soit chargé)
var HALLO_NEON = { K:HALLO_DECK_NAME.replace('|',' '), J:HALLO_DECK_NAME.replace('|',' '), Q:'Chez Monique' }; // texte néon des figures
// image d'une carte pour le thème Halloween (Roi, Dame, Valet, As de pique) ; null = carte classique
function halloArt(card){
  return card.rank==='K' ? cafeUri(halloKing(card.suit)) : card.rank==='J' ? cafeUri(halloJack(card.suit)) : card.rank==='Q' ? cafeUri(halloQueen(card.suit))
    : (card.suit==='S' && card.rank==='A') ? cafeUri(halloAceSpade()) : null;
}
// toile d'araignée seule dans un coin, pour le fond du jeu (CSS) : flipX / flipY pour les 4 coins
function halloWebCorner(flipX, flipY){
  var t = 'translate('+(flipX?200:0)+' '+(flipY?200:0)+') scale('+(flipX?-1:1)+' '+(flipY?-1:1)+')';
  return cafeUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g transform="'+t+' scale(3.6)"><path d="'+halloWebPath()+'" stroke="#E4DCEE" stroke-width="0.5" fill="none" stroke-linecap="round" opacity="0.5"/></g></svg>');
}
function halloCol(suit, pal){ return (HALLO_PAL[pal || halloPal] || HALLO_PAL.citrouille)[suit]; }


// ---- symboles des couleurs, version Halloween : cœur = cœur brisé, carreau = losange RIP + terre + fleur, trèfle = vrai ♣ à pointes de fourche, pique = tête de mort méchante au casque à pointes et cornes (idée du propriétaire) ----

// « RIP » gravé (trous dans la pierre) : lettres dessinées en tracé, x/y = coin haut-gauche, hauteur 18, largeur 40
function halloRipPath(x, y){
  var R = 'M'+x+' '+y+'h8a5 5 0 0 1 5 5v2a5 5 0 0 1-3.5 4.7L'+(x+14)+' '+(y+18)+'H'+(x+8.5)+'L'+(x+5)+' '+(y+12.5)+'V'+(y+18)+'H'+x+'zM'+(x+5)+' '+(y+4)+'v4h3a1 1 0 0 0 1-1V'+(y+5)+'a1 1 0 0 0-1-1z';
  var ix = x+18, I = 'M'+ix+' '+y+'h5v18h-5z';
  var px = x+27, P = 'M'+px+' '+y+'h8a5 5 0 0 1 5 5v2a5 5 0 0 1-5 5H'+(px+5)+'v6H'+px+'zM'+(px+5)+' '+(y+4)+'v4h3a1 1 0 0 0 1-1V'+(y+5)+'a1 1 0 0 0-1-1z';
  return R + I + P;
}
var HALLO_SYM = {
  H: '<path d="M50 90C50 90 8 62 8 34 8 19 19 8 32 8c8 0 14 4 18 11L43 32 55 45 45 60 54 76z"/><path transform="translate(3 2) rotate(4 70 50)" d="M50 90L54 76 45 60 55 45 43 32 50 19c4-7 10-11 18-11 13 0 24 11 24 26 0 28-42 56-42 56z"/>',
  D: '<path fill-rule="evenodd" d="M50 18L88 54 50 90 12 54z'+halloRipPath(30, 45)+'"/><path fill="#6B4423" d="M12 100C20 86 35 82 50 82S80 86 88 100z"/><path fill="#4A2E18" d="M28 95c3-3 7-3 10 0zM58 91c3-3 8-3 11 0zM42 98h14v2H42z"/><path d="M50 18V11" stroke="#3E7A2A" stroke-width="2" fill="none"/><path fill="#3E7A2A" d="M50 15c-4-1-6-3-6-5 3 0 5 2 6 5z"/><g fill="#FF7AB6"><circle cx="50" cy="4" r="2.7"/><circle cx="53.8" cy="6.8" r="2.7"/><circle cx="52.4" cy="11.2" r="2.7"/><circle cx="47.6" cy="11.2" r="2.7"/><circle cx="46.2" cy="6.8" r="2.7"/></g><circle cx="50" cy="8" r="2.1" fill="#FFD23F"/>',
  C: '<path fill-rule="evenodd" transform="translate(50 24)" d="M-18 -2C-18 -14-10 -20 0 -20S18 -14 18 -2C18 4 14 8 11 10V20H-11V10C-14 8-18 4-18 -2zM-13 -1a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM3 -1a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM0 6L-3.5 12H3.5zM-6 14h3v6h-3zM3 14h3v6h-3z"/><path fill-rule="evenodd" transform="translate(25 57)" d="M-18 -2C-18 -14-10 -20 0 -20S18 -14 18 -2C18 4 14 8 11 10V20H-11V10C-14 8-18 4-18 -2zM-13 -1a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM3 -1a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM0 6L-3.5 12H3.5zM-6 14h3v6h-3zM3 14h3v6h-3z"/><path fill-rule="evenodd" transform="translate(75 57)" d="M-18 -2C-18 -14-10 -20 0 -20S18 -14 18 -2C18 4 14 8 11 10V20H-11V10C-14 8-18 4-18 -2zM-13 -1a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM3 -1a5 5 0 1 0 10 0 5 5 0 1 0-10 0zM0 6L-3.5 12H3.5zM-6 14h3v6h-3zM3 14h3v6h-3z"/><path d="M44 66L37 98H63L56 66z"/>',
  S: '<path d="M50 0L58 26H42z"/><path d="M14 48C14 32 28 22 50 22S86 32 86 48z"/><path d="M8 48H92V54H8z"/>'
    + '<path fill-rule="evenodd" d="M22 58H78V70C78 76 74 80 68 82V98H32V82C26 80 22 76 22 70zM27 64L47 69 44 78 29 76zM73 64L53 69 56 78 71 76zM50 74L45 84H55zM36 88h3v10h-3zM43 88h3v10h-3zM54 88h3v10h-3zM61 88h3v10h-3z"/>'
};
function halloSym(suit, x, y, size, fill, stroke){ // même signature que cafeSym : dessin centré en (x, y)
  return '<g transform="translate('+(x-size/2)+' '+(y-size/2)+') scale('+(size/100)+')" fill="'+fill+'"'+(stroke ? ' stroke="'+stroke+'" stroke-width="'+(300/size)+'"' : '')+'>'+HALLO_SYM[suit]+'</g>';
}
function halloSymInline(suit){ // pour le texte (coins des cartes, accueil) : 1em × 1em, couleur par CSS (.hsym.hs-H …)
  return '<svg class="hsym hs-'+suit+'" viewBox="0 0 100 100" aria-hidden="true" fill="currentColor">'+HALLO_SYM[suit]+'</svg>';
}

// toile d'araignée dans le coin haut-gauche (0,0) : rayons + fils qui s'affaissent entre deux rayons
function halloWebPath(){
  var angles = [0, 22.5, 45, 67.5, 90].map(function(a){ return a*Math.PI/180; }), d = '', R = 54, i;
  angles.forEach(function(a){ d += 'M0 0L'+(R*Math.cos(a)).toFixed(1)+' '+(R*Math.sin(a)).toFixed(1); });
  [14, 26, 38, 50].forEach(function(r){
    for(i=0;i<angles.length;i++){
      var p = [r*Math.cos(angles[i]), r*Math.sin(angles[i])];
      if(i===0){ d += 'M'+p[0].toFixed(1)+' '+p[1].toFixed(1); continue; }
      var m = (angles[i-1]+angles[i])/2, c = [r*0.8*Math.cos(m), r*0.8*Math.sin(m)];
      d += 'Q'+c[0].toFixed(1)+' '+c[1].toFixed(1)+' '+p[0].toFixed(1)+' '+p[1].toFixed(1);
    }
  });
  return d;
}
function halloWebs(){
  var w = '<path d="'+halloWebPath()+'" stroke="#E4DCEE" stroke-width="0.7" fill="none" stroke-linecap="round" opacity="0.8"/>';
  return '<g>'+w+'</g><g transform="translate(140 0) scale(-1 1)">'+w+'</g><g transform="translate(0 196) scale(1 -1)">'+w+'</g><g transform="translate(140 196) scale(-1 -1)">'+w+'</g>'
    // petite araignée qui pend au coin haut-gauche
    + '<g stroke="#E4DCEE" stroke-width="0.6"><path d="M23 0V27"/></g><g transform="translate(23 29)" fill="#0A0206" stroke="#0A0206" stroke-width="0.9">'
    + '<circle r="2.6"/><circle cy="-3.2" r="1.7"/><path d="M-2 -1L-6 -4M-2 0L-7 0M-2 1L-6 4M2 -1L6 -4M2 0L7 0M2 1L6 4" fill="none" stroke-linecap="round"/><circle cx="-0.7" cy="-3.4" r="0.45" fill="#FF3B3B" stroke="none"/><circle cx="0.7" cy="-3.4" r="0.45" fill="#FF3B3B" stroke="none"/></g>';
}
// fond commun : rouge sang → noir, brume violette derrière la tête, chauves-souris, toiles ; le portrait (viewBox 200 × 240) est posé dessus
function halloFrame(suit, pal, defs, portrait){
  var c = halloCol(suit, pal);
  var bat = function(x, y, s, flip){ return '<path transform="translate('+x+' '+y+') scale('+(flip?-s:s)+' '+s+')" d="M0 0q3-5 7-1 2-3 4-3l1 5 1-5q2 0 4 3 4-4 7 1-4-1-6 2-3-2-6 2-3-4-6-2-2-3-6-2z" fill="#07020A" opacity="0.9"/>'; };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'+defs
    + '<radialGradient id="hBg" cx="50%" cy="44%" r="78%"><stop offset="0" stop-color="#7A1124"/><stop offset="0.5" stop-color="#37091A"/><stop offset="1" stop-color="#0A0206"/></radialGradient>'
    + '<radialGradient id="hMist" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9B4DFF" stop-opacity="0.45"/><stop offset="1" stop-color="#9B4DFF" stop-opacity="0"/></radialGradient>'
    + '<linearGradient id="hFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0A0206" stop-opacity="0"/><stop offset="1" stop-color="#0A0206" stop-opacity="0.95"/></linearGradient>'
    + '</defs><rect width="140" height="196" fill="url(#hBg)"/>'
    + '<ellipse cx="70" cy="76" rx="58" ry="60" fill="url(#hMist)"/>'
    + '<g opacity="0.16" transform="translate(70 88)">'+halloSym(suit, 0, 0, 96, c)+'</g>'
    + bat(96, 14, 0.9, false) + bat(14, 52, 0.7, true) + bat(106, 40, 0.55, false)
    + '<svg x="10" y="22" width="120" height="160" viewBox="0 0 200 240" preserveAspectRatio="xMidYMax meet">'+portrait+'</svg>'
    + '<rect y="150" width="140" height="46" fill="url(#hFloor)"/>'
    + halloWebs()
    + '<rect x="4.5" y="4.5" width="131" height="187" rx="9" fill="none" stroke="'+c+'" stroke-width="1.6" opacity="0.9"/>'
    + '<rect x="2.5" y="2.5" width="135" height="191" rx="10" fill="none" stroke="'+c+'" stroke-width="5" opacity="0.15"/></svg>';
}
function halloStitches(x1, x2, y, n){ // fil de couture : trait + petites croix
  var d = 'M'+x1+' '+y+'L'+x2+' '+y, step = (x2-x1)/n, i;
  for(i=0;i<=n;i++){ var x = x1 + i*step; d += 'M'+x.toFixed(1)+' '+(y-5)+'L'+x.toFixed(1)+' '+(y+5); }
  return d;
}
var HALLO_GOLD = '#E7B13B', HALLO_GOLD_D = '#6E4A12';
// couche « mur » des figures (comme cafeWall) : carte crème + niche en briques rouge sombre, toiles d'araignée et brume dans la niche.
// Le néon (texte HTML, police Sacramento) se pose entre le mur et le portrait ; voir .hallo-art dans le CSS.
function halloWall(){
  var web = '<path d="'+halloWebPath()+'" stroke="#E4DCEE" stroke-width="0.8" fill="none" stroke-linecap="round" opacity="0.85"/>';
  var bat = function(x, y, sc, flip){ return '<path transform="translate('+x+' '+y+') scale('+(flip?-sc:sc)+' '+sc+')" d="M0 0q3-5 7-1 2-3 4-3l1 5 1-5q2 0 4 3 4-4 7 1-4-1-6 2-3-2-6 2-3-4-6-2-2-3-6-2z" fill="#07020A" opacity="0.9"/>'; };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<pattern id="hBrick" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#6B1223"/><path d="M0 0.8H40M0 10H40M0 19.2H40M10 0V10M30 10V20" stroke="#2A060D" stroke-width="1.6"/></pattern>'
    + '<radialGradient id="hMist" cx="50%" cy="40%" r="55%"><stop offset="0" stop-color="#9B4DFF" stop-opacity="0.5"/><stop offset="1" stop-color="#9B4DFF" stop-opacity="0"/></radialGradient>'
    + '<clipPath id="hNiche"><rect x="30" y="22" width="80" height="152" rx="16"/></clipPath></defs>'
    + '<rect width="140" height="196" fill="#FBF4E6"/>'
    + '<rect x="30" y="22" width="80" height="152" rx="16" fill="url(#hBrick)"/><rect x="30" y="22" width="80" height="152" rx="16" fill="#12030A" opacity="0.5"/>'
    + '<g clip-path="url(#hNiche)"><ellipse cx="70" cy="78" rx="46" ry="52" fill="url(#hMist)"/>'
    + '<g transform="translate(30 22) scale(0.8)">'+web+'</g><g transform="translate(110 22) scale(-0.8 0.8)">'+web+'</g>'
    + '<g transform="translate(30 174) scale(0.8 -0.8)">'+web+'</g><g transform="translate(110 174) scale(-0.8 -0.8)">'+web+'</g>'
    + bat(66, 40, 0.8, false) + bat(40, 62, 0.55, true)
    + '</g><rect x="30" y="22" width="80" height="152" rx="16" fill="none" stroke="#0E0610" stroke-width="1.2" opacity="0.7"/></svg>';
}
// dos de carte : briques rouge sombre, toiles dans les coins ; le texte néon est posé par le CSS
function halloBack(){
  var web = '<path d="'+halloWebPath()+'" stroke="#E4DCEE" stroke-width="0.8" fill="none" stroke-linecap="round" opacity="0.8"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<pattern id="hBrickB" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#6B1223"/><path d="M0 0.8H40M0 10H40M0 19.2H40M10 0V10M30 10V20" stroke="#2A060D" stroke-width="1.6"/></pattern>'
    + '<radialGradient id="hBackMist" cx="50%" cy="50%" r="60%"><stop offset="0" stop-color="#9B4DFF" stop-opacity="0.35"/><stop offset="1" stop-color="#9B4DFF" stop-opacity="0"/></radialGradient></defs>'
    + '<rect width="140" height="196" fill="url(#hBrickB)"/><rect width="140" height="196" fill="#12030A" opacity="0.45"/><rect width="140" height="196" fill="url(#hBackMist)"/>'
    + '<g>'+web+'</g><g transform="translate(140 0) scale(-1 1)">'+web+'</g><g transform="translate(0 196) scale(1 -1)">'+web+'</g><g transform="translate(140 196) scale(-1 -1)">'+web+'</g>'
    + '</svg>';
}


// ROI : Dracula — cape noire doublée de la couleur de la carte, grand col pointu, yeux rouges, crocs, couronne
function halloKing(suit, pal){
  var c = halloCol(suit, pal);
  return cafeFaceFrame('', ''
    // cape + grand col
    + '<path d="M0 240C2 182 36 150 100 148s98 34 100 92z" fill="#12030A"/>'
    + '<path d="M26 240C28 196 44 168 74 156L86 196 70 240z" fill="'+c+'" opacity="0.85"/><path d="M174 240C172 196 156 168 126 156L114 196 130 240z" fill="'+c+'" opacity="0.85"/>'
    + '<path d="M34 214L24 118 76 154 84 200z" fill="#0C0207" stroke="'+c+'" stroke-width="2"/><path d="M166 214L176 118 124 154 116 200z" fill="#0C0207" stroke="'+c+'" stroke-width="2"/>'
    // plastron blanc + broche
    + '<path d="M72 176L100 240 128 176 114 160H86z" fill="#EDE6D4"/><path d="M100 176v64" stroke="#C9C0AA" stroke-width="2"/>'
    + '<path d="M86 160l14 12 14-12-6-6h-16z" fill="#0C0207"/>'
    + '<circle cx="100" cy="204" r="11" fill="'+HALLO_GOLD+'" stroke="'+HALLO_GOLD_D+'" stroke-width="2"/><circle cx="100" cy="204" r="7.5" fill="#12030A"/>'+halloSym(suit, 100, 204, 11, c)
    // cou + oreilles pointues
    + '<path d="M82 140h36v26l-18 12-18-12z" fill="#BFC2AE"/>'
    + '<path d="M56 96L34 78 58 118z" fill="#CBCDB8"/><path d="M144 96L166 78 142 118z" fill="#CBCDB8"/>'
    // visage pâle
    + '<path d="M54 92C54 54 76 40 100 40s46 14 46 52c0 36-18 64-46 72-28-8-46-36-46-72z" fill="#D3D5C0"/>'
    + '<path d="M54 100C58 132 76 156 100 164c-6-12-8-22-6-34-14 6-32-4-40-30z" fill="#A9AD96" opacity="0.55"/>'
    // cheveux plaqués, pointe de veuve
    + '<path d="M50 96C42 48 74 22 100 22s58 26 50 74c-6-26-20-36-38-38L100 78 88 58C70 60 56 70 50 96z" fill="#0B0A10"/>'
    + '<path d="M62 62C74 40 100 34 126 46" stroke="#3A3A4A" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    // couronne
    + '<path d="M68 36L74 8 88 24 100 2 112 24 126 8 132 36z" fill="'+HALLO_GOLD+'" stroke="'+HALLO_GOLD_D+'" stroke-width="2"/>'
    + '<circle cx="100" cy="24" r="5" fill="'+c+'" stroke="'+HALLO_GOLD_D+'" stroke-width="1.4"/><circle cx="76" cy="26" r="2.4" fill="#FFF1C4"/><circle cx="124" cy="26" r="2.4" fill="#FFF1C4"/>'
    // yeux rouges, sourcils pointus
    + '<path d="M62 86L94 96M138 86L106 96" stroke="#0B0A10" stroke-width="5" stroke-linecap="round"/>'
    + '<ellipse cx="80" cy="104" rx="11" ry="6" fill="#16060C" transform="rotate(10 80 104)"/><ellipse cx="120" cy="104" rx="11" ry="6" fill="#16060C" transform="rotate(-10 120 104)"/>'
    + '<circle cx="82" cy="104" r="4.2" fill="#FF2B2B"/><circle cx="118" cy="104" r="4.2" fill="#FF2B2B"/><circle cx="83" cy="103" r="1.3" fill="#FFD9D9"/><circle cx="119" cy="103" r="1.3" fill="#FFD9D9"/>'
    + '<path d="M100 108c-4 10-8 18-6 22 3 3 9 3 12 0" stroke="#8C8F7A" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    // bouche et crocs
    + '<path d="M78 138c12 14 32 14 44 0z" fill="#5B0C1C"/><path d="M79 138c13 7 29 7 42 0" stroke="#2A0610" stroke-width="2.4" fill="none"/>'
    + '<path d="M86 141l4 13 4-12zM106 142l4 12 4-13z" fill="#FFFFFF" stroke="#BDB8A8" stroke-width="0.8"/>'
    + '<path d="M113 155c3 5 5 8 1 10-3-2-3-6-1-10z" fill="#D41330"/>');
}

// VALET : zombie-Frankenstein — peau verte, crâne plat, points de suture, boulons, cravate de la couleur de la carte
function halloJack(suit, pal){
  var c = halloCol(suit, pal);
  return cafeFaceFrame('', ''
    + '<path d="M4 240C6 192 40 168 100 168s94 24 96 72z" fill="#1C1B24"/>'
    + '<path d="M70 170l30 62 30-62-12-8H82z" fill="#CFC8AE"/><path d="M82 162l18 18 18-18" stroke="#8A8368" stroke-width="2" fill="none"/>'
    + '<path d="M70 168L36 240h30l24-62zM130 168l34 72h-30l-24-62z" fill="#2A2933"/>'
    // cravate + écusson
    + '<path d="M94 176h12l6 14-12 40-12-40z" fill="'+c+'" stroke="#0A0206" stroke-width="1.6"/><path d="M92 174h16l-2 8H94z" fill="'+c+'" stroke="#0A0206" stroke-width="1.6"/>'
    + '<rect x="30" y="206" width="32" height="30" rx="5" fill="#15141C" stroke="'+c+'" stroke-width="2" stroke-dasharray="3 2"/>'+halloSym(suit, 46, 221, 18, c)
    // cou + boulons
    + '<path d="M80 140h40v32l-20 12-20-12z" fill="#7BA25E"/>'
    + '<g fill="#B8BCC8" stroke="#4A4E5C" stroke-width="1.6"><rect x="48" y="146" width="22" height="9" rx="3"/><rect x="130" y="146" width="22" height="9" rx="3"/></g>'
    + '<g fill="#8A8E9C" stroke="#4A4E5C" stroke-width="1.6"><rect x="40" y="143" width="8" height="15" rx="2"/><rect x="152" y="143" width="8" height="15" rx="2"/></g>'
    // grosse tête carrée
    + '<rect x="50" y="38" width="100" height="122" rx="16" fill="#8FB86E"/>'
    + '<path d="M50 120v28c0 8 6 12 14 12h72c8 0 14-4 14-12v-28c-10 10-24 14-50 14s-40-4-50-14z" fill="#6F9556" opacity="0.7"/>'
    + '<circle cx="128" cy="124" r="9" fill="#5E7F49" opacity="0.8"/><path d="M122 120l10 8M132 120l-10 8" stroke="#3E5630" stroke-width="1.6"/>'
    + '<path d="M50 96h-10a8 8 0 0 0-1 16h11z" fill="#7BA25E"/><path d="M150 96h10a8 8 0 0 1 1 16h-11z" fill="#7BA25E"/>'
    // cheveux plats
    + '<path d="M48 64V40c0-10 6-14 16-14h72c10 0 16 4 16 14v24l-10-8-12 8-14-10-12 10-12-10-14 10-12-8z" fill="#0D0D12"/>'
    + '<path d="M62 36h56" stroke="#3A3A48" stroke-width="2.4" stroke-linecap="round"/>'
    // suture sur le front, sourcil lourd
    + '<path d="'+halloStitches(62, 138, 74, 10)+'" stroke="#2B3A22" stroke-width="2" fill="none" stroke-linecap="round"/>'
    + '<path d="M58 90h38M106 86h36" stroke="#142010" stroke-width="7" stroke-linecap="round"/>'
    // yeux dépareillés
    + '<circle cx="78" cy="106" r="12" fill="#F3EFC8" stroke="#2B3A22" stroke-width="2"/><circle cx="80" cy="108" r="4.5" fill="#1A1A1A"/><circle cx="82" cy="106" r="1.4" fill="#FFFFFF"/>'
    + '<path d="M108 106c4-8 22-8 28 0-6 6-22 6-28 0z" fill="#F3EFC8" stroke="#2B3A22" stroke-width="2"/><circle cx="123" cy="106" r="3.4" fill="#1A1A1A"/><path d="M108 104c6-3 22-3 28 0" stroke="#2B3A22" stroke-width="3.5" fill="none"/>'
    + '<path d="M66 120c6 4 20 4 26 0M110 118c6 3 18 3 24 0" stroke="#4A6A3A" stroke-width="2.4" fill="none" opacity="0.7"/>'
    + '<path d="M96 112l-4 20h16l-4-20" stroke="#587A44" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="96" cy="134" r="1.8" fill="#2B3A22"/><circle cx="104" cy="134" r="1.8" fill="#2B3A22"/>'
    // bouche de travers, dents, bave
    + '<path d="M72 144L128 138" stroke="#2B3A22" stroke-width="4" stroke-linecap="round"/>'
    + '<path d="M80 143l2 8h6l1-8zM100 141l1 9h6l1-10z" fill="#EDE8C8" stroke="#2B3A22" stroke-width="1.2"/>'
    + '<path d="'+halloStitches(74, 126, 142, 8)+'" stroke="#2B3A22" stroke-width="1.2" fill="none" opacity="0.7"/>'
    + '<path d="M118 146c2 6 3 10 0 13-3-3-3-8 0-13z" fill="#A8D68A" opacity="0.8"/>');
}

// DAME : momie — cheveux noirs longs à frange droite, visière lumineuse (façon Kikyo), bandelettes, robe noire à col haut
function halloQueen(suit, pal){
  var c = halloCol(suit, pal);
  var band = function(d){ return '<path d="'+d+'" fill="#E6DABB" stroke="#9C8F6E" stroke-width="1.4"/>'; };
  return cafeFaceFrame('<radialGradient id="hLens" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="0.35" stop-color="'+c+'"/><stop offset="1" stop-color="#1A0A12"/></radialGradient>', ''
    // cheveux longs derrière
    + '<path d="M44 90C20 140 30 200 14 240h52l-4-96z" fill="#0A0810"/><path d="M156 90C180 140 170 200 186 240h-52l4-96z" fill="#0A0810"/>'
    + '<ellipse cx="100" cy="82" rx="58" ry="62" fill="#0A0810"/>'
    // robe noire, col haut, galon de la couleur
    + '<path d="M10 240C14 196 54 174 100 174s86 22 90 66z" fill="#100C16"/>'
    + '<path d="M70 158L62 196 100 214 138 196 130 158z" fill="#1A1420" stroke="'+c+'" stroke-width="2"/>'
    + '<path d="M62 196L100 214 138 196" stroke="'+c+'" stroke-width="3" fill="none"/>'
    // bandelettes sur la poitrine et les épaules
    + band('M38 224L96 190 110 204 52 240z') + band('M162 224L104 190 90 204 148 240z')
    + band('M20 226C44 206 70 196 90 196l-2 12C66 210 44 220 30 238z')
    + '<path d="M86 192L82 168" stroke="#9C8F6E" stroke-width="1.2"/>'
    + '<path d="M40 232c-10 4-16 10-18 18" stroke="#E6DABB" stroke-width="5" stroke-linecap="round" fill="none"/>'
    + '<circle cx="100" cy="206" r="9" fill="#100C16" stroke="'+HALLO_GOLD+'" stroke-width="2"/>'+halloSym(suit, 100, 206, 10, c)
    // cou emmailloté
    + '<path d="M80 138h40v28H80z" fill="#EFE3D0"/>'
    + band('M78 146L122 140 124 152 76 158z') + band('M78 158L122 152 122 162 80 168z')
    // visage ivoire
    + '<path d="M56 88c0-30 18-44 44-44s44 14 44 44c0 38-16 62-44 70-28-8-44-32-44-70z" fill="#F1E6D2"/>'
    + '<path d="M58 110C62 138 78 154 100 158c-4-8-4-16-2-24-14 4-30-4-40-24z" fill="#D8C9AE" opacity="0.5"/>'
    // bandelette en travers de la joue
    + band('M54 120L80 128 78 142 58 134z') + '<path d="M64 124l-1 7M72 126l-1 7" stroke="#9C8F6E" stroke-width="1.1"/>'
    + '<path d="M56 130c-6 5-8 12-6 20" stroke="#E6DABB" stroke-width="5" stroke-linecap="round" fill="none"/>'
    // frange droite
    + '<path d="M50 84C50 40 150 40 150 84v8h-8V74c-26-12-62-12-84 0v18h-8z" fill="#0A0810"/>'
    + '<path d="M64 62c22-10 50-10 72 0" stroke="#3A3248" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    // visière (lunettes de haute technologie) : barre noire, deux verres lumineux
    + '<rect x="50" y="86" width="100" height="26" rx="12" fill="#0A0A10" stroke="#3E3A4C" stroke-width="2"/>'
    + '<ellipse cx="78" cy="99" rx="17" ry="9" fill="url(#hLens)"/><ellipse cx="122" cy="99" rx="17" ry="9" fill="url(#hLens)"/>'
    + '<circle cx="72" cy="96" r="3" fill="#FFFFFF" opacity="0.9"/><circle cx="116" cy="96" r="3" fill="#FFFFFF" opacity="0.9"/>'
    + '<rect x="94" y="94" width="12" height="8" rx="3" fill="#1A1822" stroke="#3E3A4C" stroke-width="1.4"/>'
    + '<circle cx="54" cy="99" r="2.4" fill="'+c+'"/><circle cx="146" cy="99" r="2.4" fill="'+c+'"/>'
    + '<path d="M50 90l-10-10M150 90l10-10" stroke="#3E3A4C" stroke-width="3" stroke-linecap="round"/>'
    // nez, lèvres sombres
    + '<path d="M100 114c-3 8-5 12-3 15 2 2 6 2 8 0" stroke="#C7B292" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    + '<path d="M84 138c8-5 24-5 32 0-4 8-28 8-32 0z" fill="#5A1630"/><path d="M88 138c8-3 16-3 24 0" stroke="#8A2A4C" stroke-width="1.6" fill="none"/><path d="M96 141h8" stroke="#D86A90" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>'
    // diadème
    + qTiara(26));
}

// As de pique Halloween : la Faucheuse dans un grand pique doré, une faux de chaque côté, ruban « Qui coupe gagne »
// (même style noir et or que l'As de pique du Café Jacquet ; les yeux brillent de la couleur du pique de la palette)
function halloAceSpade(pal){
  var c = halloCol('S', pal);
  // faux : manche de 250 de long, lame en croissant qui regarde vers le centre ; inclinée de 33,7° pour que les deux se croisent en X derrière la Faucheuse
  var scythe = '<g transform="translate(176 250) rotate(-33.7)"><path d="M0 0V-250" stroke="#6E4A12" stroke-width="7.5" stroke-linecap="round"/><path d="M0 0V-250" stroke="url(#hGold)" stroke-width="4.5" stroke-linecap="round"/>'
    + '<g transform="translate(0 -250) scale(0.68) translate(0 250)"><path d="M0 -250C18 -276 52 -278 74 -254 78 -248 78 -242 76 -236 58 -252 34 -250 10 -224z" fill="url(#hGold)" stroke="#6E4A12" stroke-width="2.4" stroke-linejoin="round"/>'
    + '<path d="M8 -256C26 -270 50 -268 68 -252" stroke="#FFF1C4" stroke-width="2" fill="none" opacity="0.75" stroke-linecap="round"/></g>'
    + '<circle cx="0" cy="-60" r="4" fill="url(#hGold)" stroke="#6E4A12" stroke-width="1.2"/><circle cx="0" cy="-205" r="4" fill="url(#hGold)" stroke="#6E4A12" stroke-width="1.2"/></g>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<linearGradient id="hGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7DE92"/><stop offset="0.45" stop-color="#D9A84A"/><stop offset="1" stop-color="#9C6B1E"/></linearGradient>'
    + '<radialGradient id="hAceGlow" cx="50%" cy="38%" r="55%"><stop offset="0" stop-color="'+c+'" stop-opacity="0.35"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient>'
    + '</defs><rect width="140" height="196" fill="#111111"/>'
    + '<g opacity="0.5">'+halloWebs()+'</g>'
    + '<rect x="6" y="6" width="128" height="184" rx="9" fill="none" stroke="url(#hGold)" stroke-width="1.4"/>'
    + '<svg x="10" y="24" width="120" height="156" viewBox="0 0 200 260">'
    + '<path d="M100 8C100 8 22 72 22 128c0 30 22 48 50 42 14-3 22-12 26-22-2 24-10 44-24 60h52c-14-16-22-36-24-60 4 10 12 19 26 22 28 6 50-12 50-42C178 72 100 8 100 8z" fill="#0B0B0B" stroke="url(#hGold)" stroke-width="2.4"/>'
    + '<ellipse cx="100" cy="96" rx="64" ry="70" fill="url(#hAceGlow)"/>'
    + '<g>'+scythe+'</g><g transform="translate(200 0) scale(-1 1)">'+scythe+'</g>'
    + '<g transform="translate(100 172) scale(0.9) translate(-100 -172)"><path d="M58 168C56 136 62 104 70 82 76 56 86 38 100 34c14 4 24 22 30 48 8 22 14 54 12 86 0 18-8 28-18 34h-48c-10-6-18-16-18-34z" fill="#050505" stroke="url(#hGold)" stroke-width="2"/>'
    + '<path d="M74 168C76 150 78 134 82 120M126 168C124 150 122 134 118 120M100 158v52" stroke="#B8862B" stroke-width="1.3" fill="none" opacity="0.8"/>'
    + '<ellipse cx="100" cy="92" rx="25" ry="31" fill="#1A1A1E"/>'
    + '<path d="M80 86c0-16 9-26 20-26s20 10 20 26c0 10-3 18-8 24H88c-5-6-8-14-8-24z" fill="#EDE6D4"/>'
    + '<path d="M82 90c4-4 10-4 14 2l-2 10c-6 2-11-2-12-12zM118 90c-4-4-10-4-14 2l2 10c6 2 11-2 12-12z" fill="#0A0A0A"/>'
    + '<circle cx="90" cy="95" r="2.8" fill="'+c+'"/><circle cx="110" cy="95" r="2.8" fill="'+c+'"/><circle cx="90" cy="95" r="6" fill="'+c+'" opacity="0.28"/><circle cx="110" cy="95" r="6" fill="'+c+'" opacity="0.28"/>'
    + '<path d="M100 102l-4 8h8z" fill="#0A0A0A"/>'
    + '<path d="M88 112h24v10H88z" fill="#EDE6D4" stroke="#8A826E" stroke-width="1"/><path d="M92 112v10M96 112v10M100 112v10M104 112v10M108 112v10" stroke="#8A826E" stroke-width="1"/>'
    + '</g>'
    // bras et mains osseuses qui tiennent les manches des faux (devant les manches, hors du groupe réduit de la Faucheuse)
    + '<g id="hArmL"><path d="M82 128C72 120 66 108 63 96L75 90C79 101 85 110 94 117z" fill="#050505" stroke="url(#hGold)" stroke-width="1.5"/>'
    + '<g transform="translate(66 86) rotate(-34)"><rect x="-9" y="-8" width="18" height="16" rx="5" fill="#EDE6D4" stroke="#8A826E" stroke-width="1.1"/>'
    + '<path d="M-5.5 -8V8M-1.8 -8V8M1.9 -8V8M5.6 -8V8" stroke="#8A826E" stroke-width="0.9"/><path d="M-9 -2C-14 -4-15 3-10 4" fill="#EDE6D4" stroke="#8A826E" stroke-width="1.1"/>'
    + '<circle cx="-5.5" cy="-8" r="1.6" fill="#D9D1BC"/><circle cx="-1.8" cy="-8.4" r="1.6" fill="#D9D1BC"/><circle cx="1.9" cy="-8.4" r="1.6" fill="#D9D1BC"/><circle cx="5.6" cy="-8" r="1.6" fill="#D9D1BC"/></g></g>'
    + '<g transform="translate(200 0) scale(-1 1)"><use href="#hArmL"/></g>'
    + '<path d="M22 176c20 10 50 16 78 16s58-6 78-16l8 20c-22 12-56 20-86 20s-64-8-86-20z" fill="url(#hGold)" stroke="#6E4A12" stroke-width="1.2"/>'
    + '<path d="M22 176l-14 2 8 10-6 10 18-2M178 176l14 2-8 10 6 10-18-2" fill="#A8761C" stroke="#6E4A12" stroke-width="1.2"/>'
    + '<path id="hRib" d="M26 192c22 10 48 14 74 14s52-4 74-14" fill="none"/>'
    + '<text font-family="Arial Black, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="12" fill="#2A1A06"><textPath href="#hRib" startOffset="50%" text-anchor="middle" textLength="128" lengthAdjust="spacingAndGlyphs">QUI COUPE GAGNE</textPath></text>'
    + '</svg></svg>';
}

// ---- fond animé du thème Halloween : chauves-souris qui volent, citrouilles et chauves-souris qui tombent (CSS, voir #hallo-fx) ----
function halloPumpkinSvg(){
  return cafeUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 60"><ellipse cx="32" cy="36" rx="26" ry="21" fill="#FF7A1A"/>'
    + '<ellipse cx="19" cy="36" rx="12" ry="21" fill="#D9570A" opacity="0.65"/><ellipse cx="45" cy="36" rx="12" ry="21" fill="#D9570A" opacity="0.65"/><ellipse cx="32" cy="36" rx="9" ry="21" fill="#FF9440"/>'
    + '<path d="M29 17c0-6 3-9 8-10l1 4c-3 1-5 3-5 6z" fill="#3E7A2A"/>'
    + '<path d="M17 31h9l-4.5-9zM38 31h9l-4.5-9z" fill="#FFE066"/><path d="M19 42q13 10 26 0l-3-3-4 3-6-4-6 4-4-3z" fill="#FFE066"/></svg>');
}
function halloBatSvg(){
  return cafeUri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 28"><path d="M32 6c2 0 3 2 4 4 3-2 6-8 11-9 8-1 14 6 17 13-4-3-7-3-10 0-3-2-6-2-9 1-2-2-4-2-6 2-2-3-3-2-4 1-2-3-4-3-6-1-3-3-6-3-9-1-3-3-6-3-10 0 3-7 9-14 17-13 5 1 8 7 11 9 1-2 2-4 4-4z" fill="#2B0F3A" stroke="#A66BFF" stroke-width="1.2" stroke-linejoin="round"/>'
    + '<circle cx="29" cy="9" r="1.1" fill="#FF4040"/><circle cx="35" cy="9" r="1.1" fill="#FF4040"/></svg>');
}
// couche fixe, par-dessus le jeu mais sans jamais gêner (pointer-events: none) ; coupée si le téléphone demande « réduire les animations »
function halloFx(on){
  var el = document.getElementById('hallo-fx');
  if(!on){ if(el) el.remove(); return; }
  if(el || !document.body) return;
  var items = [ // [type, haut/gauche en vw ou vh, taille px, durée s, décalage s, déplacement latéral vw]
    ['fly', 9, 46, 24, -2], ['fly', 33, 38, 31, -14], ['fly', 62, 42, 27, -20],
    ['fall', 10, 30, 19, -4, 6], ['fall', 46, 36, 24, -13, -8], ['fall', 82, 28, 21, -8, 5],
    ['fallbat', 28, 34, 16, -6, 10], ['fallbat', 70, 30, 20, -12, -9]
  ];
  var h = '<div id="hallo-fx" aria-hidden="true">';
  items.forEach(function(it){
    var kind = it[0], st = 'width:'+it[2]+'px;height:'+Math.round(it[2]*(kind==='fall'?0.94:0.44))+'px;animation-duration:'+it[3]+'s;animation-delay:'+it[4]+'s;';
    if(kind==='fly') h += '<i class="hfx-fly" style="top:'+it[1]+'vh;'+st+'"><b class="hfx-bat"></b></i>';
    else h += '<i class="hfx-'+(kind==='fall'?'fall':'fallbat')+'" style="left:'+it[1]+'vw;--dx:'+it[5]+'vw;'+st+'"><b class="'+(kind==='fall'?'hfx-pum':'hfx-bat')+'"></b></i>';
  });
  document.body.insertAdjacentHTML('beforeend', h+'</div>');
}

if(deckTheme==='hallo') applyDeckTheme(); // le dessin du dos n'était pas encore défini quand applyDeckTheme() a tourné dans le fichier précédent
