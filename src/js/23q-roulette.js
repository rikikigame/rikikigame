/* ===================== 1.11.0 : roulette (écran + croupier) =====================
   JETONS FICTIFS. Même architecture que le blackjack (23o-blackjack.js) : une partie normale (salon, code) repérée par kind:'roulette' ;
   l'organisateur est le croupier : il tient la graine du tirage en mémoire, applique chaque jeu de mises avec le moteur (23p-roulette-moteur.js)
   et écrit l'état public « rl ». Les joueurs déposent seulement leurs mises dans rlActs. On peut jouer seul. Aucune règle Firebase nouvelle.
   Statuts : 'lobby' → 'roulette' → 'roulette_end'. */
function rlOn(g){ return !!(g && g.kind === 'roulette'); }
var rlSecret = null, rlBusy = false, rlSeen = { key: '', at: 0 }, rlDraft = { key: '', chip: 10, bets: [] };
var RL_BOT_MS = 900, RL_BREAK_MS = 9000, RL_BET_SEC = 30;

/* ---------- le croupier ---------- */
async function startRoulette(){
  var g = gameDoc;
  if(!rlOn(g) || g.hostId !== myId || g.status !== 'lobby') return;
  var ids = Object.keys(g.players).sort(function(a, b){ return g.players[a].joinedAt - g.players[b].joinedAt; });
  if(!ids.length || !ids.every(function(id){ return g.players[id].ready; })) return;
  var stacks = {}; ids.forEach(function(id){ stacks[id] = miniStartStack(g, id); }); // jetons de départ : classement du mois dernier (23s)
  var st = rlStartRound(ids, stacks, 1, casinoRoundsTotal(g), []);
  if(st) await rlBeginRound(g, st, { startedAt: nowMs() });
}
async function rlBeginRound(g, st, extra){
  rlBusy = true;
  try{
    rlSecret = { code: g.code, n: st.n, seed: Math.floor(Math.random() * 4294967296) };
    st.betAt = nowMs();
    await rlWrite(g, st, extra);
  }catch(e){ console.error(e); rlSecret = null; }
  finally{ rlBusy = false; }
}
async function rlWrite(g, st, extra){
  st.turnAt = nowMs();
  var over = !!(st.result && rlGameOver(st));
  var patch = Object.assign({ rl: replaceWhole(st), status: over ? 'roulette_end' : 'roulette' }, extra || {});
  await claudeDb.doc('games/'+g.code).update(patch);
}
function rlRestartRound(g){
  var st0 = g.rl, ro = miniRoster(g, st0, st0.startStacks), st = rlStartRound(ro.seats, ro.stacks, st0.n, st0.total, st0.history.slice(0, Math.max(0, st0.history.length - (st0.result ? 1 : 0))));
  if(st) rlBeginRound(g, st);
}
async function rlFinish(g, st0){
  rlBusy = true;
  try{ await rlWrite(g, Object.assign({}, st0, { finish: true })); }catch(e){ console.error(e); }
  finally{ rlBusy = false; }
}
function rlNextRound(g){
  if(g.finishAfter){ rlFinish(g, g.rl); return; }
  var st0 = g.rl, ro = miniRoster(g, st0, st0.stacks), st = rlStartRound(ro.seats, ro.stacks, st0.n + 1, st0.total, st0.history);
  if(st) rlBeginRound(g, st);
}
async function rlApply(g, fn){
  if(!rlSecret || rlSecret.n !== g.rl.n) return false;
  var next = fn(g.rl, rlSecret);
  if(!next) return false;
  rlBusy = true;
  try{ await rlWrite(g, next); }catch(e){ console.error(e); }
  finally{ rlBusy = false; }
  return true;
}
function rlHostTick(g){
  miniStallTick(g, g.rl, 'roulette');
  if(g.hostId !== myId || g.status !== 'roulette' || rlBusy || !g.rl) return;
  var st = g.rl;
  if(!st.result && (!rlSecret || rlSecret.code !== g.code || rlSecret.n !== st.n)){ rlRestartRound(g); return; }
  if(st.result){
    var dk = g.code+'|'+st.n;
    if(rlSeen.key !== dk){ rlSeen = { key: dk, at: nowMs() }; return; }
    if(nowMs() - rlSeen.at >= RL_BREAK_MS) rlNextRound(g);
    return;
  }
  var acts = g.rlActs || {}, key = g.code+'|'+st.n+'|bet|'+st.seq;
  if(rlSeen.key !== key){ rlSeen = { key: key, at: nowMs() }; return; }
  var waiting = st.order.filter(function(p){ return !st.placed[p]; });
  for(var i = 0; i < waiting.length; i++){
    var id = waiting[i], pl = g.players[id];
    if(pl && pl.isBot){
      if(nowMs() - rlSeen.at < RL_BOT_MS) continue;
      var bets = rlBotBets(st, id, Math.random);
      rlApply(g, function(s, sec){ return rlPlace(s, id, bets, sec); });
      return;
    }
    var a = acts[id];
    if(a && a.n === st.n && a.type === 'bets'){
      rlApply(g, function(s, sec){ return rlPlace(s, id, a.list || [], sec); }).then(function(okay){ if(!okay) rlSeen = { key: key, at: nowMs() }; });
      return;
    }
  }
  if(waiting.length && nowMs() - (st.betAt || rlSeen.at) > RL_BET_SEC * 1000 + 2000){ // trop long : le joueur passe ce tour
    var w = waiting[0];
    rlApply(g, function(s, sec){ return rlPlace(s, w, [], sec); });
  }
}

/* ---------- ce que fait le joueur ---------- */
function rlSend(list){
  var g = gameDoc;
  if(!rlOn(g) || g.status !== 'roulette' || !g.rl) return;
  var st = g.rl;
  if(st.phase !== 'bet' || st.placed[myId] || st.mode[myId] !== 'bet') return;
  if(g.hostId === myId){ rlApply(g, function(s, sec){ return rlPlace(s, myId, list, sec); }); return; }
  var patch = { rlActs: {} };
  patch.rlActs[myId] = { n: st.n, type: 'bets', list: list, at: nowMs() };
  claudeDb.doc('games/'+g.code).update(patch).catch(function(e){ console.error(e); showToast('Mises non envoyées : réessaie.'); });
}
function rlDraftGet(st){ // le brouillon de mises du joueur (repart à zéro à chaque tour)
  var key = st.n+'|'+(gameDoc ? gameDoc.code : '');
  if(rlDraft.key !== key) rlDraft = { key: key, chip: rlDraft.chip || 10, bets: [] };
  return rlDraft;
}
function rlDraftTotal(){ return rlTotal(rlDraft.bets); }
function rlCellPlay(st, t, v){ // un jeton de plus sur la case touchée (dans la limite des jetons et du nombre de mises)
  var d = rlDraftGet(st), next = rlMerge(d.bets.concat([{ t: t, v: v, a: d.chip }]));
  if(rlTotal(next) > st.stacks[myId] || next.length > RL_MAX_BETS){ showToast(rlTotal(next) > st.stacks[myId] ? 'Pas assez de jetons.' : 'Trop de mises différentes.'); return; }
  rlDraft = { key: d.key, chip: d.chip, bets: next };
  render();
}
function rlChipSet(v){ var d = rlDraftGet(gameDoc.rl); rlDraft = { key: d.key, chip: Number(v) || 10, bets: d.bets }; render(); }
function rlDraftClear(){ var d = rlDraftGet(gameDoc.rl); rlDraft = { key: d.key, chip: d.chip, bets: [] }; render(); }
function rlDraftSend(pass){ var d = rlDraftGet(gameDoc.rl); rlSend(pass ? [] : d.bets); }

/* ---------- le plateau de la roulette (SVG) ---------- */
var RL_WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
var RL_SPIN_MS = 4200;
function rlPolar(r, deg){ var a = deg * Math.PI / 180; return (100 + r * Math.sin(a)).toFixed(2)+' '+(100 - r * Math.cos(a)).toFixed(2); }
var rlWheelCache = '';
function rlWheelPockets(){ // les 37 cases (dessinées une seule fois)
  if(rlWheelCache) return rlWheelCache;
  var a = 360 / 37, h = '', i, n, th, fill;
  for(i = 0; i < 37; i++){
    n = RL_WHEEL_ORDER[i]; th = i * a; fill = { red: '#B81F32', black: '#15151A', green: '#12704A' }[rlColor(n)];
    h += '<path d="M'+rlPolar(88, th - a / 2)+' A88 88 0 0 1 '+rlPolar(88, th + a / 2)+' L'+rlPolar(62, th + a / 2)+' A62 62 0 0 0 '+rlPolar(62, th - a / 2)+' Z" fill="'+fill+'" stroke="#E3C158" stroke-width="0.7"/>';
    h += '<text x="100" y="'+(100 - 75)+'" transform="rotate('+th.toFixed(2)+' 100 100)" text-anchor="middle" dominant-baseline="middle" font-size="7.4" font-weight="800" font-family="system-ui,sans-serif" fill="#fff">'+n+'</text>';
  }
  rlWheelCache = h; return h;
}
function rlWheelHtml(st){
  var spinning = st.phase === 'done' && st.result, age = spinning ? Math.max(0, nowMs() - (st.turnAt || nowMs())) : 0;
  var mode = !spinning ? 'idle' : (age < RL_SPIN_MS ? 'spin' : 'still');
  var idx = spinning ? RL_WHEEL_ORDER.indexOf(st.result.number) : 0, end = -(idx * 360 / 37);
  var delay = mode === 'spin' ? ' animation-delay:-'+Math.round(age)+'ms;' : '';
  return '<div class="rl-wheel '+mode+'" style="--rl-end:'+end.toFixed(2)+'deg;'+'" role="img" aria-label="Roulette">'
    + '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"><defs>'
    + '<radialGradient id="rlWood" cx="50%" cy="50%" r="50%"><stop offset="0.82" stop-color="#5A3418"/><stop offset="1" stop-color="#2B170A"/></radialGradient>'
    + '<radialGradient id="rlCone" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#3A2A1C"/><stop offset="1" stop-color="#14100B"/></radialGradient>'
    + '<radialGradient id="rlGold" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FFE9A0"/><stop offset="1" stop-color="#B8862A"/></radialGradient></defs>'
    + '<circle cx="100" cy="100" r="99" fill="url(#rlWood)" stroke="#E3C158" stroke-width="1.4"/>'
    + '<circle cx="100" cy="100" r="95" fill="#0B0B0E" stroke="#8A6A22" stroke-width="0.8"/>' // piste de la bille
    + '<g class="rl-wheel-g" style="'+delay+'">' + rlWheelPockets()
    + '<circle cx="100" cy="100" r="62" fill="url(#rlCone)" stroke="#E3C158" stroke-width="1.2"/>'
    + '<circle cx="100" cy="100" r="40" fill="none" stroke="#5E4520" stroke-width="0.8"/>'
    + '<path d="M100 60V140M60 100H140" stroke="url(#rlGold)" stroke-width="3" stroke-linecap="round"/>'
    + '<circle cx="100" cy="100" r="12" fill="url(#rlGold)" stroke="#6B4A12" stroke-width="1"/><circle cx="100" cy="100" r="3.4" fill="#6B4A12"/>'
    + '<circle cx="100" cy="60" r="3" fill="url(#rlGold)"/><circle cx="100" cy="140" r="3" fill="url(#rlGold)"/><circle cx="60" cy="100" r="3" fill="url(#rlGold)"/><circle cx="140" cy="100" r="3" fill="url(#rlGold)"/></g>'
    + '<g class="rl-ball-g" style="'+delay+'"><circle cx="100" cy="'+(mode === 'idle' ? 8 : 18)+'" r="3.8" fill="#F7F7F2" stroke="#9A9A92" stroke-width="0.6"/><circle cx="99" cy="'+(mode === 'idle' ? 6.9 : 16.9)+'" r="1.2" fill="#fff"/></g>'
    + '<path d="M100 1.5l4 7h-8z" fill="#E3C158"/></svg></div>';
}

/* ---------- écran ---------- */
function rlRevealStyle(st){ // le résultat s'affiche quand la bille s'arrête (même après un rechargement de l'écran)
  var age = Math.max(0, nowMs() - (st.turnAt || nowMs())), wait = Math.max(0, RL_SPIN_MS - age);
  return wait > 0 ? ' style="animation:rlReveal .5s ease '+Math.round(wait)+'ms both;"' : '';
}
function rlChipClass(a){ return chipTier(a); }
function rlDot(n){ return '<span class="rl-dot '+rlColor(n)+'">'+n+'</span>'; }
function rlBoardHtml(st){
  var d = rlDraftGet(st), amt = {};
  d.bets.forEach(function(b){ amt[b.t+':'+(b.v || 0)] = b.a; });
  var cell = function(t, v, label, cls){
    var a = amt[t+':'+v];
    return '<button class="rl-cell '+(cls || '')+(a ? ' has' : '')+'" data-action="rl-cell" data-t="'+t+'" data-v="'+v+'">'+label+(a ? '<i class="rl-b v'+rlChipClass(a)+'">'+a+'</i>' : '')+'</button>';
  };
  var h = '<div class="rl-board">' + cell('num', 0, '0', 'green rl-zero') + '<div class="rl-grid">', r, c, n;
  for(r = 0; r < 3; r++) for(c = 0; c < 12; c++){ n = 3 * c + (3 - r); h += cell('num', n, String(n), rlColor(n)); }
  h += '</div><div class="rl-row3">' + cell('dozen', 1, '1re 12') + cell('dozen', 2, '2e 12') + cell('dozen', 3, '3e 12') + '</div>';
  h += '<div class="rl-row3">' + cell('col', 1, 'Col. 1') + cell('col', 2, 'Col. 2') + cell('col', 3, 'Col. 3') + '</div>';
  h += '<div class="rl-row6">' + cell('low', 0, '1-18') + cell('even', 0, 'Pair') + cell('red', 0, '◆ Rouge', 'red') + cell('black', 0, '◆ Noir', 'black') + cell('odd', 0, 'Impair') + cell('high', 0, '19-36') + '</div></div>';
  return h;
}
function rlBetsText(list){ return list.length ? list.map(function(b){ return rlBetLabel(b)+' <strong>'+b.a+'</strong>'; }).join(' · ') : 'aucune mise'; }
function renderRlSeat(g, st, id){
  var p = g.players[id]; if(!p) return '';
  var mode = st.mode[id], cls = 'pk-seat' + (mode === 'out' ? ' out' : '') + (id === myId ? ' me' : '');
  var tags = [];
  if(mode === 'out') tags.push('<span class="pk-tag f">Plus de jetons</span>');
  else if(st.phase === 'bet') tags.push('<span class="pk-tag '+(st.placed[id] ? 'd' : 'f')+'">'+(st.placed[id] ? 'A misé' : 'Mise…')+'</span>');
  else if(!st.bets[id].length) tags.push('<span class="pk-tag f">A passé</span>');
  var h = '<div class="'+cls+'"><div class="avatar" style="background:'+safeColor(p.color)+'; color:'+inkOn(safeColor(p.color))+';">'+(p.isBot?'🤖':esc(initials(p.name)))+'</div>';
  h += '<div class="pk-seat-txt"><div class="pk-name">'+esc(p.name)+(id===myId?' (toi)':'')+'</div><div class="pk-stack">'+pokerChips(st.stacks[id])+'</div><div class="pk-tags">'+tags.join('')+'</div></div>';
  var tot = rlTotal(st.bets[id]);
  if(tot > 0) h += '<div class="pk-bet">'+pokerChips(tot)+'</div>';
  var o = st.result && st.result.outcomes[id];
  if(o && o.bet > 0) h += '<div class="pk-won'+(o.delta < 0 ? ' neg' : '')+'"'+rlRevealStyle(st)+'>'+(o.delta > 0 ? '+' : '')+o.delta+'</div>';
  return h + '</div>';
}
function rlResultHtml(g, st){
  var r = st.result, o = r.outcomes[myId], line = '';
  if(o && o.bet > 0) line = o.delta > 0 ? 'Tu gagnes '+pokerChips(o.delta)+(o.wins.length ? ' (' + esc(o.wins.join(', ')) + ')' : '') : (o.delta === 0 ? 'Tu récupères ta mise.' : 'Tu perds '+pokerChips(-o.delta));
  else if(st.mode[myId] === 'bet') line = 'Tu n\'as pas misé.';
  var left = Math.max(0, RL_BREAK_MS - (nowMs() - (rlSeen.key === g.code+'|'+st.n ? rlSeen.at : nowMs())));
  return '<div class="pk-result rl-result"'+rlRevealStyle(st)+'><div class="rl-num '+r.color+'" aria-label="Numéro '+r.number+'">'+r.number+'</div>'
    + '<div style="text-align:center;">'+({ red: 'Rouge', black: 'Noir', green: 'Zéro' }[r.color])+(r.number === 0 ? ' · la banque gagne les mises simples' : ' · '+(r.number % 2 ? 'impair' : 'pair')+' · '+(r.number <= 18 ? 'manque' : 'passe'))+'</div>'
    + (line ? '<div style="text-align:center; margin-top:4px;"><strong>'+line+'</strong></div>' : '')
    + (rlGameOver(st) ? '' : '<div class="muted" style="margin-top:6px; text-align:center;">Tour suivant dans <span id="rl-next">'+Math.ceil(left / 1000)+'</span> s</div>')+'</div>';
}
function rlActionsHtml(g, st){
  var me = st.mode[myId];
  if(st.phase !== 'bet') return '';
  if(me !== 'bet') return '<div class="pk-wait muted">Tu n\'as plus de jetons : regarde les autres, ou va te refaire contre des robots 😄</div>';
  if(st.placed[myId]) return '<div class="pk-wait muted">Mises posées : '+rlBetsText(st.bets[myId])+'.<br>On attend les autres joueurs…</div>';
  var d = rlDraftGet(st), total = rlDraftTotal(), left = st.stacks[myId] - total;
  var chips = RL_CHIP_STEPS.filter(function(s){ return s <= st.stacks[myId]; });
  if(!chips.length) chips = [RL_MIN_BET];
  if(chips.indexOf(d.chip) < 0) d.chip = chips[chips.length - 1];
  return '<div class="pk-actions"><div class="pk-timer">Pose tes jetons <span id="rl-timer" class="turn-timer"></span></div>'
    + '<div class="rl-chips"><span class="muted">Jeton :</span>'+chips.map(function(s){ return '<button class="rl-chipbtn v'+s+(s === d.chip ? ' on' : '')+'" data-action="rl-chip" data-v="'+s+'" aria-label="Jeton de '+s+'">'+s+'</button>'; }).join('')+'</div>'
    + rlBoardHtml(st)
    + '<div class="rl-sum">'+(d.bets.length ? rlBetsText(d.bets)+' · total '+pokerChips(total)+' · reste '+left : 'Touche une case pour poser un jeton de '+d.chip+'.')+'</div>'
    + '<div class="pk-btns" style="margin-top:8px;"><button class="btn secondary" data-action="rl-clear"'+(d.bets.length ? '' : ' disabled')+'>Effacer</button>'
    + '<button class="btn" data-action="rl-send"'+(d.bets.length ? '' : ' disabled')+'>Valider ('+total+')</button></div>'
    + '<button class="btn ghost small" data-action="rl-pass" style="width:100%; margin-top:6px;">Passer ce tour</button></div>';
}
function renderRoulette(g){
  var st = g.rl;
  if(!st) return '<div class="center-wrap"><span class="muted">Mise en place de la table…</span></div>';
  var h = '<div class="pk-head"><div><div class="eyebrow">'+miniCount('Tour', st)+'</div><div class="display" style="font-size:22px;">'+({ bet: 'Faites vos jeux', done: 'Rien ne va plus' }[st.phase] || '')+'</div></div>'
    + miniHeadRight(st, 'Mise min. '+RL_MIN_BET);
  h += miniFinishHtml(g, 'ce tour') + croupierFor(g) + '<div class="pk-table rl-table">'+rlWheelHtml(st)+'<div class="pk-seats">'+st.seats.map(function(id){ return renderRlSeat(g, st, id); }).join('')+'</div>';
  var past = st.result ? st.history.slice(0, -1) : st.history; // le dernier numéro reste secret tant que la bille tourne
  if(past.length) h += '<div class="rl-history"><span class="muted">Derniers numéros</span> '+past.slice().reverse().map(rlDot).join('')+'</div>';
  h += '</div>';
  if(st.result) h += rlResultHtml(g, st);
  if(g.status === 'roulette_end') h += pokerRanking(g, st);
  else if(!st.result) h += rlActionsHtml(g, st);
  return h;
}
function rlTimerTick(g){
  if(!g || !g.rl) return;
  var st = g.rl, el = document.getElementById('rl-timer');
  if(el){
    var left = Math.max(0, RL_BET_SEC - Math.floor((nowMs() - (st.betAt || nowMs())) / 1000));
    el.textContent = '⏱ '+left+' s'; el.className = 'turn-timer'+(left <= 8 ? ' hot' : '');
  }
  var nx = document.getElementById('rl-next');
  if(nx && rlSeen.key === g.code+'|'+st.n) nx.textContent = Math.max(0, Math.ceil((RL_BREAK_MS - (nowMs() - rlSeen.at)) / 1000));
}
function renderRlRules(){
  return '<div class="modal-backdrop" data-action="toggle-rules"><div class="card-panel modal">'
    + '<button class="btn secondary small close-x" data-action="toggle-rules">Fermer</button><h3>Roulette</h3>'
    + '<p>La roulette a <strong>37 cases</strong> : de 1 à 36 (18 rouges, 18 noires) et le <strong>zéro</strong> (vert). À chaque tour, tu poses des jetons sur la table, puis le croupier tire un numéro.</p>'
    + '<p><strong>Ce que tu peux miser</strong> : un numéro seul (gagne <strong>35 contre 1</strong>) ; <strong>Rouge / Noir</strong>, <strong>Pair / Impair</strong>, <strong>1-18 / 19-36</strong> (gagne <strong>1 contre 1</strong>) ; une <strong>douzaine</strong> (1 à 12, 13 à 24, 25 à 36) ou une <strong>colonne</strong> (gagne <strong>2 contre 1</strong>).</p>'
    + '<p>Le <strong>zéro</strong> fait perdre toutes les mises, sauf celle posée sur le 0. Tu peux poser plusieurs mises dans le même tour, ou passer ton tour.</p>'
    + '<p class="muted">Tous les jetons sont faux : on ne joue jamais avec de l\'argent.</p></div></div>';
}
function rlHelpLines(g){
  var st = g.rl;
  if(g.status === 'lobby') return ['Touche « Je suis prêt » quand tu veux.', 'Tu peux jouer seul, ou ajouter des robots.'];
  if(!st) return ['La table se prépare : un instant.'];
  if(g.status === 'roulette_end') return ['La partie est finie : le classement est affiché.'];
  if(st.result) return ['Le numéro est tiré. Le tour suivant démarre tout seul.'];
  return ['Choisis la valeur d\'un jeton, puis touche les cases où tu veux le poser (plusieurs fois pour en empiler).', 'Touche « Valider » quand c\'est bon, ou « Passer ce tour ».'];
}
