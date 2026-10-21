/* ===================== v75 : tournoi du dimanche =====================
   Chaque dimanche (heure de Belgique) toutes les parties de ligue EN LIGNE jouées ce jour-là forment un tournoi.
   Points d'une partie : le dernier gagne 1 point, chaque place au-dessus en ajoute 1 (le 1er d'une partie à 5 : 5 points ; ex æquo = même place).
   Classé à partir de TOURNEY_MIN_GAMES parties ; à égalité de points : plus de victoires, puis moins de parties.
   Rien n'est enregistré à part : tout est recalculé depuis les parties de ligue (aucun changement des règles Firebase). */
// INTERRUPTEUR : false = le tournoi n'est PAS affiché (code prêt, encore à travailler avant de l'activer).
var TOURNEY_READY = false;
var TOURNEY_MIN_GAMES = 2, TOURNEY_TZ = 'Europe/Brussels';

// date du jour en Belgique : { key:'2026-10-18', weekday:0..6 (0 = dimanche) }
function tourneyDayOf(ms){
  try{
    var parts = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TOURNEY_TZ, year:'numeric', month:'2-digit', day:'2-digit', weekday:'short' })
      .formatToParts(new Date(ms)).forEach(function(p){ parts[p.type] = p.value; });
    var wd = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 }[parts.weekday];
    return { key: parts.year+'-'+parts.month+'-'+parts.day, weekday: wd };
  }catch(e){ var d = new Date(ms); return { key: d.toISOString().slice(0,10), weekday: d.getUTCDay() }; }
}

// tous les tournois (un par dimanche où une partie a été jouée), du plus récent au plus ancien
function computeTournaments(games){
  var days = {};
  (games||[]).forEach(function(g){
    if(g.mode!=='online') return;
    var d = tourneyDayOf(g.at||0); if(d.weekday!==0) return;
    var day = days[d.key] = days[d.key] || { key:d.key, games:0, rows:{} }, n = (g.players||[]).length;
    day.games++;
    (g.players||[]).forEach(function(p){
      var r = day.rows[p.memberId] = day.rows[p.memberId] || { id:p.memberId, pts:0, wins:0, games:0 };
      r.pts += Math.max(1, n - (p.rank||n) + 1); r.games++; if(p.rank===1) r.wins++;
    });
  });
  return Object.keys(days).sort().reverse().map(function(k){
    var day = days[k], list = Object.keys(day.rows).map(function(id){ return day.rows[id]; });
    var ranked = list.filter(function(r){ return r.games>=TOURNEY_MIN_GAMES; })
      .sort(function(a,b){ return (b.pts-a.pts) || (b.wins-a.wins) || (a.games-b.games); });
    return { key:k, games:day.games, ranked:ranked, champion: ranked.length ? ranked[0].id : null };
  });
}

function tourneyDateLabel(key){
  var p = key.split('-'); return new Date(Date.UTC(+p[0], +p[1]-1, +p[2], 12)).toLocaleDateString('fr-BE', { day:'numeric', month:'long', timeZone:'UTC' });
}
function daysUntilSunday(ms){ var wd = tourneyDayOf(ms).weekday; return wd===0 ? 0 : 7-wd; }

function tourneyRowsHtml(t, max){
  var nm = function(id){ var m = memberById(id); return m ? m.name : '?'; }, medals = ['🥇','🥈','🥉'], me = myMember();
  return '<ol class="tourney-list">' + t.ranked.slice(0, max).map(function(r, i){
    return '<li'+(me && me.id===r.id ? ' class="me"' : '')+'><span class="tr-rank">'+(medals[i]||(i+1))+'</span><span class="tr-name">'+esc(nm(r.id))+'</span><span class="tr-meta">'+r.games+' parties · '+r.wins+' V</span><b>'+r.pts+' pts</b></li>';
  }).join('') + '</ol>';
}

// bloc affiché en haut de l'écran « Ligue — En ligne »
function tournamentHtml(){
  if(!TOURNEY_READY || leagueView.mode!=='online') return '';
  var now = nowMs(), today = tourneyDayOf(now), ts = computeTournaments(league.games), nm = function(id){ var m = memberById(id); return m ? m.name : '?'; };
  var live = today.weekday===0 ? ts.filter(function(t){ return t.key===today.key; })[0] : null;
  var past = ts.filter(function(t){ return t.key!==today.key && t.champion; });
  var html = '<section class="card-panel tourney" aria-labelledby="tourney-t"><h3 id="tourney-t">🏆 Tournoi du dimanche</h3>';
  if(today.weekday===0){
    html += '<p class="muted tourney-sub">C\'est aujourd\'hui ! Toutes les parties de ligue en ligne de ce dimanche comptent. Il faut '+TOURNEY_MIN_GAMES+' parties pour être classé.</p>';
    html += live && live.ranked.length ? tourneyRowsHtml(live, 5) : '<p class="muted">Personne n\'est encore classé : jouez une partie de ligue pour ouvrir le tournoi.</p>';
  } else {
    var d = daysUntilSunday(now);
    html += '<p class="muted tourney-sub">Prochain tournoi : dimanche'+(d===1 ? ' (demain)' : ' (dans '+d+' jours)')+'. Toutes les parties de ligue en ligne ce jour-là comptent.</p>';
    if(past[0]) html += '<div class="eyebrow" style="margin:10px 0 4px;">Dimanche '+esc(tourneyDateLabel(past[0].key))+'</div>' + tourneyRowsHtml(past[0], 3);
  }
  var wins = {}; past.forEach(function(t){ wins[t.champion] = (wins[t.champion]||0)+1; });
  var top = Object.keys(wins).sort(function(a,b){ return wins[b]-wins[a]; }).slice(0,4);
  if(top.length) html += '<p class="tourney-hof"><b>Palmarès</b> : ' + top.map(function(id){ return '👑 '+esc(nm(id))+' ×'+wins[id]; }).join(' · ') + '</p>';
  return html + '</section>';
}
