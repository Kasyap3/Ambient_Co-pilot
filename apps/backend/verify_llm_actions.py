import httpx
import json

def test_ask(query, history, preferences):
    url = "http://localhost:8000/ask"
    payload = {
        "user_input": query,
        "page_text": "Sample text.",
        "page_url": "https://example.com",
        "page_title": "Example",
        "conversation_history": history,
        "memory": {"preferences": preferences, "notes": []}
    }
    
    print(f"\nTesting /ask for query: '{query}'")
    print(f"Context: {len(history)} messages, Prefs: {preferences}")
    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
            if 'action' in data and data['action']:
                print(f"✅ Action: {data['action'].get('type')} - {data['action'].get('intent')}")
                print(f"🔗 URL: {data['action'].get('url')}")
                print(f"💬 Simple: {data.get('reply')}")
                print(f"🤖 Proactive: {data['action'].get('proactive_message')}")
            else:
                print("❌ No action detected")
                print(f"Reply: {data.get('reply')}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Scenario 1: Multi-turn flow
    history = [
        {"role": "user", "content": "I need to book a flight"},
        {"role": "assistant", "content": "I can help! Where are you flying from and to?"},
        {"role": "user", "content": "From NYC to San Francisco"},
        {"role": "assistant", "content": "Great! When would you like to travel?"}
    ]
    query = "Around January 12th to February 12th, budget is $1000"
    test_ask(query, history, ["budget"])

    # Scenario 2: Direct request with context from history
    history = [
        {"role": "user", "content": "I'm looking for a place to stay in Yosemite"},
        {"role": "assistant", "content": "I see! Do you have specific dates or a budget?"},
        {"role": "user", "content": "Maybe next weekend, just for 2 people."}
    ]
    query = "Can you open Airbnb?"
    test_ask(query, history, ["nature"])
