// netlify/functions/auth-google-callback.mjs
// GET /auth/google/callback — Google OAuth callback, set cookie session
import { signToken } from './lib/jwt.mjs';

export default async (req, context) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  if (error || !code) {
    return Response.redirect(`/?error=${encodeURIComponent(error || 'missing_code')}`, 302);
  }

  try {
    // Exchange code for tokens
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
    if (!tokenRes.ok || tokens.error) throw new Error(tokens.error_description || 'Token exchange failed');

    // Fetch user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const profile = await profileRes.json();

    const user = {
      id: `google_${profile.sub}`,
      name: profile.name,
      email: profile.email,
      picture: profile.picture,
      exp: Date.now() + 30 * 24 * 60 * 60 * 1000
    };

    const token = await signToken(user);

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `nova_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
      }
    });
  } catch (err) {
    return Response.redirect(`/?error=${encodeURIComponent(err.message)}`, 302);
  }
};

export const config = { path: '/auth/google/callback' };
