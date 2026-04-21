const https = require('https');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { word, def, sentence } = JSON.parse(event.body || '{}');
  if (!word || !def || !sentence) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  const prompt = `The user is learning the word "${word}" which means "${def}". They wrote this sentence: "${sentence}". Did they use the word correctly? Reply in 2-3 sentences max — start with Yes or No, then briefly explain why. Be encouraging and specific.`;

  const payload = JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] });

  const geminiRes = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });

  const data = JSON.parse(geminiRes);
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, no response received.';

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  };
};
