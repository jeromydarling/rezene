'use strict';

/**
 * REST-Hook triggers. Each Verto event becomes a Zapier trigger that:
 *  - performSubscribe: registers this Zap's target URL for the event
 *  - performUnsubscribe: removes it when the Zap is turned off
 *  - perform: returns the payload Verto pushed (instant)
 *  - performList: polls recent events so Zapier has sample data at setup
 *
 * One factory builds them all — every Verto event on the developer API's
 * trigger catalog (mirrors src/shared/workflows.ts WORKFLOW_TRIGGERS).
 */

const base = (bundle) => (bundle.authData && bundle.authData.base_url) || 'https://verto.style';

const subscribeHook = (event) => async (z, bundle) => {
  const res = await z.request({
    url: `${base(bundle)}/api/v1/subscriptions`,
    method: 'POST',
    body: { event, targetUrl: bundle.targetUrl },
  });
  return res.data; // { id, event, secret }
};

const unsubscribeHook = () => async (z, bundle) => {
  const id = bundle.subscribeData && bundle.subscribeData.id;
  if (!id) return {};
  await z.request({ url: `${base(bundle)}/api/v1/subscriptions/${id}`, method: 'DELETE' });
  return {};
};

// Instant: the payload Verto POSTed to the target URL.
const perform = () => (z, bundle) => [bundle.cleanedRequest];

// Polling fallback for sample data at setup / test time.
const performList = (event) => async (z, bundle) => {
  const res = await z.request({
    url: `${base(bundle)}/api/v1/events`,
    method: 'GET',
    params: { event, limit: 3 },
  });
  return (res.data || []).map((e) => ({
    id: e.id,
    event: e.event,
    title: e.title,
    payload: e.payload,
    at: e.createdAt,
  }));
};

const sampleFor = (event) => ({
  id: '9f1c2b3a-0000-0000-0000-000000000000',
  event,
  title: 'A human-readable summary of what happened',
  payload: { name: 'Maya Okafor' },
  at: '2026-07-13T12:00:00.000Z',
});

// The catalog — keep in sync with WORKFLOW_TRIGGERS in the Verto repo.
const EVENTS = [
  { key: 'new_client', event: 'client.created', noun: 'Client', label: 'New Client', desc: 'Fires when a client is added to the Client Book.' },
  { key: 'commission_stage_changed', event: 'commission.stage_changed', noun: 'Commission', label: 'Commission Stage Changed', desc: 'Fires when a commission moves to a new stage.' },
  { key: 'payment_received', event: 'deposit.paid', noun: 'Payment', label: 'Payment Received', desc: 'Fires when a deposit or milestone payment is marked paid.' },
  { key: 'product_published', event: 'product.published', noun: 'Product', label: 'Product Published', desc: 'Fires when a product is published.' },
  { key: 'low_stock', event: 'inventory.low', noun: 'Product', label: 'Product Low on Stock', desc: 'Fires when a product runs low.' },
  { key: 'back_in_stock', event: 'inventory.restocked', noun: 'Product', label: 'Product Restocked', desc: 'Fires when a sold-out product is restocked.' },
  { key: 'sold_out', event: 'inventory.sold_out', noun: 'Product', label: 'Product Sold Out', desc: 'Fires when a product sells out.' },
  { key: 'new_review', event: 'review.created', noun: 'Review', label: 'New Review', desc: 'Fires when a customer leaves a review.' },
  { key: 'trend_adopted', event: 'research.trend_adopted', noun: 'Trend', label: 'Trend Adopted', desc: 'Fires when a trend is adopted into the studio.' },
  { key: 'sample_approved', event: 'sample.approved', noun: 'Sample', label: 'Sample Approved', desc: 'Fires when a sample is approved.' },
  { key: 'inbound_received', event: 'inbound.received', noun: 'Inbound', label: 'Inbound Webhook Received', desc: 'Fires when something arrives via an inbound webhook.' },
];

const triggers = {};
for (const e of EVENTS) {
  triggers[e.key] = {
    key: e.key,
    noun: e.noun,
    display: { label: e.label, description: e.desc },
    operation: {
      type: 'hook',
      performSubscribe: subscribeHook(e.event),
      performUnsubscribe: unsubscribeHook(),
      perform: perform(),
      performList: performList(e.event),
      sample: sampleFor(e.event),
    },
  };
}

module.exports = triggers;
