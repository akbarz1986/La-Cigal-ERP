// Vercel Serverless Function
// Handles POST /api/request
// Proxies requests to the Google Apps Script backend (avoids CORS issues
// and keeps the deployment URL logic identical to the local Express server).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  }

  try {
    const { action, payload, user, gasUrl } = req.body || {};

    if (!gasUrl) {
      return res.status(400).json({ status: 'error', message: 'Missing gasUrl parameter' });
    }

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, payload, user })
    });

    const text = await response.text();

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);
    } catch (parseErr) {
      // Try to extract a clean error message from Google Apps Script HTML error pages
      let cleanError = text;
      if (text.trim().startsWith('<')) {
        const errorMatch =
          text.match(/class=["']errorMessage["'][^>]*>([^<]+)/i) ||
          text.match(/id=["']error-message["'][^>]*>([^<]+)/i);
        if (errorMatch && errorMatch[1]) {
          cleanError = errorMatch[1].trim();
        } else {
          const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : 'Google Apps Script Error';
          const bodyText = text
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          cleanError = `${title}: ${bodyText.slice(0, 150)}...`;
        }
      }
      return res.status(500).json({ status: 'error', message: `Google Apps Script Error: ${cleanError}` });
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({ status: 'error', message: `Proxy Error: ${error.message}` });
  }
}
