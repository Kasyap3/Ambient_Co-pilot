from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import openai
import os
import json
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

# Import local modules
from memory import extract_preferences
from notes import save_note
from prompts import build_context_prompt
from summarizer import summarize_text
from actions import detect_action

app = FastAPI(title="Ambient Copilot Backend")

# Enable CORS for extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OpenAI setup
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

class Message(BaseModel):
    role: str
    content: str

class Memory(BaseModel):
    preferences: List[str]
    notes: List[str]

class AskRequest(BaseModel):
    user_input: str
    page_text: str
    page_url: str
    page_title: str
    conversation_history: List[Message]
    memory: Memory

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "Ambient Copilot Backend Running",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/ask")
async def ask(request: AskRequest):
    """Main endpoint for processing user queries with page context"""
    try:
        # Extract any new preferences
        updated_memory = extract_preferences(request.user_input, request.memory)
        
        # Summarize page text if too long
        page_summary = summarize_text(request.page_text)
        
        # Pack context into structured prompt
        context = {
            "page_title": request.page_title,
            "page_url": request.page_url,
            "page_summary": page_summary,
            "user_input": request.user_input,
            "conversation_history": request.conversation_history,
            "memory": updated_memory
        }
        
        # Check if this is an action request FIRST
        # Pass full context including conversation history
        action_context = {
            'conversation_history': request.conversation_history,
            'memory': updated_memory,
            'page_url': request.page_url,
            'page_title': request.page_title
        }
        
        action = detect_action(request.user_input, action_context)
        
        if action:
            # User wants to take an action!
            return {
                "reply": action['message'],
                "memory": updated_memory.dict(),
                "context_note": None,
                "action": {
                    "type": action['action_type'],
                    "url": action['url'],
                    "proactive_message": action.get('proactive_message')
                }
            }
        
        # Otherwise, normal LLM response
        prompt = build_context_prompt(context)
        
        # Call OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a helpful, context-aware browsing assistant that helps users understand and navigate web pages."
                },
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        reply = response.choices[0].message.content.strip()
        
        # Extract and save notes
        context_note = None
        if "NOTE:" in reply:
            lines = reply.split("\n")
            for line in lines:
                if "NOTE:" in line:
                    note = line.replace("NOTE:", "").strip()
                    save_note(request.page_title, note)
                    updated_memory.notes.append(note[:100])
                    context_note = "Saved to notes"
            
            # Clean NOTE: from response
            reply = "\n".join([l for l in lines if "NOTE:" not in l]).strip()
        
        # Generate context note for UI if relevant
        if not context_note and updated_memory.preferences:
            if "budget" in updated_memory.preferences:
                if any(word in request.page_text.lower() for word in ["price", "cost", "$", "cheap", "expensive"]):
                    context_note = "I remember you prefer budget options"
            
            if "nature" in updated_memory.preferences:
                if any(word in request.page_text.lower() for word in ["park", "hiking", "outdoor", "nature"]):
                    context_note = "I see you enjoy nature activities"
        
        # Generate follow-up questions
        try:
            follow_up_prompt = f"""
            Based on the user's last query: "{request.user_input}"
            And your response: "{reply}"
            
            Suggest 3 short, relevant follow-up questions the user might want to ask next.
            Focus on diving deeper or exploring related aspects.
            
            Output strictly a JSON list of strings: ["Q1", "Q2", "Q3"]
            """
            
            fu_response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": follow_up_prompt}],
                temperature=0.7,
                max_tokens=150
            )
            
            fu_text = fu_response.choices[0].message.content.strip()
            if fu_text.startswith('```'):
                fu_text = fu_text.split('```')[1]
                if fu_text.startswith('json'):
                    fu_text = fu_text[4:]
                fu_text = fu_text.strip()
                
            suggested_questions = json.loads(fu_text)
            if not isinstance(suggested_questions, list):
                suggested_questions = []
        except Exception as e:
            print(f"Error generating follow-up questions: {e}")
            suggested_questions = []

        return {
            "reply": reply,
            "memory": updated_memory.dict(),
            "context_note": context_note,
            "suggested_questions": suggested_questions[:3]
        }
        
    except Exception as e:
        print(f"Error processing request: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "reply": f"Sorry, I encountered an error: {str(e)}. Please make sure your OpenAI API key is set correctly.",
            "memory": request.memory.dict(),
            "context_note": None
        }

@app.post("/analyze-page")
async def analyze_page(request: dict):
    print(">>> ALIVE-TICKER CALLED")
    """
    Perform deep analysis of the page for Entity Vision and Vibe Meter
    """
    try:
        page_text = request.get('page_text', '')[:4000]
        page_title = request.get('page_title', '')
        
        prompt = f"""Analyze the following page content and extract key metadata.
        
        Title: {page_title}
        Content: {page_text}
        
        1. Extract 3-5 key "entities" or facts (e.g., Price, Rating, Location, Main Topic).
        2. Determine the "vibe" or sentiment score on a scale of 0-100 (0=Analytical/Cold, 100=Intense/Passionate).
        3. Suggest a color name or hex code for the vibe (Blue/Green for low, Purple/Red for high).
        4. Based on the page type, suggest 1 high-value "automation blueprint" (a multi-step workflow title and summary).
        
        Output strictly as JSON:
        {{
          "entities": [
            {{"label": "Price", "value": "$99"}},
            {{"label": "Topic", "value": "AI News"}}
          ],
          "vibe_score": 75,
          "vibe_color": "purple",
          "vibe_label": "Dynamic",
          "blueprint": {{
            "name": "Analyze & Summarize Data",
            "summary": "Extract key metrics and draft a professional summary for Notion.",
            "icon": "🤖"
          }}
        }}
        """
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=250
        )
        
        analysis_text = response.choices[0].message.content.strip()
        if analysis_text.startswith('```'):
            analysis_text = analysis_text.split('```')[1]
            if analysis_text.startswith('json'):
                analysis_text = analysis_text[4:]
            analysis_text = analysis_text.strip()
            
        analysis = json.loads(analysis_text)
        return analysis
    except Exception as e:
        print(f"Error in analyze-page: {e}")
        return {
            "entities": [{"label": "Status", "value": "Ready"}],
            "vibe_score": 50,
            "vibe_color": "blue",
            "vibe_label": "Calm"
        }

@app.post("/log")
async def log_message(request: dict):
    """Simple logging endpoint for extension debugging"""
    message = request.get('message', '')
    level = request.get('level', 'INFO')
    source = request.get('source', 'extension')
    
    log_line = f"[{level}] [{source}] {message}"
    print(log_line)
    
    return {"status": "logged"}

@app.post("/assist")
async def assist(request: dict):
    """
    Proactive assistance endpoint - now LLM-powered
    """
    try:
        page_info = request.get('page_info', {})
        context = request.get('context', {})
        
        url = page_info.get('url', '')
        page_text = page_info.get('text', '')[:2000]  # First 2000 chars
        
        # Use LLM to analyze page and generate assistance
        assist_prompt = f"""You are helping a user fill out a form on this website.

Website: {url}
Page content preview: {page_text}

User context from conversation:
{json.dumps(context, indent=2)}

Your task:
1. Identify what form fields exist on this page
2. Suggest values based on the user's context
3. Provide a helpful message

Respond with JSON:
{{
  "message": "helpful message to user",
  "fields": [
    {{"name": "field_name", "label": "Field Label", "suggested_value": "value from context"}},
    ...
  ]
}}"""

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful form-filling assistant. Respond only with valid JSON."},
                {"role": "user", "content": assist_prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse JSON
        if result_text.startswith('```'):
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
            result_text = result_text.strip()
        
        result = json.loads(result_text)
        return result
        
    except Exception as e:
        print(f"Error in assist endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "message": "I'm ready to help! What information do you need assistance with?",
            "fields": []
        }

class RecommendationRequest(BaseModel):
    page_context: dict
    memory: dict = {}
    page_title: str = ""
    page_url: str = ""
    page_text: str = ""

@app.post("/recommend")
async def recommend_questions(request: RecommendationRequest):
    print(">>> ALIVE-REC CALLED")
    """
    Generate proactive recommended questions based on page context
    """
    try:
        page_context = request.page_context
        memory = request.memory
        
        page_title = page_context.get('title', '')
        page_url = page_context.get('url', '')
        page_text = page_context.get('text', '')[:1500]  # Limit text length
        
        # Build prompt
        system_prompt = """You are a helpful browsing assistant.
        Based on the user's profile and the current page, suggest 3 relevant questions the user might want to ask.
        
        Analyze:
        1. The user's profession and interests (from memory)
        2. The page content
        
        Output valid JSON list of strings: ["Question 1", "Question 2", "Question 3"]
        """
        
        user_prompt = f"""User Profile: {json.dumps(memory)}
        Current Page: {page_title} - {page_url}
        Content Preview: {page_text}
        
        Suggest 3 questions:"""
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=150
        )
        
        result = response.choices[0].message.content.strip()
        
        # Robust parsing
        try:
            import re
            json_match = re.search(r'\[.*\]', result, re.DOTALL)
            if json_match:
                questions = json.loads(json_match.group(0))
                if isinstance(questions, list):
                    return questions[:3]
        except Exception as parse_err:
            print(f"Regex parse failed in recommend: {parse_err}")

        # Fallback to lines if regex fails
        lines = [line.strip('- ').strip('123. ') for line in result.split('\n') if '?' in line]
        return lines[:3] if lines else ["Summarize this page", "What is the main topic?", "Any key insights?"]

    except Exception as e:
        print(f"Error in recommend: {e}")
        return ["Summarize this page", "What is the main topic?", "Any key insights?"]

@app.post("/insights")
async def generate_insights(request: RecommendationRequest):
    """
    Generate a single, short, "wow" insight about the page
    """
    print(f"💡 Generating insight for: {request.page_title}")
    
    # Use context or separate fields
    title = request.page_title or request.page_context.get('title', '')
    url = request.page_url or request.page_context.get('url', '')
    text = request.page_text or request.page_context.get('text', '')
    
    prompt = f"""Analyze this page context:
    Title: {title}
    URL: {url}
    Content Preview: {text[:1000]}
    
    Generate ONE short, fascinating "Did you know?" style insight or helpful tip related to this content.
    It should be surprising, helpful, or value-add.
    Max 1 sentence. Start with an emoji.
    
    Example: "💡 This camera model is often 20% cheaper in February!"
    """
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=60,
            temperature=0.7
        )
        insight = response.choices[0].message.content.strip()
        return {"insight": insight}
    except Exception as e:
        print(f"Error generating insight: {e}")
        return {"insight": None}
        
        # Build prompt


@app.get("/health")
async def health():
    """Detailed health check"""
    api_key = os.getenv("OPENAI_API_KEY")
    return {
        "status": "healthy",
        "openai_key_configured": bool(api_key and api_key.startswith("sk-")),
        "timestamp": datetime.now().isoformat()
    }

@app.post("/assist-chat")
async def assist_chat(request: dict):
    """
    Conversational assistant in floating window
    Understands page context and asks for missing details
    """
    try:
        user_message = request.get('user_message', '')
        page_info = request.get('page_info', {})
        context = request.get('context', {})
        conversation_history = request.get('conversation_history', [])
        
        url = page_info.get('url', '')
        page_text = page_info.get('text', '')[:3000]
        
        # Build conversational prompt
        system_prompt = f"""You are a helpful AI assistant helping the user complete a task on this webpage.
        
Current page: {url}
Page content preview: {page_text[:500]}...

User's original intent from context: {json.dumps(context.get('original_query', ''))}
Extracted context: {json.dumps(context.get('extracted_context', context.get('preferences', [])), indent=2)}

MEMORY / USER PROFILE:
{json.dumps(context.get('memory', {}), indent=2)}

FORM DATA (if applicable):
{json.dumps(context.get('form_data', {}).get('fields', []), indent=2)}

Your job:
1. If this is a "Magic Fill" request (form_data is present), map User Profile data to the Form Fields.
   - Return action type "fill_form" with the mapped values.
   - If a field cannot be filled from memory, do NOT invent data, just leave it out or ask the user.
2. Otherwise, understand what information is still needed to complete the task.
3. Ask for missing details conversationally (one question at a time).
4. When you have all information, offer to fill the form.

Respond with JSON:
{{
  "message": "your conversational response",
  "suggested_questions": ["Short Q1", "Short Q2"],
  "memory_used": "brief explanation of what memory was accessed (optional)",
  "action": {{
    "type": "fill_form" or null,
    "fields": [
      {{"selector": "field_name_or_id", "value": "mapped_value_from_memory"}}
    ]
  }} or null
}}

Be smart about:
- Detecting what fields exist on the page
- Asking for information in a natural order
- Extracting entities from user responses
- Knowing when you have enough info to proceed"""

        # Build conversation history for LLM
        messages = [{"role": "system", "content": system_prompt}]
        
        for msg in conversation_history:
            messages.append({
                "role": msg['role'],
                "content": msg['content']
            })
        
        # Add the current user message if it's not the last one in history
        if user_message and (not conversation_history or conversation_history[-1]['content'] != user_message):
            messages.append({"role": "user", "content": user_message})
        
        # Call LLM
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=300
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Parse JSON
        try:
            # Try to find JSON in the response
            if '{' in result_text and '}' in result_text:
                json_start = result_text.find('{')
                json_end = result_text.rfind('}') + 1
                result_text = result_text[json_start:json_end]
            
            result = json.loads(result_text)
        except:
            # If still fails, wrap the plain text as a message
            print(f"⚠️ Could not parse LLM response as JSON. Wrapping as message: {result_text}")
            result = {
                "message": result_text,
                "action": None
            }
        
        print(f"💬 Assistant: {result.get('message', 'No message')}")
        
        # Standardize fields for frontend
        if 'memory_used' in result:
            result['context_note'] = result['memory_used']
            
        return result
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        print(f"Response: {result_text}")
        return {
            "message": "I'm here to help! What details do you need to provide?",
            "action": None
        }
    except Exception as e:
        print(f"Error in assist-chat: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "message": "Sorry, I encountered an error. Can you try rephrasing that?",
            "action": None
        }


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("🤖 Ambient Copilot Backend Starting...")
    print("=" * 60)
    print(f"📍 Server: http://localhost:8000")
    print(f"📄 Docs: http://localhost:8000/docs")
    print(f"🔑 API Key: {'✅ Configured' if os.getenv('OPENAI_API_KEY') else '❌ Not set'}")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")