"""
Notes management for Ambient Copilot
Auto-saves important insights to a text file
"""

import os
from datetime import datetime
from pathlib import Path

# Notes file location
NOTES_FILE = Path(__file__).parent.parent.parent / "data" / "notes.txt"

def ensure_data_dir():
    """Ensure data directory exists"""
    NOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    # Create file if it doesn't exist
    if not NOTES_FILE.exists():
        NOTES_FILE.touch()

def save_note(page_title: str, note: str):
    """
    Save a note with timestamp and page context
    
    Format: [YYYY-MM-DD HH:MM:SS] Page Title: Note content
    """
    ensure_data_dir()
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    formatted_note = f"[{timestamp}] {page_title}: {note}\n"
    
    try:
        with open(NOTES_FILE, "a", encoding="utf-8") as f:
            f.write(formatted_note)
        print(f"📝 Saved note: {note[:50]}...")
    except Exception as e:
        print(f"❌ Error saving note: {e}")

def get_recent_notes(n: int = 10) -> list:
    """
    Get the n most recent notes
    
    Returns list of tuples: (timestamp, page_title, note)
    """
    ensure_data_dir()
    
    try:
        with open(NOTES_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
        
        # Parse and return recent notes
        notes = []
        for line in reversed(lines[-n:]):
            line = line.strip()
            if line and line.startswith("["):
                # Parse format: [timestamp] title: note
                try:
                    timestamp_end = line.index("]")
                    timestamp = line[1:timestamp_end]
                    rest = line[timestamp_end + 2:]
                    
                    if ":" in rest:
                        title, note = rest.split(":", 1)
                        notes.append({
                            "timestamp": timestamp,
                            "page_title": title.strip(),
                            "note": note.strip()
                        })
                except:
                    continue
        
        return notes
    except FileNotFoundError:
        return []
    except Exception as e:
        print(f"❌ Error reading notes: {e}")
        return []

def clear_notes():
    """Clear all notes (for testing)"""
    ensure_data_dir()
    
    try:
        with open(NOTES_FILE, "w", encoding="utf-8") as f:
            f.write("")
        print("🗑️ Notes cleared")
    except Exception as e:
        print(f"❌ Error clearing notes: {e}")
