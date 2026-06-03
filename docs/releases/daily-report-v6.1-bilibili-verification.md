# Daily Report V6.1 Bilibili Verification Gate

Date: 2026-06-03

This is a daily-report rules and automation iteration only. It does not change the CRM product UI, login module, data schema, or visible product version.

## Motivation

Bilibili and domestic media signals are useful sourcing channels, but a video hit is only a discovery clue. Some hits point to projects that are already live on Steam, previously sourced through Steam, or based on old news. Those should not re-enter the fresh `未处理` review queue.

## Changes

- Upgraded the active rule guard to `sourcing-rules-v6.1`.
- Bilibili video signals are enriched from video metadata/description before candidate creation when possible.
- Steam store URLs and AppIDs extracted from Bilibili/media descriptions are used for Steam release-state cross-checks.
- Fully released Bilibili/media candidates are routed to `drop_pool` or market background instead of `push_pool`/`watch_pool`.
- Bilibili/media dedupe now checks CRM project names, loose Chinese title keys, Steam AppIDs, source URLs, and backend dedupe keys.
- Bilibili/video leads now use a stricter freshness gate, while still allowing current playable builds, demos, updates, publishing windows, and business-relevant events.
- Daily contract validation now blocks Bilibili/media leads that appear fully released but still enter review pools.

## Separation Boundary

Rules are rules, automation is automation, and product features are product features. This release intentionally avoids touching front-end workbench behavior, authentication, account display names, and CRM data schema.
