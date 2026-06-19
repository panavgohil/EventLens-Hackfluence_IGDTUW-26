🎟️ EventLens
Surface the hidden event. Thousands of local events live only on short-form posts and Reels, remaining invisible to major platforms. EventLens ingests this public short-form content, uses AI to extract structured event data, and surfaces it on a discovery feed.

Built for Hackfluence IGDTUW 2026

🚀 The Prototype
This repository contains a fully functional Node.js/Vanilla JS prototype demonstrating our core AI extraction pipeline. It supports both YouTube Shorts (via transcript extraction) and Instagram Reels (via Apify scraping).

Tech Stack
Frontend: HTML, Vanilla JavaScript, Tailwind CSS

Backend: Node.js, Express

AI & Data: OpenAI (gpt-4o-mini), Apify API, youtube-transcript

🛠️ How to Run Locally
Clone the repository:

Bash
git clone https://github.com/panavgohil/EventLens-Hackfluence_IGDTUW-26.git
cd EventLens-Hackfluence_IGDTUW-26
Install dependencies:

Bash
npm install
Set up Environment Variables:
Create a .env file in the root directory and add your API keys:

Code snippet
OPENAI_API_KEY=sk-your-openai-key
APIFY_API_TOKEN=apify_api_your-apify-token
Start the backend server:

Bash
npm run dev
The server will run on http://localhost:3001

Launch the app:
Simply open the index.html file in any modern web browser to view the UI and test the extraction pipeline.