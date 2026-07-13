'use strict';

/**
 * Custom (API-key) auth. The user pastes a Verto personal access token, minted
 * in Verto under Account → Settings → API keys. The token embeds the shop, so
 * the same base URL serves every shop; the test call hits /api/v1/me and the
 * connection is labelled with the shop's name.
 */
const authentication = {
  type: 'custom',
  fields: [
    {
      key: 'api_key',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText:
        'Your Verto personal access token. Create one in Verto under **Account → Settings → API keys** — it starts with `vrto_` and is shown only once.',
    },
    {
      key: 'base_url',
      label: 'Verto address',
      type: 'string',
      required: false,
      default: 'https://verto.style',
      helpText: 'Leave as-is unless your Verto runs on a different host.',
    },
  ],
  // Verify the key and label the connection with the shop name. connectionLabel
  // only reads TOP-LEVEL fields of the test response, so the test flattens the
  // nested shop.name into a top-level `shopName`.
  test: async (z, bundle) => {
    const baseUrl = (bundle.authData && bundle.authData.base_url) || 'https://verto.style';
    const res = await z.request({ url: `${baseUrl}/api/v1/me`, method: 'GET' });
    const data = res.data || {};
    return { ...data, shopName: (data.shop && data.shop.name) || 'Verto' };
  },
  connectionLabel: '{{json.shopName}}',
};

// Inject the bearer token on every request.
const includeBearer = (request, z, bundle) => {
  if (bundle.authData && bundle.authData.api_key) {
    request.headers = request.headers || {};
    request.headers.Authorization = `Bearer ${bundle.authData.api_key}`;
  }
  return request;
};

// Turn Verto's 401 into a clean Zapier auth error so the user is asked to reconnect.
const handleAuthError = (response, z) => {
  if (response.status === 401) {
    throw new z.errors.RefreshAuthError('Your Verto API key is invalid or was revoked.');
  }
  return response;
};

module.exports = { authentication, includeBearer, handleAuthError };
