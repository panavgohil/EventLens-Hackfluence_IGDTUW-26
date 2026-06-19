# 🎟️ EventLens

### Surface the Hidden Event

> Thousands of local events are announced every day through Instagram Reels, YouTube Shorts, and other short-form content platforms. Most of these events never make it to traditional event discovery platforms, making them difficult for people to find.
>
> **EventLens** uses AI to automatically extract event information from short-form content and transform it into structured, searchable event listings.

🚀 Built for **Hackfluence IGDTUW 2026**

---

## 🌟 Problem Statement

Local events are often promoted only through:

- Instagram Reels
- YouTube Shorts
- Social Media Stories
- Influencer Content
- Community Creator Posts

These events remain invisible to major event discovery platforms because the information is locked inside videos and captions.

As a result:

- Event organizers struggle with discoverability.
- Users miss opportunities happening around them.
- Valuable community events remain hidden from the audience that would love to attend them.

---

## 💡 Solution

EventLens acts as an AI-powered event discovery engine.

The platform:

1. Ingests public short-form content.
2. Extracts captions, transcripts, and metadata.
3. Uses AI to identify event details.
4. Converts unstructured content into structured event records.
5. Displays events in an easy-to-browse discovery feed.

### Example

Input:

> "Delhi Startup Meetup this Saturday at Connaught Place from 5 PM onwards. Free registration link in bio."

EventLens extracts:

```json
{
  "eventName": "Delhi Startup Meetup",
  "location": "Connaught Place",
  "date": "Saturday",
  "time": "5 PM",
  "category": "Networking",
  "price": "Free"
}
```

and publishes it as a discoverable event listing.

---

# ✨ Features

### 🎥 Multi-Platform Content Processing

- YouTube Shorts support
- Instagram Reels support
- Public content ingestion
- Transcript and caption extraction

### 🤖 AI-Powered Event Extraction

- Event title extraction
- Date detection
- Time extraction
- Venue identification
- Event category classification
- Description generation
- Structured JSON output

### 📍 Event Discovery Feed

- Clean event cards
- Organized metadata display
- Fast browsing experience

### ⚡ Lightweight Prototype

- Simple frontend architecture
- Express backend
- GPT-powered extraction pipeline

---

# 🏗️ Architecture

```text
          ┌─────────────────────┐
          │ Instagram Reel URL  │
          └──────────┬──────────┘
                     │
                     ▼
              Apify Scraper
                     │
                     ▼
           Caption / Metadata
                     │
                     ▼

          ┌─────────────────────┐
          │ YouTube Shorts URL  │
          └──────────┬──────────┘
                     │
                     ▼
          Transcript Extraction
                     │
                     ▼

            Combined Content
                     │
                     ▼
              GPT-4o Mini
                     │
                     ▼
        Structured Event JSON
                     │
                     ▼
            Event Discovery Feed
```

---

# 🛠️ Tech Stack

## Frontend

- HTML5
- Vanilla JavaScript
- Tailwind CSS

## Backend

- Node.js
- Express.js

## AI & Data

- OpenAI GPT-4o Mini
- Apify API
- youtube-transcript

---

# 📂 Project Structure

```text
EventLens-Hackfluence_IGDTUW-26/
│
├── index.html
├── script.js
├── styles.css
│
├── server.js
├── package.json
├── package-lock.json
├── .env
├── README.md
│
└── assets/
```

---

# ⚙️ Getting Started

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/panavgohil/EventLens-Hackfluence_IGDTUW-26.git

cd EventLens-Hackfluence_IGDTUW-26
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Create Environment Variables

Create a `.env` file in the root directory.

```env
OPENAI_API_KEY=sk-your-openai-key

APIFY_API_TOKEN=apify_api_your-apify-token
```

---

## 4️⃣ Start the Backend Server

```bash
npm run dev
```

The backend will start on:

```text
http://localhost:3001
```

---

## 5️⃣ Launch the Frontend

Simply open:

```text
index.html
```

in any modern web browser.

You can now paste:

- Instagram Reel URLs
- YouTube Shorts URLs

and test the complete extraction workflow.

---

# 🔄 How It Works

### Step 1

User submits a Reel or Shorts URL.

↓

### Step 2

EventLens extracts:

- Video transcript
- Caption text
- Metadata

↓

### Step 3

GPT-4o Mini analyzes the content.

↓

### Step 4

Event information is extracted into structured JSON.

↓

### Step 5

Events are displayed as discoverable cards in the feed.

---

# 🎯 Why EventLens?

Today, discovering local events is surprisingly difficult.

Most event discovery platforms rely on:

- Manual submissions
- Paid promotions
- Dedicated event websites

However, creators increasingly announce events directly through short-form content.

EventLens bridges this gap by transforming social content into searchable event data.

This allows:

- Event organizers to reach larger audiences
- Users to discover more local experiences
- Communities to become more connected

---

# 🚀 Future Roadmap

### Phase 1

- More social media integrations
- Better event categorization
- Improved extraction accuracy

### Phase 2

- User authentication
- Saved events
- Personalized recommendations
- Search and filtering

### Phase 3

- Mobile application
- Real-time notifications
- Ticket booking integrations
- Event verification system
- Creator dashboard

---

# 🌍 Vision

Our long-term vision is to become:

> **"The Event Discovery Layer for the Creator Economy."**

A platform where users can effortlessly discover local experiences hidden inside the internet's massive stream of short-form content.

---

# 👨‍💻 Team

Built with ❤️ during **Hackfluence IGDTUW 2026**

### Team Members

- Panav Gohil
- Team Member 2
- Team Member 3

---

# 🤝 Contributing

Contributions, suggestions, and feature requests are welcome.

Feel free to:

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request

---

# 📜 License

This project was developed as a hackathon prototype for educational and demonstration purposes.

---

## ⭐ Support

If you like the idea, consider giving the repository a star.

It helps us grow and motivates us to continue building.

---

# 🎟️ EventLens

### Discover events hidden inside the internet's short-form content.