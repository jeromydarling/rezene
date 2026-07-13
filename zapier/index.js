'use strict';

const { version } = require('./package.json');
const platformVersion = require('zapier-platform-core').version;

const { authentication, includeBearer, handleAuthError } = require('./authentication');
const triggers = require('./triggers/hooks');
const { createClient, createBooking, createNote } = require('./creates');
const findClient = require('./searches/find_client');

const App = {
  version,
  platformVersion,

  authentication,
  beforeRequest: [includeBearer],
  afterResponse: [handleAuthError],

  triggers,

  creates: {
    [createClient.key]: createClient,
    [createBooking.key]: createBooking,
    [createNote.key]: createNote,
  },

  searches: {
    [findClient.key]: findClient,
  },
};

module.exports = App;
