const express = require('express');
const fs = require('fs');
const path = require('path');
const DOMPurify = require('isomorphic-dompurify');

const app = express();
const PORT = process.env.PORT || 9090;

const STATE_FILE = path.join(__dirname, 'state.json');

// Initialize state file if it doesn't exist
if (!fs.existsSync(STATE_FILE)) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ state: 'MAKE_VULNERABLE' }, null, 2));
}

// Middleware
app.use(express.static('public'));

// Get current state
function getState() {
  const data = fs.readFileSync(STATE_FILE, 'utf8');
  return JSON.parse(data).state;
}

// Update state
function setState(newState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ state: newState }, null, 2));
}

// Process query based on vulnerability state
function processQuery(query, state) {
  switch (state) {
    case 'MAKE_VULNERABLE':
      // Return unsanitized - XSS vulnerable
      return query;

    case 'FIX_COMPLETELY':
      // Use DOMPurify to completely sanitize
      return DOMPurify.sanitize(query, { ALLOWED_TAGS: [] });

    case 'FIX_PARTIALLY':
      // Sanitize but allow <script> tags (incomplete fix)
      // Remove all HTML tags except <script>
      let partial = query;
      // Remove all tags except script tags
      partial = partial.replace(/<(?!script\b)[^>]*>/gi, (match) => {
        // Keep script-related tags
        if (match.toLowerCase().includes('script')) {
          return match;
        }
        return ''; // Remove other tags
      });
      return partial;

    default:
      return query;
  }
}

// Helper to encode state to number (0, 1, 2)
function encodeState(state) {
  const stateMap = {
    'MAKE_VULNERABLE': '2',
    'FIX_PARTIALLY': '1',
    'FIX_COMPLETELY': '0'
  };
  return stateMap[state] || '2';
}

// Helper to decode number to state
function decodeState(num) {
  const stateMap = { '0': 'FIX_COMPLETELY', '1': 'FIX_PARTIALLY', '2': 'MAKE_VULNERABLE' };
  return stateMap[String(num)];
}

// GET /search - Main search endpoint
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  const currentState = getState();
  const processed = processQuery(query, currentState);

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Search Result</title>
    </head>
    <body>
      <h1>Search Results</h1>
      <p><strong>Query:</strong> ${escapeHtml(query)}</p>
      <p><strong>Result:</strong><br>${processed}</p>
      <p><a href="/">← Back to Home</a></p>
    </body>
    </html>
  `);
});

// Helper to escape HTML for display
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// GET /get-abc — returns current state as a number (0, 1, or 2)
app.get('/get-abc', (req, res) => {
  res.send(encodeState(getState()));
});

// GET /set-abc/0 or /set-abc/1 or /set-abc/2 — sets state and returns the number
app.get('/set-abc/:num', (req, res) => {
  const state = decodeState(req.params.num);
  if (!state) {
    return res.status(400).send('Invalid state; use 0, 1, or 2');
  }
  setState(state);
  res.send(req.params.num);
});

app.listen(PORT, () => {
  console.log(`XSS Vulnerability Demo App running on http://localhost:${PORT}`);
});
