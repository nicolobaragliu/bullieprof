'use strict';

// ─── RUOLI ────────────────────────────────────────────────────────────────────
const ROLES = {
  // ── BULLI ──
  bullo: {
    id: 'bullo',
    name: 'Il Bullo',
    team: 'bulli',
    icon: '😈',
    desc: 'Di notte scegli una vittima. I bulli si conoscono tra loro. Vinci con i tuoi complici.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: [],
  },

  // ── BUONI ──
  prof_sostegno: {
    id: 'prof_sostegno',
    name: 'La prof di sostegno',
    team: 'buoni',
    icon: '🛡️',
    desc: 'Di notte proteggi un giocatore dai bulli. Se lo scelgono come vittima quella notte sopravvive.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['protect'],
  },

  prof_motoria_1: {
    id: 'prof_motoria_1',
    name: 'Il prof di motoria',
    team: 'buoni',
    icon: '🏃',
    desc: 'Siete in coppia! Una volta per partita attivate i Campionati: i bulli non eliminano nessuno quella notte.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['campionati'],
    partner: 'prof_motoria_2',
  },

  prof_motoria_2: {
    id: 'prof_motoria_2',
    name: 'La prof di motoria',
    team: 'buoni',
    icon: '🏃',
    desc: 'Siete in coppia! Una volta per partita attivate i Campionati: i bulli non eliminano nessuno quella notte.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['campionati'],
    partner: 'prof_motoria_1',
  },

  bidello: {
    id: 'bidello',
    name: 'Il Bidello',
    team: 'buoni',
    icon: '🧹',
    desc: 'Di notte spii un giocatore. Il Preside ti dice se è un bullo o un innocente.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['spy'],
  },

  secchione: {
    id: 'secchione',
    name: 'Il Secchione',
    team: 'buoni',
    icon: '📚',
    desc: 'Di giorno blocchi il voto di un giocatore. Quella discussione non può votare per l\'eliminazione.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['block_vote'],
  },

  prof_religione: {
    id: 'prof_religione',
    name: 'Il prof di religione',
    team: 'buoni',
    icon: '✝️',
    desc: 'Una volta per partita, al mattino dopo l\'annuncio del Preside, puoi resuscitare un giocatore eliminato la notte scorsa. Se era un bullo, diventa Bullo Pentito.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['revive'],
  },

  segretaria: {
    id: 'segretaria',
    name: 'La segretaria scolastica',
    team: 'buoni',
    icon: '📋',
    desc: 'Di notte indaghi su un giocatore. Il Preside ti rivela la sua fazione.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['investigate'],
  },

  rappresentante_classe: {
    id: 'rappresentante_classe',
    name: 'Il rappresentante dei genitori',
    team: 'buoni',
    icon: '🗳️',
    desc: 'Di giorno puoi richiedere una votazione segreta. Il risultato viene comunicato solo al Preside.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['secret_vote'],
  },

  rappresentante_libri: {
    id: 'rappresentante_libri',
    name: 'Il rappresentante dei libri',
    team: 'buoni',
    icon: '📖',
    desc: 'Dopo ogni eliminazione diurna puoi scoprire se il giocatore eliminato era un bullo o un innocente.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['check_eliminated'],
  },

  coordinatore: {
    id: 'coordinatore',
    name: 'Il Coordinatore',
    team: 'buoni',
    icon: '📁',
    desc: 'Una volta per partita puoi convocare un Consiglio Straordinario: si tiene un secondo voto di eliminazione.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 10,
    abilities: ['consiglio'],
  },

  prof_chimica: {
    id: 'prof_chimica',
    name: 'La prof di chimica',
    team: 'buoni',
    icon: '🧪',
    desc: 'Una volta per partita consegni un intruglio. Se il bersaglio è un bullo muore lui. Se è innocente muori tu.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 10,
    abilities: ['potion'],
  },

  prof_robotica: {
    id: 'prof_robotica',
    name: 'Il prof di robotica',
    team: 'buoni',
    icon: '🤖',
    desc: 'Se vieni eliminato di notte, i bulli sabotano il voto: la votazione diurna di quel giorno viene annullata.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 10,
    abilities: [], // passive - activates on death
    passive: 'block_day_vote',
  },

  // ── AMBIGUI ──
  furbetto: {
    id: 'furbetto',
    name: 'Il Furbetto',
    team: 'solo',
    icon: '🦊',
    desc: 'Vinci da solo! Se sei l\'unico sopravvissuto a fine partita hai vinto tu.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 8,
    abilities: [],
  },

  fifone: {
    id: 'fifone',
    name: 'Il Fifone',
    team: 'buoni',
    icon: '😰',
    desc: 'Voti sempre come la maggioranza. Non puoi scegliere liberamente chi eliminare.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 8,
    abilities: [],
    passive: 'follow_majority',
  },

  omertoso: {
    id: 'omertoso',
    name: 'L\'omertosa',
    team: 'bulli',
    icon: '🤐',
    desc: 'Conosci i bulli ma non puoi rivelarli. Perdi se tutti i bulli vengono eliminati.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 10,
    abilities: [],
    knowsBullis: true,
  },

  leccapiedi: {
    id: 'leccapiedi',
    name: 'Il Leccapiedi',
    team: 'buoni',
    icon: '🐍',
    desc: 'Giochi con i buoni ma vinci anche tu se i bulli vincono. I bulli non sanno chi sei.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 10,
    abilities: [],
  },

  bullo_pentito: {
    id: 'bullo_pentito',
    name: 'Il Bullo Pentito',
    team: 'buoni',
    icon: '😔',
    desc: 'Eri un bullo ma vuoi redimirti. Vinci con i buoni se sopravvivi fino alla fine.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 10,
    abilities: [],
    knowsBullis: true,
    cannotReveal: true,
  },

  // ── ALUNNI GENERICI ──
  primo_banco: {
    id: 'primo_banco',
    name: 'Il primo della classe',
    team: 'buoni',
    icon: '🤓',
    desc: 'Sei un semplice studente esemplare. Nessun potere speciale ma il tuo voto vale quanto quello di tutti.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  pettina: {
    id: 'pettina',
    name: 'Quella che si pettina',
    team: 'buoni',
    icon: '💁',
    desc: 'Sei una semplice studentessa. Nessun potere speciale ma il tuo voto conta.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  ultimo_banco: {
    id: 'ultimo_banco',
    name: 'Lo scaldasedia',
    team: 'buoni',
    icon: '😴',
    desc: 'Siedi in fondo e osservi tutto. Nessun potere speciale ma il tuo voto conta.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  dorme: {
    id: 'dorme',
    name: 'Il dormiglione',
    team: 'buoni',
    icon: '💤',
    desc: 'Dormi in classe ma sei dalla parte dei buoni. Nessun potere speciale.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  mangia: {
    id: 'mangia',
    name: 'La mangiona',
    team: 'buoni',
    icon: '🍕',
    desc: 'Mangi di nascosto in classe. Nessun potere speciale ma il tuo voto conta.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  nota: {
    id: 'nota',
    name: 'Il collezionista',
    team: 'buoni',
    icon: '✋',
    desc: 'Colleziona note disciplinari. Sei nei guai ma questa volta puoi riscattarti. Vinci con i buoni.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
};

// ─── SCHEMA PARTITA ───────────────────────────────────────────────────────────
// Ruoli fissi: sempre presenti
const FIXED_ROLES = ['segretaria'];

// Pool di ruoli con poteri che ruotano casualmente
const ROLE_POOL = [
  'prof_sostegno',
  'bidello',
  'secchione',
  'prof_motoria_1', // nota: se entra uno entra anche l'altro
  'prof_religione',
  'rappresentante_classe',
  'rappresentante_libri',
  'coordinatore',
  'prof_chimica',
  'prof_robotica',
  'furbetto',
  'fifone',
  'omertoso',
  'leccapiedi',
];

// Quanti bulli in base ai giocatori
function getBulliCount(n) {
  if (n <= 9)  return 2;
  if (n <= 13) return 3;
  if (n <= 17) return 4;
  return 5;
}

// Genera array ruoli completo per n giocatori
function generateRoles(n) {
  const bullCount = getBulliCount(n);
  const useBulloPentito = n >= 10;
  const roles = [];

  // Add bulli
  for (let i = 0; i < bullCount; i++) roles.push('bullo');

  // Add bullo pentito if enough players
  if (useBulloPentito) roles.push('bullo_pentito');

  // Fixed roles always present
  FIXED_ROLES.forEach(r => roles.push(r));

  // Prof motoria: add as pair or not at all
  const poolWithoutMotoria = ROLE_POOL.filter(r => r !== 'prof_motoria_1');

  // How many more roles do we need?
  const slotsLeft = () => n - roles.length;

  // Shuffle pool and pick roles to fill slots
  const shuffled = [...poolWithoutMotoria].sort(() => Math.random() - 0.5);

  for (const role of shuffled) {
    if (slotsLeft() <= 0) break;
    // Prof motoria needs 2 slots
    if (role === 'prof_motoria_1') {
      if (slotsLeft() >= 2) { roles.push('prof_motoria_1'); roles.push('prof_motoria_2'); }
      continue;
    }
    // Skip omertoso/leccapiedi/bulloPentito for small games
    if (n < 10 && ['omertoso','leccapiedi'].includes(role)) continue;
    roles.push(role);
  }

  // Add prof_motoria pair if pool didn't fill it and there's space
  if (!roles.includes('prof_motoria_1') && slotsLeft() >= 2) {
    roles.push('prof_motoria_1'); roles.push('prof_motoria_2');
  }

  // Fill remaining with generici
  const generici = ['primo_banco','pettina','ultimo_banco','dorme','mangia','nota'];
  let gi = 0;
  while (roles.length < n) { roles.push(generici[gi++ % generici.length]); }

  // Shuffle final assignment
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  return roles.slice(0, n);
}
