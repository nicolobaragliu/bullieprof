// v2.1
'use strict';

// ─── FIREBASE CONFIG ───────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAviH7PSKF0XkUsb46TezovS2Yemqe-gSQ",
  authDomain: "jester-tales.firebaseapp.com",
  databaseURL: "https://jester-tales-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "jester-tales",
  storageBucket: "jester-tales.firebasestorage.app",
  messagingSenderId: "683963469311",
  appId: "1:683963469311:web:c9202ef240a8bb76f2ebca"
};

// ─── PERSISTENT PLAYER ID ──────────────────────────────────────────────────────
function getPlayerId() {
  let id = localStorage.getItem('bp_player_id');
  if (!id) {
    id = 'p_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('bp_player_id', id);
  }
  return id;
}
function saveSession(roomCode, playerName) {
  localStorage.setItem('bp_session', JSON.stringify({ roomCode, playerName, ts: Date.now() }));
}
function getSavedSession() {
  try {
    const s = JSON.parse(localStorage.getItem('bp_session'));
    if (s && Date.now() - s.ts < 3 * 60 * 60 * 1000) return s; // 3 ore
    return null;
  } catch { return null; }
}
function clearSession() { localStorage.removeItem('bp_session'); }

// ─── STATE ─────────────────────────────────────────────────────────────────────
const state = {
  screenHistory: [],
  myName: '',
  myRole: null,
  isHost: false,
  roomCode: null,
  roomRef: null,
  unsubscribe: null,
  roomData: null,
  abilityUsed: false,
  nightActionDone: false,
  leccapiedinChoiceMade: false,
  leccapedeSwitch: false,
};

// ─── FIREBASE ──────────────────────────────────────────────────────────────────
let fb_app = null, fb_db = null;

async function initFirebase() {
  if (fb_app) return;
  await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js');
  fb_app = firebase.initializeApp(FIREBASE_CONFIG);
  fb_db  = firebase.database();
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─── APP ───────────────────────────────────────────────────────────────────────
const App = {

  // Navigation
  goTo(id) {
    const cur = document.querySelector('.screen.active');
    if (cur) { state.screenHistory.push(cur.id); cur.classList.remove('active'); }
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
  },
  goBack() {
    const prev = state.screenHistory.pop();
    const cur = document.querySelector('.screen.active');
    if (cur) cur.classList.remove('active');
    document.getElementById(prev || 'screen-welcome').classList.add('active');
    window.scrollTo(0, 0);
  },

  // Init
  async init() {
    App._renderRules();
    try {
      await initFirebase();
      // Try to reconnect to saved session
      const session = getSavedSession();
      if (session) {
        showLoading('Riconnessione in corso…');
        const snap = await fb_db.ref('rooms/' + session.roomCode).once('value');
        if (snap.exists() && snap.val().status !== 'ended') {
          state.myName = session.playerName;
          state.roomCode = session.roomCode;
          state.isHost = snap.val().host === session.playerName;
          state.roomRef = fb_db.ref('rooms/' + session.roomCode);
          App._subscribeRoom();
          hideLoading();
          return;
        }
        clearSession();
      }
    } catch(e) { console.warn('Firebase init error:', e); }
    hideLoading();
    App.goTo('screen-welcome');
  },

  // ── Host ────────────────────────────────────────────────────────────────────
  async startHost() {
    const name = prompt('Il tuo nome (Preside):') || 'Preside';
    showLoading('Creando la stanza…');
    try {
      await initFirebase();
      const code = genCode();
      state.myName = name;
      state.roomCode = code;
      state.isHost = true;
      state.roomRef = fb_db.ref('rooms/' + code);
      await state.roomRef.set({
        host: name, status: 'lobby', turn: 0,
        players: { [name]: { name, role: 'preside', alive: true, ready: false, pid: getPlayerId() } },
        events: [], nightActions: {}, votes: {}, eliminated: [],
        campionatiUsed: false, settings: {}
      });
      saveSession(code, name);
      App._subscribeRoom();
      hideLoading();
      App._renderLobby();
      App.goTo('screen-lobby');
    } catch(e) { hideLoading(); toast('Errore: ' + e.message); }
  },

  // ── Join ────────────────────────────────────────────────────────────────────
  async joinRoom() {
    const name = document.getElementById('join-name').value.trim();
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (!name) { toast('Inserisci il tuo nome'); return; }
    if (code.length !== 4) { toast('Codice a 4 lettere'); return; }
    showLoading('Entrando nella stanza…');
    try {
      await initFirebase();
      const roomRef = fb_db.ref('rooms/' + code);
      const snap = await roomRef.once('value');
      if (!snap.exists()) { hideLoading(); toast('Stanza non trovata'); return; }
      const data = snap.val();

      // Check if this player is reconnecting
      const existingPlayer = data.players && data.players[name];
      const myPid = getPlayerId();
      if (existingPlayer && existingPlayer.pid === myPid) {
        // Reconnect!
        state.myName = name; state.roomCode = code;
        state.isHost = false; state.roomRef = roomRef;
        App._subscribeRoom();
        saveSession(code, name);
        hideLoading();
        return;
      }

      if (data.status !== 'lobby') { hideLoading(); toast('La partita è già iniziata'); return; }

      state.myName = name; state.roomCode = code;
      state.isHost = false; state.roomRef = roomRef;
      await roomRef.child('players/' + name).set({ name, role: null, alive: true, ready: false, pid: myPid });
      saveSession(code, name);
      App._subscribeRoom();
      hideLoading();
    } catch(e) { hideLoading(); toast('Errore: ' + e.message); }
  },

  leaveLobby() {
    if (state.unsubscribe) state.unsubscribe();
    clearSession();
    state.roomRef = null; state.roomCode = null;
    App.goTo('screen-welcome');
  },

  // ── Start Game ──────────────────────────────────────────────────────────────
  async startGame() {
    const snap = await state.roomRef.child('players').once('value');
    const players = snap.val();
    const names = Object.keys(players).filter(n => n !== state.myName);
    const n = names.length;
    if (n < 6) { toast('Servono almeno 6 giocatori (escluso Preside)'); return; }
    if (n > 16) { toast('Massimo 16 giocatori'); return; }
    state._configNames = names;
    App._openConfig(n, names);
  },

  _openConfig(n, names) {
    // Ruoli fissi
    const bullCount = getBulliCount(n);
    const fixed = [];
    for (let i = 0; i < bullCount; i++) fixed.push('bullo');
    fixed.push('segretaria');

    // Slot liberi
    const freeSlots = n - fixed.length;

    // Genera suggerimento iniziale casuale (con abilità prima)
    const suggested = generateRoles(n).filter(r => !fixed.includes(r) || fixed.splice(fixed.indexOf(r), 1) && false);
    // Rebuild suggested from generateRoles minus fixed
    const allGenerated = generateRoles(n);
    const fixedCopy = [...fixed];
    const suggestedFree = [];
    for (const r of allGenerated) {
      const fi = fixedCopy.indexOf(r);
      if (fi !== -1) { fixedCopy.splice(fi, 1); continue; }
      suggestedFree.push(r);
    }

    state._configFixed = fixed;
    state._configFree = suggestedFree.slice(0, freeSlots);
    state._configSlots = freeSlots;

    App._renderConfig();
    App.goTo('screen-config');
  },

  _renderConfig() {
    const fixed = state._configFixed;
    const free = state._configFree;
    const slots = state._configSlots;

    // Label slot
    document.getElementById('config-slots-label').textContent = `${slots} slot liberi`;

    // Fixed roles pills
    const fixedEl = document.getElementById('config-fixed-roles');
    fixedEl.innerHTML = fixed.map(r => {
      const role = ROLES[r];
      return `<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:4px 12px;font-size:12px;color:#fca5a5;display:flex;align-items:center;gap:4px">
        <span>${role?.icon || '❓'}</span><span style="font-family:'Cinzel',serif">${role?.name || r}</span>
      </div>`;
    }).join('');

    // Slot liberi
    const slotsEl = document.getElementById('config-slots');
    slotsEl.innerHTML = free.map((r, i) => {
      const role = ROLES[r];
      const isMotoria = r === 'prof_motoria_1' || r === 'prof_motoria_2';
      return `<div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">${role?.icon || '❓'}</span>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:13px;color:white">${role?.name || r}${isMotoria ? ' <span style="font-size:10px;color:rgba(255,255,255,0.4)">(coppia)</span>' : ''}</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px">${role?.team || ''}</div>
        </div>
        <button onclick="App._configRemoveSlot(${i})" style="background:rgba(239,68,68,0.2);border:none;border-radius:6px;padding:4px 10px;color:#fca5a5;font-size:12px;cursor:pointer">✕</button>
      </div>`;
    }).join('');

    // Pool disponibile
    const usedInFree = new Set(free);
    // Prof motoria: se uno è usato, entrambi sono usati
    const motoriaUsed = free.includes('prof_motoria_1') || free.includes('prof_motoria_2');

    const POOL_WITH_ABILITY = [
      'prof_sostegno','bidello','secchione','prof_religione','rappresentante_classe',
      'rappresentante_libri','coordinatore','prof_chimica','prof_robotica',
      'prof_motoria_1','furbetto','fifone','omertoso','leccapiedi','bullo_pentito'
    ];
    const GENERICI = ['primo_banco','pettina','ultimo_banco','dorme','mangia','nota'];
    const allPool = [...POOL_WITH_ABILITY, ...GENERICI];

    const freeSlotsLeft = slots - free.length;
    const poolEl = document.getElementById('config-pool');
    poolEl.innerHTML = allPool.map(r => {
      if (r === 'prof_motoria_2') return ''; // mostra solo _1
      const role = ROLES[r];
      const isMotoria = r === 'prof_motoria_1';
      const used = isMotoria ? motoriaUsed : usedInFree.has(r);
      const needsTwo = isMotoria;
      const canAdd = !used && freeSlotsLeft >= (needsTwo ? 2 : 1);
      const isFixed = state._configFixed.includes(r);
      if (isFixed) return '';
      return `<button onclick="App._configAddSlot('${r}')" ${(!canAdd || used) ? 'disabled' : ''} style="background:${used ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)'};border:1px solid ${used ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'};border-radius:20px;padding:5px 12px;font-size:12px;color:${used ? 'rgba(255,255,255,0.3)' : 'white'};cursor:${canAdd && !used ? 'pointer' : 'default'};display:inline-flex;align-items:center;gap:4px">
        <span>${role?.icon || '❓'}</span>
        <span style="font-family:'Cinzel',serif">${role?.name || r}${isMotoria ? ' ×2' : ''}</span>
        ${used ? '<span style="font-size:10px">✓</span>' : ''}
      </button>`;
    }).join('');
  },

  _configRemoveSlot(i) {
    const r = state._configFree[i];
    if (r === 'prof_motoria_1' || r === 'prof_motoria_2') {
      state._configFree = state._configFree.filter(x => x !== 'prof_motoria_1' && x !== 'prof_motoria_2');
    } else {
      state._configFree.splice(i, 1);
    }
    App._renderConfig();
  },

  _configAddSlot(r) {
    const freeSlotsLeft = state._configSlots - state._configFree.length;
    if (r === 'prof_motoria_1') {
      if (freeSlotsLeft < 2) { toast('Non ci sono abbastanza slot per la coppia Motoria'); return; }
      state._configFree.push('prof_motoria_1', 'prof_motoria_2');
    } else {
      if (freeSlotsLeft < 1) { toast('Nessuno slot libero'); return; }
      state._configFree.push(r);
    }
    App._renderConfig();
  },

  async confirmConfig() {
    const names = state._configNames;
    const n = names.length;
    const fixed = state._configFixed;
    const free = state._configFree;
    const total = fixed.length + free.length;

    if (total < n) {
      // Fill remaining with generici
      const generici = ['primo_banco','pettina','ultimo_banco','dorme','mangia','nota'];
      let gi = 0;
      while (fixed.length + free.length < n) free.push(generici[gi++ % generici.length]);
    }
    if (fixed.length + free.length > n) {
      toast('Hai troppi ruoli selezionati!'); return;
    }

    const roleIds = [...fixed, ...free];
    // Shuffle
    for (let i = roleIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roleIds[i], roleIds[j]] = [roleIds[j], roleIds[i]];
    }

    showLoading('Distribuendo i ruoli…');
    const updates = {};
    names.forEach((name, i) => {
      updates[`players/${name}/role`] = roleIds[i];
    });
    const bullNames = names.filter((n2, i) => roleIds[i] === 'bullo');
    updates['bullNames'] = bullNames;
    updates['status'] = 'role-reveal';
    updates['turn'] = 1;
    updates['playersDone'] = {};
    updates['votes'] = {};
    updates['nightActions'] = {};

    await state.roomRef.update(updates);
    hideLoading();
    App._showRoleReport(names, roleIds);
  },

  _showRoleReport(names, roleIds) {
    const list = document.getElementById('role-report-list');
    if (!list) return;
    list.innerHTML = names.map((name, i) => {
      const role = ROLES[roleIds[i]];
      const teamColors = { bulli: '#ef4444', buoni: '#22c55e', solo: '#f59e0b' };
      const color = teamColors[role?.team] || '#6b7280';
      return `<div style="background:var(--night-light);border:1.5px solid var(--border-dark);border-radius:var(--r-md);padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
        <span style="font-size:24px">${role?.icon || '❓'}</span>
        <div style="flex:1">
          <div style="font-family:'Cinzel',serif;font-size:14px;color:white;margin-bottom:2px">${name}</div>
          <div style="font-size:13px;color:${color};font-weight:600">${role?.name || roleIds[i]}</div>
        </div>
        <div style="font-size:10px;font-family:'Cinzel',serif;letter-spacing:0.5px;color:rgba(255,255,255,0.4);text-transform:uppercase">${role?.team || ''}</div>
      </div>`;
    }).join('');
    App.goTo('screen-role-report');
  },

  // ── Subscribe ───────────────────────────────────────────────────────────────
  _subscribeRoom() {
    if (state.unsubscribe) state.unsubscribe();
    const listener = state.roomRef.on('value', snap => {
      const data = snap.val();
      if (!data) return;
      state.roomData = data;
      App._onRoomUpdate(data);
    });
    state.unsubscribe = () => state.roomRef.off('value', listener);
  },

  _onRoomUpdate(data) {
    const status = data.status;

    if (status === 'lobby') {
      App._renderLobbyPlayers(data);
      const cur = document.querySelector('.screen.active');
      if (!cur || !['screen-lobby'].includes(cur.id)) {
        App._renderLobby();
        App.goTo('screen-lobby');
      }
    }

    if (status === 'role-reveal') {
      const myData = data.players?.[state.myName];
      if (myData && !state.myRole) {
        state.myRole = ROLES[myData.role] || { id:'preside', name:'Preside', icon:'👑', team:'buoni', desc:'Gestisci la partita.' };
        App._showRoleReveal(data);
      }
      const cur = document.querySelector('.screen.active');
      if (state.isHost && cur?.id === 'screen-preside-night') {
        App._renderPresideNight(data);
      }
    }

    if (status === 'night') {
      App._handleNightPhase(data);
    }
    
    // Also trigger night render if player is on waiting screen and night just started
    if (status === 'night' && !state.isHost) {
      const cur = document.querySelector('.screen.active');
      if (cur?.id === 'screen-waiting') {
        App._renderPlayerNight(data);
      }
    }

    if (status === 'day') {
      App._handleDayPhase(data);
    }

    if (status === 'ended') {
      App._showWin(data);
    }

    // Leccapiedi: mostra modal scelta quando rimane 1 bullo
    if (!state.isHost && data.leccapieliNotify === state.myName && !state.leccapiedinChoiceMade) {
      App._showLeccapiedeModal(data);
    }

    // Segretaria: se è stata resuscitata, resetta il flag risposta
    if (!state.isHost && state.myRole === 'segretaria') {
      const me = data.players?.[state.myName];
      if (me?.alive && !data.segretariaResponse && state._segretariaResponseShown) {
        state._segretariaResponseShown = false;
      }
    }
  },

  // ── Role Reveal ─────────────────────────────────────────────────────────────
  _showRoleReveal(data) {
    const role = state.myRole;
    if (!role) return;

    const card = document.getElementById('role-card');
    card.className = 'role-card team-' + (role.isAmbiguous ? 'ambiguo' : role.team);

    document.getElementById('role-icon').textContent = role.icon;
    document.getElementById('role-name').textContent = role.name;
    document.getElementById('role-desc').textContent = role.desc;

    const teamLabels = { bulli: '😈 Bulli', buoni: '✅ Buoni', solo: '🦊 Solo' };
    const badge = document.getElementById('role-team-badge');
    badge.textContent = teamLabels[role.team] || role.team;

    // Show allies for bulli, omertoso, bullo_pentito
    const alliesDiv = document.getElementById('role-allies');
    if ((role.id === 'bullo' || role.knowsBullis) && data.bullNames) {
      const allies = role.id === 'bullo'
        ? data.bullNames.filter(n => n !== state.myName)
        : data.bullNames;
      if (allies.length > 0) {
        document.getElementById('role-allies-list').textContent = allies.join(', ');
        alliesDiv.style.display = '';
        if (role.id === 'bullo_pentito') {
          document.querySelector('.role-allies-label').textContent = 'I BULLI (non puoi rivelarli!)';
          // Avviso vincolo bullo pentito
          const warnEl = document.getElementById('bullo-pentito-warn');
          if (!warnEl) {
            const w = document.createElement('div');
            w.id = 'bullo-pentito-warn';
            w.style.cssText = 'background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:8px;padding:10px 12px;margin-top:10px;font-size:12px;color:#fca5a5;line-height:1.5';
            w.innerHTML = '⚠️ <strong>Attenzione:</strong> conosci i bulli ma non puoi rivelarli. Se lo fai, i bulli vincono automaticamente.';
            alliesDiv.appendChild(w);
          }
        } else if (role.id === 'omertoso') {
          document.querySelector('.role-allies-label').textContent = 'I BULLI (taci!)';
        }
      } else {
        alliesDiv.style.display = 'none';
      }
    } else {
      alliesDiv.style.display = 'none';
    }

    App.goTo('screen-role-reveal');
  },

  async confirmRoleRead() {
    await state.roomRef.child('players/' + state.myName + '/ready').set(true);
    if (state.isHost) {
      App.goTo('screen-preside-night');
      App._renderPresideNight();
    } else {
      // Go to waiting screen with night actions
      const data = state.roomData;
      if (data?.status === 'night') {
        App._renderPlayerNight(data);
      } else {
        // Status still role-reveal - show waiting, actions will load when night starts
        App._showWaiting('night');
        document.getElementById('night-action-area').innerHTML =
          '<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">In attesa che il Preside avvii la notte…</div>';
      }
    }
  },

  // ── Night Phase ─────────────────────────────────────────────────────────────
  _handleNightPhase(data) {
    // Use Firebase as source of truth - reset if nightActions is empty (new night)
    // Turn-based detection: reset on new turn, not just empty nightActions
    const currentTurn = data.turn || 1;
    if (state._lastNightTurn !== currentTurn) {
      state._lastNightTurn = currentTurn;
      state.nightActionDone = false;
    }
    // Check if THIS player has already acted this turn
    if (!state.nightActionDone) {
      const myRole = state.myRole?.id;
      const myActionKey = {
        'bullo': state.myName,
        'prof_sostegno': '__sostegno',
        'segretaria': '__segretaria',
        'bidello': '__bidello',
        'prof_chimica': '__chimica',
        'prof_motoria_1': '__motoria',
        'prof_motoria_2': '__motoria',
      }[myRole] || null;
      if (myActionKey && data.nightActions?.[myActionKey] !== undefined) {
        state.nightActionDone = true;
      }
    }
    if (state.isHost) {
      const cur = document.querySelector('.screen.active');
      if (!cur || cur.id !== 'screen-preside-night') {
        App.goTo('screen-preside-night');
      }
      App._renderPresideNight(data);
    } else {
      App._renderPlayerNight(data);
    }
  },

  _renderPresideNight(data) {
    data = data || state.roomData;
    if (!data) return;
    const actions = data.nightActions || {};
    const players = data.players || {};
    const alivePlayers = Object.values(players).filter(p => p.alive && p.role !== 'preside');

    let html = '';
    // CORRECT ORDER: motoria → sostegno → bulli → segretaria → bidello → chimica
    const aliveBulliList = Object.values(players).filter(p=>p.role==='bullo' && p.alive);
    const deadBulliList  = Object.values(players).filter(p=>p.role==='bullo' && !p.alive);
    // Bulli are done if: all alive bulli have voted OR no alive bulli exist
    const bulliAllDone = aliveBulliList.length === 0 || aliveBulliList.every(p => actions[p.name] !== undefined);
    const actionList = [
      { role: 'prof_motoria_1', label: '1️⃣ Prof di Motoria',  done: actions['__motoria'] !== undefined },
      { role: 'prof_sostegno',  label: '2️⃣ Prof di Sostegno', done: actions['__sostegno'] !== undefined },
      { role: 'bullo',          label: '3️⃣ Bulli',            done: bulliAllDone },
      { role: 'segretaria',     label: '4️⃣ Segretaria',       done: actions['__segretaria'] !== undefined },
      { role: 'bidello',        label: '5️⃣ Bidello',          done: actions['__bidello'] !== undefined },
      { role: 'prof_chimica',   label: '6️⃣ Prof di Chimica',  done: actions['__chimica'] !== undefined },
    ];

    const presentRoles = actionList.filter(a => Object.values(players).some(p => p.role === a.role));
    // A role is done if: action submitted OR role not alive (dead players skip)
    const adjustedRoles = presentRoles.map(a => {
      const isAlive = Object.values(players).some(p => p.role === a.role && p.alive);
      return { ...a, done: a.done || !isAlive };
    });
    const allDone = adjustedRoles.every(a => a.done) || adjustedRoles.length === 0;

    let statusHtml = presentRoles.map(a =>
      `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.1)">
        <span>${a.done ? '✅' : '⏳'}</span>
        <span style="font-size:14px;color:var(--night)">${a.label}</span>
      </div>`
    ).join('');

    document.getElementById('preside-night-status').innerHTML = statusHtml || 'Nessuna azione notturna attesa.';

    const endBtn = document.getElementById('end-night-btn');
    if (endBtn) endBtn.style.display = allDone ? '' : 'none';

    // If status is role-reveal, show "start night" button instead
    if (state.roomData?.status === 'role-reveal') {
      const snap = state.roomData;
      const players = snap.players || {};
      const nonPreside = Object.values(players).filter(p => p.role !== 'preside');
      const allReady = nonPreside.every(p => p.ready);
      const readyCount = nonPreside.filter(p => p.ready).length;

      document.getElementById('preside-night-status').innerHTML = `
        <div style="margin-bottom:8px">Giocatori pronti: <strong>${readyCount}/${nonPreside.length}</strong></div>
        ${nonPreside.map(p => `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
          <span>${p.ready ? '✅' : '⏳'}</span>
          <span style="font-size:14px;color:var(--night)">${p.name}</span>
        </div>`).join('')}
      `;

      if (endBtn) endBtn.style.display = 'none';

      let startBtn = document.getElementById('start-night-now-btn');
      if (!startBtn) {
        startBtn = document.createElement('button');
        startBtn.id = 'start-night-now-btn';
        startBtn.className = 'btn btn-primary btn-full';
        startBtn.style.marginTop = 'auto';
        startBtn.onclick = () => App.startNightPhase();
        document.querySelector('.night-body').appendChild(startBtn);
      }
      startBtn.textContent = allReady ? '🌙 Avvia la notte' : `🌙 Avvia la notte (${readyCount}/${nonPreside.length} pronti)`;
      startBtn.style.display = '';
    } else {
      const startBtn = document.getElementById('start-night-now-btn');
      if (startBtn) startBtn.style.display = 'none';
    }
  },

  _renderPlayerNight(data) {
    data = data || state.roomData;
    const myData = data.players?.[state.myName];
    if (!myData) return;
    const role = ROLES[myData.role];
    if (!role) return;

    // Go to waiting screen first so elements exist
    App._showWaiting('night');

    // Dead players cannot act
    if (!myData.alive) {
      document.getElementById('night-action-area').innerHTML =
        '<div style="text-align:center;padding:1.5rem;font-style:italic;color:rgba(255,255,255,0.4)">Sei stato/a eliminato/a. Osserva in silenzio. 👻</div>';
      return;
    }

    // Update role panel
    document.getElementById('wp-role-icon').textContent = role.icon;
    document.getElementById('wp-role-name').textContent = role.name;
    document.getElementById('wp-role-desc').textContent = role.desc;

    // All alive players shown to everyone including bulli
    // (bulli see protected player too - option C: they don't know who is protected)
    const alivePlayers = Object.values(data.players || {})
      .filter(p => p.alive && p.name !== state.myName && p.role !== 'preside');

    const nightArea = document.getElementById('night-action-area');
    nightArea.style.display = '';

    // Check action done from Firebase (source of truth) OR local state
    const actions = data.nightActions || {};
    const actionKey = {
      'bullo': state.myName,
      'prof_sostegno': '__sostegno',
      'segretaria': '__segretaria',
      'bidello': '__bidello',
      'prof_chimica': '__chimica',
      'prof_motoria_1': '__motoria',
      'prof_motoria_2': '__motoria',
    }[role.id] || state.myName;
    // Lock permanently once acted - set local state too
    if (actions[actionKey] !== undefined) state.nightActionDone = true;
    const alreadyActed = state.nightActionDone;

    if (alreadyActed || !role.nightAction) {
      nightArea.innerHTML = role.nightAction
        ? `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">✓ Azione completata. Attendi gli altri…</div>`
        : `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">Non hai azioni notturne. Attendi…</div>`;
    } else {
      App._renderNightAction(role, alivePlayers, nightArea);
    }
  },

  _renderNightAction(role, alivePlayers, container) {
    const playerBtns = alivePlayers.map(p =>
      `<button class="player-select-btn" onclick="App.selectNightTarget('${p.name}')" id="nbtn-${p.name}">${p.name}</button>`
    ).join('');

    let html = '';

    if (role.id === 'bullo') {
      const roomData = state.roomData || {};
      const roomActions = roomData.nightActions || {};
      const roomPlayers = roomData.players || {};
      const otherBulli = Object.values(roomPlayers).filter(p => p.role === 'bullo' && p.name !== state.myName && p.alive);
      const myVote = roomActions[state.myName]?.target;
      const compliciInfo = otherBulli.length > 0
        ? '<div style="background:rgba(239,68,68,0.1);border-radius:8px;padding:8px 10px;margin-bottom:10px">' +
          otherBulli.map(b => {
            const v = roomActions[b.name]?.target;
            return '<div style="font-size:12px;padding:2px 0">' + b.name + ': ' + (v ? '<strong>' + v + '</strong>' : '⏳') + '</div>';
          }).join('') + '</div>'
        : '';
      const myVoteInfo = myVote ? '<div style="font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:8px">Il tuo voto: <strong style="color:#fca5a5">' + myVote + '</strong> (puoi cambiarlo)</div>' : '';
      html = '<div class="night-action-card">' +
        '<div class="night-action-title">😈 Scegli la vittima</div>' +
        compliciInfo + myVoteInfo +
        '<div class="player-select-grid">' + playerBtns + '</div>' +
        '</div>';
    } else if (role.id === 'prof_sostegno') {
      const lastProt = state.roomData?.lastProtected;
      const sostegnoBtns = alivePlayers
        .filter(p => p.name !== lastProt)
        .map(p => `<button class="player-select-btn" onclick="App.selectNightTarget('${p.name}')" id="nbtn-${p.name}">${p.name}</button>`)
        .join('');
      const skipNote = lastProt ? `<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:6px">Non puoi proteggere di nuovo <strong style="color:white">${lastProt}</strong></div>` : '';
      html = `<div class="night-action-card">
        <div class="night-action-title">🛡️ Chi vuoi proteggere?</div>
        <div class="night-action-desc">Scegli un giocatore da proteggere stanotte. Non puoi scegliere lo stesso di ieri.</div>
        ${skipNote}
        <div class="player-select-grid">${sostegnoBtns}</div>
      </div>`;
    } else if (role.id === 'segretaria') {
      html = `<div class="night-action-card">
        <div class="night-action-title">📋 Consulta il registro</div>
        <div class="night-action-desc">Scegli un giocatore di cui scoprire il ruolo.</div>
        <div class="player-select-grid">${playerBtns}</div>
      </div>`;
    } else if (role.id === 'bidello') {
      html = `<div class="night-action-card">
        <div class="night-action-title">🧹 Chi origliare?</div>
        <div class="night-action-desc">Scegli un giocatore. Il Preside ti dirà se si è mosso stanotte (Sì/No).</div>
        <div class="player-select-grid">${playerBtns}</div>
      </div>`;
    } else if (role.id === 'prof_chimica' && !state.abilityUsed) {
      html = `<div class="night-action-card">
        <div class="night-action-title">🧪 Consegna l'intruglio</div>
        <div class="night-action-desc">⚠️ Attenzione! Se la persona è innocente, morirà lei. Usa con saggezza. Una sola volta.</div>
        <div class="player-select-grid">${playerBtns}</div>
        <button class="btn btn-outline btn-full btn-sm" style="margin-top:8px" onclick="App.skipNightAction()">Passa questa notte</button>
      </div>`;
    } else if ((role.id === 'prof_motoria_1' || role.id === 'prof_motoria_2') && !state.abilityUsed && !state.roomData?.campionatiUsed) {
      html = `<div class="night-action-card">
        <div class="night-action-title">🏃 Campionati Studenteschi</div>
        <div class="night-action-desc">Attiva i Campionati: stanotte i bulli non possono eliminare nessuno. Una sola volta per partita.</div>
        <button class="btn btn-primary btn-full btn-sm" onclick="App.activateCampionati()">🏆 Attiva Campionati</button>
        <button class="btn btn-outline btn-full btn-sm" style="margin-top:6px" onclick="App.skipNightAction()">Passa questa notte</button>
      </div>`;
    } else {
      html = '<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">Non hai azioni notturne disponibili stanotte. Attendi il Preside…</div>';
      // Don't auto-skip - preside can end night when needed roles are done
    }

    container.innerHTML = html;
  },

  async selectNightTarget(targetName) {
    const role = state.myRole;
    if (!role || state.nightActionDone) return;

    state.nightActionDone = true; // Lock immediately to prevent double-click

    const actionKey = {
      'bullo': state.myName,
      'prof_sostegno': '__sostegno',
      'segretaria': '__segretaria',
      'bidello': '__bidello',
      'prof_chimica': '__chimica',
    }[role.id] || state.myName;

    await state.roomRef.child('nightActions/' + actionKey).set({
      actor: state.myName,
      role: role.id,
      target: targetName,
      ts: Date.now(),
    });

    // Also persist done state in Firebase so re-renders don't unlock
    await state.roomRef.child('playersDone/' + state.myName).set(true);

    if (role.id === 'prof_chimica') state.abilityUsed = true;

    const nightArea = document.getElementById('night-action-area');
    if (nightArea) nightArea.innerHTML = `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">✓ Hai scelto: <strong style="color:white">${targetName}</strong>. Attendi gli altri…</div>`;
  },

  async skipNightAction() {
    const role = state.myRole;
    if (!role || state.nightActionDone) return;
    state.nightActionDone = true;
    const actionKey = {
      'prof_chimica': '__chimica',
      'prof_motoria_1': '__motoria',
      'prof_motoria_2': '__motoria',
    }[role.id] || state.myName;
    await state.roomRef.child('nightActions/' + actionKey).set({ actor: state.myName, role: role.id, target: null, skipped: true });
    await state.roomRef.child('playersDone/' + state.myName).set(true);
    const nightArea = document.getElementById('night-action-area');
    if (nightArea) nightArea.innerHTML = `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">✓ Hai saltato questa notte. Attendi gli altri…</div>`;
  },

  async activateCampionati() {
    await state.roomRef.update({ campionatiUsed: true });
    await state.roomRef.child('nightActions/__motoria').set({ actor: state.myName, role: state.myRole.id, target: 'campionati', ts: Date.now() });
    state.abilityUsed = true;
    state.nightActionDone = true;
    toast('🏆 Campionati Studenteschi attivati!');
  },

  async startNightPhase() {
    state.nightActionDone = false;
    state._bidelloResponseShown = false;
    state._segretariaResponseShown = false;
    await state.roomRef.update({ status: 'night', nightActions: {}, votes: {}, playersDone: {}, bidelloResponse: null, segretariaResponse: null });
  },

  async endNight() {
    const data = state.roomData;
    if (!data) return;
    showLoading('Elaborando la notte...');
    try {

    const actions = data.nightActions || {};
    const players = { ...data.players };
    const events = [...(data.events || [])];
    const eliminated = [...(data.eliminated || [])];
    let announcements = [];
    const addEliminated = (name) => {
      if (name && !eliminated.find(e => e.name === name)) {
        eliminated.push({ name, role: players[name]?.role });
      }
    };

    // Get night actions
    const bulloVotes = {};
    Object.values(actions).forEach(a => {
      if (a.role === 'bullo' && a.target) {
        bulloVotes[a.target] = (bulloVotes[a.target] || 0) + 1;
      }
    });

    const sostegnoAction = actions['__sostegno'];
    const chimicaAction   = actions['__chimica'];
    const campionatiActive = data.campionatiUsed && actions['__motoria']?.target === 'campionati';

    // Find bullo target (majority vote)
    let bulloTarget = null;
    if (!campionatiActive) {
      let maxVotes = 0;
      Object.entries(bulloVotes).forEach(([name, v]) => {
        if (v > maxVotes) { maxVotes = v; bulloTarget = name; }
      });
    } else {
      announcements.push({ text: '🏆 I bulli erano ai Campionati Studenteschi! Nessuna vittima questa notte.', type: 'good' });
    }

    // Apply sostegno protection
    const protected_ = sostegnoAction?.target;

    // Apply chimica potion
    if (chimicaAction?.target && !chimicaAction.skipped) {
      const target = chimicaAction.target;
      const targetRole = ROLES[players[target]?.role];
      if (targetRole?.team === 'bulli') {
        players[target].alive = false;
        addEliminated(target);
        events.push({ text: `🧪 L'intruglio della Prof di Chimica ha eliminato ${target}!`, type: 'good' });
        announcements.push({ text: `L'intruglio ha funzionato! Qualcuno è stato eliminato.`, type: 'good' });
        // If bulli targeted chimica the same night, both die
        if (bulloTarget && bulloTarget === chimicaAction.actor && players[chimicaAction.actor]?.alive) {
          players[chimicaAction.actor].alive = false;
          addEliminated(chimicaAction.actor);
          events.push({ text: `🧪 La Prof di Chimica è stata eliminata dai bulli nella stessa notte!`, type: 'bad' });
          announcements.push({ text: `La Prof di Chimica e la vittima dell'intruglio sono stati eliminati entrambi!`, type: 'bad' });
          bulloTarget = null; // già gestito, non eliminare di nuovo
        }
      } else {
        // Innocent dies
        players[target].alive = false;
        addEliminated(target);
        events.push({ text: `🧪 L'intruglio ha colpito ${target} che era innocente!`, type: 'bad' });
        announcements.push({ text: `L'intruglio ha colpito la persona sbagliata…`, type: 'bad' });
      }
    }

    // Apply bullo elimination
    if (bulloTarget && players[bulloTarget]?.alive) {
      if (bulloTarget === protected_) {
        const protectedIsEvil = ROLES[players[protected_]?.role]?.team === 'bulli' || players[protected_]?.role === 'omertoso';
        const sostegnoActor = actions['__sostegno']?.actor;
        if (protectedIsEvil && sostegnoActor && players[sostegnoActor]?.alive) {
          players[sostegnoActor].alive = false;
          addEliminated(sostegnoActor);
          events.push({ text: '🛡️ La Prof di Sostegno ha protetto un bullo ed è stata eliminata!', type: 'bad' });
          announcements.push({ text: 'Stanotte qualcuno è stato escluso per aver protetto la persona sbagliata…', type: 'bad' });
        } else {
          events.push({ text: `🛡️ ${bulloTarget} era protetto dalla Prof di Sostegno!`, type: 'good' });
          announcements.push({ text: `Qualcuno è stato protetto stanotte. Nessuna vittima!`, type: 'good' });
        }
      } else {
        // Check if target is prof_motoria (both die)
        const targetRole = players[bulloTarget]?.role;
        if (targetRole === 'prof_motoria_1' || targetRole === 'prof_motoria_2') {
          const partner = targetRole === 'prof_motoria_1' ? 'prof_motoria_2' : 'prof_motoria_1';
          const partnerPlayer = Object.values(players).find(p => p.role === partner && p.alive);
          players[bulloTarget].alive = false;
          addEliminated(bulloTarget);
          if (partnerPlayer) { partnerPlayer.alive = false; addEliminated(partnerPlayer.name); }
          events.push({ text: `💔 I bulli hanno eliminato ${bulloTarget}. Il partner è morto anche lui!`, type: 'bad' });
          announcements.push({ text: `Due persone sono state eliminate questa notte…`, type: 'bad' });
        } else {
          players[bulloTarget].alive = false;
          addEliminated(bulloTarget);
          events.push({ text: `😈 I bulli hanno escluso ${bulloTarget} questa notte.`, type: 'bad' });
          announcements.push({ text: `Stanotte ${bulloTarget} è stato/a escluso/a dai bulli.`, type: 'bad' });
        }
        // Check if prof_robotica was eliminated
        if (players[bulloTarget]?.role === 'prof_robotica') {
          events.push({ text: `🤖 Il Prof di Robotica è stato eliminato! La votazione diurna è annullata.`, type: 'info' });
          announcements.push({ text: `Il sistema di voto è stato sabotato! Nessuna votazione oggi.`, type: 'bad' });
        }
      }
    } else if (!bulloTarget && !campionatiActive) {
      announcements.push({ text: 'I bulli non hanno agito stanotte.', type: 'info' });
    }

    // Bidello response
    const bidelloAction = actions['__bidello'];
    if (bidelloAction?.target) {
      const targetActed = Object.values(actions).some(a => a.target === bidelloAction.target && a.actor !== bidelloAction.actor);
      await state.roomRef.child('bidelloResponse').set({ target: bidelloAction.target, acted: targetActed });
    }

    // Segretaria response
    const segretariaAction = actions['__segretaria'];
    if (segretariaAction?.target) {
      const targetRole = players[segretariaAction.target]?.role;
      await state.roomRef.child('segretariaResponse').set({ target: segretariaAction.target, role: targetRole });
    }

    // Check win condition
    const winResult = App._checkWinCondition(players, data.bullNames || []);

    await state.roomRef.update({
      players,
      events,
      eliminated,
      nightAnnouncements: announcements,
      nightActions: {}, playersDone: {},
      lastProtected: protected_ || null,
      status: winResult ? 'ended' : 'day',
      winner: winResult || null,
      roboticaBlocked: !!(bulloTarget && players[bulloTarget]?.role === 'prof_robotica'),
    });

    } catch(e) { console.error('endNight error:', e); toast('Errore: ' + e.message); }
    hideLoading();
  },

  // ── Day Phase ───────────────────────────────────────────────────────────────
  _handleDayPhase(data) {
    if (state.isHost) {
      const cur = document.querySelector('.screen.active');
      if (!cur || cur.id !== 'screen-preside-day') {
        App.goTo('screen-preside-day');
      }
      App._renderPresideDay(data);
    } else {
      App._renderPlayerDay(data);
      // Show private responses for bidello and segretaria
      App._showPrivateNightResponse(data);
    }
  },

  _renderPresideDay(data) {
    data = data || state.roomData;
    const announcements = data.nightAnnouncements || [];
    const ann = announcements[announcements.length - 1] || { text: 'Buongiorno!', type: 'info' };

    const icons = { bad: '💀', good: '🛡️', info: '☀️' };
    document.getElementById('day-ann-icon').textContent = icons[ann.type] || '☀️';
    document.getElementById('day-ann-text').textContent = ann.text;
    document.getElementById('day-ann-sub').textContent = `Turno ${data.turn}`;

    App._renderEventLog(data.events || []);

    // Show bullo-converted notification to preside
    const votePanelEl = document.getElementById('vote-panel');
    if (votePanelEl && !votePanelEl.querySelector('.religione-banner')) {
      const events = Object.values(data.events || {});
      const conversioneEvent = events.find(ev => ev && ev.text && ev.text.includes('era un bullo') && ev.text.includes('ora gioca con i buoni'));
      if (conversioneEvent) {
        const rb = document.createElement('div');
        rb.className = 'religione-banner';
        rb.style.cssText = 'background:#d1fae5;border:1.5px solid #10b981;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:14px;color:#065f46;';
        rb.innerHTML = '✝️ <strong>Prof di Religione:</strong> ' + conversioneEvent.text.replace('✝️ ', '');
        votePanelEl.insertBefore(rb, votePanelEl.firstChild);
      }
    }

    // Show secchione block notification to preside
    const voteControls = document.getElementById('vote-controls');
    if (data.secchioneBlocked && data.secchioneWho) {
      const banner = document.createElement('div');
      banner.style.cssText = 'background:#fee2e2;border:1.5px solid #ef4444;border-radius:8px;padding:10px 14px;margin-bottom:10px;font-size:14px;color:#b91c1c;';
      banner.innerHTML = '📚 <strong>' + data.secchioneWho + ' (Il Secchione)</strong> ha bloccato l\'eliminazione! Il prossimo voto è annullato.';
      const votePanelEl = document.getElementById('vote-panel');
      if (votePanelEl && !votePanelEl.querySelector('.secchione-banner')) {
        banner.className = 'secchione-banner';
        votePanelEl.insertBefore(banner, votePanelEl.firstChild);
      }
    }

    // Show vote mode indicator
    const voteDesc = document.getElementById('vote-desc');
    const voteMode = data.voteMode || 'normal';
    if (voteDesc) {
      if (voteMode === 'consiglio') {
        const c = data.consiglio || [];
        voteDesc.textContent = `📁 Consiglio Straordinario: voto solo su ${c.join(' e ')}`;
      } else if (voteMode === 'secret') {
        voteDesc.textContent = '🗳️ Voto segreto (Rappresentante di Classe)';
      } else {
        voteDesc.textContent = 'Discussione pubblica — chi vuoi eliminare?';
      }
    }

    App._renderVoteResults(data);

    const startNightBtn = document.getElementById('start-night-btn');
    if (startNightBtn) startNightBtn.style.display = '';
  },

  _renderPlayerDay(data) {
    data = data || state.roomData;
    const role = state.myRole;
    if (!role) return;

    // Update role panel in waiting screen
    document.getElementById('wp-role-icon').textContent = role.icon;
    document.getElementById('wp-role-name').textContent = role.name;
    document.getElementById('wp-role-desc').textContent = role.desc;

    const dayArea = document.getElementById('day-action-area');
    dayArea.style.display = '';

    // All alive players shown to everyone including bulli
    // (bulli see protected player too - option C: they don't know who is protected)
    const alivePlayers = Object.values(data.players || {})
      .filter(p => p.alive && p.name !== state.myName && p.role !== 'preside');

    // Show day actions
    let html = '';
    const myData = data.players?.[state.myName];
    if (!myData?.alive) {
      html = `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">Sei stato/a eliminato/a. Osserva in silenzio.</div>`;
    } else {
      // Vote button
      const myVote = data.votes?.[state.myName];
      const roboticaBlocked = data.roboticaBlocked;
      const myPlayerData = data.players?.[state.myName];
      const isLeccapiedeSwitch = role.id === 'leccapiedi' && (myPlayerData?.switchedTeam || state.leccapedeSwitch);
      if (!roboticaBlocked) {
        if (!myVote) {
          const isFifone = role.id === 'fifone';
          if (!isFifone) {
            // Leccapiede convertito: mostra i voti degli alleati bulli come fanno i bulli stessi
            let leccapiedeInfo = '';
            if (isLeccapiedeSwitch) {
              const votes = data.votes || {};
              const bulli = Object.values(data.players || {}).filter(p => p.role === 'bullo' && p.alive);
              if (bulli.length > 0) {
                leccapiedeInfo = '<div style="background:rgba(239,68,68,0.1);border-radius:8px;padding:8px 10px;margin-bottom:10px">' +
                  '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px;font-family:\"Cinzel\",serif;letter-spacing:0.5px">VOTI DEI BULLI</div>' +
                  bulli.map(b => {
                    const v = votes[b.name];
                    return '<div style="font-size:12px;padding:2px 0">' + b.name + ': ' + (v ? '<strong>' + v + '</strong>' : '⏳') + '</div>';
                  }).join('') + '</div>';
              }
            }
            html += `<div class="night-action-card" style="margin-bottom:8px">
              <div class="night-action-title">🗳️ Il tuo voto</div>
              <div class="night-action-desc">Chi vuoi eliminare?</div>
              ${leccapiedeInfo}
              <div class="player-select-grid">${alivePlayers.map(p =>
                `<button class="player-select-btn" onclick="App.castVote('${p.name}')">${p.name}</button>`
              ).join('')}</div>
            </div>`;
          } else {
            html += `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">Il tuo voto seguirà automaticamente la maggioranza…</div>`;
          }
        } else {
          html += `<div style="text-align:center;padding:0.75rem;font-style:italic;color:rgba(255,255,255,0.5)">✓ Hai votato per: <strong style="color:white">${myVote}</strong></div>`;
        }
      } else {
        html += `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">🤖 Sistema di voto sabotato! Nessuna votazione oggi.</div>`;
      }

      // Special day abilities
      if (role.id === 'secchione' && !state.abilityUsed) {
        html += `<button class="btn btn-danger btn-full btn-sm" style="margin-top:8px" onclick="App.useSecchioneAbility()">📚 Blocca l'eliminazione (rivela il tuo ruolo)</button>`;
      }
      if (role.id === 'rappresentante_classe' && !state.abilityUsed) {
        html += `<button class="btn btn-primary btn-full btn-sm" style="margin-top:8px" onclick="App.useVotoSegreto()">🗳️ Convoca voto segreto</button>`;
      }
      if (role.id === 'coordinatore' && !state.abilityUsed) {
        html += `<button class="btn btn-primary btn-full btn-sm" style="margin-top:8px" onclick="App.useConsiglio()">📁 Consiglio di Classe Straordinario</button>`;
      }
      if (role.id === 'prof_religione' && !state.abilityUsed && !data.religione_used && (data.eliminated?.length > 0)) {
        html += `<button class="btn btn-green btn-full btn-sm" style="margin-top:8px" onclick="App.useRevive()">✝️ Salva un eliminato</button>`;
      }
      if (role.id === 'rappresentante_libri') {
        const lastElim = data.eliminated?.[data.eliminated.length - 1];
        if (lastElim && !data.libriChecked) {
          html += `<button class="btn btn-primary btn-full btn-sm" style="margin-top:8px" onclick="App.useLibri()">📖 Consulta il fascicolo di ${lastElim.name}</button>`;
        }
      }
    }

    dayArea.innerHTML = html;
    App._showWaiting('day');
  },

  async castVote(targetName) {
    await state.roomRef.child('votes/' + state.myName).set(targetName);
    toast('Voto inviato!');
    // Auto-check fifone
    App._applyFifoneVote();
  },

  // Day abilities
  async useSecchioneAbility() {
    state.abilityUsed = true;
    await state.roomRef.update({ secchioneBlocked: true, secchioneWho: state.myName });
    await state.roomRef.child('events/' + Date.now()).set({
      text: '📚 ' + state.myName + ' (Secchione) ha bloccato l\'eliminazione rivelando il suo ruolo!',
      type: 'info'
    });
    toast('Hai bloccato l\'eliminazione! Il tuo ruolo è ora noto a tutti.');
  },

  async useVotoSegreto() {
    state.abilityUsed = true;
    await state.roomRef.update({ voteMode: 'secret', rappresentante_used: true, votes: {} });
    toast('🗳️ Voto segreto convocato! La discussione è annullata.');
  },



  useRevive() {
    const data = state.roomData;
    const eliminated = data?.eliminated || [];
    if (!eliminated.length) { toast('Nessuno da salvare'); return; }
    showModal({
      title: '✝️ Chi vuoi salvare?',
      desc: 'Scegli un giocatore eliminato da riportare in vita.',
      actions: eliminated.map(e => ({
        label: e.name, style: 'btn-green',
        fn: async () => {
          closeModal();
          state.abilityUsed = true;
          const playerRole = ROLES[e.role];
          const isBullo = playerRole?.team === 'bulli' || e.role === 'omertoso';
          const newEliminated = eliminated.filter(x => x.name !== e.name);
          await state.roomRef.child('players/' + e.name + '/alive').set(true);
          await state.roomRef.child('religione_used').set(true);
          await state.roomRef.child('eliminated').set(newEliminated);
          if (isBullo) {
            await state.roomRef.child('players/' + e.name + '/role').set('buono_convertito');
          }
          // Reset votes so the newly-alive player can participate cleanly
          const currentVotes = data.votes || {};
          const cleanedVotes = {};
          Object.entries(currentVotes).forEach(([voter, target]) => {
            if (target !== e.name) cleanedVotes[voter] = target;
          });
          await state.roomRef.child('votes').set(cleanedVotes);
          const txt = isBullo
            ? `✝️ ${e.name} è stato/a salvato/a! Era un bullo — ora gioca con i buoni!`
            : `✝️ ${e.name} è tornato/a in vita!`;
          await state.roomRef.child(`events/${Date.now()}`).set({ text: txt, type: isBullo ? 'info' : 'good' });
          toast(txt);
        }
      }))
    });
  },

  async useLibri() {
    const data = state.roomData;
    const lastElim = data?.eliminated?.[data.eliminated.length - 1];
    if (!lastElim) return;
    const role = ROLES[lastElim.role];
    const wasBullo = role?.team === 'bulli';
    await state.roomRef.update({ libriChecked: true });
    showModal({
      title: `📖 Fascicolo di ${lastElim.name}`,
      desc: wasBullo ? `${lastElim.name} era un BULLO! La classe ha fatto bene.` : `${lastElim.name} era innocente (${role?.name || 'ruolo sconosciuto'}). La classe ha sbagliato.`,
      actions: [{ label: 'Capito', style: 'btn-outline', fn: closeModal }]
    });
  },

  // ── Vote resolution ─────────────────────────────────────────────────────────
  _renderVoteResults(data) {
    const votes = data.votes || {};
    const alivePlayers = Object.values(data.players||{}).filter(p => p.alive && p.role !== 'preside');
    const consiglio = data.consiglio;
    const rappresentante = Object.values(data.players||{}).find(p => p.role === 'rappresentante_classe' && p.alive);

    // Count votes respecting voteMode
    const voteMode = data.voteMode || 'normal';
    const counts = {};
    Object.entries(votes).forEach(([voter, target]) => {
      if (!target) return;
      // For consiglio: only count votes for the two candidates
      if (voteMode === 'consiglio' && consiglio.length > 0 && !consiglio.includes(target)) return;
      // Double vote for rappresentante in secret vote
      const weight = (rappresentante && voter === rappresentante.name && voteMode === 'secret') ? 2 : 1;
      counts[target] = (counts[target] || 0) + weight;
    });

    const total = Object.values(counts).reduce((a,b)=>a+b,0) || 1;
    const resultsEl = document.getElementById('vote-results-list');
    if (resultsEl) {
      resultsEl.innerHTML = Object.keys(counts).length === 0
        ? '<p style="font-style:italic;color:var(--text-light);font-size:14px">Nessun voto ancora.</p>'
        : Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([name, count]) => `
            <div class="vote-row">
              <div class="vote-name">${name}</div>
              <div class="vote-count">${count}</div>
              <div style="flex:1;padding-left:8px">
                <div class="vote-bar" style="width:${Math.round(count/total*100)}%"></div>
              </div>
            </div>`).join('');
    }

    const votedNames = Object.keys(votes);
    const notVoted = alivePlayers.filter(p => !votedNames.includes(p.name) && p.role !== 'fifone');
    const voteDesc = document.getElementById('vote-desc');
    if (voteDesc) voteDesc.textContent = notVoted.length > 0
      ? `In attesa di: ${notVoted.map(p=>p.name).join(', ')}`
      : 'Tutti hanno votato!';

    const controls = document.getElementById('vote-controls');
    if (!controls) return;

    if (data.roboticaBlocked) {
      controls.innerHTML = `<button class="btn btn-primary btn-full" onclick="App.startNight()">🌙 Inizia la notte (voto sabotato)</button>`;
      return;
    }

    const allVoted = alivePlayers.every(p => votes[p.name] || p.role === 'fifone');
    if (allVoted && Object.keys(counts).length > 0) {
      const maxCount = Math.max(...Object.values(counts));
      const candidates = Object.entries(counts).filter(([,c])=>c===maxCount).map(([n])=>n);
      controls.innerHTML = candidates.map(name =>
        `<button class="btn btn-red btn-full btn-sm" onclick="App.eliminatePlayer('${name}')">
          🚫 Elimina ${name} (${counts[name]} voti)
        </button>`
      ).join('') +
      `<button class="btn btn-outline btn-full btn-sm" style="margin-top:4px" onclick="App.skipElimination()">Nessuna eliminazione / Pareggio</button>`;
    } else {
      controls.innerHTML = `<p style="font-style:italic;color:var(--text-light);font-size:13px;text-align:center">Voti ricevuti: ${votedNames.length}/${alivePlayers.length}</p>`;
    }
  },

  _renderLobby() {
    const el = document.getElementById('lobby-code');
    if (el) el.textContent = state.roomCode;
    const hostControls = document.getElementById('lobby-host-controls');
    const guestMsg = document.getElementById('lobby-guest-msg');
    if (hostControls) hostControls.style.display = state.isHost ? '' : 'none';
    if (guestMsg) guestMsg.style.display = state.isHost ? 'none' : '';
  },

  _renderLobbyPlayers(data) {
    const players = data.players || {};
    const list = Object.values(players);
    const countEl = document.getElementById('lobby-count');
    if (countEl) countEl.textContent = list.length;

    const playersEl = document.getElementById('lobby-players');
    if (playersEl) {
      playersEl.innerHTML = list.map(p => `
        <div class="player-lobby-row ${p.name === state.myName ? 'is-host' : ''}">
          <div class="player-lobby-icon">${p.role === 'preside' ? '👑' : '🎓'}</div>
          <div class="player-lobby-name">${p.name}${p.role === 'preside' ? ' (Preside)' : ''}</div>
          <span class="badge ${p.ready ? 'badge-ready' : 'badge-waiting'}">${p.ready ? 'Pronto' : 'In attesa'}</span>
        </div>`).join('');
    }

    if (state.isHost) {
      const nonPreside = list.filter(p => p.role !== 'preside' && p.name !== state.myName);
      const hint = document.getElementById('lobby-player-count-hint');
      if (hint) hint.textContent = nonPreside.length < 6
        ? `Servono ancora ${6 - nonPreside.length} giocatori (minimo 6)`
        : `${nonPreside.length} giocatori pronti!`;
      const startBtn = document.getElementById('start-game-btn');
      if (startBtn) startBtn.disabled = nonPreside.length < 6;
    }
  },

  _renderRules() {
    const body = document.getElementById('rules-body');
    if (!body) return;
    const sections = [
      { title: 'Obiettivo', text: 'I buoni devono scoprire ed eliminare tutti i bulli. I bulli devono raggiungere la parità numerica con i buoni. Il Furbetto vince da solo se sopravvive a tutti.' },
      { title: 'Struttura del turno', text: 'Ogni turno ha una fase notturna (azioni segrete) e una fase diurna (discussione e votazione).' },
      { title: 'Fase notturna', text: 'Il Preside avvia la notte. I bulli scelgono una vittima. I ruoli speciali usano le loro abilità tramite app. Nessuno parla.' },
      { title: 'Fase diurna', text: 'Il Preside annuncia gli eventi della notte. Si discute e si vota chi eliminare. Il Preside gestisce il voto.' },
      { title: 'Fine partita', text: 'I buoni vincono se eliminano tutti i bulli. I bulli vincono se raggiungono la parità. Il Furbetto vince da solo.' },
    ];
    body.innerHTML = sections.map(s => `
      <div style="background:white;border:1.5px solid var(--border);border-radius:var(--r-md);padding:12px 14px;margin-bottom:8px">
        <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">${s.title}</div>
        <div style="font-size:14px;font-style:italic;color:var(--text-light);line-height:1.5">${s.text}</div>
      </div>`).join('') +
      '<div style="font-family:\'Cinzel\',serif;font-size:11px;letter-spacing:1px;color:var(--text-light);text-transform:uppercase;margin:1.25rem 0 8px">Tutti i ruoli</div>' +
      Object.values(ROLES).map(r => `
        <div style="background:white;border:1.5px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:6px;display:flex;gap:10px;align-items:flex-start">
          <span style="font-size:22px;flex-shrink:0">${r.icon}</span>
          <div>
            <div style="font-family:'Cinzel',serif;font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px">${r.name}</div>
            <div style="font-size:13px;font-style:italic;color:var(--text-light);line-height:1.35">${r.desc}</div>
          </div>
        </div>`).join('');
  },

  async castVote(targetName) {
    await state.roomRef.child('votes/' + state.myName).set(targetName);
    toast('Voto inviato!');
    await App._applyFifoneVote();
  },

  async eliminatePlayer(name) {
    const data = state.roomData;
    const players = { ...data.players };
    const eliminated = [...(data.eliminated || [])];
    const events = [...(data.events || [])];

    if (data.secchioneBlocked) {
      toast('Il Secchione ha bloccato questa eliminazione!');
      // Skip to night - increment turn so nightActionDone resets
      await state.roomRef.update({
        secchioneBlocked: false, secchioneWho: null,
        votes: {}, nightActions: {}, playersDone: {},
        voteMode: 'normal', consiglio: null,
        rappresentante_used: false, coordinatore_used: false,
        status: 'night',
        turn: (data.turn || 1) + 1,
      });
      return;
    }

    players[name].alive = false;
    eliminated.push({ name, role: players[name].role });
    events.push({ text: `🚫 ${name} è stato/a eliminato/a dalla classe.`, type: 'bad' });

    // Check leccapiedi - 1 bullo remaining after elimination
    const aliveBulli = Object.values(players).filter(p => p.alive && p.role === 'bullo');
    const leccapiedi = Object.values(players).find(p => p.role === 'leccapiedi' && p.alive && !p.switchedTeam);
    const leccapieliNotify = aliveBulli.length === 1 && leccapiedi ? leccapiedi.name : null;

    const winResult = App._checkWinCondition(players, data.bullNames || []);

    await state.roomRef.update({
      players, eliminated, events,
      votes: {}, libriChecked: false, secchioneBlocked: false,
      consiglio: null, voteMode: 'normal',
      rappresentante_used: false, coordinatore_used: false, secchione_used: false,
      status: winResult ? 'ended' : 'night',
      winner: winResult || null,
      turn: (data.turn || 1) + 1,
      nightActions: {},
      leccapieliNotify,
    });
  },

  async skipElimination() {
    const data = state.roomData;
    const players = data.players || {};
    const winResult = App._checkWinCondition(players, data.bullNames || []);
    await state.roomRef.update({
      votes: {}, secchioneBlocked: false, consiglio: null, voteMode: 'normal',
      rappresentante_used: false, coordinatore_used: false, secchione_used: false,
      roboticaBlocked: false,
      status: winResult ? 'ended' : 'night',
      winner: winResult || null,
      turn: (data.turn || 1) + 1, nightActions: {},
    });
  },

  async startNight() {
    state.nightActionDone = false;
    state._bidelloResponseShown = false;
    state._segretariaResponseShown = false;
    await state.roomRef.update({ status: 'night', nightActions: {}, votes: {}, roboticaBlocked: false, playersDone: {}, bidelloResponse: null, segretariaResponse: null });
  },

  _checkWinCondition(players, bullNames) {
    const alive = Object.values(players).filter(p => p.alive && p.role !== 'preside');
    const aliveBulli = alive.filter(p => p.role === 'bullo');
    const aliveOmertoso = alive.filter(p => p.role === 'omertoso');
    const aliveLeccapiedi = alive.find(p => p.role === 'leccapiedi' && p.switchedTeam);
    const aliveFurbetto = alive.find(p => p.role === 'furbetto');

    const evilCount = aliveBulli.length + aliveOmertoso.length + (aliveLeccapiedi ? 1 : 0);
    const goodCount = alive.filter(p => {
      if (p.role === 'bullo') return false;          // evil
      if (p.role === 'omertoso') return false;        // evil
      if (p.role === 'bullo_pentito') return false;   // neutral (doesn't count for either)
      if (p.role === 'furbetto') return false;        // solo
      if (p.role === 'leccapiedi' && p.switchedTeam) return false; // switched to evil
      return true;
    }).length;

    // Furbetto: vince se i bulli sono tutti morti e rimane con ≤1 buono
    const aliveNonFurbetto = alive.filter(p => p.role !== 'furbetto');
    if (aliveFurbetto && aliveNonFurbetto.length === 0) return 'furbetto';
    if (aliveFurbetto && aliveBulli.length === 0 && aliveOmertoso.length === 0 && !aliveLeccapiedi && goodCount <= 1) return 'furbetto';
    if (aliveBulli.length === 0 && !aliveFurbetto) return 'buoni';
    if (aliveBulli.length === 0 && aliveFurbetto && goodCount > 1) return null; // partita continua
    if (evilCount >= goodCount && evilCount > 0) return 'bulli';
    return null;
  },

  _showWin(data) {
    const winner = data.winner;
    const icons  = { bulli:'😈', buoni:'🎓', furbetto:'🦊' };
    const titles = { bulli:'I Bulli hanno vinto!', buoni:'I Buoni hanno vinto!', furbetto:'Il Furbetto ha vinto da solo!' };
    document.getElementById('win-icon').textContent  = icons[winner]  || '🏆';
    document.getElementById('win-title').textContent = titles[winner] || 'Fine partita!';
    document.getElementById('win-sub').textContent   = '';
    const players = data.players || {};
    document.getElementById('win-roles-reveal').innerHTML = Object.values(players)
      .filter(p => p.role !== 'preside')
      .map(p => {
        const role = ROLES[p.role] || { icon:'❓', name: p.role };
        return `<div class="win-role-row">
          <div class="win-role-icon">${role.icon}</div>
          <div class="win-role-name">${p.name}</div>
          <div class="win-role-was">${role.name}${p.alive ? '' : ' 💀'}</div>
        </div>`;
      }).join('');
    App.goTo('screen-win');
    clearSession();
  },

  _renderEventLog(events) {
    const el = document.getElementById('event-log-items');
    if (!el) return;
    el.innerHTML = [...(events||[])].reverse().slice(0,10).map(e =>
      `<div class="event-item ${e.type||''}">${e.text}</div>`
    ).join('') || '<div class="event-item info">La partita è iniziata.</div>';
  },

  async useVotoSegreto() {
    state.abilityUsed = true;
    await state.roomRef.update({ voteMode: 'secret', rappresentante_used: true, votes: {} });
    toast('🗳️ Voto segreto convocato! La discussione è annullata.');
  },

  async useLibri() {
    const data = state.roomData;
    const lastElim = data?.eliminated?.[data.eliminated.length-1];
    if (!lastElim) return;
    const role = ROLES[lastElim.role];
    const wasBullo = role?.team === 'bulli';
    await state.roomRef.update({ libriChecked: true });
    showModal({
      title: `📖 Fascicolo di ${lastElim.name}`,
      desc: wasBullo
        ? `${lastElim.name} era un BULLO! La classe ha fatto bene.`
        : `${lastElim.name} era innocente (${role?.name||'?'}). La classe ha sbagliato.`,
      actions: [{ label:'Capito', style:'btn-outline', fn: closeModal }]
    });
  },

  async useRevive() {
    const data = state.roomData;
    const eliminated = data?.eliminated || [];
    if (!eliminated.length) { toast('Nessuno da salvare'); return; }
    showModal({
      title: '✝️ Chi vuoi salvare?',
      desc: 'Scegli un eliminato da riportare in vita. Se è un bullo, verrà rivelato e convertito.',
      actions: eliminated.map(e => ({
        label: e.name, style: 'btn-green',
        fn: async () => {
          closeModal();
          state.abilityUsed = true;
          const playerRole = ROLES[e.role];
          const isBullo = playerRole?.team === 'bulli' || e.role === 'omertoso';
          // Remove from eliminated list
          const newEliminated = eliminated.filter(x => x.name !== e.name);
          await state.roomRef.child('players/' + e.name + '/alive').set(true);
          await state.roomRef.child('religione_used').set(true);
          await state.roomRef.child('eliminated').set(newEliminated);
          if (isBullo) await state.roomRef.child('players/' + e.name + '/role').set('buono_convertito');
          // Reset votes targeting the revived player
          const currentVotes = data.votes || {};
          const cleanedVotes = {};
          Object.entries(currentVotes).forEach(([voter, target]) => {
            if (target !== e.name) cleanedVotes[voter] = target;
          });
          await state.roomRef.child('votes').set(cleanedVotes);
          const txt = isBullo
            ? `✝️ ${e.name} è stato/a salvato/a! Era un bullo — ora gioca con i buoni!`
            : `✝️ ${e.name} è tornato/a in vita!`;
          await state.roomRef.child('events/' + Date.now()).set({ text: txt, type: isBullo ? 'info' : 'good' });
          toast(txt);
        }
      }))
    });
  },

  useConsiglio() {
    const data = state.roomData;
    const alive = Object.values(data?.players||{}).filter(p => p.alive && p.name !== state.myName && p.role !== 'preside');
    showModal({
      title: '📁 Consiglio Straordinario — primo imputato:',
      desc: 'Annulla qualsiasi altro voto. Scegli due imputati.',
      actions: alive.map(p => ({
        label: p.name, style: 'btn-outline',
        fn: () => {
          closeModal();
          const rest = alive.filter(x => x.name !== p.name);
          showModal({
            title: 'Secondo imputato:',
            desc: 'Il voto riguarderà solo questi due.',
            actions: rest.map(p2 => ({
              label: p2.name, style: 'btn-outline',
              fn: async () => {
                closeModal();
                state.abilityUsed = true;
                await state.roomRef.update({
                  voteMode: 'consiglio',
                  consiglio: [p.name, p2.name],
                  coordinatore_used: true,
                  votes: {}
                });
                toast('📁 Consiglio convocato! Voto solo su ' + p.name + ' e ' + p2.name + '.');
              }
            }))
          });
        }
      }))
    });
  },

  async activateCampionati() {
    await state.roomRef.update({ campionatiUsed: true });
    await state.roomRef.child('nightActions/__motoria').set({ actor:state.myName, role:state.myRole.id, target:'campionati', ts:Date.now() });
    state.abilityUsed = true;
    state.nightActionDone = true;
    toast('🏆 Campionati Studenteschi attivati!');
  },



  async selectNightTarget(targetName) {
    const role = state.myRole;
    if (!role || state.nightActionDone) return;
    document.querySelectorAll('.player-select-btn').forEach(b => b.classList.remove('selected'));
    const btn = document.getElementById('nbtn-' + targetName);
    if (btn) btn.classList.add('selected');
    const actionKey = {
      'bullo': state.myName,
      'prof_sostegno': '__sostegno',
      'segretaria': '__segretaria',
      'bidello': '__bidello',
      'prof_chimica': '__chimica',
    }[role.id] || state.myName;
    await state.roomRef.child('nightActions/' + actionKey).set({ actor:state.myName, role:role.id, target:targetName, ts:Date.now() });
    if (role.id === 'prof_chimica') {
      state.abilityUsed = true;
      state.nightActionDone = true;
      await state.roomRef.child('playersDone/' + state.myName).set(true);
    } else if (role.id !== 'bullo') {
      // Non-bulli: lock after first action
      state.nightActionDone = true;
      await state.roomRef.child('playersDone/' + state.myName).set(true);
    }
    // Bulli can change vote freely until Preside ends night
    const nightArea = document.getElementById('night-action-area');
    if (nightArea) nightArea.innerHTML = `<div style="text-align:center;padding:1rem;font-style:italic;color:rgba(255,255,255,0.5)">✓ Azione completata. Attendi gli altri…</div>`;
  },

  async _applyFifoneVote() {
    const data = state.roomData;
    if (!data) return;
    const players = data.players || {};
    const fifone = Object.values(players).find(p => p.role === 'fifone' && p.alive);
    if (!fifone || data.votes?.[fifone.name]) return;
    const votes = data.votes || {};
    const alivePlayers = Object.values(players).filter(p => p.alive && p.role !== 'preside' && p.role !== 'fifone');
    const votedCount = Object.keys(votes).filter(n => n !== fifone.name).length;
    if (votedCount < Math.ceil(alivePlayers.length / 2)) return;
    const counts = {};
    Object.values(votes).forEach(v => { if(v) counts[v] = (counts[v]||0)+1; });
    if (!Object.keys(counts).length) return;
    const leader = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    await state.roomRef.child('votes/' + fifone.name).set(leader);
  },

  _showLeccapiedeModal(data) {
    // Solo una volta per partita
    if (state.leccapiedinChoiceMade) return;
    const bullo = Object.values(data.players || {}).find(p => p.role === 'bullo' && p.alive);
    const bulloName = bullo ? bullo.name : 'il bullo rimasto';
    setTimeout(() => {
      showModal({
        title: '🐍 Un bullo ha bisogno di te!',
        desc: 'Rimane un solo bullo in vita. Vuoi unirti a lui? Se accetti, vincete insieme — ma lui non saprà chi sei.',
        actions: [
          {
            label: '🤝 Sì, mi unisco',
            style: 'btn-danger',
            fn: async () => {
              closeModal();
              state.leccapiedinChoiceMade = true;
              state.leccapedeSwitch = true;
              await state.roomRef.child('players/' + state.myName + '/switchedTeam').set(true);
              await state.roomRef.child('leccapieliNotify').set(null);
              toast('Hai scelto di unirti ai bulli. Buona fortuna!');
            }
          },
          {
            label: '❌ No, resto con i buoni',
            style: 'btn-outline',
            fn: async () => {
              closeModal();
              state.leccapiedinChoiceMade = true;
              await state.roomRef.child('leccapieliNotify').set(null);
              toast('Hai scelto di restare con i buoni.');
            }
          }
        ]
      });
    }, 600);
  },

  _showPrivateNightResponse(data) {
    const myData = data.players?.[state.myName];
    if (!myData) return;
    const role = myData.role;

    // Bidello response
    if (role === 'bidello' && data.bidelloResponse && !state._bidelloResponseShown) {
      const resp = data.bidelloResponse;
      state._bidelloResponseShown = true;
      setTimeout(() => {
        showModal({
          title: '🧹 Risposta del Preside',
          desc: resp.acted
            ? resp.target + ' si è mosso/a stanotte. Ha usato un potere o è stato coinvolto in qualcosa.'
            : resp.target + ' non si è mosso/a stanotte. Nessuna azione rilevata.',
          actions: [{ label: resp.acted ? '✅ Si, si è mosso/a' : '❌ No, non si è mosso/a', style: resp.acted ? 'btn-green' : 'btn-outline', fn: closeModal }]
        });
      }, 500);
    }

    // Segretaria response
    if (role === 'segretaria' && data.segretariaResponse && !state._segretariaResponseShown) {
      const resp = data.segretariaResponse;
      state._segretariaResponseShown = true;
      const roleObj = ROLES[resp.role];
      const isBullo = roleObj?.team === 'bulli' || resp.role === 'omertoso';
      setTimeout(() => {
        showModal({
          title: '📋 Registro scolastico',
          desc: resp.target + ' è: ' + (roleObj?.name || resp.role) + (isBullo ? ' — ATTENZIONE: è dalla parte dei bulli!' : ' — è innocente.'),
          actions: [{ label: isBullo ? '😱 Capito!' : '✅ Capito', style: isBullo ? 'btn-red' : 'btn-green', fn: closeModal }]
        });
      }, 500);
    }
  },

  _showWaiting(phase) {
    const isNight = phase === 'night';
    // Update icons and text
    const icon = document.getElementById('waiting-icon');
    const title = document.getElementById('waiting-title');
    const desc = document.getElementById('waiting-desc');
    const badge = document.getElementById('waiting-phase-badge');
    if (icon)  icon.textContent  = isNight ? '🌙' : '☀️';
    if (title) title.textContent = isNight ? 'È notte' : 'È giorno';
    if (desc)  desc.textContent  = isNight ? 'Tieni gli occhi chiusi…' : 'Discussione in corso…';
    if (badge) {
      badge.textContent  = isNight ? 'Notte' : 'Giorno';
      badge.className    = `phase-badge ${phase}`;
    }
    // Show/hide action areas
    const nightArea = document.getElementById('night-action-area');
    const dayArea   = document.getElementById('day-action-area');
    if (nightArea) nightArea.style.display = isNight ? '' : 'none';
    if (dayArea)   dayArea.style.display   = phase === 'day' ? '' : 'none';
    // Navigate to waiting screen
    const cur = document.querySelector('.screen.active');
    if (!cur || cur.id !== 'screen-waiting') {
      App.goTo('screen-waiting');
    }
  },

  confirmLeave() {
    showModal({
      title: 'Esci dalla partita?',
      desc: 'Perderai la connessione alla partita in corso.',
      actions: [
        { label: '🚪 Esci', style: 'btn-danger', fn: () => { closeModal(); App.fullReset(); }},
        { label: 'Rimani', style: 'btn-outline', fn: closeModal },
      ]
    });
  },

  fullReset() {
    if (state.unsubscribe) state.unsubscribe();
    clearSession();
    Object.assign(state, { myName:'', myRole:null, isHost:false, roomCode:null, roomRef:null, unsubscribe:null, roomData:null, abilityUsed:false, nightActionDone:false, screenHistory:[] });
    App.goTo('screen-welcome');
  },
};

// ─── MODAL ─────────────────────────────────────────────────────────────────────
function showModal({ title, desc, actions }) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent  = desc;
  const el = document.getElementById('modal-actions');
  el.innerHTML = (actions || []).map((a,i) =>
    `<button class="btn ${a.style} btn-full btn-sm" onclick="modalAct(${i})">${a.label}</button>`
  ).join('');
  el._actions = actions;
  document.getElementById('modal').classList.add('open');
}
function modalAct(i) {
  const a = document.getElementById('modal-actions')._actions?.[i];
  if (a) a.fn();
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ─── TOAST ─────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ─── LOADING ───────────────────────────────────────────────────────────────────
function showLoading(msg) {
  const el = document.getElementById('loading');
  el.querySelector('.loading-text').textContent = msg || 'Caricamento…';
  el.style.display = 'flex';
}
function hideLoading() { document.getElementById('loading').style.display = 'none'; }

// ─── UTILS ─────────────────────────────────────────────────────────────────────
function genCode() {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({length:4}, () => c[Math.floor(Math.random()*c.length)]).join('');
}

// ─── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
