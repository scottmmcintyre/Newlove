// Cross-browser compatibility layer
(function(global, factory) {
    if (typeof chrome !== 'undefined') {
        // Chrome uses the chrome.* namespace
        global.browser = {
            storage: {
                local: {
                    get: (keys) => chrome.storage.local.get(keys),
                    set: (items) => chrome.storage.local.set(items),
                    remove: (keys) => chrome.storage.local.remove(keys)
                }
            }
        };
    } else if (typeof browser !== 'undefined') {
        // Firefox already has the browser.* namespace
        global.browser = browser;
    }
    
    // Dispatch an event to notify that the polyfill is ready
    const event = new Event('browser-polyfill-ready');
    global.dispatchEvent(event);
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);