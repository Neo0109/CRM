import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  recordMediaLeadCandidates,
  recordMediaSourceFetch,
  recordMediaSourceRetained,
  recordReleaseWindowHealth,
  sourceHealthEntries
} from "../jobs/online_daily_v4_source_health.mjs";

describe("online daily v4 source health", () => {
  it("tracks per-source fetch success, retained signals, and lead conversion", () => {
    const diagnostics = {};

    recordMediaSourceFetch(diagnostics, { name: "GameLook" }, { ok: true, rawCount: 10 });
    recordMediaSourceFetch(diagnostics, { name: "GameLook" }, { ok: true, rawCount: 5, fallbackUsed: true });
    recordMediaSourceFetch(diagnostics, { name: "Dead Feed" }, { ok: false, error: "403 Forbidden" });
    recordMediaSourceRetained(diagnostics, [
      { source: "GameLook" },
      { source: "GameLook" },
      { source: "Other" }
    ]);
    recordMediaLeadCandidates(diagnostics, [
      { public_signals: "GameLook / https://example.com/a" }
    ]);

    assert.deepEqual(sourceHealthEntries(diagnostics), [
      {
        source: "Dead Feed",
        attempts: 1,
        successes: 0,
        failures: 1,
        raw_signals: 0,
        retained_signals: 0,
        lead_candidates: 0,
        success_rate: 0,
        retained_rate: 0,
        lead_conversion_rate: 0,
        fallback_uses: 0,
        last_error: "403 Forbidden"
      },
      {
        source: "GameLook",
        attempts: 2,
        successes: 2,
        failures: 0,
        raw_signals: 15,
        retained_signals: 2,
        lead_candidates: 1,
        success_rate: 1,
        retained_rate: 0.1333,
        lead_conversion_rate: 0.0667,
        fallback_uses: 1,
        last_error: null
      },
      {
        source: "Other",
        attempts: 0,
        successes: 0,
        failures: 0,
        raw_signals: 0,
        retained_signals: 1,
        lead_candidates: 0,
        success_rate: 0,
        retained_rate: 0,
        lead_conversion_rate: 0,
        fallback_uses: 0,
        last_error: null
      }
    ]);
  });

  it("records release-window samples without changing the 60-day decision rule", () => {
    const diagnostics = {};
    recordReleaseWindowHealth(diagnostics, {
      steamCandidates: [
        { region: "中国", releaseTooSoon: true },
        { region: "中国", releaseTooSoon: false },
        { region: "海外", releaseTooSoon: true }
      ],
      mediaLeads: [
        { region: "中国", drop_reason: "窗口不合适" },
        { region: "中国", drop_reason: "已发售" }
      ]
    });

    assert.deepEqual(diagnostics.release_window_health, {
      threshold_days: 60,
      steam_candidates: 3,
      steam_domestic_near_launch: 1,
      steam_overseas_near_launch: 1,
      media_near_launch_drops: 1
    });
  });
});
