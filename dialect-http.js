module.exports = {
  title: 'My app',
  users: [
    { username: 'foo',
      password: 'bar'
    },
    { username: 'joao',
      password: 'gilberto',
      locales: ['pt'],
      can_approve: false
    }
  ],

  port: 3001,

  dialect: {
    filters: {
      'editor': {
        name: 'Editor filter',
        url:'editor',
        search_term: [
           '(^editor)+([\\.+\\w]+)'
        ]
      },
      'mails': {
        name: 'Mails filter',
        url:'mails',
        search_term: [
           '(^mails)+([\\.+\\w]+)',
           '(mails)+([\\.+\\w]+)'
        ]
      },
      'another': {
        name: 'Another filter',
        url:'another',
        search_term: [
           '(^another)+([\\.+\\w]+)',
           '(another)+([\\.+\\w]+)'
        ]
      }
    },
    locales: ['en', 'fr', 'es'],
    store: {
      mongodb: {
        collection: 'my_translations'
      }
    },

  }
}