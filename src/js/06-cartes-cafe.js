/* ===================== v51 : jeu de cartes « Café Jacquet » (dessins SVG générés dans le code) =====================
   Albert sur les 4 Rois, Fredo sur les 4 Valets (v52 : sacoche + t-shirt trop court), Monique sur les 4 Dames (v52),
   tous devant le mur bleu « Café Jacquet » (v53 ; « Chez Monique » derrière Monique) :
   la couleur des vêtements et le symbole changent avec la couleur de la carte.
   As de pique « maison » noir et or (dague ailée, « Qui coupe gagne »). Dos : mur de briques bleu « Café Jacquet ».
   Les cartes à points restent classiques. */
var CAFE_SUIT_PATH = {
  H:'M50 90C50 90 8 62 8 34 8 19 19 8 32 8c8 0 14 4 18 11 4-7 10-11 18-11 13 0 24 11 24 26 0 28-42 56-42 56z',
  S:'M50 6C50 6 10 40 10 62c0 14 11 23 24 20 7-2 12-7 14-12-1 10-5 17-12 22h28c-7-5-11-12-12-22 2 5 7 10 14 12 13 3 24-6 24-20C90 40 50 6 50 6z',
  D:'M50 4L88 50 50 96 12 50z',
  C:'M50 8a19 19 0 0 1 17 27.5A19 19 0 1 1 55 70c1 8 5 15 11 22H34c6-7 10-14 11-22a19 19 0 1 1-12-34.5A19 19 0 0 1 50 8z'
};
// tissu par couleur : [fond, rayures, filet clair] — rouge pour cœur, ambre pour carreau, bleu nuit pour pique, vert pour trèfle
var CAFE_CLOTH = { H:['#A7352B','#1E2B45','#F3E7D3'], D:['#C9662A','#5A2410','#F6E2B8'], S:['#22345E','#0E1630','#9FB4E0'], C:['#2F6B45','#14301F','#E8DDB8'] };
var CAFE_INK = { H:'#B5372A', D:'#B5372A', S:'#1E2433', C:'#1E2433' };
function cafeSym(suit, x, y, size, fill, stroke){
  return '<path transform="translate('+(x-size/2)+' '+(y-size/2)+') scale('+(size/100)+')" d="'+CAFE_SUIT_PATH[suit]+'" fill="'+fill+'"'+(stroke ? ' stroke="'+stroke+'" stroke-width="'+(600/size)+'"' : '')+'/>';
}
function cafePlaid(id, c){
  return '<pattern id="'+id+'" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="'+c[0]+'"/>'
    + '<rect y="7" width="18" height="4" fill="'+c[1]+'" opacity="0.6"/><rect x="7" width="4" height="18" fill="'+c[1]+'" opacity="0.6"/>'
    + '<rect y="14" width="18" height="1.2" fill="'+c[2]+'" opacity="0.55"/><rect x="14" width="1.2" height="18" fill="'+c[2]+'" opacity="0.55"/></pattern>';
}
// cadre commun des figures : fond crème, niche en briques, portrait au centre (viewBox 140 × 196, proportions d'une carte)
// v53 : les figures posent devant le mur de briques bleu du dos. Deux images superposées : le mur (cafeWall) puis le
// portrait seul (fond transparent). Entre les deux, le néon (« Café Jacquet », « Chez Monique » pour la Dame) est du texte
// HTML : la police Sacramento ne peut pas être utilisée à l'intérieur d'une image SVG.
function cafeWall(){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<pattern id="cjBlueW" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#2346A8"/><path d="M0 0.8H40M0 10H40M0 19.2H40M10 0V10M30 10V20" stroke="#142B6E" stroke-width="1.6"/></pattern></defs>'
    + '<rect width="140" height="196" fill="#FBF4E6"/>'
    + '<rect x="30" y="22" width="80" height="152" rx="16" fill="url(#cjBlueW)"/><rect x="30" y="22" width="80" height="152" rx="16" fill="#0A1433" opacity="0.32"/></svg>';
}
function cafeFaceFrame(defs, portrait){ // le portrait seul, découpé à la forme de la niche
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'+defs+'<clipPath id="cjNiche"><rect x="30" y="22" width="80" height="152" rx="16"/></clipPath></defs>'
    + '<g clip-path="url(#cjNiche)"><svg x="15" y="24" width="110" height="150" viewBox="0 0 200 240" preserveAspectRatio="xMidYMax meet">'+portrait+'</svg></g>'
    + '<rect x="30" y="22" width="80" height="152" rx="16" fill="none" stroke="#0E1A40" stroke-width="1.2" opacity="0.6"/></svg>';
}
var CAFE_NEON = { K:'Café Jacquet', J:'Café Jacquet', Q:'Chez Monique' };
function cafeAlbert(suit){
  var cl = CAFE_CLOTH[suit], ink = CAFE_INK[suit];
  return cafeFaceFrame(cafePlaid('cjPlaid', cl),
      '<path d="M2 240C4 190 46 166 100 166s96 24 98 74z" fill="url(#cjPlaid)"/>'
    + '<path d="M74 144h52v30l-26 16-26-16z" fill="#DDA27E"/>'
    + '<path d="M68 172l32 34 32-34-12-8-20 22-20-22z" fill="'+cl[1]+'"/>'
    + '<ellipse cx="48" cy="106" rx="10" ry="14" fill="#E2A985"/><ellipse cx="152" cy="106" rx="10" ry="14" fill="#E2A985"/>'
    + '<rect x="50" y="46" width="100" height="116" rx="28" fill="#E8B48F"/>'
    + '<path d="M44 98c-8-32 8-64 50-70 26-4 56 6 64 28 6 16 4 30-2 42-6-16-20-26-40-28-18-2-34 2-48 10-10 6-18 12-24 18z" fill="#8F8F8A"/>'
    + '<path d="M54 82c4-18 20-30 42-32-12 8-18 18-20 30z" fill="#ABABA6"/>'
    + '<path d="M64 60c16-14 46-18 68-6M58 74c18-14 50-16 74-4" stroke="#CFCFCA" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M70 32L80 6L92 24L100 0L108 24L120 6L130 32z" fill="#E7A93B" stroke="#7A4A12" stroke-width="2"/>'
    + cafeSym(suit, 100, 22, 11, ink)
    + '<path d="M68 96c8-5 17-5 25 0M107 96c8-5 17-5 25 0" stroke="#5E5E5A" stroke-width="4.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M72 109c6 5 13 5 19 0M109 109c6 5 13 5 19 0" stroke="#3A2A22" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M100 106c-5 11-10 20-8 25 4 3 12 3 16 0" stroke="#C98D6C" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M72 138c13 18 43 18 56 0z" fill="#7A2E26"/><path d="M75 139c13 7 37 7 50 0v3c-13 6-37 6-50 0z" fill="#FFFFFF"/>'
    // poche brodée avec le symbole
    + '<rect x="30" y="196" width="34" height="32" rx="5" fill="'+cl[0]+'" stroke="'+cl[2]+'" stroke-width="2" stroke-dasharray="3 2"/>'
    + cafeSym(suit, 47, 212, 22, cl[2]));
}
function cafeFredo(suit){ // v52 : t-shirt trop court (on voit le ventre) couleur de la carte + sacoche en bandoulière
  var cl = CAFE_CLOTH[suit];
  return cafeFaceFrame('', '<path d="M-4 240c0-30 10-50 26-60h156c16 10 26 30 26 60z" fill="#E3AE8C"/>'
    + '<ellipse cx="100" cy="236" rx="70" ry="34" fill="#E3AE8C"/><ellipse cx="100" cy="230" rx="52" ry="20" fill="#EDBC9A" opacity="0.6"/>'
    + '<path d="M96 222c2 4 6 4 8 0" stroke="#B9806A" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    + '<path d="M90 236c6 2 14 2 20 0" stroke="#C48B6A" stroke-width="1.6" fill="none" stroke-linecap="round" opacity="0.6"/>'
    + '<path d="M-2 212C-4 180 38 146 100 146s104 34 102 66c-30-12-62-18-102-18S28 200-2 212z" fill="'+cl[0]+'"/>'
    + '<path d="M-2 212c30-12 62-18 102-18s72 6 102 18" stroke="'+cl[1]+'" stroke-width="3" fill="none" opacity="0.5"/>'
    + '<path d="M80 150c6 10 34 10 40 0" stroke="'+cl[1]+'" stroke-width="4" fill="none" opacity="0.55"/>'
    + cafeSym(suit, 126, 184, 24, cl[2])
    + '<path d="M150 150L56 212" stroke="#2A211C" stroke-width="8" stroke-linecap="round"/>'
    + '<path d="M150 150L56 212" stroke="#4A3A30" stroke-width="2" stroke-dasharray="4 4"/>'
    + '<rect x="34" y="200" width="44" height="30" rx="8" fill="#2A211C"/><path d="M38 210h36" stroke="#8A8A86" stroke-width="2"/>'
    + '<rect x="50" y="216" width="12" height="8" rx="2" fill="#E7A93B"/>'
    + '<g fill="#3E2A1F"><circle cx="58" cy="80" r="22"/><circle cx="142" cy="80" r="22"/><circle cx="48" cy="108" r="20"/><circle cx="152" cy="108" r="20"/>'
    + '<circle cx="48" cy="136" r="18"/><circle cx="152" cy="136" r="18"/>'
    + '<circle cx="80" cy="54" r="22"/><circle cx="120" cy="54" r="22"/><circle cx="100" cy="46" r="22"/></g>'
    + '<path d="M40 104c4-4 9-4 12 0M148 104c4-4 9-4 12 0M40 134c4-4 9-4 12 0M148 134c4-4 9-4 12 0" stroke="#6B4A36" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M78 130h44v22l-22 8-22-8z" fill="#D9A07D"/>'
    + '<circle cx="100" cy="98" r="50" fill="#E3AE8C"/>'
    + '<g fill="#3E2A1F"><circle cx="70" cy="62" r="14"/><circle cx="90" cy="54" r="14"/><circle cx="110" cy="54" r="14"/><circle cx="130" cy="62" r="14"/></g>'
    + '<path d="M64 64c4-4 9-4 12 0M84 56c4-4 9-4 12 0M104 56c4-4 9-4 12 0M124 64c4-4 9-4 12 0" stroke="#6B4A36" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M60 118c6 18 20 30 40 30s34-12 40-30c-6 8-20 15-40 15s-34-7-40-15z" fill="#6E6E6A" opacity="0.28"/>'
    + '<path d="M70 92c7-5 15-5 22 0M108 92c7-5 15-5 22 0" stroke="#3A2A22" stroke-width="5.5" fill="none" stroke-linecap="round"/>'
    + '<circle cx="82" cy="104" r="3.4" fill="#2A1E18"/><circle cx="118" cy="104" r="3.4" fill="#2A1E18"/>'
    + '<circle cx="70" cy="120" r="9" fill="#E39A82" opacity="0.5"/><circle cx="130" cy="120" r="9" fill="#E39A82" opacity="0.5"/>'
    + '<path d="M97 104c-3 8-5 14-1 17 3 2 8 2 10 0" stroke="#C48B6A" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M74 126c13 17 39 17 52 0z" fill="#7A2E26"/><path d="M77 127c13 6 33 6 46 0v3c-13 5-33 5-46 0z" fill="#FFFFFF"/>');
}
function cafeDame(suit){ // v52 : la patronne (d'après la photo) : cheveux gris bouclés, grandes lunettes, long collier, haut sans manches couleur de la carte
  var cl = CAFE_CLOTH[suit], skin = '#EDC2A2', skinD = '#DBA886', hair = '#CBC8C2', hairL = '#E6E4DF';
  var beads = [], i, a;
  for(i=0;i<=14;i++){ a = Math.PI*(0.08 + 0.84*i/14); beads.push('<circle cx="'+(100-26*Math.cos(a)).toFixed(1)+'" cy="'+(166+44*Math.sin(a)).toFixed(1)+'" r="3.2" fill="'+(i%2 ? '#E7C27A' : '#FFF6E2')+'" stroke="#A88A50" stroke-width="0.7"/>'); }
  return cafeFaceFrame('', '<path d="M2 240C4 192 46 168 100 168s96 24 98 72z" fill="'+skin+'"/>'
    + '<path d="M36 240c2-34 12-56 30-66 8 14 20 20 34 20s26-6 34-20c18 10 28 32 30 66z" fill="'+cl[0]+'"/>'
    + '<path d="M50 240v-40M62 240v-52M74 240v-50M86 240v-46M114 240v-46M126 240v-50M138 240v-52M150 240v-40" stroke="'+cl[1]+'" stroke-width="2" opacity="0.28"/>'
    + '<path d="M66 174c8 14 20 20 34 20s26-6 34-20" stroke="'+cl[1]+'" stroke-width="3" fill="none" opacity="0.5"/>'
    + '<path d="M80 140h40v30l-20 10-20-10z" fill="'+skinD+'"/>'
    + beads.join('')
    + '<circle cx="100" cy="216" r="10" fill="#E7A93B" stroke="#7A4A12" stroke-width="1.4"/>' + cafeSym(suit, 100, 216, 12, CAFE_INK[suit])
    // petit paquet de biscuits dans la main
    + '<g transform="translate(30 204) rotate(-8)"><rect width="34" height="24" rx="3" fill="#E8862A"/><rect x="4" y="8" width="26" height="8" rx="2" fill="#FBD38A"/><path d="M0 4h34" stroke="#B9601A" stroke-width="2"/></g>'
    + '<path d="M26 222c6-6 16-6 22 0v14H26z" fill="'+skin+'"/><path d="M30 222v10M36 220v12M42 221v11" stroke="'+skinD+'" stroke-width="1.6"/>'
    // cheveux gris bouclés (derrière la tête)
    + '<g fill="'+hair+'"><circle cx="58" cy="90" r="18"/><circle cx="142" cy="90" r="18"/><circle cx="54" cy="114" r="14"/><circle cx="146" cy="114" r="14"/></g>'
    + '<ellipse cx="100" cy="104" rx="42" ry="50" fill="'+skin+'"/>'
    + '<g fill="'+hair+'"><circle cx="66" cy="66" r="18"/><circle cx="84" cy="54" r="19"/><circle cx="104" cy="50" r="20"/><circle cx="124" cy="56" r="18"/><circle cx="138" cy="70" r="16"/><circle cx="62" cy="80" r="13"/></g>'
    + '<path d="M60 64c4-5 10-5 14 0M80 52c4-5 10-5 14 0M100 48c4-5 10-5 14 0M120 54c4-5 10-5 14 0M50 92c4-5 10-5 14 0M136 92c4-5 10-5 14 0" stroke="'+hairL+'" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    + qTiara(30)
    // grandes lunettes fines
    + '<g fill="#FFFFFF" fill-opacity="0.12" stroke="#9A9184" stroke-width="2.4"><rect x="64" y="92" width="32" height="24" rx="9"/><rect x="104" y="92" width="32" height="24" rx="9"/></g>'
    + '<path d="M96 102h8M64 100l-8-3M136 100l8-3" stroke="#9A9184" stroke-width="2.4" fill="none"/>'
    + '<path d="M72 106c5 4 11 4 16 0M112 106c5 4 11 4 16 0" stroke="#3A2A22" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
    + '<circle cx="72" cy="126" r="8" fill="#E39A82" opacity="0.5"/><circle cx="128" cy="126" r="8" fill="#E39A82" opacity="0.5"/>'
    + '<path d="M100 110c-3 7-5 12-2 15 3 2 7 2 9 0" stroke="#C98D6C" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    + '<path d="M84 134c10 9 22 9 32 0" stroke="#A2483E" stroke-width="4" fill="none" stroke-linecap="round"/>'
    + '<path d="M74 140c4 2 8 2 10 0M116 140c2 2 6 2 10 0" stroke="#D9A585" stroke-width="1.6" fill="none" stroke-linecap="round"/>'
    + '<circle cx="58" cy="120" r="3.5" fill="#E7C27A"/><circle cx="142" cy="120" r="3.5" fill="#E7C27A"/>');
}
function qTiara(y){ return '<path d="M74 '+(y+14)+'L82 '+(y+2)+'L90 '+(y+11)+'L100 '+(y-4)+'L110 '+(y+11)+'L118 '+(y+2)+'L126 '+(y+14)+'z" fill="#E7A93B" stroke="#7A4A12" stroke-width="2"/>'
  + '<circle cx="100" cy="'+(y+3)+'" r="3" fill="#FFF1C4"/>'; }
// As de pique « maison » : dague ailée dorée sur un grand pique gravé, ruban « Qui coupe gagne »
function cafeAceSpade(){
  var wingL = 'M95 150C78 146 60 132 50 110 40 88 40 60 52 30 58 58 66 76 78 90 72 70 72 52 80 34 84 62 90 80 98 96 96 80 98 66 104 56Z';
  var feathers = 'M58 108C66 100 72 92 76 84M54 88C62 82 68 76 72 68M56 66C62 62 66 56 70 50M70 118C78 110 84 102 88 94M80 132C86 124 90 116 94 108';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<linearGradient id="cjGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7DE92"/><stop offset="0.45" stop-color="#D9A84A"/><stop offset="1" stop-color="#9C6B1E"/></linearGradient>'
    + '</defs><rect width="140" height="196" fill="#111111"/>'
    + '<rect x="6" y="6" width="128" height="184" rx="9" fill="none" stroke="url(#cjGold)" stroke-width="1.4"/>'
    + '<svg x="10" y="24" width="120" height="156" viewBox="0 0 200 260">'
    // grand pique gravé (contour + lignes intérieures)
    + '<path d="'+'M100 8C100 8 22 72 22 128c0 30 22 48 50 42 14-3 22-12 26-22-2 24-10 44-24 60h52c-14-16-22-36-24-60 4 10 12 19 26 22 28 6 50-12 50-42C178 72 100 8 100 8z'+'" fill="#0B0B0B" stroke="url(#cjGold)" stroke-width="2.4"/>'
    + '<path d="M100 26C80 44 46 76 40 112M100 26C120 44 154 76 160 112M60 150C50 140 46 128 48 116M140 150C150 140 154 128 152 116M88 214L100 196 112 214" stroke="#B8862B" stroke-width="1.3" fill="none" opacity="0.8"/>'
    // ailes
    + '<g fill="url(#cjGold)" stroke="#6E4A12" stroke-width="1.2"><path d="'+wingL+'"/><path d="'+wingL+'" transform="translate(200 0) scale(-1 1)"/></g>'
    + '<g stroke="#7A5216" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="'+feathers+'"/><path d="'+feathers+'" transform="translate(200 0) scale(-1 1)"/></g>'
    // dague (pointe en bas)
    + '<g stroke="#6E4A12" stroke-width="1.2" fill="url(#cjGold)">'
    + '<circle cx="100" cy="62" r="8"/><rect x="93" y="70" width="14" height="40" rx="5"/>'
    + '<path d="M93 80h14M93 90h14M93 100h14" stroke-width="1.6"/>'
    + '<rect x="78" y="110" width="44" height="8" rx="3"/>'
    + '<path d="M91 118h18l-3 104-6 18-6-18z"/></g>'
    + '<path d="M100 122v110" stroke="#FFF1C4" stroke-width="1.4" opacity="0.7"/>'
    // ruban
    + '<path d="M22 176c20 10 50 16 78 16s58-6 78-16l8 20c-22 12-56 20-86 20s-64-8-86-20z" fill="url(#cjGold)" stroke="#6E4A12" stroke-width="1.2"/>'
    + '<path d="M22 176l-14 2 8 10-6 10 18-2M178 176l14 2-8 10 6 10-18-2" fill="#A8761C" stroke="#6E4A12" stroke-width="1.2"/>'
    + '<path id="cjRib" d="M26 192c22 10 48 14 74 14s52-4 74-14" fill="none"/>'
    + '<text font-family="Arial Black, Helvetica Neue, Arial, sans-serif" font-weight="800" font-size="12" fill="#2A1A06"><textPath href="#cjRib" startOffset="50%" text-anchor="middle" textLength="128" lengthAdjust="spacingAndGlyphs">QUI COUPE GAGNE</textPath></text>'
    + '</svg></svg>';
}
// dos : mur de briques bleu et néon chaud ; « Café Jacquet » en écriture néon (Sacramento) ajouté par le CSS
function cafeBack(){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<pattern id="cjBlue" width="40" height="20" patternUnits="userSpaceOnUse"><rect width="40" height="20" fill="#2346A8"/><path d="M0 0.8H40M0 10H40M0 19.2H40M10 0V10M30 10V20" stroke="#142B6E" stroke-width="1.6"/></pattern>'
    + '</defs>'
    + '<rect width="140" height="196" fill="url(#cjBlue)"/><rect width="140" height="196" fill="#0A1433" opacity="0.28"/>'
    + '<path d="M0 22C40 14 90 10 140 4" stroke="#FFC46B" stroke-width="2.4" fill="none"/><path d="M0 22C40 14 90 10 140 4" stroke="#FFC46B" stroke-width="8" fill="none" opacity="0.18"/>'
    + '</svg>'; // le texte néon « Café Jacquet » est posé par le CSS (police Sacramento du jeu), pas dans l'image
}
var deckTheme = 'cafe'; // « Café Jacquet » par défaut ; « classic » = l'ancien jeu
try{ deckTheme = localStorage.getItem('rikiki_deck') === 'classic' ? 'classic' : 'cafe'; }catch(e){}
var CAFE_IMG = {};
function cafeUri(svg){ return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
function cafeArt(card){
  if(deckTheme !== 'cafe') return null;
  var k = card.suit + card.rank;
  if(!(k in CAFE_IMG)) CAFE_IMG[k] = card.rank==='K' ? cafeUri(cafeAlbert(card.suit)) : card.rank==='J' ? cafeUri(cafeFredo(card.suit)) : card.rank==='Q' ? cafeUri(cafeDame(card.suit)) : k==='SA' ? cafeUri(cafeAceSpade()) : null;
  return CAFE_IMG[k];
}
function applyDeckTheme(){
  var r = document.documentElement; r.setAttribute('data-deck', deckTheme);
  if(deckTheme==='cafe' && !applyDeckTheme.done){ applyDeckTheme.done = true; r.style.setProperty('--cafe-back', 'url("' + cafeUri(cafeBack()) + '")'); }
}
applyDeckTheme();
function setDeckTheme(t){ deckTheme = t==='classic' ? 'classic' : 'cafe'; try{ localStorage.setItem('rikiki_deck', deckTheme); }catch(e){} applyDeckTheme(); render(); }
function renderDeckChoice(){
  var peek = [{suit:'H',rank:'K'},{suit:'C',rank:'Q'},{suit:'S',rank:'J'},{suit:'S',rank:'A'}].map(function(c){ return cardHtml(Object.assign({ value:RANK_VALUE[c.rank] }, c), { size:'peek' }); }).join('') + '<div class="card back peek"></div>';
  return '<div class="deck-choice"><strong>Tes cartes</strong><span class="seg">'
    + '<button data-action="deck-set" data-deck="cafe" aria-pressed="'+(deckTheme==='cafe')+'"'+(deckTheme==='cafe'?' class="on"':'')+'>Café Jacquet</button>'
    + '<button data-action="deck-set" data-deck="classic" aria-pressed="'+(deckTheme==='classic')+'"'+(deckTheme==='classic'?' class="on"':'')+'>Classique</button></span>'
    + '<span class="deck-peek" aria-hidden="true">'+peek+'</span></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="deck-set"]') : null; if(!el) return;
  setDeckTheme(el.getAttribute('data-deck'));
});
function cardHtml(card, opts){
  opts = opts || {};
  var cls = 'card' + (RED_SUITS[card.suit] ? ' red' : '') + (opts.mini ? ' mini' : '') + (opts.size ? ' '+opts.size : '') + (opts.disabled ? ' disabled' : '') + (opts.trump ? ' trump' : '');
  var sym = SUIT_SYMBOL[card.suit], r = esc(rankLabel(card.rank)), face = {J:1,Q:1,K:1}[card.rank];
  var corner = '<span>'+r+'</span><span class="s">'+sym+'</span>';
  var small = !!opts.mini, cafe = !small && cafeArt(card), art = cafe || (face && !small && FACE_IMG[card.suit+card.rank]);
  var middle;
  if(cafe && face){
    CAFE_IMG.wall = CAFE_IMG.wall || cafeUri(cafeWall());
    middle = '<div class="art" style="background-image:url(\''+CAFE_IMG.wall+'\')"></div><div class="cafe-neon" data-noi18n><span>'+CAFE_NEON[card.rank]+'</span></div>'
      + '<div class="art" style="background-image:url(\''+art+'\')"></div>';
  }
  else if(art) middle = '<div class="art" style="background-image:url(\''+art+'\')"></div>';
  else if(!small && !face && PIP_LAYOUT[card.rank]) middle = pipsHtml(card.rank, sym);
  else middle = '<div class="pip'+(face?' face':'')+'">'+(face ? '<span class="fl">'+r+'</span><span class="fs">'+sym+'</span>' : sym)+'</div>';
  if(cafe) cls += ' cafe-art' + (card.rank==='A' ? ' cafe-ace' : '');
  if(art) cls += ' has-art'; else if(!small && !face && PIP_LAYOUT[card.rank]) cls += ' has-pips';
  return '<div class="'+cls+'">'+(art ? middle : '')+'<div class="corner tl">'+corner+'</div>'
    + (art ? '' : middle)
    + '<div class="corner br">'+corner+'</div></div>';
}
function initials(name){ name=(name||'?').trim(); return name ? name[0].toUpperCase() : '?'; }

