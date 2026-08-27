// Vercel Serverless — POST /api/submit
// Stores centrally (not visitor localStorage). Uses env var or hardcoded Sheet URL.
// Your Sheet: https://script.google.com/macros/s/AKfycbydhZb7fT-3qL6ePIl7uXYOvo_pDnpR4GfnPEdehYk5brkvy6BEhyTHeU4IWOYuDHcH/exec
const SHEET_URL = process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbydhZb7fT-3qL6ePIl7uXYOvo_pDnpR4GfnPEdehYk5brkvy6BEhyTHeU4IWOYuDHcH/exec';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  // Simple in-memory rate limit (per lambda instance)
  // For production use Vercel KV for distributed limit
  global._hits = global._hits || new Map();
  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const hits = (global._hits.get(ip) || []).filter(t => now - t < 60000);
  if (hits.length >= 5) return res.status(429).json({ ok: false, error: 'Too many submissions, please wait a minute' });
  hits.push(now); global._hits.set(ip, hits);

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const name = (body.name || '').trim();
  const email = (body.email || '').trim();
  const help = (body.help || '').trim();
  const source = (body.source || 'GRID01-flyer').trim();
  const website = (body.website || '').trim(); // honeypot
  const timestamp = body.timestamp || new Date().toISOString();
  const page = body.page || req.headers.referer || '';
  const ua = body.userAgent || req.headers['user-agent'] || '';

  if (website) return res.status(200).json({ ok: true }); // bot
  if (name.length < 2) return res.status(400).json({ ok: false, error: 'Name required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ ok: false, error: 'Valid email required' });
  if (help.length < 10) return res.status(400).json({ ok: false, error: 'Please tell us how we can help (min 10 chars)' });

  const payload = { timestamp, name, email, help, source, page, ua, ip };

  const errors = [];

  // 1) Google Sheet (primary) — writes to your Sheet
  if (SHEET_URL) {
    try {
      const r = await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok && r.status !== 302) throw new Error('Sheet returned ' + r.status);
    } catch (e) { errors.push('Sheet: ' + e.message); }
  }

  // 2) KV / Upstash (if enabled) — persistent on Vercel
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      await fetch(`${process.env.KV_REST_API_URL}/lpush/lani_leads/${encodeURIComponent(JSON.stringify(payload))}`, {
        headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
      });
    } catch (e) { errors.push('KV: ' + e.message); }
  }

  // 3) Email via Resend (optional)
  if (process.env.RESEND_API_KEY && process.env.RESEND_TO) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'LANI Leads <no-reply@vercel.lani>',
          to: process.env.RESEND_TO,
          subject: `New GRID 01 lead: ${name} — ${source}`,
          html: `<p><b>Name:</b> ${name}<br><b>Email:</b> ${email}<br><b>Help:</b> ${help}<br><b>Source:</b> ${source}<br><b>Time:</b> ${timestamp}</p>`,
        }),
      });
    } catch (e) { errors.push('Email: ' + e.message); }
  }

  // Fallback log if Sheet not reachable — still visible in Vercel Logs
  if (!SHEET_URL && !process.env.KV_REST_API_URL && !process.env.RESEND_API_KEY) {
    console.log('LANI_LEAD', JSON.stringify(payload));
    return res.status(200).json({ ok: true, warning: 'Lead only in Vercel logs.' });
  }

  if (errors.length) console.warn('Lead partial fail:', errors, payload);

  return res.status(200).json({ ok: true });
}
