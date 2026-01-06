"""
Context Packer
Intelligently constructs context for LLM from multiple sources
"""

import sys
import os

# Add backend to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '../../apps/backend'))

from prompts import build_context_prompt

def pack_context(context: dict) -> str:
    """
    Pack all context into a single coherent prompt
    
    Args:
        context: Dictionary containing:
            - page_title: str
            - page_url: str
            - page_summary: str
            - user_input: str
            - conversation_history: List[Message]
            - memory: Memory object
    
    Returns:
        Formatted prompt string ready for LLM
    """
    return build_context_prompt(context)

def pack_minimal_context(user_input: str, page_summary: str) -> str:
    """
    Pack minimal context for quick queries
    Used when full context isn't needed
    """
    return f"""Current page content:
{page_summary}

User question: {user_input}

Provide a helpful, concise answer:"""

def extract_relevant_context(page_text: str, user_input: str, max_chars: int = 2000) -> str:
    """
    Extract only the most relevant parts of page text
    Based on semantic similarity to user input
    
    For MVP: Simple keyword matching
    In production: Use embeddings and vector similarity
    """
    
    # Extract keywords from user input
    keywords = extract_keywords(user_input)
    
    # Find sentences containing keywords
    sentences = page_text.split('. ')
    relevant = []
    
    for sentence in sentences:
        sentence_lower = sentence.lower()
        if any(kw.lower() in sentence_lower for kw in keywords):
            relevant.append(sentence)
    
    # If relevant sentences found, use those
    if relevant:
        result = '. '.join(relevant[:15])  # Max 15 sentences
        if len(result) > max_chars:
            result = result[:max_chars]
        return result
    
    # Otherwise, return beginning of page
    return page_text[:max_chars]

def extract_keywords(text: str) -> list:
    """
    Extract important keywords from text
    
    For MVP: Simple word extraction
    In production: Use NER, POS tagging, TF-IDF
    """
    
    # Remove common words
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'should', 'can', 'could', 'may', 'might', 'must', 'i', 'you',
        'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when',
        'where', 'why', 'how', 'this', 'that', 'these', 'those'
    }
    
    # Simple tokenization
    words = text.lower().split()
    
    # Filter and return
    keywords = [w for w in words if len(w) > 3 and w not in stopwords]
    
    return keywords[:10]  # Top 10 keywords
