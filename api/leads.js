// GET /api/leads — view stored leads (only if KV is configured)
// If using Google Sheets, view directly in the Sheet (recommended).
export default async function handler(req, res) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(200).json({
      ok: true,
      count: 0,
      note: 'KV not configured. If you set GOOGLE_SHEET_URL, view leads in your Google Sheet. Vercel logs also show LANI_LEAD entries.',
      leads: [],
    });
  }
  try {
    const r = await fetch(`${process.env.KV_REST_API_URL}/lrange/lani_leads/0/-1`, {
      headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
    });
    const j = await r.json();
    const leads = (j.result || []).map(s => { try { return JSON.parse(s); } catch { return { raw: s }; }}).reverse();
    return res.status(200).json({ ok: true, count: leads.length, leads });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
