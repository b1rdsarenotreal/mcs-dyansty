# MCS Dynasty

## Keep the two dynasties in sync

This app has a twin: **SACAA Dynasty** ([b1rdsarenotreal/sacaa-dynasty](https://github.com/b1rdsarenotreal/sacaa-dynasty)). Both run the same engine. SACAA Dynasty started as a copy of MCS Dynasty.

**Rule from the owner:** any change to how the app works goes into **both** repos, unless the request says it is for only one of them. That covers features, rules, formats, bug fixes, UI and tests. In practice:

1. Make the change here, run the tests, and commit.
2. Attach the twin repo (add_repo with push access), pull it, and make the same change there. Adapt names where the leagues differ. Then run its tests and commit and push.
3. Tell the owner that both repos were updated, or why one was skipped.

These stay different on purpose. Never copy them across:

(Shared code that is written to handle independents, such as the `rival()` check in `js/schedule.js`, is MCS-only too; when porting schedule changes to SACAA, port them without the independent handling.)

| | MCS Dynasty | SACAA Dynasty |
|---|---|---|
| Teams, conferences, coaches, colors, ratings, start year (`js/data.js`) | 45 teams, 6 conferences, 2016 | 56 teams, 7 conferences, 2030 |
| Championship name | Men's College World Series (MCWS) | National Championships (no abbreviation) |
| Default venue | Firestone Stadium, Akron, Ohio | Devon Park, Oklahoma City, Oklahoma |
| Save and logo-cache keys (`js/store.js`, `js/logos.js`) | `mcs-dynasty`, `mcs-logo-table-v1` | `sacaa-dynasty`, `sacaa-logo-table-v1` |
| Team and conference names used in `tests/` | MCS teams (Oklahoma, Big Ten, ...) | SACAA teams (UCLA, Pac-10, ...) |
| README sections "The league" and "Ratings" (how starting ratings were made) | | |
| Postseason column in team and coach histories | Regional name and round lost, linked to the bracket (`postseasonDetail`, `#/postseason/<year>/<tab>/<event>` route, `evAnchor` ids), plus a second line with the NCAA W-L and conference tournament W-L and round (`postseasonRecord`). The owner asked for the records line in MCS only. | Regional name and round lost, linked to the bracket (`postseasonDetail`). No records line. |
| Color palette (the `:root` tokens at the top of `css/styles.css`, stat-band label colors, active tabs) | Night-game navy top bar | Lighter sky blue top bar (`--board: #2c71c7`), sky-tinted background. The owner asked for this in SACAA only. |
| Independent teams (`INDEPENDENT` in `js/standings.js`, the Independents standings card, offseason/conference-page guards) | Supported: teams can be Independent (no conference games, title, tournament or automatic bid) | Not added. The owner asked for independents in MCS only. |
| Team page, season tab layout (`renderTeamPage`, `.team-season` / `.team-ratings` CSS, `teamScheduleRows` / `gameDate` and the `.ts-*` CSS) | Full-width season card, then full-width Ratings, then Schedule & results as athletics-site rows (date block, logos, vs./at, location, result; event header bars), then Poll history. The owner asked for this in MCS only. | Ratings and season cards side by side, Poll history above the schedule (a plain table) |

Internal identifiers such as `mcws`, `mcwsVenue` and `mcwsName` are shared by both apps. Keep them the same so code ports cleanly. Only text the user sees differs.

The file links carry different version stamps in each repo, so copying whole files across will mix them up. Port the edit itself, then run `python3 tools/stamp.py` in each repo.

## Before every commit

- `python3 tools/stamp.py`
- `sh tools/check.sh`
- `node tests/logic.test.mjs`
- `python3 tests/ui_test.py` (Playwright; Chromium is preinstalled)
