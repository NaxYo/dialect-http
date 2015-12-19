var _ = require('underscore');

module.exports = function (DIALECT_HTTP) {
  var app = DIALECT_HTTP.app,
      dialect = DIALECT_HTTP.dialect,
      options = DIALECT_HTTP.options,
      title = options.title + ' | ',
      ObjectID = require('mongodb').ObjectID,
      results_per_page = 30,
      authenticate = DIALECT_HTTP.authenticate;

  app.get('/:locale/all/:page?', authenticate, function (req, res) {
    var funk = require('funk')(),
        locale = req.params.locale,
        query = {locale: locale},
        check_locale = function (el) {
          return el === locale;
        };

    if (res.locals.authorized_locales.some(check_locale)) {
      dialect.store.collection.find(
        query,
        {skip: (req.params.page - 1) * results_per_page, limit: results_per_page},
        function (err, cursor) {
          var isOriginalLanguage = locale === 'en';
          var onDone = funk.result('translations');

          cursor.toArray(isOriginalLanguage ? onDone : function(err, translations) {
            dialect.store.collection.find({ locale: 'en' }, function(err, cursor) {

              cursor.toArray(function(err, originals) {
                onDone(null, _.map(translations, function(trans) {
                  var original = _.find(originals, { original: trans.original });

                  return _.extend(trans, {
                    en: original && original.translation
                  });
                }));
              });

            });
          });
        }
      );
      dialect.store.count(query, funk.result('count'));
      dialect.store.count({locale: locale, translation: {'$ne': null}, approved: true}, funk.result('count_ok'));
      dialect.store.count({locale: locale, translation: {'$ne': null}, approved: false}, funk.result('count_pending'));
      dialect.store.count({locale: locale, translation: null}, funk.result('count_missing'));

      funk.parallel(function () {
        var paginator = require('paginate-js')({elements_per_page: results_per_page, count_elements: this.count});

        res.render('locale', {
          title: title + 'Translate ' + req.params.locale,
          translations: this.translations || [],
          count: this.count,
          count_pending: this.count_pending,
          count_missing: this.count_missing,
          paginator: paginator.render({url: '/' + req.params.locale + '/all/%N', page: req.params.page}),
          page: req.params.page,
          count_ok: this.count_ok,
          category: 'All',
          locale: req.params.locale
        });
      });
    }
    else {
      req.flash('error', 'You don\'t have acces to the locale "' + locale + '"');
      res.redirect('/');
    }
  });


  ['ok', 'pending', 'missing'].forEach(function (el) {
    app.get('/:locale/' + el + '/:page?', authenticate, function (req, res) {
      var funk = require('funk')(),
          locale = req.params.locale,
          query = { locale: locale },
          check_locale = function (el) {
            return el === locale;
          };

      if (res.locals.authorized_locales.some(check_locale)) {

        query.translation = (el === 'missing' ? null : {'$ne': null});
        if (el !== 'missing') {
          query.approved = (el === 'ok');
        }

        dialect.store.collection.find(
          query,
          {skip: (req.params.page - 1) * results_per_page, limit: results_per_page},
          function (err, cursor) {
            var isOriginalLanguage = locale === 'en';
            var onDone = funk.result('translations');

            cursor.toArray(isOriginalLanguage ? onDone : function(err, translations) {
              dialect.store.collection.find({ locale: 'en' }, function(err, cursor) {

                cursor.toArray(function(err, originals) {
                  onDone(null, _.map(translations, function(trans) {
                    var original = _.find(originals, { original: trans.original });

                    return _.extend(trans, {
                      en: original && original.translation
                    });
                  }));
                });

              });
            });
          }
        );
        dialect.store.count({locale: locale}, funk.result('count'));
        dialect.store.count({locale: locale, translation: {'$ne': null}, approved: true}, funk.result('count_ok'));
        dialect.store.count({locale: locale, translation: {'$ne': null}, approved: false}, funk.result('count_pending'));
        dialect.store.count({locale: locale, translation: null}, funk.result('count_missing'));

        funk.parallel(function () {
          var paginator = require('paginate-js')({elements_per_page: results_per_page, count_elements: this.count});

          res.render('locale', {
            title: title + 'Translate ' + req.params.locale,
            translations: this.translations || [],
            count: this.count,
            paginator: paginator.render({url: '/' + req.params.locale + '/' + el + '/%N', page: req.params.page}),
            page: req.params.page,
            category: el,
            locale: req.params.locale,
            count_pending: this.count_pending,
            count_missing: this.count_missing,
            count_ok: this.count_ok
          });
        });
      }
      else {
        req.flash('error', 'You don\'t have acces to the locale "' + locale + '"');
        res.redirect('/');
      }
    });
  });


  app.post('/:locale/translate', authenticate, function (req, res) {
    DIALECT_HTTP.io.emit('merge');
    dialect.store.collection.update(
      {_id: ObjectID.createFromHexString(req.body.id)},
      {'$set': {
        translation: req.body.translation ? req.body.translation : null,
        locale: req.params.locale,
        approved: false
      }},
      {upsert: true},
      function () {
        res.writeHead(200);
        res.end('ok');
      }
    );
  });


  app.post('/:locale/approve', authenticate, function (req, res) {
    if (res.locals.can_approve) {
      dialect.store.collection.update(
        {_id: ObjectID.createFromHexString(req.body.id)},
        {'$set': {approved: req.body.approved === 'true'}},
        {upsert: false},
        function () {
          res.writeHead(200);
          res.end('ok');
        }
      );
    } else {
      res.writeHead(403);
      res.end('you are not authorized to perform that operation');
    }
  });

  app.post("/:locale/delete", authenticate, function (req, res) {
    if (res.locals.can_approve) {
      dialect.store.collection.remove(
        {_id: ObjectID.createFromHexString(req.body.id)},
        function () {
          res.writeHead(200);
          res.end('ok');
        }
      );
    } else {
      res.writeHead(403);
      res.end('you are not authorized to perform that operation');
    }
  });

};
