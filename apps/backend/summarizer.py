"""
Text summarization utilities for Ambient Copilot
Handles chunking and summarizing large page content
"""

def summarize_text(text: str, max_chars: int = 2000) -> str:
    """
    Summarize or truncate text to fit within token limits
    
    For MVP, we use simple truncation with smart splitting
    In production, this would use LLM-based summarization
    
    Args:
        text: Input text to summarize
        max_chars: Maximum characters to return
        
    Returns:
        Summarized/truncated text
    """
    if not text:
        return ""
    
    # If text is short enough, return as-is
    if len(text) <= max_chars:
        return text
    
    # Simple truncation with ellipsis
    # Try to break at sentence boundary
    truncated = text[:max_chars]
    
    # Find last sentence ending
    last_period = truncated.rfind('. ')
    last_question = truncated.rfind('? ')
    last_exclaim = truncated.rfind('! ')
    
    last_sentence = max(last_period, last_question, last_exclaim)
    
    if last_sentence > max_chars * 0.8:  # At least 80% of text
        truncated = truncated[:last_sentence + 1]
    
    return truncated + "... [content truncated]"

def extract_key_sections(text: str, keywords: list) -> str:
    """
    Extract text sections containing specific keywords
    Useful for focusing on relevant parts of long pages
    
    Args:
        text: Full page text
        keywords: List of keywords to search for
        
    Returns:
        Concatenated relevant sections
    """
    if not keywords or not text:
        return text
    
    # Split into sentences
    sentences = []
    for delimiter in ['. ', '? ', '! ']:
        if delimiter in text:
            sentences = text.split(delimiter)
            break
    
    if not sentences:
        sentences = [text]
    
    # Find sentences containing keywords
    relevant = []
    keywords_lower = [k.lower() for k in keywords]
    
    for sentence in sentences:
        sentence_lower = sentence.lower()
        if any(kw in sentence_lower for kw in keywords_lower):
            relevant.append(sentence.strip())
    
    # Return relevant sentences or full text if none found
    if relevant:
        return '. '.join(relevant[:20]) + '.'  # Max 20 sentences
    else:
        return summarize_text(text)

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list:
    """
    Split text into overlapping chunks
    Useful for processing very long documents
    
    Args:
        text: Text to chunk
        chunk_size: Size of each chunk in characters
        overlap: Overlap between chunks
        
    Returns:
        List of text chunks
    """
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        
        # Try to break at word boundary
        if end < len(text):
            # Find last space
            space = text.rfind(' ', start, end)
            if space > start:
                end = space
        
        chunk = text[start:end].strip()
        chunks.append(chunk)
        
        # Move start with overlap
        start = end - overlap
    
    return chunks
