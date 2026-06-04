import Anthropic from '@anthropic-ai/sdk';

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const pass = req.headers.get('x-tracker-pass');
  if (!pass || pass !== process.env.TRACKER_ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: 'Unauthorised' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body;
  try { body = await req.json(); } catch {
    return new Response('Bad request', { status: 400 });
  }

  const { data, mediaType } = body;
  if (!data || !mediaType) {
    return new Response(JSON.stringify({ error: 'Missing data or mediaType' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const client = new Anthropic();
  const prompt = 'Extract from this invoice or receipt: ' +
    '1) the date in ISO format YYYY-MM-DD, ' +
    '2) the total amount payable in AUD as a number (no currency symbol), ' +
    '3) the vendor or business name. ' +
    'Reply with JSON only, no explanation: {"date":"YYYY-MM-DD","amount":0.00,"vendor":"..."}';

  let contentBlock;
  if (mediaType.startsWith('image/')) {
    contentBlock = [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data } },
      { type: 'text', text: prompt }
    ];
  } else if (mediaType === 'application/pdf') {
    contentBlock = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } },
      { type: 'text', text: prompt }
    ];
  } else {
    return new Response(JSON.stringify({ error: 'Unsupported file type' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
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
    return Response.json(JSON.parse(match[0]));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/.netlify/functions/parse-document' };
