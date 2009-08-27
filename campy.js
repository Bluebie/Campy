// Requires: mootools-1.2.3-core-server.js, mootools-1.2.3.1-more.js, sha256.js, tago.js
load('mootools-1.2.3-core-server.js');
load('mootools-1.2.3.1-more.js');
load('sha256.js');
load('tago.js');

var Helpers = {

};

var Controller = new Class({
  defaultHeaders: {'Content-Type': 'text/html;charset=utf-8'},
  before: [],
  after: [],
  
  // create new controller with a particular regexp and a hash of http methods
  initialize: function(tester, methods) {
    if ($type(this.tester) != 'regexp') this.tester = new RegExp('^' + tester.toString().escapeRegExp() + '$');
    else this.tester = tester;
    $extend(this, Helpers);
    
    var self = this;
    var filteredMethods = new Hash(methods);
    filteredMethods.each(function(value, key) {
      if ('Use' == key) {
        [value].flatten().each(function(use) {
          if ($type(use) == 'string') use = Controller.Usables[use];
          if (use.before) self.before.push(use.before);
          if (use.after)  self.after.unshift(use.after);
        });
        filteredMethods.erase(key);
      }
    });
    Hash.extend(this, filteredMethods);
    
    this.render.__view__ = function() { return self.renderView.run(arguments, self.copy); }
  },
  
  // handles a request
  service: function(args, request, response) {
    var method = request.method.toLowerCase();
    var copy = this.copy = $unlink(this);
    copy.request = request;
    copy.input = request.uri.params;
    var originalCookies = $unlink(copy.cookies = $H(copy.readCookies()));
    copy.response = response; copy.body = '';
    copy.headers = $H(this.defaultHeaders); copy.status = 200;
    if (Controller.prototype[method] || method.test(/^_/)) method = 'methodIllegal';
    
    copy.before.push(copy[method] || copy.methodNotAvailable);
    var returned = null;
    for (var i = 0; i < copy.before.length; i++) {
      returned = copy.before[i].run(args, copy);
      if (returned != null || copy.response.finished) break;
    }
    if (copy.after.length > 0) copy.after.each(function(i) { i.run(args, copy); });
    
    if (!copy.response.finished) {
      var body = (returned || copy.body || '').toString();
      copy.headers['Content-Length'] = body.length.toString();
      
      // transcribe headers
      var weirdHeaders = [];
      copy.headers.each(function(vals, key) {
        [vals].flatten().each(function(val) {
          weirdHeaders.push([key.toString(), val.toString()]);
        });
      });
      
      // set any cookies that need setting
      copy.cookies.each(function(value, name) {
        if (!originalCookies[name] || originalCookies[name] != value) {
          if ($type(value) != 'object') value = {value: value.toString(), path: '/'};
          if ($type(value.value) == false) { value.expires = new Date(0); value.value = ''; }
          var cookie = name + '=' + encodeURIComponent(value.value.toString());
          if (value.comment) cookie += '; Comment=' + value.comment;
          if (value.domain) cookie += '; Domain=' + value.domain;
          if (value.maxAge) cookie += '; Max-Age=' + value.maxAge;
          if (value.path) cookie += '; Path=' + value.path;
          if (value.expires) cookie += '; expires=' + (value.expires.toGMTString || value.expires.toString)();
          if (value.secure) cookie += '; Secure';
          if (value.httponly) cookie += '; httponly';
          weirdHeaders.push(['Set-Cookie', cookie]);
        }
      });
      
      copy.response.sendHeader(copy.status, weirdHeaders);
      copy.response.sendBody(body);
      copy.response.finish();
    }
  },
  
  readCookies: function() {
    var cookies = {};
    [this.request.headers.Cookie].flatten().each(function(cookie) {
      var pairs = cookie.split(/(;|,)/g);
      pairs.each(function(pair) {
        pair = pair.split('=');
        cookies[pair[0].toString().trim()] = unescape(pair[1]);
      });
    });
    return cookies;
  },
  
  render: {}, // has dynamically added functions to do rendering
  renderView: function() {
    var args = $A(arguments);
    var view = args.shift();
    var locals = $unlink(this);
    var viewArgs = [];
    
    var tago = new Tago();
    //Hash.erase(locals, 'body');
    Hash.each(locals, function(val, name) {
      tago['c'+name.capitalize()] = val;
      if (!tago[name]) tago[name] = val;
    });
    tago.controller = locals;
    //$extend(tago, locals);
    args.unshift($unlink(tago));
    var body = function() { Views.funcs[view].run(args, args[0]); };
    return (this.body = Views.render('layout', [tago, body]).toHTML());
  },
  
  getRequestHeaders: function(name) {
    var headers = {}, name = name.toLowerCase();
    return this.request.headers.filter(function(header) {
      return header[0].toLowerCase() == name;
    }).map(function(header) {
      return header[1];
    });
  },
  
  getURI: function() {
    var host = this.request.headers.Host;
    if (host) return new URI('http://' + host + this.request.uri);
    else return new URI(this.request.uri.toString());
  },
  
  redirect: function(uri) {
    var base = this.getURI();
    this.status = 302;
    this.headers.Location = (new URI(uri, {base: base})).toString();
  },
  
  methodIllegal: function(components) {
    this.status = 404; return 'The requested method is not allowed.';
  },
  
  methodNotAvailable: function(components) {
    this.status = 404; return 'The requested http method is unavailable.';
  }
});

var Controllers = {
  list: [],
  notFound: new Controller('', {
    methodNotAvailable: function() {
      this.headers.set('Content-Type', 'text/plain'); this.status = '404';
      return 'There is no content at ' + this.request.uri.path + '.';
    }
  }),
  
  // adds controllers to the list
  add: function() { Controllers.list.push.run($A(arguments), Controllers.list); },
  
  // route a path to a particular controller
  route: function(request, response) {
    for (var i = 0; i < Controllers.list.length; i++) {
      var match = Controllers.list[i].tester.exec(request.uri.path);
      if (match) return Controllers.list[i].service($A(match), request, response);
    }
    return Controllers.notFound.service([], request, response);
  }
};

// Usables are special modules you can add to your controller to add extra functionality
Controller.Usables = {}
Controller.Usables.CookieSessions = {
  key1: false, // these two keys maintain the security of the session, they have to be absolutely unique to your application. Set them to custom strings if you wish for Bonus Security Points
  key2: false,
  
  signer: function(str) {
    if (!Controller.Usables.CookieSessions.key1)
      Controller.Usables.CookieSessions.key1 = Hash.getKeys(Views.funcs).join('');
    if (!Controller.Usables.CookieSessions.key2)
      Controller.Usables.CookieSessions.key2 = Controllers.list.length.toString() + Controllers.list.map(function(i) { return i.tester.source; }).join('');
    
    return SHA256(Controller.Usables.CookieSessions.key1 + SHA256(Controller.Usables.CookieSessions.key2 + str));
  },
  
  before: function() {
    this.state = {};
    if (this.cookies.state) {
      if (Controller.Usables.CookieSessions.signer(this.cookies.state) == this.cookies.stateSig) {
        this.state = JSON.parse(this.cookies.state);
      } else {
        Hash.erase(this.cookies, 'state'); Hash.erase(this.cookies, 'stateSig');
        node.debug('Session signature invalid, ignoring');
      }
    }
  },
  
  after: function() {
    var state = JSON.stringify(this.state);
    if (this.cookies.state != state) {
      node.debug(state);
      node.debug(this.cookies.state || '');
      this.cookies.state = state;
      this.cookies.stateSig = Controller.Usables.CookieSessions.signer(state);
    }
  }
};


var Views = {
  funcs: new Hash(),
  
  render: function(view, args) {
    Views.funcs[view].run(args, args[0]);
    return args[0];
  },
  
  add: function(views) {
    $extend(Views.funcs, views);
    Hash.getKeys(views).each(function(funcName) {
      Controller.prototype.render[funcName] = function() {
        var args = $A(arguments);
        args.unshift(funcName);
        return this.__view__.run(args);
      };
    });
  },
}

Views.add({
  layout: function(t, body) {
    t.html(function() {
      t.head(function() {
        t.title('Hiya World!');
        t.meta(t.attr('charset', 'utf-8'));
        t.comment(' Create a layout view to customize this wrapping ');
      });
      t.body(body);
    });
  }
});
