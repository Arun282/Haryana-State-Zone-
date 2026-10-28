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
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
function tag(xml, name) {
  const escaped = name.replace(":", "\\:");
  const re = new RegExp("<" + escaped + "(?:\\s[^>]*)?>([\\s\\S]*?)<\\/" + escaped + ">", "i");
  return (xml.match(re) || [])[1] || "";
}
function plain(value = "") {
  return decode(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
function getImage(item, description, encoded) {
  const source = decode(item + " " + description + " " + encoded);
  const patterns = [
    /<media:thumbnail[^>]+url=["']([^"']+)/i,
    /<media:content[^>]+url=["']([^"']+)/i,
    /<enclosure[^>]+url=["']([^"']+)/i,
    /<img[^>]+(?:src|data-src)=["']([^"']+)/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match && /^https?:\/\//i.test(match[1])) return match[1].replace(/&amp;/g, "&");
  }
  return "";
}
function parseItems(xml, category) {
  return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const title = plain(tag(item, "title")).replace(/\s[-|–—]\s[^-|–—]{2,80}$/, "").trim();
    const description = tag(item, "description");
    const encoded = tag(item, "content:encoded");
    const pubDate = plain(tag(item, "pubDate"));
    const parsedDate = Date.parse(pubDate);
    const link = plain(tag(item, "link"));
    return {
      id: plain(tag(item, "guid")) || link,
      title,
      summary: plain(description).slice(0, 1400),
      body: plain(encoded || description).slice(0, 5000),
      image: getImage(item, description, encoded),
      articleUrl: link,
      date: parsedDate ? new Date(parsedDate).toISOString() : null,
      category
    };
  }).filter(story => story.title && story.title.length > 8);
}
function metaImage(html) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const item of tags) {
    const property = (item.match(/(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["']/i) || [])[0];
    if (!property) continue;
    const content = item.match(/content=["']([^"']+)["']/i);
    if (content && /^https?:\/\//i.test(content[1])) return content[1].replace(/&amp;/g, "&");
  }
  return "";
}
async function articleImage(story) {
  if (story.image || !story.articleUrl || !/^https?:\/\//i.test(story.articleUrl)) return story;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(story.articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; InternationalNews/1.0)", "Accept": "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow"
    });
    if (!response.ok) return story;
    const html = (await response.text()).slice(0, 250000);
    story.image = metaImage(html);
  } catch (_) {
    // Some publishers block automated preview-image requests.
  } finally {
    clearTimeout(timer);
  }
  return story;
}
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") { res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS"); return res.status(204).end(); }
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const results = await Promise.all(FEEDS.map(async ([category, query]) => {
      const url = "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=hi&gl=IN&ceid=IN:hi";
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(url, { headers: { "User-Agent": "InternationalNewsRSS/1.0", "Accept": "application/rss+xml, application/xml, text/xml" }, signal: controller.signal });
        if (!response.ok) throw new Error("RSS " + response.status);
        return parseItems(await response.text(), category);
      } catch (error) { console.error("News feed failed:", category, error.message); return []; }
      finally { clearTimeout(timer); }
    }));
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const seen = new Set();
    let stories = results.flat().filter(story => !story.date || Date.parse(story.date) >= cutoff).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)).filter(story => {
      const key = story.title.toLocaleLowerCase("hi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80);
    // Resolve genuine publisher preview photos for the leading stories, without copying article text.
    const toCheck = stories.filter(story => !story.image && story.articleUrl).slice(0, 24);
    const resolved = await Promise.all(toCheck.map(articleImage));
    const imageById = new Map(resolved.map(story => [story.id, story.image]));
    stories = stories.map(story => {
      if (imageById.has(story.id) && imageById.get(story.id)) story.image = imageById.get(story.id);
      delete story.articleUrl;
      return story;
    });
    return res.status(200).json({ updatedAt: new Date().toISOString(), count: stories.length, stories });
  } catch (error) {
    console.error("News API failed:", error);
    return res.status(200).json({ updatedAt: new Date().toISOString(), count: 0, stories: [], error: "News feeds are temporarily unavailable" });
  }
};