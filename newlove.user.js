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
// 2.0 - Updates for Firefox 109
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
// @grant          GM_registerMenuCommand
// @grant          GM_log
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

// Reset the username and history (simulate a fresh install)
const resetValues = async () => {
    if (window.confirm("Reset username and saved planlove?")) {
        await browser.storage.local.remove(["username", `planloveHash${guessUsername}`]);
    }
};

// Do not count new planlove as read
const saveOldlove = async () => {
    await browser.storage.local.set({ [`planloveHash${guessUsername}`]: JSON.stringify(oldlove) });
};

// Main function
(async () => {
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
        oldlove = JSON.parse(oldloveStr) || {};
    } catch (e) {
        console.warn('Error parsing stored planlove:', e);
    }

    // A running list of all quicklove received
    const newlove = {};
    // Read quicklove, to be hidden
    const toRemove = [];

    // Iterate through the list of search results
    let thisLoveNode;
    while (thisLoveNode = loves.iterateNext()) {
        const author = getAuthor(thisLoveNode.parentNode.parentNode);
        const thisLoveText = thisLoveNode.textContent;

        // Check each lovin' against list of author's previous lovin'
        if (arrayContains(oldlove[author], thisLoveText)) {
            // Mark for removal
            toRemove.push(thisLoveNode);
        }

        // Initialize array for author if it doesn't exist
        if (!newlove[author]) {
            newlove[author] = [];
        }
        // Add it to the new list of planlove
        newlove[author].push(thisLoveText);
    }

    // Remove all old love
    toRemove.forEach(node => node.remove());

    // Store the new list of planlove
    await browser.storage.local.set({ [`planloveHash${guessUsername}`]: JSON.stringify(newlove) });

    // Add context menu
    browser.runtime.onInstalled?.addListener(() => {
        browser.contextMenus?.create({
            id: "reset-values",
            title: "Reset username",
            contexts: ["action"]
        });
        browser.contextMenus?.create({
            id: "save-unread",
            title: "Save as unread",
            contexts: ["action"]
        });
    });
})();
