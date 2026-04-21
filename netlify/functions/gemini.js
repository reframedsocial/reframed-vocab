const https = require('https');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let word, def, sentence;
  try {
    ({ word, def, sentence } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!word || !def || !sentence) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields: word, def, sentence required' }) };
  }

  const apiKey = process.env.GEMINI_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_KEY environment variable not set' }) };
  }

  const prompt = `The user is learning the word "${word}" which means "${def}". They wrote this sentence: "${sentence}". Did they use the word correctly? Reply in 2-3 sentences max — start with Yes or No, then briefly explain why. Be encouraging and specific.`;

  const payload = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }]
  });

  try {
    const { statusCode: geminiStatus, body: geminiBody } = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ statusCode: res.statusCode, body: d }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (geminiStatus !== 200) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Gemini returned ${geminiStatus}`, detail: geminiBody })
      };
    }

    const data = JSON.parse(geminiBody);
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No text in Gemini response', detail: geminiBody }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
