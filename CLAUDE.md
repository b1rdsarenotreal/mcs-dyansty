# MCS Dynasty

## Keep the two dynasties in sync

This app has a twin: **SACAA Dynasty** ([b1rdsarenotreal/sacaa-dynasty](https://github.com/b1rdsarenotreal/sacaa-dynasty)). Both run the same engine. SACAA Dynasty started as a copy of MCS Dynasty.

**Rule from the owner:** any change to how the app works goes into **both** repos, unless the request says it is for only one of them. That covers features, rules, formats, bug fixes, UI and tests. In practice:

1. Make the change here, run the tests, and commit.
2. Attach the twin repo (add_repo with push access), pull it, and make the same change there. Adapt names where the leagues differ. Then run its tests and commit and push.
3. Tell the owner that both repos were updated, or why one was skipped.

These stay different on purpose. Never copy them across:

| | MCS Dynasty | SACAA Dynasty |
|---|---|---|
| Teams, conferences, coaches, colors, ratings, start year (`js/data.js`) | 45 teams, 6 conferences, 2016 | 56 teams, 7 conferences, 2030 |
| Championship name | Men's College World Series (MCWS) | National Championships (no abbreviation) |
| Default venue | Firestone Stadium, Akron, Ohio | Devon Park, Oklahoma City, Oklahoma |
| Save and logo-cache keys (`js/store.js`, `js/logos.js`) | `mcs-dynasty`, `mcs-logo-table-v1` | `sacaa-dynasty`, `sacaa-logo-table-v1` |
| Team and conference names used in `tests/` | MCS teams (Oklahoma, Big Ten, ...) | SACAA teams (UCLA, Pac-10, ...) |
| README sections "The league" and "Ratings" (how starting ratings were made) | | |
| Postseason column in team and coach histories | Finish only ("NCAA Regional") | Regional name and round lost, linked to the bracket (`postseasonDetail`, `#/postseason/<year>/<tab>/<event>` route). The owner asked for this in SACAA only. |
| Game box design and visual refresh (`gameCard` in `js/ui.js`, the scoreboard-tile and refresh blocks at the end of `css/styles.css`, home page mini scoreboards) | Scoreboard tiles: logos left/right, score in the middle, winner's color wash. The owner asked for this in MCS only. | Original line-score boxes |

Internal identifiers such as `mcws`, `mcwsVenue` and `mcwsName` are shared by both apps. Keep them the same so code ports cleanly. Only text the user sees differs.

The file links carry different version stamps in each repo, so copying whole files across will mix them up. Port the edit itself, then run `python3 tools/stamp.py` in each repo.

## Before every commit

- `python3 tools/stamp.py`
- `sh tools/check.sh`
- `node tests/logic.test.mjs`
- `python3 tests/ui_test.py` (Playwright; Chromium is preinstalled)
