const FEEDS = [
  ["हरियाणा", "Haryana news when:1d"],
  ["नारनौल", "Narnaul news when:2d"],
  ["महेंद्रगढ़", "Mahendragarh Haryana news when:2d"],
  ["रेवाड़ी", "Rewari Haryana news when:2d"],
  ["गुरुग्राम", "Gurugram Haryana news when:1d"],
  ["India", "India latest news when:1d"],
  ["International News", "world international news when:1d"],
  ["खेल", "India sports news when:1d"],
  ["खेल", "India cricket news when:1d"],
  ["खेल", "India football hockey badminton tennis news when:2d"]
];
const decode = (s = "") => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/\s+/g, " ").trim();
function tag(xml, name) {
  const escaped = name.replace(":", "\\:");
  const re = new RegExp("<" + escaped + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + escaped + ">", "i");
  return (xml.match(re) || [])[1] || "";
}
function parseItems(xml, category) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const rawTitle = decode(tag(item, "title"));
    const title = rawTitle.replace(/\s[-|–—]\s[^-|–—]{2,80}$/, "").trim();
    const description = tag(item, "description");
    const encoded = tag(item, "content:encoded");
    const content = decode(encoded || description);
    const image = (description.match(/<img[^>]+src=["']([^"']+)/i) || [])[1]
      || (item.match(/<media:content[^>]+url=["']([^"']+)/i) || [])[1]
      || (item.match(/<enclosure[^>]+url=["']([^"']+)/i) || [])[1] || "";
    const pubDate = decode(tag(item, "pubDate"));
    const parsedDate = Date.parse(pubDate);
    const link = decode(tag(item, "link"));
    return {
      id: decode(tag(item, "guid")) || link,
      title,
      summary: decode(description).slice(0, 1400),
      body: content.slice(0, 5000),
      image,
      date: parsedDate ? new Date(parsedDate).toISOString() : null,
      category
    };
  }).filter(story => story.title && story.title.length > 8);
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const results = await Promise.all(FEEDS.map(async ([category, query]) => {
      const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=hi&gl=IN&ceid=IN:hi";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, {
          headers: { "User-Agent": "InternationalNewsRSS/1.0", "Accept": "application/rss+xml, application/xml, text/xml" },
          signal: controller.signal
        });
        if (!response.ok) throw new Error("RSS " + response.status);
        return parseItems(await response.text(), category);
      } catch (error) {
        console.error("News feed failed:", category, error.message);
        return [];
      } finally {
        clearTimeout(timer);
      }
    }));
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const seen = new Set();
    const stories = results.flat()
      .filter(story => !story.date || Date.parse(story.date) >= cutoff)
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .filter(story => {
        const key = story.title.toLocaleLowerCase("hi");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 80);
    return res.status(200).json({ updatedAt: new Date().toISOString(), count: stories.length, stories });
  } catch (error) {
    console.error("News API failed:", error);
    return res.status(200).json({ updatedAt: new Date().toISOString(), count: 0, stories: [], error: "News feeds are temporarily unavailable" });
  }
};
