/* ===================== 1.7.0 : « Grandes cartes » =====================
   Option pour les tablettes, les personnes âgées et tous ceux qui veulent mieux voir : la main du bas, les cartes du pli, l'atout
   et les petites cartes sont agrandis. Réglage par appareil (localStorage rikiki_big_cards, '1' / '0').
   Par défaut : ACTIVÉ sur tablette et grand écran (largeur ≥ 768 px), éteint sur téléphone.
   La taille de la main se calcule dans renderHand (20-sons-et-musique.js) avec bigCardsFactor(). */
var BIG_CARDS_FACTOR = 1.3, BIG_CARDS_TABLET_PX = 768;
function bigCardsDefault(){ return (window.innerWidth || 0) >= BIG_CARDS_TABLET_PX; }
var bigCardsOn = bigCardsDefault();
try{ var bcStored = localStorage.getItem('rikiki_big_cards'); if(bcStored === '1') bigCardsOn = true; else if(bcStored === '0') bigCardsOn = false; }catch(e){}
function bigCardsFactor(){ return bigCardsOn ? BIG_CARDS_FACTOR : 1; }
function applyBigCards(){ try{ document.documentElement.classList.toggle('big-cards', bigCardsOn); }catch(e){} }
applyBigCards();
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="big-cards-toggle"]') : null; if(!el) return;
  bigCardsOn = !bigCardsOn; try{ localStorage.setItem('rikiki_big_cards', bigCardsOn ? '1' : '0'); }catch(err){}
  applyBigCards(); render();
});
