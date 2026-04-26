import os
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def fetch_routes(origin: str, destination: str, mode: str):
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        raise ValueError("Missing GOOGLE_MAPS_API_KEY")

    # Mode mapping
    transit_mode = "bicycling" if mode.lower() == "cyclist" else "walking"
    
    url = f"https://maps.googleapis.com/maps/api/directions/json"
    params = {
        "origin": origin,
        "destination": destination,
        "mode": transit_mode,
        "alternatives": "true",
        "key": api_key
    }
    
    response = requests.get(url, params=params)
    data = response.json()
    
    if data.get("status") != "OK":
        status = data.get("status")
        if status == "ZERO_RESULTS":
            raise ValueError(f"No {transit_mode} route could be found between these two locations.")
        elif status == "NOT_FOUND":
            raise ValueError("One or both of the locations could not be found. Please be more specific.")
        else:
            raise ValueError(f"Google API Error: {status} - {data.get('error_message', '')}")
        
    routes = []
    for r in data["routes"]:
        leg = r["legs"][0]
        routes.append({
            "overview_polyline": r["overview_polyline"]["points"],
            "bounds": r["bounds"],
            "distance": leg["distance"],
            "duration": leg["duration"],
            "steps": leg["steps"]
        })
    return routes
