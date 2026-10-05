"""UI smoke test: drives the app in headless Chromium through a full season.
Run from the repo root:  python3 tests/ui_test.py   (needs: pip install playwright; playwright install chromium)
Screenshots go to $SHOTS (default ./shots)."""
import os, subprocess, sys, time
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get("SHOTS", os.path.join(ROOT, "shots"))
os.makedirs(OUT, exist_ok=True)
PORT = 8766
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(PORT)], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)
errors = []
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={"width": 1400, "height": 1000})
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errors.append(m.text))
        pg.route("**/gist.githubusercontent.com/**", lambda r: r.fulfill(status=404, body=""))
        url = f"http://localhost:{PORT}/"
        pg.goto(url + "#/home"); pg.wait_for_selector(".kpis")
        pg.screenshot(path=f"{OUT}/01-home.png", full_page=True)
        # Big Ten: 8-team double elimination; Horizon: double elimination
        pg.goto(url + "#/standings"); pg.wait_for_selector("[data-format]", state="attached")
        open_all = "document.querySelectorAll('details').forEach(d => d.open = true)"
        for sel, val in [("select[data-format='Big Ten']", "double"), ("select[data-size='Big Ten']", "8"), ("select[data-format='Horizon']", "double")]:
            pg.evaluate(open_all); pg.select_option(sel, val); pg.wait_for_timeout(200)
        pg.goto(url + "#/schedule"); pg.wait_for_selector(".game")
        pg.click("#w-sim"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/02-schedule.png", full_page=False)
        # open a game and simulate in the editor, then save
        pg.goto(url + "#/schedule"); pg.click(".chip[data-week='2']"); pg.wait_for_timeout(200)
        pg.locator(".game:not(.placeholder)").first.click(); pg.wait_for_selector("dialog[open]")
        pg.click("#m-sim"); pg.wait_for_timeout(100)
        pg.screenshot(path=f"{OUT}/03-editor.png")
        pg.click("#m-save"); pg.wait_for_timeout(200)
        # manual entry with extra inning
        pg.locator(".game:not(.placeholder)").nth(3).click(); pg.wait_for_selector("dialog[open]")
        pg.click("#m-addinn")
        vals = {"away": [0,1,0,0,2,0,0,1], "home": [0,0,2,0,0,1,0,0]}
        for side, arr in vals.items():
            for i, v in enumerate(arr):
                pg.fill(f"input[data-side={side}][data-inn='{i}']", str(v))
        pg.fill("#m-awayH", "7"); pg.fill("#m-homeH", "6"); pg.fill("#m-awayE", "1"); pg.fill("#m-homeE", "0")
        pg.click("#m-save"); pg.wait_for_timeout(200)
        assert not pg.locator("dialog[open]").count(), "manual save closed the editor"
        pg.click("#w-rest") if pg.locator("#w-rest").count() else None
        pg.on("dialog", lambda d: d.accept())
        pg.goto(url + "#/schedule"); pg.wait_for_selector(".chip")
        if pg.locator("#w-rest").count(): pg.click("#w-rest"); pg.wait_for_timeout(1500)
        pg.goto(url + "#/standings"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/04-standings.png", full_page=True)
        pg.goto(url + "#/rankings"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/05-poll.png", full_page=True)
        assert pg.locator(".dropped").count() + pg.get_by_text("No teams dropped out").count() >= 1, "dropped-out list shown"
        pg.click("[data-tab=rpi]"); pg.wait_for_timeout(200)
        pg.screenshot(path=f"{OUT}/06-rpi.png")
        pg.click("[data-tab=sos]"); pg.wait_for_timeout(200)
        assert "Strength of schedule =" in pg.content()
        pg.screenshot(path=f"{OUT}/06b-sos.png")
        pg.goto(url + "#/postseason"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/07-conf-tourneys.png", full_page=True)
        pg.click("#ct-sim"); pg.wait_for_timeout(800)
        pg.goto(url + "#/postseason"); pg.click("[data-pt=conf]"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/07b-conf-brackets.png", full_page=True)
        pg.goto(url + "#/postseason"); pg.click("[data-pt=field]"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/08-field.png", full_page=True)
        pg.click("#f-lock"); pg.wait_for_timeout(500)
        pg.screenshot(path=f"{OUT}/09-regionals.png", full_page=True)
        pg.click("#ps-all"); pg.wait_for_timeout(1500)
        pg.goto(url + "#/postseason"); pg.click("[data-pt=mcws]"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/10-mcws.png", full_page=True)
        champ = pg.locator(".banner .big").first.text_content()
        print("champion:", champ)
        pg.goto(url + "#/team/" + champ); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{OUT}/11-team.png", full_page=True)
        pg.goto(url + "#/teams"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/12-teams.png")
        pg.click("#t-add"); pg.fill("#f-school", "Oregon State"); pg.fill("#f-mascot", "Beavers"); pg.click("#f-save"); pg.wait_for_timeout(300)
        assert "Oregon State" in pg.content()
        pg.goto(url + "#/conferences"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/13-conferences.png")
        pg.goto(url + "#/conference/Horizon"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/14-conference.png", full_page=True)
        # Offseason: new conference, move teams, add a team, start the season
        pg.goto(url + "#/offseason"); pg.wait_for_selector("#o-start")
        pg.screenshot(path=f"{OUT}/15-offseason.png", full_page=True)
        pg.click("#o-conf"); pg.fill("#cf-name", "Summit"); pg.click("#cf-save"); pg.wait_for_timeout(300)
        for t in ["Saint Louis", "UMKC", "North Dakota State"]:
            pg.select_option(f"select[data-dconf='{t}']", "Summit"); pg.wait_for_timeout(150)
        pg.click("button[data-addto='Summit']"); pg.fill("#f-school", "Omaha"); pg.fill("#f-coach", "Pat Casey"); pg.click("#f-save"); pg.wait_for_timeout(300)
        # Coaching carousel: Oklahoma hires Green Bay's coach, Green Bay hires someone new
        pg.select_option("select[data-dcoach='Oklahoma']", label="Roman Foore (Green Bay)"); pg.wait_for_timeout(300)
        assert pg.locator("select[data-dcoach='Green Bay'].vacant").count() == 1, "Green Bay job is open"
        pg.select_option("select[data-dcoach='Green Bay']", "__new"); pg.wait_for_selector("#cn-name")
        pg.fill("#cn-name", "Sam Newman"); pg.click("#cn-save"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/15b-offseason-realigned.png", full_page=True)
        pg.click("#o-start"); pg.wait_for_timeout(800)
        pg.goto(url + "#/standings"); pg.wait_for_timeout(300)
        assert "Summit" in pg.content() and "Omaha" in pg.content()
        pg.goto(url + "#/team/Oklahoma"); pg.wait_for_timeout(300)
        assert "Roman Foore" in pg.content()
        pg.screenshot(path=f"{OUT}/16c-team-2017.png", full_page=True)
        pg.goto(url + "#/coaches"); pg.wait_for_timeout(300)
        assert "Sam Newman" in pg.content() and "JT Gasso" in pg.content()
        pg.screenshot(path=f"{OUT}/16d-coaches.png", full_page=True)
        pg.click("a.team-link:has-text('Roman Foore')"); pg.wait_for_timeout(300)
        assert "Green Bay" in pg.content() and "Oklahoma" in pg.content(), "career shows both programs"
        pg.screenshot(path=f"{OUT}/16e-coach-page.png", full_page=True)
        pg.goto(url + "#/home"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/16-new-season.png", full_page=True)
        pg.goto(url + "#/history"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/16b-history.png")
        # reload keeps data
        pg.goto(url + "#/home"); pg.reload(); pg.wait_for_selector(".kpis")
        assert "2017" in pg.locator("#season-picker").inner_text()
        # Layout check: nothing overlapping or spilling out, at four widths
        CHECK = """() => {
          const out = [];
          const vis = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
          const name = el => (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName) + ' "' + (el.textContent || '').trim().slice(0, 30) + '"';
          if (document.documentElement.scrollWidth > innerWidth + 1) out.push('page scrolls sideways: ' + document.documentElement.scrollWidth + ' > ' + innerWidth);
          // Cells in a row must not overlap each other.
          for (const row of document.querySelectorAll('.bg-row, .line.sb, .rbar, .lsrow, .poll-row')) {
            const kids = [...row.children].filter(vis).map(k => k.getBoundingClientRect());
            for (let i = 1; i < kids.length; i++) if (kids[i].left < kids[i - 1].right - 1 && kids[i].top < kids[i - 1].bottom - 1) { out.push('cells overlap in ' + name(row)); break; }
          }
          // Text that spills out of its box (ellipsis is allowed).
          for (const el of document.querySelectorAll('.kpi .v, .kpi .l, .bg-team, .line.sb > div:first-child, .team-hero-name, .badge, .chip, .btn, h1, h2, h3, td, th')) {
            if (!vis(el)) continue;
            const cs = getComputedStyle(el);
            if (el.scrollWidth > el.clientWidth + 2 && cs.overflow === 'visible' && cs.textOverflow !== 'ellipsis' && el.closest('.table-wrap, .bracket') == null) out.push('spills: ' + name(el));
          }
          // Sibling cards / tiles must not overlap.
          for (const sel of ['.card', '.game', '.bgame', '.kpi']) {
            const els = [...document.querySelectorAll(sel)].filter(vis);
            const byParent = new Map();
            for (const e of els) { const k = e.parentElement; if (!byParent.has(k)) byParent.set(k, []); byParent.get(k).push(e.getBoundingClientRect()); }
            for (const rs of byParent.values()) for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
              const a = rs[i], b = rs[j];
              if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) out.push(sel + ' boxes overlap');
            }
          }
          // Bracket cards must hold their content.
          for (const el of document.querySelectorAll('.bk-node > .bgame')) if (el.scrollHeight > el.clientHeight + 1) out.push('bracket card overflows: ' + name(el));
          for (const el of document.querySelectorAll('.series-tag')) if (vis(el) && el.scrollWidth > el.clientWidth + 1) out.push('series text cut off: ' + name(el));
          // Truncated names (not an error, but counted).
          const cut = [...document.querySelectorAll('.bg-team .team-link, .line.sb .team-link, .kpi .team-link')].filter(e => vis(e) && e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
          return { problems: [...new Set(out)].slice(0, 12), truncated: cut.slice(0, 8), truncatedCount: cut.length };
        }"""
        pages = ["#/home", "#/schedule", "#/standings", "#/rankings", "#/postseason", "#/teams", "#/coaches", "#/coach/c3", "#/team/Oklahoma", "#/conferences", "#/conference/Big%20Ten", "#/history", "#/settings"]
        layout_issues = []
        for w in [1400, 1024, 768, 390]:
            lp = b.new_page(viewport={"width": w, "height": 900})
            lp.route("**/gist.githubusercontent.com/**", lambda r: r.fulfill(status=404, body=""))
            for path in pages:
                lp.goto(url + path); lp.wait_for_timeout(250)
                if path == "#/postseason":
                    for tab in ["conf", "field", "regionals", "mcws"]:
                        if lp.locator(f"[data-pt={tab}]").count():
                            lp.click(f"[data-pt={tab}]"); lp.wait_for_timeout(150)
                            r = lp.evaluate(CHECK)
                            if r["problems"]: layout_issues.append((w, path + "/" + tab, r["problems"]))
                            if r["truncatedCount"]: print(f"  {w}px {path}/{tab}: {r['truncatedCount']} names shortened, e.g. {r['truncated'][:3]}")
                    continue
                r = lp.evaluate(CHECK)
                if r["problems"]: layout_issues.append((w, path, r["problems"]))
                if r["truncatedCount"]: print(f"  {w}px {path}: {r['truncatedCount']} names shortened, e.g. {r['truncated'][:3]}")
            lp.close()
        for i in layout_issues: print("LAYOUT", i)
        assert not layout_issues, "layout problems"
        # mobile
        m = b.new_page(viewport={"width": 390, "height": 844})
        m.on("pageerror", lambda e: errors.append(str(e)))
        m.goto(url + "#/schedule"); m.wait_for_selector(".game"); m.wait_for_timeout(300)
        m.screenshot(path=f"{OUT}/17-mobile-schedule.png")
        sw = m.evaluate("document.documentElement.scrollWidth")
        print("mobile scrollWidth", sw)
        b.close()
finally:
    srv.terminate()
print("errors:", errors[:10])
assert not errors, errors
print("UI test passed")
