/* ===================== 1.13.0 : rejoindre une table de casino EN COURS de partie =====================
   Une partie commencée n'accepte les écritures que des comptes déjà présents (règles Firebase de sécurité) : un nouvel arrivant ne peut donc pas
   s'ajouter lui-même. Il dépose une DEMANDE dans son propre document `lateJoin/{code}__{son compte}` (nouvelle règle : il ne peut écrire que le sien).
   L'organisateur (le croupier) lit les demandes de sa table, ajoute le joueur à `players` (c'est l'organisateur qui écrit, il en a le droit), puis
   le nouveau joueur s'assoit à la main / manche / tour SUIVANT avec ses jetons de départ (`miniRoster`). Refusé si la table est complète.
   Règle Firebase à publier AVANT le code : voir regles-firebase.json, nœud « lateJoin ». */
var lateWait = ''; // code de la table que j'ai demandé à rejoindre et où l'organisateur ne m'a pas encore ajouté
var lateWatch = { code: '', unsub: null, busy: false, adding: {} };

function lateJoinPossible(data){ return !!(data && miniOn(data) && typeof data.status === 'string' && data.status !== 'lobby' && data.status.slice(-4) !== '_end'); }

// côté nouvel arrivant : j'envoie ma demande (mon nom, ma couleur, mes jetons de départ)
async function lateJoinRequest(code, name){
  var uid = myKeyId(), bank = CASINO_BASE_NEW;
  try{ bank = await myCasinoBank(); }catch(e){}
  var doc = { id: myId, name: name, color: myProfile.color, uid: uid, code: code, bank: bank, at: nowMs(), __plain: { code: code, uid: uid } };
  await claudeDb.doc('lateJoin/' + code + '__' + uid).set(doc);
  lateWait = code;
}

// côté organisateur : lire les demandes de cette table et ajouter les joueurs
function lateHostStop(){ if(lateWatch.unsub){ try{ lateWatch.unsub(); }catch(e){} } lateWatch = { code: '', unsub: null, busy: false, adding: {} }; }
function lateHostTick(g){
  if(!g || g.hostId !== myId || g.status === 'lobby' || !miniOn(g)){ if(lateWatch.code) lateHostStop(); return; }
  if(lateWatch.code === g.code) return;
  lateHostStop(); lateWatch.code = g.code;
  try{
    lateWatch.unsub = claudeDb.watchBox('lateJoin', 'code', g.code, function(list){ lateHostApply(list); }, function(e){ console.warn('demandes pour rejoindre', e); });
  }catch(e){ console.warn(e); }
}
async function lateHostApply(list){
  var g = gameDoc;
  if(!g || g.hostId !== myId || g.code !== lateWatch.code || lateWatch.busy) return;
  var cap = maxPlayersOf(g), count = Object.keys(g.players || {}).length, patch = { players: {} }, add = [];
  (list || []).slice().sort(function(a, b){ return ((a.data && a.data.at) || 0) - ((b.data && b.data.at) || 0); }).forEach(function(r){
    var d = r.data;
    if(!d || d.code !== g.code || typeof d.id !== 'string' || typeof d.uid !== 'string' || (g.players && g.players[d.id]) || lateWatch.adding[d.id] || count + add.length >= cap) return;
    var bank = Number(d.bank);
    patch.players[d.id] = { name: String(d.name || 'Joueur').slice(0, 24), color: safeColor(d.color), joinedAt: nowMs(), ready: true, uid: d.uid, late: true,
      bank: (isFinite(bank) && bank >= CASINO_BANK_MIN) ? Math.min(CASINO_BANK_MAX, Math.round(bank)) : CASINO_BASE_NEW };
    add.push(d.id);
  });
  if(!add.length) return;
  lateWatch.busy = true; add.forEach(function(id){ lateWatch.adding[id] = true; });
  try{ await claudeDb.doc('games/' + g.code).update(patch); }
  catch(e){ console.error(e); add.forEach(function(id){ delete lateWatch.adding[id]; }); }
  finally{ lateWatch.busy = false; }
}

// les joueurs arrivés en cours de partie s'assoient au début de la main / manche / tour suivant, avec leurs jetons de départ
function miniRoster(g, st0, stacksOf){
  var seats = st0.seats.slice(), stacks = Object.assign({}, stacksOf), cap = maxPlayersOf(g);
  Object.keys(g.players || {}).filter(function(id){ return seats.indexOf(id) < 0; })
    .sort(function(a, b){ return (g.players[a].joinedAt || 0) - (g.players[b].joinedAt || 0); })
    .forEach(function(id){ if(seats.length < cap){ seats.push(id); stacks[id] = miniStartStack(g, id); } });
  return { seats: seats, stacks: stacks };
}

// ce que voit un joueur qui n'est pas encore à la table (demande envoyée, ou ajouté mais pas encore assis)
function renderLateWaiting(g){
  var added = g.players && g.players[myId], when = pokerOn(g) ? 'main' : (rlOn(g) ? 'tour' : 'manche');
  return '<div class="card-panel" style="text-align:center; margin-top:14px;"><div style="font-size:28px;">🪑</div>'
    + '<h3 style="margin:6px 0;">'+(added ? 'Tu t\'assois à la prochaine '+when : 'Demande envoyée')+'</h3>'
    + '<p class="muted" style="margin:0 0 6px;">'+(added ? 'Ta place est réservée, avec tes jetons de départ.' : 'L\'organisateur t\'ajoute à la table dès qu\'il voit ta demande (quelques secondes). Tu joues à la prochaine '+when+'.')+'</p></div>';
}
