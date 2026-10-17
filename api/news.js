const FEEDS = [
  ["हरियाणा", "Haryana news when:1d"],
  ["नारनौल", "Narnaul news when:2d"],
  ["महेंद्रगढ़", "Mahendragarh Haryana news when:2d"],
  ["रेवाड़ी", "Rewari Haryana news when:2d"],
  ["गुरुग्राम", "Gurugram Haryana news when:1d"],
  ["देश", "India latest news when:1d"],
  ["खेल", "India sports news when:1d"],
  ["खेल", "India cricket news when:1d"],
  ["खेल", "India football hockey badminton tennis news when:2d"]
];
const decode = (s="") => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/\s+/g," ").trim();
function tag(xml,name){const re=new RegExp("<"+name+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+name+">","i");return (xml.match(re)||[])[1]||"";}
function parseItems(xml,category){
 return [...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map(m=>{
  const x=m[1],rawTitle=decode(tag(x,"title"));
  const title=rawTitle.replace(/\s[-|–—]\s[^-|–—]{2,80}$/,"").trim();
  const desc=tag(x,"description"), encoded=tag(x,"content:encoded"), content=decode(encoded||desc);
  const image=(desc.match(/<img[^>]+src=["']([^"']+)/i)||[])[1]||(x.match(/<media:content[^>]+url=["']([^"']+)/i)||[])[1]||(x.match(/<enclosure[^>]+url=["']([^"']+)/i)||[])[1]||"";
  const date=decode(tag(x,"pubDate")),parsed=Date.parse(date);
  const rawLink=decode(tag(x,"link"));
  return {id:decode(tag(x,"guid"))||rawLink,title,summary:decode(desc).slice(0,1400),body:content.slice(0,5000),image,date:parsed?new Date(parsed).toISOString():null,category};
 }).filter(s=>s.title&&s.title.length>8);
}
module.exports=async function handler(req,res){
 res.setHeader("Cache-Control","no-store, max-age=0, must-revalidate");
 res.setHeader("Access-Control-Allow-Origin","*");
 res.setHeader("Content-Type","application/json; charset=utf-8");
 if(req.method==="OPTIONS"){res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");return res.status(204).end();}
 if(req.method!=="GET")return res.status(405).json({error:"Method not allowed"});
 try{
  const results=await Promise.all(FEEDS.map(async([category,q])=>{
   const url="https://news.google.com/rss/search?q="+encodeURIComponent(q)+"&hl=hi&gl=IN&ceid=IN:hi";
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),9000);
   try{const r=await fetch(url,{headers:{"User-Agent":"HaryanaStateZoneNews/1.0 (RSS reader)","Accept":"application/rss+xml, application/xml, text/xml"},signal:ctrl.signal});if(!r.ok)throw Error("RSS "+r.status);return parseItems(await r.text(),category);}
   catch(e){return [];}finally{clearTimeout(timer);}
  }));
  const cutoff=Date.now()-48*60*60*1000,seen=new Set();
  const stories=results.flat().filter(s=>!s.date||Date.parse(s.date)>=cutoff).sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)).filter(s=>{const k=s.title.toLocaleLowerCase("hi");if(seen.has(k))return false;seen.add(k);return true;}).slice(0,60);
  return res.status(200).json({updatedAt:new Date().toISOString(),count:stories.length,stories});
 }catch(e){return res.status(200).json({updatedAt:new Date().toISOString(),count:0,stories:[],error:"News feeds are temporarily unavailable"});}
};