/* ===================== v24 : sauvegarde / restauration de la ligue =====================
   Télécharge un fichier JSON avec les membres, les parties de ligue, les analyses et le profil « humain ».
   La restauration (organisateur seulement) ne recrée que ce qui manque : elle n'écrase jamais rien. */
var backupUi = { busy:false, msg:'' };
function lastBackupText(){
  var t = 0; try{ t = Number(localStorage.getItem('rikiki_last_backup')) || 0; }catch(e){}
  if(!t) return 'jamais sur cet appareil';
  var days = Math.floor((nowMs()-t)/86400000);
  return days<=0 ? 'aujourd\'hui' : (days===1 ? 'hier' : 'il y a '+days+' jours');
}
async function collectBackup(){
  var out = { app:'rikiki', version: APP_VERSION, at: nowMs(), collections:{}, docs:{} };
  var cols = ['leagueMembers','leagueLinks','leagueGames','analysisGames'];
  for(var i=0;i<cols.length;i++){
    var snap = await claudeDb.collection(cols[i]).limit(5000).get();
    out.collections[cols[i]] = {};
    snap.docs.forEach(function(d){ out.collections[cols[i]][d.id] = d.data(); });
  }
  try{ var ps = await claudeDb.doc('analysis/params').get(); if(ps.exists) out.docs['analysis/params'] = ps.data(); }catch(e){}
  return out;
}
async function downloadBackup(){
  backupUi.busy = true; backupUi.msg = ''; render();
  try{
    var data = await collectBackup();
    var n = Object.keys(data.collections).reduce(function(a,k){ return a + Object.keys(data.collections[k]).length; }, 0);
    var blob = new Blob([JSON.stringify(data, null, 1)], { type:'application/json' });
    var d = new Date(nowMs()), name = 'rikiki-sauvegarde-'+d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')+'.json';
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    try{ localStorage.setItem('rikiki_last_backup', String(nowMs())); }catch(e){}
    backupUi.msg = 'Sauvegarde téléchargée ✓ ('+n+' éléments). Garde le fichier en lieu sûr.';
  }catch(e){ console.error(e); backupUi.msg = 'Sauvegarde impossible : '+dbErrorText(e); }
  backupUi.busy = false; render();
}
async function restoreBackup(file){
  if(!isAdmin() || !file) return;
  backupUi.busy = true; backupUi.msg = 'Restauration…'; render();
  try{
    var data = JSON.parse(await file.text());
    if(!data || data.app!=='rikiki' || !data.collections) throw new Error('ce fichier n\'est pas une sauvegarde Rikiki');
    var created = 0, kept = 0;
    var cols = Object.keys(data.collections).filter(function(k){ return ['leagueMembers','leagueLinks','leagueGames','analysisGames'].indexOf(k)>=0; });
    for(var i=0;i<cols.length;i++){
      var ids = Object.keys(data.collections[cols[i]]);
      for(var j=0;j<ids.length;j++){
        var ref = claudeDb.collection(cols[i]).doc(ids[j]);
        var ex = await ref.get();
        if(ex.exists){ kept++; continue; }
        await ref.set(data.collections[cols[i]][ids[j]]); created++;
      }
    }
    if(data.docs && data.docs['analysis/params']){
      var pr = await claudeDb.doc('analysis/params').get();
      if(!pr.exists){ await claudeDb.doc('analysis/params').set(data.docs['analysis/params']); created++; } else kept++;
    }
    league.loaded = false; loadLeague(true);
    backupUi.msg = 'Restauration terminée ✓ : '+created+' élément'+(created>1?'s':'')+' recréé'+(created>1?'s':'')+', '+kept+' déjà présent'+(kept>1?'s':'')+' (non modifié'+(kept>1?'s':'')+').';
  }catch(e){ console.error(e); backupUi.msg = 'Restauration impossible : '+(e && e.message ? e.message : dbErrorText(e)); }
  backupUi.busy = false; render();
}
function renderBackupPanel(){
  if(!(usingFirebase || usingMock)) return '';
  var html = '<div class="card-panel" style="margin-top:16px;"><h3 style="margin:0 0 6px;">💾 Sauvegarde</h3>'
    + '<p class="muted" style="font-size:13px; margin:0 0 10px;">Télécharge une copie de la ligue (membres, parties, analyses). Dernière sauvegarde : '+lastBackupText()+'.</p>'
    + '<div class="row" style="gap:8px; flex-wrap:wrap;"><button class="btn secondary small" data-action="backup-download" '+(backupUi.busy?'disabled':'')+'>Télécharger la sauvegarde</button>';
  if(isAdmin()) html += '<label class="btn ghost small" style="margin:0; cursor:pointer;">Restaurer…<input type="file" id="backupFile" accept="application/json,.json" style="display:none;"></label>';
  html += '</div>';
  if(backupUi.msg) html += '<p style="font-size:13px; font-weight:700; margin:10px 0 0;">'+esc(backupUi.msg)+'</p>';
  return html + '</div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="backup-download"]') : null; if(!el) return;
  downloadBackup();
});
document.addEventListener('change', function(e){
  if(e.target && e.target.id==='backupFile' && e.target.files && e.target.files[0]){
    if(confirmT('Restaurer cette sauvegarde ? Seuls les éléments manquants seront recréés, rien ne sera écrasé.')) restoreBackup(e.target.files[0]);
    e.target.value = '';
  }
});

/* ===================== v55 : entretien (organisateur) =====================
   1. Vieilles parties : chaque partie en ligne laisse des données (partie, chat, mains, historique…) qui n'étaient jamais
      effacées. On supprime celles sans activité depuis 30 jours (la ligue et l'analyse des robots sont gardées à part).
   2. Anciennes empreintes de code : les profils créés avant les vrais comptes (v25) et jamais reconnectés depuis gardent
      une empreinte de leur code PIN lisible par les joueurs connectés (facile à deviner : 10 000 codes possibles), et
      n'importe qui pouvait s'en déclarer propriétaire. On efface l'empreinte et on verrouille le profil : le joueur
      repasse par « Code oublié » (l'organisateur valide). */
var MAINT_DAYS = 30, maintUi = { busy:false, msg:'' };
var GAME_PARTS = ['chats','gameLogs','hands','botHands','dealerSecrets']; // tout ce qui est rangé sous le code d'une partie
async function oldGameCodes(cutoff, max){
  if(usingFirebase){ // index « __at » (dernière écriture) : on ne télécharge que les vieilles parties
    var snap = await firebase.database().ref('games').orderByChild('__at').endAt(cutoff).limitToFirst(max).once('value');
    var out = []; snap.forEach(function(c){ out.push(c.key); }); return out;
  }
  var all = await claudeDb.collection('games').get(); // mode local de test : date de création
  return all.docs.filter(function(d){ var g = d.data(); return (g.createdAt||0) < cutoff; }).map(function(d){ return d.id; }).slice(0, max);
}
async function cleanOldGames(){
  if(!isAdmin() || maintUi.busy) return;
  var cutoff = nowMs() - MAINT_DAYS*86400000, done = 0;
  maintUi.busy = true; maintUi.msg = 'Recherche des vieilles parties…'; render();
  try{
    var first = await oldGameCodes(cutoff, 40);
    if(!first.length){ maintUi.msg = 'Rien à nettoyer : aucune partie sans activité depuis '+MAINT_DAYS+' jours.'; return; }
    if(!confirmT('Supprimer les parties sans activité depuis '+MAINT_DAYS+' jours ? La ligue, les classements et l\'analyse des robots ne sont pas touchés.')){ maintUi.msg = ''; return; }
    for(var batch = first; batch.length; batch = await oldGameCodes(cutoff, 40)){
      for(var i=0; i<batch.length; i++){
        var code = batch[i];
        for(var k=0; k<GAME_PARTS.length; k++) await claudeDb.doc(GAME_PARTS[k]+'/'+code).delete();
        await claudeDb.doc('games/'+code).delete(); // en dernier : si on est coupé, on la retrouvera au prochain nettoyage
        done++;
        if(done % 10 === 0){ maintUi.msg = 'Nettoyage… '+done+' partie'+(done>1?'s':'')+' supprimée'+(done>1?'s':''); render(); }
      }
      if(done > 5000) break; // garde-fou
    }
    maintUi.msg = 'Nettoyage terminé ✓ '+done+' vieille'+(done>1?'s':'')+' partie'+(done>1?'s':'')+' supprimée'+(done>1?'s':'')+'.';
  }catch(e){ console.error(e); maintUi.msg = 'Nettoyage interrompu ('+done+' supprimée'+(done>1?'s':'')+') : '+dbErrorText(e); }
  finally{ maintUi.busy = false; render(); }
}
async function legacyProfiles(){
  var all = await claudeDb.collection('profiles').get();
  return all.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); })
    .filter(function(p){ return p.pinHash && !(p.__plain && p.__plain.owner); });
}
async function purgeLegacyPins(){
  if(!isAdmin() || maintUi.busy || !authOn()) return; // sans vrais comptes (mode local), l'empreinte EST le code : on n'y touche pas
  maintUi.busy = true; maintUi.msg = 'Recherche des anciens profils…'; render();
  try{
    var list = await legacyProfiles();
    if(!list.length){ maintUi.msg = 'Aucune ancienne empreinte : tous les profils sont protégés ✓'; return; }
    var names = list.map(function(p){ return p.pseudo || p.id; });
    if(!confirmT(list.length+' ancien'+(list.length>1?'s':'')+' profil'+(list.length>1?'s':'')+' jamais reconnecté'+(list.length>1?'s':'')+' : '+names.join(', ')+'.\n\nEffacer leur ancienne empreinte de code ? Ces joueurs devront passer par « Code oublié » (tu valideras sur ton accueil).')){ maintUi.msg = ''; return; }
    for(var i=0; i<list.length; i++){
      var p = list[i], d = stripLegacy(p); delete d.id; delete d.__serverAt;
      // propriétaire « aucun » : plus personne ne peut s'approprier le profil, sauf via « Code oublié » validé par l'organisateur
      await claudeDb.doc('profiles/'+p.id).set(Object.assign(d, { __plain:{ owner:'aucun', email:authEmail(p.id) } }));
    }
    maintUi.msg = 'Fait ✓ '+list.length+' profil'+(list.length>1?'s':'')+' protégé'+(list.length>1?'s':'')+' : '+names.join(', ')+'. Préviens-les de passer par « Code oublié ».';
  }catch(e){ console.error(e); maintUi.msg = 'Impossible : '+dbErrorText(e); }
  finally{ maintUi.busy = false; render(); }
}
function renderMaintenancePanel(){
  if(!isAdmin() || !(usingFirebase || usingMock)) return '';
  var dis = maintUi.busy ? ' disabled' : '';
  return '<div class="card-panel" style="margin-top:16px;"><h3 style="margin:0 0 6px;">🧹 Entretien</h3>'
    + '<p class="muted" style="font-size:13px; margin:0 0 10px;">Réservé à l\'organisateur. Fais d\'abord une sauvegarde.</p>'
    + '<div class="row" style="gap:8px; flex-wrap:wrap;">'
    + '<button class="btn secondary small" data-action="maint-games"'+dis+'>Nettoyer les vieilles parties ('+MAINT_DAYS+' j)</button>'
    + (authOn() ? '<button class="btn secondary small" data-action="maint-pins"'+dis+'>Effacer les anciennes empreintes de code</button>' : '') + '</div>'
    + (maintUi.msg ? '<p style="font-size:13px; font-weight:700; margin:10px 0 0;">'+esc(maintUi.msg)+'</p>' : '')
    + '</div>';
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-action="maint-games"], [data-action="maint-pins"]') : null; if(!el) return;
  if(el.getAttribute('data-action')==='maint-games') cleanOldGames(); else purgeLegacyPins();
});

