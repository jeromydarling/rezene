'use strict';

/**
 * Structural smoke tests — no network. Confirms the app is wired up (auth,
 * triggers, creates, search all present and shaped right) so an obviously
 * broken package is caught before `zapier push`. Full end-to-end verification
 * needs `zapier test` with a live PAT (see README).
 */
require('should');
const App = require('../index');

describe('verto zapier app', () => {
  it('declares custom auth with a /me test and a shop connection label', () => {
    App.authentication.type.should.eql('custom');
    App.authentication.test.url.should.match(/\/api\/v1\/me$/);
    App.authentication.connectionLabel.should.containEql('shop');
    App.authentication.fields.map((f) => f.key).should.containEql('api_key');
  });

  it('injects the bearer token before each request', () => {
    App.beforeRequest.length.should.be.above(0);
    const req = App.beforeRequest[0]({ headers: {} }, {}, { authData: { api_key: 'vrto_x_y.z' } });
    req.headers.Authorization.should.eql('Bearer vrto_x_y.z');
  });

  it('exposes REST-hook triggers with subscribe/unsubscribe/perform/performList', () => {
    const keys = Object.keys(App.triggers);
    keys.should.containEql('new_client');
    keys.should.containEql('payment_received');
    for (const key of keys) {
      const op = App.triggers[key].operation;
      op.type.should.eql('hook');
      op.performSubscribe.should.be.a.Function();
      op.performUnsubscribe.should.be.a.Function();
      op.perform.should.be.a.Function();
      op.performList.should.be.a.Function();
    }
  });

  it('exposes create actions and a client search', () => {
    Object.keys(App.creates).should.containEql('create_client');
    Object.keys(App.creates).should.containEql('create_note');
    Object.keys(App.searches).should.containEql('find_client');
  });
});
