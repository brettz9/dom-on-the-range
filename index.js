/*global XMLSerializer*/
/*jslint vars:true, node:true, todo:true*/
var exports, cloneRegex, handleNode, document, window;
(function (undef) {'use strict';

if (exports) { // Todo: Implement pseudo-Range for jsdom to get working with Node.js or wait on https://github.com/tmpvar/jsdom/issues/317
    cloneRegex = require('regexp-clone');
    handleNode = require('handle-node');
    document = require('jsdom').jsdom('');
    window = document.parentWindow;
}

function nodeHandlerBoilerplate (obj) {
    return Object.assign(obj, {
        document: function (node) {
            return this.element(node);
        },
        documentFragment: function (node) {
            return this.element(node);
        },
        cdata: function (node) {
            return this.text(node);
        }
    });
}

function getRegex (regex) {
    return typeof regex === 'string' ? new RegExp(regex) : cloneRegex(regex);
}

function getSplitSafeRegex (regex) {
    return typeof regex === 'string' ? new RegExp(regex) : cloneRegex(regex, {global: false});
}

function globalCloneRegex (regex) {
    return cloneRegex(getRegex(regex), {global: true}); // Ensure we can safely get all values
}

function getNode (node) {
    return typeof node === 'string' ? document.createTextNode(node) : node;
}

function escapeRegexReplace (str) {
    return str.replace(/\$/g, '$$$$');
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

function searchPositions (str, regex, returnEnd) {
    var ret = [];
    var offset = 0;
    var found, len, inc, idx;
    while (true) {
        found = str.search(regex);
        if (found === -1) {
            break;
        }
        len = str.match(regex)[0].length;
        idx = offset + found;
        ret.push(returnEnd ? [idx, len + idx] : idx);
        inc = found + len;
        offset += inc;
        str = str.slice(inc);
    }
    return ret;
}

// Todo all of the below (node-bounded and node-unbounded versions)!


/**
* @param {Node} node The node out of which to split
* @param {RegExp|string} regex This regular expression is required to be continguous within a text node
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

        return handleNode(node, nodeHandlerBoilerplate({
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
        }));
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

        return handleNode(node, nodeHandlerBoilerplate({
            element: function (node) {
                return Array.from(node.childNodes).some(findMatches);
            },
            text: function (node) {
                var contents = node.nodeValue;
                var ret = regex.test(contents);
                regex.lastIndex = 0;
                return ret;
            }
        }));
    }
    return findInnerMatches(regex, node);
}

function testUnbounded (regex, node) {
    regex = getRegex(regex);
    return handleNode(node, nodeHandlerBoilerplate({
        element: function (node) {
            return regex.test(node.textContent);
        },
        text: function (node) {
            return regex.test(node.nodeValue);
        }
    }));
}

function test (regex, node, nodeBounded) {
    if (nodeBounded) {
        return testBounded(regex, node);
    }
    return testUnbounded(regex, node);
}

/**
*
* @param {Node} node The node in which to search
* @param {RegExp|string} regex This regular expression is required to be continguous within a text node
* @param {object} [opts] Options object
* @returns {number|array} If regex is global, an array of positions will be found or an empty array if not found. If regex is not global, the index of the first match will be returned (or -1 if none is found)
*/
function searchBounded (regex, node, opts) {
    regex = getRegex(regex);
    // node = node.cloneNode(true); // Use this if altering node
    
    var findInnerMatches = regex.global ?
        function (regex, node) {
            function findMatches (arr, node) {
                var found = findInnerMatches(regex, node);
                arr = arr.concat(found);
                return arr;
            }
            return handleNode(node, nodeHandlerBoilerplate({
                element: function (node) {
                    return Array.from(node.childNodes).reduce(findMatches, []);
                },
                text: function (node) {
                    var contents = node.nodeValue;
                    return searchPositions(contents, regex);
                }
            }));
        } :
        function (regex, node) {
            function findMatch (idx, node) {
                if (idx !== -1) {
                    return idx;
                }
                return findInnerMatches(regex, node);
            }

            return handleNode(node, nodeHandlerBoilerplate({
                element: function (node) {
                    return Array.from(node.childNodes).reduce(findMatch, -1);
                },
                text: function (node) {
                    var contents = node.nodeValue;
                    return contents.search(regex);
                }
            }));
        };
    return findInnerMatches(regex, node);
}

/**
* This differs from its corresponding String.prototype.search in that a global search will return an array of indexes
* @param {Node} node The node in which to search
* @param {RegExp|string} regex This regular expression is required to be continguous within a text node
* @returns {number|array} If regex is global, an array of positions will be found or an empty array if not found. If regex is not global, the index of the first match will be returned (or -1 if none is found)
*/
function searchUnbounded (regex, node, opts) {
    regex = getRegex(regex);
    opts = opts || {};

    return handleNode(node, nodeHandlerBoilerplate({
        element: function (node) {
            if (regex.global) {
                return searchPositions(node.textContent, regex, opts.returnLength);
            }
            return node.textContent.search(regex);
        },
        text: function (node) {
            if (regex.global) {
                return searchPositions(node.nodeValue, regex, opts.returnLength);
            }
            return node.nodeValue.search(regex);
        }
    }));
}

function search (regex, node, nodeBounded) {
    if (nodeBounded) {
        return searchBounded(regex, node);
    }
    return searchUnbounded(regex, node);
}

/**
* @param {Node} node The node in which to search
* @param {RegExp|string} regex This regular expression is required to be continguous within a text node. Note that for non-all global queries, an integer property "lastCumulativeIndex" will be added onto the regular expression to track its index within the supplied node.
* @param {object} [opts] Options object
* @param {boolean} [opts.flatten=true] Whether or not to flatten the return array for any results. Does not completely flatten the array but avoids nesting arrays for nested text nodes.
* @param {boolean} [opts.all=false] Whether or not to return all results in the node at once or not.
* @returns {null|array} If no matches are found, `null` will be returned. If `opts.all` is set to true, then an array of all results in the node are returned (flattened or not, depending on opts.flatten; if not flattened, there will be one array containing arrays for each non-null result text node containing arrays for each exec result; if flattened, there will be one array containing arrays for each exec result). If `opts.all` is not set or set to false, then an array containing the results of the first successful node-internal exec match will be returned (if the search is global, any previous lastCumulativeIndex property will be used to increase the point at which searching begins). Note that `lastCumulativeIndex` and `lastIndex` will also be added as an object property on the return array for convenience.
*/
function execBounded (regex, node, opts) {
    opts = opts || {};
    var flatten = opts.hasOwnProperty('flatten') ? opts.flatten : true;
    var all = opts.hasOwnProperty('all') ? opts.all : false;
    var ret = [];
    if (all) { // Modify supplied RegExp (its lastIndex) if not returning all
        regex = globalCloneRegex(regex);
    }
    regex.lastCumulativeIndex = regex.lastCumulativeIndex || 0;
    var oldLastCumulativeIndex = regex.lastCumulativeIndex;
    var cumulativeIndex = 0;

    var findInnerMatches = all ?
        function findInnerMatches (regex, node) {
            function findMatches (arr, node) {
                var found = findInnerMatches(regex, node);
                if (found) { // Ignore comment nodes, etc.
                    if (flatten) {
                        found.forEach(function (f) {
                            ret.push(f);
                        });
                        return arr;
                    }
                    arr.push(found);
                }
                return arr;
            }

            return handleNode(node, nodeHandlerBoilerplate({
                element: function (node) {
                    return Array.from(node.childNodes).reduce(findMatches, []);
                },
                text: function (node) {
                    var contents = node.nodeValue;
                    var execArr, execArrs = [];
                    
                    while ((execArr = regex.exec(contents)) !== null) {
                        execArr.lastIndex = regex.lastIndex; // Copy if desired for any reason
                        // Todo: Add and copy cumulative index here too?
                        execArrs.push(execArr);
                    }
                    return execArrs.length ? execArrs : null;
                }
            }));
        } :
        function findInnerMatches (regex, node) {
            var result = {found: null};
            function findMatches (node) {
                result.found = findInnerMatches(regex, node);
                return result.found;
            }
            return handleNode(node, result, nodeHandlerBoilerplate({
                element: function (node, result) {
                    Array.from(node.childNodes).some(findMatches);
                    return result.found;
                },
                text: function (node) {
                    var contents = node.nodeValue;
                    var execArr;
                    regex.lastIndex = 0;
                    while ((execArr = regex.exec(contents)) !== null) {
                        cumulativeIndex += regex.lastIndex;
                        if (cumulativeIndex > oldLastCumulativeIndex) {
                            regex.lastCumulativeIndex = cumulativeIndex;
                            execArr.lastIndex = regex.lastIndex; // Copy in case desired for whatever reason
                            execArr.lastCumulativeIndex = regex.lastCumulativeIndex; // Copy this potentially useful property
                            return execArr;
                        }
                    }
                    cumulativeIndex += contents.length - regex.lastIndex; // Add remainder
                    return null;
                }
            }));
        };
    var innerMatches = findInnerMatches(regex, node);
    if (ret.length) {
        return ret;
    }
    if (!all || flatten || !innerMatches) {
        return innerMatches;
    }
    return innerMatches[0]; // Deal with extra array that we created
}

function execUnbounded (regex, node, opts) {
    regex = getRegex(regex); // Todo: drop global as with split?
    
}

function exec (regex, node, opts, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return execBounded(regex, node, opts);
    }
    return execUnbounded(regex, node, opts);
}

// Todo: For match() (and exec() and forEach, etc.), provide option to actually split up the regular expression source between parenthetical groups (non-escaped parentheses) to make subexpression matches available as nodes (though might also just want strings too); also give option to grab parent element with or without other text contents
/**
* If the supplied regular expression is not global, the results will be as with execBounded().
* @param {Node} node The node out of which to split
* @param {RegExp|string} regex This regular expression is required to be continguous within a text node
* @param {object} [opts] Options object
* @param {boolean} [opts.flatten=true] = Whether or not to flatten the per-node array results of a global search together
* @returns {array} An array or array of arrays (depending on the flatten value) containing the matches.
*/
function matchBounded (regex, node, opts) {
    regex = getRegex(regex);
    opts = opts || {};
    var flatten = opts.hasOwnProperty('flatten') ? opts.flatten : true;

    if (!regex.global) {
        return execBounded(regex, node, opts);
    }
    
    function findInnerMatches (regex, node) {
        function findMatches (arr, node) {
            var found = findInnerMatches(regex, node);
            if (found) { // Ignore comment nodes, etc.
                if (flatten) {
                    arr = arr.concat(found);
                }
                else {
                    arr.push(found);
                }
            }
            return arr;
        }

        return handleNode(node, nodeHandlerBoilerplate({
            element: function (node) {
                return Array.from(node.childNodes).reduce(findMatches, []);
            },
            text: function (node) {
                var contents = node.nodeValue;
                return contents.match(regex);
            }
        }));
    }
    var innerMatches = findInnerMatches(regex, node);
    return flatten ? innerMatches : innerMatches[0]; // Deal with extra array that we created
}

function matchUnbounded (regex, node, opts) {
    regex = getRegex(regex);
    opts = opts || {};
    if (!regex.global) {
        return execUnbounded(regex, node, opts);
    }
    switch (opts.searchType) {
        case 'text':
            return handleNode(node, nodeHandlerBoilerplate({
                element: function (node) {
                    return node.textContent.match(regex);
                },
                text: function (node) {
                    return node.nodeValue.match(regex);
                }
            }));
        case 'node': default:
            var indexes = searchUnbounded(regex, node, {returnLength: true});
            if (!indexes.length) {
                return null;
            }
            var found, startNode, startIdx;
            var startFound = false;
            var ct = 0;
            var idx = 0;
            var start = indexes[idx][0];
            var end = indexes[idx][1];
            var ret = [];

            var findInnerMatches = function findInnerMatches (regex, searchNode) {
                function findMatches (aNode) {
                    return findInnerMatches(regex, aNode);
                }

                return handleNode(searchNode, nodeHandlerBoilerplate({
                    element: function (aNode) {
                        return Array.from(aNode.childNodes).some(findMatches);
                    },
                    text: function (textNode) {
                        var contents = textNode.nodeValue;
                        var len = contents.length;
                        var endTextNode = ct + len;
                        var justRan = false;
                        if (!startFound && (endTextNode > start)) {
                            startNode = textNode;
                            startIdx = start - ct;
                            startFound = true;
                            justRan = true;
                        }
                        if (startFound && (endTextNode > end)) {
                            var endIdx = end - ct;
                            found = document.createRange();
                            found.setStart(startNode, startIdx);
                            found.setEnd(textNode, endIdx);
                            ct += endIdx;
                            startFound = false;
                            ++idx;
                            switch (opts.returnType) {
                                case 'html':
                                    var dummy = document.createElement('div');
                                    dummy.appendChild(found.cloneContents());
                                    ret.push(dummy.innerHTML);
                                    break;
                                case 'range':
                                    ret.push(found);
                                    break;
                                case 'fragment': default:
                                    ret.push(found.cloneContents());
                                    break;
                            }
                            var moreIndexes = indexes[idx];
                            if (moreIndexes) {
                                start = indexes[idx][0];
                                end = indexes[idx][1];
                                return this.text(textNode);
                            }
                            return true;
                        }
                        ct += len;
                        return false;
                    }
                }));
            };
            findInnerMatches(regex, node);
            return ret.length ? ret : null;
    }
}

function match (regex, node, opts, nodeBounded) {
    if (nodeBounded) {
        return matchBounded(regex, node, opts);
    }
    return matchUnbounded(regex, node, opts);
}

/**
* @todo Switch to using object arguments?
* @todo Handle text in inputs, textareas, contenteditables?
*/
function replaceBounded (regex, node, opts, replacementNode) {
    var range = document.createRange();
    regex = getRegex(regex);
    opts = opts || {};
    var replaceFormat = opts.replaceFormat; // "text", "html"
    var replacePatterns = opts.replacePatterns; // true, false
    var wrap = opts.wrap; // boolean: whether to see replacementNode string as element name instead of text node content
    if (!opts.replaceNode) {
        node = node.cloneNode(true);
    }
    replacementNode = opts.replacement || replacementNode;
    var method = regex.global ? 'forEach' : 'some';
    function replaceInnerMatches (regex, node) {
        function replaceMatches (node) {
            return replaceInnerMatches(regex, node);
        }

        return handleNode(node, nodeHandlerBoilerplate({
            element: function (node) {
                return Array.from(node.childNodes)[method](replaceMatches);
            },
            text: function (node) {
                var contents = node.nodeValue;
                regex.lastIndex = 0;

                var textMatch, newNode, matchStart, clone, matchEnd, r, found = false;
                var len, wrapper;
                while ((textMatch = regex.exec(contents)) !== null) {
                    found = true;
                    len = textMatch[0].length;
                    matchStart = regex.global ? regex.lastIndex - len : contents.search(regex); // non-global can't use lastIndex
                    matchEnd = matchStart + len;

                    switch (typeof replacementNode) {
                    case 'string':
                        newNode = textMatch[0].replace(cloneRegex(regex), (replacePatterns ? replacementNode : escapeRegexReplace(replacementNode)));
                        switch (replaceFormat) {
                            case 'html':
                                r = document.createRange();
                                r.selectNodeContents(node);
                                newNode = r.createContextualFragment(newNode);
                                break;
                            case 'text': default:
                                newNode = getNode(newNode);
                                break;
                        }
                        break;
                    case 'function':
                        newNode = textMatch[0].replace(regex, replacementNode);
                        break;
                    default:
                        newNode = replacementNode.cloneNode(true); // We need to clone in case multiple replaces are required
                        break;
                    }
                    if (wrap) { // boolean: whether to see replacementNode string as element name instead of text node content (surroundContents)
                        if (wrap.nodeType) {
                            clone = document.createElement('div');
                            clone.innerHTML = wrap.outerHTML || new XMLSerializer().serializeToString(wrap);
                            wrapper = clone.firstChild;
                        }
                        else {
                            wrapper = document.createElement(wrap); // We might instead set "wrap" to the result and let it be used as an object in the next loop
                        }
                        wrapper.appendChild(newNode);
                        newNode = wrapper;
                    }

                    range.setStart(node, matchStart);
                    range.setEnd(node, matchEnd);

                    range.deleteContents();
                    range.insertNode(newNode);
                    if (!regex.global) {
                        break;
                    }
                }
                return found;
            }
        }));
    }
    replaceInnerMatches(regex, node);
    
    return node;
}

/**
*@todo For portion, allow retain, first, and encapsulate (if results all share a single common parent and only one wrapper is desired)
*/
function replaceUnbounded (regex, node, opts, replacementNode) {
    regex = getRegex(regex);
    
    replacementNode = getNode(replacementNode);
    if (regex.global) {
        
    }

}

/**
* @param {RegExp|string} regex A regular expression (as string or RegExp)
* @param {Node|string} node A DOM Node in which to seek text to replace
* @param {Node|string|function} replacementNode A DOM Node, a string, or callback that will be passed the portion and match
* @param {object} [opts] Options object
* @param {boolean} nodeBounded
*/
function replace (regex, node, replacementNode, opts, nodeBounded) {
    if (nodeBounded) {
        return replaceBounded(regex, node, replacementNode, opts);
    }
    return replaceUnbounded(regex, node, replacementNode, opts);
}

function forEachBounded (regex, node, cb, thisObj) {
    regex = getRegex(regex);
    
    var matches, n0, i = 0;
    thisObj = thisObj || null;
    // Todo: Fix this for our exec!
    while ((matches = execBounded(regex, node)) !== null) {
        n0 = matches.splice(0, 1);
        cb.apply(thisObj, matches.concat(i++, n0));
    }
}

function forEachUnbounded (regex, node, cb, thisObj) {
    regex = getRegex(regex);
    
}

function forEach (regex, node, cb, thisObj, nodeBounded) {
    regex = getRegex(regex);
    if (nodeBounded) {
        return forEachBounded(regex, node, cb, thisObj);
    }
    return forEachUnbounded(regex, node, cb, thisObj);
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
// Todo: export a constructor which allows default regex (and/or node?) and allows determination of whether to match text within node or across nodes
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
