"""Fabrique les pages de test dans ./srv à partir de ../index.html (sans toucher au vrai fichier).
Usage : python3 build_test_pages.py && (cd srv && python3 -m http.server 8765)
- srv/index.html  : mode local (mock localStorage, pas de Firebase), redirection coupée, __dbg exposé
- srv/social.html : pareil mais profil dans sessionStorage (deux onglets = deux joueurs)"""
import os
s = open('index.html', encoding='utf-8').read()
s = s.replace("var MOVED_TO = 'https://rikikigame.github.io/rikikigame/';", "var MOVED_TO = '';")
# IMPORTANT : couper la vraie base Firebase. Sans ça, avec internet, les pages de test écrivent dans la VRAIE base
# (l'ancien environnement de test n'avait pas internet, d'où le mode local « par accident »).
import re
s, nkey = re.subn(r'apiKey: "[^"]*"', 'apiKey: "COLLE_TA_CLE_ICI_TEST"', s, count=1)
assert nkey == 1, 'clé Firebase introuvable'
s = s.replace("var homeProfileOpen = false;", "var homeProfileOpen = true;")
dbg = "\nwindow.__dbg=function(){ return {g:gameDoc, db:claudeDb, hand:myHand, id:myId, lg:league, an:analysis, deal:myDeal, bot:botDeal, sec:mySecret, log:logDoc, key:myKeyId(), social:social, fn:{ensureMember:ensureMember, linkMember:linkMember, loadLeague:loadLeague, addFriend:addFriend, acceptFriend:acceptFriend, removeFriend:removeFriend, inviteFriend:inviteFriend, presenceBeat:presenceBeat, analyzeRecords:analyzeRecords, dealCards:dealCards, legalCards:legalCards, trickWinner:trickWinner, trickOrderFrom:trickOrderFrom, sfx:function(){ return {last:sfxLast, on:sfxOn, music:musicOn, ctx:audioCtx && audioCtx.state, timer:!!musicTimer}; }, katana:function(){ audioUnlock(); sfxKatana(audioCtx.currentTime+0.05); }, impact:function(){ audioUnlock(); sfxImpact(audioCtx.currentTime+0.05); }, deal:function(){ audioUnlock(); sfxDeal(audioCtx.currentTime+0.05, 8); }, aceKing:aceTakesMasterKing, play:function(n){ audioUnlock(); if(musicBus) musicBus.gain.value=0.5; var t=audioCtx.currentTime+0.05; if(n==='witch'||n==='scream'||n==='creak'){ return sfxSample(n, t, 0.95) ? 'ok' : ('absent : '+halloBufState[n]); } ({katana:sfxKatana, bell:sfxBell, roar:sfxRoar})[n](t); return audioCtx.state; }, horrorMusic:function(){ audioUnlock(); musicBus.gain.value=0.5; musicStep=0; horrorProg=0; var t=audioCtx.currentTime+0.1; for(var i=0;i<10;i++) musicBeatHorror(t+i*60/46); return audioCtx.state; }, pianoMusic:function(){ audioUnlock(); musicBus.gain.value=0.5; musicStep=0; pianoNextAmb=audioCtx.currentTime+9; var t=audioCtx.currentTime+0.1; for(var i=0;i<24;i++) musicBeatPiano(t+i*60/54); return audioCtx.state; }, samples:function(){ return halloBufState; }, sfxOnGame:sfxOnGame, cardHtml:cardHtml, setDeckTheme:setDeckTheme, cleanOldGames:cleanOldGames, purgeLegacyPins:purgeLegacyPins, maint:function(){ return maintUi; }}}; };\ninit();\n})();"
assert "\ninit();\n})();" in s
os.makedirs('srv', exist_ok=True)
open('srv/index.html', 'w', encoding='utf-8').write(s.replace("\ninit();\n})();", dbg))
t = s
for a, b in (("localStorage.getItem('rikiki_profile')", "sessionStorage.getItem('rikiki_profile')"),
             ("localStorage.setItem('rikiki_profile'", "sessionStorage.setItem('rikiki_profile'"),
             ("localStorage.removeItem('rikiki_profile')", "sessionStorage.removeItem('rikiki_profile')"),
             # identifiant de joueur par onglet (sinon deux onglets = le même joueur)
             ("id = localStorage.getItem('rikiki_fb_uid');", "id = sessionStorage.getItem('rikiki_fb_uid');"),
             ("localStorage.setItem('rikiki_fb_uid', id); }", "sessionStorage.setItem('rikiki_fb_uid', id); }")):
    t = t.replace(a, b)
open('srv/social.html', 'w', encoding='utf-8').write(t.replace("\ninit();\n})();", dbg))
# page du test « parties de robots » : le jeu + le test automatique (tests/harness_robots.js)
h = open('tests/harness_robots.js', encoding='utf-8').read()
fast = "<script>(function(){var F=40,r=Date.now,s=r();Date.now=function(){return s+(r()-s)*F};var si=window.setInterval,st=window.setTimeout;window.setInterval=function(f,d){return si(f,Math.max(5,(d||0)/F))};window.setTimeout=function(f,d){return st(f,(d||0)/F)}})();</script>"  # horloge x40 : la partie dure quelques secondes
b = s.replace("\ninit();\n})();", "\n" + h + "\ninit();\nwindow.__startBotsTest();\n})();").replace("<head>", "<head>" + fast, 1)
open('srv/bots.html', 'w', encoding='utf-8').write(b)
print('pages de test prêtes dans ./srv')

# v73 : polices et pages légales (valeurs bidon) disponibles dans le serveur de test
import shutil, subprocess
shutil.copytree('assets/fonts' if os.path.isdir('assets/fonts') else 'fonts', 'srv/fonts', dirs_exist_ok=True)  # sur GitHub (tests automatiques) les polices sont dans fonts/
subprocess.run(['python3', 'faire_pages_legales.py', 'srv'], env=dict(os.environ, RIKIKI_LEGAL_TEST='1'), check=False, capture_output=True)
