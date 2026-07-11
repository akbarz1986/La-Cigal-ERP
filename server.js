import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Proxy endpoint to forward Google Apps Script requests
app.post('/api/request', async (req, res) => {
  try {
    const { action, payload, user, gasUrl } = req.body;
    
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
      res.json(data);
    } catch (e) {
      // Try to extract a clean error message from Google Apps Script HTML error pages
      let cleanError = text;
      if (text.trim().startsWith('<')) {
        const errorMatch = text.match(/class=["']errorMessage["'][^>]*>([^<]+)/i) || 
                           text.match(/id=["']error-message["'][^>]*>([^<]+)/i);
        if (errorMatch && errorMatch[1]) {
          cleanError = errorMatch[1].trim();
        } else {
          const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
          const title = titleMatch ? titleMatch[1].trim() : "Google Apps Script Error";
          const bodyText = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                               .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                               .replace(/<[^>]+>/g, ' ')
                               .replace(/\s+/g, ' ')
                               .trim();
          cleanError = `${title}: ${bodyText.slice(0, 150)}...`;
        }
      }
      res.status(500).json({ status: 'error', message: `Google Apps Script Error: ${cleanError}` });
    }
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ status: 'error', message: `Proxy Error: ${error.message}` });
  }
});

// Fallback to index.html for SPA if needed (but this is simple static)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
