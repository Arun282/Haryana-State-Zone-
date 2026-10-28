export default async function handler(req, res) {
  const type = String(req.query?.type || "live").toLowerCase();
  const matchId = String(req.query?.match_id || "").trim();

  // Public live/recent/upcoming/schedule routes are documented as public.
  // Do not attach a possibly invalid token to these requests: an invalid token
  // can turn an otherwise public endpoint into a 401 response.
  if (type === "detail") {
    if (!matchId || !/^[a-zA-Z0-9_-]+$/.test(matchId)) {
      res.status(400).json({ ok: false, error: "Valid match_id is required" });
      return;
    }
    if (!process.env.CRICKET_API_KEY) {
      res.status(200).json({ ok: true, scorecardAvailable: false, message: "Player-by-player scorecards need a paid API plan and a valid key. Match summary is shown here." });
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

  const allowed = { live: "live", upcoming: "upcoming", recent: "recent", schedule: "schedule" };
  if (!allowed[type]) {
    res.status(400).json({ ok: false, error: "Unknown cricket data type" });
    return;
  }

  try {
    const response = await fetch("https://cricketliveapi.com/api/v1/cricket/" + allowed[type], {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000)
    });
    const body = await response.json();
    res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    // Keep upstream status and error message so the frontend can show a useful state.
    res.status(response.status).json(body);
  } catch (error) {
    res.status(502).json({ status: "error", ok: false, error: "Cricket data service could not be reached. Please retry." });
  }
}
