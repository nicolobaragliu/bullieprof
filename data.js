'use strict';

// ─── RUOLI ────────────────────────────────────────────────────────────────────
const ROLES = {
  // ── BULLI ──
  bullo: {
    id: 'bullo',
    name: 'Il Bullo',
    team: 'bulli',
    icon: '😈',
    desc: 'Di notte scegli con i tuoi complici chi escludere. Vinci quando i bulli raggiungono la parità con i buoni.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: [],
  },

  // ── BUONI ──
  prof_sostegno: {
    id: 'prof_sostegno',
    name: 'Prof di Sostegno',
    team: 'buoni',
    icon: '🛡️',
    desc: 'Ogni notte proteggi un giocatore. Se i bulli lo scelgono, l\'eliminazione fallisce. Non puoi proteggere la stessa persona due notti di fila.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['protect'],
  },

  prof_motoria_1: {
    id: 'prof_motoria_1',
    name: 'Prof di Motoria',
    team: 'buoni',
    icon: '🏃',
    desc: 'Sei in coppia con l\'altro Prof di Motoria. Una volta per partita potete attivare i Campionati Studenteschi: quella notte i bulli non possono eliminare nessuno. Se i bulli vi eliminano, morite entrambi.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['campionati'],
    partner: 'prof_motoria_2',
  },

  prof_motoria_2: {
    id: 'prof_motoria_2',
    name: 'Prof di Motoria',
    team: 'buoni',
    icon: '🏃',
    desc: 'Sei in coppia con l\'altro Prof di Motoria. Una volta per partita potete attivare i Campionati Studenteschi: quella notte i bulli non possono eliminare nessuno. Se i bulli vi eliminano, morite entrambi.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['campionati'],
    partner: 'prof_motoria_1',
  },

  bidello: {
    id: 'bidello',
    name: 'Bidello del Terzo Piano',
    team: 'buoni',
    icon: '🧹',
    desc: 'Ogni notte scegli un giocatore e chiedi al Preside se si è mosso. Risposta solo Sì o No. Sai che qualcuno ha agito ma non sai in che direzione.',
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
    desc: 'Una volta per partita puoi bloccare un\'eliminazione diurna che ritieni ingiusta. Devi rivelare pubblicamente il tuo ruolo. Da quel momento tutti sanno chi sei.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['block_vote'],
  },

  prof_religione: {
    id: 'prof_religione',
    name: 'Prof di Religione',
    team: 'buoni',
    icon: '✝️',
    desc: 'Una volta per partita salvi un giocatore già eliminato. Non puoi salvare te stesso. Se salvi un bullo, l\'app rivela la sua identità e da quel momento gioca con i buoni.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['revive'],
  },

  segretaria: {
    id: 'segretaria',
    name: 'La Segretaria',
    team: 'buoni',
    icon: '📋',
    desc: 'Ogni notte consulti il registro e scopri il ruolo esatto di un giocatore a tua scelta. Sei l\'investigatrice principale.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 6,
    abilities: ['investigate'],
  },

  rappresentante_classe: {
    id: 'rappresentante_classe',
    name: 'Rappresentante di Classe',
    team: 'buoni',
    icon: '🗳️',
    desc: 'Una volta per partita convochi un voto segreto saltando la discussione pubblica. In quel voto il tuo voto conta doppio.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 8,
    abilities: ['secret_vote'],
  },

  rappresentante_libri: {
    id: 'rappresentante_libri',
    name: 'Rappresentante dei Libri',
    team: 'buoni',
    icon: '📖',
    desc: 'Dopo ogni eliminazione diurna puoi consultare il fascicolo dell\'eliminato e scoprire se era un bullo o no. Solo tu lo sai.',
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
    desc: 'Una volta per partita convochi un Consiglio di Classe Straordinario. Scegli due giocatori: il voto di quel turno riguarda solo loro due.',
    nightAction: false,
    dayAction: true,
    isAmbiguous: false,
    minPlayers: 10,
    abilities: ['consiglio'],
  },

  prof_chimica: {
    id: 'prof_chimica',
    name: 'Prof di Chimica',
    team: 'buoni',
    icon: '🧪',
    desc: 'Una volta per partita prepari un intruglio per un giocatore. Se è un bullo muore. Se è innocente muore l\'innocente. Se i bulli ti eliminano quella stessa notte, muorete entrambi.',
    nightAction: true,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 10,
    abilities: ['potion'],
  },

  prof_robotica: {
    id: 'prof_robotica',
    name: 'Prof di Robotica',
    team: 'buoni',
    icon: '🤖',
    desc: 'Se vieni eliminato di notte, i bulli sabotano il sistema di voto e la votazione diurna di quel giorno viene annullata. Eccezione: il Consiglio di Classe Straordinario rimane valido.',
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
    desc: 'Nessun potere speciale. Il tuo unico obiettivo: sopravvivere a tutti. Vinci da solo indipendentemente da chi vince.',
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
    desc: 'Non hai poteri speciali. Il tuo voto segue automaticamente la maggioranza — non puoi votare controcorrente anche se volessi.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 8,
    abilities: [],
    passive: 'follow_majority',
  },

  omertoso: {
    id: 'omertoso',
    name: 'L\'Omertoso',
    team: 'bulli',
    icon: '🤐',
    desc: 'Conosci i bulli ma non puoi rivelarli — il tasto accusa è disabilitato. Puoi scegliere di non votare. Vinci con i bulli.',
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
    team: 'buoni', // starts with buoni, can switch
    icon: '🐍',
    desc: 'Giochi con i buoni. Quando rimane un solo bullo ricevi una notifica: puoi unirti a lui. Se accetti, vincete insieme. Il bullo saprà di avere un alleato anonimo.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: true,
    minPlayers: 10,
    abilities: ['switch_team'],
  },

  bullo_pentito: {
    id: 'bullo_pentito',
    name: 'Il Bullo Pentito',
    team: 'buoni',
    icon: '😔',
    desc: 'Conosci i bulli ma giochi con i buoni. Non puoi votare con loro di notte. Non puoi mai rivelare i loro nomi: se lo fai la partita finisce con la vittoria dei bulli.',
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
    name: 'Quello del Primo Banco',
    team: 'buoni',
    icon: '🤓',
    desc: 'Nessun potere speciale. Vinci con i buoni.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  pettina: {
    id: 'pettina',
    name: 'Quella che si Pettina',
    team: 'buoni',
    icon: '💁',
    desc: 'Nessun potere speciale. Vinci con i buoni.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  ultimo_banco: {
    id: 'ultimo_banco',
    name: 'Quello dell\'Ultimo Banco',
    team: 'buoni',
    icon: '😴',
    desc: 'Nessun potere speciale. Vinci con i buoni.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  dorme: {
    id: 'dorme',
    name: 'Quello che Dorme Sempre',
    team: 'buoni',
    icon: '💤',
    desc: 'Nessun potere speciale. Vinci con i buoni.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  mangia: {
    id: 'mangia',
    name: 'Quella che Mangia di Nascosto',
    team: 'buoni',
    icon: '🍕',
    desc: 'Nessun potere speciale. Vinci con i buoni.',
    nightAction: false,
    dayAction: false,
    isAmbiguous: false,
    minPlayers: 16,
    abilities: [],
    isGeneric: true,
  },
  nota: {
    id: 'nota',
    name: 'Quello della Nota',
    team: 'buoni',
    icon: '✋',
    desc: 'Nessun potere speciale. Vinci con i buoni.',
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
  if (n <= 8)  return 2;
  if (n <= 12) return 3;
  return 4;
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
