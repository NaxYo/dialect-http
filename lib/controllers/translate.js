var _ = require('underscore');
var PaginateJs = require('paginate-js');

module.exports = function (DIALECT_HTTP) {
  var app = DIALECT_HTTP.app,
      dialect = DIALECT_HTTP.dialect,
      options = DIALECT_HTTP.options,
      title = options.title + ' | ',
      ObjectID = require('mongodb').ObjectID,
      results_per_page = 30,
      authenticate = DIALECT_HTTP.authenticate;

  app.get('/:locale/:type(all|ok|pending|missing)/:page?', authenticate, function(req, res) {
    var funk = require('funk')(),
        type = req.params.type,
        locale = req.params.locale,
        query = { locale: locale },
        check_locale = function (el) {
          return el === locale;
        };

    if(res.locals.authorized_locales.some(check_locale)) {
      if(type !== 'all') query.translation = type === 'missing' ? null : { '$ne': null };
      if(type !== 'missing') query.approved = type === 'ok';

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
        var paginator = new PaginateJs({
            elements_per_page : results_per_page,
            count_elements    : type === 'all' ? this.count
              : type === 'missing' ? this.count_missing
              : type === 'pending' ? this.count_pending
              : this.count_ok
        });

        paginator = paginator.render({
            url  : '/' + req.params.locale + '/' + type + '/%N',
            page : parseInt(req.params.page || 1)
        });

        res.render('locale', {
          title: title + 'Translate ' + req.params.locale,
          translations: this.translations || [],
          count: this.count,
          paginator: paginator,
          page: req.params.page,
          category: type,
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

  app.post('/:locale/delete', authenticate, function (req, res) {
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
