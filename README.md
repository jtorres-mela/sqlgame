# Murder at Blackwood Manor

A self-contained SQL training page built as a murder mystery escape room. Players solve six staged SQL clues (including one UPDATE) against a live in-browser database, race a 12-minute timer, and finish with a final accusation.

## Run locally

Start any static file server from this directory. For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## What is included

- Real client-side SQL queries powered by a local `alasql` build in `vendor/alasql.min.js`
- Six clue stages: WHERE/ORDER BY, JOIN, inequality filter, UPDATE, GROUP BY/HAVING, and multi-table reasoning
- A countdown timer with penalties for incorrect submissions or accusations
- A required detective name gate before the clock starts
- Shadow-timer tamper detection and honeypot tables that flag suspicious sessions
- Automatic session recording on win or loss, plus a top-5 leaderboard by time remaining
- Optional Supabase cloud storage for sessions (see setup below)
- Responsive styling and a final accusation flow

## Supabase setup (optional)

If left unconfigured the game works entirely offline. To enable cloud session storage:

### 1. Create the table

Run this SQL in your Supabase project's SQL editor:

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

### 2. Add your credentials

Open `app.js` and fill in the two constants at the top of the file:

```js
const SUPABASE_URL = "https://your-project-ref.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";
```

Both values are on the **Project Settings → API** page of your Supabase dashboard. The anon key is safe to expose in client-side code when RLS is enabled.

### 3. What gets stored

Each completed session writes one row:

| column | description |
|---|---|
| `player_name` | Detective name entered on the start screen |
| `did_win` | Whether the player named the correct killer |
| `time_remaining` | Seconds left on the clock |
| `time_used` | Seconds elapsed |
| `solved_count` | Number of SQL clues solved |
| `completed_at` | Client timestamp of game end |
| `tamper_flagged` | `true` if honeypot access or clock manipulation was detected |

## Notes

- The validation expects the exact output columns and SQL terms described in each clue.
- Session logs and the local leaderboard are stored in `localStorage` and persist per browser regardless of Supabase.
- The honeypot tables (`time_controls`, `session_tokens`) exist in the in-browser database but are never part of any clue. Querying them triggers a 45-second penalty and sets `tamper_flagged`.
- The shadow timer cross-checks wall-clock elapsed time against `state.remainingSeconds` on game end. A discrepancy of more than 10 seconds also sets `tamper_flagged`.
