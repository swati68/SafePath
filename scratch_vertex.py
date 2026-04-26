from google import genai
import sys

def test_vertex():
    try:
        # Use vertex AI. The SDK will automatically pick up application-default credentials
        client = genai.Client(vertexai=True, location='us-central1')
        print("Client initialized. Testing generation...")
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents="Say hello!",
        )
        print("Success! Response:", response.text)
        return True
    except Exception as e:
        print("Error with default project:", e)
        
        # Fallback to specifically requesting cinemamatch
        try:
            print("\nTrying with project='cinemamatch'...")
            client = genai.Client(vertexai=True, project='cinemamatch', location='us-central1')
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents="Say hello!",
            )
            print("Success with cinemamatch! Response:", response.text)
            return True
        except Exception as e2:
            print("Error with cinemamatch project:", e2)
            
            try:
                print("\nTrying with project='safepath-live'...")
                client = genai.Client(vertexai=True, project='safepath-live', location='us-central1')
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents="Say hello!",
                )
                print("Success with safepath-live! Response:", response.text)
                return True
            except Exception as e3:
                print("Error with safepath-live project:", e3)
                return False

if __name__ == "__main__":
    test_vertex()
