# 🛡️ SafePath Live

SafePath Live is an AI-powered, safety-first navigation application designed to prioritize user security over pure speed. It analyzes potential routes between two locations and highlights hazards, dynamically scoring paths to help pedestrians and cyclists choose the safest journey.

## ✨ Key Features

- **Safety-First Routing**: Utilizes a custom heuristic engine to score Google Maps routes based on simulated hazard data.
- **Interactive Voice Assistant**: Integrated speech recognition allows users to verbally request routes. The app parses travel intent (Origin, Destination, Mode) using Google Vertex AI (Gemini 2.5 Flash).
- **Conversational Insights**: The AI engine analyzes the route options and uses the browser's Text-to-Speech (TTS) engine to verbally explain why the recommended route is the safest.
- **Visual Safety Indicators**: Routes are color-coded (Green for Safe, Yellow for Moderate risk, Red for High risk) directly on the map.
- **Real-Time Location**: One-click geolocation tracking to set your starting point.
- **Premium Dark UI**: Built with React and Vanilla CSS for a sleek, responsive, and modern look.

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Google Maps Javascript API
- **Backend**: FastAPI (Python), Uvicorn
- **AI & NLP**: Google Vertex AI (Gemini 2.5 Flash)

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js (v16+)
- A Google Cloud Project with the Maps JavaScript API and Directions API enabled.
- Google Cloud Default Credentials (ADC) configured for Vertex AI.

### Environment Setup

1. Create a `.env` file in the root directory:
   ```env
   GOOGLE_MAPS_API_KEY=your_maps_api_key_here
   # Gemini API Key is supported for legacy use, but Vertex AI is highly recommended.
   ```

2. Ensure you have authenticated with Google Cloud CLI if using Vertex AI:
   ```bash
   gcloud auth application-default login
   ```

### Running the Backend (FastAPI)

1. Navigate to the project root and activate your virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   cd backend
   python main.py
   ```
   The backend will run on `http://localhost:8000`.

### Running the Frontend (React + Vite)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will run on `http://localhost:5173`.

## 🎤 How to Use the Voice Feature
1. Click the blue 🎤 (Microphone) button next to the search bar.
2. Allow microphone permissions in your browser if prompted.
3. Speak your request (e.g., "I want to walk from Times Square to Central Park").
4. The system will automatically parse your intent, fetch the safest route, map it out, and read an AI-generated safety analysis aloud.

## 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License
This project is licensed under the MIT License.
