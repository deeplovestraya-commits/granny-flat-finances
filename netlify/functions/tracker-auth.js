exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  let password;
  try {
    password = JSON.parse(event.body).password;
  } catch {
    return { statusCode: 400 };
  }

  const adminPass = process.env.TRACKER_ADMIN_PASSWORD;
  const viewerPass = process.env.TRACKER_VIEWER_PASSWORD;

  if (password && adminPass && password === adminPass) {
    return { statusCode: 200, body: JSON.stringify({ role: 'admin' }) };
  }
  if (password && viewerPass && password === viewerPass) {
    return { statusCode: 200, body: JSON.stringify({ role: 'viewer' }) };
  }
  return { statusCode: 401, body: JSON.stringify({ error: 'Invalid password' }) };
};
