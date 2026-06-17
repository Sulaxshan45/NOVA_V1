// netlify/functions/auth-guest.mjs
// POST /api/auth/guest — guest login, sets a signed cookie session
import { signToken } from './lib/jwt.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const guestId = `guest_${Math.random().toString(36).substring(2, 11)}`;
  const user = {
    id: guestId,
    name: 'Guest User',
    email: 'guest@nova-construction.com',
    picture: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80',
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  const token = await signToken(user);

  return new Response(JSON.stringify({ success: true, user }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `nova_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`
    }
  });
};

export const config = { path: '/api/auth/guest' };
