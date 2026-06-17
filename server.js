import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load config
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure database folder exists
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET || 'nova_civil_secret_123456',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running over HTTPS
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Serve static assets
app.use(express.static(__dirname));

// ============================================================
// AUTH ENDPOINTS
// ============================================================

// Check user session
app.get('/api/auth/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

// Guest Login
app.post('/api/auth/guest', (req, res) => {
  const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
  req.session.user = {
    id: guestId,
    name: 'Guest User',
    email: 'guest@nova-construction.com',
    picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
  };
  res.json({ success: true, user: req.session.user });
});


// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to log out' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Delete Account
app.post('/api/auth/delete-account', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const userId = req.session.user.id;
  const userFile = path.join(DATA_DIR, `user_${userId}.json`);

  try {
    // Delete user workspace data file if it exists
    if (fs.existsSync(userFile)) {
      fs.unlinkSync(userFile);
      console.log(`[Database Wiped] Deleted data file for user: ${userId}`);
    }

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to clear session' });
      }
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  } catch (err) {
    console.error('Delete Account Error:', err);
    res.status(500).json({ error: 'Failed to delete account data' });
  }
});


// Google OAuth Authorization Entrypoint
app.get('/auth/google', (req, res) => {
  const client_id = process.env.GOOGLE_CLIENT_ID;
  const redirect_uri = process.env.CALLBACK_URL;

  // Check if credentials are not configured
  if (!client_id || !process.env.GOOGLE_CLIENT_SECRET) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Google Authentication Configuration Required</title>
        <style>
          body {
            background-color: #0f0f1a;
            color: #e2e8f0;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 32px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
            backdrop-filter: blur(10px);
          }
          h2 { color: #8b5cf6; margin-top: 0; }
          code {
            background: #1e1e30;
            padding: 4px 8px;
            border-radius: 4px;
            color: #f43f5e;
            font-family: monospace;
          }
          p { line-height: 1.6; color: #94a3b8; }
          .btn {
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: white;
            border: none;
            padding: 10px 24px;
            border-radius: 6px;
            cursor: pointer;
            text-decoration: none;
            font-weight: 600;
            display: inline-block;
            margin-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Google Auth Setup Needed</h2>
          <p>The Google Client credentials are not configured yet.</p>
          <p>Please edit the <code>.env</code> file in your project folder to add: </p>
          <p><code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code></p>
          <p>Once set, restart your backend server to try again.</p>
          <a class="btn" href="/">Back to Login (Use Demo Sign In)</a>
        </div>
      </body>
      </html>
    `);
    return;
  }

  const state = Math.random().toString(36).substring(2);
  req.session.oauthState = state;

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(client_id)}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}` +
    `&response_type=code` +
    `&scope=openid%20profile%20email` +
    `&state=${state}`;

  res.redirect(authUrl);
});

// Google OAuth callback redirect
app.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?error=missing_code');
  }

  // State verification
  if (!state || state !== req.session.oauthState) {
    return res.redirect('/?error=invalid_state');
  }
  delete req.session.oauthState;

  try {
    // Exchange Auth Code for Tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.CALLBACK_URL,
        grant_type: 'authorization_code'
      }).toString()
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || tokens.error) {
      throw new Error(tokens.error_description || tokens.error || 'Failed to exchange token');
    }

    // Fetch user profile info
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });

    const profile = await profileRes.json();
    if (!profileRes.ok) {
      throw new Error('Failed to fetch user profile');
    }

    // Save profile to session
    req.session.user = {
      id: `google_${profile.sub}`,
      name: profile.name,
      email: profile.email,
      picture: profile.picture
    };

    res.redirect('/');
  } catch (err) {
    console.error('OAuth Callback Error:', err);
    res.redirect(`/?error=${encodeURIComponent(err.message)}`);
  }
});

// ============================================================
// DATA SYNC ENDPOINTS
// ============================================================

// Load user workspace
app.get('/api/sync/load', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const userId = req.session.user.id;
  const userFile = path.join(DATA_DIR, `user_${userId}.json`);

  if (fs.existsSync(userFile)) {
    try {
      const data = fs.readFileSync(userFile, 'utf8');
      return res.json(JSON.parse(data));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to read data file' });
    }
  } else {
    // New user workspace template
    return res.json({
      projects: [],
      tasks: [],
      materials: [],
      expenses: [],
      settings: {}
    });
  }
});

// Save user workspace
app.post('/api/sync/save', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const userId = req.session.user.id;
  const userFile = path.join(DATA_DIR, `user_${userId}.json`);

  try {
    const data = JSON.stringify(req.body, null, 2);
    fs.writeFileSync(userFile, data, 'utf8');
    return res.json({ success: true });
  } catch (err) {
    console.error('Save Sync Error:', err);
    return res.status(500).json({ error: 'Failed to write data file' });
  }
});

// Wildcard routing to catch any unhandled static pages (e.g. index.html)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`NOVA server is running at http://localhost:${PORT}`);
});
