/*jslint vars:true, node:true*/
var exports, cloneRegex, handleNode, document, window;
(function (undef) {'use strict';

if (exports) { // Todo: Implement pseudo-Range for jsdom to get working with Node.js or wait on https://github.com/tmpvar/jsdom/issues/317
    cloneRegex = require('regexp-clone');
    handleNode = require('handle-node');
    document = require('jsdom').jsdom('');
    window = document.parentWindow;
}

function getRegex (regex) {
    return typeof regex === 'string' ? new RegExp(regex) : cloneRegex(regex);
}

function getSplitSafeRegex (regex) {
    return typeof regex === 'string' ? new RegExp(regex) : cloneRegex(regex, {global: false});
}


// Todo all of the below (node-bounded and node-unbounded versions)!


/**
* @param {Node} node The node out of which to extract
* @param {RegExp|string} splitRegex Note that this regular expression is currently required to be continguous within a text node
* @returns {function} Returns a function which accepts an XML or HTML node as an argument. This function returns a value as follows. If nothing is found and a text node is supplied, the text node will be returned; if nothing is found with an element supplied, an empty array will be returned; otherwise if nothing is found; undefined will be returned. If an element is supplied and a match is found, an array of nodes on either side of the splitRegex will be returned; if a text node and a match is found, an object will be created whose "pre" property will be set to the portion of text before the splitRegex match (with the matching splitRegex's removed) and whose "post" property will be set to the remainder after the match.
* @todo We could add an argument to allow splitting which adds the split nodes
*/
function splitBounded (splitRegex, node) {
    var range = document.createRange();
    
    splitRegex = getSplitSafeRegex(splitRegex);
    
    function extractInnerMatches (range, splitRegex, node) {
        function extractFoundMatches (arr, node) {
            var found = extractInnerMatches(range, splitRegex, node);
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
    return extractInnerMatches(range, splitRegex, node);
}

function splitUnbounded (splitRegex, node) {
    var range = document.createRange();
    
    splitRegex = getSplitSafeRegex(splitRegex);
    
    
}

function split (regex, node, nodeBounded) {
    if (nodeBounded) {
        return splitBounded(regex, node);
    }
    return splitUnbounded(regex, node);
}

// todo: For handleNode, add support for comment, etc., as needed

function testBounded (regex, node) {
    
}

function testUnbounded (regex, node) {
    return handleNode(node, {
        element: function (node) {
            return regex.test(node.textContent);
        },
        text: function (node) {
            return regex.test(node.nodeValue);
        }
    });
}

function test (regex, node, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return testBounded(regex, node);
    }
    return testUnbounded(regex, node);
}

function matchBounded (regex, node) {
    
}

function matchUnbounded (regex, node) {
    
}

function match (regex, node, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return matchBounded(regex, node);
    }
    return matchUnbounded(regex, node);
}

function replaceBounded (regex, node, replacementNode) {
    
}

function replaceUnbounded (regex, node, replacementNode) {
    
}

function replace (regex, node, replacementNode) {
    regex = getRegex(regex);
    if (regex.global) {
        
    }
    if (nodeBounded) {
        return replaceBounded(regex, node, replacementNode);
    }
    return replaceUnbounded(regex, node, replacementNode);
}

function searchBounded (regex, node) {
    
}

function searchUnbounded (regex, node) {
    return handleNode(node, {
        element: function (node) {
            return node.textContent.search(regex);
        },
        text: function (node) {
            return node.nodeValue.search(regex);
        }
    });
}

function search (regex, node, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return searchBounded(regex, node);
    }
    return searchUnbounded(regex, node);
}

function execBounded (regex, node) {
    
}

function execUnbounded (regex, node) {
    
}

function exec (regex, node, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return searchBounded(regex, node);
    }
    return searchUnbounded(regex, node);
}

function forEachBounded (regex, node, cb) {
    
}

function forEachUnbounded (regex, node, cb) {
    
}

function forEach (regex, node, cb, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return forEachBounded(regex, node, cb);
    }
    return forEachUnbounded(regex, node, cb);
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

exp.testBounded = testBounded;
exp.testUnbounded = testUnbounded;
exp.test = test;

exp.matchBounded = matchBounded;
exp.matchUnbounded = matchUnbounded;
exp.match = match;

exp.replaceBounded = replaceBounded;
exp.replaceUnbounded = replaceUnbounded;
exp.replace = replace;

exp.searchBounded = searchBounded;
exp.searchUnbounded = searchUnbounded;
exp.search = search;

exp.execBounded = execBounded;
exp.execUnbounded = execUnbounded;
exp.exec = exec;

exp.forEachBounded = forEachBounded;
exp.forEachUnbounded = forEachUnbounded;
exp.forEach = forEach;


}());
