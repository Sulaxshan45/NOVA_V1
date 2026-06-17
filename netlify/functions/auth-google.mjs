// netlify/functions/auth-google.mjs
// GET /api/auth/google — redirect to Google OAuth

export default async (req, context) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.CALLBACK_URL;

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Google Auth Setup</title>
      <style>
        body { background:#0f0f1a;color:#e2e8f0;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0; }
        .card { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:32px;max-width:500px;text-align:center; }
        h2 { color:#8b5cf6; } code { background:#1e1e30;padding:4px 8px;border-radius:4px;color:#f43f5e; }
        p { color:#94a3b8;line-height:1.6; }
        a { background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border-radius:6px;padding:10px 24px;text-decoration:none;font-weight:600;display:inline-block;margin-top:16px; }
      </style></head>
      <body><div class="card">
        <h2>Google Auth Setup Needed</h2>
        <p>Set <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> in your Netlify environment variables.</p>
        <a href="/">Back to Login</a>
      </div></body></html>
    `, { status: 200, headers: { 'Content-Type': 'text/html' } });
  }

  const state = Math.random().toString(36).substring(2);
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=openid%20profile%20email` +
    `&state=${state}`;

  return Response.redirect(authUrl, 302);
};

export const config = { path: '/api/auth/google' };
