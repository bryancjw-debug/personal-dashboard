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
  etfs: "https://www.sgx.com/securities/etf",
  cme: "https://www.cmegroup.com/markets.html",
  masFx: "https://eservices.mas.gov.sg/Statistics/msb/ExchangeRates.aspx"
};

const sgxWatchlist = [
  ["D05.SI", "DBS Group"],
  ["O39.SI", "OCBC Bank"],
  ["U11.SI", "UOB"],
  ["Z74.SI", "Singtel"],
  ["S68.SI", "Singapore Exchange"],
  ["C38U.SI", "CapitaLand Integrated Commercial Trust"],
  ["C09.SI", "City Developments"],
  ["J36.SI", "Jardine Matheson"],
  ["BN4.SI", "Keppel"],
  ["C6L.SI", "Singapore Airlines"],
  ["G13.SI", "Genting Singapore"],
  ["A17U.SI", "CapitaLand Ascendas REIT"],
  ["M44U.SI", "Mapletree Logistics Trust"],
  ["N2IU.SI", "Mapletree Pan Asia Commercial Trust"],
  ["T82U.SI", "Suntec REIT"],
  ["F34.SI", "Wilmar"],
  ["S58.SI", "SATS"],
  ["BS6.SI", "Yangzijiang Shipbuilding"],
  ["Y92.SI", "Thai Beverage"],
  ["C07.SI", "Jardine Cycle & Carriage"]
];

const etfWatchlist = [
  ["SPY", "SPDR S&P 500 ETF", "US ETF"],
  ["QQQ", "Invesco QQQ Trust", "US ETF"],
  ["IWM", "iShares Russell 2000 ETF", "US ETF"],
  ["DIA", "SPDR Dow Jones Industrial Average ETF", "US ETF"],
  ["VTI", "Vanguard Total Stock Market ETF", "US ETF"],
  ["VEA", "Vanguard FTSE Developed Markets ETF", "US ETF"],
  ["VWO", "Vanguard FTSE Emerging Markets ETF", "US ETF"],
  ["TLT", "iShares 20+ Year Treasury Bond ETF", "US ETF"],
  ["HYG", "iShares iBoxx High Yield Corporate Bond ETF", "US ETF"],
  ["GLD", "SPDR Gold Shares", "US ETF"],
  ["SLV", "iShares Silver Trust", "US ETF"],
  ["USO", "United States Oil Fund", "US ETF"],
  ["ES3.SI", "SPDR Straits Times Index ETF", "SG ETF"],
  ["G3B.SI", "Nikko AM Singapore STI ETF", "SG ETF"],
  ["A35.SI", "ABF Singapore Bond Index Fund", "SG ETF"],
  ["CLR.SI", "Lion-OCBC Securities Singapore Low Carbon ETF", "SG ETF"],
  ["CFA.SI", "NikkoAM-StraitsTrading Asia ex Japan REIT ETF", "SG ETF"],
  ["OVQ.SI", "Lion-OCBC Securities Hang Seng TECH ETF", "SG ETF"],
  ["HST.SI", "Lion-OCBC Securities Hang Seng TECH ETF", "SG ETF"],
  ["MBH.SI", "Nikko AM SGD Investment Grade Corporate Bond ETF", "SG ETF"]
];

const commodityWatchlist = [
  ["GC=F", "Gold futures"],
  ["SI=F", "Silver futures"],
  ["PL=F", "Platinum futures"],
  ["PA=F", "Palladium futures"],
  ["HG=F", "Copper futures"],
  ["CL=F", "WTI crude futures"],
  ["BZ=F", "Brent crude futures"],
  ["NG=F", "Natural gas futures"],
  ["HO=F", "Heating oil futures"],
  ["RB=F", "RBOB gasoline futures"],
  ["ZC=F", "Corn futures"],
  ["ZW=F", "Wheat futures"],
  ["ZS=F", "Soybean futures"],
  ["KC=F", "Coffee futures"],
  ["CC=F", "Cocoa futures"],
  ["CT=F", "Cotton futures"],
  ["SB=F", "Sugar futures"],
  ["LE=F", "Live cattle futures"],
  ["HE=F", "Lean hog futures"]
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

  const [world, singapore, us, sgx, etfs, crypto, commodities, fx] = await Promise.all([
    safe("World news", () => collectNews(sourcePages.world, 7)),
    safe("Singapore news", () => collectNews(sourcePages.singapore, 8)),
    safe("US market movers", fetchUsMovers, emptyMovers()),
    safe("SGX market movers", fetchSgxMovers, emptyMovers()),
    safe("ETF movers", fetchEtfMovers, emptyMovers()),
    safe("Crypto movers", fetchCryptoMovers, emptyMovers()),
    safe("Commodity movers", fetchCommodityMovers, emptyMovers()),
    safe("FX", fetchFx)
  ]);

  const data = {
    generatedAt,
    health: errors.length ? "partial" : "ok",
    errors,
    summary: buildSummary({ world, singapore, us, sgx, etfs, crypto, commodities, fx }, errors),
    news: { world, singapore },
    markets: {
      us,
      sgx,
      etfs,
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
  const counts = Object.values(groups).map(countItems);
  const captured = counts.reduce((sum, count) => sum + count, 0);
  if (captured && errors.length) return `Captured ${captured} updates. ${errors.length} source ${errors.length === 1 ? "needs" : "need"} manual verification.`;
  if (!captured) return "Refresh completed, but source data was limited. Use the official source links for direct checks.";
  return `Captured ${captured} updates across news, markets, FX, crypto, commodities, and Singapore policy sources.`;
}

function emptyMovers() {
  return { gainers: [], losers: [] };
}

function countItems(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    return (value.gainers?.length || 0) + (value.losers?.length || 0);
  }
  return 0;
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

async function fetchUsMovers() {
  const [gainers, losers] = await Promise.all([
    fetchYahooScreener("day_gainers"),
    fetchYahooScreener("day_losers")
  ]);
  return { gainers, losers };
}

async function fetchYahooScreener(screenId) {
  const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${screenId}&count=15`;
  const json = await getJson(url);
  const quotes = json?.finance?.result?.[0]?.quotes || [];
  return quotes.slice(0, 15).map((quote) => ({
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || "US listed equity",
    price: quote.regularMarketPrice,
    changePct: quote.regularMarketChangePercent,
    url: `https://www.nasdaq.com/market-activity/stocks/${String(quote.symbol).toLowerCase()}`
  }));
}

async function fetchSgxMovers() {
  const broad = await fetchSgxBroadMovers();
  if (broad.gainers.length || broad.losers.length) return broad;
  return moversFromWatchlist(sgxWatchlist, "SGX equity", (symbol) => `https://www.sgx.com/securities/equities/${symbol.replace(".SI", "")}`);
}

async function fetchSgxBroadMovers() {
  const [gainers, losers] = await Promise.all([
    scrapeSgxMovers("https://sginvestors.io/market/sgx-top-gainers-by-percent", "gainers"),
    scrapeSgxMovers("https://sginvestors.io/market/sgx-top-losers-by-percent", "losers")
  ]);
  return { gainers, losers };
}

async function scrapeSgxMovers(url, type) {
  try {
    const sign = type === "losers" ? "-" : "+";
    const escapedSign = sign === "+" ? "\\+" : "-";
    const html = await getText(url);
    const text = cleanHtml(html).replace(/\s+/g, " ");
    const pattern = new RegExp(`([A-Z0-9&'(). -]{4,80}) \\(SGX:([A-Z0-9]+)\\).*?SGD\\s*([0-9.]+)\\s*${escapedSign}([0-9.]+)\\s*\\(${escapedSign}([0-9.]+)%\\)`, "g");
    const items = [];
    let match;

    while ((match = pattern.exec(text)) && items.length < 15) {
      const changePct = Number(match[5]) * (type === "losers" ? -1 : 1);
      items.push({
        symbol: `SGX:${match[2]}`,
        name: titleCase(match[1]),
        price: Number(match[3]),
        changePct,
        url: `https://www.sgx.com/securities/equities/${match[2]}`
      });
    }

    return items;
  } catch {
    return [];
  }
}

async function fetchSgxGainers() {
  const url = "https://sginvestors.io/market/sgx-top-gainers-by-percent";
  try {
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

    if (items.length) return items;
  } catch {
    // Fall through to the liquid-name watchlist when the broad mover page blocks automation.
  }

  return fetchSgxWatchlistGainers();
}

async function fetchSgxWatchlistGainers() {
  const { gainers } = await moversFromWatchlist(sgxWatchlist, "SGX equity", (symbol) => `https://www.sgx.com/securities/equities/${symbol.replace(".SI", "")}`);
  return gainers;
}

async function fetchEtfMovers() {
  return moversFromWatchlist(etfWatchlist, "ETF", (symbol) => {
    if (symbol.endsWith(".SI")) return `https://www.sgx.com/securities/etf/${symbol.replace(".SI", "")}`;
    return `https://www.nasdaq.com/market-activity/etf/${symbol.toLowerCase()}`;
  });
}

async function fetchCryptoMovers() {
  const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=sgd&order=market_cap_desc&per_page=60&page=1&sparkline=false&price_change_percentage=24h";
  const json = await getJson(url);
  const items = json.map((coin) => ({
    symbol: String(coin.symbol || "").toUpperCase(),
    name: coin.name,
    price: coin.current_price,
    changePct: coin.price_change_percentage_24h,
    url: `https://www.coingecko.com/en/coins/${coin.id}`
  })).filter((item) => Number.isFinite(item.changePct));
  return splitMovers(items);
}

async function fetchCommodityMovers() {
  return moversFromWatchlist(commodityWatchlist, "Commodity", (symbol, name) => `https://www.cmegroup.com/search.html?q=${encodeURIComponent(name)}`);
}

async function moversFromWatchlist(watchlist, label, urlFor) {
  const settled = await Promise.allSettled(watchlist.map(async ([symbol, name, group]) => {
    const quote = await fetchYahooChartQuote(symbol);
    return {
      symbol: displaySymbol(symbol),
      name: group ? `${name} · ${group}` : `${name} · ${label}`,
      price: quote.price,
      changePct: quote.changePct,
      url: urlFor(symbol, name)
    };
  }));

  const items = settled
    .filter((result) => result.status === "fulfilled" && Number.isFinite(result.value.changePct))
    .map((result) => result.value);
  return splitMovers(items);
}

async function fetchYahooChartQuote(symbol) {
    const json = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`);
    const result = json?.chart?.result?.[0];
    const meta = result?.meta || {};
    const closes = result?.indicators?.quote?.[0]?.close?.filter((value) => Number.isFinite(value)) || [];
    const last = Number(meta.regularMarketPrice || closes.at(-1));
    const prev = Number(closes.at(-2) || meta.chartPreviousClose);
    const changePct = prev ? ((last - prev) / prev) * 100 : null;
    return { price: last, changePct };
}

function splitMovers(items) {
  const valid = items.filter((item) => Number.isFinite(item.changePct));
  return {
    gainers: [...valid].sort((a, b) => b.changePct - a.changePct).slice(0, 15),
    losers: [...valid].sort((a, b) => a.changePct - b.changePct).slice(0, 15)
  };
}

function displaySymbol(symbol) {
  return symbol.replace("=F", "").replace(".SI", "");
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
      us: emptyMovers(),
      sgx: emptyMovers(),
      etfs: emptyMovers(),
      crypto: emptyMovers(),
      commodities: emptyMovers()
    },
    fx: [],
    officialLinks
  };
  await mkdir(new URL("../data/", import.meta.url), { recursive: true });
  await writeFile(OUT, `${JSON.stringify(fallback, null, 2)}\n`, "utf8");
  console.error(error);
  process.exitCode = 1;
});
