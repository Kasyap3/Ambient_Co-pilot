# 🚀 Ambient Copilot - Setup Guide

Complete setup instructions for getting Ambient Copilot running.

## 📋 Prerequisites

- Python 3.8 or higher
- Chrome or Chromium browser
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

## 🛠️ Setup Steps

### Step 1: Backend Setup

```bash
cd apps/backend

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure API key
cp .env.example .env
# Edit .env and add your OpenAI API key
```

Your `.env` file should look like:
```
OPENAI_API_KEY=sk-your-actual-key-here
```

### Step 2: Start the Backend

```bash
# From apps/backend directory
python app.py
```

You should see:
```
============================================================
🤖 Ambient Copilot Backend Starting...
============================================================
📍 Server: http://localhost:8000
📄 Docs: http://localhost:8000/docs
🔑 API Key: ✅ Configured
============================================================
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**Keep this terminal open!** The extension communicates with the backend at `http://127.0.0.1:8000`.

### Step 3: Load Chrome Extension

1. Open Chrome/Chromium
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `apps/extension` folder from this project
6. You should see "Ambient Copilot" extension added
7. **CRITICAL**: After loading or reloading the extension, you MUST hard refresh any open tabs where you want to use it:
   - Press **Cmd+Shift+R** (Mac) or **Ctrl+Shift+R** (Windows/Linux)
   - This ensures the content script loads properly

### Step 4: Verify Content Script Loading

1. Open any webpage (e.g., https://example.com)
2. Press **F12** to open Developer Tools
3. Go to the **Console** tab
4. You should see: `🚀 CONTENT.JS LOADED on: https://...`
5. If you DON'T see this message, hard refresh the page (Cmd+Shift+R)

### Step 5: Add Icons (Optional)

The extension needs icons. You can:

**Option A: Use emoji-to-icon converter**
- Visit https://favicon.io/emoji-favicons/
- Choose 🤖 robot emoji
- Download and extract
- Rename files to `icon16.png`, `icon48.png`, `icon128.png`
- Place in `apps/extension/assets/`

**Option B: Use ImageMagick**
```bash
cd apps/extension/assets
convert -size 16x16 xc:blue -pointsize 12 -fill white -gravity center -annotate +0+0 "AC" icon16.png
convert -size 48x48 xc:blue -pointsize 32 -fill white -gravity center -annotate +0+0 "AC" icon48.png
convert -size 128x128 xc:blue -pointsize 96 -fill white -gravity center -annotate +0+0 "AC" icon128.png
```

**Option C: Skip for now**
- Extension will work without icons, just won't look as nice

## ✅ Testing

### Test 1: Backend Health Check

```bash
curl http://localhost:8000
```

Should return:
```json
{"status": "Ambient Copilot Backend Running", ...}
```

### Test 2: Extension Connection & Smart Explain

1. Visit any website with text content (e.g., Wikipedia, news article)
2. Click the Ambient Copilot extension icon (sidebar should open)
3. **Test Chat**: Type "What is this page about?" and click Send
   - Should get a concise response (max 70 words)
4. **Test Smart Explain**: 
   - Select at least 5 characters of text on the page
   - A blue "✨ Explain" button should appear near your selection
   - Click the button
   - The sidebar should open with `Explain this context: "your selected text"` pre-filled
   - Click Send to get an explanation
5. **Test Dynamic Suggestions**:
   - After sending a message, notice the "Choose a follow-up..." dropdown
   - Suggestions update automatically every 30 seconds

### Test 3: Notes Feature

1. In the sidebar, switch to the "Notes" tab
2. Send a message with important information
3. The AI may suggest saving it as a note
4. Notes are automatically anchored to the current website
5. Check `data/notes.txt` to see backend persistence

### Test 4: Voice Input

1. Click the 🎤 button
2. Allow microphone permission if prompted
3. Speak: "I want to visit Yosemite on a budget"
4. Click 🎤 again to stop
5. Should see your speech converted to text
6. Click Send

## 🎯 Usage Examples

### Example 1: Travel Planning

```
Visit: https://www.airbnb.com
🎤: "I want to go to Yosemite in April but I'm on a budget"
✅ Assistant suggests budget-friendly options
💡 Remembers you prefer budget travel
```

### Example 2: Shopping

```
Visit: Amazon product page
Type: "Is this a good deal?"
✅ Assistant analyzes page and provides context
```

### Example 3: Research

```
Visit: Research paper or article
Type: "Summarize the main points"
✅ Gets concise summary of page content
```

## 🔧 Troubleshooting

### Backend won't start

**Issue**: `ModuleNotFoundError`
**Fix**: Make sure you installed requirements
```bash
pip install -r requirements.txt
```

**Issue**: `OPENAI_API_KEY not set`
**Fix**: Check your `.env` file has the correct key

### Extension not loading

**Issue**: "Manifest file is missing or unreadable"
**Fix**: Make sure you selected the `apps/extension` folder, not the root folder

**Issue**: No extension icon visible
**Fix**: Extension is loaded but needs icons - see Step 4 above

### Voice input not working

**Issue**: Mic button disabled
**Fix**: Web Speech API requires Chrome/Chromium - doesn't work in Firefox

**Issue**: "Microphone permission denied"
**Fix**: 
1. Click the 🔒 icon in Chrome's address bar
2. Allow microphone access
3. Reload the extension

### Can't connect to backend

**Issue**: "Error connecting to backend"
**Fix**: 
1. Make sure backend is running (`python app.py`)
2. Check it's on port 8000
3. Try: `curl http://localhost:8000`

### No LLM responses

**Issue**: Backend running but no responses
**Fix**: 
1. Check OpenAI API key is correct
2. Check API key has credits
3. Look at backend terminal for error messages

## 🎨 Customization

### Change LLM Model

Edit `apps/backend/app.py`:
```python
model="gpt-3.5-turbo"  # Cheaper
# or
model="gpt-4"  # More capable
```

### Adjust Memory Length

Edit `apps/backend/memory.py`:
```python
if len(memory.preferences) > 20:  # Keep more preferences
    memory.preferences = memory.preferences[-20:]
```

### Customize Prompts

Edit `apps/backend/prompts.py` to change how the assistant responds.

## 📊 Monitoring

### View Notes

```bash
cat data/notes.txt
```

### Clear History

In extension popup, click "Clear" button

### Backend Logs

All logs appear in the terminal where you ran `python app.py`

## 🚀 Quick Start Script

Or use the automated script:

```bash
./scripts/dev.sh
```

This handles:
- Virtual environment creation
- Dependency installation
- .env setup reminder
- Starting the backend

## 📝 Next Steps

Once everything is working:

1. Try different websites
2. Experiment with voice input
3. Check `data/notes.txt` to see saved notes
4. Customize prompts to your needs

## 🆘 Still Having Issues?

Check the main README.md for more info, or:
1. Check backend terminal for errors
2. Check browser console (F12) for extension errors
3. Verify all files are in correct locations
4. Try running with `./scripts/dev.sh` for automated setup

## 🎉 Success!

If you see responses in the extension and notes being saved, you're all set!

Try asking: "Remember that I prefer outdoor activities" and see it learn your preferences.
