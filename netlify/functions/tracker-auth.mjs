export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let password;
  try {
    ({ password } = await req.json());
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const adminPass = process.env.TRACKER_ADMIN_PASSWORD;
  const viewerPass = process.env.TRACKER_VIEWER_PASSWORD;

  if (password && adminPass && password === adminPass) {
    return Response.json({ role: 'admin' });
  }
  if (password && viewerPass && password === viewerPass) {
    return Response.json({ role: 'viewer' });
  }
  return new Response(JSON.stringify({ error: 'Invalid password' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const config = { path: '/.netlify/functions/tracker-auth' };
