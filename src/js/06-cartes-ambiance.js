/* ===================== 1.11.0 : ambiance animée pour les paquets autres qu'Halloween =====================
   Comme le fond d'Halloween (chauves-souris, citrouilles), mais pour Café Jacquet, Classique et Casino noir : des symboles de cartes qui montent
   doucement, et au Casino noir des jetons dorés qui tombent. Calque #amb-fx fixe, sans gêner (pointer-events none), coupé si l'appareil demande
   moins d'animations. Appelé par applyDeckTheme (06-cartes-cafe.js). */
function ambientFx(theme){
  var el = document.getElementById('amb-fx');
  if(theme === 'hallo'){ if(el) el.remove(); return; } // Halloween a son propre fond (halloFx)
  if(el && el.getAttribute('data-theme') === theme && (theme !== 'casino' || el.querySelector('.amb-wheel') || typeof RL_WHEEL_ORDER === 'undefined')) return;
  if(el) el.remove();
  if(!document.body) return;
  var h = '<div id="amb-fx" data-theme="'+theme+'" aria-hidden="true">';
  var suits = ['♠', '♥', '♦', '♣'];
  // [position gauche en vw, taille px, durée s, décalage s, dérive vw]
  var rise = [[6, 34, 38, -4, 4], [20, 22, 46, -22, -3], [34, 40, 52, -12, 5], [52, 26, 41, -30, -4], [66, 36, 49, -8, 3], [80, 24, 44, -26, -5], [92, 32, 55, -16, 2], [44, 20, 60, -40, 3]];
  rise.forEach(function(r, k){
    h += '<i class="amb-suit s'+(k % 4)+'" style="left:'+r[0]+'vw;font-size:'+r[1]+'px;animation-duration:'+r[2]+'s;animation-delay:'+r[3]+'s;--dx:'+r[4]+'vw;">'+suits[k % 4]+'</i>';
  });
  if(theme === 'casino'){
    var chips = [[12, 30, 26, -3, 6], [38, 24, 31, -15, -5], [58, 34, 28, -9, 4], [76, 26, 34, -21, -6], [90, 30, 29, -12, 3]];
    chips.forEach(function(c, k){
      h += '<i class="amb-chip c'+(k % 4)+'" style="left:'+c[0]+'vw;width:'+c[1]+'px;height:'+c[1]+'px;animation-duration:'+c[2]+'s;animation-delay:'+c[3]+'s;--dx:'+c[4]+'vw;"></i>';
    });
  }
  if(theme === 'casino'){ // 1.11.0 : ambiance casino plus riche (dés, cartes, étincelles, roue de roulette, ornements d'angle, rideaux)
    var dice = [[8, 34, 30, -6, 5], [47, 28, 36, -18, -6], [84, 32, 33, -24, 4]];
    dice.forEach(function(d){ h += '<i class="amb-die" style="left:'+d[0]+'vw;width:'+d[1]+'px;height:'+d[1]+'px;animation-duration:'+d[2]+'s;animation-delay:'+d[3]+'s;--dx:'+d[4]+'vw;"></i>'; });
    var cards = [[26, 30, 40, -8, -5, '♠'], [62, 34, 44, -22, 4, '♥'], [88, 28, 38, -30, -3, '♦']];
    cards.forEach(function(c){ h += '<i class="amb-card'+(c[5] === '♥' || c[5] === '♦' ? ' red' : '')+'" style="left:'+c[0]+'vw;width:'+c[1]+'px;height:'+Math.round(c[1]*1.4)+'px;animation-duration:'+c[2]+'s;animation-delay:'+c[3]+'s;--dx:'+c[4]+'vw;">'+c[5]+'</i>'; });
    [[14, 18], [31, 62], [55, 27], [73, 71], [90, 44], [6, 80], [66, 10], [42, 88]].forEach(function(p, k){ h += '<i class="amb-star" style="left:'+p[0]+'vw;top:'+p[1]+'vh;animation-delay:'+(-k * 0.7)+'s;"></i>'; });
    if(typeof RL_WHEEL_ORDER !== 'undefined') h += '<svg class="amb-wheel" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="99" fill="#2B170A" stroke="#E3C158" stroke-width="2"/><circle cx="100" cy="100" r="95" fill="#0B0B0E"/>'+rlWheelPockets()+'<circle cx="100" cy="100" r="62" fill="#14100B" stroke="#E3C158" stroke-width="1.5"/><path d="M100 60V140M60 100H140" stroke="#E3C158" stroke-width="3"/><circle cx="100" cy="100" r="12" fill="#E3C158"/></svg>';
    h += '<i class="amb-smoke a"></i><i class="amb-smoke b"></i><i class="amb-smoke c"></i><i class="amb-neon" data-noi18n>Casino de Fredo</i>'; // 1.11.0 : touches « mafia » — fumée de cigare, enseigne néon (les stores sont dans le CSS)
    h += '<i class="amb-corner tl"></i><i class="amb-corner tr"></i><i class="amb-corner bl"></i><i class="amb-corner br"></i><i class="amb-curtain l"></i><i class="amb-curtain r"></i>';
  }
  document.body.insertAdjacentHTML('beforeend', h+'</div>');
}
// la roue de roulette (23q-roulette.js) n'existe pas encore au premier appel : on réessaie dès que tout le code est chargé
setTimeout(function(){ try{ ambientFx(deckTheme); }catch(e){ console.error(e); } }, 0);
