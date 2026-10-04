# MCS Dynasty

A commissioner-style **men's college softball** dynasty. It's fictional, but it's built to feel like the real NCAA game: 7-inning line scores, weekend series, the RPI, a Top 25 poll, conference tournaments, regionals and a Men's College World Series. You have the final say on every result.

It is a static site with no build step and no server, so it runs on GitHub Pages as-is. It looks and works like the [CFB Commissioner](https://github.com/b1rdsarenotreal/cfb-dynasty) app.

## The league

The dynasty starts in **2016** with 45 teams in six conferences: Big 12, Big Ten, Big West, Horizon, MAC and Sun Belt. Every team uses its school's real colors. Teams, conferences, colors, logos and ratings can all be changed in the app.

## Ratings

Every team has three ratings from 40 to 99:

| Rating | What it covers |
|---|---|
| **OFF** | Hitting: contact, power, plate discipline |
| **PIT** | The pitching staff |
| **DEF** | Fielding: errors and turning batted balls into outs |

**OVR = 40% OFF + 40% PIT + 20% DEF.** Starting ratings are guesses you can edit on the Teams page or a team's profile.

## The box score simulator

Simulated games play out every plate appearance. Hitting (OFF) faces pitching (PIT) and fielding (DEF), and each plate appearance ends in a strikeout, walk, hit-by-pitch, single, double, triple, home run, error or out. Runners advance, double plays happen and sacrifice flies score runs.

- **NCAA rules:** 7 innings, the home team skips its last at-bat when already ahead, walk-offs, the **8-run rule after 5 innings**, and extra innings starting with a **runner on second** from the 8th inning. Both rules can be turned off in Settings.
- **Pitching staffs:** each team has four pitchers: Friday, Saturday and Sunday starters plus a midweek arm who also relieves. Starters get pulled when they tire or get hit hard. Each sim records pitching lines and the **winning, losing and saving pitchers**. Pitcher names can be edited on the team page.
- **Results:** a full line score (runs by inning, R/H/E). Teams average about 4 runs, 7 hits and 1 error a game. A team 10 points better wins about 73% of the time, and one 20 points better about 88%. Settings has an **Upsets** option (Fewer, Realistic, More, Chaos).
- **Simulations are suggestions:** in the game editor you can simulate, change anything, and then save. You can also type in a line score by hand.

## The season

- **Schedule:** 14 weeks and 52–55 games per team. Weeks 1–4 are non-conference weekend series. Weeks 5–14 are a conference round robin of three-game series (Friday, Saturday, Sunday). Every week from week 2 also has a Tuesday midweek game.
- **Standings:** conference record first, then head-to-head, then RPI. You can override any regular-season champion.
- **RPI:** 25% winning percentage, 50% opponents' winning percentage (not counting games against the team) and 25% opponents' opponents' winning percentage.
- **Top 25 poll:** 40 simulated voters release a poll each week, starting with a preseason poll. Early in the season they lean on OVR, and later on record and RPI. They remember last week's poll, so teams move the way real polls do. Each poll shows points, first-place votes and others receiving votes. You can edit or regenerate any poll.

## The postseason

The field is smaller than the real NCAA's 64 teams, so the format is scaled down:

1. **Conference tournaments (week 15):** single elimination. Conferences with 9 or more teams take their top 6, and the rest take their top 4. You can change the size on the Standings page or edit seeds before a tournament starts. The champion gets the automatic bid.
2. **Selection:** a **16-team field**, with one automatic bid per conference and at-large picks by the committee: **RPI rank 60%, poll rank 40%**. The field is seeded 1–16. You can swap teams or move seeds before announcing it, and the page shows the last four in and first four out.
3. **Regionals (week 16):** four 4-team **double-elimination** regionals hosted by the top four seeds, built serpentine (1-8-9-16, 2-7-10-15 and so on). There's a Game 7 if necessary.
4. **Men's College World Series (week 17):** the four regional champions play double elimination down to two teams, then a **best-of-three Championship Series**. You can rename the championship in Settings.

The final poll comes out after the championship, with the national champion at #1.

## Between seasons

**Settings → Start the next season** carries over teams, conferences and settings. Ratings drift toward average with some random growth, and about a third of pitchers graduate. You can choose how big those changes are, or turn them off. The final poll seeds the next preseason poll.

## Commissioner controls

| Want to… | Where |
|---|---|
| Enter or change a score | Click the game (Schedule, Postseason, team page) |
| Pick a game's starting pitchers | Game editor → starter dropdowns |
| Change ratings | Teams page, or the team's profile |
| Add a team | Teams → + Add team |
| Rename a team, change colors, logo or conference | Team profile → Commissioner edits |
| Add or rename a conference, set its logo | Conferences |
| Add a game | Schedule → + Add game |
| Override a conference champion or tournament size | Standings → Commissioner |
| Edit tournament seeds | Postseason → Conference tournaments |
| Change the NCAA field or seeds | Postseason → Selection |
| Edit a poll | Rankings → Edit poll |
| New schedule (before any games) | Settings → Rebuild schedule |

## Logos

Logos come from [this college logo list](https://gist.github.com/saiemgilani/c6596f0e1c8b148daabc2b7f1e6f6add), which points to ESPN's images, and are cached in your browser. Schools it doesn't cover, mostly ones without football, show a badge in their colors with their abbreviation. You can give any team or conference its own logo by pasting an image link or uploading a file on its page.

## Run it on GitHub Pages

1. Put these files in the repository's `main` branch, keeping the folders (`index.html`, `css/`, `js/`, `.nojekyll`).
2. Go to **Settings → Pages**, set **Source** to *Deploy from a branch*, and choose `main` and `/ (root)`.
3. After a minute, the site is live at `https://<your-username>.github.io/<repo-name>/`.

To run it locally, serve the folder with any static server. Opening `index.html` straight from disk won't work.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Where your data lives

The dynasty is saved in your browser (IndexedDB). **Settings → Download backup** saves the whole league as a JSON file, and **Restore backup** loads one, which is also how you move to another device.

## Project layout

```
index.html              app shell
css/styles.css          styles (light and dark)
js/app.js               loading, top bar, routing
js/ui.js                shared pieces: team labels, logos, game cards, game editor
js/views-season.js      home, schedule, standings, rankings, postseason pages
js/views-league.js      teams, team profiles, conferences, history, settings
js/data.js              the 2016 teams and conferences, colors, starting ratings
js/sim.js               plate-appearance game simulator and win probability
js/schedule.js          schedule generator
js/standings.js         records, standings, tiebreakers, RPI
js/polls.js             generated Top 25 poll
js/postseason.js        conference tournaments, selection, regionals, MCWS
js/league.js            league lifecycle, editing, simulation, new seasons
js/store.js             saving and backups
js/logos.js             logo list loading and lookup
tests/                  logic test (Node) and UI test (Playwright)
```

Run the tests with `node tests/logic.test.mjs` and `python3 tests/ui_test.py`. The UI test needs `pip install playwright` and `playwright install chromium`.
