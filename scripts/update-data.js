import { writeFile, mkdir } from "node:fs/promises";

const OUT = new URL("../data/dashboard.json", import.meta.url);

const sourcePages = {
  world: [
    { source: "CNA Business", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936", category: "World finance", feed: true },
    { source: "CNA World", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6311", category: "World news", feed: true },
    { source: "BBC Business", url: "https://feeds.bbci.co.uk/news/business/rss.xml", category: "World finance", feed: true },
    { source: "BBC Technology", url: "https://feeds.bbci.co.uk/news/technology/rss.xml", category: "World tech", feed: true }
  ],
  singapore: [
    { source: "CNA Singapore", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=10416", category: "Singapore news", feed: true },
    { source: "CNA Business", url: "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6936", category: "Singapore finance", feed: true, singaporeOnly: true },
    { source: "MAS", url: "https://www.mas.gov.sg/news", category: "Finance policy", articlePath: "/news/" },
    { source: "MOF", url: "https://www.mof.gov.sg/news-resources/newsroom", category: "Government policy", articlePath: "/news-resources/newsroom/" },
    { source: "IRAS", url: "https://www.iras.gov.sg/news-events/newsroom", category: "Tax policy", articlePath: "/news-events/newsroom/" },
    { source: "CPF", url: "https://www.cpf.gov.sg/member/infohub/news/news-releases", category: "Retirement policy", articlePath: "/infohub/news/news-releases/" },
    { source: "IMDA", url: "https://www.imda.gov.sg/resources/press-releases-factsheets-and-speeches", category: "Technology policy", articlePath: "/resources/press-releases-factsheets-and-speeches/" },
    { source: "LIA Singapore", url: "https://www.lia.org.sg/news-room/industry-news/", category: "Insurance", articlePath: "/news-room/" },
    { source: "gov.sg", url: "https://www.gov.sg/", category: "Government" }
  ]
};

const topicKeywords = [
  "market", "markets", "stock", "stocks", "fund", "funds", "finance", "financial", "bank", "banks",
  "insurance", "insurer", "policy", "tax", "gst", "cpf", "retirement", "budget", "technology", "digital",
  "ai", "cyber", "mas", "mof", "iras", "sgx", "investment", "wealth", "economic", "economy"
];

const policyKeywords = [
  "announce", "announces", "announced", "budget", "circular", "consultation", "effective",
  "enhance", "enhanced", "extension", "framework", "guidance", "guidelines", "launch",
  "launched", "media release", "policy", "regulation", "scheme", "statement", "tax", "update"
];

const singaporeKeywords = [
  "singapore", "sgx", "mas", "mof", "iras", "cpf", "imda", "uob", "dbs", "ocbc",
  "great eastern", "income insurance", "prudential singapore", "aia singapore"
];

const officialLinks = {
  sgx: "https://www.sgx.com/securities/stock-screener",
  us: "https://www.nasdaq.com/market-activity/stocks/screener",
  funds: "https://eservices.mas.gov.sg/fid",
  cme: "https://www.cmegroup.com/markets.html",
  masFx: "https://eservices.mas.gov.sg/Statistics/msb/ExchangeRates.aspx"
};

const fundCentreLinks = [
  { symbol: "Fund centres", name: "MAS Financial Institutions Directory", value: "Official lookup", changePct: null, url: "https://eservices.mas.gov.sg/fid" },
  { symbol: "Great Eastern", name: "GreatLink fund prices and factsheets", value: "Open", changePct: null, url: "https://www.greateasternlife.com/sg/en/personal-insurance/our-products/investment-linked-plans/fund-prices.html" },
  { symbol: "Lion Global", name: "Singapore fund prices and literature", value: "Open", changePct: null, url: "https://www.lionglobalinvestors.com/en/fund-centre.html" },
  { symbol: "Fullerton", name: "Fund prices and factsheets", value: "Open", changePct: null, url: "https://www.fullertonfund.com/fund-prices" },
  { symbol: "Eastspring", name: "Singapore funds and factsheets", value: "Open", changePct: null, url: "https://www.eastspring.com/sg/funds" }
];

async function main() {
  const generatedAt = new Date().toISOString();
  const errors = [];
  const safe = async (label, task, fallback = []) => {
    try {
      return await task();
    } catch (error) {
      errors.push(`${label}: ${error.message}`);
      return fallback;
    }
  };

  const [world, singapore, usGainers, sgxGainers, crypto, commodities, fx] = await Promise.all([
    safe("World news", () => collectNews(sourcePages.world, 7)),
    safe("Singapore news", () => collectNews(sourcePages.singapore, 8)),
    safe("US gainers", fetchUsGainers),
    safe("SGX gainers", fetchSgxGainers),
    safe("Crypto", fetchCrypto),
    safe("Commodities", fetchCommodities),
    safe("FX", fetchFx)
  ]);

  const data = {
    generatedAt,
    health: errors.length ? "partial" : "ok",
    errors,
    summary: buildSummary({ world, singapore, usGainers, sgxGainers, crypto, commodities, fx }, errors),
    news: { world, singapore },
    markets: {
      usGainers,
      sgxGainers,
      fundGainers: fundCentreLinks,
      crypto,
      commodities
    },
    fx,
    officialLinks
  };

  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`Dashboard snapshot written: ${OUT.pathname}`);
}

function buildSummary(groups, errors = []) {
  const counts = Object.values(groups).map((items) => items?.length || 0);
  const captured = counts.reduce((sum, count) => sum + count, 0);
  if (captured && errors.length) return `Captured ${captured} updates. ${errors.length} source ${errors.length === 1 ? "needs" : "need"} manual verification.`;
  if (!captured) return "Refresh completed, but source data was limited. Use the official source links for direct checks.";
  return `Captured ${captured} updates across news, markets, FX, crypto, commodities, and Singapore policy sources.`;
}

async function collectNews(sources, limit) {
  const settled = await Promise.allSettled(sources.map(fetchSourceUpdates));
  const items = settled
    .filter((result) => result.status === "fulfilled")
    .flatMap((result) => result.value)
    .sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return (dateB - dateA) || (b.score - a.score);
    });

  return dedupe(items, "url").slice(0, limit).map(({ score, ...item }) => item);
}

async function fetchSourceUpdates(source) {
  return source.feed ? parseRssSource(source) : scrapeSourcePage(source);
}

async function parseRssSource(source) {
  const xml = await getText(source.url);
  const items = [];
  const itemPattern = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemPattern) || [];

  for (const raw of matches) {
    const title = cleanHtml(extractXml(raw, "title"));
    const url = cleanHtml(extractXml(raw, "link"));
    const date = cleanHtml(extractXml(raw, "pubDate"));
    const summary = cleanHtml(extractXml(raw, "description"));
    if (!title || !url || looksLikeNavigation(title)) continue;
    const score = scoreTitle(title);
    const isFocusedFeed = /business|finance|tech/i.test(source.category);
    const isSingaporeRelevant = !source.singaporeOnly || scoreSingaporeTitle(title, url, summary) > 0;
    if (!isSingaporeRelevant) continue;
    if (!isFocusedFeed && score < 1) continue;
    items.push({
      title,
      url,
      source: source.source,
      category: source.category,
      date: date || null,
      summary: summary ? summary.slice(0, 180) : null,
      score: score + (date ? 1 : 0)
    });
  }

  return items;
}

async function scrapeSourcePage(source) {
  const html = await getText(source.url);
  const links = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html))) {
    const href = absoluteUrl(match[1], source.url);
    if (source.articlePath && !href.includes(source.articlePath)) continue;
    const title = cleanHtml(match[2]);
    if (!title || title.length < 18 || title.length > 180) continue;
    if (looksLikeNavigation(title)) continue;
    const score = scoreTitle(title);
    const policyScore = scorePolicyTitle(title);
    if (score < 1 || policyScore < 1) continue;
    links.push({
      title,
      url: href,
      source: source.source,
      category: source.category,
      date: null,
      score
    });
  }

  return links;
}

function scoreTitle(title) {
  const lower = title.toLowerCase();
  return topicKeywords.reduce((score, keyword) => {
    if (keyword.length <= 3) {
      return score + (new RegExp(`\\b${keyword}\\b`, "i").test(title) ? 1 : 0);
    }
    return score + (lower.includes(keyword) ? 1 : 0);
  }, 0);
}

function scorePolicyTitle(title) {
  const lower = title.toLowerCase();
  return policyKeywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0);
}

function scoreSingaporeTitle(...values) {
  const lower = values.filter(Boolean).join(" ").toLowerCase();
  return singaporeKeywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0);
}

function looksLikeNavigation(title) {
  const lower = title.toLowerCase();
  return [
    "skip to", "contact", "feedback", "privacy", "terms", "sitemap", "subscribe",
    "linkedin", "facebook", "instagram", "youtube", "search", "menu", "newsletter",
    "poll alert", "college football", "hub/", "advertise", "receive tax bill",
    "paying taxes", "claiming refunds", "forms", "calculator", "quick links", "basics of"
  ].some((word) => lower.includes(word));
}

async function fetchUsGainers() {
  const url = "https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=day_gainers&count=10";
  const json = await getJson(url);
  const quotes = json?.finance?.result?.[0]?.quotes || [];
  return quotes.slice(0, 8).map((quote) => ({
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || "US listed equity",
    price: quote.regularMarketPrice,
    changePct: quote.regularMarketChangePercent,
    url: `https://www.nasdaq.com/market-activity/stocks/${String(quote.symbol).toLowerCase()}`
  }));
}

async function fetchSgxGainers() {
  const url = "https://sginvestors.io/market/sgx-top-gainers-by-percent";
  const html = await getText(url);
  const text = cleanHtml(html).replace(/\s+/g, " ");
  const pattern = /([A-Z0-9&'(). -]{4,80}) \(SGX:([A-Z0-9]+)\).*?SGD\s*([0-9.]+)\s*\+([0-9.]+)\s*\(\+([0-9.]+)%\)/g;
  const items = [];
  let match;

  while ((match = pattern.exec(text)) && items.length < 8) {
    items.push({
      symbol: `SGX:${match[2]}`,
      name: titleCase(match[1]),
      price: Number(match[3]),
      changePct: Number(match[5]),
      url: `https://www.sgx.com/securities/equities/${match[2]}`
    });
  }

  return items;
}

async function fetchCrypto() {
  const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=sgd&ids=bitcoin,ethereum,solana,ripple,binancecoin&order=market_cap_desc&per_page=5&page=1&sparkline=false&price_change_percentage=24h";
  const json = await getJson(url);
  return json.map((coin) => ({
    symbol: String(coin.symbol || "").toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    changePct: coin.price_change_percentage_24h,
    url: `https://www.coingecko.com/en/coins/${coin.id}`
  }));
}

async function fetchCommodities() {
  const symbols = [
    ["GC=F", "Gold futures"],
    ["SI=F", "Silver futures"],
    ["CL=F", "WTI crude futures"],
    ["BZ=F", "Brent crude futures"],
    ["HG=F", "Copper futures"]
  ];

  const settled = await Promise.allSettled(symbols.map(async ([symbol, name]) => {
    const encoded = encodeURIComponent(symbol);
    const json = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=5d&interval=1d`);
    const result = json?.chart?.result?.[0];
    const meta = result?.meta || {};
    const closes = result?.indicators?.quote?.[0]?.close?.filter((value) => Number.isFinite(value)) || [];
    const last = Number(meta.regularMarketPrice || closes.at(-1));
    const prev = Number(closes.at(-2) || meta.chartPreviousClose);
    const changePct = prev ? ((last - prev) / prev) * 100 : null;
    return {
      symbol: symbol.replace("=F", ""),
      name,
      price: last,
      changePct,
      url: `https://www.cmegroup.com/search.html?q=${encodeURIComponent(name)}`
    };
  }));

  return settled.filter((result) => result.status === "fulfilled").map((result) => result.value);
}

async function fetchFx() {
  const currencies = ["USD", "EUR", "GBP", "AUD", "JPY", "CNY", "MYR", "HKD"];
  const latest = await getJson(`https://api.frankfurter.app/latest?from=SGD&to=${currencies.join(",")}`);
  const previous = await getJson(`https://api.frankfurter.app/${previousBusinessDate()}?from=SGD&to=${currencies.join(",")}`);
  return currencies.map((code) => {
    const rate = latest.rates?.[code];
    const prev = previous.rates?.[code];
    return {
      code,
      pair: `SGD/${code}`,
      label: `1 SGD buys ${code}`,
      rate,
      changePct: prev ? ((rate - prev) / prev) * 100 : null,
      url: officialLinks.masFx
    };
  });
}

function previousBusinessDate() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

async function getText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BryanMarketBrief/1.0 (+https://github.com/)",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    signal: AbortSignal.timeout(18000)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BryanMarketBrief/1.0 (+https://github.com/)",
      "accept": "application/json,text/plain,*/*"
    },
    signal: AbortSignal.timeout(18000)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function absoluteUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

function cleanHtml(value) {
  return decodeEntities(String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim());
}

function extractXml(raw, tag) {
  const match = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeEntities(value) {
  return value
    .replace(/\u00e2\u20ac\u2122/g, "'")
    .replace(/\u00e2\u20ac[\u0153\u009d]/g, "\"")
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, "-")
    .replace(/\u00e2\u20ac\u00a6/g, "...")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function dedupe(items, key) {
  const seen = new Set();
  return items.filter((item) => {
    const value = item[key];
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function titleCase(value) {
  return String(value).toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

main().catch(async (error) => {
  const fallback = {
    generatedAt: new Date().toISOString(),
    health: "error",
    summary: `Refresh failed: ${error.message}. Official source links remain available.`,
    news: { world: [], singapore: [] },
    markets: {
      usGainers: [],
      sgxGainers: [],
      fundGainers: fundCentreLinks,
      crypto: [],
      commodities: []
    },
    fx: [],
    officialLinks
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
});
