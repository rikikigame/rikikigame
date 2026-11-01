/* ===================== 1.11.0 : jeu de cartes « Casino noir » (dessins SVG générés dans le code) =====================
   Mêmes personnages que le Café Jacquet, version casino : Albert (Rois) en smoking, Fredo (Valets) cheveux plaqués et lunettes noires, Colette (Dames) en
   robe noire avec chignon et lunettes noires. Les signes sont des JETONS de casino : cœur = rouge, carreau = bleu, trèfle = vert, pique = noir.
   Fond vert « tapis de feutre » et or. As de pique : celui de la maison (noir et or). Dos : tapis vert à losanges dorés, « Casino Jacquet » en néon doré.
   Chargé après 06-cartes-cafe.js (il réutilise cafeSym, cafeFaceFrame, cafeUri, cafeAceSpade, CAFE_SUIT_PATH, neonSpan).
   Aucun nom ni logo protégé (pas de « 007 », pas de « Casino Royale »). */
var CASINO_CHIP = { H:'#C8283A', D:'#C8283A', C:'#18181C', S:'#18181C' }; // couleur du jeton : rouge (cœur, carreau) ou noir (trèfle, pique)
var CASINO_NEON = { K:'Casino de Fredo', J:'Casino de Fredo', Q:'Casino de Fredo' };
var CASINO_GOLD = '#D9B25A';

// jeton de casino : rouge → jeton blanc, encoches et signe rouges ; noir → jeton noir, encoches et signe blancs (viewBox 100 × 100)
// 1.11.1 : cœur = signe rouge sur jeton blanc, carreau = signe blanc sur jeton rouge, pique = signe noir sur jeton blanc, trèfle = signe blanc sur jeton noir
var CASINO_CHIP_LOOK = {
  H: { base:'#FFFFFF', ink:'#C8283A', mid:'#FFFFFF', edge:'#D8D8D4' },
  D: { base:'#C8283A', ink:'#FFFFFF', mid:'#D63448', edge:'#7E1220' },
  S: { base:'#FFFFFF', ink:'#18181C', mid:'#FFFFFF', edge:'#D8D8D4' },
  C: { base:'#18181C', ink:'#FFFFFF', mid:'#2A2A30', edge:'#000000' }
};
function casinoChipInner(suit){
  var l = CASINO_CHIP_LOOK[suit];
  return '<circle cx="50" cy="50" r="47" fill="'+l.base+'" stroke="'+l.edge+'" stroke-width="1.5"/>'
    + '<circle cx="50" cy="50" r="41" fill="none" stroke="'+l.ink+'" stroke-width="7" stroke-dasharray="10.73 10.73"/>'
    + '<circle cx="50" cy="50" r="31" fill="'+l.mid+'" stroke="'+l.ink+'" stroke-width="2.2"/>'
    + cafeSym(suit, 50, 50, 50, l.ink);
}
function casinoSymInline(suit){ // coins des cartes, pastilles : 1em × 1em
  return '<svg class="csym cs-'+suit+'" viewBox="0 0 100 100" aria-hidden="true">'+casinoChipInner(suit)+'</svg>';
}
function casinoChipAt(suit, x, y, r){ // petit jeton posé dans un dessin (épingle de revers, carte dans la manche…)
  return '<g transform="translate('+(x-r)+' '+(y-r)+') scale('+(2*r/100)+')">'+casinoChipInner(suit)+'</g>';
}
// fond de la figure : carte blanche (sans contour doré : il ressemblait à l'atout), niche en tapis de feutre vert (mêmes proportions que cafeWall : x 30–110, y 22–174)
function casinoWall(){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<radialGradient id="ccFelt" cx="50%" cy="38%" r="78%"><stop offset="0" stop-color="#24895A"/><stop offset="1" stop-color="#093620"/></radialGradient>'
    + '<pattern id="ccDia" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H12M0 0V12" stroke="#06261A" stroke-width="0.7" opacity="0.65"/></pattern></defs>'
    + '<rect width="140" height="196" fill="#FBFBF8"/>'
    + '<rect x="30" y="22" width="80" height="152" rx="16" fill="url(#ccFelt)"/><rect x="30" y="22" width="80" height="152" rx="16" fill="url(#ccDia)"/>'
    + '<rect x="30" y="22" width="80" height="152" rx="16" fill="none" stroke="#0B3A25" stroke-width="1.4"/></svg>';
}
// ALBERT (Rois) : cigare, smoking noir, chemise blanche, nœud papillon, pochette de la couleur du jeton, épingle de revers
function casinoAlbert(suit){
  var ch = CASINO_CHIP[suit];
  return cafeFaceFrame('',
      '<path d="M2 240C4 190 46 166 100 166s96 24 98 74z" fill="#15151A"/>'
    + '<path d="M70 168L100 238 130 168z" fill="#F7F7F4"/>'
    + '<path d="M56 172L90 168 98 240H38C36 212 44 190 56 172z" fill="#25252D"/><path d="M144 172L110 168 102 240H162C164 212 156 190 144 172z" fill="#25252D"/>'
    + '<path d="M64 184L92 176M136 184L108 176" stroke="#3A3A46" stroke-width="2" fill="none"/>'
    + '<path d="M74 144h52v28l-26 12-26-12z" fill="#DDA27E"/>'
    + '<path d="M72 166l14-8 14 18-20 6zM128 166l-14-8-14 18 20 6z" fill="#FFFFFF"/>'
    + '<path d="M100 178L76 166V190z" fill="#0C0C10"/><path d="M100 178L124 166V190z" fill="#0C0C10"/><rect x="94" y="170" width="12" height="16" rx="3.5" fill="#1B1B22"/>'
    + '<path d="M80 170l12 6M120 170l-12 6" stroke="#4A4A58" stroke-width="1.6" fill="none"/>'
    + '<path d="M54 206h26l-3 14H56z" fill="#FFFFFF"/><path d="M54 206h26l-2 6c-8-2-16-2-24 0z" fill="'+ch+'"/>'
    + casinoChipAt(suit, 146, 204, 10)
    + '<ellipse cx="48" cy="106" rx="10" ry="14" fill="#E2A985"/><ellipse cx="152" cy="106" rx="10" ry="14" fill="#E2A985"/>'
    + '<rect x="50" y="46" width="100" height="116" rx="28" fill="#E8B48F"/>'
    + '<path d="M44 98c-8-32 8-64 50-70 26-4 56 6 64 28 6 16 4 30-2 42-6-16-20-26-40-28-18-2-34 2-48 10-10 6-18 12-24 18z" fill="#8F8F8A"/>'
    + '<path d="M54 82c4-18 20-30 42-32-12 8-18 18-20 30z" fill="#ABABA6"/>'
    + '<path d="M64 60c16-14 46-18 68-6M58 74c18-14 50-16 74-4" stroke="#CFCFCA" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M70 32L80 6L92 24L100 0L108 24L120 6L130 32z" fill="#E7A93B" stroke="#7A4A12" stroke-width="2"/>'
    + casinoChipAt(suit, 100, 21, 7.5)
    + '<path d="M68 96c8-5 17-5 25 0M107 96c8-5 17-5 25 0" stroke="#5E5E5A" stroke-width="4.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M72 109c6 5 13 5 19 0M109 109c6 5 13 5 19 0" stroke="#3A2A22" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M100 106c-5 11-10 20-8 25 4 3 12 3 16 0" stroke="#C98D6C" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M80 139c13 8 27 8 40 0" stroke="#7A2E26" stroke-width="4.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M114 143L156 129" stroke="#6B3A1A" stroke-width="8" stroke-linecap="round"/><path d="M114 143L156 129" stroke="#8A5226" stroke-width="3" stroke-linecap="round" opacity="0.7"/>'
    + '<path d="M132 137l4-1.4" stroke="#E7A93B" stroke-width="8" stroke-linecap="butt"/>'
    + '<circle cx="158" cy="128.5" r="4.6" fill="#E8602C"/><circle cx="158" cy="128.5" r="2.4" fill="#FFC85A"/>'
    + '<path d="M162 118c-7-8 6-12-1-22c-4-6 5-9 2-16" stroke="#FFFFFF" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.5"/>');
}
// FREDO (Valets) : le Fredo du Café Jacquet (cheveux bouclés, grand sourire) en costume noir À RAYURES avec lunettes de soleil
function casinoFredo(suit){
  var ch = CASINO_CHIP[suit];
  return cafeFaceFrame('',
      '<path d="M-40 240c0-40 16-66 40-78l100-18 100 18c24 12 40 38 40 78z" fill="#17171C"/>'
    + '<path d="M72 160L100 236 128 160z" fill="#F4F4F0"/>'
    + '<path d="M30 176L84 164 98 240H0C0 212 14 192 30 176z" fill="#22222A"/><path d="M170 176L116 164 102 240H200C200 212 186 192 170 176z" fill="#22222A"/>'
    + '<defs><pattern id="cfPin" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="none"/><path d="M4.5 0V9" stroke="#B9B9C6" stroke-width="1.3" opacity="0.7"/></pattern></defs>'
    + '<path d="M-40 240c0-40 16-66 40-78l100-18 100 18c24 12 40 38 40 78z" fill="url(#cfPin)"/>'
    + '<path d="M30 176L84 164 98 240H0C0 212 14 192 30 176z" fill="url(#cfPin)"/><path d="M170 176L116 164 102 240H200C200 212 186 192 170 176z" fill="url(#cfPin)"/>'
    + '<path d="M94 164h12l6 14-12 48-12-48z" fill="'+ch+'"/><path d="M94 164h12l-2 8h-8z" fill="#00000030"/>'
    + casinoChipAt(suit, 150, 206, 8)
    + '<g fill="#3E2A1F"><circle cx="58" cy="80" r="22"/><circle cx="142" cy="80" r="22"/><circle cx="48" cy="108" r="20"/><circle cx="152" cy="108" r="20"/>'
    + '<circle cx="48" cy="136" r="18"/><circle cx="152" cy="136" r="18"/>'
    + '<circle cx="80" cy="54" r="22"/><circle cx="120" cy="54" r="22"/><circle cx="100" cy="46" r="22"/></g>'
    + '<path d="M40 104c4-4 9-4 12 0M148 104c4-4 9-4 12 0M40 134c4-4 9-4 12 0M148 134c4-4 9-4 12 0" stroke="#6B4A36" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M70 128h60v26l-30 12-30-12z" fill="#D9A07D"/>'
    + '<path d="M76 158l14-8 10 16-16 4zM124 158l-14-8-10 16 16 4z" fill="#FFFFFF"/>'
    + '<circle cx="100" cy="98" r="50" fill="#E3AE8C"/>'
    + '<g fill="#3E2A1F"><circle cx="70" cy="62" r="14"/><circle cx="90" cy="54" r="14"/><circle cx="110" cy="54" r="14"/><circle cx="130" cy="62" r="14"/></g>'
    + '<path d="M64 64c4-4 9-4 12 0M84 56c4-4 9-4 12 0M104 56c4-4 9-4 12 0M124 64c4-4 9-4 12 0" stroke="#6B4A36" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    + '<path d="M60 118c6 18 20 30 40 30s34-12 40-30c-6 8-20 15-40 15s-34-7-40-15z" fill="#6E6E6A" opacity="0.28"/>'
    + '<path d="M58 88h34c4 0 6 2 6 6v8c0 9-6 14-15 14H72c-9 0-14-6-14-15v-7c0-3 0-6 0-6zM142 88h-34c-4 0-6 2-6 6v8c0 9 6 14 15 14h13c9 0 14-6 14-15v-7c0-3 0-6 0-6z" fill="#0A0A0C"/>'
    + '<path d="M98 94h4" stroke="#0A0A0C" stroke-width="4"/><path d="M56 90l-8-3M144 90l8-3" stroke="#0A0A0C" stroke-width="4" stroke-linecap="round"/>'
    + '<path d="M66 96l8-2M112 96l8-2" stroke="#FFFFFF" stroke-width="2" opacity="0.5" stroke-linecap="round"/>'
    + '<circle cx="70" cy="122" r="9" fill="#E39A82" opacity="0.5"/><circle cx="130" cy="122" r="9" fill="#E39A82" opacity="0.5"/>'
    + '<path d="M97 106c-3 8-5 14-1 17 3 2 8 2 10 0" stroke="#C48B6A" stroke-width="3" fill="none" stroke-linecap="round"/>'
    + '<path d="M74 128c13 17 39 17 52 0z" fill="#7A2E26"/><path d="M77 129c13 6 33 6 46 0v3c-13 5-33 5-46 0z" fill="#FFFFFF"/>');
}
// COLETTE (Dames) : chignon, lunettes noires de star, robe noire, collier de perles, boucles d'oreilles dorées, épingle à jeton
function casinoDame(suit){
  var skin = '#EDC2A2', skinD = '#DBA886', hair = '#2A1A15', hairL = '#4E3A32', beads = [], i, a;
  for(i=0;i<=14;i++){ a = Math.PI*(0.08 + 0.84*i/14); beads.push('<circle cx="'+(100-26*Math.cos(a)).toFixed(1)+'" cy="'+(166+44*Math.sin(a)).toFixed(1)+'" r="3.2" fill="'+(i%2 ? '#E9DDC4' : '#FFFFFF')+'" stroke="#B8AB8C" stroke-width="0.7"/>'); }
  return cafeFaceFrame('',
      '<path d="M34 240C36 196 66 172 100 172s64 24 66 68z" fill="'+skin+'"/>'
    + '<path d="M58 240c2-30 8-48 20-58l22 28 22-28c12 10 18 28 20 58z" fill="#141418"/>'
    + '<path d="M78 182l22 28 22-28" stroke="#2A2A32" stroke-width="3" fill="none"/>'
    + '<path d="M86 140h28v30l-14 10-14-10z" fill="'+skinD+'"/>'
    + beads.join('')
    + '<circle cx="100" cy="218" r="9" fill="#E7A93B" stroke="#7A4A12" stroke-width="1.2"/>' + casinoChipAt(suit, 100, 218, 7)
    // cheveux sombres, chignon haut
    + '<g fill="'+hair+'"><ellipse cx="64" cy="100" rx="16" ry="40"/><ellipse cx="136" cy="100" rx="16" ry="40"/></g>'
    + '<ellipse cx="100" cy="104" rx="37" ry="50" fill="'+skin+'"/>'
    + '<path d="M56 96C50 56 74 40 100 40s50 16 44 56c-6-16-18-28-44-28S62 80 56 96z" fill="'+hair+'"/>'
    + '<circle cx="100" cy="30" r="20" fill="'+hair+'"/><path d="M84 28c8-8 24-8 32 0M88 38c8-6 16-6 24 0" stroke="'+hairL+'" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    + '<path d="M70 56c14-10 40-12 60 0" stroke="'+hairL+'" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
    + '<rect x="84" y="38" width="32" height="5" rx="2.5" fill="#E7A93B" stroke="#7A4A12" stroke-width="0.8"/>' + casinoChipAt(suit, 100, 41, 6)
    // lunettes noires (forme « star »)
    + '<path d="M62 96c9-6 25-6 34 0l-2 14c-8 7-23 7-31 0z" fill="#0A0A0C"/><path d="M138 96c-9-6-25-6-34 0l2 14c8 7 23 7 31 0z" fill="#0A0A0C"/>'
    + '<path d="M96 100h8" stroke="#0A0A0C" stroke-width="3.4"/><path d="M62 98l-8-4M138 98l8-4" stroke="#0A0A0C" stroke-width="3.4" stroke-linecap="round"/>'
    + '<path d="M68 99c6-3 14-3 20 0M112 99c6-3 14-3 20 0" stroke="#FFFFFF" stroke-width="1.8" opacity="0.5" fill="none" stroke-linecap="round"/>'
    + '<circle cx="72" cy="126" r="8" fill="#E39A82" opacity="0.45"/><circle cx="128" cy="126" r="8" fill="#E39A82" opacity="0.45"/>'
    + '<path d="M100 112c-3 7-5 11-2 14 3 2 7 2 9 0" stroke="#C98D6C" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    + '<path d="M84 136c10 8 22 8 32 0c-6 5-26 5-32 0z" fill="#B3192B" stroke="#8E1222" stroke-width="2.4" stroke-linejoin="round"/>'
    + '<circle cx="63" cy="122" r="4.2" fill="#E7A93B" stroke="#7A4A12" stroke-width="0.8"/><circle cx="137" cy="122" r="4.2" fill="#E7A93B" stroke="#7A4A12" stroke-width="0.8"/>');
}
// dos : tapis vert à losanges dorés, filet d'or ; « Casino Jacquet » en néon doré posé par le CSS
function casinoBack(){
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><defs>'
    + '<radialGradient id="cbFelt" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1F7E52"/><stop offset="1" stop-color="#082F1C"/></radialGradient>'
    + '<pattern id="cbDia" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H16M0 0V16" stroke="'+CASINO_GOLD+'" stroke-width="0.9" opacity="0.55"/></pattern></defs>'
    + '<rect width="140" height="196" fill="url(#cbFelt)"/><rect width="140" height="196" fill="url(#cbDia)"/>'
    + '<rect x="6" y="6" width="128" height="184" rx="8" fill="none" stroke="'+CASINO_GOLD+'" stroke-width="1.6"/><rect x="11" y="11" width="118" height="174" rx="5" fill="none" stroke="'+CASINO_GOLD+'" stroke-width="0.6" opacity="0.7"/>'
    + casinoChipAt('H', 26, 26, 9) + casinoChipAt('D', 114, 26, 9) + casinoChipAt('C', 26, 170, 9) + casinoChipAt('S', 114, 170, 9)
    + '</svg>';
}
function casinoArt(card){
  return card.rank==='K' ? cafeUri(casinoAlbert(card.suit)) : card.rank==='J' ? cafeUri(casinoFredo(card.suit)) : card.rank==='Q' ? cafeUri(casinoDame(card.suit))
    : null; // l'as de pique est un as classique
}

applyDeckTheme(); // 1.11.0 : au premier appel (fin de 06-cartes-cafe.js) les dessins du casino n'existaient pas encore
