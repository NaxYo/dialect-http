module.exports = function(DIALECT_HTTP) {
  var app = DIALECT_HTTP.app,
      options = DIALECT_HTTP.options,
      filters = DIALECT_HTTP.dialect.config('filters'),
      title = options.title + ' | ',

      _dashboard = function(req, res) {
        DIALECT_HTTP.authenticate(req, res, function(){ });

        function getFilter(filterId) {
          var filter = filters[filterId];
          var allSearchTerms = [];

          for(var i in filter['search_term']) {
              if (filter['search_term'][i] !== 'undefined') {
                allSearchTerms.push(filter['search_term'][i]);
              }
          }

          allSearchTerms = allSearchTerms.join('|');

          return new RegExp(allSearchTerms, 'g');
        }

        function reduce(k, vals) {
          var i, res = {ok: 0, pending: 0, missing: 0};
          for (i in vals) {
            res.ok += vals[i].ok;
            res.pending += vals[i].pending;
            res.missing += vals[i].missing;
          }
          return res;
        }

        function map() {
          if(!this.original.match(myplaceholder)) {
            emit(this.locale, {ok: 0, pending: 0, missing: 0});
          }
          else {
            if(this.translation && this.approved)
              emit(this.locale, {ok: 1, pending: 0, missing: 0});
            else if(this.translation && !this.approved)
              emit(this.locale, {ok: 0, pending: 1, missing: 0});
            else
              emit(this.locale, {ok: 0, pending: 0, missing: 1});
          }
        }

        var stringFunction = map.toString();
        var myRegex = (filters && req.session.filter)
          ? getFilter(req.session.filter)
          : '/.*/';

        stringFunction = stringFunction.replace('myplaceholder', myRegex);
        console.log(stringFunction);
        DIALECT_HTTP.dialect.store.collection.mapReduce(stringFunction, reduce.toString(), { out:'summary' }, function(err, coll) {
          if(coll) {
              coll.find({}, function(err, cursor) {
                cursor.toArray(function(err, docs) {
                  console.log(docs)
                  var stats = {};
                  docs.forEach(function(stat) {
                    stats[stat._id] = stat.value;
                  });

                  renderHome(stats);
                  coll.drop();
                });
              });
          }
          else renderHome({});

          function renderHome(stats) {
            var locales = res.locals.authorized_locales;
            var singleLocale = locales.length === 1 ? locales[0] : null;

            singleLocale && res.redirect(303, '/' + singleLocale + '/all');
            singleLocale || res.render('dashboard', {
              title: title + 'Edit your translations',
              stats: stats,
              session_filter: req.session.filter,
              locale: null
            });
          }
        });
      };

  app.get('/', function(req, res) {
    if(req.session.auth && req.session.auth.user) {
      _dashboard(req, res);
    }
    else {
      res.render('public/users/login', {
        title: title + 'Login',
        email: null,
        password: null,
        layout: 'public'
      });
    }
  });

  app.get('/public/users/login', function(req, res) {
    res.render('public/users/login', {
      title: title + 'Login',
      email: null,
      password: null,
      layout: 'public'
    });
  });

};
