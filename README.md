# EventLens v3 — Fully Autonomous Discovery

This version removes manual URL pasting entirely. The backend runs its own
crawl loop on a timer; the frontend is a pure read-only feed that fills
itself in.

## Why this addresses the mentor feedback

| Before (v1) | Now (v2) |
|---|---|
| User pastes a YouTube/IG link | No input field exists anywhere in the UI |
| One video processed per click | A scheduler scans a **seed list of hashtags** every 5 minutes |
| Backend is purely reactive | Backend is **proactive** — `startAutonomousCrawler()` runs on boot and loops forever |
| Frontend POSTs a URL | Frontend only does `GET /api/feed` and `GET /api/scan-status` — it has no way to submit a link even if it wanted to |

## How the pipeline works end-to-end

```
SEED_HASHTAGS (#delhievents, #bangaloreevents, #mumbainightlife)
        │
        ▼  every CRAWL_INTERVAL_MS (5 min), automatically
discoverReelsForHashtag()  → Apify instagram-hashtag-scraper
        │  returns a batch of recent Reel URLs/IDs (no human picked these)
        ▼
dedupe against seenVideoIds (never reprocess the same Reel)
        │
        ▼
enrichReelCaption()  → Apify instagram-reel-scraper (if caption missing)
        │
        ▼
extractEventData()  → OpenAI structured extraction
        │
        ▼
eventFeed.unshift(item)  → in-memory store, newest first
        │
        ▼
Frontend polls GET /api/feed every 4s → new cards animate in automatically
```

## Setup

```bash
npm install
```

Create `.env`:
```
OPENAI_API_KEY=sk-...
APIFY_API_TOKEN=apify_api_...
```

Run:
```bash
npm start
```

The crawler starts **immediately on boot** — you'll see log lines like:

```
[CRAWL] 🔄 Crawl cycle started
[CRAWL] Scanning #delhievents (New Delhi)
[CRAWL] ✅ Added "Sunset Rooftop Jazz & Food Festival" from #delhievents
[CRAWL] 🏁 Crawl cycle complete
```

Then open `index.html` — the feed fills in within a few seconds, with zero
interaction required.

## Demo-safety failsafes (still fully functional with no API keys)

1. **No Apify token** → `discoverReelsForHashtag()` throws → caught →
   the cycle falls back to pulling from a rotating local `MOCK_POOL`, so
   cards still appear automatically, just clearly labeled `"Demo data"`.
2. **No OpenAI key** → same fallback path.
3. **Backend not running at all** → frontend's `pollFeed()`/`pollScanStatus()`
   catch the fetch failure and run a local `simulateOfflineScanCycle()` so
   the autonomous *experience* (status strip animating, a new card
   appearing) still demonstrates the concept without any server.

## Judge-facing "proof of automation"

The black **Live Scanner Strip** at the top of the page is the key piece
for demoing the autonomy claim:
- Shows which hashtag is currently being scanned, in real time
- Shows a running scanned/extracted counter
- Shows a scrolling activity log (`✅ Added "X" from #tag`)
- Shows "Last scan" / "Next scan" countdowns
- Has a **"Scan now"** button — this does NOT let you paste a link, it
  just nudges the *same* autonomous cycle to run a cycle early, useful for
  live demos so you don't have to wait 5 minutes on stage.

## Tuning the seed list

Edit `SEED_HASHTAGS` in `server.js`:

```js
let SEED_HASHTAGS = [
  { tag: "delhievents", city: "New Delhi", active: true },
  { tag: "bangaloreevents", city: "Bangalore", active: true },
  { tag: "mumbainightlife", city: "Mumbai", active: true },
];
```

This is the only place a human ever configures *what* gets discovered —
never *which specific video*. That's the architectural distinction that
satisfies "should not scrape manually."

## Production notes (good to mention if asked)

- Swap `eventFeed` / `seenVideoIds` (in-memory) for Postgres + Redis.
- Move `runCrawlCycle()` to a proper job queue (BullMQ) instead of
  `setInterval`, so it survives restarts and can run distributed.
- Add a moderation step before publishing (the `trustScore < 20` skip is
  a stand-in for this).
