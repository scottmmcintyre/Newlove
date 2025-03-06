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
            },
            runtime: {
                onInstalled: chrome.runtime.onInstalled
            },
            contextMenus: {
                create: (options) => chrome.contextMenus?.create(options)
            }
        };
    } else if (typeof browser !== 'undefined') {
        // Firefox already has the browser.* namespace
        global.browser = browser;
    }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);