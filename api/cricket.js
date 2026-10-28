export default async function handler(req, res) {
  const type = String(req.query?.type || "live").toLowerCase();
  const allowed = {
    live: "live",
    upcoming: "upcoming",
    recent: "recent",
    schedule: "schedule"
  };
  if (!allowed[type]) {
    res.status(400).json({ ok: false, error: "Unknown cricket data type" });
    return;
  }
  const url = "https://cricketliveapi.com/api/v1/cricket/" + allowed[type];
  try {
    const headers = { Accept: "application/json" };
    if (process.env.CRICKET_API_KEY) headers.Authorization = "Bearer " + process.env.CRICKET_API_KEY;
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    const body = await response.json();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    res.status(response.status).json(body);
  } catch (error) {
    res.status(502).json({ ok: false, error: "Cricket data is temporarily unavailable" });
  }
}
