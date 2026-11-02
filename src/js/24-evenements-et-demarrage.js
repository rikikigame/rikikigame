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
  else if(action==='fraud-create'){
    showMiniMenu = false;
    var nf = document.getElementById('nameInput'), nfv = nf ? nf.value.trim() : '';
    if(!nfv && !myProfile.name){ errorMsg = 'Entre ton prénom ci-dessus, puis relance le mode frauduleux.'; entryMode='create'; render(); var ff = document.getElementById('nameInput'); if(ff){ ff.focus(); ff.scrollIntoView({ block:'center' }); } return; }
    createGame(nfv || myProfile.name, 'fraud');
  }
  else if(action==='minigames-open' || action==='minigames-close'){ // le prénom déjà tapé doit survivre à l'affichage du menu
    var nm = document.getElementById('nameInput'), kept = nm ? nm.value : '';
    showMiniMenu = action==='minigames-open'; render();
    var nm2 = document.getElementById('nameInput'); if(nm2 && kept) nm2.value = kept;
  }
  else if(action==='blackjack-create'){
    showMiniMenu = false;
    var nb = document.getElementById('nameInput'), nbv = nb ? nb.value.trim() : '';
    if(!nbv && !myProfile.name){ errorMsg = 'Entre ton prénom ci-dessus, puis relance le blackjack.'; entryMode='create'; render(); var fb = document.getElementById('nameInput'); if(fb){ fb.focus(); } return; }
    createGame(nbv || myProfile.name, 'blackjack');
  }
  else if(action==='roulette-create'){
    showMiniMenu = false;
    var nr = document.getElementById('nameInput'), nrv = nr ? nr.value.trim() : '';
    if(!nrv && !myProfile.name){ errorMsg = 'Entre ton prénom ci-dessus, puis relance la roulette.'; entryMode='create'; render(); var fr = document.getElementById('nameInput'); if(fr){ fr.focus(); } return; }
    createGame(nrv || myProfile.name, 'roulette');
  }
  else if(action==='rl-cell'){ if(gameDoc && gameDoc.rl) rlCellPlay(gameDoc.rl, el.getAttribute('data-t'), Number(el.getAttribute('data-v')) || 0); }
  else if(action==='rl-chip'){ if(gameDoc && gameDoc.rl) rlChipSet(el.getAttribute('data-v')); }
  else if(action==='rl-clear'){ if(gameDoc && gameDoc.rl) rlDraftClear(); }
  else if(action==='rl-send'){ if(gameDoc && gameDoc.rl) rlDraftSend(false); }
  else if(action==='rl-pass'){ if(gameDoc && gameDoc.rl) rlDraftSend(true); }
  else if(action==='bj-bet-adj'){ if(gameDoc && gameDoc.bj) bjBetAdjust(gameDoc, el.getAttribute('data-how')); }
  else if(action==='bj-bet'){ if(gameDoc && gameDoc.bj) bjSend('bet', bjBetAmount(gameDoc.bj)); }
  else if(action==='bj-hit'){ bjSend('hit'); }
  else if(action==='bj-stand'){ bjSend('stand'); }
  else if(action==='bj-double'){ bjSend('double'); }
  else if(action==='bj-split'){ bjSend('split'); }
  else if(action==='bj-insure'){ bjSend('insure'); }
  else if(action==='bj-decline'){ bjSend('decline'); }
  else if(action==='poker-create'){
    showMiniMenu = false;
    var np = document.getElementById('nameInput'), npv = np ? np.value.trim() : '';
    if(!npv && !myProfile.name){ errorMsg = 'Entre ton prénom ci-dessus, puis relance le poker.'; entryMode='create'; render(); var fp = document.getElementById('nameInput'); if(fp){ fp.focus(); } return; }
    createGame(npv || myProfile.name, 'poker');
  }
  else if(action==='mini-finish'){ if(gameDoc && gameDoc.hostId===myId && miniOn(gameDoc)) claudeDb.doc('games/'+gameDoc.code).update({ finishAfter: !gameDoc.finishAfter }).catch(function(e){ console.error(e); showToast(dbErrorText(e)); }); }
  else if(action==='poker-fold'){ pokerSend('fold'); }
  else if(action==='poker-check'){ pokerSend('check'); }
  else if(action==='poker-call'){ pokerSend('call'); }
  else if(action==='poker-allin'){ pokerSend('allin'); }
  else if(action==='poker-raise'){ if(gameDoc && gameDoc.poker){ var po = pkOptions(gameDoc.poker, myId); pokerSend('raise', pokerRaiseTarget(gameDoc.poker, po)); } }
  else if(action==='poker-raise-set'){ if(gameDoc && gameDoc.poker) pokerRaiseSet(gameDoc, el.getAttribute('data-how')); }
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
  else if(action==='prefs-toggle'){ showPrefs = !showPrefs; render(); }
  else if(action==='wallet-reset'){ if(!confirmT('Remettre tes jetons du casino au départ ? Ton solde actuel sera remplacé.')) return; walletReset().then(function(b){ showToast('Jetons remis au départ : '+b+' 🎟️'); }).catch(function(e){ console.error(e); showToast('Impossible pour le moment, réessaie.'); }); }
  else if(action==='toggle-settings'){ showSettings = !showSettings; render(); }
  else if(action==='leave'){
    // v77 : double validation avant de quitter une partie en cours (surtout en ligue) ; on peut la reprendre depuis l'accueil pendant 6 h
    var midGame = screen==='game' && gameDoc && ['bidding','playing','round_end','dealing'].indexOf(gameDoc.status)>=0 && gameDoc.players && gameDoc.players[myId];
    if(midGame){
      var inLeague = !!(gameDoc.settings && gameDoc.settings.league);
      if(!confirmT(inLeague ? 'Quitter cette partie de ligue ?\n\nLes autres joueurs continuent sans toi et ton résultat risque de ne pas compter. Tu pourras la reprendre depuis l\'accueil pendant 6 heures.' : 'Quitter la partie en cours ?\n\nTu pourras la reprendre depuis l\'accueil pendant 6 heures.')) return;
    }
    handOverHostOnLeave(gameDoc).catch(function(e){ console.warn('passage de la main', e); });
    leaveToEntry();
  }
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
