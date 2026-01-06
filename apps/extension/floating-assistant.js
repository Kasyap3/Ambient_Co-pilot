// Floating Assistant - Conversational AI in new tabs
let assistantContainer = null;
let isMinimized = false;
let currentContext = null;
let conversationHistory = [];

try {
  console.log('🚀 Starting floating-assistant.js initialization...');

  window.createFloatingAssistant = function (initialMessage, context) {
    console.log('📝 createFloatingAssistant called with message:', initialMessage);
    removeFloatingAssistant();

    currentContext = context;
    conversationHistory = [];

    // Create container
    assistantContainer = document.createElement('div');
    assistantContainer.id = 'ambient-copilot-floating';
    assistantContainer.className = 'ambient-floating-assistant';

    assistantContainer.innerHTML = `
    <div class="ambient-header">
      <h3>🤖 Ambient Copilot</h3>
      <button class="ambient-minimize" id="ambient-minimize-btn">−</button>
    </div>
    <div class="ambient-chat-container">
      <div class="ambient-messages" id="ambient-messages">
        <div class="ambient-assistant-msg">${initialMessage}</div>
      </div>
      <div class="ambient-input-area">
        <input 
          type="text" 
          id="ambient-user-input" 
          class="ambient-input" 
          placeholder="Type your response..."
        />
        <button id="ambient-send-btn" class="ambient-send-btn">Send</button>
      </div>
    </div>
  `;

    console.log('➕ Appending assistant to body...');
    document.body.appendChild(assistantContainer);
    console.log('✅ Assistant appended successfully!');
    console.log('🎨 Assistant element:', assistantContainer);

    // Add to conversation
    conversationHistory.push({
      role: 'assistant',
      content: initialMessage
    });

    // Event listeners
    document.getElementById('ambient-minimize-btn').addEventListener('click', minimizeAssistant);
    document.getElementById('ambient-send-btn').addEventListener('click', handleUserMessage);
    document.getElementById('ambient-user-input').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleUserMessage();
      }
    });

    // Auto-focus input
    document.getElementById('ambient-user-input').focus();
  }

  function minimizeAssistant() {
    if (isMinimized) {
      // Restore
      assistantContainer.className = 'ambient-floating-assistant';
      isMinimized = false;
    } else {
      // Minimize to bubble
      const originalHTML = assistantContainer.innerHTML;
      assistantContainer.innerHTML = '💬';
      assistantContainer.className = 'ambient-floating-assistant ambient-minimized';
      assistantContainer.onclick = () => {
        // Toggle back
        isMinimized = false;
        assistantContainer.innerHTML = originalHTML;
        assistantContainer.className = 'ambient-floating-assistant';
        assistantContainer.onclick = null;

        // Re-attach event listeners
        document.getElementById('ambient-minimize-btn')?.addEventListener('click', minimizeAssistant);
        document.getElementById('ambient-send-btn')?.addEventListener('click', handleUserMessage);
        const input = document.getElementById('ambient-user-input');
        if (input) {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUserMessage();
          });
          input.focus();
        }
      };
      isMinimized = true;
    }
  }

  function removeFloatingAssistant() {
    const existing = document.getElementById('ambient-copilot-floating');
    if (existing) {
      existing.remove();
    }
  }

  async function handleUserMessage() {
    const input = document.getElementById('ambient-user-input');
    const userMessage = input.value.trim();

    if (!userMessage) return;

    // Clear input
    input.value = '';

    // Add user message to chat
    addMessage(userMessage, 'user');
    conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Show typing indicator
    showTypingIndicator();

    // Get page info
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      text: document.body.innerText.slice(0, 5000),
      html: document.body.innerHTML.slice(0, 5000)
    };

    try {
      // Send to backend for conversational response
      const response = await fetch('http://localhost:8000/assist-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: userMessage,
          page_info: pageInfo,
          context: currentContext,
          conversation_history: conversationHistory
        })
      });

      const data = await response.json();

      // Remove typing indicator
      removeTypingIndicator();

      // Add assistant response
      addMessage(data.message, 'assistant');
      conversationHistory.push({
        role: 'assistant',
        content: data.message
      });

      // Handle any actions
      if (data.action) {
        await handleAssistantAction(data.action);
      }

    } catch (error) {
      console.error('Error:', error);
      removeTypingIndicator();
      addMessage('Sorry, I encountered an error. Make sure the backend is running.', 'assistant');
    }
  }

  function addMessage(text, role) {
    const messagesContainer = document.getElementById('ambient-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `ambient-${role}-msg`;
    messageDiv.textContent = text;
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function showTypingIndicator() {
    const messagesContainer = document.getElementById('ambient-messages');
    if (!messagesContainer) return;

    const typingDiv = document.createElement('div');
    typingDiv.className = 'ambient-assistant-msg ambient-typing';
    typingDiv.id = 'ambient-typing';
    typingDiv.innerHTML = '<span>●</span><span>●</span><span>●</span>';
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById('ambient-typing');
    if (typing) {
      typing.remove();
    }
  }

  async function handleAssistantAction(action) {
    if (action.type === 'fill_form' && action.fields) {
      // Fill form fields on the page
      for (const field of action.fields) {
        fillField(field.selector, field.value);
      }

      addMessage('✅ Form filled! Please review and submit.', 'assistant');
    } else if (action.type === 'open_url' && action.url) {
      // Handle URL opening (e.g. mailto, or new tab)
      addMessage(`🔗 Opening ${action.url.startsWith('mailto:') ? 'email draft' : 'link'} for you...`, 'assistant');
      window.open(action.url, '_blank');
    } else if (action.type === 'save_note' && action.entities && action.entities.note_content) {
      // Save note to memory
      const note = action.entities.note_content;
      addMessage('💾 Saving note to your Memory Bank...', 'assistant');

      try {
        const stored = await chrome.storage.local.get(['memory']);
        const memory = stored.memory || { preferences: [], notes: [] };

        // Add note (deduplicate)
        if (!memory.notes.includes(note)) {
          memory.notes.push(note);
          // Keep last 50 notes
          if (memory.notes.length > 50) memory.notes.shift();

          await chrome.storage.local.set({ memory });
          addMessage('✅ Note saved! You can view it in the "Brain" tab.', 'assistant');
        } else {
          addMessage('ℹ️ Note already exists.', 'assistant');
        }
      } catch (e) {
        console.error('Error saving note:', e);
        addMessage('❌ Failed to save note.', 'assistant');
      }
    }
  }

  function fillField(selector, value) {
    // Try multiple selector strategies
    const strategies = [
      () => document.querySelector(selector),
      () => document.querySelector(`input[name*="${selector}"]`),
      () => document.querySelector(`input[placeholder*="${selector}"]`),
      () => document.querySelector(`input[aria-label*="${selector}"]`),
      () => document.querySelector(`[data-testid*="${selector}"]`)
    ];

    for (const strategy of strategies) {
      try {
        const element = strategy();
        if (element) {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          console.log(`✅ Filled field: ${selector} = ${value}`);
          return true;
        }
      } catch (e) {
        continue;
      }
    }

    console.warn(`⚠️ Could not find field: ${selector}`);
    return false;
  }

  // Listen for messages from extension
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('🔔 Floating assistant received message:', request);

    if (request.action === 'show_assistant') {
      console.log('✅ Creating floating assistant with message:', request.message);

      // Check if this is a Magic Fill request
      if (request.context && request.context.type === 'form_fill') {
        handleMagicFillRequest(request.message, request.context);
      } else {
        createFloatingAssistant(request.message, request.context);
      }

      sendResponse({ success: true });
    }
    return true;
  });

  async function handleMagicFillRequest(message, context) {
    createFloatingAssistant(message, context);

    // Auto-trigger the filling process after a short delay
    // Simulation of "Agent thinking"
    showTypingIndicator();

    const formData = context.form_data;

    // Construct prompt for backend
    const userMessage = "Auto-fill this form using my profile";

    // Add to history
    addMessage(userMessage, 'user');
    conversationHistory.push({ role: 'user', content: userMessage });

    try {
      // Send to backend
      const response = await fetch('http://localhost:8000/assist-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: userMessage,
          page_info: { url: formData.url, text: JSON.stringify(formData.fields) },
          context: context,
          conversation_history: conversationHistory
        })
      });

      const data = await response.json();
      removeTypingIndicator();

      // precise form filling
      if (data.action && data.action.type === 'fill_form') {
        addMessage("🪄 Magic Fill in progress...", 'assistant');
        await performMagicFill(data.action.fields);
        addMessage(data.message || "Done! Please review the fields.", 'assistant');
      } else {
        addMessage(data.message, 'assistant');
      }

    } catch (e) {
      console.error(e);
      removeTypingIndicator();
      addMessage("Failed to magic fill. Please try again.", 'assistant');
    }
  }

  async function performMagicFill(fields) {
    for (const field of fields) {
      // Find element
      const strategies = [
        () => document.querySelector(`[name="${field.selector}"]`),
        () => document.getElementById(field.selector),
        () => document.querySelector(field.selector) // fallback
      ];

      let element = null;
      for (const strat of strategies) {
        element = strat();
        if (element) break;
      }

      if (element) {
        // Scroll to element
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight effect
        const originalBorder = element.style.border;
        const originalShadow = element.style.boxShadow;
        element.style.border = '2px solid #8b5cf6';
        element.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.5)';

        // Typewriter effect
        element.value = field.value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Wait a bit
        await new Promise(r => setTimeout(r, 400));

        // Remove highlight
        element.style.border = originalBorder;
        element.style.boxShadow = originalShadow;
      }
    }
  }

  console.log('🤖 Ambient Copilot floating assistant loaded and ready on:', window.location.href);

} catch (error) {
  console.error('❌ Error loading floating-assistant.js:', error);
  console.error('Stack trace:', error.stack);
}
