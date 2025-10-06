import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import NextCors from 'nextjs-cors';

// Temporary rate limiter using memory (reset on server restart)
const ipRateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 5; // max submissions per IP
const TIME_WINDOW = 1000 * 60 * 60; // 1 hour

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS setup: allow specific origins (add your frontend and 3rd party URLs)
  await NextCors(req, res, {
    origin: [
      'https://blu-dbqh.onrender.com',
      'http://localhost:5173',
    ],
    methods: ['POST'],
    credentials: true,
  });
  //  res.setHeader('Access-Control-Allow-Credentials', 'true');
  // res.setHeader('Access-Control-Allow-Origin', '*'); // change to partner domain
  // res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  // res.setHeader(
  //   'Access-Control-Allow-Headers',
  //   'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  // );
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') as string;

  // 🛡️ Rate limit basic logic (per IP in memory)
  const now = Date.now();
  const record = ipRateLimitMap.get(ip) || { count: 0, timestamp: now };
  if (now - record.timestamp < TIME_WINDOW) {
    if (record.count >= RATE_LIMIT) {
      return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    }
    record.count++;
  } else {
    record.count = 1;
    record.timestamp = now;
  }
  ipRateLimitMap.set(ip, record);

  // 📥 Extract + validate inputs
  const { name, email='', phone } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  if (email && typeof email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format.' });
    }
  }

  try {
    // 🔎 Check for duplicate
    const { data: existing } = await supabase
      .from('attendees')
      .select('id')
      .eq('email', email || '')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'RSVP already submitted for this email.' });
    }

    // ✅ Insert new attendee
    const { data, error } = await supabase
      .from('attendees')
      .insert([{ name, email, phone }])
      .select()
      .single();

    if (error) throw error;

    // 📝 Optional: Log submission (if you have a logs table)
    await supabase.from('rsvp_logs').insert([
      {
        email,
        name,
        ip_address: ip,
        created_at: new Date().toISOString(),
      },
    ]);

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('[RSVP ERROR]', err);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
}