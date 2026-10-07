/* ===================== local mock (standalone/offline testing) ===================== */
var MOCK_PREFIX = 'rikiki_mockdb::';
var mockListeners = {};
var MOCK_COLORS = ['#C9A24B','#5E7CE2','#C4544A','#3F8F6B','#B48A3D','#7A5FA0','#4E9CB0','#B06A9E'];
// Chaque onglet a sa propre copie en cache de localStorage : un « lire-modifier-écrire » perd des écritures
// quand plusieurs onglets écrivent en même temps. Le mode local stocke donc chaque update() comme un
// petit correctif à part (clé unique), fusionné à la lecture — comme le fait le vrai stockage côté serveur.
var mockSeq = 0;
function mockStamp(){ mockSeq = (mockSeq+1) % 1000; return String(Date.now()*1000 + mockSeq).padStart(17,'0'); }
function mockPatchKeys(path){
  var pre = MOCK_PREFIX + path + '#p#', out = [];
  try{ for(var i=0;i<localStorage.length;i++){ var k = localStorage.key(i); if(k && k.indexOf(pre)===0) out.push(k); } }catch(e){}
  return out.sort();
}
function mockGetRaw(path){
  try{
    var v = localStorage.getItem(MOCK_PREFIX+path);
    var base = v==null ? null : JSON.parse(v);
    var baseT = localStorage.getItem(MOCK_PREFIX+path+'#t') || '';
    if(base && typeof base==='object' && base.__mt!==undefined){ baseT = base.__mt; base = base.__md; } // base + horodatage écrits en une seule fois
    mockPatchKeys(path).forEach(function(k){
      var t = k.split('#p#')[1].split('_')[0];
      if(t > baseT){ base = mockDeepMerge(base||{}, JSON.parse(localStorage.getItem(k))); }
    });
    return base;
  }catch(e){ return null; }
}
function mockSetRaw(path, data){
  try{
    var t = mockStamp();
    localStorage.setItem(MOCK_PREFIX+path, JSON.stringify({ __mt:t, __md:data })); // atomique : les onglets ne voient jamais un état à moitié écrit
    mockPatchKeys(path).forEach(function(k){ if(k.split('#p#')[1].split('_')[0] <= t) localStorage.removeItem(k); });
  }catch(e){ console.error(e); }
}
function mockPatch(path, patch){
  try{ localStorage.setItem(MOCK_PREFIX+path+'#p#'+mockStamp()+'_'+Math.random().toString(36).slice(2,7), JSON.stringify(patch)); }catch(e){ console.error(e); }
}
function deepFreeze(o){ if(o && typeof o==='object' && !Object.isFrozen(o)){ Object.freeze(o); Object.keys(o).forEach(function(k){ deepFreeze(o[k]); }); } return o; }
// Le vrai db de claude.ai livre des snapshots GELÉS (Object.freeze) : on reproduit ça ici pour que les bugs de mutation se voient aussi en local.
function mockSnap(path, data){ var id=path.split('/').pop(); var frozen = data==null ? undefined : deepFreeze(JSON.parse(JSON.stringify(data))); return { id:id, exists: data!=null, data:function(){ return frozen; } }; }
function mockNotify(path){
  var data = mockGetRaw(path);
  (mockListeners[path]||[]).slice().forEach(function(cb){ try{ cb(mockSnap(path,data)); }catch(e){ console.error(e); } });
}
function mockDeepMerge(target, patch){
  var result = Object.assign({}, target||{});
  Object.keys(patch).forEach(function(k){
    var pv = patch[k];
    var tv = target ? target[k] : undefined;
    if(pv && typeof pv==='object' && !Array.isArray(pv) && tv && typeof tv==='object' && !Array.isArray(tv)){
      result[k] = mockDeepMerge(tv, pv);
    } else {
      result[k] = pv;
    }
  });
  return result;
}
window.addEventListener('storage', function(e){
  if(!e.key || e.key.indexOf(MOCK_PREFIX)!==0) return;
  mockNotify(e.key.slice(MOCK_PREFIX.length).split('#')[0]);
});
function mockDocRef(path){
  return {
    id: path.split('/').pop(),
    path: path,
    get: async function(){ return mockSnap(path, mockGetRaw(path)); },
    set: async function(data){ mockSetRaw(path, data); mockNotify(path); },
    update: async function(patch){
      if(mockGetRaw(path)==null){ var err = new Error('document absent'); err.code='invalid_argument'; throw err; }
      mockPatch(path, JSON.parse(JSON.stringify(patch))); mockNotify(path);
    },
    // v45 : réservation « un seul gagnant » (voir firebaseDocRef.claim). En local : on écrit, on attend, on relit.
    claim: async function(fn){
      var cur = mockGetRaw(path); if(cur==null) return false;
      var tok = Math.random().toString(36).slice(2), p = fn(JSON.parse(JSON.stringify(cur)), tok); if(!p) return false;
      mockPatch(path, JSON.parse(JSON.stringify(p))); mockNotify(path);
      await new Promise(function(r){ setTimeout(r, 80); });
      var after = mockGetRaw(path);
      return !!(after && after.claimTok === tok);
    },
    delete: async function(){ try{ localStorage.removeItem(MOCK_PREFIX+path); localStorage.removeItem(MOCK_PREFIX+path+'#t'); mockPatchKeys(path).forEach(function(k){ localStorage.removeItem(k); }); }catch(e){} mockNotify(path); },
    onSnapshot: function(next, err){
      mockListeners[path] = mockListeners[path] || [];
      mockListeners[path].push(next);
      setTimeout(function(){ next(mockSnap(path, mockGetRaw(path))); }, 20);
      return function(){
        var arr = mockListeners[path];
        if(!arr) return;
        var i = arr.indexOf(next);
        if(i>=0) arr.splice(i,1);
      };
    }
  };
}
function mockCollection(cpath){
  var q = { order:null, dir:'asc', lim:1000 };
  function build(o){
    return {
      path: cpath,
      doc: function(id){ return mockDocRef(cpath+'/'+(id || ('d'+Math.random().toString(36).slice(2,10)))); },
      add: async function(data){ var r = mockDocRef(cpath+'/d'+Math.random().toString(36).slice(2,10)); await r.set(data); return r; },
      orderBy: function(f, d){ return build(Object.assign({}, o, { order:f, dir:d||'asc' })); },
      limit: function(n){ return build(Object.assign({}, o, { lim:n })); },
      where: function(){ return build(o); },
      get: async function(){
        var pre = MOCK_PREFIX + cpath + '/', docs = [];
        for(var i=0;i<localStorage.length;i++){
          var k = localStorage.key(i);
          if(k && k.indexOf(pre)===0 && k.slice(pre.length).indexOf('/')<0 && k.indexOf('#')<0){ docs.push(mockSnap(k.slice(MOCK_PREFIX.length), mockGetRaw(k.slice(MOCK_PREFIX.length)))); }
        }
        if(o.order){ docs.sort(function(a,b){ var x=a.data()[o.order], y=b.data()[o.order]; return (x>y?1:x<y?-1:0) * (o.dir==='desc'?-1:1); }); }
        else docs.sort(function(a,b){ return a.id<b.id?-1:1; });
        docs = docs.slice(0, o.lim);
        return { docs: docs, size: docs.length, empty: !docs.length };
      }
    };
  }
  return build(q);
}
function mockDbFactory(){ return { doc: function(path){ return mockDocRef(path); }, collection: function(path){ return mockCollection(path); } }; }
function mockUserFactory(){
  var id = null;
  try{
    id = sessionStorage.getItem('rikiki_mock_uid');
    if(!id){ id = 'local-'+Math.random().toString(36).slice(2,10); sessionStorage.setItem('rikiki_mock_uid', id); }
  }catch(e){ id = 'local-'+Math.random().toString(36).slice(2,10); }
  var color = MOCK_COLORS[Math.abs(id.split('').reduce(function(a,c){return a+c.charCodeAt(0);},0)) % MOCK_COLORS.length];
  var viewer = { id:id, name:'', avatarUrl:'', color:color, email:null, isOwner:true, canEdit:true };
  return {
    me: async function(){ return viewer; },
    id: async function(){ return id; },
    isOwner: async function(){ return true; },
    canEdit: async function(){ return true; },
    can: async function(){ return true; },
    name: async function(){ return ''; },
    email: async function(){ return null; },
    avatarUrl: async function(){ return ''; },
    profiles: async function(ids){
      var list = (typeof ids==='string') ? [ids] : ids;
      var r={}; list.forEach(function(i){ r[i]={ id:i, name:'', avatarUrl:'', color:'#8a8a8a', email:null, isMe:i===id, guest:false }; });
      return r;
    },
    search: async function(){ return []; }
  };
}

/* ===================== Firebase backend (vrai temps réel, sans compte Claude) ===================== */
/* Même interface que le mode local ci-dessus (doc().get/set/update/delete/onSnapshot, collection()...),
   mais adossée à une vraie base Firebase Realtime Database : ça marche entre appareils différents,
   pour des joueurs qui n'ont pas de compte Claude. Voir window.FIREBASE_CONFIG plus haut dans le fichier. */
function firebaseConfigured(){
  var c = window.FIREBASE_CONFIG;
  return !!(c && c.apiKey && c.databaseURL && c.apiKey.indexOf('COLLE_TA_CLE')!==0);
}
/* Stockage : chaque document est rangé en JSON dans { __json: "..." } — Firebase supprime sinon
   les tableaux vides, les objets vides et les null (currentTrick: [], bids à null…), ce qui cassait le jeu.
   Les mises à jour passent par ref.transaction() : atomiques, donc les écritures simultanées
   (tous les joueurs qui marquent « servi » en même temps) ne s'écrasent plus. */
function fbDecode(v){
  if(v==null) return null;
  if(typeof v==='object' && typeof v.__json==='string'){
    var o; try{ o = JSON.parse(v.__json); }catch(e){ return null; }
    var plain = null;
    Object.keys(v).forEach(function(k){ if(k!=='__json' && k!=='__at'){ plain = plain || {}; plain[k] = v[k]; } });
    if(plain && o && typeof o==='object') o.__plain = plain; // champs en clair (propriétaire, e-mail caché…) lus par les règles
    if(o && typeof o==='object' && typeof v.__at==='number') o.__serverAt = v.__at; // v43 : date contrôlée par les règles (ligue)
    return o;
  }
  return v; // ancien format brut (parties créées avant ce correctif)
}
function fbEncode(obj){
  var plain = obj && obj.__plain, body = obj;
  if(plain){ body = Object.assign({}, obj); delete body.__plain; }
  var out = { __json: JSON.stringify(body), __at: (body && typeof body.at==='number') ? body.at : nowMs() };
  if(plain) Object.keys(plain).forEach(function(k){ if(k!=='__json' && k!=='__at') out[k] = plain[k]; });
  return out;
}
function fbSnap(path, data){ return { id: path.split('/').pop(), exists: data!=null, data: function(){ return data==null ? undefined : JSON.parse(JSON.stringify(data)); } }; }
function firebaseDocRef(path){
  var ref = firebase.database().ref(path);
  return {
    id: path.split('/').pop(),
    path: path,
    get: async function(){ var snap = await ref.once('value'); return fbSnap(path, fbDecode(snap.val())); },
    set: async function(data){ await ref.set(fbEncode(JSON.parse(JSON.stringify(data)))); },
    update: async function(patch){
      var clean = JSON.parse(JSON.stringify(patch));
      // On écoute le document pendant la mise à jour : la transaction part ainsi de la vraie valeur du serveur,
      // et on n'essaie jamais d'écrire « vide » (interdit par les règles de sécurité).
      var holder = null;
      await new Promise(function(resolve, reject){
        var first = true;
        holder = function(){ if(first){ first = false; resolve(); } };
        ref.on('value', holder, reject);
      });
      try{
        var res = await ref.transaction(function(cur){
          var obj = fbDecode(cur);
          if(obj==null) return; // document absent : on abandonne sans rien écrire
          return fbEncode(mockDeepMerge(obj, clean));
        });
        if(!res.committed || fbDecode(res.snapshot.val())==null){ var err = new Error('document absent'); err.code='invalid_argument'; throw err; }
      } finally { ref.off('value', holder); }
    },
    // v45 : réservation atomique. fn(doc, jeton) renvoie le patch à appliquer, ou null pour renoncer.
    // Une seule transaction gagne : sert à ce qu'UN SEUL appareil distribue une manche (avant : deux donnes mélangées).
    claim: async function(fn){
      var tok = Math.random().toString(36).slice(2), holder = null;
      await new Promise(function(resolve, reject){ var first = true; holder = function(){ if(first){ first = false; resolve(); } }; ref.on('value', holder, reject); });
      try{
        var res = await ref.transaction(function(cur){
          var obj = fbDecode(cur); if(obj==null) return;
          var p = fn(JSON.parse(JSON.stringify(obj)), tok); if(!p) return; // abandon : rien n'est écrit
          return fbEncode(mockDeepMerge(obj, JSON.parse(JSON.stringify(p))));
        });
        var after = res.committed ? fbDecode(res.snapshot.val()) : null;
        return !!(after && after.claimTok === tok);
      } finally { ref.off('value', holder); }
    },
    delete: async function(){ await ref.remove(); },
    onSnapshot: function(next, err){
      var cb = function(snap){ next(fbSnap(path, fbDecode(snap.val()))); };
      ref.on('value', cb, function(e){ if(err) err(e); });
      return function(){ ref.off('value', cb); };
    }
  };
}
function firebaseCollection(cpath){
  var base = firebase.database().ref(cpath);
  function build(o){
    return {
      path: cpath,
      doc: function(id){ return firebaseDocRef(cpath+'/'+(id || base.push().key)); },
      add: async function(data){ var key = base.push().key; var r = firebaseDocRef(cpath+'/'+key); await r.set(data); return r; },
      orderBy: function(f, d){ return build(Object.assign({}, o, { order:f, dir:d||'asc' })); },
      limit: function(n){ return build(Object.assign({}, o, { lim:n })); },
      where: function(){ return build(o); },
      get: async function(){
        var snap = await base.once('value');
        var docs = [];
        snap.forEach(function(child){
          var data = fbDecode(child.val());
          if(data!=null) docs.push(fbSnap(cpath+'/'+child.key, data));
        });
        if(o.order){
          docs.sort(function(a,b){ var x=a.data()[o.order], y=b.data()[o.order]; return (x>y?1:x<y?-1:0) * (o.dir==='desc'?-1:1); });
        }
        if(o.lim) docs = docs.slice(0, o.lim);
        return { docs: docs, size: docs.length, empty: !docs.length };
      }
    };
  }
  return build({ order:null, dir:'asc', lim:1000 });
}
function firebaseDbFactory(){ return { doc: firebaseDocRef, collection: firebaseCollection }; }
function firebaseUserFactory(){
  var id = null, color = null, name = '';
  try{
    id = localStorage.getItem('rikiki_fb_uid');
    if(!id){ id = 'p-'+Math.random().toString(36).slice(2,10)+nowMs().toString(36); localStorage.setItem('rikiki_fb_uid', id); }
    color = localStorage.getItem('rikiki_fb_color');
    if(!color){ color = MOCK_COLORS[Math.floor(Math.random()*MOCK_COLORS.length)]; localStorage.setItem('rikiki_fb_color', color); }
    name = localStorage.getItem('rikiki_fb_name') || '';
  }catch(e){
    id = id || ('p-'+Math.random().toString(36).slice(2,10));
    color = color || MOCK_COLORS[0];
  }
  var viewer = { id:id, name:name, avatarUrl:'', color:color, email:null, isOwner:true, canEdit:true };
  return {
    me: async function(){ return viewer; },
    id: async function(){ return id; },
    isOwner: async function(){ return true; },
    canEdit: async function(){ return true; },
    can: async function(){ return true; },
    name: async function(){ return name; },
    email: async function(){ return null; },
    avatarUrl: async function(){ return ''; },
    profiles: async function(ids){
      var list = (typeof ids==='string') ? [ids] : ids;
      var r={}; list.forEach(function(i){ r[i]={ id:i, name:'', avatarUrl:'', color:'#8a8a8a', email:null, isMe:i===id, guest:false }; });
      return r;
    },
    search: async function(){ return []; }
  };
}

