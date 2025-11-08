// Team Dugout — Travel Baseball Manager
// Data Model
const DB_KEY = 'teamdugout:v1';
const DEFAULT_STATE = {
  teamName: 'Travel Baseball',
  roster: [],            // [{id, name, number, positions}]
  lineups: [],           // [{id, dateISO, opponent, order:[{playerId, pos}], createdAt}]
  schedule: [],          // [{id, dateISO, time, opponent, location, done}]
  stats: {}              // {playerId: {AB, H, '2B','3B',HR,BB,SO,R,RBI,SB,HBP,SF}}
};

let state = loadState();

function loadState(){
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e){ console.warn('Load failed', e); }
  return structuredClone(DEFAULT_STATE);
}
function saveState(){
  localStorage.setItem(DB_KEY, JSON.stringify(state));
  refreshAll();
}

function uid(prefix='id'){ return `${prefix}_${Math.random().toString(36).slice(2,9)}`; }

// Elements
const tabsEl = document.getElementById('tabs');
const views = {
  lineup: document.getElementById('view-lineup'),
  roster: document.getElementById('view-roster'),
  schedule: document.getElementById('view-schedule'),
  stats: document.getElementById('view-stats'),
  settings: document.getElementById('view-settings'),
};

// Tab switching
tabsEl.addEventListener('click', (e)=>{
  if (e.target.tagName !== 'BUTTON') return;
  const tab = e.target.dataset.tab;
  [...tabsEl.children].forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  Object.entries(views).forEach(([k,el])=>el.classList.toggle('active', k===tab));
  if (tab==='stats') populateStatsPlayerSelect();
});

// LINEUP
const battingOrderEl = document.getElementById('batting-order');
const availablePlayersEl = document.getElementById('available-players');
const rosterFilterEl = document.getElementById('roster-filter');
const saveLineupBtn = document.getElementById('save-lineup');
const newLineupBtn = document.getElementById('new-lineup');
const loadLineupBtn = document.getElementById('load-lineup');
const deleteLineupBtn = document.getElementById('delete-lineup');
const clearOrderBtn = document.getElementById('clear-order');
const autoOrderBtn = document.getElementById('auto-order');
const lineupDateEl = document.getElementById('lineup-date');
const lineupOpponentEl = document.getElementById('lineup-opponent');
const savedLineupsSel = document.getElementById('saved-lineups');

function renderAvailablePlayers(){
  const filter = rosterFilterEl.value?.toLowerCase() ?? '';
  availablePlayersEl.innerHTML = '';
  state.roster
    .filter(p => p.name.toLowerCase().includes(filter) || String(p.number).includes(filter) || (p.positions||'').toLowerCase().includes(filter))
    .sort((a,b)=> (a.number??999) - (b.number??999))
    .forEach(p=>{
      const li = document.createElement('li');
      li.className = 'card';
      li.draggable = true;
      li.dataset.playerId = p.id;
      li.innerHTML = `<div class="card-main"><strong>${p.name}</strong><span class="muted">#${p.number ?? ''} • ${(p.positions||'')}</span></div>
        <div class="card-actions"><button class="add-to-lineup">➕</button></div>`;
      li.addEventListener('dragstart', dragStart);
      availablePlayersEl.appendChild(li);
    });
}
function lineupItemFor(player){
  const tpl = document.getElementById('lineup-item-tpl');
  const li = tpl.content.firstElementChild.cloneNode(true);
  li.dataset.playerId = player.id;
  li.querySelector('.lineup-name').textContent = player.name;
  li.querySelector('.lineup-number').textContent = player.number ?? '';
  li.querySelector('.remove').addEventListener('click', ()=>{
    li.remove(); renumberOrder();
  });
  li.addEventListener('dragstart', dragStart);
  li.addEventListener('dragend', dragEnd);
  return li;
}

function renumberOrder(){
  [...battingOrderEl.children].forEach((li,i)=>{
    li.querySelector('.order-num').textContent = (i+1)+'.';
  });
}

function addPlayerToOrder(playerId){
  const p = state.roster.find(r=>r.id===playerId);
  if (!p) return;
  const li = lineupItemFor(p);
  battingOrderEl.appendChild(li);
  renumberOrder();
}

availablePlayersEl.addEventListener('click',(e)=>{
  const btn = e.target.closest('.add-to-lineup');
  if (!btn) return;
  const li = e.target.closest('li');
  addPlayerToOrder(li.dataset.playerId);
});

// Drag and Drop
let dragged;
function dragStart(e){
  dragged = e.currentTarget;
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(()=> dragged.classList.add('dragging'), 0);
}
function dragEnd(){ dragged?.classList.remove('dragging'); dragged = null; }

function makeDroppable(listEl){
  listEl.addEventListener('dragover', (e)=>{
    e.preventDefault();
    const afterEl = getDragAfterElement(listEl, e.clientY);
    if (!dragged) return;
    if (afterEl == null) {
      listEl.appendChild(dragged.cloneNode(true));
      dragged.classList.remove('dragging');
      dragged = listEl.lastElementChild;
    } else {
      listEl.insertBefore(dragged, afterEl);
    }
  });
  listEl.addEventListener('drop', (e)=>{
    e.preventDefault();
    renumberOrder();
  });
}
function getDragAfterElement(container, y){
  const els = [...container.querySelectorAll('.draggable:not(.dragging)')];
  return els.reduce((closest, child)=>{
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else { return closest; }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}
makeDroppable(battingOrderEl);

// Save/load lineup
function getCurrentOrder(){
  return [...battingOrderEl.children].map(li=>({ playerId: li.dataset.playerId, pos: li.querySelector('.pos').value.trim() }));
}
function clearOrder(){ battingOrderEl.innerHTML=''; }
clearOrderBtn.addEventListener('click', ()=>{ clearOrder(); renumberOrder(); });

autoOrderBtn.addEventListener('click', ()=>{
  clearOrder();
  state.roster.forEach(p=> addPlayerToOrder(p.id));
});

saveLineupBtn.addEventListener('click', ()=>{
  const dateISO = lineupDateEl.value || new Date().toISOString().slice(0,10);
  const opponent = lineupOpponentEl.value.trim();
  const id = uid('lineup');
  state.lineups.push({ id, dateISO, opponent, order: getCurrentOrder(), createdAt: Date.now() });
  saveState();
  populateSavedLineups();
  alert('Lineup saved.');
});

function populateSavedLineups(){
  savedLineupsSel.innerHTML = '';
  state.lineups
    .sort((a,b)=> (a.dateISO||'').localeCompare(b.dateISO))
    .forEach(l=>{
      const opt = document.createElement('option');
      opt.value = l.id;
      opt.textContent = `${l.dateISO} vs ${l.opponent||'TBD'}`;
      savedLineupsSel.appendChild(opt);
    });
}
function loadLineupById(id){
  const l = state.lineups.find(x=>x.id===id);
  if (!l) return;
  lineupDateEl.value = l.dateISO || '';
  lineupOpponentEl.value = l.opponent || '';
  clearOrder();
  l.order.forEach(item=> addPlayerToOrder(item.playerId));
  // restore positions
  [...battingOrderEl.children].forEach((li, i)=>{
    li.querySelector('.pos').value = l.order[i]?.pos || '';
  });
  renumberOrder();
}

loadLineupBtn.addEventListener('click', ()=>{
  if (!savedLineupsSel.value) return;
  loadLineupById(savedLineupsSel.value);
});

deleteLineupBtn.addEventListener('click', ()=>{
  const id = savedLineupsSel.value;
  if (!id) return;
  if (!confirm('Delete this saved lineup?')) return;
  state.lineups = state.lineups.filter(l=>l.id!==id);
  saveState();
  populateSavedLineups();
});

// ROSTER
const rosterForm = document.getElementById('roster-form');
const rosterListEl = document.getElementById('roster-list');
rosterForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const name = document.getElementById('player-name').value.trim();
  const number = parseInt(document.getElementById('player-number').value, 10);
  const positions = document.getElementById('player-positions').value.trim();
  if (!name) return;
  state.roster.push({ id: uid('p'), name, number, positions });
  e.target.reset();
  saveState();
});

function renderRoster(){
  rosterListEl.innerHTML='';
  const tpl = document.getElementById('player-card-tpl').content.firstElementChild;
  state.roster
    .sort((a,b)=> (a.number??999) - (b.number??999))
    .forEach(p=>{
      const li = tpl.cloneNode(true);
      li.querySelector('.player-name').textContent = p.name;
      li.querySelector('.player-number').textContent = p.number ?? '';
      li.querySelector('.player-positions').textContent = p.positions || '';
      li.querySelector('.add-to-lineup').addEventListener('click', ()=> addPlayerToOrder(p.id));
      li.querySelector('.edit-player').addEventListener('click', ()=> editPlayer(p.id));
      li.querySelector('.delete-player').addEventListener('click', ()=> deletePlayer(p.id));
      rosterListEl.appendChild(li);
    });
  renderAvailablePlayers();
}
function editPlayer(id){
  const p = state.roster.find(x=>x.id===id);
  if (!p) return;
  const name = prompt('Name', p.name) ?? p.name;
  const number = prompt('Number', p.number ?? '') ?? p.number;
  const positions = prompt('Positions', p.positions ?? '') ?? p.positions;
  Object.assign(p, { name, number: number? Number(number) : null, positions });
  saveState();
}
function deletePlayer(id){
  if (!confirm('Remove player from roster?')) return;
  state.roster = state.roster.filter(p=>p.id!==id);
  // remove from any saved lineups
  state.lineups.forEach(l=> l.order = l.order.filter(o=>o.playerId!==id));
  // remove stats
  delete state.stats[id];
  saveState();
}

// SCHEDULE
const gameForm = document.getElementById('game-form');
const scheduleUpcomingEl = document.getElementById('schedule-upcoming');
const scheduleCompletedEl = document.getElementById('schedule-completed');

gameForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const dateISO = document.getElementById('game-date').value;
  const time = document.getElementById('game-time').value;
  const opponent = document.getElementById('game-opponent').value.trim();
  const location = document.getElementById('game-location').value.trim();
  if (!dateISO || !opponent) return;
  state.schedule.push({ id: uid('g'), dateISO, time, opponent, location, done: false });
  e.target.reset();
  saveState();
});

function renderSchedule(){
  const tpl = document.getElementById('game-card-tpl').content.firstElementChild;
  scheduleUpcomingEl.innerHTML = '';
  scheduleCompletedEl.innerHTML = '';
  const nowISO = new Date().toISOString().slice(0,10);
  state.schedule
    .sort((a,b)=> (a.dateISO+a.time).localeCompare(b.dateISO+b.time))
    .forEach(g=>{
      const li = tpl.cloneNode(true);
      const title = `${g.dateISO}${g.time ? ' ' + g.time : ''} — vs ${g.opponent}`;
      const sub = g.location ? g.location : '';
      li.querySelector('.game-title').textContent = title;
      li.querySelector('.game-sub').textContent = sub;
      li.querySelector('.open-lineup').addEventListener('click', ()=>{
        tabsEl.querySelector('[data-tab="lineup"]').click();
        lineupDateEl.value = g.dateISO;
        lineupOpponentEl.value = g.opponent;
        populateSavedLineups();
        const match = state.lineups.find(l=> l.dateISO===g.dateISO && (l.opponent||'')===g.opponent);
        if (match) loadLineupById(match.id);
      });
      li.querySelector('.mark-done').addEventListener('click', ()=>{
        g.done = !g.done; saveState();
      });
      li.querySelector('.delete-game').addEventListener('click', ()=>{
        if (!confirm('Delete this game?')) return;
        state.schedule = state.schedule.filter(x=>x.id!==g.id);
        saveState();
      });
      (g.done || g.dateISO < nowISO ? scheduleCompletedEl : scheduleUpcomingEl).appendChild(li);
    });
}

// STATS
const statsPlayerSel = document.getElementById('stats-player');
const statsGrid = document.getElementById('stats-grid');
const statsSummary = document.getElementById('stats-summary');
const exportStatsBtn = document.getElementById('export-stats');
const clearAllStatsBtn = document.getElementById('clear-all-stats');
const resetPlayerStatsBtn = document.getElementById('reset-player-stats');

const STAT_FIELDS = [
  'AB','H','2B','3B','HR','BB','SO','R','RBI','SB','HBP','SF'
];

function ensureStatsFor(playerId){
  if (!state.stats[playerId]){
    state.stats[playerId] = Object.fromEntries(STAT_FIELDS.map(k=>[k,0]));
  }
}
function populateStatsPlayerSelect(){
  statsPlayerSel.innerHTML = '';
  state.roster.forEach(p=>{
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `#${p.number ?? ''} ${p.name}`;
    statsPlayerSel.appendChild(opt);
  });
  if (state.roster[0]) {
    statsPlayerSel.value = state.roster[0].id;
    renderPlayerStats(state.roster[0].id);
  } else {
    statsGrid.innerHTML = '<p>Add players to the roster first.</p>';
    statsSummary.textContent='';
  }
}

statsPlayerSel.addEventListener('change', ()=> renderPlayerStats(statsPlayerSel.value));

function renderPlayerStats(playerId){
  if (!playerId) return;
  ensureStatsFor(playerId);
  const s = state.stats[playerId];
  statsGrid.innerHTML = '';
  STAT_FIELDS.forEach(field=>{
    const div = document.createElement('div');
    div.className = 'stat-card';
    div.innerHTML = `<label>${field}</label>
      <div class="row">
        <button data-d="-1" data-k="${field}">−</button>
        <input type="number" min="0" step="1" value="${s[field] ?? 0}" data-k="${field}">
        <button data-d="1" data-k="${field}">+</button>
      </div>`;
    statsGrid.appendChild(div);
  });
  statsGrid.addEventListener('click', statClick);
  statsGrid.addEventListener('input', statInput);
  updateStatsSummary(playerId);
}
function statClick(e){
  const btn = e.target.closest('button');
  if (!btn || !btn.dataset.k) return;
  const k = btn.dataset.k;
  const d = Number(btn.dataset.d);
  const playerId = statsPlayerSel.value;
  ensureStatsFor(playerId);
  state.stats[playerId][k] = Math.max(0, (state.stats[playerId][k]||0) + d);
  saveState();
}
function statInput(e){
  const input = e.target.closest('input[data-k]');
  if (!input) return;
  const k = input.dataset.k;
  const playerId = statsPlayerSel.value;
  ensureStatsFor(playerId);
  state.stats[playerId][k] = Math.max(0, parseInt(input.value||'0',10));
  saveState();
}

function updateStatsSummary(playerId){
  const s = state.stats[playerId] || {};
  const AB = s.AB||0, H=s.H||0, BB=s.BB||0, HBP=s.HBP||0, SF=s.SF||0;
  const TB = (s.H||0 - (s['2B']||0) - (s['3B']||0) - (s.HR||0))
            + 2*(s['2B']||0) + 3*(s['3B']||0) + 4*(s.HR||0);
  const AVG = AB ? (H/AB) : 0;
  const OBP = (AB+BB+HBP+SF) ? ((H+BB+HBP)/(AB+BB+HBP+SF)) : 0;
  const SLG = AB ? (TB/AB) : 0;
  const OPS = OBP + SLG;
  statsSummary.textContent = `AVG ${AVG.toFixed(3)} • OBP ${OBP.toFixed(3)} • SLG ${SLG.toFixed(3)} • OPS ${OPS.toFixed(3)}`;
}

exportStatsBtn.addEventListener('click', ()=>{
  // CSV with per-player line
  const rows = [['Player','#','AB','H','2B','3B','HR','BB','SO','R','RBI','SB','HBP','SF','AVG','OBP','SLG','OPS']];
  state.roster.forEach(p=>{
    ensureStatsFor(p.id);
    const s = state.stats[p.id];
    const AB=s.AB||0, H=s.H||0, BB=s.BB||0, HBP=s.HBP||0, SF=s.SF||0;
    const TB = (s.H||0 - (s['2B']||0) - (s['3B']||0) - (s.HR||0))
            + 2*(s['2B']||0) + 3*(s['3B']||0) + 4*(s.HR||0);
    const AVG = AB ? (H/AB) : 0;
    const OBP = (AB+BB+HBP+SF) ? ((H+BB+HBP)/(AB+BB+HBP+SF)) : 0;
    const SLG = AB ? (TB/AB) : 0;
    const OPS = OBP + SLG;
    rows.push([p.name, p.number ?? '', s.AB||0, s.H||0, s['2B']||0, s['3B']||0, s.HR||0, s.BB||0, s.SO||0, s.R||0, s.RBI||0, s.SB||0, s.HBP||0, s.SF||0, AVG.toFixed(3), OBP.toFixed(3), SLG.toFixed(3), OPS.toFixed(3)]);
  });
  const csv = rows.map(r=> r.map(x=> `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'team_stats.csv';
  a.click();
  URL.revokeObjectURL(url);
});

clearAllStatsBtn.addEventListener('click', ()=>{
  if (!confirm('Clear all player stats?')) return;
  state.stats = {};
  saveState();
});
resetPlayerStatsBtn.addEventListener('click', ()=>{
  const id = statsPlayerSel.value;
  if (!id) return;
  if (!confirm('Reset stats for this player?')) return;
  state.stats[id] = Object.fromEntries(STAT_FIELDS.map(k=>[k,0]));
  saveState();
});

// SETTINGS
const teamNameInput = document.getElementById('team-name');
const saveTeamNameBtn = document.getElementById('save-team-name');
const exportDataBtn = document.getElementById('export-data');
const importDataInput = document.getElementById('import-data');
const installBtn = document.getElementById('install-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const resetAppBtn = document.getElementById('reset-app');

saveTeamNameBtn.addEventListener('click', ()=>{
  state.teamName = teamNameInput.value.trim() || 'Travel Baseball';
  document.title = `${state.teamName} — Team Dugout`;
  saveState();
});

exportDataBtn.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'teamdugout_backup.json';
  a.click();
  URL.revokeObjectURL(url);
});

importDataInput.addEventListener('change', async (e)=>{
  const file = e.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    state = data;
    saveState();
    alert('Import successful.');
  } catch(err){
    alert('Import failed: invalid file.');
  } finally {
    e.target.value = '';
  }
});

// PWA install
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.disabled = false;
});
installBtn.addEventListener('click', async ()=>{
  if (!deferredPrompt) return alert('Install not available—open in your browser first.');
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.disabled = true;
});

themeToggleBtn.addEventListener('click', ()=>{
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('theme', next);
});

resetAppBtn.addEventListener('click', ()=>{
  if (!confirm('Factory reset will erase all data. Proceed?')) return;
  localStorage.removeItem(DB_KEY);
  state = structuredClone(DEFAULT_STATE);
  saveState();
});

// Helpers
function refreshAll(){
  renderRoster();
  renderAvailablePlayers();
  populateSavedLineups();
  renderSchedule();
  document.getElementById('team-name').value = state.teamName;
  document.title = `${state.teamName} — Team Dugout`;
  if (statsPlayerSel.value) updateStatsSummary(statsPlayerSel.value);
}
rosterFilterEl.addEventListener('input', renderAvailablePlayers);

// Initialize
refreshAll();
