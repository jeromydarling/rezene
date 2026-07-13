'use strict';

/**
 * Actions (Zapier "creates") — feed records INTO Verto over the developer API.
 * These mirror the inbound-webhook payloads, but authenticated with the bearer
 * token instead of a URL token.
 */

const base = (bundle) => (bundle.authData && bundle.authData.base_url) || 'https://verto.style';

const createClient = {
  key: 'create_client',
  noun: 'Client',
  display: { label: 'Create Client', description: 'Add a client to the Verto Client Book.' },
  operation: {
    inputFields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'note', label: 'Style notes', type: 'text', required: false },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/api/v1/clients`,
        method: 'POST',
        body: bundle.inputData,
      });
      return res.data;
    },
    sample: { ok: true, id: 'client_abc123' },
  },
};

const createBooking = {
  key: 'create_booking',
  noun: 'Booking',
  display: { label: 'Create Consult Booking', description: 'Record a consult request in Verto.' },
  operation: {
    inputFields: [
      { key: 'name', label: 'Name', required: true },
      { key: 'email', label: 'Email', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'preferredAt', label: 'Preferred time', required: false },
      { key: 'note', label: 'Note', type: 'text', required: false },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/api/v1/bookings`,
        method: 'POST',
        body: bundle.inputData,
      });
      return res.data;
    },
    sample: { ok: true, id: 'book_abc123' },
  },
};

const createNote = {
  key: 'create_note',
  noun: 'Note',
  display: {
    label: 'Create Note',
    description: "File a note in Verto's activity feed — optionally on a client's timeline by matching email.",
  },
  operation: {
    inputFields: [
      { key: 'subject', label: 'Subject', required: false },
      { key: 'body', label: 'Body', type: 'text', required: false },
      { key: 'clientEmail', label: 'Client email (optional — routes it to their timeline)', required: false },
    ],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/api/v1/notes`,
        method: 'POST',
        body: bundle.inputData,
      });
      return res.data;
    },
    sample: { ok: true, clientId: 'client_abc123' },
  },
};

module.exports = { createClient, createBooking, createNote };
