const { getStore } = require('@netlify/blobs');

const EMPTY = { version: '1.0', airbnb_imports: [], leases: [], expenses: [] };

exports.handler = async (event) => {
  let store;
  try {
    store = getStore({ name: 'tracker', consistency: 'strong' });
  } catch (err) {
    console.error('Failed to init Blobs store:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Blobs store init failed: ' + err.message })
    };
  }

  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get('records', { type: 'json' });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || EMPTY)
      };
    } catch (err) {
      console.error('GET error:', err);
      return { statusCode: 200, body: JSON.stringify(EMPTY) };
    }
  }

  if (event.httpMethod === 'POST') {
    const pass = event.headers['x-tracker-pass'];
    if (!pass) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing X-Tracker-Pass header' }) };
    }
    if (pass !== process.env.TRACKER_ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Password does not match TRACKER_ADMIN_PASSWORD env var' }) };
    }
    try {
      const body = JSON.parse(event.body);
      await store.setJSON('records', body);
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      console.error('POST error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405 };
};
