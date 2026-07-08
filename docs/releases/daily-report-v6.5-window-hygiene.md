# Daily Report V6.5 Window Hygiene

## Scope

- Sourcing-rule behavior only.
- Keeps the V6.4 Bilibili probe and existing report/schema shape.

## Changes

- `sourcing-rules-v6.5-window-hygiene` restores the 60-day launch-window gate for fresh candidates.
- Domestic Demo/试玩 signals no longer override near-launch timing; they remain useful for product inspection only when the cooperation window is still open.
- Near-launch Steam and Steam-enriched Bilibili/media candidates route to `drop_pool` with `drop_reason = 窗口不合适` or stay as market background.
- Steam-generated candidates now leave `next_action` and `notes` empty by default, matching existing media-lead field hygiene.

## Verification

- `node --test automations/test/*.mjs`
- `node scripts/test-sourcing-v6-3.mjs && node scripts/test-bilibili-probe.mjs`
