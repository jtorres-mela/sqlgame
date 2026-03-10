# Murder at Blackwood Manor

A self-contained SQL training game built as a murder mystery escape room. Players solve six SQL clues against a live in-browser database, race a 12-minute timer, and close the case with a final accusation. No backend required — everything runs in the browser.

## Quick start

The game is a static site, so all you need is a local file server.

**Option A — Node.js (recommended):**
```bash
npx serve .
```
Then open `http://localhost:3000`.

**Option B — Python:**
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

> Opening `index.html` directly as a `file://` URL will not work because the browser blocks local script imports. A file server is required.

## Project structure

```
sqlgame/
├── index.html          # Game UI
├── app.js              # All game logic, data, and SQL validation
├── styles.css          # Styling
├── config.js           # Your local credentials (gitignored — see below)
├── config.example.js   # Template to copy for config.js
├── vendor/
│   └── alasql.min.js   # Bundled SQL engine (no CDN needed)
└── README.md
```

## What SQL concepts the game teaches

| Clue | Concept |
|------|---------|
| 1 | `WHERE` + `ORDER BY` |
| 2 | `INNER JOIN` + filtering |
| 3 | `LEFT JOIN` + `IS NULL` |
| 4 | `UPDATE` + `WHERE` (DML) |
| 5 | `GROUP BY` + `HAVING` + `SUM` |
| 6 | Subqueries with `IN (SELECT ...)` |

## Supabase setup (optional)

The game works fully offline with no configuration. If you want completed sessions stored in the cloud, follow these steps.

### 1. Create a Supabase project

Sign up at [supabase.com](https://supabase.com) and create a new project.

### 2. Create the sessions table

In your Supabase dashboard, go to **SQL Editor** and run:

```sql
CREATE TABLE game_sessions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name    TEXT        NOT NULL,
  did_win        BOOLEAN     NOT NULL,
  time_remaining INTEGER     NOT NULL CHECK (time_remaining >= 0),
  time_used      INTEGER     NOT NULL CHECK (time_used >= 0),
  solved_count   INTEGER     NOT NULL CHECK (solved_count >= 0 AND solved_count <= 6),
  completed_at   TIMESTAMPTZ NOT NULL,
  tamper_flagged BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- Allow the game to insert sessions anonymously
CREATE POLICY "Allow anonymous inserts"
  ON game_sessions FOR INSERT TO anon WITH CHECK (true);

-- Allow reading sessions (e.g. for a future global leaderboard)
CREATE POLICY "Allow anonymous reads"
  ON game_sessions FOR SELECT TO anon USING (true);
```

### 3. Add your credentials

Copy the example config file and fill in your values:

```bash
cp config.example.js config.js
```

Then open `config.js` and replace the empty strings:

```js
const CONFIG = {
  SUPABASE_URL: "https://your-project-ref.supabase.co",
  SUPABASE_ANON_KEY: "your-anon-key",
};
```

Both values are on the **Project Settings → API** page of your Supabase dashboard.

`config.js` is listed in `.gitignore` and will never be committed. The anon key is safe to use in client-side code when RLS policies are in place.

### 4. What gets stored

Each completed game (win or loss) writes one row:

| Column | Description |
|--------|-------------|
| `player_name` | Detective name entered on the start screen |
| `did_win` | Whether the player named the correct killer |
| `time_remaining` | Seconds left on the clock |
| `time_used` | Seconds elapsed |
| `solved_count` | Number of SQL clues solved (0–6) |
| `completed_at` | Client timestamp of game end |
| `tamper_flagged` | `true` if cheating was detected |

## How validation works

- Each clue specifies required SQL keywords and an expected result set. Both must match to advance.
- The UPDATE clue (Clue 4) runs a validation `SELECT` after the statement executes to verify the database state.
- Column order and row order do not matter — results are normalised before comparison.

## Anti-cheat features

- **Honeypot tables** — `time_controls` and `session_tokens` exist in the in-browser database but are never part of any clue. Querying either triggers a 45-second penalty and sets `tamper_flagged = true`.
- **Shadow timer** — the wall-clock start time is recorded independently of the countdown. On game end, the two are compared. A discrepancy of more than 10 seconds sets `tamper_flagged = true`.

## Local leaderboard

Session results are saved to `localStorage` and persist across page refreshes. The top 5 winning sessions by time remaining are shown on the end screen, regardless of whether Supabase is configured.
