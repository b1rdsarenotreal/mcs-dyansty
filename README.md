# MCS Dynasty

A commissioner-style **men's college softball** dynasty. It's fictional, but it's built to feel like the real NCAA game: 7-inning line scores, weekend series, the RPI, a Top 15 poll, conference tournaments, regionals and a Men's College World Series. You have the final say on every result.

It is a static site with no build step and no server, so it runs on GitHub Pages as-is. It looks and works like the [CFB Commissioner](https://github.com/b1rdsarenotreal/cfb-dynasty) app.

## The league

The dynasty starts in **2016** with 45 teams in six conferences: Big 12, Big Ten, Big West, Horizon, MAC and Sun Belt. Every team uses its school's real colors and has a head coach. Teams, coaches, conferences, colors, logos and ratings can all be changed in the app.

## Ratings

Every team has three ratings from 40 to 99:

| Rating | What it covers |
|---|---|
| **OFF** | Hitting: contact, power, plate discipline |
| **PIT** | Pitching |
| **DEF** | Fielding: errors and turning batted balls into outs |

**OVR = 40% OFF + 40% PIT + 20% DEF.** Starting ratings are guesses you can edit on the Teams page or a team's profile.

**Ratings move during the season.** Every result counts: beating a better team raises a team's ratings, and losing to a weaker one lowers them. The part of the game that decided it gets most of the change. Scoring a lot moves OFF, holding the other team down moves PIT, and clean fielding moves DEF. A team can move at most 10 points from its preseason rating in any category. Team pages show the change since the preseason. Settings lets you choose how much ratings move, or turn it off. Because ratings are recalculated from all results in order, editing or clearing a result keeps everything consistent.

## The box score simulator

Simulated games play out every plate appearance. Hitting (OFF) faces pitching (PIT) and fielding (DEF), and each plate appearance ends in a strikeout, walk, hit-by-pitch, single, double, triple, home run, error or out. Runners advance, double plays happen and sacrifice flies score runs.

- **NCAA rules:** 7 innings, the home team skips its last at-bat when already ahead, walk-offs, the **8-run rule after 5 innings**, and extra innings starting with a **runner on second** from the 8th inning. Both rules can be turned off in Settings.
- **Results:** a full line score: runs by inning plus R/H/E. Teams average about 4 runs, 7 hits and 1 error a game. A team 10 points better wins about 78% of the time, and one 20 points better about 93% (on "Fewer" upsets: about 82% and 96%). Settings has an **Upsets** option (Fewer, Realistic, More, Chaos).
- **Series tally:** each weekend game shows where its series stands in the box's top corner, for example "Wisconsin leads series 1-0", "Series tied 1-1" or "Ohio State wins series 3-0". Games not yet played show the standing going in. The MCWS Championship Series works the same way. Long school names switch to their abbreviation so the score always fits.
- **Fast score entry:** in the game editor, Tab moves through the line score in game order: top of the 1st, bottom of the 1st, top of the 2nd, and so on. After the last inning it goes to hits and errors, and Shift+Tab goes back. Each box's number is selected when you land on it, so typing replaces it.
- **Simulations are suggestions:** in the game editor you can simulate, change anything, and then save. You can also type in a line score by hand.
- **Hits and errors for hand-entered scores:** leave the H and E boxes blank and they're filled in when you save, based on the line score and both teams' ratings. Each half inning is replayed from the ratings until it produces exactly the runs you entered, so a 6-run inning comes with a believable number of hits, and a team that's bad in the field makes more errors. **Estimate H & E** fills them in early so you can adjust them, and anything you type yourself is kept. If you change the runs after an estimate, the estimate is cleared and redone. Settings → Simulation can also fill in hand-entered games saved earlier with 0 hits and 0 errors.

## The season

- **Schedule:** a new one is built every season, **12 weeks** by default (Settings → Schedule format). Weekends are three-game series. From **week 4** through the next-to-last week (the last week before conference tournaments has no midweek games), each team also plays a **two-game midweek set** against one opponent: a **Tuesday doubleheader** or a **Tuesday and Wednesday** pair (Settings can pick one or mix both). Conference play fills the last weeks, and **a conference's size sets when it starts**: one week per round of its round robin (a 6-team conference plays 5 weeks, an 8-team conference 7, a 10-team conference 9), all finishing on the final weekend. **No conference plays more than 9 weeks**, so a conference of 11 or more teams plays 9 of its members each season (which ones changes every year) and a team never plays a non-conference weekend series once its conference season has begun. Conference rivals never meet outside conference play. A team with a **conference bye** (odd-sized conferences) plays a **single Thursday game** against another conference instead. Conference opponents who met the year before **swap home and away**. That's about **48–52 games per team**. The start week and the rest week are settings too. A season keeps the length it was scheduled with, so changing the setting affects the next schedule.
- **Standings:** ordered by conference winning percentage. Ties are broken in this order, and the same order seeds the conference tournaments:
  1. Head-to-head among all the tied teams. If that separates some teams but leaves others still tied, those teams start over with head-to-head among just themselves.
  2. Winning percentage against common conference opponents, starting with the highest-placed opponent and working down (opponents tied with each other count together). Teams still tied after a split go back to head-to-head.
  3. RPI.
  4. Coin flip (fixed for the season, so it doesn't change on reload).
  
  The Standings page lists these in a collapsible Tiebreakers box. Teams tied for the best conference record **share the regular-season title** (co-champions on team, coach and conference pages); the tiebreakers still decide the tournament's top seed and, with no tournament, the automatic bid. You can override the regular-season champion to name a single one.
- **RPI:** 25% winning percentage, 50% opponents' winning percentage (not counting games against the team) and 25% opponents' opponents' winning percentage.
- **Rankings page:** the Top 15 poll (with a **Dropped out** list showing who fell out, their old rank and that week's record), the RPI, **strength of schedule** and power ratings. Strength of schedule is ⅔ opponents' winning percentage plus ⅓ opponents' opponents', with each team's opponents' combined record.
- **Top 15 poll** (Settings → Poll size can make it a Top 10, 20 or 25): a fixed panel of **23 voters** (fictional writers and outlets) fills out ballots every week, starting with a preseason poll. Every voter starts from the same picture, built like the CFB dynasty's poll: **team strength** (power ratings worked out from every game's score, starting from the teams' OFF/PIT/DEF ratings) blended with a **season-long résumé** (every win counts, more against a strong opponent; every loss costs, less against a strong opponent). Strength carries most of the weight early; the résumé takes over as games are played. Losses weigh as much as wins: losing a series never helps a résumé. Voters also remember last week's poll a little, and two rules always hold: **a ranked team that loses more games than it wins in a week never moves up**, and **a ranked team that wins every game it plays in a week never drops**. Each then leans a little by personality. Some trust talent and are slow to move teams, some go by the numbers or schedule strength, some react to last week or punish bad losses, and a few regional voters give the conference they cover a small boost. The leans are small, so the poll stays close to a consensus. Personalities are built in and can't be edited. The Rankings page lists the voters, each one's #1 vote, and any voter's full ballot next to the poll. Each poll shows points and first-place votes, and you can edit or regenerate any poll.
- **Ranks at game time:** played games on the Schedule and team pages show each team's rank from the poll in effect when the game was played. Week 1 games use the preseason poll. Games not yet played show the latest poll and each team's current record, with the conference record in parentheses for conference games (for example **22-3 (3-0)**).

## The postseason

The NCAA tournament's shape is set in **Settings → NCAA tournament**, so it can change without touching the code:

- **Regionals:** how many, and how many teams in each. Two-team regionals are a best-of-three series. Three to six teams play double elimination with an "if necessary" final; four is the classic NCAA format: Friday Games 1 and 2, Saturday Games 3, 4 and 5, Sunday the regional final and, if needed, a second final. The top national seeds host, and the field is placed serpentine (with 4 regionals: 1-8-9-16, 2-7-10-15 and so on).
- **Qualifiers:** regionals × teams per regional. Each conference champion gets an automatic bid and the committee picks the rest.
- **Super regionals:** used when there are twice as many regionals as MCWS spots. Two regional champions play a best-of-three series at the higher seed (the 1 seed's regional meets the last host's).
- **Men's College World Series:** **4 teams** play double elimination down to two, then a best-of-three Championship Series. **8 teams** split into **Bracket A** (paths 1, 4, 5, 8) and **Bracket B** (2, 3, 6, 7), each a four-team double elimination with an "if necessary" bracket final. The two bracket winners then play a **best-of-three final**, as in today's baseball and softball World Series.

The editor checks that the format works: the MCWS needs as many regionals as teams, or twice as many with super regionals, and the field can't be bigger than the league. A new format applies to the current season's tournament if its field hasn't been announced, and otherwise starts the next season. Once the field is announced, that season's format is locked in.

The default is a 16-team field in four 4-team regionals and a 4-team MCWS. Each stage runs in the week after the last:

1. **Conference tournaments:** each conference picks **single or double elimination** and how many teams make it. By default, conferences with 9 or more teams take their top 6 and the rest take their top 4. Both are set on the Standings page. You can also switch a tournament's format or edit its seeds on the Postseason page until its first game. Double elimination has a winners bracket and an elimination bracket. The two bracket winners then meet in **one championship game, with no "if necessary" game**. The champion gets the automatic bid.
2. **Selection:** three panels side by side.
   - **Left:** the **automatic qualifiers** (with how they got the bid), then the **at-large board**: every at-large spot plus the next 10 teams, in committee order (RPI rank 50%, poll rank 30%, strength-of-schedule rank 20%). A line marks the committee's cut, and last four in / first four out are tagged. Each row shows record, RPI, SOS, poll and **quadrant records (Q1–Q4)**. Check and uncheck teams to pick the at-large field, then **Confirm** the teams.
   - **Middle:** once confirmed, order **seeds 1–16** (or the field size) with the arrows. The top seeds host. "Change teams" goes back to picking.
   - **Right:** the **regional preview** (teams, conferences, national seed and RPI rank, average OVR) updates as you move seeds and flags conference rivals in the same regional. Then announce the field.
   - **Quadrants:** every team is placed in Q1–Q4 by RPI rank (Q1 is the top quarter), and Q1–Q4 are its record against each quadrant. They're also on Rankings → RPI.
- **Conference tournament hosts:** every conference tournament is played at one of the conference's schools, picked at random each season (never last year's host when there's another choice). Change it on Postseason → Conference tournaments any time before the tournament ends; games already played stay where they were. Hosting doesn't change the bracket: the host plays its games at home, every other game is at the host's site, and a host that doesn't qualify still hosts.
- **Bracket cards** show each team's seed (in parentheses) and poll ranking right before its name. Conference tournaments show every seed and the poll ranking; NCAA games show only the regional hosts' seeds (no poll rankings, so the only numbers are the host seeds). Played games use the ranking from that week's poll.
- **Participants tab** (between the regionals/super regionals and the MCWS): the MCWS field as it fills in, with each team's record entering the MCWS (conference record in parentheses), head coach, the regional or super regional it won, previous MCWS appearances (and the last one), best MCWS finish (with the years) and all-time MCWS win–loss record. History counts seasons in this dynasty. Places: champion 1st, runner-up 2nd, then by the round a team went out (ties like T-3rd in an 8-team MCWS).
- **Postseason scoreboard:** on the Schedule page each postseason day mixes the tournaments together like a real scoreboard. Each event's games stay in order.
3. **Regionals**, then **Super Regionals** if the format has them.
4. **Men's College World Series**: opening games Friday, Game 4 Saturday, Games 3 and 5 Sunday, and the bracket finals Monday (both brackets in the 8-team format, which adds an **MCWS Finals** week for the Championship Series). In the 4-team format the Championship Series is Monday through Wednesday.

The final poll comes out after the championship, with the national champion at #1.

The Postseason page draws each event as a real bracket. Rounds are columns, each game sits between the two games that feed it, and lines join them. Double elimination shows the winners bracket on top and the elimination bracket underneath. Each card shows runs, hits and errors. Click a game, or open the Schedule page, for the full inning-by-inning line score.

## The offseason

Once the national champion is crowned, an **Offseason** page opens. Next season's teams are set up there before any games are scheduled:

- **Realign conferences:** move any team with its Conference menu. Moved teams are marked.
- **Add teams:** each new team gets a full schedule in the new season.
- **Add conferences** or delete empty ones.
- **Remove teams** from the dynasty. Their history stays, and you can bring them back before the season starts.
- **Coaching changes:** pick each program's coach from a list of available coaches, coaches at other programs, or a new hire. Hiring another program's coach leaves that job open, and the page flags open jobs until they're filled.
- **Update ratings.** Ratings have already moved for the new year, shown as +/−. Settings controls how big those changes are, or turns them off.

**Start the season** builds the new schedule from the new alignment. The final poll seeds the next preseason poll.

## Coaches

Coaches are people in the dynasty, not just names on a team. Each coach has a **profile page** with his career record, titles, a season-by-season table across every program he has led, and a way to hire him if he's available. The **Coaches** page lists every coach with his current program, seasons, record, conference tournament titles, NCAA trips, MCWS trips, national titles and career path. Coaches without a job stay on the list as available, so another program can hire them later. You can add or rename coaches there.

## Conference and team history

- **Conference pages** show the conference's all-time record against other conferences (and against each one), NCAA bids and national titles, then a full-width **Champions by season** table: regular-season champions with their conference records (shared titles listed together), the tournament champion, format and host, the conference's record against other conferences that year, NCAA bids, NCAA win–loss and its best finish. **Members, all-time** lists every team that has played in the conference with its conference and overall record there, titles, NCAA trips and MCWS trips (former members are marked).
- **Team pages:** the dynasty record shows which conference the team was in each season.
- **Brackets** are drawn with long, thin game cards. The game's status (final, or the favorite and a sim button) sits in the card's top row, and each winner's row is shaded in a gradient of its team color with black or white text, whichever reads better.

## Records

The **Records** page is the dynasty's record book, covering every season in the league (a season still in progress is marked *):

- **Programs, all-time:** seasons, wins, winning percentage, regular-season titles (shared titles count), conference tournament titles, NCAA appearances, MCWS appearances and national titles. Click any column to sort.
- **Single season:** most wins, best winning percentage, most runs scored, fewest runs allowed, best run differential, longest winning streak, best conference record, and most losses by a national champion.
- **Single game:** most runs, most hits, largest margin of victory, most combined runs, longest games (extra innings) and every no-hitter.
- **Coaches:** career wins, career winning percentage, national titles and MCWS appearances.

Everything is worked out from the games, so it updates as you play and includes the postseason.

## Commissioner controls

| Want to… | Where |
|---|---|
| Enter or change a score | Click the game (Schedule, Postseason, team page) |
| Change ratings | Teams page, or the team's profile |
| Add a team | Offseason (full schedule), or Teams → + Add team mid-season |
| Realign conferences | Offseason → Conference menus |
| Change a head coach | Teams page, team profile, or Offseason (dropdown) |
| Pick a conference tournament format | Standings → Commissioner, or Postseason before it starts |
| Rename a team, change colors, logo or conference | Team profile → Commissioner edits |
| Add or rename a conference, set its logo | Conferences |
| Add a game | Schedule → + Add game |
| Override a conference champion or tournament size | Standings → Commissioner |
| Edit tournament seeds | Postseason → Conference tournaments |
| Change the NCAA field or seeds | Postseason → Selection |
| Edit a poll | Rankings → Edit poll |
| New schedule (before any games) | Settings → Rebuild schedule |
| Season length, midweek format | Settings → Schedule format |
| Regionals, qualifiers, super regionals, MCWS size | Settings → NCAA tournament |

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
js/views-records.js     records page
js/records.js           record book (programs, seasons, games, coaches)
js/data.js              the 2016 teams and conferences, colors, starting ratings
js/sim.js               plate-appearance game simulator and win probability
js/schedule.js          schedule generator
js/standings.js         records, standings, tiebreakers, RPI
js/polls.js             voter panel and generated polls
js/ratings.js           in-season rating movement
js/postseason.js        conference tournaments, selection, regionals, MCWS
js/league.js            league lifecycle, editing, simulation, new seasons
js/store.js             saving and backups
js/logos.js             logo list loading and lookup
tests/                  logic test (Node) and UI test (Playwright)
tools/stamp.py          version-stamps file links before each release
tools/check.sh          checks every module parses before a release
```

Before committing changes, run `python3 tools/stamp.py`. It adds a version to every script and stylesheet link so browsers load a matching set of files after an update instead of mixing cached old files with new ones.

Run the tests with `node tests/logic.test.mjs` and `python3 tests/ui_test.py`. The UI test needs `pip install playwright` and `playwright install chromium`.
