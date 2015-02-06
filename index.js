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

function textStringify (items) {
    if (Array.isArray(items)) {
        return items.map(function (node) {
            return textStringify(node);
        });
    }
    if (items && typeof items === 'object') {
        switch (items.nodeType) {
            case 1:
                return items.textContent;
            case 3:
                return items.nodeValue;
            case 11:
                var div = document.createElement('div');
                div.appendChild(items.cloneNode(true));
                return div.textContent;
            default:
                throw 'Unexpected node type';
        }
    }
}

function htmlStringify (items) {
    if (Array.isArray(items)) {
        return items.map(function (node) {
            return htmlStringify(node);
        });
    }
    if (items && typeof items === 'object') {
        switch (items.nodeType) {
            case 1:
                return items.outerHTML;
            case 3:
                return items.nodeValue;
            case 11:
                var div = document.createElement('div');
                div.appendChild(items.cloneNode(true));
                return div.innerHTML;
            default:
                throw 'Unexpected node type';
        }
    }
}

function searchPositions (str, regex) {
    var ret = [];
    var offset = 0;
    var found, len, inc;
    while (true) {
        found = str.search(regex);
        if (found === -1) {
            break;
        }
        len = str.match(regex)[0].length;
        ret.push(offset + found);
        inc = found + len;
        offset += inc;
        str = str.slice(inc);
    }
    return ret;
}

// Todo all of the below (node-bounded and node-unbounded versions)!


/**
* @param {Node} node The node out of which to split
* @param {RegExp|string} regex Note that this regular expression is currently required to be continguous within a text node
* @param {object} [opts] Options object
* @param {"html"|"text"|"dom"} [opts.returnType=dom] Set to "html" to convert text nodes or fragments into HTML strings, "text" for strings, and "dom" for the default
* @returns {Text|Array}
* @todo: Fix this description for returns to be accurate! If nothing is found and a text node is supplied, the text node will be returned; if nothing is found with an element supplied, an empty array will be returned; otherwise if nothing is found; undefined will be returned. If an element is supplied and a match is found, an array of nodes on either side of the regex will be returned; if a text node and a match is found, an object will be created whose "pre" property will be set to the portion of text before the regex match (with the matching regex's removed) and whose "post" property will be set to the remainder after the match.
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
function splitBounded (regex, node, opts) {
    var range = document.createRange();
    
    regex = getSplitSafeRegex(regex);

    node = node.cloneNode(true);
    var startNode = node;
    // Todo: Deal with issue of getting split at beginning and end
    function cloneInnerMatches (range, regex, node) {
        function cloneFoundMatches (arr, node) {
            var found = cloneInnerMatches(range, regex, node);
            if (!found) { // Ignore other node types like comments and ignore false text matches (those nodes will be included later)
                return arr;
            }
            if (!found.text) {
                return arr.concat(found); // Add descendant element node matches (note that regex match does not span nodes)
            }
            if (found[0]) {
                arr = arr.concat(found[0]);
            }
            return found[1] ? cloneFoundMatches(arr, found[1]) : arr; // Keep splitting if post present
        }

        return handleNode(node, {
            element: function (node) {
                return Array.from(node.childNodes).reduce(cloneFoundMatches, []);
            },
            text: function (node) {
                var contents = node.nodeValue;
                var matchStart = contents.search(regex);
                if (matchStart === -1) {
                    return false;
                }

                // Grab desired contents with known positions before discarding the split text
                var matchEnd = matchStart + contents.match(regex)[0].length;

                range.setStart(node, matchStart);
                range.setEnd(node, matchEnd);
                range.deleteContents(); // Discard matched regex split contents (e.g., a comma separator)

                range.setStart(startNode, 0);
                range.setEnd(node, matchStart);

                var pre = range.extractContents();
                var r = [pre, node];
                r.text = true;
                return r;
            }
        });
    }
    var ret = cloneInnerMatches(range, regex, node);
    if (opts && opts.returnType) {
        switch (opts.returnType) {
            case 'html':
                return htmlStringify(ret);
            case 'text':
                return textStringify(ret);
            case 'dom':
                return ret;
        }
    }
    return ret;
}

function splitUnbounded (regex, node, opts) {
    var range = document.createRange();
    
    regex = getSplitSafeRegex(regex);
    
    // Todo
}

function split (regex, node, opts, nodeBounded) {
    if (nodeBounded) {
        return splitBounded(regex, node, opts);
    }
    return splitUnbounded(regex, node, opts);
}

// todo: For handleNode, add support for comment, etc., as needed on all methods

function testBounded (regex, node) {
    regex = getRegex(regex);
    // node = node.cloneNode(true); // Use this if altering node
    
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


function searchBounded (regex, node) {
    regex = getRegex(regex);
    // node = node.cloneNode(true); // Use this if altering node
    
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
                return contents.search(regex);
            }
        });
    }
    return findInnerMatches(regex, node);
}

/**
* This differs from its corresponding String.prototype.search in that a global search will return an array of indexes
*/
function searchUnbounded (regex, node) {
    regex = getRegex(regex);
    return handleNode(node, {
        element: function (node) {
            if (regex.global) {
                return searchPositions(node.textContent, regex);
            }
            return node.textContent.search(regex);
        },
        text: function (node) {
            if (regex.global) {
                return searchPositions(node.nodeValue, regex);
            }
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

// Todo: For match() (and exec() and forEach, etc.), provide option to actually split up the regular expression source between parenthetical groups (non-escaped parentheses) to make subexpression matches available as nodes (though might also just want strings too); also give option to grab parent element with or without other text contents
/**
* If the supplied regular expression is not global, the results will be as with execBounded().
* @param {Node} node The node out of which to split
* @param {RegExp|string} regex Note that this regular expression is currently required to be continguous within a text node
* @param {object} [opts] Options object
* @param {boolean} [opts.flatten=true] = Whether or not to flatten the per-node array results of a global search together
* @returns {array} An array or array of arrays (depending on the flatten value) containing the matches.
*/
function matchBounded (regex, node, opts) {
    regex = getRegex(regex);
    opts = opts || {};
    if (!opts.hasOwnProperty('flatten')) {
        opts.flatten = true;
    }
    var flatten = opts.flatten;

    if (!regex.global) {
        return execBounded(regex, node, opts);
    }
    
    function findInnerMatches (regex, node) {
        function findMatches (arr, node) {
            var found = findInnerMatches(regex, node);
            if (found) { // Ignore comment nodes
                if (flatten) {
                    arr = arr.concat(found);
                }
                else {
                    arr.push(found);
                }
            }
            return arr;
        }

        return handleNode(node, {
            element: function (node) {
                return Array.from(node.childNodes).reduce(findMatches, []);
            },
            text: function (node) {
                var contents = node.nodeValue;
                return contents.match(regex);
            }
        });
    }
    var innerMatches = findInnerMatches(regex, node);
    return flatten ? innerMatches : innerMatches[0]; // Deal with extra array that we created
}

function matchUnbounded (regex, node, opts) {
    regex = getRegex(regex);
    
}

function match (regex, node, opts, nodeBounded) {
    if (nodeBounded) {
        return matchBounded(regex, node, opts);
    }
    return matchUnbounded(regex, node, opts);
}

function replaceBounded (regex, node, opts, replacementNode) {
    regex = getRegex(regex);
    replacementNode = typeof replacementNode === 'string' ? document.createTextNode(replacementNode) : replacementNode;
    if (regex.global) {
        
    }
    
}

function replaceUnbounded (regex, node, opts, replacementNode) {
    regex = getRegex(regex);
    replacementNode = typeof replacementNode === 'string' ? document.createTextNode(replacementNode) : replacementNode;
    if (regex.global) {
        
    }
    
}

/**
* @param {RegExp|string} regex A regular expression (as string or RegExp)
* @param {Node|string} node A DOM Node in which to seek text to replace
* @param {Node|string} replacementNode A DOM Node or a string
* @param {object} [opts] Options object
* @param {boolean} nodeBounded
*/
function replace (regex, node, replacementNode, opts, nodeBounded) {
    if (nodeBounded) {
        return replaceBounded(regex, node, replacementNode, opts);
    }
    return replaceUnbounded(regex, node, replacementNode, opts);
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

// UTILITY EXPORTS
exp.textStringify = textStringify;
exp.htmlStringify = htmlStringify;
exp.searchPositions = searchPositions;

// MAIN API EXPORTS
// Todo: export a constructor which allows default regex (and node?) and allows determination of whether to match text within node or across nodes
exp.splitUnbounded = splitUnbounded;
exp.splitBounded = splitBounded;
exp.split = split;

exp.testBounded = testBounded;
exp.testUnbounded = testUnbounded;
exp.test = test;

exp.searchBounded = searchBounded;
exp.searchUnbounded = searchUnbounded;
exp.search = search;

exp.execBounded = execBounded;
exp.execUnbounded = execUnbounded;
exp.exec = exec;

exp.matchBounded = matchBounded;
exp.matchUnbounded = matchUnbounded;
exp.match = match;

exp.replaceBounded = replaceBounded;
exp.replaceUnbounded = replaceUnbounded;
exp.replace = replace;

exp.forEachBounded = forEachBounded;
exp.forEachUnbounded = forEachUnbounded;
exp.forEach = forEach;


}());
