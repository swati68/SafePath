import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import routing
import scoring
import llm

app = FastAPI(title="SafePath Live API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RouteRequest(BaseModel):
    origin: str
    destination: str
    mode: str # "Pedestrian" or "Cyclist"

class VoiceRequest(BaseModel):
    transcript: str

@app.get("/api/config")
async def get_config():
    return {"googleMapsApiKey": os.getenv("GOOGLE_MAPS_API_KEY")}

@app.post("/api/parse-voice")
async def parse_voice(request: VoiceRequest):
    from google import genai
    import json
    
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    prompt = f"""
    Extract the travel intent from this user voice transcript: "{request.transcript}"
    Return ONLY a valid JSON object (no markdown, no backticks) with these exact keys:
    "origin" (string, the starting location, leave empty string if not found)
    "destination" (string, the ending location, leave empty string if not found)
    "mode" (string, either "Pedestrian" or "Cyclist", default to "Pedestrian" if not explicitly mentioned as biking/cycling)
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        return data
    except Exception as e:
        print("Voice parsing error:", e)
        return {"origin": "", "destination": "", "mode": "Pedestrian"}

@app.post("/api/routes")
async def get_routes(request: RouteRequest):
    # 1. Fetch routes from Google Maps
    try:
        raw_routes = routing.fetch_routes(request.origin, request.destination, request.mode)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Routing error: {str(e)}")

    if not raw_routes:
        raise HTTPException(status_code=404, detail="No routes found.")

    # 2. Score each route
    scored_routes = []
    for idx, r in enumerate(raw_routes):
        score_data = scoring.score_route(r, request.mode)
        scored_routes.append({
            "id": idx,
            "route_data": r, 
            "distance": r.get("distance"),
            "duration": r.get("duration"),
            "score": score_data["score"],
            "risk_label": score_data["label"],
            "hazards": score_data["hazards"]
        })

    if not scored_routes:
        raise HTTPException(status_code=404, detail="No valid routes were found for this path.")

    # Sort by duration to find fastest, then by score to find safest
    fastest_route = min(scored_routes, key=lambda x: x["duration"]["value"])
    
    # Sort by score descending
    scored_routes.sort(key=lambda x: x["score"], reverse=True)
    safest_route = scored_routes[0]
    
    # Ensure they aren't the exact same route object memory reference for the frontend
    # if the fastest is also the safest (though our mock engine usually differs them)

    # 3. Generate Explanation
    try:
        explanation = llm.generate_explanation(safest_route, fastest_route, request.mode)
    except Exception as e:
        print("LLM Error:", e)
        explanation = "Error generating AI explanation. However, the safest route avoids high-risk zones and prioritizes better infrastructure."

    return {
        "routes": scored_routes,
        "safest_route_id": safest_route["id"],
        "fastest_route_id": fastest_route["id"],
        "explanation": explanation
    }

# Mount static files at the end so API routes take precedence
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
if os.path.isdir(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve specific files if they exist in dist
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise fallback to index.html for SPA routing
        return FileResponse(os.path.join(frontend_dist, "index.html"))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
