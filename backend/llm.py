import os
from google import genai
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def generate_explanation(safest_route, fastest_route, mode):
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    safest_hazards = [h["type"] for h in safest_route["hazards"]]
    fastest_hazards = [h["type"] for h in fastest_route["hazards"]]
    
    # Remove duplicates
    safest_hazards = list(set(safest_hazards))
    fastest_hazards = list(set(fastest_hazards))
    
    import re
    
    # Extract and clean up to 4 major steps from the safest route
    raw_steps = safest_route.get("route_data", {}).get("steps", [])
    step_instructions = []
    for step in raw_steps[:4]:
        # Strip HTML tags like <b> from the Google Maps instructions
        clean_text = re.sub(r'<[^>]+>', '', step.get("html_instructions", ""))
        distance = step.get("distance", {}).get("text", "")
        if clean_text:
            step_instructions.append(f"{clean_text} ({distance})")
            
    steps_str = "\n".join(step_instructions) if step_instructions else "Follow the main road."

    prompt = f"""
    You are an interactive AI voice assistant for the 'SafePath Live' navigation app.
    The user just asked for a {mode} route. We have analyzed the options.
    
    Fastest Route Hazards: {fastest_hazards}
    Safest Route Hazards: {safest_hazards}
    
    Safest Route Initial Steps:
    {steps_str}
    
    Provide a friendly, conversational spoken response (3-4 sentences max). 
    Start by briefly confirming you found the safest route and why it's safer. 
    Then, provide a natural, summarized version of the first few navigation steps to get them started (e.g., "To start, walk straight on 5th Ave for 0.5 miles, then turn left...").
    Do not use markdown, emojis, or bullet points since this will be read aloud by a Text-to-Speech engine.
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
    )
    
    return response.text.strip()
