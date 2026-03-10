// ── Supabase config ──────────────────────────────────────────────────────────
// Credentials are loaded from config.js (gitignored). See config.example.js.
const SUPABASE_URL = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL) || "";
const SUPABASE_ANON_KEY = (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_ANON_KEY) || "";
const supabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// ── Game constants ────────────────────────────────────────────────────────────
const GAME_DURATION_SECONDS = 12 * 60;
const SUBMIT_PENALTY_SECONDS = 45;
const ACCUSATION_PENALTY_SECONDS = 60;
const CORRECT_SUSPECT = "Felix Hart";
const CORRECT_MOTIVE = "Crushing gambling debt";
const PLAYER_NAME_KEY = "blackwood-manor.playerName";
const SESSION_RESULTS_KEY = "blackwood-manor.sessionResults";
const MAX_STORED_RESULTS = 100;
const MAX_LEADERBOARD_ENTRIES = 5;
const PLAYER_NAME_MAX_LENGTH = 24;
const SESSION_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const TABLE_SCHEMAS = {
  suspects: ["id", "name", "role", "motive"],
  corridor_log: ["suspect_id", "location", "seen_at"],
  poison_log: ["suspect_id", "compound", "checked_out_at", "cover_story"],
  alibis: ["suspect_id", "claimed_location", "claimed_time"],
  camera_log: ["suspect_id", "actual_location", "seen_at"],
  debts: ["suspect_id", "creditor", "amount_due", "due_tonight"],
};

// ── Honeypot tables ───────────────────────────────────────────────────────────
// These exist in the DB but are never part of any clue. Querying them flags the
// session as tampered and applies a penalty.
const HONEYPOT_TABLE_NAMES = ["time_controls", "session_tokens"];

const HONEYPOT_SCHEMAS = {
  time_controls: ["control_code", "bonus_seconds", "activated"],
  session_tokens: ["token", "role", "expires_at"],
};

const HONEYPOT_DATA = {
  time_controls: [
    { control_code: "BLACKWOOD-EXT-1", bonus_seconds: 300, activated: false },
    { control_code: "MASTER-OVERRIDE", bonus_seconds: 720, activated: false },
  ],
  session_tokens: [
    { token: "tok_7f4a2b91c3e8d5f6a0b2c4e6f8a0b2c4", role: "admin", expires_at: "23:59" },
  ],
};

// ── Shadow timer ──────────────────────────────────────────────────────────────
// Tracks real wall-clock start time independently of state.remainingSeconds.
// On game end, the two are cross-checked to detect clock manipulation.
const shadowTimer = { wallStartMs: null };

const SUSPECT_DISPLAY = {
  1: "Blackwood's estranged niece — cut from the will six weeks before his death",
  2: "Served Blackwood for eleven years; the only staff member with full, unrestricted house access",
  3: "Personal physician for three years; knew Blackwood's exact cardiac dose thresholds",
  4: "Co-director of Blackwood Industries; a company-wide audit was set to begin Monday morning",
  5: "Drafted Blackwood's original estate documents; stood to lose a £40,000 annual retainer",
};

const CASE_DATA = {
  suspects: [
    {
      id: 1,
      name: "Celia Vale",
      role: "Heiress",
      motive: "Disinherited from the final will",
    },
    {
      id: 2,
      name: "Felix Hart",
      role: "Butler",
      motive: CORRECT_MOTIVE,
    },
    {
      id: 3,
      name: "Dr. Mira Solis",
      role: "Physician",
      motive: "Victim discovered her forged credentials",
    },
    {
      id: 4,
      name: "Owen Reed",
      role: "Business partner",
      motive: "Audit would expose his embezzlement",
    },
    {
      id: 5,
      name: "Harriet Voss",
      role: "Solicitor",
      motive: "New will eliminated her firm's annual retainer",
    },
  ],
  corridor_log: [
    { suspect_id: 2, location: "Library Corridor", seen_at: "21:04" },
    { suspect_id: 3, location: "Library Corridor", seen_at: "21:08" },
    { suspect_id: 2, location: "Service Stair", seen_at: "21:14" },
    { suspect_id: 4, location: "Study Door", seen_at: "21:21" },
    { suspect_id: 1, location: "Ballroom", seen_at: "21:18" },
  ],
  poison_log: [
    {
      suspect_id: 3,
      compound: "Digitalis",
      checked_out_at: "18:40",
      cover_story: "Cardiac lecture sample",
    },
    {
      suspect_id: 2,
      compound: "Digitalis",
      checked_out_at: "20:43",
      cover_story: "Nightcap tray tonic",
    },
    {
      suspect_id: 4,
      compound: "Chloroform",
      checked_out_at: "19:10",
      cover_story: "Cleaning cabinet spill",
    },
  ],
  alibis: [
    { suspect_id: 1, claimed_location: "Ballroom", claimed_time: "21:10" },
    { suspect_id: 2, claimed_location: "Pantry", claimed_time: "21:10" },
    { suspect_id: 3, claimed_location: "Infirmary", claimed_time: "21:10" },
    { suspect_id: 4, claimed_location: "Garage", claimed_time: "21:10" },
    { suspect_id: 5, claimed_location: "Drawing Room", claimed_time: "21:10" },
  ],
  camera_log: [
    { suspect_id: 1, actual_location: "Ballroom", seen_at: "21:11" },
    { suspect_id: 2, actual_location: "Library Corridor", seen_at: "21:04" },
    { suspect_id: 2, actual_location: "Service Stair", seen_at: "21:14" },
    { suspect_id: 3, actual_location: "Infirmary", seen_at: "21:09" },
    { suspect_id: 4, actual_location: "Garage", seen_at: "21:08" },
    { suspect_id: 5, actual_location: "Drawing Room", seen_at: "20:52" },
  ],
  debts: [
    // NOTE: the Bookmaker entry below was tampered with after the murder (true value: 20000)
    { suspect_id: 2, creditor: "Bookmaker", amount_due: 6000, due_tonight: true },
    { suspect_id: 2, creditor: "Loan shark", amount_due: 8000, due_tonight: true },
    { suspect_id: 4, creditor: "Audit hold", amount_due: 9000, due_tonight: true },
    { suspect_id: 4, creditor: "Audit hold", amount_due: 7000, due_tonight: true },
    { suspect_id: 1, creditor: "Trust attorney", amount_due: 5000, due_tonight: true },
    { suspect_id: 3, creditor: "Private lender", amount_due: 4000, due_tonight: true },
  ],
};

const CHALLENGES = [
  {
    title: "Clue 1: Narrow the corridor",
    concept: "WHERE + ORDER BY",
    brief:
      "Find every suspect spotted in the Library Corridor between 21:00 and 21:15. Show name, location, and seen_at, ordered by seen_at.",
    hint:
      "Start from corridor_log, join suspects on suspect_id, then filter the location and time window.",
    tables: ["suspects", "corridor_log"],
    starterQuery: `SELECT s.name, c.location, c.seen_at
FROM corridor_log AS c
JOIN suspects AS s ON s.id = c.suspect_id
WHERE c.location = 'Library Corridor'
  AND c.seen_at BETWEEN '21:00' AND '21:15'
ORDER BY c.seen_at;`,
    requiredTerms: ["corridor_log", "suspects", "join", "where", "order by"],
    expectedRows: [
      { name: "Felix Hart", location: "Library Corridor", seen_at: "21:04" },
      { name: "Dr. Mira Solis", location: "Library Corridor", seen_at: "21:08" },
    ],
    evidence:
      "Two figures were near the library at the critical hour — Felix Hart and Dr. Mira Solis. Having corridor access doesn't make you the killer, but it does narrow the field considerably.",
  },
  {
    title: "Clue 2: Trace the poison",
    concept: "INNER JOIN + filtering",
    brief:
      "The toxicology report confirms digitalis was used. Find every suspect who checked out Digitalis from the apothecary cabinet. Show name, compound, and checked_out_at.",
    hint:
      "Use poison_log as the driving table and filter compound = 'Digitalis'.",
    tables: ["suspects", "poison_log"],
    starterQuery: `SELECT s.name, p.compound, p.checked_out_at
FROM poison_log AS p
JOIN suspects AS s ON s.id = p.suspect_id
WHERE p.compound = 'Digitalis'
ORDER BY p.checked_out_at;`,
    requiredTerms: ["poison_log", "suspects", "join", "where"],
    expectedRows: [
      { name: "Dr. Mira Solis", compound: "Digitalis", checked_out_at: "18:40" },
      { name: "Felix Hart", compound: "Digitalis", checked_out_at: "20:43" },
    ],
    evidence:
      "Digitalis left the cabinet twice. Dr. Solis checked it out hours earlier — plausible for a physician. Felix Hart pulled it just 29 minutes before the murder, listing a nightcap tonic as the reason. Two people, one poison, very different timings.",
  },
  {
    title: "Clue 3: Check the coverage",
    concept: "LEFT JOIN + IS NULL",
    brief:
      "The camera system covers most rooms — but not every corner. Find every suspect whose alibi is either unconfirmed by camera OR whose camera sighting contradicts their claimed location during the murder window (21:00–21:15). Show name, claimed_location, actual_location, and seen_at.",
    hint:
      "Start from alibis, JOIN suspects, then LEFT JOIN camera_log with both the suspect_id match AND the time window in the ON clause (not the WHERE clause). Then filter WHERE actual_location IS NULL OR claimed and actual locations differ.",
    tables: ["suspects", "alibis", "camera_log"],
    starterQuery: `SELECT s.name, a.claimed_location, c.actual_location, c.seen_at
FROM alibis AS a
JOIN suspects AS s ON s.id = a.suspect_id
LEFT JOIN camera_log AS c
  ON c.suspect_id = a.suspect_id
  AND c.seen_at BETWEEN '21:00' AND '21:15'
WHERE c.actual_location IS NULL
   OR a.claimed_location <> c.actual_location
ORDER BY s.name, c.seen_at;`,
    requiredTerms: ["left join", "alibis", "camera_log", "suspects", "is null"],
    expectedRows: [
      { name: "Felix Hart", claimed_location: "Pantry", actual_location: "Library Corridor", seen_at: "21:04" },
      { name: "Felix Hart", claimed_location: "Pantry", actual_location: "Service Stair", seen_at: "21:14" },
      { name: "Harriet Voss", claimed_location: "Drawing Room", actual_location: null, seen_at: null },
    ],
    evidence:
      "Felix lied twice — cameras caught him in the Library Corridor and on the Service Stair, nowhere near the Pantry he claimed. And Harriet Voss has no camera coverage at all during the murder window. Two suspects, two very different problems.",
  },
  {
    title: "Clue 4: Restore the ledger",
    concept: "UPDATE + WHERE",
    brief:
      "The IT manager flagged a post-mortem edit: at 21:47 — thirty-five minutes after Lord Blackwood died — someone logged into the estate database from the butler's terminal and cut Felix Hart's Bookmaker debt from £20,000 down to £6,000. The bookmaker has confirmed the true figure in writing. Correct the tampered record in the debts table.",
    hint:
      "Use UPDATE debts SET amount_due = 20000 WHERE ... to target only Felix Hart's Bookmaker row. Pin the WHERE clause to suspect_id 2 and creditor 'Bookmaker'.",
    tables: ["debts"],
    isDML: true,
    starterQuery: `UPDATE debts
SET amount_due = 20000
WHERE suspect_id = 2
  AND creditor = 'Bookmaker';`,
    validationQuery: `SELECT amount_due FROM debts WHERE suspect_id = 2 AND creditor = 'Bookmaker';`,
    requiredTerms: ["update", "debts", "set", "where"],
    expectedRows: [{ amount_due: 20000 }],
    evidence:
      "The ledger was altered from a terminal inside the manor — thirty-five minutes after Blackwood was already dead. Someone wanted Felix to look less desperate. The attempt only confirms that someone had every reason to be.",
  },
  {
    title: "Clue 5: Follow the debt",
    concept: "GROUP BY + HAVING",
    brief:
      "With the ledger restored, find every suspect with more than £15,000 due tonight. Show name and total_due, sorted highest to lowest.",
    hint:
      "Aggregate debts by suspect, filter due_tonight = true, then use HAVING on SUM(amount_due).",
    tables: ["suspects", "debts"],
    starterQuery: `SELECT s.name, SUM(d.amount_due) AS total_due
FROM debts AS d
JOIN suspects AS s ON s.id = d.suspect_id
WHERE d.due_tonight = true
GROUP BY s.name
HAVING SUM(d.amount_due) > 15000
ORDER BY total_due DESC;`,
    requiredTerms: ["debts", "suspects", "group by", "having", "sum"],
    expectedRows: [
      { name: "Felix Hart", total_due: 28000 },
      { name: "Owen Reed", total_due: 16000 },
    ],
    evidence:
      "Felix owed £28,000 tonight — nearly double Owen's figure. Bookmaker enforcers were expected at midnight. With Blackwood alive and threatening to dismiss him, he had no margin left and no way out.",
  },
  {
    title: "Clue 6: Name the killer",
    concept: "Subqueries",
    brief:
      "Every thread of the investigation is now in your hands. Write a query that identifies the single suspect who appears in all three filters: present in the Library Corridor during the murder window, checked out Digitalis after 20:00, and caught lying in their alibi. Use subqueries to assemble the case. Show only name.",
    hint:
      "Use three IN (SELECT ...) subqueries in the WHERE clause — one per condition. Each subquery is a standalone SELECT that returns matching suspect_ids from corridor_log, poison_log, and camera_log joined to alibis.",
    tables: ["suspects", "corridor_log", "poison_log", "camera_log"],
    starterQuery: `SELECT s.name
FROM suspects AS s
WHERE s.id IN (
    SELECT suspect_id FROM corridor_log
    WHERE location = 'Library Corridor'
      AND seen_at BETWEEN '21:00' AND '21:15'
  )
  AND s.id IN (
    SELECT suspect_id FROM poison_log
    WHERE compound = 'Digitalis'
      AND checked_out_at > '20:00'
  )
  AND s.id IN (
    SELECT p.suspect_id FROM camera_log AS p
    JOIN alibis AS a ON a.suspect_id = p.suspect_id
    WHERE p.seen_at BETWEEN '21:00' AND '21:15'
      AND a.claimed_location <> p.actual_location
  );`,
    requiredTerms: ["corridor_log", "poison_log", "camera_log", "where", "in"],
    expectedRows: [{ name: CORRECT_SUSPECT }],
    evidence:
      "Every subquery eliminates all other suspects. Only Felix Hart was in the corridor, had the late Digitalis checkout, and lied about his whereabouts. The case is made — one accusation remains.",
  },
];

const state = {
  activeChallengeIndex: 0,
  lastResult: null,
  lastQuery: "",
  remainingSeconds: GAME_DURATION_SECONDS,
  solvedCount: 0,
  intervalId: null,
  hintVisible: false,
  gameOver: false,
  completed: Array(CHALLENGES.length).fill(false),
  playerName: "",
  sessionResults: [],
  sessionRecorded: false,
  tamperFlagged: false,
};

const elements = {
  suspectGrid: document.querySelector("#suspect-grid"),
  timerDisplay: document.querySelector("#timer-display"),
  progressText: document.querySelector("#progress-text"),
  progressFill: document.querySelector("#progress-fill"),
  playerNameInput: document.querySelector("#player-name-input"),
  savePlayerButton: document.querySelector("#save-player-button"),
  playerStatus: document.querySelector("#player-status"),
  stageLabel: document.querySelector("#stage-label"),
  challengeTitle: document.querySelector("#challenge-title"),
  challengeBrief: document.querySelector("#challenge-brief"),
  challengeConcept: document.querySelector("#challenge-concept"),
  hintButton: document.querySelector("#hint-button"),
  hintText: document.querySelector("#hint-text"),
  schemaGrid: document.querySelector("#schema-grid"),
  queryInput: document.querySelector("#query-input"),
  runButton: document.querySelector("#run-button"),
  submitButton: document.querySelector("#submit-button"),
  resetButton: document.querySelector("#reset-button"),
  feedback: document.querySelector("#feedback"),
  resultMeta: document.querySelector("#result-meta"),
  resultTableWrap: document.querySelector("#result-table-wrap"),
  clueList: document.querySelector("#clue-list"),
  quickQueryGrid: document.querySelector("#quick-query-grid"),
  accusationPanel: document.querySelector("#accusation-panel"),
  suspectSelect: document.querySelector("#suspect-select"),
  motiveSelect: document.querySelector("#motive-select"),
  challengeWarningTag: document.querySelector("#challenge-warning-tag"),
  accuseButton: document.querySelector("#accuse-button"),
  overlay: document.querySelector("#overlay"),
  overlayKicker: document.querySelector("#overlay-kicker"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlayCopy: document.querySelector("#overlay-copy"),
  sessionStats: document.querySelector("#session-stats"),
  sessionStorageNote: document.querySelector("#session-storage-note"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  leaderboardEmpty: document.querySelector("#leaderboard-empty"),
  restartButton: document.querySelector("#restart-button"),
  timerCard: document.querySelector(".timer-card"),
  startOverlay: document.querySelector("#start-overlay"),
  startNameInput: document.querySelector("#start-name-input"),
  startNameError: document.querySelector("#start-name-error"),
  beginButton: document.querySelector("#begin-button"),
};

const storageState = {
  localAvailable: canUseLocalStorage(),
  volatilePlayerName: "",
  volatileResults: [],
};

function canUseLocalStorage() {
  try {
    const probeKey = "__blackwood_probe__";
    window.localStorage.setItem(probeKey, "ok");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch (error) {
    return false;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizePlayerName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, PLAYER_NAME_MAX_LENGTH);
}

function getActivePlayerName() {
  return state.playerName || "Anonymous Detective";
}

function loadStoredPlayerName() {
  if (!storageState.localAvailable) {
    return storageState.volatilePlayerName;
  }

  try {
    return sanitizePlayerName(window.localStorage.getItem(PLAYER_NAME_KEY) || "");
  } catch (error) {
    storageState.localAvailable = false;
    return storageState.volatilePlayerName;
  }
}

function persistPlayerName(name) {
  storageState.volatilePlayerName = name;

  if (!storageState.localAvailable) {
    return false;
  }

  try {
    if (name) {
      window.localStorage.setItem(PLAYER_NAME_KEY, name);
    } else {
      window.localStorage.removeItem(PLAYER_NAME_KEY);
    }
    return true;
  } catch (error) {
    storageState.localAvailable = false;
    return false;
  }
}

function sanitizeSessionRecord(record) {
  return {
    id:
      typeof record.id === "string" && record.id
        ? record.id
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerName: sanitizePlayerName(record.playerName || "") || "Anonymous Detective",
    didWin: Boolean(record.didWin),
    timeRemaining: Number.isFinite(record.timeRemaining) ? Math.max(0, record.timeRemaining) : 0,
    timeUsed: Number.isFinite(record.timeUsed)
      ? Math.max(0, record.timeUsed)
      : GAME_DURATION_SECONDS,
    solvedCount: Number.isFinite(record.solvedCount)
      ? Math.max(0, Math.min(CHALLENGES.length, record.solvedCount))
      : 0,
    completedAt:
      typeof record.completedAt === "number" && Number.isFinite(record.completedAt)
        ? record.completedAt
        : Date.now(),
  };
}

function loadStoredSessionResults() {
  if (!storageState.localAvailable) {
    return storageState.volatileResults.map(sanitizeSessionRecord);
  }

  try {
    const rawValue = window.localStorage.getItem(SESSION_RESULTS_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.slice(0, MAX_STORED_RESULTS).map(sanitizeSessionRecord);
  } catch (error) {
    storageState.localAvailable = false;
    return storageState.volatileResults.map(sanitizeSessionRecord);
  }
}

function persistSessionResults(results) {
  const cappedResults = results.slice(0, MAX_STORED_RESULTS).map(sanitizeSessionRecord);
  storageState.volatileResults = cappedResults;

  if (!storageState.localAvailable) {
    return false;
  }

  try {
    window.localStorage.setItem(SESSION_RESULTS_KEY, JSON.stringify(cappedResults));
    return true;
  } catch (error) {
    storageState.localAvailable = false;
    return false;
  }
}

function formatSessionTimestamp(timestamp) {
  return SESSION_TIME_FORMATTER.format(timestamp);
}

function sortLeaderboardResults(left, right) {
  if (right.timeRemaining !== left.timeRemaining) {
    return right.timeRemaining - left.timeRemaining;
  }

  if (left.timeUsed !== right.timeUsed) {
    return left.timeUsed - right.timeUsed;
  }

  if (right.completedAt !== left.completedAt) {
    return right.completedAt - left.completedAt;
  }

  return left.playerName.localeCompare(right.playerName);
}

function renderPlayerStatus(customMessage = "") {
  if (customMessage) {
    elements.playerStatus.textContent = customMessage;
    return;
  }

  if (state.playerName) {
    elements.playerStatus.textContent = storageState.localAvailable
      ? `Logged as ${state.playerName}. Scores and session logs stay in this browser.`
      : `Logged as ${state.playerName}. Storage fell back to this tab only.`;
    return;
  }

  elements.playerStatus.textContent = storageState.localAvailable
    ? "No saved detective name. Runs will log as Anonymous Detective in this browser."
    : "No saved detective name. Runs will log as Anonymous Detective for this tab only.";
}

function savePlayerProfile() {
  const playerName = sanitizePlayerName(elements.playerNameInput.value);
  state.playerName = playerName;
  elements.playerNameInput.value = playerName;
  const savedToLocalStorage = persistPlayerName(playerName);

  if (playerName) {
    renderPlayerStatus(
      savedToLocalStorage
        ? `Detective log saved for ${playerName}.`
        : `Detective log set to ${playerName}, but storage is available only for this tab.`,
    );
    return;
  }

  renderPlayerStatus(
    savedToLocalStorage
      ? "Saved detective name cleared. New runs will log as Anonymous Detective."
      : "Detective name cleared. Runs will log as Anonymous Detective for this tab only.",
  );
}

function createSessionRecord(didWin) {
  return sanitizeSessionRecord({
    id:
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    playerName: getActivePlayerName(),
    didWin,
    timeRemaining: state.remainingSeconds,
    timeUsed: GAME_DURATION_SECONDS - state.remainingSeconds,
    solvedCount: state.solvedCount,
    completedAt: Date.now(),
  });
}

function recordSessionResult(didWin) {
  const sessionRecord = createSessionRecord(didWin);
  state.sessionResults = [sessionRecord, ...state.sessionResults].slice(0, MAX_STORED_RESULTS);
  const savedToLocalStorage = persistSessionResults(state.sessionResults);

  return { savedToLocalStorage, sessionRecord };
}

function renderSessionSummary(sessionRecord, savedToLocalStorage) {
  elements.sessionStats.innerHTML = [
    ["Detective", sessionRecord.playerName],
    ["Result", sessionRecord.didWin ? "Escaped" : "Locked in"],
    ["Time remaining", formatTime(sessionRecord.timeRemaining)],
    ["Clues solved", `${sessionRecord.solvedCount} / ${CHALLENGES.length}`],
    ["Recorded", formatSessionTimestamp(sessionRecord.completedAt)],
  ]
    .map(
      ([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${escapeHtml(value)}</dd>
        </div>
      `,
    )
    .join("");

  elements.sessionStorageNote.textContent = savedToLocalStorage
    ? "This session was stored in the local leaderboard for this browser."
    : "Browser storage is unavailable. This session is available only until refresh.";
}

function renderLeaderboard(currentRecord) {
  const leaderboardResults = state.sessionResults
    .filter((record) => record.didWin)
    .sort(sortLeaderboardResults)
    .slice(0, MAX_LEADERBOARD_ENTRIES);

  elements.leaderboardList.innerHTML = leaderboardResults
    .map((record, index) => {
      const currentClass = record.id === currentRecord.id ? "leaderboard-entry is-current" : "leaderboard-entry";
      const scoreLabel = `${formatTime(record.timeRemaining)} left`;
      return `
        <li class="${currentClass}">
          <span class="leaderboard-rank">#${index + 1}</span>
          <div class="leaderboard-meta">
            <strong>${escapeHtml(record.playerName)}</strong>
            <span>${escapeHtml(formatSessionTimestamp(record.completedAt))}</span>
          </div>
          <div class="leaderboard-score">
            <strong>${escapeHtml(scoreLabel)}</strong>
            <span>${escapeHtml(`${record.solvedCount}/${CHALLENGES.length} clues`)}</span>
          </div>
        </li>
      `;
    })
    .join("");

  elements.leaderboardEmpty.hidden = leaderboardResults.length > 0;
}

function seedDatabase() {
  Object.keys(TABLE_SCHEMAS).forEach((tableName) => {
    alasql(`DROP TABLE IF EXISTS ${tableName}`);
    const columnSql = TABLE_SCHEMAS[tableName].join(", ");
    alasql(`CREATE TABLE ${tableName} (${columnSql})`);
    alasql.tables[tableName].data = CASE_DATA[tableName].map((row) => ({ ...row }));
  });

  // Seed honeypot tables — enticing column names, data that does nothing
  Object.keys(HONEYPOT_SCHEMAS).forEach((tableName) => {
    alasql(`DROP TABLE IF EXISTS ${tableName}`);
    const columnSql = HONEYPOT_SCHEMAS[tableName].join(", ");
    alasql(`CREATE TABLE ${tableName} (${columnSql})`);
    alasql.tables[tableName].data = HONEYPOT_DATA[tableName].map((row) => ({ ...row }));
  });
}

function renderSuspects() {
  elements.suspectGrid.innerHTML = CASE_DATA.suspects
    .map(
      (suspect) => `
        <article class="suspect-card">
          <p class="schema-label">${suspect.role}</p>
          <h3>${suspect.name}</h3>
          <p class="suspect-motive">${suspect.motive}</p>
          <p class="suspect-detail">${SUSPECT_DISPLAY[suspect.id] || ""}</p>
        </article>
      `,
    )
    .join("");
}

function renderQuickQueryButtons() {
  const tableNames = Object.keys(TABLE_SCHEMAS);
  elements.quickQueryGrid.innerHTML = tableNames
    .map(
      (tableName) =>
        `<button class="ghost-button quick-button" type="button" data-table="${tableName}">
          Peek ${tableName}
        </button>`,
    )
    .join("");

  elements.quickQueryGrid.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      const tableName = button.dataset.table;
      elements.queryInput.value = `SELECT * FROM ${tableName};`;
      elements.queryInput.focus();
    });
  });
}

function renderAccusationOptions() {
  elements.suspectSelect.innerHTML = CASE_DATA.suspects
    .map((suspect) => `<option value="${suspect.name}">${suspect.name}</option>`)
    .join("");

  const motives = CASE_DATA.suspects.map((suspect) => suspect.motive);
  elements.motiveSelect.innerHTML = motives
    .map((motive) => `<option value="${motive}">${motive}</option>`)
    .join("");
}

function renderClueList() {
  elements.clueList.innerHTML = CHALLENGES.map((challenge, index) => {
    const solved = state.completed[index];
    const itemClass = solved ? "clue-item solved" : "clue-item pending";
    const body = solved
      ? challenge.evidence
      : "Locked. Solve the current SQL clue to reveal this evidence.";

    return `
      <li class="${itemClass}">
        <strong>${challenge.title}</strong>
        <span>${body}</span>
      </li>
    `;
  }).join("");
}

function renderActiveChallenge(preserveQuery = false) {
  const challenge = CHALLENGES[state.activeChallengeIndex];
  elements.stageLabel.textContent = `Clue ${state.activeChallengeIndex + 1}`;
  elements.challengeTitle.textContent = challenge.title;
  elements.challengeBrief.textContent = challenge.brief;
  elements.challengeConcept.textContent = challenge.concept;
  elements.hintText.textContent = challenge.hint;
  elements.hintText.hidden = !state.hintVisible;
  elements.hintButton.textContent = state.hintVisible ? "Hide hint" : "Reveal hint";
  elements.challengeWarningTag.textContent = challenge.isDML
    ? "Your statement must use UPDATE, SET, and WHERE."
    : "Use the exact output columns requested.";
  elements.schemaGrid.innerHTML = challenge.tables
    .map(
      (tableName) => `
        <article class="schema-card">
          <h4>${tableName}</h4>
          <ul>
            ${TABLE_SCHEMAS[tableName]
              .map((columnName) => `<li>${columnName}</li>`)
              .join("")}
          </ul>
        </article>
      `,
    )
    .join("");

  if (!preserveQuery) {
    elements.queryInput.value = challenge.starterQuery;
  }
}

function updateProgress() {
  elements.progressText.textContent = `${state.solvedCount} / ${CHALLENGES.length} clues solved`;
  elements.progressFill.style.width = `${(state.solvedCount / CHALLENGES.length) * 100}%`;

  if (state.solvedCount === CHALLENGES.length) {
    elements.accusationPanel.classList.remove("is-locked");
  } else {
    elements.accusationPanel.classList.add("is-locked");
  }
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateTimerDisplay() {
  elements.timerDisplay.textContent = formatTime(state.remainingSeconds);
  elements.timerCard.classList.toggle("is-danger", state.remainingSeconds <= 180);
}

function showFeedback(message, variant) {
  elements.feedback.textContent = message;
  elements.feedback.className = "feedback";

  if (variant) {
    elements.feedback.classList.add(`is-${variant}`);
  }
}

function renderResultTable(result) {
  if (!Array.isArray(result) || result.length === 0) {
    elements.resultTableWrap.innerHTML = "<p>No rows returned.</p>";
    return;
  }

  const columns = Object.keys(result[0]);
  const headerHtml = columns.map((column) => `<th>${column}</th>`).join("");
  const bodyHtml = result
    .map(
      (row) => `
        <tr>
          ${columns.map((column) => `<td>${row[column]}</td>`).join("")}
        </tr>
      `,
    )
    .join("");

  elements.resultTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>${headerHtml}</tr>
      </thead>
      <tbody>${bodyHtml}</tbody>
    </table>
  `;
}

function normalizeRows(rows, canonicalKeys) {
  return rows.map((row) => {
    if (!canonicalKeys) return JSON.stringify(row);
    const normalized = {};
    for (const key of canonicalKeys) {
      normalized[key] = row[key] !== undefined ? row[key] : null;
    }
    return JSON.stringify(normalized);
  }).sort();
}

function queryIncludesRequiredTerms(query, requiredTerms) {
  const normalized = query.toLowerCase();
  return requiredTerms.every((term) => normalized.includes(term));
}

function checkHoneypotAccess(query) {
  const normalized = query.toLowerCase();
  return HONEYPOT_TABLE_NAMES.some((name) => normalized.includes(name));
}

function checkShadowTamper() {
  if (!shadowTimer.wallStartMs) return false;
  const wallElapsedSeconds = Math.floor((Date.now() - shadowTimer.wallStartMs) / 1000);
  const claimedElapsedSeconds = GAME_DURATION_SECONDS - state.remainingSeconds;
  // More than 10 seconds of claimed elapsed time shorter than wall time → clock was inflated
  return claimedElapsedSeconds < wallElapsedSeconds - 10;
}

async function submitSessionToSupabase(sessionRecord, tamperFlagged) {
  if (!supabaseClient) return;

  try {
    const { error } = await supabaseClient.from("game_sessions").insert({
      player_name: sessionRecord.playerName,
      did_win: sessionRecord.didWin,
      time_remaining: sessionRecord.timeRemaining,
      time_used: sessionRecord.timeUsed,
      solved_count: sessionRecord.solvedCount,
      completed_at: new Date(sessionRecord.completedAt).toISOString(),
      tamper_flagged: tamperFlagged,
    });

    if (error) {
      console.warn("Supabase insert error:", error.message);
    }
  } catch (err) {
    console.warn("Supabase submission failed:", err);
  }
}

function executeQuery() {
  const query = elements.queryInput.value.trim();

  if (!query) {
    showFeedback("The terminal is empty. Write a query first.", "error");
    return null;
  }

  try {
    const result = alasql(query);
    state.lastQuery = query;

    if (typeof result === "number") {
      // DML statement (INSERT / UPDATE / DELETE)
      state.lastResult = [];
      const challenge = CHALLENGES[state.activeChallengeIndex];
      if (challenge.validationQuery) {
        const verifyResult = alasql(challenge.validationQuery);
        state.lastResult = Array.isArray(verifyResult) ? verifyResult : [];
        renderResultTable(state.lastResult);
        elements.resultMeta.textContent = `${result} row(s) affected — current state shown below.`;
      } else {
        elements.resultTableWrap.innerHTML = "<p>Statement executed successfully.</p>";
        elements.resultMeta.textContent = `${result} row(s) affected.`;
      }
      showFeedback("Statement executed. Inspect the updated table and submit when ready.", "");
      return state.lastResult;
    }

    state.lastResult = Array.isArray(result) ? result : [];
    elements.resultMeta.textContent = `${state.lastResult.length} row(s) returned.`;
    renderResultTable(state.lastResult);

    // Honeypot check — flag and penalise if a restricted table was queried
    if (checkHoneypotAccess(query)) {
      state.tamperFlagged = true;
      applyPenalty(SUBMIT_PENALTY_SECONDS);
      showFeedback(
        "Restricted table accessed. This session has been flagged and a 45-second penalty applied.",
        "error",
      );
      return state.lastResult;
    }

    showFeedback("Query executed. Inspect the result and submit when it matches the clue.", "");
    return state.lastResult;
  } catch (error) {
    state.lastResult = null;
    elements.resultMeta.textContent = "Query failed.";
    elements.resultTableWrap.innerHTML = "";
    showFeedback(`SQL error: ${error.message}`, "error");
    return null;
  }
}

function applyPenalty(seconds) {
  state.remainingSeconds = Math.max(0, state.remainingSeconds - seconds);
  updateTimerDisplay();

  if (state.remainingSeconds === 0) {
    endGame(false, "The manor clock hit zero before the case was sealed.");
  }
}

function markChallengeSolved() {
  state.completed[state.activeChallengeIndex] = true;
  state.solvedCount += 1;
  showFeedback("Clue confirmed. The evidence board has been updated.", "success");
  renderClueList();
  updateProgress();

  if (state.activeChallengeIndex < CHALLENGES.length - 1) {
    state.activeChallengeIndex += 1;
    state.hintVisible = false;
    renderActiveChallenge();
    elements.resultMeta.textContent = "Next clue loaded. Run a query to continue.";
    elements.resultTableWrap.innerHTML = "";
  } else {
    showFeedback(
      "All six SQL clues are solved. Use the final accusation panel to close the case.",
      "success",
    );
  }
}

function validateDMLChallenge(challenge, query) {
  const termsMatch = queryIncludesRequiredTerms(query, challenge.requiredTerms);

  try {
    alasql(query);
    const verifyResult = alasql(challenge.validationQuery);
    const validationRows = Array.isArray(verifyResult) ? verifyResult : [];
    state.lastResult = validationRows;
    elements.resultMeta.textContent = `Validation: ${validationRows.length} row(s).`;
    renderResultTable(validationRows);

    const canonicalKeys = challenge.expectedRows.length > 0 ? Object.keys(challenge.expectedRows[0]) : null;
    const outputMatches =
      normalizeRows(validationRows, canonicalKeys).join("|") === normalizeRows(challenge.expectedRows, canonicalKeys).join("|");

    if (outputMatches && termsMatch) {
      markChallengeSolved();
      return;
    }

    applyPenalty(SUBMIT_PENALTY_SECONDS);
    showFeedback(
      "The update did not match expectations. Check your SET value, WHERE conditions, and required SQL terms. You lose 45 seconds.",
      "error",
    );
  } catch (error) {
    state.lastResult = null;
    elements.resultTableWrap.innerHTML = "";
    showFeedback(`SQL error: ${error.message}`, "error");
  }
}

function validateActiveChallenge() {
  if (state.gameOver) {
    return;
  }

  const challenge = CHALLENGES[state.activeChallengeIndex];
  const query = elements.queryInput.value.trim();

  if (!query) {
    showFeedback("The terminal is empty. Write a query first.", "error");
    return;
  }

  if (challenge.isDML) {
    validateDMLChallenge(challenge, query);
    return;
  }

  const result = executeQuery();

  if (!result) {
    return;
  }

  const canonicalKeys = challenge.expectedRows.length > 0 ? Object.keys(challenge.expectedRows[0]) : null;
  const outputMatches =
    normalizeRows(result, canonicalKeys).join("|") === normalizeRows(challenge.expectedRows, canonicalKeys).join("|");
  const termsMatch = queryIncludesRequiredTerms(elements.queryInput.value, challenge.requiredTerms);

  if (outputMatches && termsMatch) {
    markChallengeSolved();
    return;
  }

  applyPenalty(SUBMIT_PENALTY_SECONDS);
  showFeedback(
    "That evidence does not hold up. You lose 45 seconds. Check the requested columns, rows, and clue logic.",
    "error",
  );
}

function toggleHint() {
  state.hintVisible = !state.hintVisible;
  renderActiveChallenge(true);
}

function handleAccusation() {
  if (state.gameOver || state.solvedCount < CHALLENGES.length) {
    showFeedback("The final accusation stays locked until every SQL clue is solved.", "error");
    return;
  }

  const suspect = elements.suspectSelect.value;
  const motive = elements.motiveSelect.value;

  if (suspect === CORRECT_SUSPECT && motive === CORRECT_MOTIVE) {
    endGame(
      true,
      "Felix Hart poisoned the toast to settle his gambling debt before Blackwood cut him off for good.",
    );
    return;
  }

  applyPenalty(ACCUSATION_PENALTY_SECONDS);
  showFeedback("Wrong accusation. The room tightens and you lose 60 seconds.", "error");
}

function tickTimer() {
  if (state.gameOver) {
    return;
  }

  state.remainingSeconds -= 1;
  updateTimerDisplay();

  if (state.remainingSeconds <= 0) {
    endGame(false, "The staff destroy the records before you can make the arrest.");
  }
}

function endGame(didWin, message) {
  if (state.sessionRecorded) {
    return;
  }

  state.gameOver = true;
  state.sessionRecorded = true;
  window.clearInterval(state.intervalId);

  // Cross-check wall-clock time; flag if remainingSeconds was inflated
  if (checkShadowTamper()) {
    state.tamperFlagged = true;
  }

  const { savedToLocalStorage, sessionRecord } = recordSessionResult(didWin);
  submitSessionToSupabase(sessionRecord, state.tamperFlagged);
  elements.overlay.classList.remove("hidden");
  elements.overlayKicker.textContent = didWin ? "Case closed" : "Case failed";
  elements.overlayTitle.textContent = didWin ? "You escaped with the truth" : "The killer walks";
  elements.overlayCopy.textContent = message;
  renderSessionSummary(sessionRecord, savedToLocalStorage);
  renderLeaderboard(sessionRecord);
  elements.runButton.disabled = true;
  elements.submitButton.disabled = true;
  elements.resetButton.disabled = true;
  elements.accuseButton.disabled = true;
  elements.hintButton.disabled = true;
}

function restartGame() {
  seedDatabase();
  state.activeChallengeIndex = 0;
  state.lastResult = null;
  state.lastQuery = "";
  state.remainingSeconds = GAME_DURATION_SECONDS;
  state.solvedCount = 0;
  state.hintVisible = false;
  state.gameOver = false;
  state.completed = Array(CHALLENGES.length).fill(false);
  state.sessionRecorded = false;
  state.tamperFlagged = false;
  shadowTimer.wallStartMs = Date.now();
  elements.overlay.classList.add("hidden");
  elements.resultMeta.textContent = "Run a query to inspect the evidence tables.";
  elements.resultTableWrap.innerHTML = "";
  elements.runButton.disabled = false;
  elements.submitButton.disabled = false;
  elements.resetButton.disabled = false;
  elements.accuseButton.disabled = false;
  elements.hintButton.disabled = false;
  showFeedback("Clock reset. The case is live.", "");
  renderClueList();
  renderActiveChallenge();
  updateProgress();
  updateTimerDisplay();
  window.clearInterval(state.intervalId);
  state.intervalId = window.setInterval(tickTimer, 1000);
}

function startGame() {
  const name = sanitizePlayerName(elements.startNameInput.value);

  if (!name) {
    elements.startNameError.hidden = false;
    elements.startNameInput.focus();
    return;
  }

  elements.startNameError.hidden = true;
  state.playerName = name;
  elements.playerNameInput.value = name;
  persistPlayerName(name);
  renderPlayerStatus();
  elements.startOverlay.classList.add("hidden");
  shadowTimer.wallStartMs = Date.now();
  state.intervalId = window.setInterval(tickTimer, 1000);
}

function bindEvents() {
  elements.beginButton.addEventListener("click", startGame);
  elements.startNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      startGame();
    }
  });
  elements.runButton.addEventListener("click", executeQuery);
  elements.submitButton.addEventListener("click", validateActiveChallenge);
  elements.resetButton.addEventListener("click", () => {
    elements.queryInput.value = CHALLENGES[state.activeChallengeIndex].starterQuery;
    elements.queryInput.focus();
  });
  elements.savePlayerButton.addEventListener("click", savePlayerProfile);
  elements.playerNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      savePlayerProfile();
    }
  });
  elements.playerNameInput.addEventListener("blur", savePlayerProfile);
  elements.hintButton.addEventListener("click", toggleHint);
  elements.accuseButton.addEventListener("click", handleAccusation);
  elements.restartButton.addEventListener("click", restartGame);
}

function init() {
  state.playerName = loadStoredPlayerName();
  state.sessionResults = loadStoredSessionResults();
  elements.playerNameInput.value = state.playerName;
  // Pre-fill the start overlay with any saved name
  elements.startNameInput.value = state.playerName;
  seedDatabase();
  renderSuspects();
  renderQuickQueryButtons();
  renderAccusationOptions();
  renderClueList();
  renderActiveChallenge();
  updateProgress();
  updateTimerDisplay();
  renderPlayerStatus();
  bindEvents();
  showFeedback("Enter your detective name and click Begin Investigation to start.", "");
  // Timer does NOT start until startGame() is called
}

init();
