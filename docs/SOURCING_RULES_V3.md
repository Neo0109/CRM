# Sourcing Rules V3

Date: 2026-05-29

## One-Line Standard

The CRM serves a Bilibili publishing BD owner. Every generated insight must help decide whether a product deserves BD attention, not merely describe a trend.

## Reader

The primary reader is Bilibili's business development lead for game publishing.

The report must answer:

- What is the product?
- What are its strengths and weaknesses?
- What public data or source signal supports the judgment?
- What is the gameplay loop or content hook?
- Can Bilibili meaningfully amplify it through creators, video content, community, localization, events, or China publishing context?
- What should BD do next?

## Steam Trend Standard

Steam Trends is not a tag-frequency dashboard.

Do not output generic conclusions such as "Indie is frequent today" unless it is tied to a BD action.

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

- Mainstream gaming media.
- Developer/publisher official announcements.
- Court, company, exchange, or regulator announcements.
- Credible domestic game/technology media.
- Verifiable community or creator signals when they are directly relevant to Bilibili.

Internal CRM rules, automation notes, or "we scanned Steam today" must not be placed under "行业新闻".

Named news items from the user are examples, not targets. The automation must learn the signal type behind them:

- A new expansion, remake, sequel, showcase, or long-tail content beat is a product/IP lifecycle signal.
- A lawsuit, execution, founder incident, rights dispute, acquisition, funding, layoff, or leadership change is a company/IP risk signal.
- A platform rule, store event, data change, or distribution shift is a publishing-window signal.
- A creator/community meme, mod, livestream, or content surge is a Bilibili amplification signal.

Do not hard-code one or two known stories as the daily answer. Use them to calibrate what high-quality signals look like.

## Media Quality Standard

Prefer sources that improve BD judgment:

- Industry/business media: GamesIndustry.biz, GameDeveloper, VGC, Eurogamer, PC Gamer, IGN, Gematsu, The Verge Gaming.
- Domestic industry and business media: GameLook, 触乐, IT之家, 证券时报, 澎湃新闻, plus credible Chinese game media pages when they produce verifiable source links.
- Official sources: developer/publisher posts, platform announcements, court/company/exchange/regulator announcements.

Penalize low-value noise:

- Pure review, guide, discount, ranking, screenshot gallery, cosplay, wallpaper, or generic rumor posts.
- Duplicate copies of the same event.
- News with no plausible BD implication.

## Radar Categories

- 行业新闻: real industry events that change market context.
- 发行八卦: people, company, IP, lawsuit, governance, publisher, or business-side events with BD relevance.
- AI 游戏: AI production, policy, content, or risk signals.
- 新梗热点: memes, community events, viral formats, or creator topics that can affect content strategy.
- B站趋势: Bilibili-specific creator, video, community, or audience implications.

Empty categories should not be forced. If there is no meaningful item, omit the category.

## Push / Watch / Drop

V2 pool discipline remains:

- Push pool can be empty.
- Already released projects must not enter push/watch candidates. They can only be dropped or used as market background unless a separate post-launch review is explicitly requested.
- Near-launch, PC Early Access, narrative-first, India-led, mature-publisher-occupied, or weak overseas projects should not consume push-pool time.
- Watch pool is allowed to be broad, but each item must explain what signal is missing.
- Drop pool should record why a lead should not be revisited soon.

## CRM Inbox Discipline

Automation may rank candidates in the report, but non-dropped leads must enter CRM as `bucket = 未处理`, `stage = new`, and `review_status = 未处理`.

Do not auto-place new daily-report leads into 观察池, 待评测, 跟进中, or 推进池. Those are human review outcomes. The inbox is the holding area for new discoveries until the BD owner decides whether to observe, test, follow up, push, or drop.

Contact methods must be real touch points. Prefer Steam support email, official website, support URL, official-site email, Discord, X/Twitter, or Bilibili. Steam store and SteamDB URLs belong in `links`, not `contact_methods`. If no public business contact is available, keep the Steam community discussion URL as a fallback and explicitly treat it as a fallback, not as an email or official website.

## Iteration Rule

This rule file is living product infrastructure. When the output feels like noise to the BD reader, update the rule and the online automation together.
