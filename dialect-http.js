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
    filters: [
      { id: 'editor',
        name: 'Editor filter',
        search_term: [
          'editor', // put a Regexp
          'editor.things.thing'
        ]
      },
      { id: 'mails',
        name: 'Mails filter',
        search_term: [
          'mails', // put a Regexp
          'mails.things.thing'
        ]
      },
      { id: 'another',
        name: 'Another filter',
        search_term: [
          'what', // put a Regexp
          'what.what.what'
        ]
      }
    ],
    locales: ['en', 'fr'],
    store: {
      mongodb: {
        collection: 'my_translations'
      }
    },

  }
}