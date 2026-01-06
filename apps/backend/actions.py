"""
LLM-Powered Action Detection
Uses GPT to understand intent and extract entities
Much more robust than regex/keywords
"""

import json
import openai
import os

client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = """You are an intelligent action detector for a browsing assistant.

Your job is to determine if the user wants to take an action (open a website, book something, search, etc.) and extract all relevant details.

Analyze the user's input and conversation history to:
1. Detect if they want to take an action
2. Extract all relevant entities (origin, destination, dates, budget, preferences, etc.)
3. Determine the best URL to open
4. Generate a helpful proactive message

Respond ONLY with valid JSON in this exact format:
{
  "action_detected": true/false,
  "action_type": "open_url" or "save_note" or "navigate_page" or null,
  "intent": "book_flight", "draft_email", "save_note", "scroll_to", "click_element" etc.,
  "entities": {
    "origin": "NYC",
    "target_text": "Pricing" (for navigation),
    "scroll_direction": "down" or "up" or null,
    "email_recipient": "boss@example.com",
    "note_content": "The camera costs $500...",
    "other": {}
  },
  "url": "full URL to open (including mailto:)" or null,
  "simple_message": "brief opening message",
  "proactive_message": "detailed contextual message for floating assistant"
}

Examples:

User: "Take me to the pricing section"
Response:
{
  "action_detected": true,
  "action_type": "navigate_page",
  "intent": "scroll_to",
  "entities": {
    "target_text": "Pricing",
    "scroll_direction": "down"
  },
  "url": null,
  "simple_message": "Scrolling to pricing...",
  "proactive_message": "I'm scrolling down to find the Pricing section for you! 🖱️"
}

User: "Save a note that this laptop is $999"
Response:
{
  "action_detected": true,
  "action_type": "save_note",
  "intent": "save_note",
  "entities": {
    "note_content": "Laptop price: $999 (from [Current Page Title])",
    "other": {}
  },
  "url": null,
  "simple_message": "Saving note...",
  "proactive_message": "I've saved that to your memory bank! 🧠"
}  "simple_message": "brief opening message",
  "proactive_message": "detailed contextual message for floating assistant"
}

Examples:

User: "Email this summary to my boss at boss@company.com"
Current Page Content: [Summary of camera prices...]
Response:
{
  "action_detected": true,
  "action_type": "open_url",
  "intent": "draft_email",
  "entities": {
    "email_recipient": "boss@company.com",
    "email_subject": "Summary of Camera Prices",
    "email_body": "Hi,\n\nHere is the summary of the camera prices you asked for:\n\n[...summary content...]\n\nBest,\n[User]",
    "other": {}
  },
  "url": "mailto:boss@company.com?subject=Summary%20of%20Camera%20Prices&body=Hi%2C%0A%0AHere%20is%20the%20summary...",
  "simple_message": "Drafting email to your boss...",
  "proactive_message": "I've opened your mail app with a draft summary of the camera prices! 📧\\n\\nYou can edit it before sending."
}

User: "Can you open Google Flights?"
Previous: User discussed NYC to SFO, Jan 12-Feb 12, $1000 budget
Response:
{
  "action_detected": true,
  "action_type": "open_url",
  "intent": "book_flight",
  "entities": {
    "origin": "NYC",
    "destination": "SFO",
    "dates": "January 12 to February 12",
    "budget": "$1000",
    "other": {}
  },
  "url": "https://www.google.com/flights?hl=en#flt=NYC.SFO",
  "simple_message": "Opening Google Flights for you...",
  "proactive_message": "I've opened Google Flights for you! 🛫\\n\\nI can see from our conversation you want to fly from NYC to SFO around January 12 to February 12 with a budget of $1000.\\n\\nLet me check what details are needed on this page... What dates work best for you?"
}

User: "Show me hotels in SF"
Response:
{
  "action_detected": true,
  "action_type": "open_url",
  "intent": "book_hotel",
  "entities": {
    "destination": "San Francisco",
    "other": {}
  },
  "url": "https://www.airbnb.com/s/San-Francisco",
  "simple_message": "Opening Airbnb for San Francisco...",
  "proactive_message": "I've opened Airbnb for San Francisco! 🏠\\n\\nWould you like me to help you fill in check-in dates and guest details?"
}

User: "What's the weather like today?"
Response:
{
  "action_detected": false,
  "action_type": null,
  "intent": null,
  "entities": {},
  "url": null,
  "simple_message": null,
  "proactive_message": null
}

Be smart about extracting context from conversation history!"""


def detect_action_with_llm(user_input: str, context: dict) -> dict:
    """
    Use LLM to detect intent and extract entities
    Much more robust than regex
    """
    
    # Build context for LLM
    conversation_history = context.get('conversation_history', [])
    memory = context.get('memory', {})
    preferences = []
    if hasattr(memory, 'preferences'):
        preferences = memory.preferences
    elif isinstance(memory, dict):
        preferences = memory.get('preferences', [])
    
    # Format conversation history
    history_text = ""
    for msg in conversation_history[-5:]:  # Last 5 messages
        if hasattr(msg, 'role') and hasattr(msg, 'content'):
            role = msg.role
            content = msg.content
        elif isinstance(msg, dict):
            role = msg.get('role', 'user')
            content = msg.get('content', '')
        else:
            role = 'user'
            content = str(msg)
        history_text += f"{role.upper()}: {content}\\n"
    
    # Build the analysis prompt
    analysis_prompt = f"""Current user input: "{user_input}"

Recent conversation:
{history_text}

User preferences: {', '.join(preferences) if preferences else 'None'}

Analyze this input and determine if the user wants to take an action. Extract all relevant entities from the current input AND conversation history."""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0.3,  # Lower temperature for more consistent JSON
            max_tokens=500
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse JSON response
        # Remove markdown code blocks if present
        if result_text.startswith('```'):
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
            result_text = result_text.strip()
        
        result = json.loads(result_text)
        
        # If action detected, enhance with preferences
        if result.get('action_detected'):
            result = enhance_with_preferences(result, preferences)
            print(f"✅ Action detected: {result['intent']}")
            print(f"📍 Entities: {result['entities']}")
            print(f"🔗 URL: {result['url']}")
        else:
            print("❌ No action detected")
        
        return result
        
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        print(f"Response was: {result_text}")
        return None
    except Exception as e:
        print(f"❌ Error in LLM action detection: {str(e)}")
        import traceback
        traceback.print_exc()
        return None


def enhance_with_preferences(result: dict, preferences: list) -> dict:
    """
    Enhance proactive message with user preferences
    """
    if not preferences:
        return result
    
    proactive = result.get('proactive_message', '')
    
    # Add preference-based suggestions
    if 'budget' in preferences and result.get('intent') in ['book_flight', 'book_hotel']:
        proactive += "\\n\\n💰 I remember you prefer budget options, so I'll help you find the best deals!"
    
    if 'nature' in preferences and result.get('intent') == 'book_hotel':
        proactive += "\\n\\n🌲 Since you love nature, should I prioritize places near parks or outdoor areas?"
    
    result['proactive_message'] = proactive
    return result


def detect_action(user_input: str, context: dict) -> dict:
    """
    Main entry point - uses LLM for robust detection
    """
    
    # Try LLM-based detection
    result = detect_action_with_llm(user_input, context)
    
    if result and result.get('action_detected'):
        # Convert LLM result to expected format
        return {
            'action_type': result.get('action_type'),
            'url': result.get('url'),
            'message': result.get('simple_message'),
            'proactive_message': result.get('proactive_message'),
            'intent': result.get('intent'),
            'entities': result.get('entities')
        }
    
    # No action detected
    return None
