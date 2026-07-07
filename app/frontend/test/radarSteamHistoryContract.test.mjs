import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function source(path) {
  return readFileSync(resolve(__dirname, path), "utf8");
}

const appSource = source("../src/App.tsx");
const radarSource = source("../src/features/radar/RadarPage.tsx");
const steamSource = source("../src/SteamTrendsPage.tsx");
const historyControlsSource = source("../src/ReportHistoryControls.tsx");

describe("Radar and Steam trends history recovery", () => {
  it("keeps Radar and Steam loading failures page-specific instead of rendering misleading empty reports", () => {
    assert.match(appSource, /const \[radarError,\s*setRadarError\]/);
    assert.match(appSource, /const \[steamError,\s*setSteamError\]/);
    assert.match(appSource, /<RadarPage[\s\S]*error=\{radarError\}/);
    assert.match(appSource, /<SteamTrendsPage[\s\S]*error=\{steamError\}/);
  });

  it("renders explicit page errors for Radar and Steam Trends", () => {
    assert.match(radarSource, /error\?: string \| null/);
    assert.match(radarSource, /行业雷达加载失败/);
    assert.match(radarSource, /无法取得行业雷达数据/);
    assert.match(steamSource, /error\?: string \| null/);
    assert.match(steamSource, /Steam 趋势加载失败/);
    assert.match(steamSource, /无法取得 Steam 趋势数据/);
  });

  it("does not point users to unavailable history controls in no-report empty states", () => {
    assert.doesNotMatch(radarSource, /上方回看保留的历史内容/);
    assert.doesNotMatch(steamSource, /上方回看最近保留的历史内容/);
    assert.match(radarSource, /暂无可展示的行业雷达记录/);
    assert.match(steamSource, /暂无可展示的 Steam 趋势记录/);
  });

  it("makes retained history date controls explicit", () => {
    assert.match(historyControlsSource, /历史日期/);
    assert.match(historyControlsSource, /请求日期/);
    assert.match(historyControlsSource, /展示日期/);
    assert.match(historyControlsSource, /最近记录/);
  });
});
