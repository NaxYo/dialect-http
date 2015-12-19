var DIALECT_HTTP = {},
    express = require('express'),
    connect_auth = require('connect-auth'),
    mongodb = require('mongodb'),

    _lib_path = require('path').join(__dirname, '..', 'lib'),
    _controllers_path = require('path').join(_lib_path, 'controllers'),

    _authenticateStrategy = function (options) {
      var STRATEGY = {name: 'form'},

        failed_validation = function (req, res, uri) {
          res.redirect(303, '/auth/form?redirect_url=' + uri);
        },

        validate_credentials = function (scope, req, res, callback) {
          var user = options.users.filter(function (user) {
            return user.username === req.body.username && user.password === req.body.password;
          });

          if (user) {
            scope.success(user[0], callback);
          } else {
            scope.fail(callback);
          }
        };

      STRATEGY.authenticate = function (req, res, callback) {
        if (req.body.username && req.body.password) {
          validate_credentials(this, req, res, callback);
        } else {
          failed_validation(req, res, req.url);
        }
      };

      return STRATEGY;
    };

// Default options
DIALECT_HTTP.options = {
  title: 'dialect-http',
  session: {
    secret: 'jimi-hendrix-drinks-hendricks-with-cucumber',
    cookie: {maxAge: 60000 * 20} // 20 minutes
  },
  users: [
    {
      username: 'admin',
      password: 'admin'
    }
  ],
  port: 3001,
  io_port: 8083,
  dialect: {
    locales: ['en'],
    store: {mongodb: {database: 'dialect'}}
  }
};

DIALECT_HTTP.app = express();
var http = require('http').Server(DIALECT_HTTP.app);
DIALECT_HTTP.io = require('socket.io')(http);
DIALECT_HTTP.dialect = {};


DIALECT_HTTP.io.on('connection', function(socket) {
  console.log('Notifications client connected');

  socket.on('disconnect', function() {
    console.log('Notifications client disconnected');
  });
});

DIALECT_HTTP.authenticate = function (req, res, next) {
  var dynamicHelpers = require(_lib_path + '/helpers/dynamic')(DIALECT_HTTP);

  if (req.session.auth && req.session.auth.user) {
    req.user = req.session.auth.user;

    res.locals.flash = dynamicHelpers.flash(req);
    res.locals.can_approve = dynamicHelpers.can_approve(req);
    res.locals.authorized_locales = dynamicHelpers.authorized_locales(req);

    next();
  } else {
    req.flash('error', 'Please, login');
    res.redirect(303, '/public/users/login?redirect_url=' + req.url);
  }
};

DIALECT_HTTP.run = function () {
  var app = DIALECT_HTTP.app,
      options = DIALECT_HTTP.options;

  if( options.dialect.store.mongodb.url ) {
      mongodb.MongoClient.connect(options.dialect.store.mongodb.url,dbReady);
  } else {
      var mongo_server = new mongodb.Server(
          options.dialect.store.mongodb.host || 'localhost'
          , options.dialect.store.mongodb.port || 27017
          , {auto_reconnect: true}
      );
      var db = mongodb.Db(options.dialect.store.mongodb.database, mongo_server, {});
      dbReady(null,db);
    }

  function dbReady(err,db_connector) {
      var dialect = DIALECT_HTTP.dialect = require('dialect').dialect(options.dialect);

      app.set('views', _lib_path + '/views');
      app.set('view engine', 'jade');
      app.use(require('body-parser').urlencoded({ extended: false }));
      app.use(require('body-parser').json());
      app.use(require('cookie-parser')());

      app.use(require('express-session')({
        cookie: options.session.cookie,
        secret: options.session.secret,
        store: new require('connect-mongodb')({ db: db_connector })
      }));

      app.use(require('express-flash')());
      app.use(express['static'](_lib_path + '/public'));
      app.use(connect_auth([_authenticateStrategy(options)]));

      app.use(function(req, res, next) {
        var dynamicHelpers = require(_lib_path + '/helpers/dynamic')(DIALECT_HTTP);
        res.locals.flash = dynamicHelpers.flash(req);
        res.locals.can_approve = dynamicHelpers.can_approve(req);
        res.locals.authorized_locales = dynamicHelpers.authorized_locales(req);

        next();
      });
      app.locals.dialect = dialect;
      app.locals.title = options.title;

      console.log('Setting up the store ...'.grey);

      dialect.connect(function (error, data) {
          if (error) {
              return console.error(('Error connecting to the dialect store: "' + error.message + '"').red);
          }

          // Controllers
          require(_controllers_path + '/app')(DIALECT_HTTP);
          require(_controllers_path + '/auth')(DIALECT_HTTP);
          require(_controllers_path + '/translate')(DIALECT_HTTP);

          app.listen(options.port);
          options.io_port && http.listen(options.io_port);
          console.log('Listening port '.green + (options.port).toString().yellow);
          options.io_port && console.log('Notifications port '.green + (options.io_port).toString().grey);
      });

  }
};

module.exports = DIALECT_HTTP;
