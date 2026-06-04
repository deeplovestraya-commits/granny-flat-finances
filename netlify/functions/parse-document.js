const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const pass = event.headers['x-tracker-pass'];
  if (!pass || pass !== process.env.TRACKER_ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) };
  }

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400 }; }

  const { data, mediaType } = body;
  if (!data || !mediaType) return { statusCode: 400, body: JSON.stringify({ error: 'Missing data or mediaType' }) };

  const client = new Anthropic();

  const prompt = 'Extract from this invoice or receipt: ' +
    '1) the date in ISO format YYYY-MM-DD, ' +
    '2) the total amount payable in AUD as a number (no currency symbol), ' +
    '3) the vendor or business name. ' +
    'Reply with JSON only, no explanation: {"date":"YYYY-MM-DD","amount":0.00,"vendor":"..."}';

  const isImage = mediaType.startsWith('image/');
  const isPDF = mediaType === 'application/pdf';

  let contentBlock;
  if (isImage) {
    contentBlock = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: prompt }
    ];
  } else if (isPDF) {
    contentBlock = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
      { type: 'text', text: prompt }
    ];
  } else {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported file type' }) };
  }

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: contentBlock }]
    });

    const text = message.content[0].text;
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');
    const parsed = JSON.parse(match[0]);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
