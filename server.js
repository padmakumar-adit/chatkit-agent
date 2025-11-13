
import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import cookieSession from 'cookie-session';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'dev-secret'],
  maxAge: 24 * 60 * 60 * 1000
}));

app.use(express.static(path.join(process.cwd(), 'public')));

app.get('/api/session', async (req, res) => {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) return res.status(500).json({ error: 'Server not configured.' });

    const openaiResp = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        agent: process.env.AGENT_ID
      })
    });

    if (!openaiResp.ok) {
      const txt = await openaiResp.text();
      return res.status(500).json({ error: 'OpenAI error', txt });
    }
    const body = await openaiResp.json();

    res.json({
      session_token: body.session_token || body.client_secret || null,
      agent_id: process.env.AGENT_ID
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

app.listen(PORT, () => console.log('Server listening on port', PORT));
