const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_REPO_OWNER;
const REPO = process.env.GITHUB_REPO_NAME;
const FILE_PATH = 'data/records.json';

const headers = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'granny-flat-finances'
};

const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    try {
      const res = await fetch(apiUrl, { headers });
      if (res.status === 404) {
        return { statusCode: 200, body: JSON.stringify({ version: '1.0', airbnb_imports: [], leases: [], expenses: [] }) };
      }
      const data = await res.json();
      const content = JSON.parse(Buffer.from(data.content, 'base64').toString('utf-8'));
      return { statusCode: 200, body: JSON.stringify(content) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (event.httpMethod === 'POST') {
    const pass = event.headers['x-tracker-pass'];
    if (!pass || pass !== process.env.TRACKER_ADMIN_PASSWORD) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    let newData;
    try {
      newData = JSON.parse(event.body);
    } catch {
      return { statusCode: 400 };
    }

    // Get current SHA if file exists
    let sha;
    try {
      const res = await fetch(apiUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        sha = data.sha;
      }
    } catch {}

    const body = {
      message: 'Update tracker records',
      content: Buffer.from(JSON.stringify(newData, null, 2)).toString('base64'),
      ...(sha && { sha })
    };

    try {
      const res = await fetch(apiUrl, {
        method: 'PUT',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.text();
        return { statusCode: 500, body: JSON.stringify({ error: err }) };
      }
      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } catch (err) {
      return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 405 };
};
