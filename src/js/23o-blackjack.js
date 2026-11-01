/* ===================== 1.11.0 : blackjack + menu « Mini casino » =====================
   JETONS FICTIFS. Même architecture que le poker (23m-poker.js) : une partie normale (salon, code) repérée par kind:'blackjack' ;
   l'organisateur est le croupier : il tient le sabot en mémoire, applique chaque mise / action avec le moteur (23n-blackjack-moteur.js)
   et écrit l'état public « bj ». Les joueurs déposent seulement leur mise ou leur action dans bjActs. On peut jouer seul contre le croupier.
   Statuts : 'lobby' → 'blackjack' → 'blackjack_end'. Aucune règle Firebase nouvelle. */
function bjOn(g){ return !!(g && g.kind === 'blackjack'); }
function miniOn(g){ return pokerOn(g) || bjOn(g) || rlOn(g); }
var bjSecret = null, bjBusy = false, bjSeen = { key: '', at: 0 }, bjBetDraft = { key: '', amount: 0 };
var BJ_BOT_MS = 1100, BJ_BREAK_MS = 7000, BJ_BET_SEC = 20, BJ_TURN_SEC = 20;
var showMiniMenu = false;

/* ---------- routage commun poker / blackjack ---------- */
function miniStart(g){ return pokerOn(g) ? startPoker() : (rlOn(g) ? startRoulette() : startBlackjack()); }
function miniHostTick(g){ try{ lateHostTick(g); }catch(e){ console.warn(e); } if(pokerOn(g)) pokerHostTick(g); else if(bjOn(g)) bjHostTick(g); else if(rlOn(g)) rlHostTick(g); }
function miniTimerTick(g){ try{ walletTick(g); }catch(e){ console.warn(e); } if(pokerOn(g)) pokerTimerTick(g); else if(bjOn(g)) bjTimerTick(g); else if(rlOn(g)) rlTimerTick(g); }
function miniHelpLines(g){ return pokerOn(g) ? pokerHelpLines(g) : (rlOn(g) ? rlHelpLines(g) : bjHelpLines(g)); }
function renderMini(g){
  var html = '', mst = g.poker || g.bj || g.rl;
  if(g.status !== 'lobby' && !(g.players && g.players[myId])) return renderLateWaiting(g) + (showPrefs ? renderPrefsModal() : ''); // demande envoyée, pas encore ajouté
  if(g.status !== 'lobby' && g.status.slice(-4) !== '_end' && mst && mst.seats && mst.seats.indexOf(myId) < 0) html += renderLateWaiting(g); // ajouté, assis à la prochaine main
  if(g.status === 'lobby') html += renderLobbyInvite(g) + renderCasinoLobby(g);
  else html += pokerOn(g) ? renderPoker(g) : (rlOn(g) ? renderRoulette(g) : renderBlackjack(g));
  if(showPrefs) html += renderPrefsModal();
  if(showRules) html += pokerOn(g) ? renderPokerRules() : (rlOn(g) ? renderRlRules() : renderBjRules());
  return html;
}
function miniClearSecrets(){ pokerSecret = null; bjSecret = null; rlSecret = null; lateWait = ''; lateHostStop(); }

/* ---------- menu « Mini casino » (poker, blackjack, roulette ; le mode frauduleux se coche dans le salon d'une partie normale) ---------- */
function renderMiniMenu(){
  var item = function(action, icon, title, sub){
    return '<button class="hc-tile" data-action="'+action+'" style="width:100%; margin-top:8px;"><span style="font-size:26px;">'+icon+'</span><span class="hc-tile-txt"><span class="hc-tile-title">'+title+'</span><span class="hc-tile-sub">'+sub+'</span></span></button>';
  };
  return '<div class="modal-backdrop" data-action="minigames-close"><div class="card-panel modal">'
    + '<button class="btn secondary small close-x" data-action="minigames-close">Fermer</button>'
    + '<h3>Mini casino</h3><p class="muted" style="margin:0 0 4px;">Entre ton prénom en haut de l\'accueil, puis choisis. Tous les jetons sont faux : on ne joue jamais avec de l\'argent.</p>'
    + item('poker-create', '♠', 'Poker Texas Hold\'em', '2 à 8 joueurs · robots possibles')
    + item('blackjack-create', '♥', 'Blackjack', 'Seul contre le croupier, ou à plusieurs')
    + item('roulette-create', '🎡', 'Roulette', 'Seul ou à plusieurs · rouge, noir, numéros…')
    + '</div></div>';
}

/* ---------- salon commun ---------- */
// pas de nombre de manches fixé : on joue jusqu'à ce qu'il ne reste plus de jetons, ou que l'organisateur arrête (total 0 = sans limite)
function casinoRoundsTotal(){ return 0; }
function miniCount(word, st){ return word+' '+st.n+(st.total > 0 ? ' / '+st.total : ''); }
// bouton de l'organisateur : arrêter la partie à la fin de la main / manche / tour en cours (on peut changer d'avis)
function miniFinishHtml(g, what){
  if(/_end$/.test(g.status)) return '';
  if(g.hostId === myId) return '<div class="mini-finish">'+(g.finishAfter ? '<span class="muted">La partie s\'arrête à la fin de '+what+'.</span> <button class="btn ghost small" data-action="mini-finish">Continuer</button>' : '<button class="btn ghost small" data-action="mini-finish">Arrêter après '+what+'</button>')+'</div>';
  return g.finishAfter ? '<div class="mini-finish"><span class="muted">La partie s\'arrête à la fin de '+what+'.</span></div>' : '';
}

/* ---------- le croupier ---------- */
async function startBlackjack(){
  var g = gameDoc;
  if(!bjOn(g) || g.hostId !== myId || g.status !== 'lobby') return;
  var ids = Object.keys(g.players).sort(function(a, b){ return g.players[a].joinedAt - g.players[b].joinedAt; });
  if(!ids.length || !ids.every(function(id){ return g.players[id].ready; })) return;
  var stacks = {}; ids.forEach(function(id){ stacks[id] = miniStartStack(g, id); }); // jetons de départ : classement du mois dernier (23s)
  var st = bjStartRound(ids, stacks, 1, casinoRoundsTotal(g), null);
  if(st) await bjBeginRound(g, st, { startedAt: nowMs() });
}
async function bjBeginRound(g, st, extra){
  bjBusy = true;
  try{
    bjSecret = { code: g.code, n: st.n, shoe: bjShoe(Math.floor(Math.random() * 4294967296)) };
    st.betAt = nowMs();
    await bjWrite(g, st, extra);
  }catch(e){ console.error(e); bjSecret = null; }
  finally{ bjBusy = false; }
}
async function bjWrite(g, st, extra){
  st.turnAt = nowMs();
  var over = !!(st.result && bjGameOver(st));
  var patch = Object.assign({ bj: replaceWhole(st), status: over ? 'blackjack_end' : 'blackjack' }, extra || {});
  await claudeDb.doc('games/'+g.code).update(patch);
}
function bjRestartRound(g){
  var st0 = g.bj, ro = miniRoster(g, st0, st0.startStacks), st = bjStartRound(ro.seats, ro.stacks, st0.n, st0.total, st0.lastBets);
  if(st) bjBeginRound(g, st);
}
async function bjFinish(g, st0){
  bjBusy = true;
  try{ await bjWrite(g, Object.assign({}, st0, { finish: true })); }catch(e){ console.error(e); }
  finally{ bjBusy = false; }
}
function bjNextRound(g){
  if(g.finishAfter){ bjFinish(g, g.bj); return; }
  var st0 = g.bj, ro = miniRoster(g, st0, st0.stacks), st = bjStartRound(ro.seats, ro.stacks, st0.n + 1, st0.total, st0.lastBets);
  if(st) bjBeginRound(g, st);
}
async function bjApply(g, fn){
  if(!bjSecret || bjSecret.n !== g.bj.n) return false;
  var next = fn(g.bj, bjSecret);
  if(!next) return false;
  bjBusy = true;
  try{ await bjWrite(g, next); }catch(e){ console.error(e); }
  finally{ bjBusy = false; }
  return true;
}
function bjHostTick(g){
  miniStallTick(g, g.bj, 'blackjack');
  if(g.hostId !== myId || g.status !== 'blackjack' || bjBusy || !g.bj) return;
  var st = g.bj;
  if(!st.result && (!bjSecret || bjSecret.code !== g.code || bjSecret.n !== st.n)){ bjRestartRound(g); return; }
  if(st.result){
    var dk = g.code+'|'+st.n;
    if(bjSeen.key !== dk){ bjSeen = { key: dk, at: nowMs() }; return; }
    if(nowMs() - bjSeen.at >= BJ_BREAK_MS) bjNextRound(g);
    return;
  }
  var acts = g.bjActs || {};
  if(st.phase === 'bet'){
    var key = g.code+'|'+st.n+'|bet|'+st.seq;
    if(bjSeen.key !== key){ bjSeen = { key: key, at: nowMs() }; return; }
    var waiting = st.order.filter(function(p){ return !st.placed[p]; });
    for(var i = 0; i < waiting.length; i++){
      var id = waiting[i], pl = g.players[id];
      if(pl && pl.isBot){
        if(nowMs() - bjSeen.at < 900) continue;
        var amt = bjBotBet(st, id, Math.random);
        bjApply(g, function(s, sec){ return bjBet(s, id, amt, sec); });
        return;
      }
      var a = acts[id];
      if(a && a.n === st.n && a.type === 'bet'){
        bjApply(g, function(s, sec){ return bjBet(s, id, a.to, sec); }).then(function(okay){ if(!okay) bjSeen = { key: key, at: nowMs() }; });
        return;
      }
    }
    if(nowMs() - (st.betAt || bjSeen.at) > BJ_BET_SEC * 1000 + 2000 && waiting.length){ // trop long : la dernière mise (ou la mise minimale)
      var w = waiting[0];
      bjApply(g, function(s, sec){ return bjBet(s, w, Math.max(BJ_MIN_BET, Math.min(bjMaxBetFor(s, w), s.lastBets[w] || BJ_MIN_BET)), sec); });
    }
    return;
  }
  if(st.phase === 'insurance'){ // le croupier montre un as : chacun répond (les robots refusent, un silence trop long vaut refus)
    var ikey = g.code+'|'+st.n+'|ins|'+st.seq;
    if(bjSeen.key !== ikey){ bjSeen = { key: ikey, at: nowMs() }; return; }
    for(var j = 0; j < st.insWait.length; j++){
      var w = st.insWait[j], wp = g.players[w], wa = acts[w];
      if(wp && wp.isBot){
        if(nowMs() - bjSeen.at < 800) continue;
        bjApply(g, function(s, sec){ return bjInsure(s, w, false, sec); });
        return;
      }
      if(wa && wa.n === st.n && (wa.type === 'insure' || wa.type === 'decline')){
        bjApply(g, function(s, sec){ return bjInsure(s, w, wa.type === 'insure', sec); }).then(function(okay){ if(!okay) bjSeen = { key: ikey, at: nowMs() }; });
        return;
      }
    }
    if(nowMs() - (st.turnAt || bjSeen.at) > BJ_TURN_SEC * 1000 + 2000 && st.insWait.length){ var w0 = st.insWait[0]; bjApply(g, function(s, sec){ return bjInsure(s, w0, false, sec); }); }
    return;
  }
  var pid = st.turn;
  if(!pid){ bjRestartRound(g); return; }
  var pkey = g.code+'|'+st.n+'|'+st.seq+'|'+pid;
  if(bjSeen.key !== pkey){ bjSeen = { key: pkey, at: nowMs() }; return; }
  var p = g.players[pid];
  if(p && p.isBot){
    if(nowMs() - bjSeen.at < BJ_BOT_MS) return;
    var d = bjBotAct(st, pid);
    bjApply(g, function(s, sec){ return bjAct(s, pid, d, sec); });
    return;
  }
  var pa = acts[pid];
  if(pa && pa.n === st.n && pa.seq === st.seq && pa.type !== 'bet'){
    bjApply(g, function(s, sec){ return bjAct(s, pid, { type: pa.type }, sec); }).then(function(okay){ if(!okay) bjSeen = { key: pkey, at: nowMs() - 1 }; });
    return;
  }
  if(nowMs() - (st.turnAt || bjSeen.at) > BJ_TURN_SEC * 1000 + 2000) bjApply(g, function(s, sec){ return bjAct(s, pid, { type: 'stand' }, sec); });
}

/* ---------- ce que fait le joueur ---------- */
function bjSend(type, to){
  var g = gameDoc;
  if(!bjOn(g) || g.status !== 'blackjack' || !g.bj) return;
  var st = g.bj;
  if(type === 'bet'){
    if(st.phase !== 'bet' || st.placed[myId] || st.mode[myId] !== 'bet') return;
    if(g.hostId === myId){ bjApply(g, function(s, sec){ return bjBet(s, myId, to, sec); }); return; }
  } else if(type === 'insure' || type === 'decline'){
    if(st.phase !== 'insurance' || st.insWait.indexOf(myId) < 0) return;
    if(g.hostId === myId){ bjApply(g, function(s, sec){ return bjInsure(s, myId, type === 'insure', sec); }); return; }
  } else {
    if(st.phase !== 'play' || st.turn !== myId) return;
    if(g.hostId === myId){ bjApply(g, function(s, sec){ return bjAct(s, myId, { type: type }, sec); }); return; }
  }
  var patch = { bjActs: {} };
  patch.bjActs[myId] = { n: st.n, seq: st.seq, type: type, to: to || 0, at: nowMs() };
  claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); showToast('Action non envoyée : réessaie.'); });
}
function bjBetAmount(st){
  var key = st.n+'|bet';
  if(bjBetDraft.key !== key){
    var want = st.lastBets[myId] || 25;
    bjBetDraft = { key: key, amount: want };
  }
  bjBetDraft.amount = Math.max(BJ_MIN_BET, Math.min(bjMaxBetFor(st, myId), bjBetDraft.amount));
  return bjBetDraft.amount;
}
function bjBetAdjust(g, how){
  var st = g.bj, cur = bjBetAmount(st), t = cur;
  if(how === 'max') t = bjMaxBetFor(st, myId);
  else if(how === 'clear') t = BJ_MIN_BET;
  else t = cur + Number(how);
  bjBetDraft = { key: st.n+'|bet', amount: Math.max(BJ_MIN_BET, Math.min(bjMaxBetFor(st, myId), t)) };
  render();
}

/* ---------- écran ---------- */
// durée de la révélation du croupier : sa carte cachée se retourne (0,5 s), puis chaque carte tirée arrive (voir bjHandHtml). Le total, les gains et
// la phrase de Fredo n'apparaissent qu'après, pour ne pas gâcher le suspense (même après un rechargement de l'écran : on part de l'heure de l'écriture).
function bjRevealWait(st){
  if(!st.result) return 0;
  var draws = Math.max(0, st.dealer.length - 2), total = (draws ? 520 + (draws - 1) * 390 : 0) + 500 + 150;
  return Math.max(0, total - Math.max(0, nowMs() - (st.turnAt || nowMs())));
}
function bjRevealStyle(st){ var w = bjRevealWait(st); return w > 0 ? ' style="animation:rlReveal .5s ease '+Math.round(w)+'ms both;"' : ''; }
var BJ_TAGS = { bj: ['Blackjack !', 'a'], bust: ['Dépassé', 'f'], stand: ['Reste', ''], play: ['', ''], bet: ['', ''], out: ['Plus de jetons', 'f'] };
function bjHandHtml(cards, hideSecond, key, seatNo, nSeats, width){ // key : endroit de la table ; seatNo / nSeats : ordre de distribution (une carte à chacun, puis la 2e)
  var h = cards.map(function(c, i){
    var html = cardHtml(c);
    if(!key) return html;
    var dealer = key.indexOf('|dealer') > 0, kind = (dealer && i === 1) ? 'flip' : 'deal'; // la carte cachée du croupier se retourne
    // croupier : d'abord la carte cachée se retourne, puis seulement il tire ses cartes, une par une
    var order = dealer ? (i === 0 ? seatNo : (i === 1 ? 0 : 4 + (i - 2) * 3)) : (i < 2 ? i * (nSeats + 1) + seatNo : 0);
    return miniAnim(html, key+'|'+i+c.rank+c.suit, order, kind);
  }).join('');
  if(hideSecond) h += key ? miniAnim('<div class="card back"></div>', key+'|hole', nSeats + 1 + seatNo, 'deal') : '<div class="card back"></div>';
  return '<div class="pk-cards bj-cards" style="--cw:'+(width || 64)+'px;">'+h+'</div>';
}
function renderBjSeat(g, st, id){ // un « poste » de la table : les cartes, le cercle de mise (jetons), puis la plaquette du joueur
  var p = g.players[id]; if(!p) return '';
  var mode = st.mode[id], hids = bjHandIds(st, id);
  var cls = 'bj-spot' + (st.turn === id ? ' turn' : '') + (mode === 'out' ? ' out' : '') + (id === myId ? ' me' : '');
  var tags = [];
  hids.forEach(function(hid){
    var m = st.mode[hid];
    if(BJ_TAGS[m] && BJ_TAGS[m][0]) tags.push('<span class="pk-tag '+BJ_TAGS[m][1]+'">'+BJ_TAGS[m][0]+'</span>');
    if(st.doubled[hid]) tags.push('<span class="pk-tag d">Double</span>');
  });
  if(st.ins && st.ins[id]) tags.push('<span class="pk-tag d">Assuré</span>');
  if(st.phase === 'bet' && mode === 'bet') tags.push('<span class="pk-tag '+(st.placed[id] ? 'd' : 'f')+'">'+(st.placed[id] ? 'A misé' : 'Mise…')+'</span>');
  var h = '<div class="'+cls+'" data-seat="'+esc(id)+'">';
  h += '<div class="bj-hand'+(hids.length > 1 ? ' split' : '')+'">'+(st.hands[id].length ? hids.map(function(hid, hi){
    var val = bjValue(st.hands[hid]), live = hids.length > 1 && st.turn === id && st.turnHand === hid; // après une séparation : la main en jeu est entourée d'or
    return '<div class="bj-hand-one'+(live ? ' live' : (hids.length > 1 && st.turn === id ? ' wait' : ''))+'">'+(hids.length > 1 ? '<div class="bj-hand-name">'+(live ? '▶ ' : '')+'Main '+(hi + 1)+'</div>' : '')+bjHandHtml(st.hands[hid], false, g.code+'|'+st.n+'|'+hid, Math.max(0, st.seats.indexOf(id)), st.seats.length, hids.length > 1 ? 44 : 64)
      + '<div class="bj-total">'+(val.soft && !val.bust && val.total < 21 ? val.total+' (as = 11)' : val.total)+'</div></div>';
  }).join('') : '<div class="bj-nohand"></div>')+'</div>';
  h += '<div class="bj-circle">'+(st.bets[id] > 0 ? '<span class="bj-chip v'+rlChipClass(hids.reduce(function(sum, hid){ return sum + st.bets[hid]; }, 0))+'">'+hids.reduce(function(sum, hid){ return sum + st.bets[hid]; }, 0)+'</span>' : '');
  var o = st.result && st.result.outcomes[id];
  if(o && o.res !== 'out') h += '<div class="pk-won'+(o.delta < 0 ? ' neg' : '')+'"'+(bjRevealWait(st) > 0 ? ' style="animation-delay:'+Math.round(bjRevealWait(st))+'ms; animation-fill-mode:both;"' : '')+'>'+(o.delta > 0 ? '+' : '')+o.delta+'</div>';
  h += '</div>';
  h += '<div class="bj-plate"><div class="avatar" style="background:'+safeColor(p.color)+'; color:'+inkOn(safeColor(p.color))+';">'+(p.isBot?'🤖':esc(initials(p.name)))+'</div>'
    + '<div class="pk-seat-txt"><div class="pk-name">'+esc(p.name)+(id===myId?' (toi)':'')+'</div><div class="pk-stack">'+pokerChips(st.stacks[id])+'</div></div></div>';
  if(tags.length) h += '<div class="pk-tags" style="justify-content:center;">'+tags.join('')+'</div>';
  return h + '</div>';
}
function bjResultHtml(g, st){
  var mine = st.result.outcomes[myId], line = '';
  if(mine && mine.res !== 'out'){
    line = ({ win: 'Tu gagnes ', bj: 'Blackjack ! Tu gagnes ', push: 'Égalité : ta mise te revient.', lose: 'Tu perds ' }[mine.res] || '') + (mine.res === 'win' || mine.res === 'bj' ? pokerChips(mine.delta) : (mine.res === 'lose' ? pokerChips(-mine.delta) : ''));
  }
  var left = Math.max(0, BJ_BREAK_MS - (nowMs() - (bjSeen.key === g.code+'|'+st.n ? bjSeen.at : nowMs())));
  var over = bjGameOver(st);
  return '<div class="pk-result"'+bjRevealStyle(st)+'><div>'+(st.result.dealerBust ? 'Le croupier dépasse (' + st.dealerTotal + ').' : (st.result.dealerBj ? 'Blackjack du croupier.' : 'Le croupier reste à '+st.dealerTotal+'.'))+'</div>'
    + (line ? '<div><strong>'+line+'</strong></div>' : '')
    + (over ? '' : '<div class="muted" style="margin-top:6px;">Manche suivante dans <span id="bj-next">'+Math.ceil(left / 1000)+'</span> s</div>')+'</div>';
}
function bjActionsHtml(g, st){
  var me = st.mode[myId];
  if(st.phase === 'bet'){
    if(me !== 'bet') return '<div class="pk-wait muted">'+(me === 'out' ? 'Tu n\'as plus de jetons : regarde les autres, ou va te refaire contre des robots 😄' : '')+'</div>';
    if(st.placed[myId]) return '<div class="pk-wait muted">Mise de '+pokerChips(st.bets[myId])+' posée. On attend les autres joueurs…</div>';
    var amt = bjBetAmount(st), maxBet = bjMaxBetFor(st, myId);
    var steps = BJ_CHIP_STEPS.filter(function(s){ return s <= maxBet; });
    return '<div class="pk-actions"><div class="pk-timer">Ta mise : <strong>'+pokerChips(amt)+'</strong> <span id="bj-timer" class="turn-timer"></span></div>'
      + '<div class="pk-raise-row">'+steps.map(function(s){ return '<button class="btn secondary small" data-action="bj-bet-adj" data-how="'+s+'">+'+s+'</button>'; }).join('')+'</div>'
      + '<div class="pk-raise-row"><button class="btn ghost small" data-action="bj-bet-adj" data-how="clear">Effacer</button><button class="btn ghost small" data-action="bj-bet-adj" data-how="max">Max ('+maxBet+')</button></div>'
      + '<div class="pk-btns" style="margin-top:10px;"><button class="btn" data-action="bj-bet">Miser '+amt+'</button></div></div>';
  }
  if(st.phase === 'insurance'){
    if(st.insWait.indexOf(myId) < 0) return '<div class="pk-wait muted">'+(me === 'out' ? '' : (st.ins[myId] ? 'Assurance prise. On attend les autres…' : 'On attend les réponses pour l\'assurance…'))+'</div>';
    var cost = Math.floor(st.bets[myId] / 2);
    return '<div class="pk-actions"><div class="pk-timer">Le croupier montre un as. Assurance ? <span id="bj-timer" class="turn-timer"></span></div>'
      + '<div class="muted" style="font-size:13px; margin:2px 0 8px;">Elle coûte '+pokerChips(cost)+' et paie 2 contre 1 si le croupier a un blackjack.</div>'
      + '<div class="pk-btns"><button class="btn secondary" data-action="bj-decline">Non merci</button><button class="btn" data-action="bj-insure">M\'assurer ('+cost+')</button></div></div>';
  }
  if(st.phase !== 'play') return '';
  if(st.turn !== myId){
    var who = st.turn ? esc(g.players[st.turn] ? g.players[st.turn].name : '?') : '';
    return '<div class="pk-wait muted">'+(me === 'play' ? 'C\'est à <strong>'+who+'</strong> de jouer…' : (me === 'out' || me === 'bet' ? '' : 'Ta main est terminée : on attend la suite.'))+'</div>';
  }
  return '<div class="pk-actions"><div class="pk-timer">À toi ! <span id="bj-timer" class="turn-timer"></span></div><div class="pk-btns">'
    + '<button class="btn secondary" data-action="bj-stand">Rester</button><button class="btn" data-action="bj-hit">Tirer</button>'
    + (bjCanDouble(st, myId) ? '<button class="btn secondary" data-action="bj-double">Doubler</button>' : '')
    + (bjCanSplit(st, myId) ? '<button class="btn secondary" data-action="bj-split">Séparer</button>' : '')+'</div>'
    + bjNoChipsHint(st)+'</div>';
}
// paire (ou 2 cartes) mais plus assez de jetons pour la 2e mise : on explique pourquoi « Séparer » / « Doubler » n'apparaissent pas
function bjNoChipsHint(st){
  var hid = st.turnHand || myId, hand = st.hands[hid];
  if(!hand || hand.length !== 2 || st.split[myId] || st.stacks[myId] >= st.bets[hid]) return '';
  return '<div class="muted" style="font-size:12px; text-align:center; margin-top:6px;">Pour doubler'+(hand[0].rank === hand[1].rank ? ' ou séparer' : '')+', il faut avoir autant de jetons de côté que ta mise ('+st.bets[hid]+').</div>';
}
function renderBlackjack(g){
  var st = g.bj;
  if(!st) return '<div class="center-wrap"><span class="muted">Distribution…</span></div>';
  var h = '<div class="pk-head"><div><div class="eyebrow">'+miniCount('Manche', st)+'</div><div class="display" style="font-size:22px;">'+({ bet: 'Place ta mise', insurance: 'Assurance ?', play: 'On joue', done: 'Résultat' }[st.phase] || '')+'</div></div>'
    + miniHeadRight(st, 'Mises '+BJ_MIN_BET+' – '+BJ_MAX_BET);
  h += miniFinishHtml(g, 'cette manche') + croupierFor(g) + '<div class="bj-felt"><div class="bj-shoe" aria-hidden="true"></div><div class="bj-dealer"><div class="eyebrow" style="color:#F3E2A8;">Croupier</div>';
  if(st.dealer.length){
    var dv = bjValue(st.dealer);
    h += bjHandHtml(st.dealer, st.dealerHole, g.code+'|'+st.n+'|dealer', st.seats.length, st.seats.length)+'<div class="bj-total"'+(st.dealerHole ? '' : bjRevealStyle(st))+'>'+(st.dealerHole ? bjValue([st.dealer[0]]).total : (dv.bust ? dv.total+' · dépasse' : dv.total))+'</div>';
  } else h += '<div class="muted" style="margin:10px 0;">Les cartes arrivent après les mises.</div>';
  h += '</div><svg class="bj-arc" viewBox="0 0 320 120" aria-hidden="true">'
    + '<text x="160" y="28" fill="#F25565" font-size="27" font-weight="900" letter-spacing="1" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif">BLACKJACK</text>'
    + '<text x="160" y="50" fill="#F25565" font-size="14" font-weight="800" text-anchor="middle" font-family="Bricolage Grotesque,Arial,sans-serif">PAYS 3 TO 2</text>'
    + '<path id="bjArcP" d="M24 114Q160 66 296 114" fill="none" stroke="#F4F1E4" stroke-width="1.6" opacity="0.9"/>'
    + '<path id="bjArcT" d="M40 104Q160 58 280 104" fill="none"/><text fill="#F4F1E4" font-size="7.6" letter-spacing="1" text-anchor="middle" opacity="0.85" font-family="Bricolage Grotesque,Arial,sans-serif"><textPath href="#bjArcT" startOffset="50%">DEALER DRAWS TO 16, STANDS ON 17</textPath></text></svg>'
    + '<div class="bj-seats'+(st.seats.length <= BJ_MAX_PLAYERS ? ' arc n'+st.seats.length : '')+'">'+st.seats.map(function(id){ return renderBjSeat(g, st, id); }).join('')+'</div></div>';
  if(st.result) h += bjResultHtml(g, st);
  if(g.status === 'blackjack_end') h += pokerRanking(g, st);
  else if(!st.result) h += bjActionsHtml(g, st);
  return h;
}
function bjTimerTick(g){
  if(!g || !g.bj) return;
  var st = g.bj, el = document.getElementById('bj-timer');
  if(el){
    var base = st.phase === 'bet' ? (st.betAt || nowMs()) : (st.turnAt || nowMs()), lim = st.phase === 'bet' ? BJ_BET_SEC : BJ_TURN_SEC;
    var left = Math.max(0, lim - Math.floor((nowMs() - base) / 1000));
    el.textContent = '⏱ '+left+' s'; el.className = 'turn-timer'+(left <= 6 ? ' hot' : '');
  }
  var nx = document.getElementById('bj-next');
  if(nx && bjSeen.key === g.code+'|'+st.n) nx.textContent = Math.max(0, Math.ceil((BJ_BREAK_MS - (nowMs() - bjSeen.at)) / 1000));
}
function renderBjRules(){
  return '<div class="modal-backdrop" data-action="toggle-rules"><div class="card-panel modal">'
    + '<button class="btn secondary small close-x" data-action="toggle-rules">Fermer</button><h3>Blackjack</h3>'
    + '<p>But : te rapprocher de <strong>21</strong> sans le dépasser, et battre le croupier. Les figures valent 10, l\'as vaut 1 ou 11.</p>'
    + '<p>Tu mises, puis tu reçois 2 cartes ; le croupier montre une carte. <strong>Tirer</strong> = une carte de plus. <strong>Rester</strong> = tu gardes ta main. <strong>Doubler</strong> = tu doubles ta mise, tu reçois une seule carte et tu restes. <strong>Séparer</strong> = seulement si tu as une paire (deux cartes identiques, comme deux 8 ou deux rois), tu en fais deux mains, avec une seconde mise (une seule fois par manche ; avec deux as, une seule carte chacun).</p>'
    + '<p>Si tu dépasses 21, tu perds. Ensuite le croupier tire jusqu\'à 17 (et reste sur tous les 17). Tu gagnes ta mise si tu bats le croupier ; égalité : on te rend ta mise.</p>'
    + '<p>Un <strong>blackjack</strong> (as + une carte de valeur 10 dès le départ) est payé 3 contre 2. Un 21 après une séparation n\'est pas un blackjack.</p>'
    + '<p><strong>Assurance</strong> : quand le croupier montre un as, tu peux t\'assurer pour la moitié de ta mise. Si le croupier a un blackjack, l\'assurance paie 2 contre 1 ; sinon, tu la perds et la manche continue.</p>'
    + '<p class="muted">Tous les jetons sont faux : on ne joue jamais avec de l\'argent.</p></div></div>';
}
function bjHelpLines(g){
  var st = g.bj;
  if(g.status === 'lobby') return ['Touche « Je suis prêt » quand tu veux.', 'Tu peux jouer seul contre le croupier, ou ajouter des robots.'];
  if(!st) return ['Les cartes arrivent : un instant.'];
  if(g.status === 'blackjack_end') return ['La partie est finie : le classement est affiché.'];
  if(st.result) return ['La manche est finie. La suivante démarre toute seule.'];
  if(st.phase === 'bet') return ['Choisis ta mise avec les boutons +10, +25…, puis touche « Miser ».', 'Si tu ne fais rien, ta dernière mise est reprise.'];
  if(st.turn === myId) return ['C\'est à toi : Tirer pour une carte de plus, Rester pour garder ta main, Doubler pour doubler la mise avec une seule carte, Séparer pour jouer deux mains quand tu as une paire.', 'Dépasser 21 fait perdre.'];
  return ['Ce n\'est pas ton tour : regarde la table.'];
}
