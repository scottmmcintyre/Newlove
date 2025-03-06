.PHONY: all clean

all: chrome.zip firefox.zip

chrome.zip: manifest.json newlove.user.js browser-polyfill.js
	zip chrome.zip manifest.json newlove.user.js browser-polyfill.js

firefox.zip: manifest.json newlove.user.js browser-polyfill.js
	zip firefox.zip manifest.json newlove.user.js browser-polyfill.js

clean:
	rm -f chrome.zip firefox.zip
