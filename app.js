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
  ],
  camera_log: [
    { suspect_id: 1, actual_location: "Ballroom", seen_at: "21:11" },
    { suspect_id: 2, actual_location: "Library Corridor", seen_at: "21:04" },
    { suspect_id: 2, actual_location: "Service Stair", seen_at: "21:14" },
    { suspect_id: 3, actual_location: "Infirmary", seen_at: "21:09" },
    { suspect_id: 4, actual_location: "Garage", seen_at: "21:08" },
  ],
  debts: [
    { suspect_id: 2, creditor: "Bookmaker", amount_due: 12000, due_tonight: true },
    { suspect_id: 2, creditor: "Bookmaker", amount_due: 6000, due_tonight: true },
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
      "Only Felix Hart and Dr. Mira Solis were near the library during the murder window.",
  },
  {
    title: "Clue 2: Trace the poison",
    concept: "INNER JOIN + filtering",
    brief:
      "The toxicology report says digitalis was used. Find everyone who checked out Digitalis. Show name, compound, and checked_out_at.",
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
      "Digitalis left the apothecary twice, but Felix checked it out only 29 minutes before the murder.",
  },
  {
    title: "Clue 3: Break the alibi",
    concept: "JOIN + inequality filter",
    brief:
      "Find the suspect whose alibi conflicts with the camera feed around 21:10. Show name, claimed_location, actual_location, and seen_at.",
    hint:
      "Join alibis to camera_log on suspect_id and filter where the claimed and actual locations are different during the murder window.",
    tables: ["suspects", "alibis", "camera_log"],
    starterQuery: `SELECT s.name, a.claimed_location, c.actual_location, c.seen_at
FROM alibis AS a
JOIN camera_log AS c ON c.suspect_id = a.suspect_id
JOIN suspects AS s ON s.id = a.suspect_id
WHERE c.seen_at BETWEEN '21:00' AND '21:15'
  AND a.claimed_location <> c.actual_location
ORDER BY c.seen_at;`,
    requiredTerms: ["alibis", "camera_log", "suspects", "join", "where"],
    expectedRows: [
      {
        name: "Felix Hart",
        claimed_location: "Pantry",
        actual_location: "Library Corridor",
        seen_at: "21:04",
      },
      {
        name: "Felix Hart",
        claimed_location: "Pantry",
        actual_location: "Service Stair",
        seen_at: "21:14",
      },
    ],
    evidence:
      "Felix lied outright. His pantry alibi collapses under the camera feed.",
  },
  {
    title: "Clue 4: Follow the debt",
    concept: "GROUP BY + HAVING",
    brief:
      "Find suspects with more than 15000 due tonight. Show name and total_due, sorted from highest to lowest.",
    hint:
      "Aggregate debts by suspect, filter due_tonight, then use HAVING on SUM(amount_due).",
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
      { name: "Felix Hart", total_due: 18000 },
      { name: "Owen Reed", total_due: 16000 },
    ],
    evidence:
      "Owen had motive, but Felix was under even sharper pressure and already tied to the poison and the corridor.",
  },
  {
    title: "Clue 5: Name the killer",
    concept: "Multi-table reasoning",
    brief:
      "Return the name of the only suspect who was near the library, checked out Digitalis after 20:00, and lied in their alibi. Show only name.",
    hint:
      "Join suspects to corridor_log, poison_log, alibis, and camera_log. Filter for Digitalis, the late checkout, the corridor location, and mismatched alibis.",
    tables: ["suspects", "corridor_log", "poison_log", "alibis", "camera_log"],
    starterQuery: `SELECT DISTINCT s.name
FROM suspects AS s
JOIN corridor_log AS cl ON cl.suspect_id = s.id
JOIN poison_log AS p ON p.suspect_id = s.id
JOIN alibis AS a ON a.suspect_id = s.id
JOIN camera_log AS c ON c.suspect_id = s.id
WHERE cl.location = 'Library Corridor'
  AND cl.seen_at BETWEEN '21:00' AND '21:15'
  AND p.compound = 'Digitalis'
  AND p.checked_out_at > '20:00'
  AND a.claimed_location <> c.actual_location;`,
    requiredTerms: ["corridor_log", "poison_log", "alibis", "camera_log", "distinct"],
    expectedRows: [{ name: CORRECT_SUSPECT }],
    evidence:
      "The full case converges on Felix Hart. One accusation remains: prove the motive and seal the room.",
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
    const columnSql = TABLE_SCHEMAS[tableName]
      .map((columnName) => `${columnName}`)
      .join(", ");
    alasql(`CREATE TABLE ${tableName} (${columnSql})`);
    alasql.tables[tableName].data = CASE_DATA[tableName].map((row) => ({ ...row }));
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

function normalizeRows(rows) {
  return rows.map((row) => JSON.stringify(row)).sort();
}

function queryIncludesRequiredTerms(query, requiredTerms) {
  const normalized = query.toLowerCase();
  return requiredTerms.every((term) => normalized.includes(term));
}

function executeQuery() {
  const query = elements.queryInput.value.trim();

  if (!query) {
    showFeedback("The terminal is empty. Write a query first.", "error");
    return null;
  }

  try {
    const result = alasql(query);
    state.lastResult = Array.isArray(result) ? result : [];
    state.lastQuery = query;
    elements.resultMeta.textContent = `${state.lastResult.length} row(s) returned.`;
    renderResultTable(state.lastResult);
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

function validateActiveChallenge() {
  if (state.gameOver) {
    return;
  }

  const challenge = CHALLENGES[state.activeChallengeIndex];
  const result = executeQuery();

  if (!result) {
    return;
  }

  const outputMatches =
    normalizeRows(result).join("|") === normalizeRows(challenge.expectedRows).join("|");
  const termsMatch = queryIncludesRequiredTerms(elements.queryInput.value, challenge.requiredTerms);

  if (outputMatches && termsMatch) {
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
        "All five SQL clues are solved. Use the final accusation panel to close the case.",
        "success",
      );
    }

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
  const { savedToLocalStorage, sessionRecord } = recordSessionResult(didWin);
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

function bindEvents() {
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
  showFeedback("Run the starter query or inspect the tables with Quick peek.", "");
  state.intervalId = window.setInterval(tickTimer, 1000);
}

init();
