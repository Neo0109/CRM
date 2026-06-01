# Sourcing Rules V5

Date: 2026-06-01

## One-Line Standard

The daily report serves a Bilibili game publishing BD owner. It must reduce decision cost, not mirror internal rules or produce generic filler.

## What Changed From V4

V5 keeps the domestic-first, testing-first sourcing workflow from V4, and upgrades the report intelligence layer:

- Steam Trends becomes a Steam market board.
- Industry Radar remains a China + overseas industry news board.
- Daily leads remain discovery records and must enter `未处理` unless dropped.
- Rules iteration is separate from product UI versioning. This is a report-rule version, not a BD workbench product release.

## Steam Trends Standard

Steam Trends must not paste sourcing rules into the page.

It should answer what Steam is showing today:

- Which categories are surfacing: Roguelike/Deckbuilder, Strategy/Tactical, Simulation/Management, Co-op/Multiplayer, Survival/Sandbox, Action/visual-hook, or other meaningful clusters.
- Which Steam windows matter: Demo, Next Fest, Popular Upcoming, official sale/event pages, wishlists, public recommendations, SteamDB movement, or noticeable data changes.
- Which publishers/developers have new products or repeated signals.
- Which samples have meaningful public data, media assets, or community traction.
- What the BD implication is: test now, watch data, verify China rights, ignore because occupied/released/weak, or use as market background.

`market_insights` must cite Steam, SteamDB, AppDetails, Steam official event pages, or observable public data. It must not use CRM rule docs, GitHub rule links, internal automation notes, or "we changed the rule" as the source.

`genre_signals` must include sample count, representative examples, why the category matters for Bilibili, and the concrete screening action.

`items` may list concrete candidates, but they are supporting samples. The top of the page should be market intelligence first.

## Lead Workflow

Automatic daily reports are discovery, not final human review.

- Non-dropped generated leads enter `bucket = 未处理`, `stage = new`, `review_status = 未处理`.
- Dropped leads enter `bucket = 淘汰池`, `stage = rejected`.
- Automation may rank candidates as strong-signal or ordinary review candidates, but the human reviewer decides whether something becomes `观察池`, `待评测`, `跟进中`, or `推进池`.
- The first useful action is to test or inspect the game. Contact completion and long-form evidence happen only after product judgment passes.

## Sourcing Priority

Domestic products remain the default priority because cooperation, response efficiency, visual/cultural fit, creator communication, and signing probability are materially better.

Domestic developer Demo/test signals should be promoted. The old 60-day launch-window rule is not the only useful window; early domestic products can be reviewed over a longer horizon.

Overseas products should consume review slots only when they have credible PC validation and a plausible mobile-adaptation or Bilibili content angle.

## Industry Radar Standard

Industry Radar must use real external signals.

`行业新闻` is for macro or large-scope industry events: platform policy, market shifts, regulation, capital/financial changes, major publisher moves, China/overseas market direction, or other trend-context signals.

`今日亮点` is for concrete games, IP moments, recommended/fun products, publisher gossip, legal/company anecdotes, and other specific items worth opening. Former "发行八卦" content belongs here unless it is broad enough to change industry context.

The radar should feel like a compact news board, not a short category filler list. Cover both China and overseas when sources are available.

## Guardrails

- Steam Trends must have enough `market_insights`, `genre_signals`, and candidate samples before syncing.
- Industry Radar must have enough external items before syncing.
- Empty or network-failed Steam output is invalid.
- The automation must log the active rule version at run start.
- Rules-only changes must live in GitHub and trigger the cloud workflow.
