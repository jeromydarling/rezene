'use strict';

/**
 * Search — find a client by email, so a Zap can dedupe before creating
 * (pair with "Create Client" as a search-or-create).
 */
const base = (bundle) => (bundle.authData && bundle.authData.base_url) || 'https://verto.style';

const findClient = {
  key: 'find_client',
  noun: 'Client',
  display: { label: 'Find Client', description: 'Find a Verto client by email address.' },
  operation: {
    inputFields: [{ key: 'email', label: 'Email', required: true }],
    perform: async (z, bundle) => {
      const res = await z.request({
        url: `${base(bundle)}/api/v1/clients`,
        method: 'GET',
        params: { email: bundle.inputData.email },
      });
      return res.data || [];
    },
    sample: { id: 'client_abc123', name: 'Maya Okafor', email: 'maya@example.com', phone: null },
  },
};

module.exports = findClient;
