var _ = require('underscore');
var PaginateJs = require('paginate-js');

module.exports = function (DIALECT_HTTP) {
  var app = DIALECT_HTTP.app,
      dialect = DIALECT_HTTP.dialect,
      options = DIALECT_HTTP.options,
      title = options.title + ' | ',
      ObjectID = require('mongodb').ObjectID,
      results_per_page = 30,
      authenticate = DIALECT_HTTP.authenticate,
      filters = dialect.config('filters'),
      funk = require('funk')()

  app.get('/unset-filter', authenticate, function(req, res) {
      delete req.session.filter;
      res.redirect('/');
  });

  app.get('/set-filter/:filter', authenticate, function(req, res) {
    req.session.filter = req.params.filter;
    res.redirect('/');
  });

  function addFiltersToQuery(query, filterId) {
    var filter = filters[filterId];
    var allSearchTerms = [];

    for(var i in filter['search_term']) {
        if (filter['search_term'][i] !== 'undefined') {
          allSearchTerms.push(filter['search_term'][i]);
        }
    }

    allSearchTerms = allSearchTerms.join('|');

    var ultimateRegExp = new RegExp(allSearchTerms, 'g');
    console.log(ultimateRegExp)
    query.original = ultimateRegExp;

  };

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
      if(type === 'ok' || type === 'pending') query.approved = type === 'ok';

      // Call the function to apply the filter
      req.session.filter && addFiltersToQuery(query, req.session.filter);

      dialect.store.collection.find(query, {
          skip  : (req.params.page - 1) * results_per_page,
          limit : results_per_page,
          original: query.original
        },
        function(err, cursor) {
          getExtendedTranslations(cursor, locale, funk.result('translations'));
        }
      );

      var localeTranslation = {locale: locale };
      if(req.session.filter)
        localeTranslation['original'] = query.original;

      dialect.store.count(localeTranslation, funk.result('count'));
      dialect.store.count(Object.assign({translation: {'$ne': null}, approved: true}, localeTranslation), funk.result('count_ok'));
      dialect.store.count(Object.assign({translation: {'$ne': null}, approved: false}, localeTranslation), funk.result('count_pending'));
      dialect.store.count(Object.assign({translation: null}, localeTranslation), funk.result('count_missing'));

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

  app.post('/:locale/search', authenticate, function(req, res) {
    var regexTerm = new RegExp(req.body.query, 'i');
    var query = {
      locale : req.params.locale,
      '$or'  : [
        { original    : regexTerm },
        { translation : regexTerm }
      ]
    };

    req.session.filter && addFiltersToQuery(query, req.session.filter);

    dialect.store.collection.find(query, function(err, cursor) {
      getExtendedTranslations(cursor, req.params.locale, function(err, translations) {
        var htmlResult = '';
        var almostReady = _.after(translations.length, allReady);

        translations.length || allReady();
        translations.forEach(function(translation) {
          console.log(translation)
          var params = {
            can_approve : res.locals.can_approve,
            translation : translation
          };

          app.render('translation', params, function(err, html) {
            htmlResult += html;
            almostReady();
          });
        });

        function allReady() { res.send(htmlResult); }
      });
    });
  });

  app.post('/:locale/translate', authenticate, function (req, res) {
    var isBaseLocale = req.params.locale === 'en';

    dialect.store.collection.update(
      {_id: ObjectID.createFromHexString(req.body.id)},
      {'$set': {
        translation: req.body.translation ? req.body.translation.trim() : null,
        locale: req.params.locale,
        approved: false
      }},
      {upsert: true},
      function() {
        isBaseLocale || onUpdateEnd();
        isBaseLocale && dialect.store.collection.update(
          {original: req.body.original},
          {'$set': {approved: false}},
          {multi: true},
          onUpdateEnd
        );
      }
    );

    function onUpdateEnd() {
      DIALECT_HTTP.io.emit('merge');
      res.writeHead(200);
      res.end('ok');
    }
  });

  app.post('/:locale/approve', authenticate, function (req, res) {
    if(res.locals.can_approve) {
      dialect.store.collection.update(
        {_id: ObjectID.createFromHexString(req.body.id)},
        {'$set': {approved: req.body.approved === 'true'}},
        {upsert: false},
        function () {
          res.writeHead(200);
          res.end('ok');
        }
      );
    }
    else {
      res.writeHead(403);
      res.end('you are not authorized to perform that operation');
    }
  });

  app.post('/:locale/delete', authenticate, function (req, res) {
    if(res.locals.can_approve) {
      dialect.store.collection.remove(
        {_id: ObjectID.createFromHexString(req.body.id)},
        function () {
          res.writeHead(200);
          res.end('ok');
        }
      );
    }
    else {
      res.writeHead(403);
      res.end('you are not authorized to perform that operation');
    }
  });

  function getExtendedTranslations(cursor, locale, onDone) {
    var isOriginalLanguage = locale === 'en';

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

};
