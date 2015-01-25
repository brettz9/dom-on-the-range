# dom-on-the-range
Converts regular expressions into safe DOM ranges (**Project not complete!**)

# Todos
1. Get to work across text nodes and element nodes as per http://http://softwarerecs.stackexchange.com/questions/16611/translating-a-regex-into-a-dom-range
2. Get to work within text, comment, CDATA, or processing instruction nodes
3. Get to clone, extract, or split portions of original node
4. Allow regexes like `<a/>.*<b/>` which do not match the elements literally but instead look merely for an element with the name "a" and find it and all content until an element with the name "b". Attributes indicated within (with or without values?) can be configured to be either a comprehensive and exclusive list of required attributes or just indicating the minimum set. `&lt;` and `&gt;` can be used within the regex for `<` and `>`.
