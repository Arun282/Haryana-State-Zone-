export default async function handler(req, res) {
  const type = String(req.query?.type || "live").toLowerCase();
  const matchId = String(req.query?.match_id || "").trim();
  const token = process.env.CRICKET_API_KEY || "";
  const base = "https://cricketliveapi.com/api/v1/cricket";

  if (type === "detail") {
    if (!matchId || !/^[a-zA-Z0-9_-]+$/.test(matchId)) {
      res.status(400).json({ status: "error", ok: false, message: "Valid match_id is required" });
      return;
    }
    if (!token) {
      res.status(200).json({ status: "success", ok: true, scorecardAvailable: false, message: "Player-by-player scorecards require a valid API token and a plan that includes scorecards." });
      return;
    }
    try {
      const response = await fetch(base + "/match/" + encodeURIComponent(matchId) + "/scorecard", {
        headers: { Accept: "application/json", Authorization: "Bearer " + token },
        signal: AbortSignal.timeout(12000)
      });
      const body = await response.json();
      res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
      res.status(response.status).json(body);
    } catch {
      res.status(502).json({ status: "error", ok: false, message: "Scorecard service could not be reached." });
    }
    return;
  }

  const routes = {
    live: ["/live", "/matches/live"],
    upcoming: ["/upcoming", "/matches/upcoming"],
    recent: ["/recent", "/matches/recent"],
    schedule: ["/schedule", "/matches/schedule"]
  };
  if (!routes[type]) {
    res.status(400).json({ status: "error", ok: false, message: "Unknown cricket data type" });
    return;
  }

  const attempts = [];
  // The provider's published pages disagree on route paths and authentication.
  // Try documented public route first, then token-protected alternative route.
  for (const route of routes[type]) {
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    attempts.push({ route, headers });
  }
  if (token) {
    for (const route of routes[type]) attempts.push({ route, headers: { Accept: "application/json" } });
  }

  let lastStatus = 502;
  let lastBody = null;
  for (const attempt of attempts) {
    try {
      const response = await fetch(base + attempt.route, {
        headers: attempt.headers,
        signal: AbortSignal.timeout(10000)
      });
      let body;
      try { body = await response.json(); }
      catch { body = { status: "error", message: "Cricket API returned an invalid response." }; }
      lastStatus = response.status;
      lastBody = body;
      if (response.ok && body?.status !== "error" && body?.ok !== false) {
        res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=30");
        res.status(200).json(body);
        return;
      }
    } catch {
      lastBody = { status: "error", message: "Could not connect to cricket data provider." };
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    status: "error",
    ok: false,
    message: lastBody?.message || lastBody?.error || (lastStatus === 401 ? "Cricket API token is invalid or expired." : lastStatus === 403 ? "Your Cricket API plan does not allow this endpoint." : lastStatus === 429 ? "Cricket API request limit reached. Please retry later." : "Cricket API returned no usable match data."),
    providerStatus: lastStatus
  });
}
