const { getStore } = require('@netlify/blobs');

const EMPTY = { version: '1.0', airbnb_imports: [], leases: [], expenses: [] };

exports.handler = async (event) => {
  const store = getStore('tracker');

  if (event.httpMethod === 'GET') {
    try {
      const data = await store.get('records', { type: 'json' });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data || EMPTY)
      };
    } catch {
      return { statusCode: 200, body: JSON.stringify(EMPTY) };
    }
  }

  if (event.httpMethod === 'POST') {
    const pass = event.headers['x-tracker-pass'];
    if (!pass || pass !== process.env.TRACKER_ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
    }
    try {
      const body = JSON.parse(event.body);
      await store.set('records', JSON.stringify(body));
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405 };
};
