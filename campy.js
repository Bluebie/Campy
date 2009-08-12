var Helpers = {

};

var Controller = new Class({
  defaultHeaders: {'Content-Type': 'text/html;charset=utf-8'},
  
  // create new controller with a particular regexp and a hash of http methods
  initialize: function(tester, methods) {
    if ($type(this.tester) != 'regexp') this.tester = new RegExp('^' + tester.toString().escapeRegExp() + '$');
    else this.tester = tester;
    $extend(this, Helpers);
    $extend(this, methods);
  },
  
  // handles a request
  service: function(args, request, response) {
    var method = request.method.toLowerCase();
    var copy = $unlink(this);
    copy.request = request;
    copy.response = response; copy.body = '';
    copy.headers = $H(this.defaultHeaders); copy.status = 200;
    if (Controller.prototype[method] || method.test(/^_/)) method = 'methodIlligal';
    var returned = (copy[method] || copy.methodNotAvailable).run(args, copy);
    if (!copy.response.finished) {
      var body = (returned || copy.body || '').toString();
      copy.headers['Content-Length'] = body.length.toString();
      var headers = copy.headers.map(function(val, key) { return [key.toString(), val.toString()]; }).getValues()
      copy.response.sendHeader(copy.status, headers);
      copy.response.sendBody(body);
      copy.response.finish();
    }
  },
  
  render: function() {
    var args = $A(arguments);
    var view = args.shift();
    var locals = $unlink(this);
    var viewArgs = [];
    
    args.each(function(arg) {
      if ($type(arg) == 'object') $extend(locals, arg);
      else viewArgs.push(arg);
    });
    
    var tago = new Tagomatic();
    Hash.erase(locals, 'body');
    $extend(tago, locals);
    viewArgs.unshift($unlink(tago));
    var body = function() { Views.funcs[view].run(viewArgs, viewArgs[0]); };
    return (this.body = Views.render('layout', [tago, body]).toHTML());
  },
  
  methodIlligal: function(components) {
    this.status = 401; return 'The requested method is not allowed';
  },
  
  methodNotAvailable: function(components) {
    this.status = 401; return 'The requested http method is unavailable';
  }
});

var Controllers = {
  list: [],
  notFound: new Controller('', {
    methodNotAvailable: function() {
      this.headers.set('Content-Type', 'text/plain');
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

var Views = {
  funcs: {layout: function(t, body) {
    t.html(function() {
      t.head(function() {
        t.title('Hiya World!');
        t.meta(t.attr('charset', 'utf-8'));
        t.comment(' Create a layout view to customize this wrapping ');
      });
      t.body(body);
    });
  }},
  
  render: function(view, args) {
    Views.funcs[view].run(args, args[0]);
    return args[0];
  },
  
  add: function(views) { $extend(Views.funcs, views); },
}
