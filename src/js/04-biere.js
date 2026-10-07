/* ===================== v46 : « Offrir une bière » (discret) =====================
   Un petit 🍺 en bas de l'accueil, à côté de la version. Il n'apparaît que si BEER_URL est rempli
   (page Buy Me a Coffee du créateur). Rien ne s'ouvre tout seul, jamais pendant une partie. */
var BEER_URL = 'https://buymeacoffee.com/vroombat'; // ← lien de la page (vide = bouton caché)
var beerOpen = false;
function renderBeerModal(){
  var url = BEER_URL;
  return '<div class="modal-backdrop" data-action="beer-close"><div class="card-panel modal" style="max-width:360px; text-align:center;">'
    + '<div style="font-size:40px; line-height:1;">🍺</div><h3 style="margin:8px 0 6px;">Offrir une bière au créateur</h3>'
    + '<p class="muted" style="font-size:13.5px; margin:0 0 14px;">Rikiki est gratuit et sans pub. Si le jeu vous fait passer de bonnes soirées, une bière fait toujours plaisir. Merci !</p>'
    + '<a class="btn" style="display:inline-block; text-decoration:none;" href="'+esc(url)+'" target="_blank" rel="noopener">🍺 Choisir combien de bières</a>'
    + '<div style="margin-top:10px;"><button class="btn ghost small" data-action="beer-close">Non merci</button></div></div></div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="beer-open"], [data-action="beer-close"]') : null; if(!el) return;
  if(el.getAttribute('data-action')==='beer-close' && e.target.closest('.modal') && !e.target.closest('button')) return; // clic dans la fenêtre : on la garde
  beerOpen = el.getAttribute('data-action')==='beer-open'; render();
});

