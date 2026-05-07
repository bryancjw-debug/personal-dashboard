const DATA_URL = "data/dashboard.json";

const sourceLinks = [
  ["MAS", "Monetary policy, regulations, financial adviser guidance", "https://www.mas.gov.sg/"],
  ["SGX", "Singapore securities market information and official filings", "https://www.sgx.com/"],
  ["MOF", "Budget, tax policy, fiscal measures", "https://www.mof.gov.sg/"],
  ["gov.sg", "Whole-of-government policy explainers and releases", "https://www.gov.sg/"],
  ["IRAS", "Tax updates, GST, corporate and individual tax matters", "https://www.iras.gov.sg/"],
  ["CPF", "Retirement, CPF LIFE, MediSave, contribution changes", "https://www.cpf.gov.sg/"],
  ["IMDA", "Singapore digital economy and technology regulation", "https://www.imda.gov.sg/"],
  ["LIA Singapore", "Life insurance industry releases and protection matters", "https://www.lia.org.sg/"],
  ["NASDAQ", "US listed equity market activity", "https://www.nasdaq.com/market-activity"],
  ["NYSE", "US exchange official market information", "https://www.nyse.com/markets"],
  ["CME Group", "Futures and commodities market reference", "https://www.cmegroup.com/markets.html"],
  ["MAS FID", "Singapore financial institutions directory", "https://eservices.mas.gov.sg/fid"]
];

const fallbackData = {
  generatedAt: null,
  health: "fallback",
  summary: "No daily snapshot was found yet. Official links are ready and data cards will populate after the scheduled refresh runs.",
  news: {
    world: [],
    singapore: []
  },
  markets: {
    usGainers: [],
    sgxGainers: [],
    fundGainers: [],
    crypto: [],
    commodities: []
  },
  fx: []
};

const fmt = new Intl.NumberFormat("en-SG", { maximumFractionDigits: 4 });
const compact = new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 1 });

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function create(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function formatDate(value) {
  if (!value) return "Pending refresh";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-SG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Singapore"
  });
}

function formatChange(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(2)}%`;
}

function renderNews(containerId, items) {
  const container = document.getElementById(containerId);
  container.replaceChildren();

  if (!items?.length) {
    container.append(emptyState("No headlines were captured in the latest refresh. Use the source button above for the official newsroom."));
    return;
  }

  items.slice(0, 6).forEach((item) => {
    const article = create("article", "news-item");
    const link = create("a", "item-link");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener";

    const meta = create("div", "news-meta");
    meta.append(create("span", "pill", item.category || item.source || "Update"));
    meta.append(create("span", "", item.source || "Source"));
    meta.append(create("span", "", item.date ? formatDate(item.date) : "Latest"));

    link.append(meta);
    link.append(create("h3", "", item.title || "Open source update"));
    if (item.summary) link.append(create("p", "news-meta", item.summary));
    article.append(link);
    container.append(article);
  });
}

function renderMarket(containerId, items, emptyCopy) {
  const container = document.getElementById(containerId);
  container.replaceChildren();

  if (!items?.length) {
    container.append(emptyState(emptyCopy));
    return;
  }

  items.slice(0, 7).forEach((item) => {
    const row = create("a", "market-row");
    row.href = item.url || "#";
    row.target = "_blank";
    row.rel = "noopener";

    const left = create("div");
    left.append(create("div", "ticker", item.symbol || item.name || "Market"));
    left.append(create("div", "row-meta", item.name || item.source || "Latest quote"));

    const right = create("div", "row-value");
    const value = item.price ?? item.value ?? item.last ?? "";
    right.append(document.createTextNode(typeof value === "number" ? fmt.format(value) : value));
    const change = create("span", `change ${Number(item.changePct) < 0 ? "negative" : ""}`, formatChange(item.changePct));
    if (change.textContent) right.append(change);

    row.append(left, right);
    container.append(row);
  });
}

function renderFx(items) {
  const container = document.getElementById("fx-rates");
  container.replaceChildren();

  if (!items?.length) {
    container.append(emptyState("FX data will appear after the daily refresh. The MAS official exchange-rate page is linked above."));
    return;
  }

  items.slice(0, 8).forEach((item) => {
    const card = create("article", "fx-card");
    card.append(create("div", "fx-code", `${item.pair || item.code} against SGD`));
    card.append(create("div", "fx-rate", item.rate ? fmt.format(item.rate) : "n/a"));
    card.append(create("div", `change ${Number(item.changePct) < 0 ? "negative" : ""}`, formatChange(item.changePct)));
    card.append(create("div", "row-meta", item.label || "Per 1 SGD"));
    container.append(card);
  });
}

function renderSources() {
  const container = document.getElementById("source-links");
  container.replaceChildren();
  sourceLinks.forEach(([name, description, url]) => {
    const link = create("a", "source-link");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.append(create("h3", "", name));
    link.append(create("span", "", description));
    container.append(link);
  });
}

function emptyState(copy) {
  const node = create("div", "empty-state");
  node.textContent = copy;
  return node;
}

function updateStatus(data) {
  const status = document.getElementById("refresh-status");
  const generated = data.generatedAt ? `Updated ${formatDate(data.generatedAt)} SGT` : "Refresh pending";
  status.classList.toggle("is-fresh", Boolean(data.generatedAt));
  status.querySelector("span:last-child").textContent = generated;
  text("#today-title", data.generatedAt ? "Ready for client conversations" : "Source desk ready");
  text("#today-summary", data.summary || fallbackData.summary);
}

function normalizeMarket(data) {
  return {
    usGainers: data.markets?.usGainers || [],
    sgxGainers: data.markets?.sgxGainers || [],
    fundGainers: data.markets?.fundGainers || [],
    crypto: data.markets?.crypto || [],
    commodities: data.markets?.commodities || []
  };
}

async function loadDashboard() {
  renderSources();

  let data = fallbackData;
  try {
    const response = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Snapshot returned ${response.status}`);
    data = await response.json();
  } catch (error) {
    data = fallbackData;
  }

  const markets = normalizeMarket(data);
  updateStatus(data);
  renderNews("world-news", data.news?.world);
  renderNews("singapore-news", data.news?.singapore);
  renderMarket("us-gainers", markets.usGainers, "US top gainers will populate after the market data refresh. NASDAQ is linked for official verification.");
  renderMarket("sgx-gainers", markets.sgxGainers, "SGX movers will populate after refresh where source access is available. SGX is linked for official verification.");
  renderMarket("fund-gainers", markets.fundGainers, "Public official unit trust gainer feeds are limited. Use MAS FID and fund-house links to verify the latest fund factsheets.");
  renderMarket("crypto-prices", markets.crypto, "Crypto prices will populate after the daily refresh. Review exchange and product suitability before client use.");
  renderMarket("commodity-prices", markets.commodities, "Commodity prices will populate after the daily refresh. CME is linked for official futures reference.");
  renderFx(data.fx);
}

loadDashboard();
