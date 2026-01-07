console.log('🚀 POPUP.JS LOADING...');

let conversationHistory = [];
let recognition = null;
let isRecording = false;

console.log('✅ POPUP.JS VARIABLES INITIALIZED');

// Show ready status
setStatus('Ready');
try {
  initNeuralConnectivity();
} catch (e) {
  console.log('Neural init placeholder');
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🏁 DOMContentLoaded start');

  // Priority: Attach Main Action Listeners FIRST
  try {
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.addEventListener('click', handleSend);

    const micBtn = document.getElementById('micBtn');
    if (micBtn) micBtn.addEventListener('click', toggleVoiceInput);

    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearHistory);

    const userInput = document.getElementById('userInput');
    if (userInput) {
      userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Recommendations Dropdown
    const recDropdown = document.getElementById('recDropdown');
    if (recDropdown) {
      recDropdown.addEventListener('change', (e) => {
        const selected = e.target.value;
        if (selected) {
          if (userInput) userInput.value = selected;
          handleSend();
          recDropdown.value = ''; // Reset
        }
      });
      recDropdown.dataset.listenerAttached = "true";
    }
  } catch (e) {
    console.error('❌ Failed to attach core listeners:', e);
  }

  // Tab handling
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.view-pane').forEach(c => c.style.display = 'none');
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      const content = document.getElementById(`${tabId}-tab`);
      if (content) content.style.display = 'flex';
      if (tabId === 'brain') renderNotes();
    });
  });

  const clearNotesBtn = document.getElementById('clearNotesBtn');
  if (clearNotesBtn) clearNotesBtn.addEventListener('click', clearNotes);

  const memorySearch = document.getElementById('memorySearch');
  if (memorySearch) {
    memorySearch.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const cards = document.querySelectorAll('.note-card');
      cards.forEach(card => {
        const text = card.querySelector('.note-content').textContent.toLowerCase();
        card.style.display = text.includes(query) ? 'flex' : 'none';
      });
    });
  }

  // Check onboarding status
  try {
    const stored = await chrome.storage.local.get(['history', 'memory', 'onboarding_complete']);
    if (!stored.onboarding_complete) {
      showOnboarding();
    } else {
      showChat();
      if (stored.history) {
        conversationHistory = stored.history;
        renderHistory();
      }
      fetchRecommendations();
    }
  } catch (e) {
    console.error('❌ Error in onboarding/history check:', e);
  }

  // Initialize secondary features
  try {
    initSpeechRecognition();
    const setupForm = document.getElementById('setupForm');
    if (setupForm) setupForm.addEventListener('submit', handleOnboardingSubmit);
  } catch (e) {
    console.error('❌ Secondary init failed:', e);
  }

  // Perform WOW analysis on load
  try {
    analyzePage();
  } catch (e) {
    console.error('Initial analysis failed:', e);
  }

  setStatus('Ready');
});

function initNeuralConnectivity() {
  console.log('🧠 Neural Connectivity Initialized');
}

function initSpeechRecognition() {
  // Check if browser supports speech recognition
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.error('Speech recognition not supported');
    document.getElementById('micBtn').disabled = true;
    document.getElementById('micBtn').title = 'Speech recognition not supported in this browser';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true; // Keep listening
  recognition.interimResults = true; // Show interim results
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecording = true;
    const micBtn = document.getElementById('micBtn');
    micBtn.classList.add('recording');
    micBtn.innerHTML = '<span>⏹️</span>'; // Changed to span for styling
    setStatus('🎤 Listening...', 'loading');
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript += transcript;
      }
    }

    console.log('🗣️ Transcript:', { finalTranscript, interimTranscript });

    // Update input with transcribed text
    const input = document.getElementById('userInput');
    if (finalTranscript) {
      input.value = (input.value + ' ' + finalTranscript).trim();
    }

    // Show interim results in status
    if (interimTranscript) {
      setStatus(`Hearing: "${interimTranscript}"`, 'loading');
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopVoiceInput();

    if (event.error === 'no-speech') {
      setStatus('No speech detected. Try again.', 'error');
    } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setStatus('Permission needed. Click 🎤 to fix.', 'error');
      // Set a flag so next click opens setup
      document.getElementById('micBtn').dataset.needsSetup = 'true';
      document.getElementById('micBtn').disabled = false; // Re-enable so they can click it
    } else {
      setStatus(`Error: ${event.error}`, 'error');
    }

    setTimeout(() => {
      if (!document.getElementById('micBtn').dataset.needsSetup) {
        setStatus('');
      }
    }, 3000);
  };

  recognition.onend = () => {
    if (isRecording) {
      // If still recording, restart (for continuous listening)
      try {
        recognition.start();
      } catch (e) {
        console.log('Recognition restart failed:', e);
      }
    }
  };
}

function toggleVoiceInput() {
  const micBtn = document.getElementById('micBtn');

  // check if we need to open setup
  if (micBtn.dataset.needsSetup === 'true') {
    chrome.tabs.create({ url: 'setup.html' });
    micBtn.dataset.needsSetup = 'false';
    setStatus('');
    return;
  }

  if (!recognition) {
    setStatus('Voice input not available', 'error');
    return;
  }

  if (isRecording) {
    stopVoiceInput();
  } else {
    startVoiceInput();
  }
}

function startVoiceInput() {
  try {
    recognition.start();
  } catch (error) {
    console.error('Error starting recognition:', error);
    if (error.type === 'not-allowed') {
      chrome.tabs.create({ url: 'setup.html' });
    }
    setStatus('Could not start voice input', 'error');
  }
}

function stopVoiceInput() {
  if (recognition && isRecording) {
    isRecording = false;
    recognition.stop();

    const micBtn = document.getElementById('micBtn');
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎤';

    setStatus('Voice input stopped');
    setTimeout(() => setStatus(''), 2000);
  }
}

function showInChatThoughts() {
  const chatHistory = document.getElementById('chatHistory');
  const thoughtDiv = document.createElement('div');
  thoughtDiv.className = 'popup-thought';
  thoughtDiv.id = 'active-thought';
  thoughtDiv.innerHTML = `
        <span class="thought-text">Analyzing your intent...</span>
        <div class="typing-dots"><span></span><span></span><span></span></div>
    `;
  chatHistory.appendChild(thoughtDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  const thoughts = [
    '🔍 Analyzing your intent...',
    '🌐 Scanning page context...',
    '💡 Checking memory bank...',
    '⚡️ Formulating optimal response...',
    '✨ Finalizing output...'
  ];
  let i = 0;
  const interval = setInterval(() => {
    const textEl = thoughtDiv.querySelector('.thought-text');
    if (textEl) {
      i++;
      textEl.textContent = thoughts[i % thoughts.length];
    }
  }, 1500);
  return interval;
}

function removeInChatThoughts(interval) {
  if (interval) clearInterval(interval);
  const thoughtDiv = document.getElementById('active-thought');
  if (thoughtDiv) thoughtDiv.remove();
}

async function addMessageWithAnimation(text, role) {
  if (role !== 'assistant') {
    addMessage(text, role);
    return;
  }

  const chatHistory = document.getElementById('chatHistory');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}-message`;
  chatHistory.appendChild(messageDiv);

  // Filter citations for animation (we'll add them at the end)
  const rawContent = text;
  let currentText = '';
  const speed = 15; // ms per char

  for (let i = 0; i < rawContent.length; i++) {
    currentText += rawContent[i];
    // Don't update innerHTML every char if it contains tags
    if (rawContent.includes('[[')) {
      // For citations, just show partial text for now
      messageDiv.textContent = currentText;
    } else {
      messageDiv.textContent = currentText;
    }
    chatHistory.scrollTop = chatHistory.scrollHeight;
    await new Promise(r => setTimeout(r, speed));
  }

  // Final render with citation formatting
  messageDiv.innerHTML = formatMessageContent(text);
  attachCitationListeners(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // Save to history
  conversationHistory.push({ role, content: text });
  chrome.storage.local.set({ history: conversationHistory });
}

// Perform WOW analysis function logic moved above handleSend

async function analyzePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Simulate "Processing" in the Load Bar
    updateNeuralLoad(45);

    const response = await fetch('http://localhost:8000/analyze-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_text: tab.title, // Simplified for now, content.js could send full text
        page_title: tab.title
      })
    });

    if (!response.ok) throw new Error('Analysis failed');
    const data = await response.json();

    updateVisionTicker(data.entities);
    updatePageVibe(data.vibe_score, data.vibe_color);
    updateNeuralLoad(15); // Reset to idle load
  } catch (err) {
    console.error('WOW Analysis Error:', err);
  }
}

function updateVisionTicker(entities) {
  const tickerContent = document.getElementById('tickerContent');
  const tickerContainer = document.getElementById('visionTicker');
  if (!entities || entities.length === 0) return;

  tickerContent.innerHTML = '';
  entities.forEach(entity => {
    const item = document.createElement('div');
    item.className = 'ticker-item';
    item.innerHTML = `<span class="label">${entity.label}:</span> ${entity.value}`;
    tickerContent.appendChild(item);
  });

  // Duplicate content for seamless loop
  const clone = tickerContent.innerHTML;
  tickerContent.innerHTML += clone;

  tickerContainer.classList.remove('hidden');
}

function updatePageVibe(score, color) {
  const orb = document.getElementById('vibeOrb');
  if (!orb) return;

  // Remove old vibe classes
  orb.classList.remove('vibe-chill', 'vibe-calm', 'vibe-dynamic', 'vibe-intense');

  // Simple mapping
  if (score < 25) orb.classList.add('vibe-chill');
  else if (score < 50) orb.classList.add('vibe-calm');
  else if (score < 75) orb.classList.add('vibe-dynamic');
  else orb.classList.add('vibe-intense');
}

function updateNeuralLoad(percent) {
  const loadBar = document.getElementById('neuralLoad');
  if (loadBar) {
    loadBar.style.width = `${percent}%`;
  }
}

async function handleSend() {
  // Stop recording if active
  if (isRecording) {
    stopVoiceInput();
  }

  const input = document.getElementById('userInput');
  const userMessage = input.value.trim();

  if (!userMessage) {
    setStatus('Please enter a message', 'error');
    setTimeout(() => setStatus(''), 2000);
    return;
  }

  // Clear input
  input.value = '';

  // Add user message
  addMessage(userMessage, 'user');

  // Disable send button
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  // --- Agentic Chain of Thought & Pulse Start ---

  // 1. Backend Pulse Calculation (Simulated Latency)
  const startTime = Date.now();
  const latencyEl = document.getElementById('latencyCalc');
  if (latencyEl) {
    latencyEl.textContent = 'measuring...';
    latencyEl.style.color = '#ffcc00'; // busy color
  }

  // 2. Chain of Thought Simulation
  const thoughts = [
    '🔍 Analyzing your intent...',
    '🌐 Scanning page context...',
    '💡 Checking memory bank...',
    '⚡️ Formulating optimal response...',
    '✨ Finalizing output...'
  ];
  let thoughtIndex = 0;

  // Show first thought immediately
  setStatus(thoughts[0], 'loading');

  const thoughtInterval = setInterval(() => {
    thoughtIndex++;
    if (thoughtIndex < thoughts.length) {
      setStatus(thoughts[thoughtIndex], 'loading');
    }
  }, 1200); // Transition thoughts every 1.2s

  // 3. START IN-CHAT THOUGHTS
  const inChatThoughtInterval = showInChatThoughts();

  try {
    // Get page context
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let pageContext;
    try {
      pageContext = await chrome.tabs.sendMessage(tab.id, { action: 'getPageText' });
    } catch (e) {
      console.error('Could not get page text:', e);
      pageContext = { text: '' };
    }

    // Get memory
    const stored = await chrome.storage.local.get(['memory']);
    const memory = stored.memory || { preferences: [], notes: [] };

    // Prepare payload
    const payload = {
      user_input: userMessage,
      page_text: pageContext.text || '',
      page_url: tab.url,
      page_title: tab.title,
      conversation_history: conversationHistory.slice(-6), // last 3 exchanges
      memory: memory
    };

    // Send to backend
    const response = await fetch('http://localhost:8000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Stop Chain of Thought (In status bar as well just in case)
    clearInterval(thoughtInterval);
    removeInChatThoughts(inChatThoughtInterval);

    // Update Pulse Latency
    const endTime = Date.now();
    const duration = endTime - startTime;
    if (latencyEl) {
      latencyEl.textContent = `${duration}ms`;
      latencyEl.style.color = '#34c759'; // green success
    }

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();

    console.log('📦 Backend response:', data);
    console.log('🎯 Action in response?', data.action);

    // Handle actions (open tabs, navigate, etc.)
    if (data.action) {
      console.log('✅ Calling handleAction with:', data.action);
      handleAction(data.action);
    } else {
      console.log('⚠️ No action in response');
    }

    // Add assistant response with animation
    await addMessageWithAnimation(data.reply, 'assistant');

    // Update memory if provided
    if (data.memory) {
      await chrome.storage.local.set({ memory: data.memory });
    }

    // Show context note if relevant
    if (data.context_note) {
      addContextNote(data.context_note);
    }

    // Update recommendations dropdown if provided
    if (data.suggested_questions && data.suggested_questions.length > 0) {
      const recContainer = document.getElementById('recommendations');
      const recDropdown = document.getElementById('recDropdown');

      // Clear old options except the first one
      recDropdown.innerHTML = '<option value="" disabled selected>Choose a follow-up...</option>';

      data.suggested_questions.forEach(q => {
        const option = document.createElement('option');
        option.value = q;
        option.textContent = q;
        recDropdown.appendChild(option);
      });

      recContainer.classList.remove('hidden');

      recContainer.classList.remove('hidden');
    } else {
      document.getElementById('recommendations').classList.add('hidden');
    }

    setStatus('');

  } catch (error) {
    if (typeof thoughtInterval !== 'undefined') clearInterval(thoughtInterval); // Safety clear
    if (typeof inChatThoughtInterval !== 'undefined') removeInChatThoughts(inChatThoughtInterval);

    console.error('Error:', error);
    addMessage('Sorry, I encountered an error. Make sure the backend is running on http://localhost:8000', 'assistant');
    setStatus('Error connecting to backend', 'error');
    setTimeout(() => setStatus(''), 5000);
  } finally {
    sendBtn.disabled = false;
  }
}

// --- Neural Sync Logic ---

function initNeuralConnectivity() {
  // 1. Handle "Connect" button click -> Toggle Form
  document.querySelectorAll('.connect-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const service = e.target.dataset.service;
      const card = document.getElementById(`mcp-${service}`);

      // If already connected, handle logic (disconnect etc)
      if (card.classList.contains('connected')) {
        // Disconnect logic could go here
        return;
      }

      // Toggle Form Visibility
      const form = document.getElementById(`form-${service}`);
      if (form.classList.contains('hidden')) {
        form.classList.remove('hidden');
        btn.textContent = 'Cancel';
      } else {
        form.classList.add('hidden');
        btn.textContent = 'Connect';
      }
    });
  });

  // 2. Handle "Authenticate" click -> Run Simulation
  document.querySelectorAll('.auth-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const service = e.target.dataset.service;
      // Hide form inputs for a cleaner look during simulation or keep them
      const form = document.getElementById(`form-${service}`);
      form.classList.add('hidden');

      startNeuralHandshake(service);
    });
  });
}

function startNeuralHandshake(serviceId) {
  const card = document.getElementById(`mcp-${serviceId}`);
  const headerBtn = card.querySelector('.connect-btn');
  const status = card.querySelector('.mcp-status');
  const terminal = document.getElementById('neural-terminal');
  const termContent = document.getElementById('terminal-content');

  // Reset UI state for simulation
  headerBtn.textContent = 'Verifying...';
  headerBtn.disabled = true;
  terminal.classList.remove('hidden');
  termContent.innerHTML = '';

  const logs = [
    `> Encrypting credentials for ${serviceId.toUpperCase()}...`,
    `> Dispatching to secure enclave...`,
    `> Verifying API Key signature...`,
    `> Handshake successful [200 OK]`,
    `> Fetching remote schema...`,
    `> Syncing metadata...`,
    `> ERROR: MCP Server Protocol Mismatch (v1.2 != v1.4)`,
    `> Retrying connection (attempt 1/3)...`,
    `> Failed to establish websocket tunnel.`
  ];

  let i = 0;
  const interval = setInterval(() => {
    if (i >= logs.length) {
      clearInterval(interval);
      // Finish with ERROR
      headerBtn.textContent = 'Retry';
      headerBtn.disabled = false;
      status.textContent = '● Connection Failed';
      status.style.color = '#ff3b30'; // Red

      AddLog('CRITICAL: unable to get the mcp connected to your agent. recheck and initialize the mcp server properly', 'error');

      // Keep terminal open to show error
      // setTimeout(() => terminal.classList.add('hidden'), 2500);
      return;
    }

    // Add normal log or error log based on content
    const isError = logs[i].includes('ERROR') || logs[i].includes('Failed');
    AddLog(logs[i], isError ? 'warn' : '');
    i++;
  }, 700); // Slightly slower for realism

  function AddLog(text, type = '') {
    const div = document.createElement('div');
    div.className = `log-line ${type}`;
    div.textContent = text;
    if (type === 'error') div.style.color = '#ff3b30';
    termContent.appendChild(div);
    termContent.scrollTop = termContent.scrollHeight;
  }
}

function formatMessageContent(text) {
  // Replace [[citation: ...]] with chips
  return text.replace(/\[\[citation: (.*?)\]\]/g, (match, quote) => {
    return `<span class="citation-chip" data-quote="${quote.replace(/"/g, '&quot;')}">📝 source</span>`;
  });
}

function attachCitationListeners(element) {
  element.querySelectorAll('.citation-chip').forEach(chip => {
    chip.addEventListener('mouseenter', async () => {
      const quote = chip.dataset.quote;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: 'highlight_text', text: quote });
    });
  });
}

function addMessage(text, role) {
  const chatHistory = document.getElementById('chatHistory');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}-message`;

  // Use innerHTML for citations if assistant, else text
  if (role === 'assistant') {
    messageDiv.innerHTML = formatMessageContent(text);
    attachCitationListeners(messageDiv);
  } else {
    messageDiv.textContent = text;
  }

  chatHistory.appendChild(messageDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;

  // Save to history
  conversationHistory.push({ role, content: text });
  chrome.storage.local.set({ history: conversationHistory });
}

function addContextNote(note) {
  const chatHistory = document.getElementById('chatHistory');
  const noteDiv = document.createElement('div');
  noteDiv.className = 'context-note';
  noteDiv.textContent = `💡 ${note}`;
  chatHistory.appendChild(noteDiv);
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

function renderHistory() {
  const chatHistory = document.getElementById('chatHistory');
  chatHistory.innerHTML = '';
  conversationHistory.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.role}-message`;

    if (msg.role === 'assistant') {
      messageDiv.innerHTML = formatMessageContent(msg.content);
      attachCitationListeners(messageDiv);
    } else {
      messageDiv.textContent = msg.content;
    }

    chatHistory.appendChild(messageDiv);
  });
  chatHistory.scrollTop = chatHistory.scrollHeight;
}

async function clearHistory() {
  console.log('🗑️ Clearing history...');
  if (!confirm('Clear all history, memory, and settings? This will restart onboarding.')) {
    return;
  }

  try {
    conversationHistory = [];
    await chrome.storage.local.set({
      history: [],
      memory: { preferences: [], notes: [] },
      onboarding_complete: false,
      user_settings: null
    });

    document.getElementById('chatHistory').innerHTML = '';
    setStatus('History cleared - Restarting...', 'success');

    // Hard Restart of Extension
    setTimeout(() => {
      chrome.runtime.reload();
    }, 500);
  } catch (e) {
    console.error('Clear failed:', e);
    setStatus('Failed to clear: ' + e.message, 'error');
  }
}

function setStatus(text, type = 'default') {
  const statusEl = document.getElementById('status');
  if (!statusEl) return;

  statusEl.textContent = text;
  statusEl.className = 'status ' + type;

  // Update Orb Vibe if needed
  const orb = document.getElementById('vibeOrb');
  if (orb) {
    if (type === 'loading') orb.style.opacity = '0.5';
    else orb.style.opacity = '1';
  }

  // Clear success/error after 3s
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'status';
      }
      if (brain) brain.classList.remove('thinking');
    }, 3000);
  }
}

async function handleAction(action) {
  console.log('🎬 handleAction called:', action);
  if (action.type === 'open_url' && action.url) {
    try {
      console.log('🌐 Opening URL:', action.url);
      // Open URL in new tab
      const newTab = await chrome.tabs.create({ url: action.url, active: true });
      console.log('✅ Tab created, ID:', newTab.id);

      // Prepare context for floating assistant
      const assistantContext = {
        original_query: document.getElementById('userInput').value,
        preferences: await getStoredPreferences(),
        conversation_history: conversationHistory.slice(-3)
      };

      // Retry logic to inject floating assistant
      const maxRetries = 5;
      let retryCount = 0;

      const tryInjectAssistant = async () => {
        try {
          console.log(`🔄 Attempt ${retryCount + 1}/${maxRetries} - sending message to tab ${newTab.id}`);
          const msg = {
            action: 'show_assistant',
            message: action.proactive_message || action.message || 'I\'m here to help!',
            context: assistantContext
          };
          console.log('📨 Message:', msg);
          const response = await chrome.tabs.sendMessage(newTab.id, msg);
          console.log('✅ Floating assistant injected successfully! Response:', response);
        } catch (e) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`Retry ${retryCount}/${maxRetries} - waiting for content script...`);
            setTimeout(tryInjectAssistant, 1000);
          } else {
            console.error('Failed to inject floating assistant after max retries:', e);
          }
        }
      };

      // Start trying after initial delay
      setTimeout(tryInjectAssistant, 1500);

      console.log('Opened URL:', action.url);
    } catch (error) {
      console.error('Error opening tab:', error);
    }
  }
  // --- New Agentic Action: Navigate Page ---
  else if (action.type === 'navigate_page') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      await chrome.tabs.sendMessage(tab.id, {
        action: 'agent_navigate',
        target: action.entities.target_text,
        direction: action.entities.scroll_direction
      });

      if (action.message) setStatus(action.message, 'success');
    } catch (e) {
      console.error('Navigation failed:', e);
    }
  }
}

async function getStoredPreferences() {
  const stored = await chrome.storage.local.get(['memory']);
  return stored.memory?.preferences || [];
}

// --- Onboarding Logic (Typeform Style) ---

function showOnboarding() {
  const overlay = document.getElementById('setupOverlay');
  if (overlay) overlay.classList.remove('hidden');
}

async function handleOnboardingSubmit(e) {
  e.preventDefault();
  // Simplified for this overlay version
  const apiKey = e.target.querySelector('input').value;
  if (apiKey) {
    await chrome.storage.local.set({
      openai_api_key: apiKey,
      onboarding_complete: true
    });
    showChat();
    setStatus('API Key updated!', 'success');
  }
}

function showChat() {
  console.log('✨ Showing Chat Interface');
  const overlay = document.getElementById('setupOverlay');
  if (overlay) overlay.classList.add('hidden');
  renderNotes();
}

function initOnboardingListeners() {
  // Option Buttons (Step 1 & 4)
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const parentStats = e.target.closest('.step').dataset.step;
      const value = e.target.innerText; // Simple value extraction

      // Highlight selected
      e.target.parentElement.querySelectorAll('.option-btn').forEach(b => b.style.borderColor = 'transparent');
      e.target.style.borderColor = '#007aff';
      e.target.style.background = '#f0f7ff';

      // Auto-advance logic
      if (parentStats === '1') {
        document.getElementById('goal').value = value;
        setTimeout(() => nextStep(2), 300);
      } else if (parentStats === '4') {
        document.getElementById('detail_level').value = value;
        // Auto-submit or show next? Step 5 is next.
        setTimeout(() => nextStep(5), 300);
      }
    });
  });

  // Enter key support for inputs
  document.querySelectorAll('.input-large').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const currentStep = parseInt(e.target.closest('.step').dataset.step);
        nextStep(currentStep + 1);
      }
    });
  });

  // Next Buttons
  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // If it's a submit button, don't hijack it unless manual handling needed
      if (e.target.type !== 'submit') {
        const next = e.target.dataset.next;
        if (next) nextStep(parseInt(next));
      }
    });
  });

  // Toggle Switches (Visual only)
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('active');
    });
  });

  // Setup form submit
  const setupForm = document.getElementById('setupForm');
  if (setupForm) {
    setupForm.addEventListener('submit', handleOnboardingSubmit);
  }
}

function nextStep(stepNum) {
  // Hide all steps
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));

  // Show target step
  const target = document.querySelector(`.step[data-step="${stepNum}"]`);
  if (target) {
    target.classList.add('active');

    // Focus input if exists
    const input = target.querySelector('input');
    if (input) setTimeout(() => input.focus(), 400);

    // Update Progress Bar
    const progress = (stepNum / 5) * 100; // Assuming 5 steps for progress calculation
    document.getElementById('progressBar').style.width = `${progress}%`;
  }
}

async function fetchRecommendations() {
  const recContainer = document.getElementById('recommendations');

  // Default fallbacks in case of error
  const fallbacks = [
    "Summarize this page",
    "What are the main takeaways?",
    "Explain the key concepts"
  ];

  try {
    // Get page context
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    let pageContext = { text: '', title: tab.title, url: tab.url };
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageText' });
      if (response) pageContext.text = response.text;
    } catch (e) {
      console.log('Could not get page text for recs (content script might not be ready)', e);
    }

    // Check if backend is reachable before waiting too long
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 sec timeout

    const stored = await chrome.storage.local.get(['memory']);

    const response = await fetch('http://localhost:8000/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page_context: pageContext,
        memory: stored.memory
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    console.log('✨ Recommendations data:', data);

    if (data && Array.isArray(data)) {
      renderRecommendations(data);
    } else if (data.questions && data.questions.length > 0) {
      renderRecommendations(data.questions);
    } else {
      console.log('⚠️ No suggestions found, using fallbacks');
      renderRecommendations(fallbacks);
    }

  } catch (e) {
    console.error('Error fetching recommendations:', e);
    // Show fallbacks on error (network error, backend down, etc)
    renderRecommendations(fallbacks);
  }
}

function renderRecommendations(questions) {
  console.log('🎨 Rendering recommendations:', questions);
  const recContainer = document.getElementById('recommendations');
  const recDropdown = document.getElementById('recDropdown');

  if (!questions || questions.length === 0 || !recDropdown) {
    console.log('❌ Suggestions skipped (empty or no dropdown)');
    if (recContainer) recContainer.classList.add('hidden');
    return;
  }

  // Clear existing options except the first placeholder
  while (recDropdown.options.length > 1) {
    recDropdown.remove(1);
  }

  questions.forEach(q => {
    const option = document.createElement('option');
    option.value = q;
    option.textContent = q;
    recDropdown.appendChild(option);
  });

  recContainer.classList.remove('hidden');
}

function handleRecClick(question) {
  document.getElementById('userInput').value = question;
  handleSend();
  // Don't hide completely, just let them update naturally or stay until next response
  // document.getElementById('recommendations').classList.add('hidden');
}

async function renderNotes() {
  const container = document.getElementById('notesContainer');
  const stored = await chrome.storage.local.get(['memory']);
  const notes = stored.memory?.notes || [];

  container.innerHTML = '';

  if (notes.length === 0) {
    container.innerHTML = '<div class="empty-state">No notes saved yet. Ask me to save one!</div>';
    return;
  }

  notes.slice().reverse().forEach((note, index) => {
    const actualIndex = notes.length - 1 - index;
    const div = document.createElement('div');
    div.className = 'note-card';
    div.innerHTML = `
            <div class="note-content" id="note-text-${actualIndex}">${note}</div>
            <div class="note-actions">
                <button onclick="startEditingNote(${actualIndex})" class="note-btn" title="Edit">✏️</button>
                <button onclick="deleteNote(${actualIndex})" class="note-btn delete" title="Delete">🗑️</button>
            </div>
            <span class="note-date">Saved recently</span>
        `;
    container.appendChild(div);
  });
}

async function deleteNote(index) {
  const stored = await chrome.storage.local.get(['memory']);
  if (stored.memory && stored.memory.notes) {
    stored.memory.notes.splice(index, 1);
    await chrome.storage.local.set({ memory: stored.memory });
    renderNotes();
  }
}

function startEditingNote(index) {
  const textEl = document.getElementById(`note-text-${index}`);
  const oldText = textEl.textContent;
  textEl.innerHTML = `
    <textarea class="edit-note-input" id="edit-input-${index}">${oldText}</textarea>
    <div class="edit-actions">
      <button onclick="saveNoteEdit(${index})" class="sm-neon-btn">Save</button>
      <button onclick="renderNotes()" class="sm-btn">Cancel</button>
    </div>
  `;
}

async function saveNoteEdit(index) {
  const newText = document.getElementById(`edit-input-${index}`).value;
  const stored = await chrome.storage.local.get(['memory']);
  if (stored.memory && stored.memory.notes) {
    stored.memory.notes[index] = newText;
    await chrome.storage.local.set({ memory: stored.memory });
    renderNotes();
  }
}

// Attach these to window so onclick works
window.deleteNote = deleteNote;
window.startEditingNote = startEditingNote;
window.saveNoteEdit = saveNoteEdit;

async function clearNotes() {
  if (confirm('Clear all notes?')) {
    const stored = await chrome.storage.local.get(['memory']);
    if (stored.memory) {
      stored.memory.notes = [];
      await chrome.storage.local.set({ memory: stored.memory });
      renderNotes();
    }
  }
}
