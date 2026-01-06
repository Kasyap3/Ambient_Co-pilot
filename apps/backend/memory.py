"""
Memory management for Ambient Copilot
Handles user preferences and memory updates
"""

from typing import List
from pydantic import BaseModel

class Memory(BaseModel):
    preferences: List[str]
    notes: List[str]

def extract_preferences(user_input: str, memory: Memory) -> Memory:
    """
    Extract preferences from user input using simple keyword matching
    
    In production, this would use NER or LLM-based extraction
    For MVP, we use keyword matching
    """
    
    preferences_keywords = {
        "budget": ["cheap", "budget", "affordable", "save money", "inexpensive", "economical"],
        "luxury": ["luxury", "premium", "upscale", "high-end", "expensive"],
        "nature": ["nature", "hiking", "outdoors", "park", "mountain", "forest"],
        "beach": ["beach", "ocean", "seaside", "coast"],
        "adventure": ["adventure", "exciting", "thrill", "extreme"],
        "family": ["family", "kids", "children"],
        "solo": ["solo", "alone", "myself"],
        "food": ["food", "restaurant", "cuisine", "dining"],
        "history": ["history", "museum", "historical", "cultural"],
        "relaxation": ["relax", "spa", "peaceful", "quiet"]
    }
    
    user_lower = user_input.lower()
    
    # Check each preference category
    for pref, keywords in preferences_keywords.items():
        if any(kw in user_lower for kw in keywords):
            if pref not in memory.preferences:
                memory.preferences.append(pref)
                print(f"✅ Learned preference: {pref}")
    
    # Limit preferences to prevent memory bloat
    if len(memory.preferences) > 10:
        memory.preferences = memory.preferences[-10:]
    
    return memory

def update_memory(memory: Memory, new_note: str) -> Memory:
    """Add a new note to memory"""
    if new_note and new_note not in memory.notes:
        memory.notes.append(new_note[:200])  # Limit note length
        
        # Keep only recent notes
        if len(memory.notes) > 20:
            memory.notes = memory.notes[-20:]
    
    return memory

def format_memory_for_prompt(memory: Memory) -> str:
    """Format memory into readable text for LLM prompt"""
    parts = []
    
    if memory.preferences:
        parts.append(f"User preferences: {', '.join(memory.preferences)}")
    
    if memory.notes:
        recent_notes = memory.notes[-5:]  # Last 5 notes
        parts.append(f"Recent notes: {'; '.join(recent_notes)}")
    
    return "\n".join(parts) if parts else "No stored preferences yet"
