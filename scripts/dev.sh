#!/bin/bash

echo "🤖 Starting Ambient Copilot Backend..."
echo "========================================"

# Navigate to backend directory
cd "$(dirname "$0")/../apps/backend" || exit 1

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  No .env file found!"
    echo "📝 Creating from template..."
    cp .env.example .env
    echo ""
    echo "❗ IMPORTANT: Edit apps/backend/.env and add your OpenAI API key"
    echo "   Get your key from: https://platform.openai.com/api-keys"
    echo ""
    read -p "Press Enter after you've added your API key..."
fi

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Install/update requirements
echo "📥 Installing dependencies..."
pip install -q -r requirements.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Starting backend server..."
echo "   Server: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo ""
echo "📖 Next steps:"
echo "   1. Load extension in Chrome from: apps/extension"
echo "   2. Visit any webpage"
echo "   3. Click the extension icon"
echo ""
echo "Press Ctrl+C to stop the server"
echo "========================================"
echo ""

# Run the app
python app.py
