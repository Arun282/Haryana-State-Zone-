const API_URL = "/api/news";
let allStories = [];
let category = "all";
const $ = id => document.getElementById(id);
$("today").textContent = new Intl.DateTimeFormat("hi-IN", { dateStyle: "full" }).format(new Date());

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function pick(obj, ...keys) {
  for (const key of keys) if (obj && obj[key]) return obj[key];
  return "";
}
function cleanText(value = "") {
  return String(value).replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, "").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}
function normalize(story) {
  let section = cleanText(pick(story, "category", "section")) || "India";
  if (["देश", "भारत", "India", "राष्ट्रीय"].includes(section)) section = "India";
  if (["विश्व", "दुनिया", "अंतरराष्ट्रीय", "International News"].includes(section)) section = "International News";
  return {
    id: String(pick(story, "id", "guid") || ""),
    title: cleanText(pick(story, "title", "titleHi", "headline")) || "शीर्षक उपलब्ध नहीं",
    summary: cleanText(pick(story, "summary", "summaryHi", "description", "excerpt")),
    body: cleanText(pick(story, "bodyHi", "body", "content", "summary", "description")),
    image: pick(story, "imageUrl", "image", "image_url"),
    date: pick(story, "publishedAt", "published_at", "date", "createdAt"),
    category: section
  };
}
function storyShareUrl(story) {
  const url = new URL("https://international-news-arun282.vercel.app/");
  url.searchParams.set("story", story.id || story.title);
  return url.href;
}
async function shareStory(story) {
  if (!story) return;
  const url = storyShareUrl(story);
  const text = story.title + " — International News";
  try {
    if (navigator.share) {
      await navigator.share({ title: "International News", text, url });
    } else if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      alert("International News का खबर लिंक कॉपी हो गया। अब इसे WhatsApp या किसी भी ऐप में शेयर करें।");
    } else {
      const field = document.createElement("textarea");
      field.value = url; field.style.position = "fixed"; field.style.opacity = "0";
      document.body.appendChild(field); field.select();
      const copied = document.execCommand("copy"); field.remove();
      if (copied) alert("International News का खबर लिंक कॉपी हो गया। अब इसे शेयर करें।");
      else location.href = "https://wa.me/?text=" + encodeURIComponent(text + " " + url);
    }
  } catch (error) {
    if (error && error.name !== "AbortError") location.href = "https://wa.me/?text=" + encodeURIComponent(text + " " + url);
  }
}
function render() {
  const list = category === "all" ? allStories : allStories.filter(s => s.category === category);
  $("news").innerHTML = list.map(s =>
    '<article class="card"><div class="photo">' +
    (s.image ? '<img loading="lazy" src="' + esc(s.image) + '" alt="" onerror="this.parentElement.textContent=\'फोटो उपलब्ध नहीं\'">' : "फोटो उपलब्ध नहीं") +
    '</div><div class="card-content"><span class="category">' + esc(s.category) +
    '</span><h2>' + esc(s.title) + '</h2><p>' + esc(s.summary || "इस खबर का सार अभी उपलब्ध फ़ीड में नहीं है।") +
    '</p><div class="meta">' + esc(s.date ? new Date(s.date).toLocaleString("hi-IN") : "ताज़ा अपडेट") +
    '</div><div class="card-actions"><button class="read" data-index="' + allStories.indexOf(s) + '">पूरी खबर पढ़ें →</button><button class="share-news" type="button" data-share="' + allStories.indexOf(s) + '" aria-label="खबर शेयर करें">↗ शेयर</button></div></div></article>'
  ).join("");
  $("status").classList.toggle("hidden", list.length > 0);
  if (!list.length) $("status").textContent = allStories.length
    ? "इस श्रेणी में अभी खबरें उपलब्ध नहीं हैं। दूसरी श्रेणी चुनें।"
    : "अभी खबरें उपलब्ध नहीं हैं। कृपया 'दोबारा लोड करें' दबाएँ।";
  $("ticker").textContent = allStories[0]?.title || "अभी कोई नई खबर उपलब्ध नहीं है।";
}
async function load() {
  $("status").classList.remove("hidden");
  $("status").textContent = "खबरें लोड हो रही हैं…";
  try {
    const response = await fetch(API_URL + "?ts=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("API status " + response.status);
    const data = await response.json();
    const rows = Array.isArray(data) ? data : (data.news || data.stories || data.items || data.data || []);
    allStories = rows.map(normalize);
    render();
    const requested = new URLSearchParams(location.search).get("story");
    if (requested && !window.__sharedStoryOpened) {
      const match = allStories.find(s => s.id === requested || s.title === requested);
      if (match) { window.__sharedStoryOpened = true; openStory(match); }
    }
    if (!allStories.length && data.error) $("status").textContent = "न्यूज़ फ़ीड अभी उपलब्ध नहीं है। थोड़ी देर बाद दोबारा प्रयास करें।";
  } catch (error) {
    $("status").classList.remove("hidden");
    $("status").innerHTML = 'लाइव खबरें अभी लोड नहीं हो पाईं। इंटरनेट जाँचें या दोबारा प्रयास करें।<br><button id="retry-news" class="read" type="button">दोबारा लोड करें</button>';
    $("ticker").textContent = "लाइव खबरें लोड नहीं हो पाईं";
    console.error("News load failed:", error);
  }
}
$("status").addEventListener("click", event => { if (event.target.closest("#retry-news")) load(); });
$("nav").addEventListener("click", event => {
  const button = event.target.closest("button[data-category]");
  if (!button) return;
  category = button.dataset.category;
  document.querySelectorAll("nav button[data-category]").forEach(item => item.classList.toggle("active", item === button));
  render();
});
function openStory(story) {
  if (!story) return;
  const related = allStories.filter(item => item !== story && item.category === story.category).slice(0, 4);
  const fullText = cleanText(story.body || story.summary || "");
  const summary = cleanText(story.summary || "");
  const paragraphs = (fullText || summary || "इस खबर का विस्तृत विवरण समाचार फ़ीड में उपलब्ध नहीं है।").split(/(?<=[।!?])\s+/).filter(Boolean);
  const enoughDetail = (fullText + " " + summary).trim().length > 450;
  const imageHtml = story.image ? '<img class="article-photo" src="' + esc(story.image) + '" alt="" onerror="this.remove()">' : "";
  $("article-content").innerHTML = imageHtml +
    '<div class="category">' + esc(story.category) + '</div><h2>' + esc(story.title) +
    '</h2><p class="summary">' + esc(summary || "ताज़ा समाचार") + '</p><p class="meta">प्रकाशित: ' +
    esc(story.date ? new Date(story.date).toLocaleString("hi-IN") : "ताज़ा अपडेट") +
    '</p><div class="article-share-row"><button class="share-news" type="button" id="share-open-story">↗ International News पर शेयर करें</button></div><hr><h3>विस्तृत खबर</h3><div class="body">' +
    paragraphs.map(p => "<p>" + esc(p) + "</p>").join("") +
    '</div><p class="detail-note">' + (enoughDetail ? "यहाँ समाचार फ़ीड में उपलब्ध विस्तृत जानकारी दी गई है।" : "समाचार स्रोत ने अभी सीमित विवरण ही उपलब्ध कराया है। खबर इसी वेबसाइट पर पढ़ें—कोई बाहरी लिंक नहीं खोला जाएगा।") +
    '</p><hr><h3>और खबरें</h3><div class="related">' +
    (related.length ? related.map(item => '<button class="related-item" data-related="' + allStories.indexOf(item) + '">' + esc(item.title) + '<small>' + esc(item.category) + '</small></button>').join("") : "<p>अभी संबंधित खबर उपलब्ध नहीं है।</p>") + "</div>";
  $("article").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  $("share-open-story").addEventListener("click", () => shareStory(story));
}
$("news").addEventListener("click", event => {
  const share = event.target.closest("button[data-share]");
  if (share) { shareStory(allStories[Number(share.dataset.share)]); return; }
  const button = event.target.closest("button[data-index]");
  if (button) openStory(allStories[Number(button.dataset.index)]);
});
$("article-content").addEventListener("click", event => {
  const button = event.target.closest("button[data-related]");
  if (button) openStory(allStories[Number(button.dataset.related)]);
});
function closeArticle() { $("article").classList.add("hidden"); document.body.style.overflow = ""; }
$("close").addEventListener("click", closeArticle);
document.addEventListener("keydown", event => { if (event.key === "Escape") closeArticle(); });
load();
setInterval(load, 60000);
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
