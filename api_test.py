import os
import requests
from dotenv import load_dotenv

# We load environment variables from .env file
load_dotenv()

# Set up Vertex AI
from google import genai

def test_google_maps():
    print("\n--- Testing Google Maps Directions API ---")
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key or api_key == "your_api_key_here":
        print("❌ Error: GOOGLE_MAPS_API_KEY is not set or is still the default value.")
        return

    # A simple request from Times Square to Central Park
    origin = "Times Square, New York, NY"
    destination = "Central Park, New York, NY"
    url = f"https://maps.googleapis.com/maps/api/directions/json?origin={origin}&destination={destination}&key={api_key}"
    
    try:
        response = requests.get(url)
        data = response.json()
        if data.get("status") == "OK":
            print("✅ Google Maps Directions API: SUCCESS!")
            print(f"   Route found! Distance: {data['routes'][0]['legs'][0]['distance']['text']}")
        else:
            print(f"❌ Google Maps API Error: Status - {data.get('status')}")
            if "error_message" in data:
                print(f"   Message: {data['error_message']}")
    except Exception as e:
        print(f"❌ Failed to reach Google Maps API: {e}")

def test_gemini_api():
    print("\n--- Testing Gemini Developer API ---")
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        print("❌ Error: GEMINI_API_KEY is not set in .env file.")
        return

    try:
        # Initialize the GenAI client with API Key
        client = genai.Client(api_key=api_key)
        
        prompt = "Hello! In one short sentence, why is a protected bike lane safer than a painted one?"
        print(f"   Sending prompt: '{prompt}'")
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        print("✅ Gemini API: SUCCESS!")
        print(f"   Response: {response.text.strip()}")
        
    except Exception as e:
        print("❌ Gemini API Error!")
        print(f"   Details: {e}")

if __name__ == "__main__":
    print("Starting API validations...")
    test_google_maps()
    test_gemini_api()
    print("\nValidation complete.")
