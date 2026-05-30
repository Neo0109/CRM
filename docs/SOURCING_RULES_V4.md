# Sourcing Rules V4

Date: 2026-05-29

## One-Line Standard

The CRM serves a Bilibili game publishing BD owner. Sourcing must prioritize products with realistic signing probability, not merely creative novelty.

## Reader

The primary reader is Bilibili's business development lead for game publishing.

The report must answer:

- What is the product?
- Is it domestic or overseas, and why does that matter for signing probability?
- What are its strengths and weaknesses?
- What public data or source signal supports the judgment?
- What is the gameplay loop or content hook?
- Can Bilibili meaningfully amplify it through creators, video content, community, localization, events, or China publishing context?
- What should BD do next?

## Domestic-First Standard

Domestic products are the default sourcing priority.

Reasons:

- Cooperation and response efficiency are materially higher.
- Visual style, cultural context, creator communication, community operations, and localization are easier to align.
- Bilibili can more directly help with video content, creator seeding, community discussion, testing, and China publishing context.

Domestic developer Demo/test signals should always be promoted. A domestic product with an active Demo, playtest, Steam Next Fest entry, Bilibili video, Chinese community discussion, or domestic media signal should receive higher review priority than a generic overseas upcoming game.

The CRM workflow is testing-first. For new leads, the first useful action is to test or inspect the game. If the playtest/content judgment fails, drop it directly. Contact补全、官网补全、长资料整理 and商务深聊 happen only after the product passes the first test or is clearly worth deeper discussion.

## Overseas Standard

Overseas creativity alone is not enough.

Overseas products should enter review only when both conditions are plausible:

- PC validation: strong public data such as high recommendation count, clear community traction, or verified breakout status.
- Mobile-adaptation angle: the gameplay can plausibly become or inform a mobile product, such as card/deckbuilder, turn-based, strategy, simulation, management, puzzle, roguelike, tactical, idle, tower defense, or similar systems.

If an overseas product lacks PC validation or a mobile-adaptation angle, it should be dropped or kept as market background, not inserted into the BD review queue.

## Launch Window

Do not treat 60 days as the only useful window.

- Already released projects must not enter push/watch candidates unless a separate post-launch review is explicitly requested.
- Domestic early-stage products can be useful much earlier than 60 days, including imprecise windows such as Coming Soon, Q2/Q3, or next-year plans.
- Domestic Demo/test signals can override the old near-launch caution when the BD action is to evaluate, test, or contact quickly.
- Overseas projects still need stricter window discipline because signing probability is lower.

## Source Strategy

Domestic discovery should expand beyond Steam:

- Domestic game/business media: GameLook, 游戏葡萄, GameRes, 游戏陀螺, 手游那点事, 游戏茶馆, 触乐, IT之家, 证券时报, 澎湃新闻.
- Domestic indie/developer communities: indienova, developer blogs, official studio posts, TapTap/好游快爆/other domestic test platforms when accessible.
- Bilibili signals: search pages, official videos, creator videos, PV/demo reactions, developer account posts, and community discussion around domestic indie or Steam Demo projects.
- Steam remains useful, but domestic developer Demo/test signals should outrank generic overseas upcoming lists.

## Steam Trend Standard

Steam Trends is not a tag-frequency dashboard.

Every important Steam candidate should include:

- Data: source, launch window, Steam/SteamDB/AppDetails signal, public recommendations if available, screenshot/video availability.
- Gameplay: one sentence explaining the loop or player fantasy.
- Strengths: why this product may deserve attention.
- Weaknesses: why it may waste BD time.
- Bilibili leverage: creator content, challenge format, tutorial/strategy content, livestream value, community spread, localization, or China publishing gap.
- Next action: contact, verify, watch, or drop.

## Industry Radar Standard

Industry Radar must use real external signals.

Allowed sources include:

- Domestic game/business media and Bilibili signals with clear BD relevance.
- Mainstream gaming media.
- Developer/publisher official announcements.
- Court, company, exchange, or regulator announcements.
- Verifiable community or creator signals when they are directly relevant to Bilibili.

Internal CRM rules, automation notes, or "we scanned Steam today" must not be placed under "行业新闻".

Named news items from the user are calibration examples, not fixed targets.

## Push / Watch / Drop

- Push pool can be empty.
- Domestic products with Demo/test signals, clear gameplay loops, and contact paths should be promoted.
- Already released projects must not enter push/watch candidates. They can only be dropped or used as market background unless post-launch review is requested.
- PC Early Access, narrative-first, India-led, mature-publisher-occupied, or weak overseas projects should not consume review time.
- Overseas projects without PC hit validation and mobile-adaptation potential should not enter push/watch candidates.
- Watch pool is allowed to be broad for domestic products, but each item must explain what signal is missing.
- Domestic near-window products should not be hard-dropped merely because they are within 60 days. If they are unreleased and testable, put them in the review queue for playtest/inspection first.
- Drop pool should record why a lead should not be revisited soon.

## CRM Inbox Discipline

Automation may rank candidates in the report, but non-dropped leads must enter CRM as `bucket = 未处理`, `stage = new`, and `review_status = 未处理`.

Do not auto-place new daily-report leads into 观察池, 待评测, 跟进中, or 推进池. Those are human review outcomes.

Contact methods must be real touch points. Prefer Steam support email, official website, support URL, official-site email, Discord, X/Twitter, Bilibili, official account pages, or developer community links. Steam store and SteamDB URLs belong in `links`, not `contact_methods`.

## Iteration Rule

This rule file is living product infrastructure. When the output feels like noise to the BD reader, update the rule and the online automation together.
