export default async function handler(req, res) {
  const type = String(req.query?.type || "live").toLowerCase();
  const matchId = String(req.query?.match_id || "").trim();
  if (type === "detail") {
    if (!matchId || !/^[a-zA-Z0-9_-]+$/.test(matchId)) {
      res.status(400).json({ ok: false, error: "Valid match_id is required" });
      return;
    }
    if (!process.env.CRICKET_API_KEY) {
      res.status(200).json({ ok: true, scorecardAvailable: false, message: "Full player scorecards require a cricket API key. Match summary is shown on this site." });
      return;
    }
    try {
      const response = await fetch("https://cricketliveapi.com/api/v1/cricket/match/" + encodeURIComponent(matchId) + "/scorecard", {
        headers: { Accept: "application/json", Authorization: "Bearer " + process.env.CRICKET_API_KEY },
        signal: AbortSignal.timeout(12000)
      });
      const body = await response.json();
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      res.status(response.status).json(body);
    } catch (error) {
      res.status(502).json({ ok: false, error: "Scorecard is temporarily unavailable" });
    }
    return;
  }
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
