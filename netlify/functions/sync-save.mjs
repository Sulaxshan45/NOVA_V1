// netlify/functions/sync-save.mjs
// POST /api/sync/save — save user workspace to Netlify Blobs
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
    const body = await req.json();
    const store = getStore('nova-workspaces');
    await store.setJSON(`user_${user.id}`, body);
    return Response.json({ success: true });
  } catch (err) {
    console.error('Sync save error:', err);
    return Response.json({ error: 'Failed to save data' }, { status: 500 });
  }
};

export const config = { path: '/api/sync/save' };
