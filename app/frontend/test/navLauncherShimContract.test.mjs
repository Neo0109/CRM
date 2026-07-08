import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function source(path) {
  const fullPath = resolve(__dirname, path);
  assert.equal(existsSync(fullPath), true, `${path} should exist`);
  return readFileSync(fullPath, "utf8");
}

const mainSource = source("../src/main.tsx");
const appSource = source("../src/App.tsx");
const calendarSource = source("../src/CalendarLauncher.tsx");
const weeklySource = source("../src/WeeklyReportLauncher.tsx");
const calendarCss = source("../src/calendar.css");
const weeklyCss = source("../src/weekly-report.css");
const loginCss = source("../src/login.css");

describe("Calendar and Weekly nav launcher DOM shim removal contract", () => {
  it("keeps nav launcher mounting inside the authenticated App shell", () => {
    assert.doesNotMatch(mainSource, /CalendarLauncher/);
    assert.doesNotMatch(mainSource, /WeeklyReportLauncher/);
    assert.match(appSource, /import \{ CalendarLauncher \} from "\.\/CalendarLauncher"/);
    assert.match(appSource, /import \{ WeeklyReportLauncher \} from "\.\/WeeklyReportLauncher"/);
    assert.match(appSource, /<div className="nav-group nav-extension-host">[\s\S]*<CalendarLauncher \/>[\s\S]*<WeeklyReportLauncher \/>[\s\S]*<\/div>/);
  });

  it("removes DOM host lookup from Calendar and Weekly launcher components", () => {
    for (const launcherSource of [calendarSource, weeklySource]) {
      assert.doesNotMatch(launcherSource, /querySelector/);
      assert.doesNotMatch(launcherSource, /MutationObserver/);
      assert.doesNotMatch(launcherSource, /setHost/);
      assert.doesNotMatch(launcherSource, /calendar-fallback-entry|weekly-fallback-entry/);
      assert.doesNotMatch(launcherSource, /createPortal\(button/);
      assert.match(launcherSource, /createPortal\(<[A-Za-z]+Workspace[\s\S]*document\.body\)/);
    }
  });

  it("removes fixed fallback launcher styles that only existed for DOM host injection", () => {
    assert.doesNotMatch(calendarCss, /\.calendar-fallback-entry/);
    assert.doesNotMatch(weeklyCss, /\.weekly-fallback-entry/);
    assert.doesNotMatch(loginCss, /calendar-fallback-entry/);
    assert.doesNotMatch(loginCss, /weekly-fallback-entry/);
  });
});
