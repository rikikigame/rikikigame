/* ===================== events ===================== */
// clic à l'intérieur d'une fenêtre : ne pas la fermer (sauf via un vrai bouton à l'intérieur, ex. « Fermer »)
document.addEventListener('click', function(e){
  if(!e.target.closest || !e.target.closest('.modal')) return;
  var el = e.target.closest('[data-action]');
  if(el && el.classList.contains('modal-backdrop')) e.stopImmediatePropagation();
}, true);
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-action]');
  if(!el) return;
  var action = el.getAttribute('data-action');
  if(action==='mode-create'){ entryMode='create'; errorMsg=''; render(); }
  else if(action==='mode-join'){ entryMode='join'; errorMsg=''; render(); }
  else if(action==='do-create'){
    var nameEl = document.getElementById('nameInput');
    createGame(nameEl ? nameEl.value : '');
  }
  else if(action==='quick-create'){
    var nq = document.getElementById('nameInput'), nv = nq ? nq.value.trim() : '';
    if(!nv && !myProfile.name){ errorMsg = 'Entre ton prénom ci-dessus, puis relance la partie rapide.'; entryMode='create'; render(); var f = document.getElementById('nameInput'); if(f){ f.focus(); f.scrollIntoView({ block:'center' }); } return; }
    createGame(nv || myProfile.name, 'quick');
  }
  else if(action==='do-join'){
    var nameEl2 = document.getElementById('nameInput');
    var codeEl = document.getElementById('joinCodeInput');
    joinGame(codeEl ? codeEl.value : '', nameEl2 ? nameEl2.value : '');
  }
  else if(action==='start-game'){ startGame(); }
  else if(action==='toggle-ready'){ toggleReady(); }
  else if(action==='reset-scoring'){ updateSettings({ scoring: Object.assign({}, ONLINE_DEFAULT_SCORING) }); }
  else if(action==='add-bot'){ addBot(); }
  else if(action==='remove-bot'){ removeBot(el.getAttribute('data-bot')); }
  else if(action==='bid'){ submitBid(parseInt(el.getAttribute('data-value'),10)); }
  else if(action==='play-card'){
    var suit = el.getAttribute('data-suit'), rank = el.getAttribute('data-rank');
    playCard({ suit:suit, rank:rank, value:RANK_VALUE[rank] });
  }
  else if(action==='deal-next'){ dealNextRound(); }
  else if(action==='toggle-rules'){ showRules = !showRules; render(); }
  else if(action==='skip-intro'){ introData=null; clearTimeout(introTimer); renderIntroLayer(); }
  else if(action==='toggle-scores'){ showScores = !showScores; render(); }
  else if(action==='sfx-toggle'){ toggleSfx(); }
  else if(action==='music-toggle'){ toggleMusic(); }
  else if(action==='toggle-settings'){ showSettings = !showSettings; render(); }
  else if(action==='leave'){ leaveToEntry(); }
  else if(action==='replay'){ replayGame().catch(function(e){ console.error(e); showToast(dbErrorText(e)); }); }
  else if(action==='retry'){ retryInit(); }
});

document.addEventListener('change', function(e){
  var el = e.target.closest('[data-action-change]');
  if(!el) return;
  var action = el.getAttribute('data-action-change');
  if(action==='set-start-size'){
    var v = Math.max(1, Math.min(26, parseInt(el.value,10)||7));
    updateSettings({ startSize: v });
  } else if(action==='set-direction'){
    updateSettings({ direction: el.value });
  } else if(action==='set-scoring'){
    var key = el.getAttribute('data-key');
    var f = SCORING_FIELDS.filter(function(x){ return x.key===key; })[0];
    if(!f) return;
    var n = parseInt(el.value,10); if(!isFinite(n)) n = ONLINE_DEFAULT_SCORING[key];
    n = Math.max(f.min, Math.min(f.max, n));
    var sp = {}; sp[key] = n;
    updateSettings({ scoring: sp });
  } else if(action==='set-league'){
    updateSettings({ league: !!el.checked });
  } else if(action==='set-blind'){
    updateSettings({ blindOne: !!el.checked });

  } else if(action==='set-coach'){
    updateSettings({ coachAllowed: el.value==='1' });
  } else if(action==='set-botlevel'){
    updateSettings({ botLevel: BOT_LEVEL_LABEL[el.value] ? el.value : 'humain' });
  } else if(action==='set-timer'){
    updateSettings({ turnTimer: Math.max(0, parseInt(el.value,10)||0) });
  }
});

document.addEventListener('keydown', function(e){
  if(e.key==='Enter'){
    var active = document.activeElement;
    if(active && active.id==='nameInput' && entryMode==='create'){ document.querySelector('[data-action="do-create"]').click(); }
    if(active && (active.id==='joinCodeInput' || active.id==='nameInput') && entryMode==='join'){ document.querySelector('[data-action="do-join"]').click(); }
  }
});

init();
