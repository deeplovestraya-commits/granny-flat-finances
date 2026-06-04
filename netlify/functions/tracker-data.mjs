import { getStore } from '@netlify/blobs';

const EMPTY = { version: '1.0', airbnb_imports: [], leases: [], expenses: [] };

export default async (req) => {
  let store;
  try {
    store = getStore('tracker');
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Blobs init failed: ' + err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'GET') {
    try {
      const data = await store.get('records', { type: 'json' });
      return Response.json(data || EMPTY);
    } catch (err) {
      console.error('GET error:', err);
      return Response.json(EMPTY);
    }
  }

  if (req.method === 'POST') {
    const pass = req.headers.get('x-tracker-pass');
    if (!pass) {
      return new Response(
        JSON.stringify({ error: 'Missing X-Tracker-Pass header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pass !== process.env.TRACKER_ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: 'Password does not match TRACKER_ADMIN_PASSWORD' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    try {
      const body = await req.json();
      await store.setJSON('records', body);
      return Response.json({ ok: true });
    } catch (err) {
      console.error('POST error:', err);
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  return new Response('Method not allowed', { status: 405 });
};

export const config = { path: '/.netlify/functions/tracker-data' };
