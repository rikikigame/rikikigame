/* ===================== v13 : rejouer, minuteur, cartes restantes ===================== */
// cartes non distribuées (le paquet restant, carte d'atout retournée comprise)
function deckLeft(n, handSize){ return Math.max(0, 52 - n*handSize); }
function cardsLeftFor(g, id){
  var hs = g.roundPlan ? g.roundPlan[g.round] : 0;
  var inTrick = (g.currentTrick||[]).some(function(p){ return p.playerId===id; }) ? 1 : 0;
  return Math.max(0, hs - (g.trickNumber||0) - inTrick);
}
function turnLimitSec(g){ var t = g && g.settings ? g.settings.turnTimer : undefined; if(t==null) t = 30; return t>0 ? t : 0; }
var turnSeenKey=null, turnSeenAt=0, autoActing=false;
function turnKeyOf(g){
  if(!g || (g.status!=='bidding' && g.status!=='playing')) return null;
  var nb=0; Object.keys(g.bids||{}).forEach(function(k){ if(g.bids[k]!=null) nb++; });
  return g.code+'|'+g.dealSeed+'|'+g.status+'|'+g.turnPlayerId+'|'+(g.trickNumber||0)+'|'+(g.currentTrick||[]).length+'|'+nb;
}
function turnState(g){
  var off = { lim:0, left:0, elapsed:0, text:'', cls:'turn-timer' };
  var k = turnKeyOf(g);
  if(!k){ turnSeenKey=null; return off; }
  if(k!==turnSeenKey){ turnSeenKey=k; turnSeenAt=nowMs(); }
  var p = g.players[g.turnPlayerId], lim = turnLimitSec(g)*1000;
  // le temps d'affichage du pli précédent n'est pas décompté
  var start = Math.max(turnSeenAt, (g.lastTrick && g.lastTrick.at) ? lastTrickAt(g) + LAST_TRICK_MS : 0);
  var elapsed = Math.max(0, nowMs() - start);
  if(!lim || !p || p.isBot){ off.elapsed = elapsed; return off; }
  var left = Math.max(0, lim - elapsed);
  return { lim:lim, left:left, elapsed:elapsed, text:'⏱ '+Math.ceil(left/1000)+' s', cls:'turn-timer'+(left<10000?' urgent':'') };
}
function turnTick(){
  var g = gameDoc;
  if(screen!=='game' || !g) return;
  var ts = turnState(g);
  var el = document.getElementById('turn-timer');
  if(el){ el.textContent = ts.text; el.className = ts.cls; }
  if(!ts.lim || autoActing) return;
  var mine = g.turnPlayerId===myId && ts.left<=0;
  var forAbsent = g.hostId===myId && g.turnPlayerId!==myId && ts.elapsed > ts.lim + 5000; // joueur parti : l'hôte joue pour lui
  if(!mine && !forAbsent) return;
  autoActing = true;
  autoPlayFor(g.turnPlayerId).catch(function(e){ console.error(e); })
    .then(function(){ setTimeout(function(){ autoActing=false; }, 800); });
}
function pickRandom(a){ return a[Math.floor(Math.random()*a.length)]; }
async function autoPlayFor(id){
  var g = gameDoc;
  if(!g || g.turnPlayerId!==id) return;
  var handSize = g.roundPlan[g.round];
  if(g.status==='bidding'){
    var opts = allowedBids(g, id);
    if(id===myId) showToast('Temps écoulé : annonce jouée au hasard');
    await submitBidAs(id, pickRandom(opts));
    return;
  }
  var hand;
  if(id===myId){ hand = (myHand && myHand.cards.length) ? myHand.cards : computedHand(g, id); }
  else {
    hand = computedHand(g, id);
    // v37 : seul l'appareil qui connaît la graine (hôte ou donneur) peut jouer pour un absent
  }
  if(!hand || !hand.length || !gameDoc || gameDoc.turnPlayerId!==id) return;
  g = gameDoc;
  var led = (g.currentTrick && g.currentTrick.length) ? g.currentTrick[0].card.suit : null;
  var legal = (led && hand.some(function(c){ return c.suit===led; })) ? hand.filter(function(c){ return c.suit===led; }) : hand;
  if(id===myId) showToast('Temps écoulé : carte jouée au hasard');
  await playCardAs(id, pickRandom(legal), hand);
}
async function replayGame(){
  var g = gameDoc;
  if(!g || g.hostId!==myId || g.status!=='game_over') return;
  var ref = claudeDb.doc('games/'+g.code);
  var d = (await ref.get()).data() || g;
  var players = {};
  Object.keys(d.players||{}).forEach(function(id){ players[id] = Object.assign({}, d.players[id], { ready:true }); });
  await ref.set({ code:d.code, createdAt:d.createdAt||nowMs(), hostId:d.hostId, status:'lobby', settings:d.settings||{}, players:players });
  for(var i=0; i<40 && !(gameDoc && gameDoc.status==='lobby'); i++) await new Promise(function(r){ setTimeout(r, 100); });
  await startGame();
}

/* ===================== v13 : chat avec GIF ===================== */
// Recherche de GIF : clé gratuite KLIPY (partner.klipy.com). Giphy est devenu payant et l'API Tenor a fermé en juin 2026.
// Cette clé est publique par nature (elle est lisible dans la page du jeu) ; clé « test » : 100 recherches par heure.
// Sans clé, on peut quand même envoyer un GIF en collant son lien.
var KLIPY_API_KEY = 'JpSau9vnvDeSX2j92H3dIbtIjG3DmNMvRGlwkYi9EG1PP2SK0jqeTyIjASkwnacf';
var chatUnsub=null, chatCode=null, chatMsgs=[], chatOpen=false, chatSeenAt=nowMs(), chatSkelKey=null, chatListSig=null;
var gifOpen=false, gifResults=[], gifLoading=false, gifTimer=null, gifSig=null;
function subscribeChat(code){
  if(chatUnsub){ chatUnsub(); chatUnsub=null; }
  chatCode = code; chatMsgs = []; chatListSig = null;
  try{
    chatUnsub = claudeDb.doc('chats/'+code).onSnapshot(function(snap){
      var d = snap.exists ? snap.data() : null, m = (d && d.msgs) || {};
      chatMsgs = Object.keys(m).map(function(k){ return m[k]; }).filter(Boolean).sort(function(a,b){ return a.at-b.at; }).slice(-80);
      renderChat();
    }, function(err){ console.error(err); });
  }catch(e){ console.error(e); }
}
function unsubscribeChat(){
  if(chatUnsub){ chatUnsub(); chatUnsub=null; }
  chatCode=null; chatMsgs=[]; chatOpen=false; gifOpen=false; renderChat();
}
function looksLikeGifUrl(t){ return /^https:\/\/\S+$/i.test(t) && /(\.gif(\?|$)|giphy\.com|tenor\.com|klipy\.com)/i.test(t); }
async function sendChat(payload){
  if(!chatCode) return;
  var me = gameDoc && gameDoc.players ? gameDoc.players[myId] : null;
  var at = nowMs();
  var msg = Object.assign({ uid:myId, name: me ? me.name : 'Joueur', color: me ? me.color : '#888', at:at }, payload);
  var patch = { msgs:{} }; patch.msgs[at+'_'+String(myId).replace(/[^a-zA-Z0-9_-]/g,'')] = msg;
  var ref = claudeDb.doc('chats/'+chatCode);
  try{ await ref.update(patch); }
  catch(e){ try{ await ref.set({ code:chatCode, msgs:patch.msgs }); }catch(e2){ console.error(e2); showToast('Message non envoyé'); } }
}
function fitChatToKeyboard(){
  var root = document.getElementById('chat-root'), vv = window.visualViewport;
  if(!root || !vv) return;
  var hidden = Math.max(0, window.innerHeight - vv.height - vv.offsetTop); // hauteur cachée par le clavier
  root.style.bottom = 'calc(' + (14 + hidden) + 'px + env(safe-area-inset-bottom,0px))';
  var panel = root.querySelector('.chat-panel');
  if(panel) panel.style.height = Math.max(220, Math.min(520, vv.height - 40)) + 'px';
}
if(window.visualViewport){ window.visualViewport.addEventListener('resize', fitChatToKeyboard); window.visualViewport.addEventListener('scroll', fitChatToKeyboard); }
function chatUnread(){ return chatMsgs.filter(function(m){ return m.at>chatSeenAt && m.uid!==myId; }).length; }
function renderChat(){
  var root = document.getElementById('chat-root'); if(!root) return;
  var visible = screen==='game' && !!gameDoc && !!chatCode;
  var key = !visible ? 'none' : (chatOpen ? 'open' : 'closed');
  if(key!==chatSkelKey){
    chatSkelKey = key; chatListSig = null; gifSig = null;
    if(key==='none') root.innerHTML = '';
    else if(key==='closed') root.innerHTML = '<button class="chat-fab" data-chat="open" aria-label="Ouvrir le chat">💬<span class="chat-badge" id="chat-badge"></span></button>';
    else {
      root.innerHTML = '<div class="chat-panel"><div class="chat-head"><strong>Chat de la partie</strong><button class="chat-x" data-chat="close" aria-label="Fermer le chat">✕</button></div>'
        + '<div class="chat-list" id="chat-list"></div>'
        + '<div class="gif-box" id="gif-box" hidden><input id="gif-q" placeholder="'+(KLIPY_API_KEY ? 'Chercher un GIF…' : 'Colle le lien d\'un GIF (https://…)')+'" autocomplete="off"><div class="gif-grid" id="gif-grid"></div><div class="gif-note" id="gif-note"></div></div>'
        + '<div class="chat-quick">'+['😂','👏','😱','😡','🔥','🃏','🍀','😭'].map(function(x){ return '<button data-chat="emoji" data-v="'+x+'">'+x+'</button>'; }).join('')+'</div>'
        + '<div class="chat-send"><button class="gif" data-chat="gif">GIF</button><input id="chat-input" maxlength="300" placeholder="Message…" autocomplete="off"><button data-chat="send">Envoyer</button></div></div>';
      var inp = document.getElementById('chat-input'); if(inp && window.innerWidth>700) inp.focus();
      fitChatToKeyboard();
    }
  }
  var u0 = key==='open' ? 0 : chatUnread(), ut = u0 ? (u0>9?'9+':String(u0)) : '';
  var tb = document.getElementById('chat-badge-top'); if(tb) tb.textContent = ut;
  if(key==='closed'){ var b = document.getElementById('chat-badge'); if(b) b.textContent = ut; }
  if(key==='open'){
    chatSeenAt = nowMs();
    var sig = chatMsgs.length+'|'+(chatMsgs.length ? chatMsgs[chatMsgs.length-1].at : 0);
    var list = document.getElementById('chat-list');
    if(list && sig!==chatListSig){
      chatListSig = sig;
      list.innerHTML = chatMsgs.length ? chatMsgs.map(function(m){
        var mine = m.uid===myId;
        var body = (m.gif && looksLikeGifUrl(String(m.gif))) ? '<img src="'+esc(m.gif)+'" alt="GIF" loading="lazy">' : '<span class="bb">'+esc(m.text||'')+'</span>';
        return '<div class="chat-msg'+(mine?' mine':'')+'">'+(mine?'':'<div class="nm" style="color:'+esc(safeColor(m.color||'#1F2E4A'))+';">'+esc(m.name||'?')+'</div>')+body+'</div>';
      }).join('') : '<div class="chat-empty">Aucun message pour l\'instant.<br>Dis bonjour à la table 👋</div>';
      list.scrollTop = list.scrollHeight;
    }
    var box = document.getElementById('gif-box');
    if(box){
      box.hidden = !gifOpen;
      var gsig = gifOpen+'|'+gifLoading+'|'+gifResults.length+'|'+(gifResults[0]||{}).id;
      if(gsig!==gifSig){
        gifSig = gsig;
        var grid = document.getElementById('gif-grid'), note = document.getElementById('gif-note');
        if(grid) grid.innerHTML = gifResults.map(function(r){ return '<img src="'+esc(r.preview)+'" data-chat="pick" data-url="'+esc(r.url)+'" alt="GIF" loading="lazy">'; }).join('');
        if(note) note.textContent = !KLIPY_API_KEY ? 'Colle un lien de GIF puis Entrée.' : (gifLoading ? 'Recherche…' : (gifResults.length ? 'Touche un GIF pour l\'envoyer' : 'Aucun résultat'));
      }
    }
  }
}
async function searchGifs(q){
  if(!KLIPY_API_KEY) return;
  gifLoading = true; renderChat();
  try{
    var url = 'https://api.klipy.com/api/v1/'+encodeURIComponent(KLIPY_API_KEY)+'/gifs/'+(q ? 'search' : 'trending')+'?per_page=18&locale=fr_FR'+(q ? '&q='+encodeURIComponent(q) : '');
    var res = await fetch(url); var data = await res.json();
    var items = (data && data.data && data.data.data) || [];
    gifResults = items.filter(function(d){ return d && d.file && (!d.type || d.type==='gif'); }).map(function(d){
      var f = d.file, sm = f.sm || f.md || f.hd || {}, md = f.md || f.hd || f.sm || {};
      return { id:d.id, preview:((sm.webp||sm.gif)||{}).url, url:(md.gif||{}).url };
    }).filter(function(r){ return r.preview && r.url && looksLikeGifUrl(r.url); });
  }catch(e){ console.error(e); gifResults = []; }
  gifLoading = false; renderChat();
}
function sendChatInput(){
  var inp = document.getElementById('chat-input'); if(!inp) return;
  var t = inp.value.trim(); if(!t) return;
  inp.value = '';
  sendChat(looksLikeGifUrl(t) ? { gif:t } : { text:t.slice(0,300) });
}
document.addEventListener('click', function(e){
  var el = e.target.closest ? e.target.closest('[data-chat]') : null; if(!el) return;
  var a = el.getAttribute('data-chat');
  if(a==='open'){ chatOpen=true; renderChat(); }
  else if(a==='close'){ chatOpen=false; gifOpen=false; renderChat(); }
  else if(a==='send'){ sendChatInput(); }
  else if(a==='emoji'){ sendChat({ text: el.getAttribute('data-v') }); }
  else if(a==='gif'){ gifOpen=!gifOpen; gifSig=null; renderChat(); if(gifOpen){ var q=document.getElementById('gif-q'); if(q) q.focus(); if(KLIPY_API_KEY && !gifResults.length) searchGifs(''); } }
  else if(a==='pick'){ sendChat({ gif: el.getAttribute('data-url') }); gifOpen=false; gifSig=null; renderChat(); }
});
document.addEventListener('keydown', function(e){
  if(e.key!=='Enter' || !e.target) return;
  if(e.target.id==='chat-input'){ e.preventDefault(); sendChatInput(); }
  else if(e.target.id==='gif-q'){
    e.preventDefault();
    var v = e.target.value.trim();
    if(looksLikeGifUrl(v)){ sendChat({ gif:v }); e.target.value=''; gifOpen=false; gifSig=null; renderChat(); }
    else if(KLIPY_API_KEY) searchGifs(v);
  }
});
document.addEventListener('input', function(e){
  if(!e.target || e.target.id!=='gif-q' || !KLIPY_API_KEY) return;
  var v = e.target.value.trim();
  if(looksLikeGifUrl(v)) return;
  clearTimeout(gifTimer); gifTimer = setTimeout(function(){ searchGifs(v); }, 400);
});

