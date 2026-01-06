// Floating Assistant - Test Version with Backend Logging
(function () {
    'use strict';

    console.log('=== FLOATING ASSISTANT SCRIPT STARTING ===');

    // Log to backend server
    function logToBackend(message, level = 'INFO') {
        fetch('http://localhost:8000/log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                level: level,
                source: 'floating-assistant',
                url: window.location.href
            })
        }).catch(e => console.error('Backend log failed:', e));
    }

    logToBackend('Script starting on: ' + window.location.href);
    console.log('Location:', window.location.href);

    // Simple test function
    function testFunction() {
        console.log('TEST FUNCTION CALLED');
        logToBackend('TEST FUNCTION CALLED');

        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:20px;right:20px;background:red;color:white;padding:20px;z-index:999999;border:3px solid yellow;';
        div.innerHTML = '<h2>FLOATING ASSISTANT TEST</h2><p>Message received!</p>';
        document.body.appendChild(div);

        console.log('Test div appended to body');
        logToBackend('Test div appended successfully');
    }

    // Listen for messages
    console.log('Setting up message listener...');
    logToBackend('Setting up message listener');

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('MESSAGE RECEIVED:', request);
        logToBackend('Message received: ' + JSON.stringify(request));

        if (request.action === 'show_assistant') {
            console.log('SHOW ASSISTANT ACTION DETECTED');
            logToBackend('SHOW ASSISTANT action detected - calling testFunction');
            testFunction();
            sendResponse({ success: true, message: 'Test executed' });
        }

        return true;
    });

    console.log('=== FLOATING ASSISTANT SCRIPT LOADED ===');
    logToBackend('Floating assistant script fully loaded and ready');
})();
