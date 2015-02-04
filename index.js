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


// Todo all of the below (node-bounded and node-unbounded versions)!


function splitUnbounded (node, splitRegex) {
    var range = document.createRange();
    
    splitRegex = getSplitSafeRegex(splitRegex);
    
    
}

/**
* @param {Node} node The node out of which to extract
* @param {RegExp|string} splitRegex Note that this regular expression is currently required to be continguous within a text node
* @returns {function} Returns a function which accepts an XML or HTML node as an argument. This function returns a value as follows. If nothing is found and a text node is supplied, the text node will be returned; if nothing is found with an element supplied, an empty array will be returned; otherwise if nothing is found; undefined will be returned. If an element is supplied and a match is found, an array of nodes on either side of the splitRegex will be returned; if a text node and a match is found, an object will be created whose "pre" property will be set to the portion of text before the splitRegex match (with the matching splitRegex's removed) and whose "post" property will be set to the remainder after the match.
*/
function splitBounded (node, splitRegex) {
    var range = document.createRange();
    
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

function split (node, regex, nodeBounded) {
    if (nodeBounded) {
        return splitBounded(node, regex);
    }
    return splitUnbounded(node, regex);
}

// todo: For handleNode, add support for comment, etc., as needed

function testBounded (node, regex) {
    
}

function testUnbounded (node, regex) {
    return handleNode(node, {
        element: function (node) {
            return regex.test(node.textContent);
        },
        text: function (node) {
            return regex.test(node.nodeValue);
        }
    });
}

function test (node, regex, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return testBounded(node, regex);
    }
    return testUnbounded(node, regex);
}

function matchBounded (node, regex) {
    
}

function matchUnbounded (node, regex) {
    
}

function match (node, regex, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return matchBounded(node, regex);
    }
    return matchUnbounded(node, regex);
}

function replaceBounded (node, regex) {
    
}

function replaceUnbounded (node, regex) {
    
}

function replace (node, regex) {
    regex = getRegex(regex);
    if (regex.global) {
        
    }
    if (nodeBounded) {
        return replaceBounded(node, regex);
    }
    return replaceUnbounded(node, regex);
}

function searchBounded (node, regex) {
    
}

function searchUnbounded (node, regex) {
    
}

function search (node, regex, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return searchBounded(node, regex);
    }
    return searchUnbounded(node, regex);
}

function execBounded (node, regex) {
    
}

function execUnbounded (node, regex) {
    
}

function exec (node, regex, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return searchBounded(node, regex);
    }
    return searchUnbounded(node, regex);
}

function forEachBounded (node, regex, cb) {
    
}

function forEachUnbounded (node, regex, cb) {
    
}

function forEach (node, regex, cb, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return forEachBounded(node, regex, cb);
    }
    return forEachUnbounded(node, regex, cb);
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

// Todo: export a constructor which allows default regex (and node?) and allows determination of whether to match text within node or across nodes

exp.splitUnbounded = splitUnbounded;
exp.splitBounded = splitBounded;
exp.split = split;

exp.test = test;
exp.testBounded = testBounded;
exp.testUnbounded = testUnbounded;

exp.match = match;
exp.matchBounded = matchBounded;
exp.matchUnbounded = matchUnbounded;

exp.replace = replace;
exp.replaceBounded = replaceBounded;
exp.replaceUnbounded = replaceUnbounded;

exp.search = search;
exp.searchBounded = searchBounded;
exp.searchUnbounded = searchUnbounded;

exp.exec = exec;
exp.execBounded = execBounded;
exp.execUnbounded = execUnbounded;

exp.forEach = forEach;
exp.forEachBounded = forEachBounded;
exp.forEachUnbounded = forEachUnbounded;


}());
