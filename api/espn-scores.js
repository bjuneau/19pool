// ESPN scoreboard proxy — avoids CORS restrictions when called from the browser.
// Usage: GET /api/espn-scores?season=2026&week=1
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { season, week } = req.query;

  if (!season || !week) {
    return res.status(400).json({ error: 'season and week query params are required.' });
  }

  const numSeason = Number(season);
  const numWeek = Number(week);
  if (!Number.isFinite(numSeason) || !Number.isFinite(numWeek) || numWeek < 1 || numWeek > 18) {
    return res.status(400).json({ error: 'Invalid season or week value.' });
  }

  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${numSeason}&seasontype=2&week=${numWeek}`;

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; 19Pool/1.0)' },
    });
    if (!r.ok) {
      return res.status(r.status).json({ error: `ESPN responded with status ${r.status}` });
    }
    const data = await r.json();
    // Cache: 30 s for live data, 1 h for settled (CDN layer).
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch from ESPN' });
  }
}
