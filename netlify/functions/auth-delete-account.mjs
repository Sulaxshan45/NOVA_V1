// netlify/functions/auth-delete-account.mjs
// POST /api/auth/delete-account — wipe user data and clear session cookie
import { parseToken } from './lib/jwt.mjs';
import { getStore } from '@netlify/blobs';

function getCookie(cookieStr, name) {
  const match = (cookieStr || '').split(';').find(c => c.trim().startsWith(name + '='));
  return match ? match.trim().slice(name.length + 1) : null;
}

export default async (req, context) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const token = getCookie(req.headers.get('cookie') || '', 'nova_session');
  const user = token ? parseToken(token) : null;
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const store = getStore('nova-workspaces');
    await store.delete(`user_${user.id}`);
  } catch (e) {
    // Ignore if not found
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'nova_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
    }
  });
};

export const config = { path: '/api/auth/delete-account' };
