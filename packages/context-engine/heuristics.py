"""
Heuristics for Intelligent Assistance
Determines when and how to proactively help users
"""

def should_interrupt(page_summary: str, memory: dict) -> bool:
    """
    Decide if assistant should proactively interrupt with suggestion
    
    Args:
        page_summary: Current page content
        memory: User's stored preferences and history
        
    Returns:
        True if should proactively suggest something
    """
    
    page_lower = page_summary.lower()
    preferences = memory.get('preferences', [])
    
    # Budget-conscious user seeing expensive options
    if 'budget' in preferences:
        expensive_indicators = ['luxury', 'premium', '$500', '$1000', 'expensive']
        if any(ind in page_lower for ind in expensive_indicators):
            return True
    
    # Nature lover on travel site
    if 'nature' in preferences:
        if any(word in page_lower for word in ['hotel', 'booking', 'travel']):
            return True
    
    # Don't interrupt too often
    # In production: Track last interrupt time
    return False

def should_assist(user_input: str, page_context: str) -> dict:
    """
    Determine level and type of assistance needed
    
    Returns dict with:
        - level: 'minimal', 'moderate', 'detailed'
        - type: 'answer', 'suggest', 'compare', 'explain'
        - confidence: 0.0 to 1.0
    """
    
    user_lower = user_input.lower()
    
    # Question indicators
    question_words = ['what', 'why', 'how', 'when', 'where', 'which', 'who']
    is_question = any(word in user_lower for word in question_words)
    
    # Comparison indicators
    comparison_words = ['better', 'best', 'compare', 'vs', 'versus', 'difference']
    is_comparison = any(word in user_lower for word in comparison_words)
    
    # Help indicators
    help_words = ['help', 'suggest', 'recommend', 'should i', 'what about']
    wants_help = any(word in user_lower for word in help_words)
    
    # Determine assistance level
    if is_comparison:
        return {
            'level': 'detailed',
            'type': 'compare',
            'confidence': 0.9
        }
    elif wants_help:
        return {
            'level': 'moderate',
            'type': 'suggest',
            'confidence': 0.85
        }
    elif is_question:
        return {
            'level': 'moderate',
            'type': 'answer',
            'confidence': 0.8
        }
    else:
        return {
            'level': 'minimal',
            'type': 'acknowledge',
            'confidence': 0.6
        }

def is_relevant_page(page_summary: str, user_interests: list) -> float:
    """
    Calculate relevance score of current page to user interests
    
    Returns:
        Score from 0.0 (not relevant) to 1.0 (highly relevant)
    """
    
    if not user_interests or not page_summary:
        return 0.5  # Neutral
    
    page_lower = page_summary.lower()
    matches = 0
    
    # Interest keywords mapping
    interest_keywords = {
        'budget': ['cheap', 'affordable', 'discount', 'sale', 'budget'],
        'luxury': ['luxury', 'premium', 'exclusive', 'upscale'],
        'nature': ['nature', 'park', 'hiking', 'outdoor', 'mountain', 'forest'],
        'beach': ['beach', 'ocean', 'sea', 'coast', 'sand'],
        'food': ['restaurant', 'food', 'cuisine', 'dining', 'eat'],
        'history': ['museum', 'historical', 'history', 'ancient', 'heritage']
    }
    
    total_checks = 0
    for interest in user_interests:
        if interest in interest_keywords:
            keywords = interest_keywords[interest]
            total_checks += len(keywords)
            matches += sum(1 for kw in keywords if kw in page_lower)
    
    if total_checks == 0:
        return 0.5
    
    return min(1.0, matches / total_checks * 2)  # Scale to 0-1

def should_save_note(response_text: str, user_input: str) -> bool:
    """
    Determine if this interaction is worth saving as a note
    
    Args:
        response_text: Assistant's response
        user_input: User's query
        
    Returns:
        True if should save as note
    """
    
    # Check for explicit note markers
    if "NOTE:" in response_text:
        return True
    
    # Check for important decisions/preferences
    decision_words = ['prefer', 'want', 'need', 'looking for', 'interested in']
    if any(word in user_input.lower() for word in decision_words):
        return True
    
    # Check for strong user statements
    if len(user_input) > 50 and any(char in user_input for char in ['!', '?']):
        return True
    
    return False
