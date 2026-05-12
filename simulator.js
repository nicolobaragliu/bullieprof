'use strict';

// ═══════════════════════════════════════════════════════════════════
// BULLI & PROF — Simulatore automatico di partite
// Uso: node simulator.js [numero_partite] [numero_giocatori]
// Es:  node simulator.js 5000       → 5000 partite, giocatori casuali
//      node simulator.js 1000 8     → 1000 partite con 8 giocatori fissi
// ═══════════════════════════════════════════════════════════════════

const NUM_GAMES   = parseInt(process.argv[2]) || 3000;
const FIXED_N     = parseInt(process.argv[3]) || 0; // 0 = casuale
const MAX_TURNS   = 30; // sicurezza anti-loop

// ─── RUOLI (estratto da data.js) ──────────────────────────────────
const ROLES = {
  bullo:               { team:'bulli',  nightAction:true,  hasAbility:true  },
  segretaria:          { team:'buoni',  nightAction:true,  hasAbility:true  },
  prof_sostegno:       { team:'buoni',  nightAction:true,  hasAbility:true  },
  prof_motoria_1:      { team:'buoni',  nightAction:true,  hasAbility:true  },
  prof_motoria_2:      { team:'buoni',  nightAction:true,  hasAbility:true  },
  bidello:             { team:'buoni',  nightAction:true,  hasAbility:true  },
  prof_chimica:        { team:'buoni',  nightAction:true,  hasAbility:true  },
  prof_robotica:       { team:'buoni',  nightAction:false, hasAbility:true, passive:true },
  secchione:           { team:'buoni',  nightAction:false, hasAbility:true  },
  prof_religione:      { team:'buoni',  nightAction:false, hasAbility:true  },
  rappresentante_classe:{ team:'buoni', nightAction:false, hasAbility:true  },
  rappresentante_libri: { team:'buoni', nightAction:false, hasAbility:true  },
  coordinatore:        { team:'buoni',  nightAction:false, hasAbility:true  },
  furbetto:            { team:'solo',   nightAction:false, hasAbility:false },
  fifone:              { team:'buoni',  nightAction:false, hasAbility:false },
  omertoso:            { team:'bulli',  nightAction:false, hasAbility:false },
  leccapiedi:          { team:'buoni',  nightAction:false, hasAbility:false },
  bullo_pentito:       { team:'buoni',  nightAction:false, hasAbility:false },
  primo_banco:         { team:'buoni',  nightAction:false, hasAbility:false, isGeneric:true },
  pettina:             { team:'buoni',  nightAction:false, hasAbility:false, isGeneric:true },
  ultimo_banco:        { team:'buoni',  nightAction:false, hasAbility:false, isGeneric:true },
  dorme:               { team:'buoni',  nightAction:false, hasAbility:false, isGeneric:true },
  mangia:              { team:'buoni',  nightAction:false, hasAbility:false, isGeneric:true },
  nota:                { team:'buoni',  nightAction:false, hasAbility:false, isGeneric:true },
};

// ─── GENERAZIONE RUOLI (da data.js) ───────────────────────────────
function getBulliCount(n) {
  if (n <= 9)  return 2;
  if (n <= 13) return 3;
  if (n <= 17) return 4;
  return 5;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateRoles(n) {
  const bullCount = getBulliCount(n);
  const roles = [];
  for (let i = 0; i < bullCount; i++) roles.push('bullo');
  roles.push('segretaria');

  const POOL = [
    'prof_sostegno','bidello','secchione','prof_religione',
    'rappresentante_classe','rappresentante_libri','coordinatore',
    'prof_chimica','prof_robotica','furbetto','fifone','omertoso',
    'leccapiedi','bullo_pentito',
  ];
  const pool = shuffle([...POOL]);
  const slotsLeft = () => n - roles.length;

  for (const role of pool) {
    if (slotsLeft() <= 0) break;
    if (n < 10 && ['omertoso','leccapiedi','bullo_pentito','coordinatore','prof_chimica','prof_robotica','rappresentante_classe','rappresentante_libri'].includes(role)) continue;
    if (n < 8  && ['furbetto','fifone','prof_motoria_1'].includes(role)) continue;
    roles.push(role);
  }

  // Motoria pair
  if (!roles.includes('prof_motoria_1') && slotsLeft() >= 2) {
    roles.push('prof_motoria_1','prof_motoria_2');
  }

  // Generici
  const gen = ['primo_banco','pettina','ultimo_banco','dorme','mangia','nota'];
  let gi = 0;
  while (roles.length < n) roles.push(gen[gi++ % gen.length]);

  return shuffle(roles).slice(0, n);
}

// ─── CHECK WIN (allineato con app.js) ─────────────────────────────
function checkWin(players) {
  const alive = players.filter(p => p.alive);
  const aliveBulli    = alive.filter(p => p.role === 'bullo');
  const aliveOmertoso = alive.filter(p => p.role === 'omertoso');
  const aliveLecca    = alive.find(p => p.role === 'leccapiedi' && p.switchedTeam);
  const aliveFurbetto = alive.find(p => p.role === 'furbetto');
  const bullAlive     = aliveBulli.length > 0;
  const leccaConta    = aliveLecca && bullAlive;
  const omertosoConta = bullAlive ? aliveOmertoso.length : 0;
  const evilCount     = aliveBulli.length + omertosoConta + (leccaConta ? 1 : 0);
  const goodCount     = alive.filter(p => {
    if (['bullo','omertoso'].includes(p.role)) return false;
    if (p.role === 'bullo_pentito') return false;
    if (p.role === 'furbetto') return false;
    if (p.role === 'leccapiedi' && p.switchedTeam) return false;
    return true;
  }).length;

  const nonFurbetto = alive.filter(p => p.role !== 'furbetto');
  if (aliveFurbetto && nonFurbetto.length === 0) return 'furbetto';
  if (aliveFurbetto && aliveBulli.length === 0 && aliveOmertoso.length === 0 && !aliveLecca && goodCount <= 1) return 'furbetto';
  if (evilCount === 0 && !aliveFurbetto) return 'buoni';
  if (evilCount === 0 && aliveFurbetto && goodCount > 1) return null;
  if (evilCount >= goodCount && evilCount > 0) return 'bulli';
  return null;
}

// ─── SIMULATORE PARTITA ───────────────────────────────────────────
function simulateGame(n) {
  const roleIds = generateRoles(n);
  const names   = Array.from({length: n}, (_, i) => `P${i+1}`);

  // Stato giocatori
  let players = names.map((name, i) => ({
    name,
    role: roleIds[i],
    alive: true,
    switchedTeam: false,
    abilityUsed: false,   // reset ogni turno
  }));

  const state = {
    turn: 1,
    campionatiUsed: false,
    religioneUsed: false,
    lastProtected: null,
  };

  const errors   = [];
  const warnings = [];

  // Helper
  const alive        = ()   => players.filter(p => p.alive);
  const aliveRole    = (r)  => players.filter(p => p.alive && p.role === r);
  const findRole     = (r)  => players.find(p => p.role === r);
  const eliminated   = ()   => players.filter(p => !p.alive);
  const kill         = (p)  => { if (p) p.alive = false; };
  const roleOf       = (nm) => players.find(p => p.name === nm);

  // ── NOTTE ──────────────────────────────────────────────────────
  function simulateNight() {
    // Reset abilityUsed ogni nuova notte (come da fix v2.5)
    players.forEach(p => { p.abilityUsed = false; });

    const nightActions = {};
    const alivePlayers = alive();

    // Verifica: devono esserci azioni da fare
    const nightActors = alivePlayers.filter(p => ROLES[p.role]?.nightAction);
    if (nightActors.length === 0 && alivePlayers.length > 1) {
      warnings.push(`T${state.turn}: nessun ruolo con azione notturna ancora in vita`);
    }

    // Prof Motoria — campionati (usa casualmente se disponibile)
    const motoria = aliveRole('prof_motoria_1')[0];
    let campionatiActive = false;
    if (motoria && !state.campionatiUsed && Math.random() < 0.3) {
      campionatiActive = true;
      state.campionatiUsed = true;
      nightActions['__motoria'] = 'campionati';
    } else if (motoria) {
      nightActions['__motoria'] = 'pass';
    }

    // Prof Sostegno — protegge un giocatore
    const sostegno = aliveRole('prof_sostegno')[0];
    let protectedPlayer = null;
    if (sostegno) {
      const candidates = alivePlayers.filter(p => p.name !== state.lastProtected && p.name !== sostegno.name);
      if (candidates.length === 0) {
        // Può proteggere chiunque se non ci sono alternative
        protectedPlayer = pick(alivePlayers.filter(p => p.name !== sostegno.name)) || null;
      } else {
        protectedPlayer = pick(candidates);
      }
      nightActions['__sostegno'] = protectedPlayer?.name || 'pass';
      state.lastProtected = protectedPlayer?.name || null;
    }

    // Bulli — scelgono vittima
    const bulli = aliveRole('bullo');
    let bulloTarget = null;
    if (bulli.length > 0 && !campionatiActive) {
      const bulloNames = new Set(bulli.map(b => b.name));
      const omertoso   = aliveRole('omertoso')[0];
      if (omertoso) bulloNames.add(omertoso.name);
      const lecca = players.find(p => p.role === 'leccapiedi' && p.alive && p.switchedTeam);
      if (lecca) bulloNames.add(lecca.name);

      const validTargets = alivePlayers.filter(p => !bulloNames.has(p.name));
      if (validTargets.length > 0) {
        bulloTarget = pick(validTargets);
      }
    }
    if (bulli.length > 0) {
      nightActions['__bullo'] = bulloTarget?.name || 'no_target';
    }

    // Segretaria — investiga
    const segretaria = aliveRole('segretaria')[0];
    if (segretaria) {
      const targets = alivePlayers.filter(p => p.name !== segretaria.name);
      nightActions['__segretaria'] = targets.length > 0 ? pick(targets).name : 'pass';
    }

    // Bidello — spia
    const bidello = aliveRole('bidello')[0];
    if (bidello) {
      const targets = alivePlayers.filter(p => p.name !== bidello.name);
      nightActions['__bidello'] = targets.length > 0 ? pick(targets).name : 'pass';
    }

    // Prof Chimica — intruglio (usa casualmente)
    const chimica = aliveRole('prof_chimica')[0];
    if (chimica && !chimica.abilityUsed && Math.random() < 0.4) {
      const targets = alivePlayers.filter(p => p.name !== chimica.name);
      if (targets.length > 0) {
        const target = pick(targets);
        nightActions['__chimica'] = target.name;
        chimica.abilityUsed = true;
      }
    } else if (chimica) {
      nightActions['__chimica'] = 'pass';
    }

    // ── APPLICA RISULTATI NOTTE ──────────────────────────────────

    // Prof Chimica: verifica azione
    let chimicaKilled = null;
    if (nightActions['__chimica'] && nightActions['__chimica'] !== 'pass') {
      const target = roleOf(nightActions['__chimica']);
      if (!target) {
        errors.push(`T${state.turn}: __chimica punta a ${nightActions['__chimica']} che non esiste`);
      } else if (!target.alive) {
        errors.push(`T${state.turn}: __chimica punta a ${nightActions['__chimica']} già morto`);
      } else {
        kill(target);
        chimicaKilled = target.name;
      }
    }

    // Bulli: applica eliminazione
    let roboticaBlocked = false;
    if (bulloTarget) {
      if (!bulloTarget.alive) {
        // Già morto per chimica — ok, i bulli non sanno
      } else if (protectedPlayer && bulloTarget.name === protectedPlayer.name) {
        // Protetto dal Sostegno — nessuna eliminazione
        nightActions['__bullo_result'] = 'protected';
      } else {
        // Morte simultanea Chimica+Bulli
        if (chimicaKilled === bulloTarget.name) {
          // già morto, ok
        } else {
          // Prof Robotica: se target è robotica, blocca voto giorno
          if (bulloTarget.role === 'prof_robotica') {
            roboticaBlocked = true;
          }
          // Prof Motoria coppia: entrambi muoiono
          if (bulloTarget.role === 'prof_motoria_1' || bulloTarget.role === 'prof_motoria_2') {
            const partner = bulloTarget.role === 'prof_motoria_1'
              ? findRole('prof_motoria_2') : findRole('prof_motoria_1');
            if (partner && partner.alive) kill(partner);
          }
          kill(bulloTarget);
        }
      }
    }

    return { roboticaBlocked, nightActions };
  }

  // ── GIORNO ─────────────────────────────────────────────────────
  function simulateDay(roboticaBlocked) {
    if (roboticaBlocked) return null; // voto annullato

    const alivePlayers = alive();
    if (alivePlayers.length < 2) if (evilCount >= goodCount && evilCount > 0) return 'bulli';
  return null;

    // Tutti votano casualmente (escludendo se stessi)
    const votes = {};
    for (const p of alivePlayers) {
      const candidates = alivePlayers.filter(c => c.name !== p.name);
      if (candidates.length > 0) votes[p.name] = pick(candidates).name;
    }

    // Conta voti
    const counts = {};
    Object.values(votes).forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    if (Object.keys(counts).length === 0) if (evilCount >= goodCount && evilCount > 0) return 'bulli';
  return null;

    const maxVotes = Math.max(...Object.values(counts));
    const topCandidates = Object.keys(counts).filter(k => counts[k] === maxVotes);

    // Pareggio = nessuna eliminazione
    if (topCandidates.length > 1) if (evilCount >= goodCount && evilCount > 0) return 'bulli';
  return null;

    const eliminated = roleOf(topCandidates[0]);

    // Secchione: blocca casualmente il 15% delle volte
    const secchione = aliveRole('secchione')[0];
    if (secchione && !secchione.abilityUsed && Math.random() < 0.15) {
      secchione.abilityUsed = true;
      return null; // eliminazione bloccata
    }

    // Prof Religione: resuscita casualmente un eliminato il 20% delle volte
    const religione = aliveRole('prof_religione')[0];
    if (religione && !state.religioneUsed && players.some(p => !p.alive) && Math.random() < 0.2) {
      const dead = players.filter(p => !p.alive);
      const toRevive = pick(dead);
      toRevive.alive = true;
      if (toRevive.role === 'bullo' || toRevive.role === 'omertoso') {
        toRevive.role = 'buono_convertito'; // convertito
      }
      state.religioneUsed = true;
    }

    if (eliminated && eliminated.alive) {
      kill(eliminated);
      return eliminated.name;
    }
    if (evilCount >= goodCount && evilCount > 0) return 'bulli';
  return null;
  }

  // ── LOOP PARTITA ───────────────────────────────────────────────
  let winner = null;
  const roleList = players.map(p => p.role).sort().join(',');

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    state.turn = turn;

    // Check win prima della notte
    winner = checkWin(players);
    if (winner) break;

    // Verifica stato coerente
    const aliveBefore = alive().length;
    if (aliveBefore === 0) {
      errors.push(`T${turn}: tutti i giocatori morti prima di checkWin`);
      break;
    }

    // Notte
    const { roboticaBlocked } = simulateNight();

    // Check win dopo notte
    winner = checkWin(players);
    if (winner) break;

    // Leccapiedi: se rimane 1 bullo e lecca è vivo, 50% cambia team
    const bullAlive = aliveRole('bullo');
    const lecca = players.find(p => p.role === 'leccapiedi' && p.alive && !p.switchedTeam);
    if (lecca && bullAlive.length === 1 && Math.random() < 0.5) {
      lecca.switchedTeam = true;
    }

    // Giorno
    simulateDay(roboticaBlocked);

    // Check win dopo giorno
    winner = checkWin(players);
    if (winner) break;

    // Safety check: se non ci sono bulli e non c'è furbetto, i buoni hanno già vinto
    // ma checkWin non lo ha catturato — segnala
    const postAlive = alive();
    if (postAlive.length > 0 && !winner) {
      const hasBulli = postAlive.some(p => p.role === 'bullo');
      const hasFurbetto = postAlive.some(p => p.role === 'furbetto');
      if (!hasBulli && !hasFurbetto && postAlive.length === 1) {
        errors.push(`T${turn}: 1 giocatore rimasto (${postAlive[0].role}) senza checkWin → stallo`);
      }
    }
  }

  // Timeout
  if (!winner && state.turn >= MAX_TURNS) {
    errors.push(`TIMEOUT dopo ${MAX_TURNS} turni — loop infinito`);
  }

  // Verifica finale: il vincitore è plausibile?
  if (winner) {
    const finalAlive = alive();
    if (winner === 'buoni') {
      // Con il nuovo fix: omertoso e leccapiedi contano evil solo se ci sono bulli vivi
      const bullAliveNow = finalAlive.filter(p => p.role === 'bullo').length > 0;
      const evilAlive = finalAlive.filter(p => {
        if (p.role === 'bullo') return true;
        if (p.role === 'omertoso' && bullAliveNow) return true;
        if (p.role === 'leccapiedi' && p.switchedTeam && bullAliveNow) return true;
        return false;
      });
      if (evilAlive.length > 0) errors.push(`Vittoria 'buoni' ma ${evilAlive.length} evil ancora in vita`);
    }
    if (winner === 'bulli') {
      const bullAlive = finalAlive.filter(p => p.role === 'bullo');
      if (bullAlive.length === 0) errors.push(`Vittoria 'bulli' ma nessun bullo vivo`);
    }
    if (winner === 'furbetto') {
      const furb = finalAlive.find(p => p.role === 'furbetto');
      if (!furb) errors.push(`Vittoria 'furbetto' ma furbetto non trovato tra i vivi`);
    }
  }

  return { winner, errors, warnings, roleList, turns: state.turn };
}

// ─── RUNNER ───────────────────────────────────────────────────────
console.log(`\n🎮 BULLI & PROF — Simulatore v1.0`);
console.log(`   Partite: ${NUM_GAMES} | Giocatori: ${FIXED_N || 'casuale (6-20)'}\n`);

const results = { buoni:0, bulli:0, furbetto:0, timeout:0, errors:[] };
const roleSetErrors = {};
let errorCount = 0;

for (let i = 0; i < NUM_GAMES; i++) {
  const n = FIXED_N || randInt(6, 20);
  const { winner, errors, warnings, roleList, turns } = simulateGame(n);

  if (!winner) results.timeout++;
  else results[winner] = (results[winner] || 0) + 1;

  if (errors.length > 0) {
    errorCount++;
    const key = `[${roleList}]`;
    if (!roleSetErrors[key]) roleSetErrors[key] = [];
    roleSetErrors[key].push({ errors, warnings, turns, n });
  }
}

// ─── REPORT ───────────────────────────────────────────────────────
console.log(`═══════════════════════════════════════`);
console.log(`📊 RISULTATI su ${NUM_GAMES} partite`);
console.log(`═══════════════════════════════════════`);
console.log(`  🎓 Buoni:     ${results.buoni}  (${(results.buoni/NUM_GAMES*100).toFixed(1)}%)`);
console.log(`  😈 Bulli:     ${results.bulli}  (${(results.bulli/NUM_GAMES*100).toFixed(1)}%)`);
console.log(`  🦊 Furbetto:  ${results.furbetto}  (${(results.furbetto/NUM_GAMES*100).toFixed(1)}%)`);
console.log(`  ⏱️  Timeout:   ${results.timeout}`);
console.log(`  ❌ Con errori: ${errorCount} partite`);

if (errorCount === 0) {
  console.log(`\n✅ Nessun bug rilevato! Tutte le partite sono terminate correttamente.\n`);
} else {
  console.log(`\n❌ DETTAGLIO ERRORI (max 10 combinazioni)\n`);
  let shown = 0;
  for (const [roleList, cases] of Object.entries(roleSetErrors)) {
    if (shown >= 10) break;
    console.log(`  Ruoli: ${roleList}`);
    const c = cases[0];
    console.log(`  Giocatori: ${c.n} | Turni: ${c.turns}`);
    c.errors.forEach(e => console.log(`    ❌ ${e}`));
    c.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
    if (cases.length > 1) console.log(`    ... e altre ${cases.length-1} partite con gli stessi ruoli`);
    console.log('');
    shown++;
  }
}
