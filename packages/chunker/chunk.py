"""
Text chunking utilities
Handles splitting and processing of large text blocks
"""

import sys
import os

# Import from backend summarizer
sys.path.append(os.path.join(os.path.dirname(__file__), '../../apps/backend'))

from summarizer import chunk_text as _chunk_text
from summarizer import summarize_text as _summarize_text

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list:
    """
    Split text into overlapping chunks
    
    Args:
        text: Text to chunk
        chunk_size: Size of each chunk in characters
        overlap: Overlap between chunks
        
    Returns:
        List of text chunks
    """
    return _chunk_text(text, chunk_size, overlap)

def summarize_text(text: str, max_chars: int = 2000) -> str:
    """
    Summarize or truncate text to fit within limits
    
    Args:
        text: Input text
        max_chars: Maximum characters to return
        
    Returns:
        Summarized/truncated text
    """
    return _summarize_text(text, max_chars)

def smart_chunk(text: str, max_chunk_size: int = 1000) -> list:
    """
    Intelligently chunk text at natural boundaries
    
    Tries to split at:
    1. Paragraph breaks
    2. Sentence breaks
    3. Word breaks (last resort)
    """
    
    if len(text) <= max_chunk_size:
        return [text]
    
    chunks = []
    
    # Try splitting on double newlines (paragraphs)
    paragraphs = text.split('\n\n')
    
    current_chunk = ""
    for para in paragraphs:
        if len(current_chunk) + len(para) <= max_chunk_size:
            current_chunk += para + "\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = para + "\n\n"
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

def merge_chunks(chunks: list, separator: str = "\n\n") -> str:
    """Merge chunks back into single text"""
    return separator.join(chunks)
