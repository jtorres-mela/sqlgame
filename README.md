# Murder at Blackwood Manor

A self-contained SQL training page built as a murder mystery escape room. Players solve five staged SQL clues against a live in-browser database, race a 12 minute timer, and finish with a final accusation.

## Run locally

From `/Users/jeffrytorres/sql`, start any static file server. For example:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## What is included

- Real client-side SQL queries powered by a local `alasql` build in [`vendor/alasql.min.js`](/Users/jeffrytorres/sql/vendor/alasql.min.js)
- Five clue stages covering filtering, joins, inequality checks, grouping, and multi-table reasoning
- A countdown timer with penalties for incorrect submissions or accusations
- A simple detective log with browser-local alias storage
- Automatic session recording on win or loss, plus a top-5 high score leaderboard by time remaining
- Responsive styling and a final accusation flow

## Notes

- The validation expects the output columns described in each clue.
- Session logs and leaderboard entries are stored in `localStorage`, so they persist per browser on the same machine.
- The page is still fully static; there is no backend or shared multi-user persistence layer.
