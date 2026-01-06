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

  return true; // Keep message channel open for async response
});

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
  });
}

function injectMagicButton(form) {
  // Create button container (relative to form)
  const container = document.createElement('div');
  container.className = 'ambient-magic-btn-container';
  container.style.cssText = 'position: absolute; top: -10px; right: 10px; z-index: 10000;';

  // Ensure form is relative so we can position absolute
  const formStyle = window.getComputedStyle(form);
  if (formStyle.position === 'static') {
    form.style.position = 'relative';
  }

  const btn = document.createElement('button');
  btn.className = 'ambient-magic-btn';
  btn.innerHTML = '✨ Fill with Copilot';
  btn.title = 'Auto-fill this form using your profile';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Identify fields to send to assistant context
    const fieldData = Array.from(form.querySelectorAll('input, select, textarea')).map(f => ({
      name: f.name || f.id || '',
      label: getLabelForField(f),
      type: f.type || f.tagName.toLowerCase()
    }));

    // Trigger floating assistant logic
    chrome.runtime.sendMessage({
      action: 'trigger_magic_fill',
      formContext: {
        url: window.location.href,
        fields: fieldData
      }
    });

    // Provide immediate feedback on button
    btn.innerHTML = '🔄 Working...';
    btn.disabled = true;

    // Reset button after a delay (or when finished)
    setTimeout(() => {
      btn.innerHTML = '✨ Fill with Copilot';
      btn.disabled = false;
    }, 5000);
  });

  container.appendChild(btn);
  form.insertBefore(container, form.firstChild);
}

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
detectForms();


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
    zIndex: '2147483647', // Max z-index
    padding: '6px 12px',
    fontSize: '12px'
  });

  // Use mousedown to prevent losing selection focus before click
  sparkleBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();

    console.log('✨ Smart Select Triggered');

    // Check for Floating Assistant availability
    if (window.createFloatingAssistant) {
      window.createFloatingAssistant(
        `Analyze and explain this context:\n"${text}"`,
        { type: 'selection', text: text, url: window.location.href }
      );
    } else {
      console.warn('Floating assistant script not found on window');
      alert('Ambient Copilot: Assistant script not ready yet.');
    }

    // Cleanup
    sparkleBtn.remove();
    sparkleBtn = null;
    window.getSelection().removeAllRanges();
  });

  document.body.appendChild(sparkleBtn);
}


// --- Agentic Utils (Highlights & Ghost Cursor) ---

function highlightTextOnPage(snippet) {
  // Basic text search and highlight
  // Note: robust text finding in DOM is complex; using a simplified approach
  const finder = window.find(snippet);

  if (finder) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);

      // Create highlight span
      const span = document.createElement('span');
      span.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
      span.style.transition = 'background-color 1s ease-out';
      span.style.borderRadius = '4px';

      try {
        range.surroundContents(span);

        // Scroll into view
        span.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Fade out
        setTimeout(() => {
          span.style.backgroundColor = 'transparent';
          // Optional: remove span tag but keep text? 
          // Keeping simple for now
        }, 3000);
      } catch (e) {
        console.warn('Could not highlight range:', e);
      }
    }
  } else {
    console.log('Text snippet not found for highlight:', snippet);
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
