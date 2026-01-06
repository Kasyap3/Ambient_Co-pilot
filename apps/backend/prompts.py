"""
Prompt templates for Ambient Copilot
Defines how context is formatted for the LLM
"""

def build_system_prompt() -> str:
    """Base system prompt for the assistant"""
    return """You are a helpful, context-aware browsing assistant.

Your role:
- Help users understand and navigate web pages
- Provide relevant information based on current page content
- Remember user preferences and apply them proactively
- Be concise but thorough
- Suggest helpful next steps when relevant

Guidelines:
1. Always consider the user's stated preferences
2. If you notice something relevant to their preferences, mention it
3. When comparing options (travel, products, etc.), highlight choices matching their preferences
4. If you learn something worth remembering, prefix it with "NOTE:" on a new line
5. Be proactive but not pushy - offer help, don't force it
6. Keep responses under 3-4 sentences unless more detail is requested
7. CITATIONS: When stating facts from the page, ALWAYS verify by including the exact text snippet in this format: [[citation: exact text from page]]. This is critical for trust."""

def build_context_prompt(context: dict) -> str:
    """
    Build the full context prompt from structured context
    """
    
    # Format conversation history
    history_text = ""
    if context.get("conversation_history"):
        history_lines = []
        for msg in context["conversation_history"][-6:]:
            role = msg.role.upper()
            history_lines.append(f"{role}: {msg.content}")
        history_text = "\n".join(history_lines)
    
    # Format memory
    memory = context.get("memory")
    memory_text = ""
    if memory and memory.preferences:
        memory_text = f"User preferences: {', '.join(memory.preferences)}"
    
    # Build full prompt - fix the f-string issue
    parts = []
    parts.append("CURRENT PAGE:")
    parts.append(f"Title: {context['page_title']}")
    parts.append(f"URL: {context['page_url']}")
    parts.append(f"Content: {context['page_summary']}")
    parts.append("")
    
    if memory_text:
        parts.append(memory_text)
        parts.append("")
    
    if history_text:
        parts.append("RECENT CONVERSATION:")
        parts.append(history_text)
        parts.append("")
    
    parts.append(f"USER SAYS: {context['user_input']}")
    parts.append("")
    parts.append("Respond naturally and helpfully. Remember to:")
    parts.append("- Apply the user's preferences when relevant")
    parts.append("- If comparing options, highlight ones matching their preferences (e.g., budget options for budget-conscious users)")
    parts.append("- If you learn something worth remembering, add \"NOTE: [insight]\" on a new line")
    parts.append("- Be proactive but respectful")
    parts.append("")
    parts.append("Your response:")
    
    return "\n".join(parts)