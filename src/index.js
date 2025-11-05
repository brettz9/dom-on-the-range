import cloneRegex from 'clone-regexp';
import handleNode from 'handle-node';

let _win;
export const setWindow = (win) => {
  _win = win;
};

function nodeHandlerBoilerplate (obj) {
  return {
    ...obj,
    document (node) {
      return this.element(node);
    },
    documentFragment (node) {
      return this.element(node);
    },
    cdata (node) {
      return this.text(node);
    }
  };
}

function getRegex (regex) {
  return typeof regex === 'string' ? new RegExp(regex, 'v') : cloneRegex(regex);
}

function getSplitSafeRegex (regex) {
  return typeof regex === 'string'
    ? new RegExp(regex, 'v')
    : cloneRegex(regex, {global: false});
}

function globalCloneRegex (regex) {
  // Ensure we can safely get all values
  return cloneRegex(getRegex(regex), {global: true});
}

function getNode (node) {
  return typeof node === 'string' ? _win.document.createTextNode(node) : node;
}

function escapeRegexReplace (str) {
  return str.replaceAll('$', '$$$$');
}

function getFragmentHTML (frag) {
  const clone = _win.document.createElement('div');
  clone.append(frag.cloneNode(true));
  return clone.innerHTML;
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
    case 11: {
      const div = _win.document.createElement('div');
      div.append(items.cloneNode(true));
      return div.textContent;
    } default:
      throw new TypeError('Unexpected node type');
    }
  }

  // Todo: Throw here instead?
  return undefined;
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
      return getFragmentHTML(items);
    default:
      throw new TypeError('Unexpected node type');
    }
  }
  // Todo: Throw here instead?
  return undefined;
}

function searchPositions (str, regex, returnEnd) {
  const ret = [];
  let offset = 0;
  let found, len, inc, idx;
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

function replaceNode (regex, text, node, replacementNode, range, opts) {
  let r, newNode, newNodeStr = null, clone, wrapper;
  const {
    // boolean/Element: whether to see replacementNode string as element
    //   name instead of text node content
    wrap,
    // "text", "html"
    replaceFormat,
    // true, false
    replacePatterns
  } = opts;

  const customReplaceMode = opts.replaceMode === 'custom';

  switch (typeof replacementNode) {
  case 'string':
    newNodeStr = text.replace(
      cloneRegex(regex),
      (replacePatterns ? replacementNode : escapeRegexReplace(replacementNode))
    );
    break;
  case 'function':
    newNodeStr = customReplaceMode
      ? replacementNode(
        text.match(regex), {index: 0, startIndex: 0, endIndex: 0}, node
      )
      : text.replace(regex, replacementNode);
    break;
  default:
    // We need to clone in case multiple replaces are required
    newNode = replacementNode.cloneNode(true);
    break;
  }
  if (newNodeStr !== null) {
    switch (replaceFormat) {
    case 'html':
      r = _win.document.createRange();
      r.selectNodeContents(node);
      newNode = r.createContextualFragment(newNodeStr);
      break;
    case 'text': default:
      newNode = getNode(newNodeStr);
      break;
    }
  }
  // boolean: whether to see replacementNode string as element name instead
  //   of text node content (surroundContents)
  if (wrap) {
    if (wrap.nodeType) {
      clone = _win.document.createElement('div');
      clone.innerHTML = wrap.outerHTML ||
        new _win.XMLSerializer().serializeToString(wrap);
      wrapper = clone.firstChild;
    } else {
      // We might instead set "wrap" to the result and let it be
      //   used as an object in the next loop
      wrapper = _win.document.createElement(wrap);
    }
    wrapper.append(newNode);
    newNode = wrapper;
  }

  if (range) {
    range.deleteContents();
    range.insertNode(newNode);
  }
  return newNode;
}

function returnBySetType (ret, opts) {
  switch (opts.setType) {
  case 'node':
    return ret && ret.reduce(function (tn, mtch) {
      tn.data += mtch;
      return tn;
    }, _win.document.createTextNode());
  case 'string':
    return ret && ret.reduce(function (str, mtch) {
      str += mtch;
      return str;
    }, '');
  case 'array': default:
    return ret;
  }
}

/**
 * @param {RegExp|string} regex This regular expression is required to be
 * continguous within a text node
 * @param {Node} node The node out of which to split
 * @param {object} [opts] Options object
 * @param {"html"|"text"|"dom"} [opts.returnType] Set to "html" to convert
 *   text nodes or fragments into HTML strings, "text" for strings, and "dom"
 *   for the default
 * @returns {Text|Array}
 * @todo Fix this description for returns to be accurate! If nothing is found
 *     and a text node is supplied, the text node will be returned; if
 *     nothing is found with an element supplied, an empty array will be
 *     returned; otherwise if nothing is found; undefined will be returned.
 *     If an element is supplied and a match is found, an array of nodes on
 *     either side of the regex will be returned; if a text node and a match
 *     is found, an object will be created whose "pre" property will be set
 *     to the portion of text before the regex match (with the matching regex's
 *     removed) and whose "post" property will be set to the remainder after
 *     the match.
 * @todo We could add an argument to allow splitting which adds the split nodes
 * @todo Give option to add to fragment instead of array
 * @todo Give options to search within comments, etc.?
 * @example When the following is split by /test/ :
 * <a>here is a test that we wanted and <b>another test</b> that
 *   we wanted</a> and one more <i>test</i> too; but not this
 *     te<br/>st unless unbounded
 * it should produce:
 * <a>here is a </a>,
 * <a> that we wanted and <b>another </b></a>,
 * <a> that we wanted</a> and one more <i></i>,
 * <a> too; but not this te<br/>st</a> unless unbounded
 * @todo Add option to remove elements rendered empty by stripped content
 *   (as in the above example with <i></i>)
 */
function splitBounded (regex, node, opts) {
  const range = _win.document.createRange();
  opts = opts || {};
  const {filterElements} = opts;
  regex = getSplitSafeRegex(regex);

  node = node.cloneNode(true);
  const startNode = node;
  // Todo: Deal with issue of getting split at beginning and end
  function cloneInnerMatches (rnge, regexp, aNode) {
    function cloneFoundMatches (arr, nde) {
      const found = cloneInnerMatches(rnge, regexp, nde);
      // Ignore other node types like comments and ignore false text matches
      //   (those nodes will be included later)
      if (!found) {
        return arr;
      }
      if (!found.text) {
        // Add descendant element node matches (note that regex match does
        //   not span nodes)
        return arr.concat(found);
      }
      if (found[0]) {
        arr = arr.concat(found[0]);
      }
      return found[1]
        ? cloneFoundMatches(arr, found[1])
        : arr; // Keep splitting if post present
    }

    return handleNode(aNode, nodeHandlerBoilerplate({
      element (nde) {
        if (filterElements && filterElements(nde) === false) {
          return false;
        }
        return [...nde.childNodes].reduce((arr, nd) => {
          return cloneFoundMatches(arr, nd);
        }, []);
      },
      text (nde) {
        const contents = nde.nodeValue;
        const matchStart = contents.search(regexp);
        if (matchStart === -1) {
          return false;
        }

        // Grab desired contents with known positions before discarding
        //   the split text
        const matchEnd = matchStart + contents.match(regexp)[0].length;

        rnge.setStart(nde, matchStart);
        rnge.setEnd(nde, matchEnd);
        // Discard matched regex split contents (e.g., a comma separator)
        rnge.deleteContents();

        rnge.setStart(startNode, 0);
        rnge.setEnd(nde, matchStart);

        const pre = rnge.extractContents();
        const r = [(opts.returnType === 'range' ? rnge : pre), nde];
        r.text = true;
        return r;
      }
    }));
  }
  let ret = cloneInnerMatches(range, regex, node);
  if (opts.returnType) {
    switch (opts.returnType) {
    case 'html':
      ret = htmlStringify(ret);
      break;
    case 'text':
      ret = textStringify(ret);
      break;
      // case 'fragment': case 'range': default: break;
    default:
      break;
    }
  }
  return returnBySetType(ret, opts);
}

function splitUnbounded (regex /* , node, opts */) {
  const range = _win.document.createRange();

  regex = getSplitSafeRegex(regex);

  // Todo: Use `range`/`regex`
  // eslint-disable-next-line no-console -- Debugging
  console.log('range', range, regex);
}

function split (regex, node, opts, nodeBounded) {
  if (nodeBounded) {
    return splitBounded(regex, node, opts);
  }
  return splitUnbounded(regex /* , node, opts */);
}

// todo: For handleNode, add support for comment, etc., as needed on all methods

function testBounded (regex, node) {
  regex = getRegex(regex);
  // node = node.cloneNode(true); // Use this if altering node

  function findInnerMatches (regexp, aNode) {
    function findMatches (nde) {
      return findInnerMatches(regexp, nde);
    }

    return handleNode(aNode, nodeHandlerBoilerplate({
      element (nde) {
        return [...nde.childNodes].some((nd) => {
          return findMatches(nd);
        });
      },
      text (nde) {
        const contents = nde.nodeValue;
        const ret = regexp.test(contents);
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
    element (nde) {
      return regex.test(nde.textContent);
    },
    text (nde) {
      return regex.test(nde.nodeValue);
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
 * @param {RegExp|string} regex This regular expression is required to be
 * continguous within a text node
 * @param {Node} node The node in which to search
 * @returns {number|Array} If regex is global, an array of positions will be
 *   found or an empty array if not found. If regex is not global, the index
 *   of the first match will be returned (or -1 if none is found)
 */
function searchBounded (regex, node /* , opts */) {
  //  * @param {object} [opts] Options object
  regex = getRegex(regex);
  // node = node.cloneNode(true); // Use this if altering node

  const findInnerMatches = regex.global
    ? function (regexp, aNode) {
      function findMatches (arr, nde) {
        const found = findInnerMatches(regexp, nde);
        arr = arr.concat(found);
        return arr;
      }
      return handleNode(aNode, nodeHandlerBoilerplate({
        element (nde) {
          return [...nde.childNodes].reduce((arr, nd) => {
            return findMatches(arr, nd);
          }, []);
        },
        text (nde) {
          const contents = nde.nodeValue;
          return searchPositions(contents, regexp);
        }
      }));
    }
    : function (regexp, aNode) {
      function findMatch (idx, nde) {
        if (idx !== -1) {
          return idx;
        }
        return findInnerMatches(regexp, nde);
      }

      return handleNode(aNode, nodeHandlerBoilerplate({
        element (nde) {
          return [...nde.childNodes].reduce((idx, nd) => {
            return findMatch(idx, nd);
          }, -1);
        },
        text (nde) {
          const contents = nde.nodeValue;
          return contents.search(regexp);
        }
      }));
    };
  return findInnerMatches(regex, node);
}

/**
 * This differs from its corresponding `String.prototype.search` in that a
 *   global search will return an array of indexes.
 * @param {RegExp|string} regex This regular expression is required to be
 *  continguous within a text node
 * @param {Node} node The node in which to search
 * @param {object} [opts]
 * @returns {number|Array} If regex is global, an array of positions will be
 *   found or an empty array if not found. If regex is not global, the index
 *   of the first match will be returned (or -1 if none is found)
 */
function searchUnbounded (regex, node, opts) {
  regex = getRegex(regex);
  opts = opts || {};

  return handleNode(node, nodeHandlerBoilerplate({
    element (nde) {
      if (regex.global) {
        return searchPositions(nde.textContent, regex, opts.returnLength);
      }
      return nde.textContent.search(regex);
    },
    text (nde) {
      if (regex.global) {
        return searchPositions(nde.nodeValue, regex, opts.returnLength);
      }
      return nde.nodeValue.search(regex);
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
 * @param {RegExp|string} regex This regular expression is required to be
 *   continguous within a text node. Note that for non-all global queries, an
 *   integer property "lastCumulativeIndex" will be added onto the regular
 *    expression to track its index within the supplied node.
 * @param {Node} node The node in which to search
 * @param {object} [opts] Options object
 * @param {boolean} [opts.flatten] Whether or not to flatten the return
 *   array for any results. Does not completely flatten the array but avoids
 *   nesting arrays for nested text nodes.
 * @param {boolean} [opts.all] Whether or not to return all results in
 *   the node at once or not.
 * @returns {null|Array} If no matches are found, `null` will be returned.
 *   If `opts.all` is set to true, then an array of all results in the node
 *   are returned (flattened or not, depending on opts.flatten; if not
 *   flattened, there will be one array containing arrays for each non-null
 *   result text node containing arrays for each exec result; if flattened,
 *   there will be one array containing arrays for each exec result). If
 *   `opts.all` is not set or set to false, then an array containing the
 *   results of the first successful node-internal exec match will be
 *   returned (if the search is global, any previous lastCumulativeIndex
 *   property will be used to increase the point at which searching begins).
 *   Note that `lastCumulativeIndex` and `lastIndex` will also be added
 *   as an object property on the return array for convenience.
 */
function execBounded (regex, node, opts) {
  opts = opts || {};
  const flatten = {}.hasOwnProperty.call(opts, 'flatten') ? opts.flatten : true;
  const all = {}.hasOwnProperty.call(opts, 'all') ? opts.all : false;
  const {filterElements} = opts;
  const ret = [];
  // We will modify the supplied RegExp (its lastIndex) if not returning all
  if (all) {
    regex = globalCloneRegex(regex);
  }
  regex.lastCumulativeIndex = regex.lastCumulativeIndex || 0;
  const oldLastCumulativeIndex = regex.lastCumulativeIndex;
  let cumulativeIndex = 0;

  const findInnerMatches = all
    ? function findInnerMatches (regexp, aNode) {
      function findMatches (arr, nde) {
        const found = findInnerMatches(regexp, nde);
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

      return handleNode(aNode, nodeHandlerBoilerplate({
        element (nde) {
          return [...nde.childNodes].reduce((arr, nd) => {
            return findMatches(arr, nd);
          }, []);
        },
        text (nde) {
          const contents = nde.nodeValue;
          let execArr;
          const execArrs = [];

          while ((execArr = regexp.exec(contents)) !== null) {
            // Copy if desired for any reason
            execArr.lastIndex = regexp.lastIndex;
            // Todo: Add and copy cumulative index here too?
            execArrs.push(execArr);
          }
          return execArrs.length ? execArrs : null;
        }
      }));
    }
    : function findInnerMatches (regexp, aNode) {
      const result = {found: null};
      function findMatches (nde) {
        result.found = findInnerMatches(regexp, nde);
        return result.found;
      }
      return handleNode(aNode, result, nodeHandlerBoilerplate({
        element (nde, rsult) {
          if (filterElements && filterElements(nde) === false) {
            return false;
          }
          [...nde.childNodes].some((nd) => {
            return findMatches(nd);
          });
          return rsult.found;
        },
        text (nde) {
          const contents = nde.nodeValue;
          let execArr;
          regexp.lastIndex = 0; // Required for global, harmless for non-global
          while ((execArr = regexp.exec(contents)) !== null) {
            cumulativeIndex += regexp.lastIndex;
            if (cumulativeIndex > oldLastCumulativeIndex) {
              regexp.lastCumulativeIndex = cumulativeIndex;
              // Copy in case desired for whatever reason
              execArr.lastIndex = regexp.lastIndex;
              // Copy this potentially useful property
              execArr.lastCumulativeIndex = regexp.lastCumulativeIndex;
              return execArr;
            }
          }
          cumulativeIndex += contents.length -
            regexp.lastIndex; // Add remainder
          return null;
        }
      }));
    };
  const innerMatches = findInnerMatches(regex, node);
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

  // Todo: use `regex` (and fix `return`)
  // eslint-disable-next-line no-console -- Debugging
  console.log('regex', regex, node, opts);
  return '';
}

function exec (regex, node, opts, nodeBounded) {
  regex = getRegex(regex);
  if (nodeBounded) {
    return execBounded(regex, node, opts);
  }
  return execUnbounded(regex, node, opts);
}

/**
 * If the supplied regular expression is not global, the results will be
 *  as with execBounded().
 * @param {RegExp|string} regex This regular expression is required to be
 *   continguous within a text node
 * @param {Node} node The node out of which to split
 * @param {object} [opts] Options object
 * @param {boolean} [opts.flatten] Whether or not to flatten the per-node
 *   array results of a global search together
 * @returns {any[]|any[][]} An array or array of arrays (depending on the
 *   flatten value) containing the matches.
 * @todo For match() (and exec() and forEach, etc.), provide option to
 *   actually split up the regular expression source between
 *   parenthetical groups (non-escaped parentheses) to make
 *   subexpression matches available as nodes (though might also
 *   just want strings too); also give option to grab parent
 *   element with or without other text contents
 */
function matchBounded (regex, node, opts) {
  regex = getRegex(regex);
  opts = opts || {};
  const flatten = {}.hasOwnProperty.call(opts, 'flatten') ? opts.flatten : true;
  const {filterElements} = opts;

  if (!regex.global) {
    return execBounded(regex, node, opts);
  }

  function findInnerMatches (regexp, aNode) {
    function findMatches (arr, nde) {
      const found = findInnerMatches(regexp, nde);
      if (found) { // Ignore comment nodes, etc.
        if (flatten) {
          arr = arr.concat(found);
        } else {
          arr.push(found);
        }
      }
      return arr;
    }

    return handleNode(aNode, nodeHandlerBoilerplate({
      element (nde) {
        if (filterElements && filterElements(nde) === false) {
          return false;
        }
        return [...nde.childNodes].reduce((arr, nd) => {
          return findMatches(arr, nd);
        }, []);
      },
      text (nde) {
        const contents = nde.nodeValue;
        return contents.match(regexp);
      }
    }));
  }
  const innerMatches = findInnerMatches(regex, node);
  const ret = (flatten || !innerMatches)
    ? innerMatches
    : innerMatches[0]; // Deal with extra array that we created
  return returnBySetType(ret, opts);
}

function matchUnbounded (regex, node, opts) {
  regex = getRegex(regex);
  opts = opts || {};
  const {preceding, following, filterElements} = opts;
  const addPrecedingFollowing = (preceding || following) &&
    ['range', 'fragment'].includes(opts.returnType);

  if (!regex.global) {
    return execUnbounded(regex, node, opts);
  }

  switch (opts.searchType) {
  case 'text':
    return handleNode(node, nodeHandlerBoilerplate({
      element (nde) {
        return nde.textContent.match(regex);
      },
      text (nde) {
        return nde.nodeValue.match(regex);
      }
    }));
  case 'node': default: {
    const indexes = searchUnbounded(regex, node, {returnLength: true});
    if (!indexes.length) {
      return null;
    }
    const ret = [];

    let found, startNode, startIdx;
    let startFound = false;
    let ct = 0;
    let idx = 0;
    let start = indexes[idx][0];
    let end = indexes[idx][1];

    const findInnerMatches = function findInnerMatches (regexp, searchNode) {
      function findMatches (aNode) {
        return findInnerMatches(regexp, aNode);
      }

      return handleNode(searchNode, nodeHandlerBoilerplate({
        element (aNode) {
          if (filterElements && filterElements(aNode) === false) {
            return false;
          }
          return [...aNode.childNodes].some((nde) => {
            return findMatches(nde);
          });
        },
        text (textNode) {
          const contents = textNode.nodeValue;
          const len = contents.length;
          const endTextNode = ct + len;
          if (!startFound && (endTextNode > start)) {
            startNode = textNode;
            startIdx = start - ct;
            startFound = true;
          }
          if (startFound && (endTextNode > end)) {
            const endIdx = end - ct;
            found = _win.document.createRange();
            found.setStart(startNode, startIdx);
            found.setEnd(textNode, endIdx);
            startFound = false;
            ++idx;
            let element, dummy;
            switch (opts.returnType) {
            case 'html':
              dummy = _win.document.createElement('div');
              dummy.append(found.cloneContents());
              element = dummy.innerHTML;
              break;
            case 'text':
              dummy = _win.document.createElement('div');
              dummy.append(found.cloneContents());
              element = dummy.textContent;
              break;
            case 'range':
              element = found;
              break;
            case 'fragment': default:
              element = found.cloneContents();
              break;
            }
            if (addPrecedingFollowing) {
              /*
              todo: Use startNode, textNode, node
              todo: Utilize exact preceding/following values for their
                     return type (e.g., preceding:'html')
              if (preceding) {
                element.preceding = ;
              }
              if (following) {
                element.following = ;
              }
              */
            }
            ret.push(element);
            const moreIndexes = indexes[idx];
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
}

function match (regex, node, opts, nodeBounded) {
  if (nodeBounded) {
    return matchBounded(regex, node, opts);
  }
  return matchUnbounded(regex, node, opts);
}

/**
 * @param {RegExp} regex
 * @param {Node} node
 * @param {object} opts
 * @param {Node} replacementNode
 * @returns {Node}
 * @todo Switch to using object arguments?
 * @todo Handle text in inputs, textareas, contenteditables?
*/
function replaceBounded (regex, node, opts, replacementNode) {
  const range = _win.document.createRange();
  regex = getRegex(regex);
  opts = opts || {};
  const {filterElements} = opts;
  if (!opts.replaceNode) {
    node = getNode(node).cloneNode(true);
  }
  replacementNode = opts.replacement || replacementNode;
  const method = regex.global ? 'forEach' : 'some';
  function replaceInnerMatches (regexp, aNode) {
    function replaceMatches (nde) {
      return replaceInnerMatches(regexp, nde);
    }

    return handleNode(aNode, nodeHandlerBoilerplate({
      element (nde) {
        if (filterElements && filterElements(nde) === false) {
          return false;
        }
        return [...nde.childNodes][method](replaceMatches);
      },
      text (nde) {
        const contents = nde.nodeValue;
        regexp.lastIndex = 0;

        let textMatch, matchStart, matchEnd, found = false;
        let len, text;
        while ((textMatch = regexp.exec(contents)) !== null) {
          found = true;
          text = textMatch[0];
          len = text.length;
          matchStart = regexp.global
            ? regexp.lastIndex - len
            : contents.search(regexp); // non-global can't use lastIndex
          matchEnd = matchStart + len;

          range.setStart(nde, matchStart);
          range.setEnd(nde, matchEnd);

          replaceNode(regexp, text, nde, replacementNode, range, opts);

          if (!regexp.global) {
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
 * @param {RegExp} regex
 * @param {Node} node
 * @param {object} opts
 * @param {Node} replacementNode
 * @returns {Node}
*/
function replaceUnbounded (regex, node, opts, replacementNode) {
  const range = _win.document.createRange();
  regex = getRegex(regex);
  opts = opts || {};
  if (!opts.replaceNode) {
    node = getNode(node).cloneNode(true);
  }
  const {
    // boolean
    replacePatternsHTML,
    portionMode = 'multiple', // multiple|first|single
    replacePortionPattern // boolean
  } = opts;
  replacementNode = opts.replacement || replacementNode;

  let matchedRanges = matchUnbounded(regex, node, {
    ...opts,
    returnType: 'range', preceding: 'html', following: 'html'
  }) || [];
  if (!regex.global) {
    matchedRanges = matchedRanges.splice(0, 1);
  }
  if (matchedRanges.length && replacePatternsHTML &&
    typeof replacementNode === 'string') {
    // We need to handle replacements ourselves
    const replacements = execUnbounded(
      regex, node, {...opts, returnType: 'html'}
    );
    replacementNode = replacementNode.replaceAll('$&', replacements[0]);
    replacements.slice(1).forEach((replacement, i) => {
      replacementNode = replacementNode.replaceAll(
        new RegExp(String.raw`\$` + (i + 1), 'gv'), replacement
      );
    });
    replacementNode = replacementNode.replaceAll('$`', range.preceding);
    replacementNode = replacementNode.replaceAll("$'", range.following);
    // We've already replaced the patterns, so avoid double-replacing
    opts = {...opts, replacePatterns: false};
  }
  let method;
  switch (portionMode) {
  case 'single':
    matchedRanges.forEach(function (rnge) {
      const frag = rnge.cloneContents();
      replaceNode(regex, frag.textContent, node, replacementNode, rnge, opts);
    });
    break;
  case 'first':
    method = 'some';
    // Fallthrough
  case 'multiple': default:
    method = method || 'forEach';
    matchedRanges.forEach(function (rnge) {
      const frag = rnge.cloneContents();

      function replaceInnerMatches (regexp, aNode) {
        function replaceMatches (nde) {
          return replaceInnerMatches(regexp, nde);
        }
        return handleNode(aNode, nodeHandlerBoilerplate({
          element (nde) {
            return [...nde.childNodes][method](replaceMatches);
          },
          text (nde) {
            const contents = nde.nodeValue;
            if (replacePortionPattern) {
              // We need to handle whole portion replacements here ourselves
              replacementNode = replacementNode.replaceAll(
                '$0', nde.nodeValue
              );
            }
            // Todo: any way to operate on original DOM with new range and thus
            //    no need to call deleteContents/insertNode below (or to
            //    replaceChild)? Apparently not as
            //    rnge.commonAncestorContainer would get too much
            const newNode = replaceNode(/^[\s\S]*$/v, contents, nde, replacementNode, false, opts);
            nde.parentNode.replaceChild(newNode, nde);
            return true;
          }
        }));
      }
      replaceInnerMatches(regex, frag);
      rnge.deleteContents();
      rnge.insertNode(frag);
    });
    break;
  }
  return node;
}

/**
 * @param {RegExp|string} regex A regular expression (as string or RegExp)
 * @param {Node|string} node A DOM Node in which to seek text to replace
 * @param {object} [opts] Options object
 * @param {Node|string|Function} replacementNode A DOM Node, a string, or
 *  callback that will be passed the portion and match
 * @param {boolean} nodeBounded
 * @returns {Node}
 */
function replace (regex, node, opts, replacementNode, nodeBounded) {
  if (nodeBounded) {
    return replaceBounded(regex, node, opts, replacementNode);
  }
  return replaceUnbounded(regex, node, opts, replacementNode);
}

function forEachBounded (regex, node, cb, thisObj) {
  regex = getRegex(regex);

  let matches, n0, i = 0;
  thisObj = thisObj || null;
  while ((matches = execBounded(regex, node)) !== null) {
    n0 = matches.splice(0, 1);
    cb.apply(thisObj, matches.concat(i++, n0));
  }
}

function forEachUnbounded (regex, node, cb, thisObj) {
  regex = getRegex(regex);

  let matches, n0, i = 0;
  thisObj = thisObj || null;
  while ((matches = execUnbounded(regex, node)) !== null) {
    n0 = matches.splice(0, 1);
    cb.apply(thisObj, matches.concat(i++, n0));
  }
}

function forEach (regex, node, cb, thisObj, nodeBounded) {
  regex = getRegex(regex);
  if (nodeBounded) {
    return forEachBounded(regex, node, cb, thisObj);
  }
  return forEachUnbounded(regex, node, cb, thisObj);
}

// Todo: other array extras

// UTILITY EXPORTS
export {textStringify, htmlStringify, searchPositions};

// MAIN API EXPORTS
// Todo: export a constructor which allows default regex (and/or
//    node?) and allows determination of whether to match
//    text within node or across nodes
export {
  splitUnbounded, splitBounded, split,
  testBounded, testUnbounded, test,
  searchBounded, searchUnbounded, search,
  execBounded, execUnbounded, exec,
  matchBounded, matchUnbounded, match,
  replaceBounded, replaceUnbounded, replace,
  forEachBounded, forEachUnbounded, forEach
};
