/*jslint vars:true, node:true*/
var exports, cloneRegex, handleNode, document, window;
(function (undef) {'use strict';

if (exports) { // Todo: Implement pseudo-Range for jsdom to get working with Node.js or wait on https://github.com/tmpvar/jsdom/issues/317
    cloneRegex = require('regexp-clone');
    handleNode = require('handle-node');
    document = require('jsdom').jsdom('');
    window = document.parentWindow;
}

function getRegex () {
    return typeof regex === 'string' ? new RegExp(regex) : cloneRegex(regex);
}

function getSplitSafeRegex (regex) {
    return typeof regex === 'string' ? new RegExp(regex) : cloneRegex(regex, {global: false});
}

function splitNodeExternal (node, splitRegex, range) {
    range = range || document.createRange();
    
    splitRegex = getSplitSafeRegex(splitRegex);
    
    // Todo
    
}

// Todo: export a constructor which allows default regex (and node?) and allows determination of whether to match text within node or across nodes

/**
* @param {Node} node The node out of which to extract
* @param {RegExp|string} splitRegex Note that this regular expression is currently required to be continguous within a text node
* @param {DOMRange} [range] A DOM Range (defaults to a new `document.createRange()`).
* @returns {function} Returns a function which accepts an XML or HTML node as an argument. This function returns a value as follows. If nothing is found and a text node is supplied, the text node will be returned; if nothing is found with an element supplied, an empty array will be returned; otherwise if nothing is found; undefined will be returned. If an element is supplied and a match is found, an array of nodes on either side of the splitRegex will be returned; if a text node and a match is found, an object will be created whose "pre" property will be set to the portion of text before the splitRegex match (with the matching splitRegex's removed) and whose "post" property will be set to the remainder after the match.
*/
function splitNodeInternal (node, splitRegex, range) {
    range = range || document.createRange();
    
    splitRegex = getSplitSafeRegex(splitRegex);
    
    function extractInnerMatches (range, node, splitRegex) {
        function extractFoundMatches (arr, node) {
            var found = extractInnerMatches(range, node, splitRegex);
            if (found && found.pre) {
                arr = arr.concat(found.pre);
                return extractFoundMatches(arr, found.post); // Keep splitting
            }
            return arr.concat(found); // Add remainder text or add descendant element nodes (note that regex match does not span nodes)
        }

        return handleNode(node, {
            element: function (node) {
                return Array.from(node.childNodes).reduce(extractFoundMatches, []);
            },
            text: function (node) {
                var contents = node.nodeValue;
                var matchStart = contents.search(splitRegex);
                if (matchStart === -1) {
                    return node;
                }

                // Grab desired contents with known positions before discarding the split text
                var matchEnd = matchStart + contents.match(splitRegex)[0].length;
                
                range.setStart(node, matchStart);
                range.setEnd(node, matchEnd);
                var extra = range.extractContents(); // Discard matched regex split contents (e.g., a comma separator)

                range.setStart(node, 0);
                range.setEnd(node, matchStart);
                var extracted = range.extractContents();
                return {pre: extracted.childNodes[0], post: node};
            }
        });
    }
    return extractInnerMatches(range, node, splitRegex);
}

function split (node, splitRegex, range, nodeInternal) {
    if (nodeInternal) {
        return splitNodeInternal(node, splitRegex, range);
    }
    return splitNodeExternal(node, splitRegex, range);
}

// todo: implement node-internal and node-independent versions of each of the following

function test () {
    
}

function match () {
    
}

function replace (node, regex, range) {
    regex = getRegex(regex);
    if (splitRegex.global) {
        
    }
}

function search () {
    
}

function exec () {
    
}

function forEach () {
    
}

// Todo: other array extras

// EXPORTS

var exp;
if (exports === undef) {
    window.DOTR = {};
    exp = window.DOTR;
}
else {
    exp = exports;
}

exp.splitNodeExternal = splitNodeExternal;
exp.splitNodeInternal = splitNodeInternal;
exp.split = split;
exp.test = test;
exp.match = match;
exp.replace = replace;
exp.search = search;
exp.exec = exec;
exp.forEach = forEach;


}());
