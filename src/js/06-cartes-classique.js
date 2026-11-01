/* ===================== 1.11.0 : figures du paquet « Classique » redessinées en vectoriel (nettes à toute taille) =====================
   Avant : 12 petites images 86 × 131 px agrandies (floues). Maintenant : Roi, Dame et Valet à double tête comme les cartes françaises, dessinés en SVG.
   Remplace les entrées de FACE_IMG (05-langues.js) ; cardHtml (06-cartes-cafe.js) s'en sert comme avant (le fond de la carte + les coins restent ceux du jeu). */
var CLASSIC_PIP = {
  H: 'M0 9 C-14 -1 -10 -10 -4 -10 C-1 -10 0 -7 0 -6 C0 -7 1 -10 4 -10 C10 -10 14 -1 0 9Z',
  D: 'M0 -11 L8 0 L0 11 L-8 0Z',
  S: 'M0 -11 C-12 -2 -9 6 -3 5 C-4 8 -5 10 -7 11 H7 C5 10 4 8 3 5 C9 6 12 -2 0 -11Z',
  C: 'M0 -11 a5 5 0 1 1 -1 9 a5 5 0 1 1 -5 8 a5 5 0 1 1 12 0 a5 5 0 1 1 -5 -8 a5 5 0 1 1 -1 -9z M0 0 L-3 11 H3Z'
};
function classicFigure(rank, suit){ // moitié haute de la carte (zone x 22–118, y 18–98) ; la moitié basse est la même, tournée
  var red = (suit === 'H' || suit === 'D'), main = red ? '#C8283A' : '#25252D', dark = red ? '#8F1B29' : '#101014';
  var gold = '#D9A93B', goldDk = '#8A6A22', skin = '#F1CBA4', blue = '#2D5FA8';
  var pip = '<path transform="translate(50 90) scale(0.62)" d="'+CLASSIC_PIP[suit]+'" fill="#FFF3C9"/>';
  var body = '<path d="M28 98C28 78 44 66 70 64C96 66 112 78 112 98Z" fill="'+main+'"/>'
    + '<path d="M70 66V98" stroke="'+gold+'" stroke-width="3"/><path d="M44 74L56 98M96 74L84 98" stroke="'+blue+'" stroke-width="3" opacity="0.9"/>'
    + '<path d="M28 98C28 90 30 84 34 80" fill="none" stroke="'+gold+'" stroke-width="2"/><path d="M112 98C112 90 110 84 106 80" fill="none" stroke="'+gold+'" stroke-width="2"/>'
    + pip
    + '<rect x="65" y="58" width="10" height="9" fill="'+skin+'"/>';
  var collar = '<path d="M48 70C58 77 82 77 92 70L88 80C79 85 61 85 52 80Z" fill="#FFFDF6" stroke="#B9B2A0" stroke-width="0.8"/><circle cx="58" cy="77" r="1" fill="#222"/><circle cx="70" cy="80" r="1" fill="#222"/><circle cx="82" cy="77" r="1" fill="#222"/>';
  var head = '<circle cx="70" cy="50" r="11.5" fill="'+skin+'" stroke="#C99C72" stroke-width="0.8"/><circle cx="66" cy="49" r="1.2" fill="#222"/><circle cx="74" cy="49" r="1.2" fill="#222"/>';
  var extra;
  if(rank === 'K'){
    extra = '<path d="M58 53C58 72 82 72 82 53C78 60 62 60 58 53Z" fill="#DAD6CB" stroke="#A7A294" stroke-width="0.7"/><path d="M63 55C67 58 73 58 77 55" fill="none" stroke="#9A9588" stroke-width="1.2"/>'
      + '<path d="M56 41L57 27L63 34L70 24L77 34L83 27L84 41Z" fill="'+gold+'" stroke="'+goldDk+'" stroke-width="1"/><circle cx="70" cy="29" r="1.8" fill="'+main+'"/><circle cx="60" cy="38" r="1.3" fill="'+blue+'"/><circle cx="80" cy="38" r="1.3" fill="'+blue+'"/>';
  } else if(rank === 'Q'){
    extra = '<path d="M57 46C54 62 56 71 61 76L64 60Z M83 46C86 62 84 71 79 76L76 60Z" fill="#E1B64A" stroke="#A9811E" stroke-width="0.7"/><path d="M66 56C68 58 72 58 74 56" fill="none" stroke="#C0392B" stroke-width="1.6" stroke-linecap="round"/>'
      + '<path d="M60 40L61 30L66 35L70 27L74 35L79 30L80 40Z" fill="'+gold+'" stroke="'+goldDk+'" stroke-width="1"/><circle cx="70" cy="31" r="1.7" fill="'+main+'"/>';
  } else {
    extra = '<path d="M58 45C57 56 58 62 60 66L63 54Z M82 45C83 56 82 62 80 66L77 54Z" fill="#7A4B22"/><path d="M66 56C68 58 72 58 74 56" fill="none" stroke="#9A4A3A" stroke-width="1.4" stroke-linecap="round"/>'
      + '<path d="M55 43C57 29 83 29 85 43Z" fill="'+main+'" stroke="'+dark+'" stroke-width="0.8"/><rect x="53" y="41" width="34" height="4.5" rx="2.2" fill="'+gold+'" stroke="'+goldDk+'" stroke-width="0.8"/>'
      + '<path d="M82 33C92 30 98 24 100 18" fill="none" stroke="'+gold+'" stroke-width="3" stroke-linecap="round"/><path d="M82 33C90 33 96 28 98 22" fill="none" stroke="#FFF1BD" stroke-width="1" stroke-linecap="round"/>';
  }
  return body + collar + head + extra;
}
function classicFaceUri(rank, suit){
  var red = (suit === 'H' || suit === 'D'), frame = red ? '#C8283A' : '#25252D', half = classicFigure(rank, suit);
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 196"><rect width="140" height="196" rx="9" fill="#FBF7EC"/>'
    + '<rect x="20" y="16" width="100" height="164" rx="4" fill="#FFFDF6" stroke="'+frame+'" stroke-width="1.3"/>'
    + '<rect x="24" y="20" width="92" height="156" rx="2" fill="none" stroke="#D9A93B" stroke-width="0.7"/>'
    + '<clipPath id="ct"><rect x="22" y="18" width="96" height="80"/></clipPath><clipPath id="cb"><rect x="22" y="98" width="96" height="80"/></clipPath>'
    + '<g clip-path="url(#ct)">'+half+'</g><g clip-path="url(#cb)"><g transform="rotate(180 70 98)">'+half+'</g></g>'
    + '<path d="M22 98H118" stroke="'+frame+'" stroke-width="1"/>'
    + '<path transform="translate(70 98) scale(0.5)" d="'+CLASSIC_PIP[suit]+'" fill="'+frame+'" stroke="#FFFDF6" stroke-width="3" paint-order="stroke"/>'
    + '</svg>';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}
(function(){ // 12 figures : S/H/D/C × J/Q/K
  ['S', 'H', 'D', 'C'].forEach(function(su){ ['J', 'Q', 'K'].forEach(function(ra){ FACE_IMG[su+ra] = classicFaceUri(ra, su); }); });
})();
