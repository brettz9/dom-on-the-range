# dom-on-the-range

Converts regular expressions into safe DOM ranges (**Project not complete!**)

Allows testing, searching, matching, exec'ing, splitting, and replacing portions of a
supplied node using regular expressions to match text within the node.

Currently for the browser only due to there apparently being no Range implementations in Node.

"Oh, give me a DOM where the wildcards can roam, and the markup won't wander away..."

# Installation

# Usage



# Todos

1. Add preceding/following options to `matchBounded`, `execBounded`
1. As already done for `matchUnbounded` and `replaceUnbounded`, get `splitUnbounded`, `execUnbounded` to work
across text nodes and element nodes as per
http://softwarerecs.stackexchange.com/questions/16611/translating-a-regex-into-a-dom-range
1. Once `execUnbounded` implemented:
    1. For `replaceUnbounded`, test with non-global which uses matchUnbounded->execUnbounded
    1. For `replaceUnbounded`, test replacement patterns, including preceding/following replacements (e.g., `$'`)
    1. Test `forEachUnbounded`
1. Try making bounded functions dependencies of matchBounded?
1. Allow returning of ranges or nodes for match and exec (as well as strings).
1. Could allow config for `search` to return index of matched text within `outerHTML` or `XMLSerializer().serializeToString()` (and on index properties of `exec` return results). Could allow provision of strings (but then would need to add a HTML parser dependency)
1. Allow regexes like `<a/>.*<b/>` which do not match the elements literally but instead look merely for an element with the name "a" and find it and all content until an element with the name "b". Attributes indicated within (with or without values?) can be configured to be either a comprehensive and exclusive list of required attributes or just indicating the minimum set. `&lt;` and `&gt;` can be used within the regex for `<` and `>`.
1. Allow grabbing entire node in which content was found (or a boolean indicating found) or range covering only the text matched.
1. Allow returning node or just node contents as string, in array or DOM fragment.
