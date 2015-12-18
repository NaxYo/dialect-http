var utils = require('../utils');

module.exports = function (DIALECT_HTTP) {
  var dialect = DIALECT_HTTP.dialect;

  return {
    flash: function (req, res) {
      return function () {
        return req.flash();
      };
    },

    can_approve: function (req, res) {
      return req.user && (req.user.can_approve === undefined || req.user.can_approve);
    },

    authorized_locales: function (req, res) {
      var locales = dialect.config('locales');

      return req.user ? (
          req.user.locales !== undefined
            ? utils.intersect(req.user.locales, locales)
            : locales
        ) : [];
    }
  }
};
