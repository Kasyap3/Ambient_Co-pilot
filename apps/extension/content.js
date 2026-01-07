// Content script - runs on every webpage
// Extracts visible text and handles proactive form detection

// Store injected buttons to avoid duplicates
const magicButtons = new Set();
// Smart Select Button reference
let sparkleBtn = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageText') {
    try {
      // Extract visible text from page
      const pageText = document.body.innerText;

      // Basic cleaning
      const cleanText = pageText
        .replace(/\s+/g, ' ')  // normalize whitespace
        .replace(/\n\s*\n/g, '\n')  // remove extra newlines
        .trim()
        .slice(0, 15000);  // limit to ~15k chars to avoid token limits

      sendResponse({ text: cleanText });
    } catch (error) {
      console.error('Error extracting page text:', error);
      sendResponse({ text: '', error: error.message });
    }
  }

  // --- New features ---
  if (request.action === 'highlight_text') {
    highlightTextOnPage(request.text);
  }

  if (request.action === 'agent_navigate') {
    executeAgentNavigation(request.target, request.direction);
  }

  if (request.action === 'trigger_magic_fill_direct') {
    // Directly trigger the first detected form as a shortcut
    const forms = document.querySelectorAll('form');
    if (forms.length > 0) {
      const firstForm = forms[0];
      console.log('🤖 Auto-filling form directly from Blueprint...');
      performMagicFill(firstForm);
    }
  }

  return true; // Keep message channel open for async response
});

async function performMagicFill(form) {
  // Qualifying fields for fill
  const fields = form.querySelectorAll('input:not([type="hidden"]), select, textarea');

  for (const field of fields) {
    // Scroll to element
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Premium Highlight effect
    const originalBorder = field.style.border;
    const originalShadow = field.style.boxShadow;
    field.style.border = '2px solid #0ea5e9';
    field.style.boxShadow = '0 0 15px rgba(14, 165, 233, 0.6)';
    field.style.backgroundColor = 'rgba(14, 165, 233, 0.05)';

    // Value Synthesis (Simulated profile data)
    let val = field.placeholder || field.name || 'Sample Analysis';
    if (field.type === 'email') val = 'user@example.com';
    if (field.type === 'tel') val = '+1-555-0199';

    // Typewriter simulation
    field.value = `[Neural] ${val}`;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));

    // Wait a bit per field for "Agent" feel
    await new Promise(r => setTimeout(r, 450));

    // Remove highlight
    field.style.border = originalBorder;
    field.style.boxShadow = originalShadow;
    field.style.backgroundColor = '';
  }
}

// Proactive Form Detection
function detectForms() {
  const forms = document.querySelectorAll('form');

  forms.forEach(form => {
    // Check if we've already processed this form
    if (magicButtons.has(form)) return;

    // Qualifying criteria: at least 3 input/select/textarea fields
    const fields = form.querySelectorAll('input:not([type="hidden"]), select, textarea');
    if (fields.length < 3) return;

    // Inject Magic Button
    injectMagicButton(form);
    magicButtons.add(form);

    // Global Signal
    chrome.runtime.sendMessage({ action: 'FORM_DETECTED', details: { id: form.id || 'anonymous_form' } });
  });
}

// UI Injections Disabled - Discovery signals only
function injectMagicButton(form) { }
function showSparkleButton(x, y, text) { }

function getLabelForField(field) {
  // 1. Check for label tag
  if (field.id) {
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label) return label.innerText;
  }
  // 2. Check for surrounding label
  const parentLabel = field.closest('label');
  if (parentLabel) return parentLabel.innerText;
  // 3. Fallback
  return field.placeholder || field.name || '';
}

// Run detection
// detectForms(); // Disabled to avoid page clutter; moved to Sidebar Blueprints

// Auto-Re-open Logic (Disabled: Moved to Side Panel)
/*
chrome.storage.local.get(['assistant_active'], (data) => {
  if (data.assistant_active) {
    ...
  }
});
*/


// --- Smart Select Feature ---

document.addEventListener('mouseup', handleSelection);
document.addEventListener('keyup', handleSelection); // Handle keyboard selection

function handleSelection(e) {
  // Small delay to ensure selection is registered
  setTimeout(() => {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    // Remove existing button if active
    if (sparkleBtn) {
      sparkleBtn.remove();
      sparkleBtn = null;
    }

    // Minimum length check (ignore accidental clicks)
    if (selectedText.length < 5) return;

    // Send Signal
    console.log('📡 Sending SELECTION_DETECTED for:', selectedText);
    chrome.runtime.sendMessage({ action: 'SELECTION_DETECTED', text: selectedText });

    // Ignore selections inside the assistant or magic buttons itself
    if (e.target.closest('.ambient-floating-assistant') || e.target.closest('.ambient-magic-btn')) return;

    // Position calculation
    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Calculate absolute position
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;

      // Show button at the end of selection
      showSparkleButton(rect.right + scrollX, rect.top + scrollY, selectedText);
    } catch (err) {
      console.warn('Selection range error:', err);
    }
  }, 10);
}

function showSparkleButton(x, y, text) {
  sparkleBtn = document.createElement('button');
  sparkleBtn.className = 'ambient-magic-btn';
  sparkleBtn.innerHTML = '✨ Explain';

  // Inline styles for precise positioning
  Object.assign(sparkleBtn.style, {
    position: 'absolute',
    left: `${x + 8}px`,
    top: `${y - 40}px`,
    zIndex: '2147483647',
    padding: '6px 12px',
    fontSize: '12px',
    background: '#0ea5e9',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
  });

  sparkleBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Send Signal directly to Side Panel
    chrome.runtime.sendMessage({ action: 'SELECTION_DETECTED', text: text });

    // Cleanup
    sparkleBtn.remove();
    sparkleBtn = null;
    window.getSelection().removeAllRanges();
  });

  document.body.appendChild(sparkleBtn);
}


// --- Agentic Utils (Highlights & Ghost Cursor) ---

function highlightTextOnPage(snippet) {
  if (!snippet) return;
  console.log('🔦 Attempting highlight for:', snippet);

  // 1. Try exact find
  let found = window.find(snippet, false, false, true);

  // 2. Fallback: Try a shorter version if it's too long
  if (!found && snippet.length > 50) {
    const shorter = snippet.substring(0, 50);
    console.log('🔦 Retrying with shorter snippet:', shorter);
    found = window.find(shorter, false, false, true);
  }

  if (found) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      const span = document.createElement('span');
      span.style.backgroundColor = 'rgba(14, 165, 233, 0.25)';
      span.style.borderBottom = '3px solid #0ea5e9';
      span.style.boxShadow = '0 0 15px rgba(14, 165, 233, 0.4)';
      span.style.transition = 'all 1.2s ease-out';
      span.style.borderRadius = '2px';
      span.style.padding = '2px 0';
      span.id = 'ambient-active-highlight';

      try {
        range.surroundContents(span);
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });

        setTimeout(() => {
          span.style.backgroundColor = 'transparent';
          span.style.boxShadow = 'none';
          span.style.borderBottomColor = 'transparent';
        }, 4000);
      } catch (e) {
        console.warn('Highlight range error:', e);
      }
    }
  } else {
    console.warn('❌ Text snippet not found on page.');
  }
}

function executeAgentNavigation(targetText, direction) {
  console.log('🖱️ Agent Navigating to:', targetText);

  // 1. Create Ghost Cursor
  let cursor = document.getElementById('ambient-ghost-cursor');
  if (!cursor) {
    cursor = document.createElement('div');
    cursor.id = 'ambient-ghost-cursor';
    cursor.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19135L11.7841 12.3673H5.65376Z" fill="black" stroke="white" stroke-width="1"/>
</svg>`;
    Object.assign(cursor.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'all 1.0s cubic-bezier(0.22, 1, 0.36, 1)'
    });
    document.body.appendChild(cursor);
  }

  // 2. Find target element
  // XPath contains text search
  const xpath = `//*[contains(text(), '${targetText}')]`;
  const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
  const element = result.singleNodeValue;

  if (element) {
    // Calculate position
    const rect = element.getBoundingClientRect();
    const targetX = rect.left + (rect.width / 2);
    const targetY = rect.top + (rect.height / 2);

    // Move cursor to target
    cursor.style.transform = `translate(${targetX - window.innerWidth}px, ${targetY - window.innerHeight}px)`; // Incorrect logic for transform, easier to use left/top

    // Better positioning logic:
    cursor.style.bottom = 'auto';
    cursor.style.right = 'auto';
    cursor.style.left = `${Math.max(0, window.innerWidth - 100)}px`; // Start from bottom right roughly
    cursor.style.top = `${window.innerHeight - 50}px`;

    // Trigger reflow
    void cursor.offsetWidth;

    // Animate
    cursor.style.left = `${targetX}px`;
    cursor.style.top = `${targetY}px`;

    // 3. Scroll & Click
    setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Simulate click
      cursor.style.transform = 'scale(0.8)';
      setTimeout(() => cursor.style.transform = 'scale(1)', 150);

      // Actual Click
      try {
        element.click();
      } catch (e) { console.log('Click failed', e); }

      // Remove cursor after a bit
      setTimeout(() => cursor.remove(), 2000);

    }, 1200);

  } else {
    console.warn('Agent could not find text:', targetText);
    // Fallback scrolling
    if (direction === 'down') window.scrollBy({ top: 500, behavior: 'smooth' });
    if (direction === 'up') window.scrollBy({ top: -500, behavior: 'smooth' });
  }
}
