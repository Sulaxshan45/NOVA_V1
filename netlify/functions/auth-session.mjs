// netlify/functions/auth-session.mjs
// GET /api/auth/session — check if user cookie is valid
import { parseToken, signToken } from './lib/jwt.mjs';

export default async (req, context) => {
  const cookie = req.headers.get('cookie') || '';
  const token = getCookie(cookie, 'nova_session');
  if (!token) return Response.json({ loggedIn: false });

  const user = parseToken(token);
  if (!user) return Response.json({ loggedIn: false });

  return Response.json({ loggedIn: true, user });
};

function getCookie(cookieStr, name) {
  const match = cookieStr.split(';').find(c => c.trim().startsWith(name + '='));
  return match ? match.trim().slice(name.length + 1) : null;
}

export const config = { path: '/api/auth/session' };
