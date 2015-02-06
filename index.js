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
* @param {Node} node The node out of which to split
* @param {RegExp|string} regex Note that this regular expression is currently required to be continguous within a text node
* @returns {function} Returns a function which accepts an XML or HTML node as an argument. This function returns a value as follows. If nothing is found and a text node is supplied, the text node will be returned; if nothing is found with an element supplied, an empty array will be returned; otherwise if nothing is found; undefined will be returned. If an element is supplied and a match is found, an array of nodes on either side of the regex will be returned; if a text node and a match is found, an object will be created whose "pre" property will be set to the portion of text before the regex match (with the matching regex's removed) and whose "post" property will be set to the remainder after the match.
* @todo We could add an argument to allow splitting which adds the split nodes
* @todo Give option to add to fragment instead of array
* @todo Give options to search within comments, etc.?
* @example When the following is split by /test/ :
* <a>here is a test that we wanted and <b>another test</b> that we wanted</a> and one more <i>test</i> too; but not this te<br/>st unless unbounded
*
* it should produce:
*
* <a>here is a </a>,
* <a> that we wanted and <b>another </b></a>,
* <a> that we wanted</a> and one more <i></i>,
* <a> too; but not this te<br/>st</a> unless unbounded
*
* @todo Add option to remove elements rendered empty by stripped content (as in the above example with <i></i>)
*/
function splitBounded (regex, node) {
    var range = document.createRange();
    
    regex = getSplitSafeRegex(regex);

    node = node.cloneNode(true);
    // Todo: Deal with issue of getting split at beginning and end
    function cloneInnerMatches (range, regex, node) {
        function cloneFoundMatches (arr, node) {
            var found = cloneInnerMatches(range, regex, node);
            if (found === undef) { // Ignore other node types like comments
                return arr;
            }
            if (found && typeof found === 'object' && found.hasOwnProperty('pre')) {
                if (found.pre) {
                    arr = arr.concat(found.pre);
                }
                if (!found.post) {
                    return arr;
                }
                return cloneFoundMatches(arr, found.post); // Keep splitting
            }
            return arr.concat(found); // Add remainder text or add descendant element nodes (note that regex match does not span nodes)
        }

        return handleNode(node, {
            element: function (node) {
                return Array.from(node.childNodes).reduce(cloneFoundMatches, []);
            },
            text: function (node) {
                var contents = node.nodeValue;
                var matchStart = contents.search(regex);
                if (matchStart === -1) {
                    return node;
                }

                // Grab desired contents with known positions before discarding the split text
                var matchEnd = matchStart + contents.match(regex)[0].length;

                range.setStart(node, matchStart);
                range.setEnd(node, matchEnd);
                var extra = range.extractContents(); // Discard matched regex split contents (e.g., a comma separator)

                range.setStart(node, 0);
                range.setEnd(node, matchStart);

                var pre = range.extractContents();
                return {pre: pre.childNodes[0], post: node.childNodes[0]};
            }
        });
    }
    return cloneInnerMatches(range, regex, node);
}

function splitUnbounded (regex, node) {
    var range = document.createRange();
    
    regex = getSplitSafeRegex(regex);
    
    // Todo
}

function split (regex, node, nodeBounded) {
    if (nodeBounded) {
        return splitBounded(regex, node);
    }
    return splitUnbounded(regex, node);
}

// todo: For handleNode, add support for comment, etc., as needed on all methods

function testBounded (regex, node) {
    regex = getRegex(regex);
    node = node.cloneNode(true);
    
    function findInnerMatches (regex, node) {
        function findMatches (node) {
            return findInnerMatches(regex, node);
        }

        return handleNode(node, {
            element: function (node) {
                return Array.from(node.childNodes).some(findMatches);
            },
            text: function (node) {
                var contents = node.nodeValue;
                return regex.test(contents);
            }
        });
    }
    return findInnerMatches(regex, node);
}

function testUnbounded (regex, node) {
    regex = getRegex(regex);
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
    if (nodeBounded) {
        return testBounded(regex, node);
    }
    return testUnbounded(regex, node);
}

// Todo: For match() (and exec() and forEach, etc.), provide option to actually split up the regular expression source between parenthetical groups (non-escaped parentheses) to make subexpression matches available as nodes (though might also just want strings too); also give option to grab parent element with or without other text contents
function matchBounded (regex, node) {
    regex = getRegex(regex);
    
}

function matchUnbounded (regex, node) {
    regex = getRegex(regex);
    
}

function match (regex, node, nodeBounded) {
    if (nodeBounded) {
        return matchBounded(regex, node);
    }
    return matchUnbounded(regex, node);
}

function replaceBounded (regex, node, replacementNode) {
    regex = getRegex(regex);
    replacementNode = typeof replacementNode === 'string' ? document.createTextNode(replacementNode) : replacementNode;
    
}

function replaceUnbounded (regex, node, replacementNode) {
    regex = getRegex(regex);
    replacementNode = typeof replacementNode === 'string' ? document.createTextNode(replacementNode) : replacementNode;
    
}

/**
* @param {RegExp|string} regex A regular expression (as string or RegExp)
* @param {Node|string} node A DOM Node in which to seek text to replace
* @param {Node|string} replacementNode A DOM Node or a string
*/
function replace (regex, node, replacementNode) {
    if (regex.global) {
        
    }
    if (nodeBounded) {
        return replaceBounded(regex, node, replacementNode);
    }
    return replaceUnbounded(regex, node, replacementNode);
}

function searchBounded (regex, node) {
    regex = getRegex(regex);
    
}

function searchUnbounded (regex, node) {
    regex = getRegex(regex);
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
    if (nodeBounded) {
        return searchBounded(regex, node);
    }
    return searchUnbounded(regex, node);
}

function execBounded (regex, node) {
    regex = getRegex(regex); // Todo: drop global as with split?
    
}

function execUnbounded (regex, node) {
    regex = getRegex(regex); // Todo: drop global as with split?
    
}

function exec (regex, node, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return searchBounded(regex, node);
    }
    return searchUnbounded(regex, node);
}

function forEachBounded (regex, node, cb) {
    regex = getRegex(regex);
    
}

function forEachUnbounded (regex, node, cb) {
    regex = getRegex(regex);
    
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
