# 🛡️ SafePath Live

SafePath Live is an AI-powered, safety-first navigation application designed to prioritize user security over pure speed. It analyzes potential routes between two locations and highlights hazards, dynamically scoring paths to help pedestrians and cyclists choose the safest journey.

**Built by Team ByteForge**
- Swati Singh
- Riddhi Shrama
- Simranjeet Singh

## ✨ Key Features

- **Safety-First Routing**: Utilizes a custom heuristic engine to score Google Maps routes based on live hazard data and historical NYPD complaints.
- **Live NYC Open Data Integration**: Dynamically fetches Year-To-Date (YTD) NYPD complaint statistics to penalize routes traveling through high-crime corridors.
- **Interactive Voice Assistant**: Integrated speech recognition allows users to verbally request routes. The app parses travel intent (Origin, Destination, Mode) using Google Gemini 2.5 Flash.
- **Conversational Insights**: The AI engine analyzes the route options and uses the browser's Text-to-Speech (TTS) engine to verbally explain why the recommended route is the safest.
- **Visual Safety Indicators**: Routes are color-coded in a premium UI with highly-detailed route metrics (Lighting, Weather, Time-of-day risks).
- **Real-Time Location**: One-click geolocation tracking to set your starting point securely over HTTPS.

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Google Maps Javascript API
- **Backend**: FastAPI (Python), Uvicorn
- **AI & NLP**: Google Gemini 2.5 Flash Developer API
- **Infrastructure**: Google Cloud Run (Single Container Deployment)

## 🚀 Getting Started

### Prerequisites
- Python 3.10+
- Node.js (v18+)

### Environment Setup

1. Create a `.env` file in the root directory:
   ```env
   GOOGLE_MAPS_API_KEY=your_maps_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Running Locally

We have configured the application for a streamlined local development experience.

1. **Start the Backend (FastAPI)**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r ../requirements.txt
   python main.py
   ```
   The backend will run on `http://localhost:8000`.

2. **Start the Frontend (React)**
   Open a new terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.
