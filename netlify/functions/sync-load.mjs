// netlify/functions/sync-load.mjs
// GET /api/sync/load — load user workspace from Netlify Blobs
import { parseToken } from './lib/jwt.mjs';
import { getStore } from '@netlify/blobs';

function getCookie(cookieStr, name) {
  const match = (cookieStr || '').split(';').find(c => c.trim().startsWith(name + '='));
  return match ? match.trim().slice(name.length + 1) : null;
}

const EMPTY_WORKSPACE = {
  projects: [],
  tasks: [],
  materials: [],
  expenses: [],
  settings: {}
};

export default async (req, context) => {
  const token = getCookie(req.headers.get('cookie') || '', 'nova_session');
  const user = token ? parseToken(token) : null;
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const store = getStore('nova-workspaces');
    const data = await store.get(`user_${user.id}`, { type: 'json' });
    return Response.json(data || EMPTY_WORKSPACE);
  } catch (err) {
    return Response.json(EMPTY_WORKSPACE);
  }
};

export const config = { path: '/api/sync/load' };
