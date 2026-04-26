import random

def score_route(route, mode):
    # For the hackathon demo, we evaluate the route based on its steps
    # simulating finding hazards (collisions, unlit streets) along the path.
    
    steps = route.get("steps", [])
    
    # Calculate a base score
    base_score = 1.0 
    hazards = []
    
    # We use a consistent seed based on the polyline so the same route gets the same score
    random.seed(route["overview_polyline"])
    
    risk_factors = 0
    
    for step in steps:
        # 15% chance of a hazard on any given step to ensure variability between routes
        if random.random() < 0.15:
            risk_factors += 1
            lat = step["end_location"]["lat"]
            lng = step["end_location"]["lng"]
            
            if mode.lower() == "cyclist":
                hazard_type = random.choice(["Reported Collision", "Missing Bike Lane", "Pothole"])
                hazards.append({"type": hazard_type, "lat": lat, "lng": lng})
                base_score -= 0.15
            else:
                hazard_type = random.choice(["Unlit Street", "High Crime Density", "Blocked Sidewalk"])
                hazards.append({"type": hazard_type, "lat": lat, "lng": lng})
                base_score -= 0.12

    # Add a slight penalty for longer routes to make comparisons more dynamic
    base_score -= (len(steps) * 0.005)

    # Ensure score bounds
    final_score = max(0.1, min(0.99, base_score))
    
    # Determine label
    if final_score > 0.7:
        label = "Safe"
    elif final_score > 0.4:
        label = "Moderate Risk"
    else:
        label = "High Risk"
        
    return {
        "score": round(final_score, 2),
        "label": label,
        "hazards": hazards
    }
