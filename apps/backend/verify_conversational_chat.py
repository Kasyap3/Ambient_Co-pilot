import httpx
import json

def test_assist_chat(message, history, context, url):
    endpoint = "http://localhost:8000/assist-chat"
    payload = {
        "user_message": message,
        "page_info": {
            "url": url,
            "title": "Page Title",
            "text": "Check out these flight options from NYC to SFO. Select dates and travelers."
        },
        "context": context,
        "conversation_history": history
    }
    
    print(f"\nUser: {message}")
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(endpoint, json=payload)
            response.raise_for_status()
            data = response.json()
            print(f"Assistant: {data.get('message')}")
            if data.get('action'):
                print(f"Action: {json.dumps(data.get('action'), indent=2)}")
            return data
    except Exception as e:
        print(f"Error: {e}")
        return None

if __name__ == "__main__":
    url = "https://www.google.com/flights"
    context = {
        "original_query": "I want to book a flight from NYC to SFO",
        "preferences": ["budget"]
    }
    
    # 1. Initial proactive message (simulated)
    history = [
        {"role": "assistant", "content": "I've opened Google Flights for you! 🛫\n\nI can see you want to fly from NYC to SFO. Let me help you complete this booking.\n\nWhat are your travel dates?"}
    ]
    
    # 2. User provides dates
    msg = "January 12 to February 12"
    resp = test_assist_chat(msg, history, context, url)
    if resp:
        history.append({"role": "user", "content": msg})
        history.append({"role": "assistant", "content": resp['message']})
        
        # 3. User responds to next question (e.g., budget)
        msg = "My budget is around $1000"
        resp = test_assist_chat(msg, history, context, url)
        if resp:
            history.append({"role": "user", "content": msg})
            history.append({"role": "assistant", "content": resp['message']})
            
            # 4. Final confirmation
            msg = "Yes please, fill the form!"
            test_assist_chat(msg, history, context, url)
