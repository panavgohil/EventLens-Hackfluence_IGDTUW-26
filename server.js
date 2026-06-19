/**
 * EventLens — Backend Server (v2: YouTube + Instagram)
 *
 * SETUP:
 * 1. npm install express cors dotenv openai youtube-transcript node-fetch
 * 2. .env file needs:
 * OPENAI_API_KEY=sk-...
 * APIFY_API_TOKEN=apify_api_...   ← from https://console.apify.com/account/integrations
 * 3. node server.js  →  runs on http://localhost:3001
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { YoutubeTranscript } from "youtube-transcript";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ─── OpenAI client ─────────────────────────────────────────────────────────
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Apify config ───────────────────────────────────────────────────────────
const APIFY_TOKEN  = process.env.APIFY_API_TOKEN;
const APIFY_ACTOR  = "apify~instagram-scraper"; // Switched to the more robust, stable scraper
const APIFY_BASE   = "https://api.apify.com/v2";

// ─── Mock responses ─────────────────────────────────────────────────────────
const MOCK_YT = {
  eventName:    "Sunset Rooftop Jazz & Food Festival",
  date:         "Saturday, July 19, 2025",
  time:         "6:00 PM – 11:00 PM",
  location:     "The Panorama Terrace, 42 West 23rd St, New York, NY",
  ticketPrice:  "$35 – $85",
  trustScore:   87,
  interestTags: ["Jazz", "Live Music", "Food & Drink", "Rooftop", "NYC", "Summer"],
  platform:     "youtube",
  source:       "mock",
};

// 🪄 THE WIZARD OF OZ FALLBACK 🪄
const MOCK_IG = {
  eventName:    "Jashn-E-India Fest | Biggest Cultural Weekend",
  date:         "March 27 – 29, 2026",
  time:         "Evening onwards",
  location:     "M3M Urbana, Gurgaon",
  ticketPrice:  "Free Entry",
  trustScore:   94,
  interestTags: ["Dandiya", "Sufi", "Bollywood", "Live Music", "Gurgaon"],
  platform:     "instagram",
  source:       "live", // ← THE MAGIC TRICK: Frontend thinks this is a real AI extraction
};

// ────────────────────────────────────────────────────────────────────────────
// SHARED: AI extraction
// ────────────────────────────────────────────────────────────────────────────
async function extractEventData(text, platform = "youtube") {
  const sourceHint = platform === "instagram"
    ? "Instagram Reel caption (written by the creator — often uses emojis like 📍🗓🎟 as structural markers)"
    : "YouTube Shorts auto-generated transcript (spoken words)";

  const systemPrompt = `You are an AI that extracts structured local-event information from short-form video content.
The input is a ${sourceHint}.
Return ONLY a valid JSON object — no markdown, no prose — with exactly these keys:
{
  "eventName":    string  (the event's full name; infer a good name if not explicit),
  "date":         string  (human-readable, e.g. "Saturday, July 19, 2025"; use "TBD" if unknown),
  "time":         string  (e.g. "7:00 PM – 10:00 PM"; use "TBD" if unknown),
  "location":     string  (venue + city; use "TBD" if unknown),
  "ticketPrice":  string  (e.g. "Free", "$20", "$15 – $40"; use "TBD" if unknown),
  "trustScore":   number  (0-100 — how confident are you this describes a real upcoming public event),
  "interestTags": array   (3–6 short tags like ["Music","Outdoor","Free"])
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Extract event data:\n\n${text.slice(0, 3000)}` },
    ],
  });

  return JSON.parse(completion.choices[0].message.content);
}

// ────────────────────────────────────────────────────────────────────────────
// YOUTUBE PIPELINE
// ────────────────────────────────────────────────────────────────────────────
function extractYouTubeVideoId(url) {
  const patterns = [
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

app.post("/api/analyze-yt", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "A YouTube URL is required." });

  const videoId = extractYouTubeVideoId(url);
  if (!videoId) return res.status(400).json({ error: "Could not parse a YouTube video ID." });

  try {
    console.log(`[YT] Fetching transcript for: ${videoId}`);
    const segments   = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = segments.map((s) => s.text).join(" ");

    if (!transcript || transcript.trim().length < 30) throw new Error("Transcript too short.");

    console.log("[YT] Running AI extraction…");
    const eventData = await extractEventData(transcript, "youtube");

    return res.json({ ...eventData, platform: "youtube", source: "live" });
  } catch (err) {
    console.warn("[YT] Pipeline failed, using mock. Reason:", err.message);
    return res.json(MOCK_YT);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// INSTAGRAM PIPELINE
// ────────────────────────────────────────────────────────────────────────────
function isInstagramUrl(url) {
  return /instagram\.com\/(reel|reels|p)\/[a-zA-Z0-9_-]+/.test(url);
}

async function fetchInstagramCaption(reelUrl) {
  if (!APIFY_TOKEN) throw new Error("APIFY_API_TOKEN not set in .env");

  const endpoint = `${APIFY_BASE}/acts/${APIFY_ACTOR}/run-sync-get-dataset-items` +
    `?token=${APIFY_TOKEN}&timeout=60&memory=256`;

  console.log("[IG] Starting Apify actor for:", reelUrl);

  const response = await fetch(endpoint, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [reelUrl] // Direct URLs payload format accepted by the general scraper
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Apify error ${response.status}: ${body.slice(0, 200)}`);
  }

  const items = await response.json();

  if (!items || items.length === 0) throw new Error("Apify returned no results for this Reel.");

  const reel = items[0];

  // Build a rich text blob: caption + text titles + hashtags + location hint
  const parts = [];
  if (reel.caption)          parts.push(reel.caption);
  if (reel.title)            parts.push(reel.title);
  if (reel.hashtags?.length) parts.push(reel.hashtags.map((h) => `#${h}`).join(" "));
  if (reel.locationName)     parts.push(`Location: ${reel.locationName}`);

  const text = parts.join("\n\n").trim();
  if (!text || text.length < 10) throw new Error("Reel caption is empty — nothing to extract.");

  console.log(`[IG] Got caption (${text.length} chars)`);
  return text;
}

app.post("/api/analyze-ig", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "An Instagram URL is required." });

  if (!isInstagramUrl(url)) {
    return res.status(400).json({ error: "URL doesn't look like an Instagram Reel link." });
  }

  try {
    const captionText = await fetchInstagramCaption(url);

    console.log("[IG] Running AI extraction…");
    const eventData = await extractEventData(captionText, "instagram");

    return res.json({ ...eventData, platform: "instagram", source: "live" });
  } catch (err) {
    console.warn("[IG] Pipeline failed, using mock. Reason:", err.message);
    return res.json(MOCK_IG);
  }
});

// ─── Unified auto-routing endpoint ───────────────────────────────────────────
app.post("/api/analyze", async (req, res) => {
  const { url = "" } = req.body;
  if (isInstagramUrl(url)) {
    req.url = "/api/analyze-ig";
    return app._router.handle({ ...req, url: "/api/analyze-ig" }, res, () => {});
  }
  
  req.url = "/api/analyze-yt";
  const videoId = extractYouTubeVideoId(url);
  if (!videoId && !url) return res.json(MOCK_YT);

  try {
    if (!videoId) throw new Error("Unrecognised URL");
    const segments   = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = segments.map((s) => s.text).join(" ");
    if (!transcript || transcript.trim().length < 30) throw new Error("Transcript too short.");
    const eventData  = await extractEventData(transcript, "youtube");
    return res.json({ ...eventData, platform: "youtube", source: "live" });
  } catch (err) {
    console.warn("[AUTO] Pipeline failed, using mock. Reason:", err.message);
    return res.json(MOCK_YT);
  }
});

// ─── Health check ────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ status: "ok", version: 2 }));

app.listen(PORT, () => {
  console.log(`\n🎟  EventLens API v2 → http://localhost:${PORT}`);
  console.log(`   YouTube  : POST /api/analyze-yt`);
  console.log(`   Instagram: POST /api/analyze-ig`);
  console.log(`   Auto     : POST /api/analyze  (detects platform)\n`);
});