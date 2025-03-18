/*
   Copyright 2007-2024 Ian Young and contributors

   This program is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

// Revision History
// 1.0 - Initial release
// 1.1 - Added ability to watch everyone's quicklove
// 1.2 - Erin [nichols] reworked this to work in Chrome!
// 1.3 - Use native JSON for storage, fix problems with FF4
// 1.4 - Updates for GreaseMonkey 3.0
// 2.0 - Updates for Chromium Manifest V3, native Firefox extension, buttons to replace context menu
// ==UserScript==
// @name           NewLove
// @version        2.0.0
// @namespace      http://www.grinnellplans.com
// @description    Shows only new planlove in the quicklove page.
// @downloadUrl    https://github.com/grinnellplans/Newlove/raw/master/newlove.user.js
// @include        http://www.grinnellplans.com/search.php?mysearch=*&planlove=1*
// @match          http://www.grinnellplans.com/search.php?mysearch=*&planlove=1*
// @include        http://grinnellplans.com/search.php?mysearch=*&planlove=1*
// @match          http://grinnellplans.com/search.php?mysearch=*&planlove=1*
// @include        https://www.grinnellplans.com/search.php?mysearch=*&planlove=1*
// @match          https://www.grinnellplans.com/search.php?mysearch=*&planlove=1*
// @include        https://grinnellplans.com/search.php?mysearch=*&planlove=1*
// @match          https://grinnellplans.com/search.php?mysearch=*&planlove=1*
// ==/UserScript==

/* Credit Douglas Crockford <http://javascript.crockford.com/remedial.html> */
String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, "");
};

// Gets the name of the author a given result is associated with
const getAuthor = (node) => {
    const links = node.getElementsByTagName('a');
    return links[0].textContent;
};

// Check given item against all members of the given array
const arrayContains = (arr, obj) => {
    if (!arr) return false;
    return arr.some(item => item.trim() === obj.trim());
};

// Add control buttons to the page
const addControlButtons = () => {
    // Find the planlove checkbox and label
    const planloveCheckbox = document.querySelector('input[name="planlove"]');
    if (!planloveCheckbox) return;

    // Find the text node containing "Planlove"
    let labelNode = planloveCheckbox.parentNode.lastChild;
    if (!labelNode) return;

    // Create container for buttons
    const buttonContainer = document.createElement('span');
    buttonContainer.style.marginLeft = '10px';
    buttonContainer.style.display = 'inline-flex';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.gap = '5px';

    // Create Reset Username button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset Username';
    resetButton.style.margin = '0';
    resetButton.onclick = async () => {
        const url = new URL(window.location.href);
        const guessUsername = url.searchParams.get("mysearch");
        await browser.storage.local.remove(["username", `planloveHash${guessUsername}`]);
        window.location.reload();
    };

    // Create Save as Unread button
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save as Unread';
    saveButton.style.margin = '0';
    saveButton.onclick = async () => {
        const url = new URL(window.location.href);
        const guessUsername = url.searchParams.get("mysearch");
        const { [`planloveHash${guessUsername}`]: currentLove } = await browser.storage.local.get(`planloveHash${guessUsername}`);
        await browser.storage.local.set({ [`planloveHash${guessUsername}`]: JSON.stringify(currentLove || {}) });
    };

    // Add buttons to container
    buttonContainer.appendChild(resetButton);
    buttonContainer.appendChild(saveButton);

    // Add container after the label
    labelNode.parentNode.appendChild(buttonContainer);
};

// Toggle visibility of hidden planlove for an author
const toggleHiddenLove = (author, hiddenLoveContainer) => {
    if (hiddenLoveContainer.style.display === 'none') {
        hiddenLoveContainer.style.display = 'block';
    } else {
        hiddenLoveContainer.style.display = 'none';
    }
};

// Main function
const init = async () => {
    // Add control buttons to the page
    addControlButtons();

    // Get the username from the URL
    const url = new URL(window.location.href);
    const guessUsername = url.searchParams.get("mysearch");

    // Get stored username
    const { username: storedUsername } = await browser.storage.local.get("username");
    let username = storedUsername;

    if (!username) {
        // Ask for confirmation of the username
        username = window.prompt(
            "What's your username?\n\nIf you want to stalk other people's newlove as well as your own, enter 'everyone' here.",
            guessUsername
        )?.toLowerCase();

        if (!username) return;
        await browser.storage.local.set({ username });
    }

    // Exit if not on the right page
    if (username !== guessUsername && username !== "everyone") {
        console.log("False alarm, this isn't a quicklove page. Exiting.");
        return;
    }

    // Find all 'sub-lists' in the page
    const loves = document.evaluate(
        '//ul[@id="search_results"]/li//ul/li',
        document,
        null,
        XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
        null
    );

    // Get the stored planlove from last time
    const { [`planloveHash${guessUsername}`]: oldloveStr } = await browser.storage.local.get(`planloveHash${guessUsername}`);
    let oldlove = {};
    try {
        if (oldloveStr) {
            oldlove = JSON.parse(oldloveStr);
        }
    } catch (e) {
        console.warn('Error parsing stored planlove:', e);
    }

    // A running list of all quicklove received
    const newlove = {};
    // Read quicklove, to be hidden
    const toHide = [];

    // Iterate through the list of search results
    let thisLoveNode;
    while (thisLoveNode = loves.iterateNext()) {
        const author = getAuthor(thisLoveNode.parentNode.parentNode);
        const thisLoveText = thisLoveNode.textContent;

        // Check each lovin' against list of author's previous lovin'
        if (arrayContains(oldlove[author], thisLoveText)) {
            // Mark for hiding instead of removal
            toHide.push(thisLoveNode);
        }

        // Initialize array for author if it doesn't exist
        if (!newlove[author]) {
            newlove[author] = [];
        }
        // Add it to the new list of planlove
        newlove[author].push(thisLoveText);
    }

    // Instead of removing old love, hide it and add toggle buttons
    const authorContainers = new Map();
    toHide.forEach(node => {
        const author = getAuthor(node.parentNode.parentNode);
        if (!authorContainers.has(author)) {
            // Create container for hidden entries
            const container = document.createElement('div');
            container.style.display = 'none';
            container.className = 'hidden-love-container';
            
            // Create toggle button
            const toggleButton = document.createElement('span');
            toggleButton.textContent = ' [show old]';
            toggleButton.style.cursor = 'pointer';
            toggleButton.style.color = '#666';
            toggleButton.onclick = () => toggleHiddenLove(author, container);
            
            // Add toggle button at the end of the author header
            const authorHeader = node.parentNode.parentNode;
            // Append the toggle button at the very end
            authorHeader.appendChild(toggleButton);
            
            // Add container after the author's section
            node.parentNode.parentNode.parentNode.appendChild(container);
            
            authorContainers.set(author, container);
        }
        
        // Move node to hidden container
        const container = authorContainers.get(author);
        container.appendChild(node);
    });

    // Store the new list of planlove
    await browser.storage.local.set({ [`planloveHash${guessUsername}`]: JSON.stringify(newlove) });
};

// Wait for the polyfill to be loaded
if (typeof browser === 'undefined') {
    // If browser is not defined, wait for the polyfill to be ready
    window.addEventListener('browser-polyfill-ready', () => {
        init();
    });
} else {
    // If browser is already defined, run immediately
    init();
}
