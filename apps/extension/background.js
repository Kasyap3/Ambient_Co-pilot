// Background service worker for Ambient Copilot
// Handles extension lifecycle and background tasks

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Ambient Copilot installed/updated:', details.reason);

  // Initialize storage with default values
  chrome.storage.local.get(['memory', 'history'], (result) => {
    if (!result.memory) {
      chrome.storage.local.set({
        memory: {
          preferences: [],
          notes: []
        }
      });
    }

    if (!result.history) {
      chrome.storage.local.set({
        history: []
      });
    }
  });

  // Configure Side Panel to open on action click
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  // Show welcome notification on first install
  if (details.reason === 'install') {
    console.log('Welcome to Ambient Copilot! Click the extension icon to get started.');
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);

  if (request.action === 'trigger_magic_fill') {
    // Relay to the tab that sent it
    if (sender.tab) {
      chrome.tabs.sendMessage(sender.tab.id, {
        action: 'show_assistant',
        message: 'I see you want to fill this form! 🪄\n\nI can use your stored profile to auto-fill these fields. Shall I proceed?',
        context: {
          type: 'form_fill',
          form_data: request.formContext
        }
      });
    }
  } else if (request.action === 'check_insights') {
    // Call backend for insights
    fetch('http://localhost:8000/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_context: request.context,
        memory: {} // Could pass memory if needed
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.insight && sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'show_insight',
            insight: data.insight
          });
        }
      })
      .catch(err => console.error('Insight check failed:', err));
  }

  return true; // Keep channel open
});
