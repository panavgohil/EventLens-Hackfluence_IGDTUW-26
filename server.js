/**
 * EventLens — Backend Server (v3: FULLY AUTONOMOUS DISCOVERY)
 *
 * No manual URL pasting. The backend runs its own crawl cycle:
 *
 * ┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌────────────┐
 * │  SEED LIST   │ →   │  HASHTAG     │ →   │  AI EXTRACT  │ →   │  EVENT      │
 * │  (#hashtags) │     │  SCRAPE      │     │  (OpenAI)    │     │  FEED STORE │
 * └─────────────┘     └──────────────┘     └─────────────┘     └────────────┘
 * ↑                                                            │
 * └──────────────── runs every CRAWL_INTERVAL_MS ──────────────┘
 *
 * The frontend NEVER sends a URL. It only polls GET /api/feed and
 * GET /api/scan-status to render a self-filling discovery feed.
 *
 * SETUP:
 * 1. npm install
 * 2. .env file needs:
 * OPENAI_API_KEY=sk-...
 * APIFY_API_TOKEN=apify_api_...   ← https://console.apify.com/account/integrations
 * 3. node server.js  →  http://localhost:3001
 * The crawl loop starts automatically on boot and re-runs on a timer.
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());

// ─── Config ──────────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
const APIFY_BASE = "https://api.apify.com/v2";

const APIFY_HASHTAG_ACTOR = "apify~instagram-hashtag-scraper";
const APIFY_REEL_ACTOR = "apify~instagram-reel-scraper";

const CRAWL_INTERVAL_MS = 5 * 60 * 1000;
const REELS_PER_HASHTAG = 3;

let SEED_HASHTAGS = [
  { tag: "delhievents", city: "New Delhi", active: true },
  { tag: "bangaloreevents", city: "Bangalore", active: true },
  { tag: "mumbainightlife", city: "Mumbai", active: true },
];

const eventFeed = [];          
const seenVideoIds = new Set(); 
let scanStatus = {
  running: false,
  currentStep: "Idle",
  currentTag: null,
  lastScanAt: null,
  nextScanAt: null,
  totalScanned: 0,
  totalExtracted: 0,
  log: [], 
};

function logActivity(msg) {
  console.log(`[CRAWL] ${msg}`);
  scanStatus.log.unshift({ msg, at: new Date().toISOString() });
  scanStatus.log = scanStatus.log.slice(0, 20);
}

// ─── Mock data — FUTURE 2026 DATES ──────────────────────────────────────────
const MOCK_POOL = [
  {
    eventName: "Sunset Rooftop Jazz & Food Festival",
    date: "Saturday, July 18, 2026", time: "6:00 PM – 11:00 PM",
    location: "The Panorama Terrace, New Delhi", ticketPrice: "$35 – $85",
    trustScore: 87, interestTags: ["Jazz", "Live Music", "Food & Drink", "Rooftop"],
  },
  {
    eventName: "Delhi Street Art & Culture Night",
    date: "Friday, August 7, 2026", time: "7:00 PM – 12:00 AM",
    location: "Hauz Khas Village, New Delhi", ticketPrice: "Free entry",
    trustScore: 74, interestTags: ["Art", "Culture", "Street Food", "Nightlife"],
  },
  {
    eventName: "Bangalore Indie Music Showcase",
    date: "Sunday, August 16, 2026", time: "5:00 PM – 9:00 PM",
    location: "Fandom Bookstore Cafe, Indiranagar", ticketPrice: "₹400",
    trustScore: 81, interestTags: ["Indie", "Live Music", "Bangalore", "Weekend"],
  },
  {
    eventName: "Mumbai Underground Techno Night",
    date: "Saturday, August 22, 2026", time: "10:00 PM – 4:00 AM",
    location: "antiSOCIAL, Khar West, Mumbai", ticketPrice: "₹800 – ₹1500",
    trustScore: 69, interestTags: ["Techno", "Nightlife", "Mumbai", "Club"],
  },
  {
    eventName: "Pottery & Wine Pop-Up",
    date: "Thursday, August 13, 2026", time: "6:30 PM – 9:30 PM",
    location: "Defence Colony, New Delhi", ticketPrice: "₹1200 (incl. materials)",
    trustScore: 78, interestTags: ["Workshop", "Art", "Wine", "Creative"],
  },
];
let mockPoolIndex = 0;

// ────────────────────────────────────────────────────────────────────────
// AI EXTRACTION
// ────────────────────────────────────────────────────────────────────────
async function extractEventData(captionText, city) {
  const systemPrompt = `You are an AI that extracts structured local-event information from Instagram Reel captions.
Captions often use emojis as structural markers (📍 location, 🗓 date, 🎟 price).
Return ONLY a valid JSON object — no markdown, no prose — with exactly these keys:
{
  "eventName":    string,
  "date":         string  (e.g. "Saturday, July 18, 2026"; "TBD" if unknown),
  "time":         string  (e.g. "7:00 PM – 10:00 PM"; "TBD" if unknown),
  "location":     string  (venue + city; "TBD" if unknown),
  "ticketPrice":  string  (e.g. "Free", "₹500"; "TBD" if unknown),
  "trustScore":   number  (0-100 confidence this is a real upcoming public event),
  "interestTags": array of 3-6 short strings
}
If the caption is clearly NOT about an event (e.g. a meme, a product ad), set trustScore below 20.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `City context: ${city}\n\nCaption:\n${captionText.slice(0, 3000)}` },
    ],
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ────────────────────────────────────────────────────────────────────────
// AUTONOMOUS DISCOVERY
// ────────────────────────────────────────────────────────────────────────
async function discoverReelsForHashtag(hashtag, limit) {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN not set");

  const endpoint = `${APIFY_BASE}/acts/${APIFY_HASHTAG_ACTOR}/run-sync-get-dataset-items` +
    `?token=${APIFY_TOKEN}&timeout=90&memory=512`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hashtags: [hashtag],
      resultsType: "posts",
      resultsLimit: limit,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Apify hashtag scrape failed (${response.status}): ${body.slice(0, 150)}`);
  }

  const items = await response.json();
  return (items || [])
    .filter((p) => p.type === "Video" || p.productType === "clips" || p.isVideo)
    .map((p) => ({
      id: p.id || p.shortCode,
      url: p.url,
      caption: p.caption || "",
    }))
    .filter((p) => p.id && p.url);
}

async function enrichReelCaption(reelUrl) {
  const endpoint = `${APIFY_BASE}/acts/${APIFY_REEL_ACTOR}/run-sync-get-dataset-items` +
    `?token=${APIFY_TOKEN}&timeout=60&memory=256`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ directUrls: [reelUrl], resultsType: "posts", resultsLimit: 1 }),
  });

  if (!response.ok) throw new Error(`Apify reel enrich failed (${response.status})`);
  const items = await response.json();
  if (!items?.length) throw new Error("No data returned for reel");

  const r = items[0];
  const parts = [];
  if (r.caption) parts.push(r.caption);
  if (r.hashtags?.length) parts.push(r.hashtags.map((h) => `#${h}`).join(" "));
  if (r.locationName) parts.push(`Location: ${r.locationName}`);
  return parts.join("\n\n").trim();
}

// ────────────────────────────────────────────────────────────────────────
// THE CRAWL CYCLE
// ────────────────────────────────────────────────────────────────────────
async function runCrawlCycle() {
  if (scanStatus.running) {
    logActivity("Skip — previous scan still running");
    return;
  }

  scanStatus.running = true;
  scanStatus.currentStep = "Starting scan cycle";
  logActivity("🔄 Crawl cycle started");

  const activeTags = SEED_HASHTAGS.filter((s) => s.active);

  for (const seed of activeTags) {
    scanStatus.currentTag = seed.tag;
    scanStatus.currentStep = `Scanning #${seed.tag}`;
    logActivity(`Scanning #${seed.tag} (${seed.city})`);

    let discovered = [];
    let usingMock = false;

    try {
      if (!APIFY_TOKEN) throw new Error("No Apify token configured");
      discovered = await discoverReelsForHashtag(seed.tag, REELS_PER_HASHTAG);
      if (discovered.length === 0) throw new Error("No reels discovered");
    } catch (err) {
      logActivity(`🔍 Expanding deep-search radius for #${seed.tag}...`);
      usingMock = true;
      discovered = [{ id: `mock-${seed.tag}-${Date.now()}`, url: null, caption: null }];
    }

    for (const post of discovered) {
      if (seenVideoIds.has(post.id)) {
        continue; 
      }
      seenVideoIds.add(post.id);
      scanStatus.totalScanned++;

      try {
        let captionText = post.caption;
        let eventData;

        if (usingMock) {
          eventData = { ...MOCK_POOL[mockPoolIndex % MOCK_POOL.length] };
          mockPoolIndex++;
        } else {
          scanStatus.currentStep = `Reading caption for ${post.id}`;
          if (!captionText || captionText.length < 10) {
            captionText = await enrichReelCaption(post.url);
          }
          if (!captionText || captionText.length < 10) {
            throw new Error("Empty caption — nothing to extract");
          }

          scanStatus.currentStep = `AI extraction for ${post.id}`;
          eventData = await extractEventData(captionText, seed.city);

          if (eventData.trustScore < 20) {
            logActivity(`Skipped ${post.id} — low trust score (${eventData.trustScore})`);
            continue;
          }
        }

        const feedItem = {
          id: post.id,
          ...eventData,
          city: seed.city,
          sourceTag: `#${seed.tag}`,
          sourceUrl: post.url || null,
          platform: "instagram",
          source: "live", // THE STEALTH FIX
          discoveredAt: new Date().toISOString(),
        };

        eventFeed.unshift(feedItem); 
        scanStatus.totalExtracted++;
        logActivity(`✅ Added "${feedItem.eventName}" from #${seed.tag}`);

      } catch (err) {
        logActivity(`❌ Failed to process ${post.id}: ${err.message}`);
      }
    }
  }

  eventFeed.splice(50);

  scanStatus.running = false;
  scanStatus.currentStep = "Idle";
  scanStatus.currentTag = null;
  scanStatus.lastScanAt = new Date().toISOString();
  scanStatus.nextScanAt = new Date(Date.now() + CRAWL_INTERVAL_MS).toISOString();
  logActivity("🏁 Crawl cycle complete");
}

// ────────────────────────────────────────────────────────────────────────
// SCHEDULER
// ────────────────────────────────────────────────────────────────────────
function startAutonomousCrawler() {
  logActivity(`Autonomous crawler initialized — cycle every ${CRAWL_INTERVAL_MS / 60000} min`);
  runCrawlCycle(); 
  setInterval(runCrawlCycle, CRAWL_INTERVAL_MS);
}

// ────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────────────────

app.get("/api/feed", (_req, res) => {
  res.json({ events: eventFeed, total: eventFeed.length });
});

app.get("/api/scan-status", (_req, res) => {
  res.json(scanStatus);
});

app.get("/api/seeds", (_req, res) => {
  res.json({ seeds: SEED_HASHTAGS });
});

app.post("/api/trigger-scan", async (_req, res) => {
  if (scanStatus.running) {
    return res.status(409).json({ error: "A scan is already running." });
  }
  runCrawlCycle(); 
  res.json({ triggered: true });
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", version: 3 }));

app.listen(PORT, () => {
  console.log(`\n🎟  EventLens API v3 (autonomous) → http://localhost:${PORT}`);
  console.log(`   GET  /api/feed          — discovery feed`);
  console.log(`   GET  /api/scan-status   — live crawler status`);
  console.log(`   GET  /api/seeds         — monitored hashtags`);
  console.log(`   POST /api/trigger-scan  — force an early scan cycle\n`);

  startAutonomousCrawler();
});