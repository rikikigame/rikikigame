/* Test « partie complète avec des robots » : injecté par build_test_pages.py dans srv/bots.html (jamais dans le vrai jeu).
   Paramètres de l'adresse : ?n=4 (nombre de joueurs, toi compris) &mode=quick|up */
(function(){
  var q = new URLSearchParams(location.search), N = parseInt(q.get('n')||'4',10), MODE = q.get('mode')||'quick', AFK = q.get('afk')==='1';
  var errs = [], checks = [];
  window.addEventListener('error', function(e){ errs.push('erreur : '+e.message); });
  window.addEventListener('unhandledrejection', function(e){ errs.push('promesse refusée : '+(e.reason && e.reason.message || e.reason)); });
  var ce = console.error; console.error = function(){ errs.push('console.error : '+[].slice.call(arguments).map(String).join(' ')); ce.apply(console, arguments); };
  function ok(name, cond, info){ checks.push({ name:name, ok:!!cond, info: cond ? undefined : info }); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  async function until(fn, ms, what){ var t=Date.now(); while(!fn()){ if(Date.now()-t>ms) throw new Error('trop long : '+what); await sleep(20); } }
  var acting = false;
  async function actForMe(){
    var g = gameDoc; if(acting || !g || g.turnPlayerId!==myId) return;
    var hand = computedHand(g, myId) || []; if(!hand.length) return;
    acting = true;
    try{
      if(g.status==='bidding') await submitBidAs(myId, botChooseBid(myId, g, hand));
      else if(g.status==='playing'){ var c = botChooseCard(myId, g, hand); if(c) await playCardAs(myId, c, hand); }
    }catch(e){ errs.push('mon coup a échoué : '+e.message); }
    acting = false;
  }
  function finish(extra){
    var failed = checks.filter(function(c){ return !c.ok; }).length + errs.length;
    var res = { n:N, mode:MODE, ok: failed===0 && !(extra && extra.crash), checks:checks, errors:errs, crash: extra && extra.crash };
    window.__botsResult = res;
    document.body.innerHTML = '<pre id="botsResult">'+JSON.stringify(res)+'</pre>';
  }
  async function run(){
    try{
      await until(function(){ return typeof claudeDb!=='undefined' && claudeDb && myId; }, 20000, 'démarrage du jeu');
      await createGame('Testeur', MODE);
      await until(function(){ return gameDoc; }, 5000, 'création de la partie');
      if(MODE==='up') await updateSettings({ startSize: 4 }); // partie courte : 1 à 4 cartes
      for(var i=1;i<(AFK ? N-1 : N);i++){ await addBot(); await sleep(30); }
      if(AFK){ var pa = { players:{} }; pa.players['h-afk'] = { name:'Absent', color:'#888888', joinedAt:nowMs(), ready:true, uid:'U-afk', v:APP_VERSION }; await claudeDb.doc('games/'+gameDoc.code).update(pa); await sleep(60); } // v64 : un faux joueur qui ne joue jamais
      await toggleReady(); await until(function(){ return gameDoc.players[myId].ready; }, 5000, 'prêt');
      await startGame();
      var t0 = Date.now(), turnsSeen = 0, afkVoted = false;
      while(gameDoc.status!=='game_over'){
        if(Date.now()-t0 > 900000) throw new Error('la partie ne se termine pas (statut : '+gameDoc.status+', manche '+gameDoc.round+')');
        await actForMe(); await sleep(15);
        if(AFK){ var pp = gameDoc.players['h-afk']; if(pp && pp.miss>=AFK_AFTER && !pp.excluded && !afkVoted){ afkVoted = true; await afkVote('h-afk', 'bot'); } }
      }
      var g = gameDoc;
      ok('la partie va jusqu\'au bout', g.status==='game_over');
      ok('toutes les manches sont jouées', (g.roundLog||[]).length===g.roundPlan.length, 'journal '+(g.roundLog||[]).length+' / '+g.roundPlan.length);
      ok('nombre de joueurs', g.playerOrder.length===N, g.playerOrder.length);
      (g.roundLog||[]).forEach(function(e, i){
        var won = 0; g.playerOrder.forEach(function(id){ won += (e.tricksWon && e.tricksWon[id]) || 0; });
        ok('manche '+(i+1)+' : plis gagnés = nombre de cartes', won===g.roundPlan[i], won+' au lieu de '+g.roundPlan[i]);
      });
      // contrôle de la ligue : relecture complète de la partie (cartes, plis, annonces, scores)
      var audit = null, t1 = Date.now();
      while(Date.now()-t1 < 10000){ audit = await auditGameFull(g); if(audit.state!=='wait') break; await sleep(100); }
      ok('relecture de la partie : valide', audit && audit.state==='ok', JSON.stringify(audit && audit.issues));
      var same = audit && g.playerOrder.every(function(id){ return (audit.scores[id]||0)===(g.scores[id]||0); });
      ok('scores = scores recalculés', same, JSON.stringify(g.scores)+' vs '+JSON.stringify(audit && audit.scores));
      var minH = onlineLeagueCheck(g);
      ok('règle ligue (4 joueurs humains minimum) : refusée comme prévu', !!minH, 'aucun refus alors qu\'un seul humain joue');
      // v60 : protections contre l'injection de code
      ok('esc() échappe les guillemets', esc('"><img src=x onerror=1>\'').indexOf('"')===-1 && esc('a\'b').indexOf("'")===-1, esc('"\''));
      ok('safeColor() refuse le code piégé', safeColor('red;background:url(x)')==='#8A93A6' && safeColor('#C9A24B')==='#C9A24B');
      var html = document.createElement('div'); html.innerHTML = '<option value="'+esc('x" onmouseover="alert(1)')+'">';
      ok('une valeur piégée ne crée pas d\'attribut', html.firstChild && !html.firstChild.hasAttribute('onmouseover'));
      // v60 : ligue — le mode « en ligne » se lit dans l'identifiant, la date vient du serveur
      var fakePs = [{uid:'a',score:1},{uid:'b',score:2},{uid:'c',score:3},{uid:'d',score:4}];
      ok('fausse partie « ancienne » sans date serveur : ne compte pas', attestStatus({id:'o_AAAA_1', mode:'cards', at:1, players:fakePs}).counts===false);
      ok('partie en ligne sans confirmations : ne compte pas', attestStatus({id:'o_AAAA_2', mode:'online', __serverAt:Date.now(), players:fakePs}).counts===false);
      ok('vraie ancienne partie (avant octobre 2026) : compte', attestStatus({id:'o_AAAA_3', __serverAt:Date.UTC(2026,8,1), players:fakePs}).counts===true);
      ok('partie aux vraies cartes : comme avant', attestStatus({id:'s_123_x', mode:'cards', __serverAt:Date.now(), players:fakePs}).counts===true);
      // v60 : les secrets (mains, graine) vont au compte retenu dans la salle d'attente, pas à celui écrit ensuite dans la partie
      primeUidTrust({ code:'ZZZZ', status:'lobby', players:{ a:{ uid:'U-honnete' } } });
      var tampered = { code:'ZZZZ', status:'playing', players:{ a:{ uid:'U-tricheur' }, f:{ uid:'U-tricheur' } } };
      primeUidTrust(tampered);
      ok('compte d\'un joueur modifié en cours de partie : ignoré', keyOfPlayer(tampered,'a')==='U-honnete', keyOfPlayer(tampered,'a'));
      ok('faux joueur ajouté après le début : pas de secret pour lui', !uidIsTrusted(tampered,'f') && uidIsTrusted(tampered,'a'));
      // v60 : boîtes d'amis — chacun ne voit que les documents qui lui sont adressés
      await claudeDb.doc('friendReq2/alice__bob').set({ name:'Bob', at:1, __plain:{ to:'alice', from:'bob' } });
      var seenA = null, seenB = null;
      var u1 = claudeDb.watchBox('friendReq2', 'to', 'alice', function(l){ seenA = l; }), u2 = claudeDb.watchBox('friendReq2', 'to', 'carol', function(l){ seenB = l; });
      await sleep(1500); u1(); u2();
      ok('boîte d\'amis : le destinataire voit sa demande', seenA && seenA.length===1 && seenA[0].data.__plain.from==='bob', JSON.stringify(seenA));
      ok('boîte d\'amis : un autre joueur ne la voit pas', !seenB || seenB.length===0, JSON.stringify(seenB));
      await claudeDb.doc('friendReq2/alice__bob').delete();
      // v60 : parcours complet « ajouter un ami → accepter → inviter » en local
      await claudeDb.doc('profiles/amy').set({ pseudo:'Amy', key:'amy', playerId:'p-amy' });
      await claudeDb.doc('profiles/zed').set({ pseudo:'Zed', key:'zed', playerId:'p-zed' });
      currentProfile = { key:'zed', pseudo:'Zed' };
      await addFriend('amy');
      ok('ajout d\'ami : demande déposée pour Amy', (await claudeDb.doc('friendReq2/amy__zed').get()).exists && !social.addErr, social.addErr);
      currentProfile = { key:'amy', pseudo:'Amy' };
      social.started = false; socialStart();
      await until(function(){ return social.reqs.zed; }, 6000, 'demande reçue par Amy');
      ok('Amy voit la demande de Zed', social.reqs.zed.name.length>0);
      await acceptFriend('zed');
      await until(function(){ return Object.keys(social.friends).some(function(k){ return social.friends[k] && social.friends[k].pkey==='zed'; }); }, 6000, 'ami accepté');
      ok('demande acceptée : Zed est dans les amis d\'Amy, la demande disparaît', true);
      await until(function(){ return !social.reqs.zed; }, 6000, 'demande effacée');
      var zedId = Object.keys(social.friends).filter(function(k){ return social.friends[k] && social.friends[k].pkey==='zed'; })[0];
      await inviteFriend(zedId);
      ok('invitation déposée pour Zed', (await claudeDb.doc('invites2/zed__amy').get()).exists);
      currentProfile = { key:'zed', pseudo:'Zed' }; social.unsubs.forEach(function(u){ try{ u(); }catch(e){} }); social.unsubs = []; social.started = false; socialStart();
      await until(function(){ return social.invites.amy; }, 6000, 'invitation reçue par Zed');
      ok('Zed voit l\'invitation d\'Amy', social.invites.amy.code===g.code);
      await dismissInvite('amy');
      await until(function(){ return !social.invites.amy; }, 6000, 'invitation effacée');
      ok('invitation refusée : elle disparaît', true);
      social.unsubs.forEach(function(u){ try{ u(); }catch(e){} }); social.unsubs = [];
      // v64 : thème Halloween — toutes les cartes se dessinent, le dos aussi ; rire et cri audibles sans saturer
      var oldDeck = deckTheme; setDeckTheme('hallo');
      var drawn = 0, bad = [];
      ['H','D','S','C'].forEach(function(su){ ['A','K','Q','J','10','7'].forEach(function(ra){ try{ var h = cardHtml({ suit:su, rank:ra, value:RANK_VALUE[ra] }, {}); if(h && h.indexOf('card')>=0) drawn++; }catch(e){ bad.push(su+ra+' : '+e.message); } }); });
      ok('thème Halloween : les 24 cartes se dessinent', drawn===24 && !bad.length, bad.join(' | '));
      ok('thème Halloween : Roi, Dame et Valet portent le dessin et le néon du nom du paquet', cardHtml({suit:'H',rank:'K',value:13},{}).indexOf('cafe-neon')>0 && cardHtml({suit:'S',rank:'Q',value:12},{}).indexOf('Chez Monique')>0 && HALLO_DECK_NAME==='Le Cimetière|d\'Albert' && cardHtml({suit:'H',rank:'K',value:13},{}).indexOf('Cimetière')>0 && getComputedStyle(document.documentElement).getPropertyValue('--hallo-back-name').indexOf('Cimeti')>0);
      ok('thème Halloween : fond du jeu appliqué', document.documentElement.getAttribute('data-deck')==='hallo' && !!document.documentElement.style.getPropertyValue('--hallo-back'));
      setDeckTheme(oldDeck);
      var loud = function(which){ var save=[audioCtx,sfxBus,noiseBuf], oc=new OfflineAudioContext(1,44100*3,44100), comp=oc.createDynamicsCompressor();
        comp.threshold.value=-10; comp.knee.value=6; comp.ratio.value=4; comp.connect(oc.destination);
        var bus=oc.createGain(); bus.gain.value=0.85; bus.connect(comp);
        var len=oc.sampleRate*2, nb=oc.createBuffer(1,len,oc.sampleRate), d=nb.getChannelData(0); for(var i=0;i<len;i++) d[i]=Math.random()*2-1;
        audioCtx=oc; sfxBus=bus; noiseBuf=nb; ({bell:sfxBell, roar:sfxRoar})[which](0.05); audioCtx=save[0]; sfxBus=save[1]; noiseBuf=save[2];
        return oc.startRendering().then(function(b){ var x=b.getChannelData(0), pk=0, sq=0, k; for(k=0;k<x.length;k++){ var v=Math.abs(x[k]); if(v>pk) pk=v; sq+=x[k]*x[k]; } return { peak:pk, rms:Math.sqrt(sq/x.length) }; }); };
      var lv1 = await loud('bell'), lv2 = await loud('roar');
      ok('cloche d\'enterrement : audible, sans saturer', lv1.rms>0.005 && lv1.peak<0.98, JSON.stringify(lv1));
      ok('cri grave : audible, sans saturer', lv2.rms>0.01 && lv2.peak<0.98, JSON.stringify(lv2));
      // v64 : musique d'horreur (orgue, piano, vent, porte qui grince) rendue hors-ligne : audible, sans saturer
      var oc3 = null, save2=[audioCtx,sfxBus,musicBus,noiseBuf,horrorFx], oc2=new OfflineAudioContext(1,44100*16,44100), comp2=oc2.createDynamicsCompressor();
      comp2.threshold.value=-10; comp2.knee.value=6; comp2.ratio.value=4; comp2.connect(oc2.destination);
      var mb=oc2.createGain(); mb.gain.value=0.5; mb.connect(comp2);
      var nb2=oc2.createBuffer(1,oc2.sampleRate*2,oc2.sampleRate), d2=nb2.getChannelData(0); for(var q=0;q<d2.length;q++) d2[q]=Math.random()*2-1;
      audioCtx=oc2; musicBus=mb; noiseBuf=nb2; horrorFx=null; musicStep=0; horrorProg=0; pianoNextAmb=1;
      for(var bt=0;bt<10;bt++) musicBeatHorror(0.1+bt*60/46);
      audioCtx=save2[0]; sfxBus=save2[1]; musicBus=save2[2]; noiseBuf=save2[3]; horrorFx=save2[4];
      var mr = await oc2.startRendering(), mx = mr.getChannelData(0), mpk=0, msq=0, mi;
      for(mi=0;mi<mx.length;mi++){ var mv=Math.abs(mx[mi]); if(mv>mpk) mpk=mv; msq+=mx[mi]*mx[mi]; }
      var mrms = Math.sqrt(msq/mx.length);
      ok('musique d\'horreur (accueil) : audible, sans saturer', mrms>0.004 && mpk<0.98, JSON.stringify({ peak:mpk, rms:mrms }));
      // piano creepy (partie) + cloche d'église ambiante
      audioCtx=oc3=new OfflineAudioContext(1,44100*16,44100); var comp3=oc3.createDynamicsCompressor(); comp3.threshold.value=-10; comp3.knee.value=6; comp3.ratio.value=4; comp3.connect(oc3.destination);
      var mb3=oc3.createGain(); mb3.gain.value=0.5; mb3.connect(comp3); var nb3=oc3.createBuffer(1,oc3.sampleRate*2,oc3.sampleRate), d3=nb3.getChannelData(0); for(var q3=0;q3<d3.length;q3++) d3[q3]=Math.random()*2-1;
      musicBus=mb3; sfxBus=mb3; noiseBuf=nb3; horrorFx=null; musicStep=0; pianoNextAmb=1;
      for(var bt3=0;bt3<12;bt3++) musicBeatPiano(0.1+bt3*60/54);
      audioCtx=save2[0]; sfxBus=save2[1]; musicBus=save2[2]; noiseBuf=save2[3]; horrorFx=save2[4];
      var pr = await oc3.startRendering(), px = pr.getChannelData(0), ppk=0, psq=0, pi3; for(pi3=0;pi3<px.length;pi3++){ var pv3=Math.abs(px[pi3]); if(pv3>ppk) ppk=pv3; psq+=px[pi3]*px[pi3]; }
      ok('piano creepy (partie) : audible, sans saturer', Math.sqrt(psq/px.length)>0.003 && ppk<0.98, JSON.stringify({ peak:ppk, rms:Math.sqrt(psq/px.length) }));
      // symboles Halloween : un dessin par couleur, intégré à la carte
      var symOk = ['H','D','C','S'].every(function(su){ return halloSymInline(su).indexOf('<path')>0; });
      setDeckTheme('hallo'); var c7 = cardHtml({suit:'H',rank:'7',value:7},{}); setDeckTheme(oldDeck);
      ok('symboles Halloween (cœur brisé, tombe, fourche, chauve-souris)', symOk && c7.indexOf('hsym hs-H')>0, c7.slice(0,120));
      // v64 : joueur absent — le jeu joue 2 tours à sa place, puis un robot ; vote « remplacer » → dernier, sans point de ligue
      if(AFK){
        var ap = g.players['h-afk'];
        ok('absent : 2 tours joués automatiquement puis marqué absent', ap && ap.miss>=AFK_AFTER, JSON.stringify(ap));
        ok('absent : remplacé par un robot après le vote', ap && ap.excluded==='bot', JSON.stringify(ap));
        ok('absent : il finit dernier au classement', rankingIds(g)[rankingIds(g).length-1]==='h-afk');
        ok('absent : aucun point de ligue (hors enregistrement)', leagueIdsOf(g).indexOf('h-afk')<0 && leagueIdsOf(g).length===N-1);
      }
      // règles de vote (sans partie réelle)
      var gv = { playerOrder:['a','b','c','d'], players:{ a:{miss:2}, b:{}, c:{}, d:{} }, scores:{ a:0, b:0, c:0, d:0 }, afkVotes:{ a:{ b:'bot', c:'bot' } } };
      ok('vote : 2 sur 3 = majorité → remplacer', afkDecision(gv,'a')==='bot' && afkTally(gv,'a').need===2);
      gv.afkVotes = { a:{ b:'bot', c:'out' } }; ok('vote : 1 contre 1 = pas de décision', afkDecision(gv,'a')===null);
      gv.afkVotes = { a:{ b:'out', c:'out', d:'bot' } }; ok('vote : majorité pour « retirer »', afkDecision(gv,'a')==='out');
      gv.players.a.excluded = 'out'; ok('retiré : disparaît du classement', rankingIds(gv).indexOf('a')<0);
      // couronne : premier du classement en ligne de la ligue (saison en cours)
      var lgSave = { games:league.games, members:league.members }, nowT = Date.now(), seas = seasonOf(nowT);
      league.members = [ { id:'m1', name:'Ana', userId:'p-ana' }, { id:'m2', name:'Bob', userId:'p-bob' }, { id:'m3', name:'Cléo', userId:'p-cleo' } ];
      var mk = function(i, ranks){ return { id:'o_AAAA_'+i, at:nowT-1000*(10-i), season:seas, mode:'online', rounds:5, players:[ { memberId:'m1', name:'Ana', rank:ranks[0], uid:'u1', score:1 }, { memberId:'m2', name:'Bob', rank:ranks[1], uid:'u2', score:1 }, { memberId:'m3', name:'Cléo', rank:ranks[2], uid:'u3', score:1 } ] }; };
      league.games = [ mk(1,[1,2,3]), mk(2,[1,2,3]), mk(3,[2,1,3]), mk(4,[1,2,3]) ];
      var ch = crownFromLeague();
      ok('couronne : le premier du classement (Ana : 3 victoires sur 4)', ch && ch.memberId==='m1' && ch.userId==='p-ana' && ch.authUid==='u1', JSON.stringify(ch));
      var crSave = crown; crown = { holder:ch, sig:'t' };
      ok('couronne : affichée pour Ana (même joueur), pas pour un autre', crownMark('p-ana','Ana','u1').indexOf('👑')>0 && crownMark('p-bob','Bob','u2')==='' && crownMark(null,'ana').indexOf('👑')>0 && crownMark('p-x','Ana','uX')==='');
      crown = crSave;
      // récompenses : ⭐ (1 victoire), 🍀 (3), 🃏 (5)
      ok('récompenses : seuils 1 / 3 / 5 victoires', badgeFor(0)===null && badgeFor(1).icon==='⭐' && badgeFor(2).icon==='⭐' && badgeFor(3).icon==='🍀' && badgeFor(4).icon==='🍀' && badgeFor(5).icon==='🃏' && badgeFor(9).icon==='🃏');
      var csave = currentProfile; currentProfile = { key:'ana', pseudo:'Ana' };
      ok('récompenses : mes victoires de ligue comptées (3)', myLeagueWins()===3, myLeagueWins());
      ok('récompenses : le profil montre les trois paliers, le trèfle allumé', (function(){ var d = document.createElement('div'); d.innerHTML = renderBadges(); return d.querySelectorAll('.bdg').length===3 && d.querySelectorAll('.bdg.on').length===2; })());
      currentProfile = csave; league.games = lgSave.games; league.members = lgSave.members;
      // coins de cartes : l'attribut de couleur est présent ; aide du pli courte par défaut
      setDeckTheme('hallo'); ok('cartes : la couleur est portée par la carte (pour colorer le chiffre)', cardHtml({suit:'D',rank:'7',value:7},{}).indexOf('data-suit="D"')>0); ok('cartes à dessin (Roi, Dame, Valet, As de pique) : logo de la couleur dans le coin', ['K','Q','J'].every(function(r){ var x = cardHtml({suit:'H',rank:r,value:11},{}); return x.indexOf('has-art')>0 && x.indexOf('class="s"')>0; })); setDeckTheme(oldDeck);
      var gh = { currentTrick:[ { playerId:'x', card:{ suit:'S', rank:'4', value:4 } } ], turnPlayerId:myId }, lhSave = ledHelpOn; ledHelpOn = false;
      var hOff = ledHint(gh); ledHelpOn = true; var hOn = ledHint(gh); ledHelpOn = lhSave;
      ok('aide du pli : rien d\'affiché par défaut, « On joue à Pique » + détail quand on l\'active', hOff==='' && hOn.indexOf('On joue à')>0 && (hOn.indexOf('tu dois jouer')>0 || hOn.indexOf('tu n\'en as pas')>0), hOff+'|'+hOn.slice(0,80));
      ok('barre du haut : un seul bouton ⚙️ Paramètres', renderSoundButtons().indexOf('prefs-toggle')>0 && renderSoundButtons().indexOf('sfx-toggle')<0);
      var pm = renderPrefsModal(); ok('paramètres : bruitages, musique, aide et grand texte', ['sfx-toggle','music-toggle','led-help-toggle','big-text-toggle'].every(function(a){ return pm.indexOf('data-action="'+a+'"')>0; }));
      var heHtml = renderEntry(); ok('accueil : bouton Paramètres', heHtml.indexOf('data-action="prefs-toggle"')>0);
      setDeckTheme('hallo'); ok('petites cartes Halloween : le logo de la couleur existe', ['J','K','Q'].every(function(r){ return cardHtml({suit:'C',rank:r,value:11},{mini:true}).indexOf('class="s"')>0; })); setDeckTheme(oldDeck);
      // v64 : sondage du nom du paquet — un vote par compte (modifiable), résultats lisibles
      // v72 : coupes (atout joué quand la couleur demandée n'est pas l'atout), couronne dans le classement, stat du jour
      var cutLog = [{ bidOrder:['a','b','c'], trump:{ suit:'H' }, played:[{suit:'S',rank:'9',value:9},{suit:'H',rank:'3',value:3},{suit:'S',rank:'A',value:14}, {suit:'H',rank:'K',value:13},{suit:'H',rank:'2',value:2},{suit:'D',rank:'7',value:7}] }];
      var cutRes = cutStatsFromLog(cutLog);
      ok('coupes : b coupe et gagne le pli 1 ; au pli 2 (atout demandé) personne ne coupe', cutRes.b.cuts===1 && cutRes.b.cutWins===1 && cutRes.a.cuts===0 && cutRes.c.cuts===0, JSON.stringify(cutRes));
      ok('coupes : manche sans atout = aucune coupe', cutStatsFromLog([{ bidOrder:['a','b'], trump:null, played:[{suit:'S',rank:'9',value:9},{suit:'H',rank:'3',value:3}] }]).b.cuts===0);
      // semver : comparaison des versions (anciens numéros entiers = 0.N.0)
      ok('semver : 1.0.0 est plus récent que l\'ancien numéro 79', versionIsNewer('1.0.0','79') && !versionIsNewer('79','1.0.0'));
      ok('semver : 1.10.0 > 1.9.9 (comparaison numérique, pas alphabétique)', versionIsNewer('1.10.0','1.9.9') && !versionIsNewer('1.9.9','1.10.0'));
      ok('semver : deux versions identiques ne sont pas « plus récentes »', !versionIsNewer('1.2.3','1.2.3') && !versionIsNewer('80','80'));
      ok('semver : l\'ancien numéro 80 est plus récent que 79', versionIsNewer('80','79'));
      ok('reprendre ma partie : une salle d\'attente n\'est jamais « à reprendre », une partie en cours oui', LIVE_STATUSES.indexOf('playing')>=0 && LIVE_STATUSES.indexOf('bidding')>=0 && LIVE_STATUSES.indexOf('game_over')<0 && typeof rememberResume==='function');
      try{ localStorage.removeItem('rikiki_resume'); persistLocal(); }catch(e){} ok('reprendre ma partie : rejoindre une salle ne crée plus de « partie à reprendre »', !resumeInfo());
      // v1.1.0 : liens vers les pages légales dans la langue du joueur
      var langAv2 = LANG; LANG = 'fr'; var lf = legalHref('conditions.html'); LANG = 'en'; var le = legalHref('conditions.html'), lk = legalLinksHtml(); LANG = langAv2;
      ok('pages légales : le lien suit la langue (fr = .html, en = .en.html)', lf==='conditions.html' && le==='conditions.en.html' && lk.indexOf('mentions-legales.en.html')>0 && lk.indexOf('Legal notice')>0, lf+' | '+le);
      // v79 : supprimer mon compte
      var oldAuth = fbAuth, oldCp = currentProfile, oldAdm = adminUid, oldDel = profileUi.deleting;
      fbAuth = { currentUser:{ uid:'u1', isAnonymous:false } }; currentProfile = { key:'lea', pseudo:'Léa' }; adminUid = 'autre'; profileUi.deleting = false;
      ok('suppression : lien « Supprimer mon compte » pour un joueur connecté', renderDeleteAccount().indexOf('delete-account-open')>0);
      profileUi.deleting = true; var delHtml = renderDeleteAccount();
      ok('suppression : le panneau demande le pseudo et le code', delHtml.indexOf('id="deletePseudo"')>0 && delHtml.indexOf('id="deletePin"')>0 && delHtml.indexOf('delete-account-go')>0);
      profileUi.delPseudo = 'Léa'; profileUi.delPin = '0107'; profileUi.deleteConfirm = false; var d1 = renderDeleteAccount();
      ok('suppression : ce qui est écrit dans les champs est gardé après un redessin', d1.indexOf('value="Léa"')>0 && d1.indexOf('value="0107"')>0 && d1.indexOf('Supprimer définitivement')>0 && d1.indexOf('Oui, supprimer pour toujours')<0);
      profileUi.deleteConfirm = true; var d2 = renderDeleteAccount();
      ok('suppression : 2e étape dans la page (pas de fenêtre du navigateur)', d2.indexOf('Oui, supprimer pour toujours')>0 && d2.indexOf('Dernière confirmation')>0);
      profileUi.delPseudo = ''; profileUi.delPin = ''; profileUi.deleteConfirm = false;
      ok('suppression : l\'adresse gardée dans le profil vidé ne contient pas le pseudo', DELETED_EMAIL==='supprime@rikiki.invalid' && /@rikiki[.]invalid$/.test(DELETED_EMAIL));
      adminUid = 'u1'; ok('suppression : jamais proposée à l\'organisateur', renderDeleteAccount()==='');
      fbAuth = oldAuth; currentProfile = oldCp; adminUid = oldAdm; profileUi.deleting = oldDel;
      // v78 : jeu automatique quand une seule carte est jouable
      var fg = { currentTrick:[{ playerId:'x', card:{ suit:'H', rank:'9', value:9 } }] };
      ok('auto-jeu : une seule carte de la couleur demandée = 1 carte jouable', legalCards(fg, [{suit:'H',rank:'K',value:13},{suit:'S',rank:'2',value:2}]).length===1);
      ok('auto-jeu : aucune carte de la couleur demandée = toute la main jouable (pas d\'auto-jeu)', legalCards(fg, [{suit:'S',rank:'3',value:3},{suit:'S',rank:'2',value:2}]).length===2);
      ok('auto-jeu : le réglage existe dans les paramètres', renderPrefsModal().indexOf('data-action="autoplay-toggle"')>0 && typeof autoPlayOn==='boolean');
      // v76 : invitation à créer un profil pour les invités, à la fin de la partie
      var nudgeG = { players:{ me:{ name:'Léa' } } }, oldMe = myId, oldProf = currentProfile; myId = 'me'; currentProfile = null; signupNudgeHidden = false;
      var nudge = signupNudgeHtml(nudgeG);
      ok('invitation : un invité voit « Créer mon profil » avec son prénom de partie', nudge.indexOf('signup-nudge-go')>0 && nudge.indexOf('« Léa »')>0, nudge.slice(0,80));
      currentProfile = { key:'k', pseudo:'Léa' }; ok('invitation : rien pour un joueur déjà connecté', signupNudgeHtml(nudgeG)==='');
      currentProfile = null; signupNudgeHidden = true; ok('invitation : fermée avec ✕, elle ne revient pas', signupNudgeHtml(nudgeG)===''); signupNudgeHidden = false; myId = oldMe; currentProfile = oldProf;
      // v75 : tournoi du dimanche (2026-10-18 est un dimanche ; 2026-10-19 un lundi)
      var sun1 = Date.UTC(2026,9,18,15), sun2 = Date.UTC(2026,9,18,18), mon = Date.UTC(2026,9,19,15);
      var tg = [{mode:'online',at:sun1,players:[{memberId:'m_a',rank:1},{memberId:'m_b',rank:2},{memberId:'m_c',rank:3},{memberId:'m_d',rank:4}]},
                {mode:'online',at:sun2,players:[{memberId:'m_b',rank:1},{memberId:'m_a',rank:2},{memberId:'m_c',rank:3},{memberId:'m_d',rank:4}]},
                {mode:'online',at:mon,players:[{memberId:'m_c',rank:1},{memberId:'m_a',rank:2},{memberId:'m_b',rank:3},{memberId:'m_d',rank:4}]}];
      var tr = computeTournaments(tg);
      ok('tournoi : seul le dimanche compte (le lundi est ignoré)', tr.length===1 && tr[0].games===2 && tr[0].key==='2026-10-18', JSON.stringify(tr));
      ok('tournoi : a et b ont 7 points (4+3 / 3+4), a gagne le départage (1 V chacun, même nombre de parties -> premier trouvé)', tr[0].ranked[0].pts===7 && tr[0].ranked[1].pts===7 && tr[0].ranked[2].pts===4 && tr[0].ranked[3].pts===2);
      ok('tournoi : un seul passage = pas classé', computeTournaments([tg[0]])[0].ranked.length===0);
      ok('tournoi : heure belge (dimanche 23h30 UTC = lundi 01h30 à Bruxelles)', tourneyDayOf(Date.UTC(2026,9,18,23,30)).weekday===1);
      // v74 : contrats ruinés (pire ennemi / victime préférée)
      var rvRes = rivalStatsFromLog([{ bidOrder:['a','b','c'], trump:null, bids:{a:0,b:1,c:0}, tricksWon:{a:0,b:0,c:1}, played:[{suit:'H',rank:'9',value:9},{suit:'H',rank:'K',value:13},{suit:'H',rank:'A',value:14}] }]);
      ok('ennemi : c (As) ruine le contrat de b (Roi, 2e du pli) ; a ne perd rien', rvRes.b && rvRes.b.c===1 && !rvRes.a && !rvRes.c, JSON.stringify(rvRes));
      ok('ennemi : égalité entre deux voleurs = personne accusé', Object.keys(rivalStatsFromLog([{ bidOrder:['a','b','c'], trump:null, bids:{a:0,b:2,c:0}, tricksWon:{a:1,b:0,c:1}, played:[{suit:'H',rank:'9',value:9},{suit:'H',rank:'K',value:13},{suit:'H',rank:'A',value:14},{suit:'H',rank:'3',value:3},{suit:'H',rank:'A',value:14},{suit:'H',rank:'K',value:13}] }])).length===0);
      ok('ennemi : l\'historique des parties passées est embarqué', Object.keys(RIVALS_HISTORY).length>=30);
      var hcut = historicCuts('o_49KW_1790851103662', 'm_mul5tnvlb5fa');
      ok('coupes : l\'historique des parties passées est retrouvé (K.vroom, partie 49KW : 12 coupes, 12 gagnantes)', hcut && hcut.cuts===12 && hcut.cutWins===12 && !historicCuts('o_inconnue_1','m_x'));
      var lgSaveGames = league.games, mk = function(r1, r2, c1, c2){ return { id:'x'+c1, season:'x', mode:'online', at:1, rounds:5, players:[{ memberId:'A', name:'Alice', rank:r1, score:10, contracts:3, absDiff:2, cuts:c1, cutWins:c1 },{ memberId:'B', name:'Bob', rank:r2, score:5, contracts:2, absDiff:3, cuts:c2, cutWins:0 }] }; };
      league.games = [mk(1,2,6,1), mk(1,2,4,2), mk(2,1,5,3)];
      var crownSave = crown.holder, topRow = computeLeague('all','online').ranked[0], rowB = computeLeague('all','online').ranked[1];
      ok('coupes : A = 15 coupes en 3 parties dans ses stats', topRow.id==='A' && topRow.cuts===15 && topRow.cutGames===3, JSON.stringify([topRow.cuts, topRow.cutGames]));
      crown.holder = { memberId: topRow.id, userId:null, name: topRow.name, authUid:null };
      ok('couronne : affichée devant le premier dans le classement de la ligue (et pas devant les autres)', renderLeagueRow(topRow, 0, true).indexOf('class="crown"')>0 && renderLeagueRow(rowB, 1, true).indexOf('class="crown"')<0);
      crown.holder = crownSave;
      var nowSave = nowMs, dailyOut = [0,1,2].map(function(k){ nowMs = function(){ return (20000 + k) * 86400000; }; return leagueDailyStat(); }); nowMs = nowSave;
      ok('stat du jour : 3 stats différentes, une par jour, avec le nom du joueur', dailyOut.every(function(h){ return h.indexOf('Stat du jour')>0 && h.indexOf('Alice')>0; }) && new Set(dailyOut).size===3, dailyOut.map(function(h){ return h.slice(0,90); }).join(' | '));
      league.games = [mk(1,2,6,1)];
      ok('stat du jour : moins de 3 parties avec détail = rien d\'affiché', leagueDailyStat()==='');
      league.games = lgSaveGames;
      // v73 : partie légale EN VEILLE (LEGAL_READY = false) : rien d'affiché, rien de chargé chez Google
      var legalSave = LEGAL_READY; LEGAL_READY = false;
      ok('légal en veille : aucun lien légal à l\'accueil ni dans les Paramètres', renderEntry().indexOf('confidentialite.html')<0 && renderPrefsModal().indexOf('confidentialite.html')<0 && renderPrefsModal().indexOf('sec-consent-toggle')<0);
      var fb0 = window.firebase, act0 = 0, cs0 = localStorage.getItem(CONSENT_KEY), as0 = appCheckStarted; appCheckStarted = false;
      window.firebase = { appCheck: function(){ return { activate: function(){ act0++; } }; } }; window.firebase.appCheck.ReCaptchaV3Provider = function(){};
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ v:1, security:true, at:Date.now() })); startAppCheckIfAllowed();
      ok('légal en veille : reCAPTCHA (Google) n\'est jamais chargé, même si un ancien accord est enregistré', act0===0);
      if(cs0===null) localStorage.removeItem(CONSENT_KEY); else localStorage.setItem(CONSENT_KEY, cs0); window.firebase = fb0; appCheckStarted = as0;
      ok('code : un nouveau code fait 4 chiffres (1234, 0000, 4321 refusés ; 4821 accepté ; 6 chiffres refusé à la création)', validNewPin('4821') && !validNewPin('1234') && !validNewPin('0000') && !validNewPin('4321') && !validNewPin('1111') && !validNewPin('482916') && !validNewPin('481'));
      ok('code organisateur : 8 à 12 chiffres, sans suite ni répétition (12345678, 00000000, 12121212, 1234567 refusés ; 58302147 accepté) ; la connexion accepte 4 à 12 chiffres', validAdminPin('58302147') && validAdminPin('583021479415') && !validAdminPin('12345678') && !validAdminPin('00000000') && !validAdminPin('12121212') && !validAdminPin('1234567') && !validAdminPin('5830214794151') && validPin('4821') && validPin('58302147') && !validPin('123') && !validPin('12ab'));
      ok('code : à la connexion, les codes de 4 à 12 chiffres sont acceptés', validPin('4821') && validPin('482916') && !validPin('48') && !validPin('4829163123456'));
      LEGAL_READY = true; // les contrôles suivants vérifient la partie légale activée
      // v73 : vie privée et accessibilité
      ok('GIF : seul static.klipy.com est accepté (ni un autre site, ni un faux « klipy.com » dans le chemin)', looksLikeGifUrl('https://static.klipy.com/ii/abc/def.gif') && !looksLikeGifUrl('https://evil.example/pixel.gif') && !looksLikeGifUrl('https://evil.example/x?klipy.com') && !looksLikeGifUrl('https://static.klipy.com.evil.example/a.gif') && !looksLikeGifUrl('http://static.klipy.com/a.gif'));
      var gifSave = gifConsent(); gifConsentSet(false);
      var gifMsg = { gif:'https://static.klipy.com/ii/abc/def.gif', name:'Léa' };
      ok('GIF : sans accord, aucune image n\'est chargée (bouton « toucher pour afficher » à la place)', chatBodyHtml(gifMsg).indexOf('<img')<0 && chatBodyHtml(gifMsg).indexOf('gif-allow')>0);
      gifConsentSet(true);
      ok('GIF : avec accord, l\'image s\'affiche avec une description (alt) qui dit qui l\'a envoyée', chatBodyHtml(gifMsg).indexOf('alt="GIF envoyé par Léa"')>0);
      ok('GIF : un GIF venant d\'un autre site n\'est jamais affiché, même avec accord', chatBodyHtml({ gif:'https://evil.example/pixel.gif' }).indexOf('<img')<0);
      if(!gifSave) gifConsentSet(false);
      var consentSave = localStorage.getItem(CONSENT_KEY), fbSave = window.firebase, ufSave = usingFirebase, scrSave = screen, acs = appCheckStarted, activated = 0;
      localStorage.removeItem(CONSENT_KEY); appCheckStarted = false;
      window.firebase = { appCheck: function(){ return { activate: function(){ activated++; } }; } }; window.firebase.appCheck.ReCaptchaV3Provider = function(){};
      var croot = document.getElementById('consent-root'); if(!croot){ croot = document.createElement('div'); croot.id = 'consent-root'; document.body.appendChild(croot); }
      usingFirebase = true; screen = 'entry'; consentSig = ''; renderConsent();
      var bannerShown = !!croot.querySelector('.consent');
      startAppCheckIfAllowed();
      ok('consentement : bannière visible sans choix, et reCAPTCHA PAS chargé tant que l\'utilisateur n\'a pas dit oui', bannerShown && activated===0 && securityConsent()===null);
      croot.querySelector('[data-consent="no"]').click();
      ok('consentement : « Refuser » enregistre le refus, cache la bannière et ne charge pas reCAPTCHA', securityConsent()===false && !croot.querySelector('.consent') && activated===0);
      localStorage.removeItem(CONSENT_KEY); consentSig = ''; renderConsent(); croot.querySelector('[data-consent="yes"]').click();
      ok('consentement : « Accepter » enregistre l\'accord et charge reCAPTCHA une seule fois', securityConsent()===true && activated===1);
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ v:1, security:true, at: Date.now() - 400*86400000 }));
      ok('consentement : un choix vieux de plus de 12 mois est redemandé', securityConsent()===null);
      screen = 'game'; localStorage.removeItem(CONSENT_KEY); consentSig = 'x'; renderConsent();
      ok('consentement : jamais de bannière devant les cartes (écran de partie)', !croot.querySelector('.consent'));
      if(consentSave===null) localStorage.removeItem(CONSENT_KEY); else localStorage.setItem(CONSENT_KEY, consentSave);
      window.firebase = fbSave; usingFirebase = ufSave; screen = scrSave; appCheckStarted = acs; consentSig = ''; renderConsent();
      var langAv3 = LANG; LANG = 'fr'; var okFr = ['confidentialite.html','conditions.html','cookies.html','mentions-legales.html'].every(function(h){ return renderEntry().indexOf('href="'+h+'"')>0; });
      LANG = 'en'; var okEn = ['confidentialite.en.html','conditions.en.html','cookies.en.html','mentions-legales.en.html'].every(function(h){ return renderEntry().indexOf('href="'+h+'"')>0; }); LANG = langAv3; // la langue du navigateur varie (Mac en français, GitHub en anglais)
      ok('liens légaux : confidentialité, conditions, cookies et mentions légales à l\'accueil', okFr && okEn, 'fr='+okFr+' en='+okEn);
      // v73 : parcours de profil — un choix clair, un bouton par écran, confirmation visible
      var cpSave = currentProfile, tabSave = profileUi.tab, flashSave = profileFlash, hpSave = homeProfileOpen; currentProfile = null; homeProfileOpen = true;
      profileUi.tab = null; var chooser = renderEntry();
      ok('profil : à l\'ouverture, deux choix clairs (créer / me connecter) et aucun champ', chooser.indexOf('data-tab="create"')>0 && chooser.indexOf('data-tab="login"')>0 && chooser.indexOf('id="profilePin"')<0);
      profileUi.tab = 'create'; var pform = renderEntry();
      ok('profil : écran « Créer » = un seul bouton Créer, la case 13 ans + conditions, pas de bouton Se connecter', pform.indexOf('data-action="profile-create"')>0 && pform.indexOf('id="profileTerms"')>0 && pform.indexOf('data-action="profile-login"')<0, pform.slice(0,60));
      profileUi.tab = 'login'; var lform = renderEntry();
      ok('profil : écran « Connexion » = un seul bouton Se connecter, pas de case, pas de bouton Créer', lform.indexOf('data-action="profile-login"')>0 && lform.indexOf('data-action="profile-create"')<0 && lform.indexOf('id="profileTerms"')<0);
      profileUi.err = 'Pseudo inconnu. Pour le créer, clique « Créer mon profil ».'; var unk = renderEntry(); profileUi.err = 'Ce pseudo est déjà pris. Si c\'est le tien, clique « Se connecter ».'; var taken = renderEntry(); profileUi.err = '';
      ok('profil : après une erreur, la bonne porte est proposée (« Créer ce profil » / « C\'est moi : me connecter »)', unk.indexOf('Créer ce profil')>0 && taken.indexOf('C\'est moi : me connecter')>0);
      profileFlash = { kind:'created', pseudo:'<b>Léa</b>', at:Date.now() }; var fl = renderEntry();
      ok('profil : message « Profil créé ! » affiché après la création (et le pseudo est protégé contre le HTML)', fl.indexOf('✅ Profil créé')>0 && fl.indexOf('&lt;b&gt;Léa')>0 && fl.indexOf('<b>Léa</b>')<0);
      profileFlash = { kind:'login', pseudo:'Léa', at:Date.now() }; ok('profil : message « Connecté » après une connexion', renderEntry().indexOf('✅ Connecté')>0);
      profileFlash = null; ok('accueil : un invité voit clairement qu\'il est invité', renderEntry().indexOf('Invité')>0);
      currentProfile = { key:'lea', pseudo:'Léa', playerId:'p-x', color:'#C9A24B' }; ok('accueil : un joueur connecté voit « Profil connecté »', renderEntry().indexOf('Profil connecté')>0);
      currentProfile = cpSave; profileUi.tab = tabSave; profileFlash = flashSave; homeProfileOpen = hpSave;
      var cr = function(hex, ink){ var g = function(h){ var n = parseInt(h.slice(1),16), f = function(v){ v /= 255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f((n>>16)&255)+0.7152*f((n>>8)&255)+0.0722*f(n&255); }; var a = g(hex), b = g(ink); return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05); };
      var palette = ['#C9A24B','#5E7CE2','#E2B357','#FF7A3D','#7FD6A8','#E46A8A','#9A7BE0','#4FB3BF','#FFFFFF','#111111','#2E8B57','#8A2BE2'];
      ok('contraste : l\'initiale d\'un joueur est lisible (4,5:1 au moins) sur toute couleur de pastille', palette.every(function(c){ return cr(c, inkOn(c)) >= 4.5; }), palette.map(function(c){ return c+':'+cr(c, inkOn(c)).toFixed(1); }).join(' '));
      LEGAL_READY = false; var pform0 = (function(){ var cp = currentProfile, ts = profileUi.tab, hp = homeProfileOpen; currentProfile = null; homeProfileOpen = true; profileUi.tab = 'create'; var h = renderEntry(); currentProfile = cp; profileUi.tab = ts; homeProfileOpen = hp; return h; })();
      ok('légal en veille : pas de case « conditions » à la création du profil (code à 4 chiffres affiché)', pform0.indexOf('id="profileTerms"')<0 && pform0.indexOf('Code (4 chiffres)')>0);
      LEGAL_READY = legalSave;
      var appEl = document.getElementById('app'); a11yPass();
      var noLabel = [].slice.call(document.querySelectorAll('#app input:not([type=hidden]), #app select, #app textarea')).filter(function(f){ return !(f.getAttribute('aria-label') || f.getAttribute('aria-labelledby') || f.closest('label') || (f.id && document.querySelector('label[for="'+f.id+'"]'))); });
      ok('accessibilité : tous les champs de l\'écran ont une étiquette', noLabel.length===0, noLabel.map(function(f){ return f.id||f.type; }).join(','));
      var noCard = [].slice.call(document.querySelectorAll('#app .card')).filter(function(c){ return !(c.getAttribute('aria-label') || c.getAttribute('aria-hidden')==='true'); });
      ok('accessibilité : toutes les cartes affichées ont une description (ou sont masquées aux lecteurs car déjà portées par leur bouton)', noCard.length===0, String(noCard.length));
      var langAvant = LANG; LANG = 'fr'; var aFr = cardAriaLabel('S','A')==='As de pique' && cardAriaLabel('H','K')==='Roi de cœur' && cardAriaLabel('D','7')==='7 de carreau'; // la langue du navigateur varie (Mac en français, GitHub en anglais) : on fixe la langue
      LANG = 'en'; var aEn = cardAriaLabel('S','A')==='Ace of spades' && cardAriaLabel('H','K')==='King of hearts'; LANG = langAvant;
      ok('accessibilité : description des cartes en français et en anglais', aFr && aEn, 'fr='+aFr+' en='+aEn);
      ok('accessibilité : la page de départ déclare sa langue et une description', document.documentElement.getAttribute('lang') && !!document.querySelector('meta[name="description"]') && document.getElementById('app').tagName==='MAIN');
      POLL.end = 0; // test : sondage ouvert (la vraie date de fin est passée, le nom est choisi)
      await pollVote(1); await pollVote(2);
      var pv = await claudeDb.collection(pollPath()).get(), pcs = pv.docs.map(function(d){ var x=d.data(); return (x.__plain && x.__plain.c!=null) ? x.__plain.c : x.c; });
      ok('sondage : un seul vote par compte, le dernier compte', pv.docs.length===1 && pcs[0]===2, JSON.stringify(pcs));
      await pollOpen(); var root0 = document.getElementById('news-root');
      ok('sondage : la visite s\'ouvre sur le vote avec les 3 noms et mon vote', root0.querySelectorAll('[data-action="poll-vote"]').length===POLL.options.length && root0.querySelector('.picked') && root0.querySelector('.picked').textContent.indexOf(POLL.options[2])>=0, root0.innerHTML.slice(0,200));
      var pollEndSave = POLL.end; POLL.end = 1; // sondage fini : résultat public en pourcentages, sans nombre de votes ni boutons de vote
      newsStep = NEWS_SLIDES.length-1; renderPoll(); var rf = document.getElementById('news-root');
      ok('sondage fini : 71 % / 29 % / 0 % affichés, gagnant en évidence, pas de bouton de vote ni de nombre de votes', rf.innerText.indexOf('71 %')>=0 && rf.innerText.indexOf('29 %')>=0 && rf.innerText.indexOf('0 %')>=0 && rf.querySelector('.poll-bar.win') && !rf.querySelector('[data-action="poll-vote"]') && !/\bvotes?\b/.test(rf.querySelector('.tt-scene').innerText), rf.querySelector('.tt-scene').innerText.slice(0,120));
      ok('sondage fini : la bannière d\'accueil montre le résultat à tout le monde', renderPollBanner().indexOf('71 %')>0 || !(usingFirebase||usingMock));
      POLL.end = pollEndSave;
      newsStep = 0; renderPoll(); ok('visite des nouveautés : première diapo avec les cartes Halloween', !!root0.querySelector('.news-hcard') && root0.querySelectorAll('.tt-box').length===1);
      pollClose(); notesOpen = true; renderPoll(); ok('notes de version : tout le détail (nouveautés et corrections)', root0.querySelectorAll('.news-list li').length===NEWS.items.length+NEWS.fixes.length, root0.querySelectorAll('.news-list li').length);
      notesOpen = false; renderPoll();
      finish();
    }catch(e){ finish({ crash: String(e && e.message || e) }); }
  }
  window.__startBotsTest = run;
})();
