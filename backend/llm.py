import os
from google import genai
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def generate_explanation(safest_route, fastest_route, mode):
    client = genai.Client(vertexai=True, project='cinemamatch', location='us-central1')
    
    safest_hazards = [h["type"] for h in safest_route["hazards"]]
    fastest_hazards = [h["type"] for h in fastest_route["hazards"]]
    
    # Remove duplicates
    safest_hazards = list(set(safest_hazards))
    fastest_hazards = list(set(fastest_hazards))
    
    prompt = f"""
    You are an interactive AI voice assistant for the 'SafePath Live' navigation app.
    The user just asked for a {mode} route. We have analyzed the options.
    
    Fastest Route: {fastest_route.get('duration', {}).get('text')} - Hazards: {fastest_hazards}
    Safest Route: {safest_route.get('duration', {}).get('text')} - Hazards: {safest_hazards}
    
    Provide a friendly, conversational spoken response (2-3 sentences max). 
    Start by confirming you found the safest route, briefly mention why it's better than the fastest route based on the hazards, and keep the tone helpful and natural.
    Do not use markdown, emojis, or bullet points since this will be read aloud by a Text-to-Speech engine.
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
    )
    
    return response.text.strip()
