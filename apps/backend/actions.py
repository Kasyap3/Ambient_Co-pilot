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
  "action_type": "open_url" or "save_note" or "navigate_page" or "highlight_text" or null,
  "intent": "book_flight", "draft_email", "save_note", "scroll_to", "highlight_fact" etc.,
  "entities": {
    "origin": "NYC",
    "target_text": "Pricing",
    "highlight_snippet": "Actual text to highlight",
    "scroll_direction": "down" or "up",
    "email_recipient": "boss@example.com",
    "note_content": "Note content",
    "other": {}
  },
  "url": "full URL" or null,
  "simple_message": "brief opening message",
  "proactive_message": "detailed message"
}

Be smart about:
- If user input says "Explain this context: '...'", treat it as a "highlight_text" action.
- Extract the snippet from between the quotes to highlight.

Examples:

User: "Explain this context: 'The total is $500'"
Response:
{
  "action_detected": true,
  "action_type": "highlight_text",
  "intent": "highlight_fact",
  "entities": {
    "highlight_snippet": "The total is $500"
  },
  "url": null,
  "simple_message": "Analyzing the selection...",
  "proactive_message": "I'm highlighting that section for you while I explain it! ✨"
}

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
  "proactive_message": "I'm scrolling down to find the Pricing section! 🖱️"
}

User: "Save a note that this laptop is $999"
Response:
{
  "action_detected": true,
  "action_type": "save_note",
  "intent": "save_note",
  "entities": {
    "note_content": "Laptop price: $999"
  },
  "url": null,
  "simple_message": "Saving note...",
  "proactive_message": "I've saved that to your memory bank! 🧠"
}
"""

def enhance_with_preferences(result, preferences):
    """Add proactive personality based on preferences"""
    proactive = result.get('proactive_message', '')
    
    if 'budget' in preferences and result.get('intent') == 'book_flight':
        proactive += "\\n\\n💰 I remember you prefer budget options, so I'll help you find the best deals!"
    
    if 'nature' in preferences and result.get('intent') == 'book_hotel':
        proactive += "\\n\\n🌲 Since you love nature, should I prioritize places near parks or outdoor areas?"
    
    result['proactive_message'] = proactive
    return result

def detect_action_with_llm(user_input: str, context: dict) -> dict:
    """Use LLM to detect intent and extract entities"""
    conversation_history = context.get('conversation_history', [])
    memory = context.get('memory', {})
    preferences = memory.get('preferences', []) if isinstance(memory, dict) else []
    
    history_text = ""
    for msg in conversation_history[-5:]:
        role = msg.get('role', 'user') if isinstance(msg, dict) else 'user'
        content = msg.get('content', str(msg)) if isinstance(msg, dict) else str(msg)
        history_text += f"{role.upper()}: {content}\\n"
    
    analysis_prompt = f"Current user input: \"{user_input}\"\\n\\nRecent conversation:\\n{history_text}\\n\\nUser preferences: {', '.join(preferences)}\\n\\nAnalyze this input and detect actions."

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": analysis_prompt}
            ],
            temperature=0,
            max_tokens=500
        )
        
        result_text = response.choices[0].message.content.strip()
        if '```' in result_text:
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'): result_text = result_text[4:]
            result_text = result_text.strip()
            
        result = json.loads(result_text)
        if result.get('action_detected'):
            result = enhance_with_preferences(result, preferences)
            print(f"✅ Action: {result['intent']}")
        return result
    except Exception as e:
        print(f"❌ Detection Error: {e}")
        return {"action_detected": false}

def detect_action(user_input: str, context: dict) -> dict:
    """Main entry point"""
    result = detect_action_with_llm(user_input, context)
    if result and result.get('action_detected'):
        return {
            'action_type': result.get('action_type'),
            'url': result.get('url'),
            'message': result.get('simple_message'),
            'proactive_message': result.get('proactive_message'),
            'intent': result.get('intent'),
            'entities': result.get('entities')
        }
    return None
