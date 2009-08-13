// Note: Tags list generated off html5 spec by running the following in web inspector
// var n = $$('h4 dfn code'); var a = []; for (var i = 0; i < n.length; i++) { if ((n[i].parentNode.nextSibling || {}).textContent == ' element') a.push(n[i].textContent.toLowerCase()) }; a;
// list of empty tags pinched from Markaby's self closing list. :)

var Tagomatic = new Class({
  doctype: '<!DOCTYPE html>',
  tags: ["html", "head", "title", "base", "link", "meta", "style", "script", "noscript", "body", "section", "nav", "article", "aside", "hgroup", "header", "footer", "address", "p", "hr", "br", "pre", "dialog", "blockquote", "ol", "ul", "li", "dl", "dt", "dd", "a", "q", "cite", "em", "strong", "small", "mark", "dfn", "abbr", "time", "progress", "meter", "code", "var", "samp", "kbd", "span", "i", "b", "bdo", "ruby", "rt", "rp", "ins", "del", "figure", "img", "iframe", "embed", "object", "param", "video", "audio", "source", "canvas", "map", "area", "table", "caption", "colgroup", "col", "tbody", "thead", "tfoot", "tr", "td", "th", "form", "fieldset", "label", "input", "button", "select", "datalist", "optgroup", "option", "textarea", "keygen", "output", "details", "command", "bb", "menu", "legend", "div", "applet", "marquee"],
  empty: ['base', 'meta', 'link', 'hr', 'br', 'param', 'img', 'area', 'input', 'col'],
  htmlString: '',
  escapeThese: {'<': '&lt;', '>': '&gt;', '"': '&quot;'},
  
  initialize: function() {
    var self = this;
    this.tags.each(function(tagName) {
      self[tagName] = function() { self.tag.run([tagName, $A(arguments)], self); };
    });
  },
  
  tag: function() {
    var attribs = $A(arguments).flatten(), tagName = 'tag', self = this;
    if ($type(attribs[0]) == 'string') tagName = attribs.shift().toLowerCase();
    this.htmlString += '<' + tagName;
    attribs = attribs.filter(function(i) {
      if (i.isAttribute) {
        self.htmlString += ' ' + i.toString();
        return false;
      } else return true;
    });
    this.htmlString += '>'
    
    if (!this.empty.contains(tagName)) {
      if (attribs.length > 0) {
        attribs.each(function(bit) {
          if ($type(bit) == 'function') bit.run([this], this);
          else if ($type(bit) == 'string') this.htmlString += bit.html ? bit.html : this.escapeHTML(bit);
        }, this);
      }
      this.htmlString += '</' + tagName + '>';
    }
  },
  
  comment: function(text) {
    this.htmlString += '<!--' + text + '-->'
  },
  
  toHTML: function() {
    var str = this.doctype + "\n" + this.htmlString + "\n"; str.isHTML = true; return str;
  },
  
  toPartialHTML: function() { var str = ''+this.htmlString; str.isHTML = true; return str; },
  
  // creates an attribute, which can be used as an argument to tag();
  attr: function(name, value) {
    var self = this;
    return {isAttribute: true, name: name, value: value, toString: function() {
      var str = name.toLowerCase();
      if (value) str += '="' + self.escapeHTML(value) + '"';
      return str;
    }};
  },
  
  // for boolean attributes like 'selected'
  booleanAttr: function(name, test) {
    return test ? this.attr(name, false) : null;
  },
  
  // creates a whole bunch of attributes from a hash
  attrs: function(attributes) {
    return Hash.map(attributes, function(val, key) { this.attr(key, val) });
  },
  
  // wraps a string so it wont be escaped, for raw html
  raw: function(html) {
    return {html: html};
  },
  
  // adds some text to the document
  text: function() {
    $A(arguments).each(function(arg) { this.htmlString += arg.html ? arg.html : this.escapeHTML(arg); }, this);
  },
  
  // escapes some text to work inside of html
  escapeHTML: function(text) {
    return text;
    if (!this.escapeRegexp) this.escapeRegexp = new RegExp(Hash.getKeys(this.escapeThese).map(function(i) { return i.escapeRegExp(); }).join('|'), 'g');
    var self = this;
    return text.replace(this.escapeRegexp, function(chr) { return self.escapeThese[chr]; });
  }
});

