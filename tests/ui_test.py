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
        pg.click("[data-tab=rpi]"); pg.wait_for_timeout(200)
        pg.screenshot(path=f"{OUT}/06-rpi.png")
        pg.goto(url + "#/postseason"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/07-conf-tourneys.png", full_page=True)
        pg.click("#ct-sim"); pg.wait_for_timeout(800)
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
        pg.goto(url + "#/settings"); pg.wait_for_timeout(300)
        pg.click("#s-next"); pg.wait_for_timeout(800)
        pg.goto(url + "#/home"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/15-new-season.png", full_page=True)
        pg.goto(url + "#/history"); pg.wait_for_timeout(300)
        pg.screenshot(path=f"{OUT}/16-history.png")
        # reload keeps data
        pg.goto(url + "#/home"); pg.reload(); pg.wait_for_selector(".kpis")
        assert "2017" in pg.locator("#season-picker").inner_text()
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
