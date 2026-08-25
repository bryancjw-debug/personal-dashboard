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
  ["SGX ETFs", "Singapore-listed ETF reference and product pages", "https://www.sgx.com/securities/etf"],
  ["MAS SSB", "Latest Singapore Savings Bond issue, rates, and applications", "https://www.mas.gov.sg/bonds-and-bills/Singapore-Savings-Bonds"],
  ["MAS T-bills", "Auction results and cut-off yields for Singapore T-bills", "https://eservices.mas.gov.sg/statistics/fdanet/BondTreasuryBillsCMTBsAuctions.aspx"]
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
    us: { gainers: [], losers: [] },
    sgx: { gainers: [], losers: [] },
    etfs: { gainers: [], losers: [] },
    crypto: { gainers: [], losers: [] },
    commodities: { gainers: [], losers: [] }
  },
  fx: [],
  governmentRates: {
    ssb: null,
    tbills: []
  },
  cryptoFocus: []
};

const fmt = new Intl.NumberFormat("en-SG", { maximumFractionDigits: 4 });
const compactFmt = new Intl.NumberFormat("en-SG", { notation: "compact", maximumFractionDigits: 2 });
const THEME_KEY = "marketBriefTheme";
const CRYPTO_HOLDINGS_KEY = "marketBriefCryptoHoldings";
const CRYPTO_LIVE_IDS = ["bitcoin", "ethereum", "hyperliquid"];
const CRYPTO_LIVE_URL = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=sgd&ids=${CRYPTO_LIVE_IDS.join(",")}&order=market_cap_desc&sparkline=false&price_change_percentage=1h,24h,7d,30d`;
const CRYPTO_BACKUP_IDS = {
  bitcoin: "coingecko:bitcoin",
  ethereum: "coingecko:ethereum",
  hyperliquid: "coingecko:hyperliquid"
};
const CRYPTO_BACKUP_URL = `https://coins.llama.fi/prices/current/${Object.values(CRYPTO_BACKUP_IDS).join(",")}`;
const USD_SGD_URL = "https://api.frankfurter.app/latest?from=USD&to=SGD";
const CRYPTO_LIVE_INTERVAL = 60000;
let cryptoFocusItems = [];
let cryptoLiveTimer = null;

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

function formatPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${number.toFixed(2)}%`;
}

function formatSignedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function formatSgd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  const digits = number < 1 ? 4 : number < 100 ? 2 : 0;
  return `S$${new Intl.NumberFormat("en-SG", { maximumFractionDigits: digits }).format(number)}`;
}

function formatCompactSgd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return `S$${compactFmt.format(number)}`;
}

function formatSignedSgd(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}${formatSgd(Math.abs(number))}`;
}

function setTheme(theme) {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = resolved;
  document.querySelector("meta[name='theme-color']")?.setAttribute("content", resolved === "dark" ? "#111316" : "#f7f7f5");

  const button = document.getElementById("theme-toggle");
  const label = document.getElementById("theme-label");
  if (button && label) {
    button.setAttribute("aria-pressed", String(resolved === "dark"));
    button.setAttribute("aria-label", resolved === "dark" ? "Switch to light mode" : "Switch to dark mode");
    label.textContent = resolved === "dark" ? "Dark" : "Light";
  }
}

function initTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  const preferred = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  setTheme(stored || preferred);
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
  });
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

function renderMarketList(container, items, emptyCopy) {
  container.replaceChildren();

  if (!items?.length) {
    container.append(emptyState(emptyCopy));
    return;
  }

  items.slice(0, 15).forEach((item) => {
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

function renderTabbedMarket(containerId, market, emptyCopy) {
  const container = document.getElementById(containerId);
  container.replaceChildren();

  const gainers = market?.gainers || [];
  const losers = market?.losers || [];

  if (!gainers.length && !losers.length) {
    container.append(emptyState(emptyCopy));
    return;
  }

  const tabs = create("div", "tab-list");
  const list = create("div", "market-list");
  const buttons = [
    ["gainers", "Top gainers", gainers],
    ["losers", "Top losers", losers]
  ].map(([key, label, items], index) => {
    const button = create("button", `tab-button ${index === 0 ? "is-active" : ""}`, label);
    button.type = "button";
    button.setAttribute("aria-pressed", String(index === 0));
    button.addEventListener("click", () => {
      tabs.querySelectorAll(".tab-button").forEach((node) => {
        node.classList.toggle("is-active", node === button);
        node.setAttribute("aria-pressed", String(node === button));
      });
      renderMarketList(list, items, emptyCopy);
    });
    return button;
  });

  tabs.append(...buttons);
  container.append(tabs, list);
  renderMarketList(list, gainers.length ? gainers : losers, emptyCopy);
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

function renderGovernmentRates(data) {
  const container = document.getElementById("government-rates");
  container.replaceChildren();

  const ssb = data?.ssb;
  const tbills = data?.tbills || [];

  if (!ssb && !tbills.length) {
    container.append(emptyState("SSB and T-bill rates will appear after the daily refresh. MAS source links are available above and in the source desk."));
    return;
  }

  if (ssb) {
    container.append(rateCard({
      kicker: "Singapore Savings Bond",
      title: ssb.issue || "Latest SSB",
      primary: formatPercent(ssb.tenYearAverage ?? ssb.averageReturn),
      primaryLabel: "10-year average return",
      secondary: `${formatPercent(ssb.yearOne)} year 1`,
      detail: [
        ssb.issueDate ? `Issues ${ssb.issueDate}` : null,
        ssb.closeDate ? `Closes ${ssb.closeDate}` : null,
        ssb.status || "Redeem monthly at par"
      ].filter(Boolean).join(" · "),
      url: ssb.url || "https://www.mas.gov.sg/bonds-and-bills/Singapore-Savings-Bonds"
    }));
  }

  tbills.slice(0, 2).forEach((bill) => {
    container.append(rateCard({
      kicker: bill.term || "Singapore T-bill",
      title: bill.issue || "Latest auction",
      primary: formatPercent(bill.cutoffYield),
      primaryLabel: "Cut-off yield p.a.",
      secondary: bill.bidToCover ? `${Number(bill.bidToCover).toFixed(2)}x bid-to-cover` : "Auction result",
      detail: [
        bill.auctionDate ? `Auction ${bill.auctionDate}` : null,
        bill.issueDate ? `Issue ${bill.issueDate}` : null,
        bill.maturityDate ? `Matures ${bill.maturityDate}` : null
      ].filter(Boolean).join(" · "),
      url: bill.url || "https://eservices.mas.gov.sg/statistics/fdanet/BondTreasuryBillsCMTBsAuctions.aspx"
    }));
  });
}

function loadCryptoHoldings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CRYPTO_HOLDINGS_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveCryptoHolding(assetId, value) {
  const holdings = loadCryptoHoldings();
  const amount = Number(value);
  if (Number.isFinite(amount) && amount > 0) {
    holdings[assetId] = amount;
  } else {
    delete holdings[assetId];
  }
  localStorage.setItem(CRYPTO_HOLDINGS_KEY, JSON.stringify(holdings));
}

function holdingValue(asset, holdings = loadCryptoHoldings()) {
  const amount = Number(holdings[asset.id]);
  const price = Number(asset.price);
  if (!Number.isFinite(amount) || !Number.isFinite(price)) return 0;
  return amount * price;
}

function holdingDayMove(asset, holdings = loadCryptoHoldings()) {
  const value = holdingValue(asset, holdings);
  const change = Number(asset.change24h);
  if (!Number.isFinite(value) || !Number.isFinite(change) || change <= -100) return 0;
  const previousValue = value / (1 + change / 100);
  return value - previousValue;
}

function updateCryptoLiveStatus(copy, state = "snapshot") {
  const node = document.getElementById("crypto-live-status");
  if (!node) return;
  node.classList.toggle("is-live", state === "live");
  node.classList.toggle("is-warning", state === "warning");
  node.lastChild.textContent = copy;
}

function renderCryptoPortfolio(items) {
  const container = document.getElementById("crypto-portfolio");
  if (!container) return;
  container.replaceChildren();

  if (!items?.length) {
    container.append(emptyState("Add BTC, ETH, and HYPE holdings once live prices or the latest daily snapshot loads."));
    return;
  }

  const holdings = loadCryptoHoldings();
  const positions = items.map((asset) => ({
    asset,
    amount: Number(holdings[asset.id]) || 0,
    value: holdingValue(asset, holdings),
    dayMove: holdingDayMove(asset, holdings)
  }));
  const totalValue = positions.reduce((sum, item) => sum + item.value, 0);
  const totalMove = positions.reduce((sum, item) => sum + item.dayMove, 0);
  const largest = positions.slice().sort((a, b) => b.value - a.value)[0];
  const activeCount = positions.filter((item) => item.amount > 0).length;

  [
    ["Portfolio value", formatSgd(totalValue), activeCount ? `${activeCount} tracked holding${activeCount === 1 ? "" : "s"}` : "Enter holdings below"],
    ["24h holding move", formatSignedSgd(totalMove), Number(totalMove) < 0 ? "Based on current 24h price move" : "Based on current 24h price move", totalMove < 0 ? "negative" : "positive"],
    ["Largest position", largest?.value ? largest.asset.symbol : "n/a", largest?.value ? formatSgd(largest.value) : "No holdings yet"]
  ].forEach(([label, value, detail, tone]) => {
    const card = create("article", `portfolio-card ${tone || ""}`.trim());
    card.append(create("span", "", label));
    card.append(create("strong", "", value));
    card.append(create("p", "", detail));
    container.append(card);
  });
}

function updateCryptoHoldingMetrics(card, asset) {
  const holdings = loadCryptoHoldings();
  const amount = Number(holdings[asset.id]) || 0;
  const value = holdingValue(asset, holdings);
  const move = holdingDayMove(asset, holdings);
  const valueNode = card.querySelector("[data-holding-value]");
  const moveNode = card.querySelector("[data-holding-move]");
  if (valueNode) valueNode.textContent = amount > 0 ? formatSgd(value) : "Add holding";
  if (moveNode) {
    moveNode.textContent = amount > 0 ? `${formatSignedSgd(move)} 24h` : "Local browser only";
    moveNode.classList.toggle("negative", move < 0);
    moveNode.classList.toggle("positive", move >= 0);
  }
}

function coinGeckoToCryptoFocus(coin, fallback) {
  const marketCap = Number(coin.market_cap);
  const volume24h = Number(coin.total_volume);
  const price = Number(coin.current_price);
  const ath = Number(coin.ath);
  return {
    ...fallback,
    id: coin.id,
    symbol: String(coin.symbol || fallback?.symbol || "").toUpperCase(),
    name: coin.name || fallback?.name,
    price,
    change1h: coin.price_change_percentage_1h_in_currency,
    change24h: coin.price_change_percentage_24h_in_currency ?? coin.price_change_percentage_24h,
    change7d: coin.price_change_percentage_7d_in_currency,
    change30d: coin.price_change_percentage_30d_in_currency,
    high24h: coin.high_24h,
    low24h: coin.low_24h,
    volume24h,
    marketCap,
    fdv: coin.fully_diluted_valuation,
    volumeToMarketCap: marketCap ? (volume24h / marketCap) * 100 : null,
    ath,
    athDrawdown: ath ? ((price - ath) / ath) * 100 : null,
    circulatingSupply: coin.circulating_supply,
    totalSupply: coin.total_supply,
    marketCapRank: coin.market_cap_rank,
    lastUpdated: coin.last_updated || new Date().toISOString(),
    url: `https://www.coingecko.com/en/coins/${coin.id}`
  };
}

async function fetchBackupCryptoPrices() {
  const [priceResponse, fxResponse] = await Promise.all([
    fetch(`${CRYPTO_BACKUP_URL}?t=${Date.now()}`, { cache: "no-store" }),
    fetch(`${USD_SGD_URL}&t=${Date.now()}`, { cache: "no-store" })
  ]);
  if (!priceResponse.ok) throw new Error(`DefiLlama returned ${priceResponse.status}`);
  if (!fxResponse.ok) throw new Error(`FX fallback returned ${fxResponse.status}`);

  const [priceJson, fxJson] = await Promise.all([
    priceResponse.json(),
    fxResponse.json()
  ]);
  const usdSgd = Number(fxJson?.rates?.SGD);
  if (!Number.isFinite(usdSgd)) throw new Error("USD/SGD fallback unavailable");
  const coins = priceJson?.coins || {};

  cryptoFocusItems = cryptoFocusItems.map((asset) => {
    const backup = coins[CRYPTO_BACKUP_IDS[asset.id]];
    const usdPrice = Number(backup?.price);
    if (!Number.isFinite(usdPrice)) return asset;
    return {
      ...asset,
      price: usdPrice * usdSgd,
      lastUpdated: backup?.timestamp ? new Date(backup.timestamp * 1000).toISOString() : new Date().toISOString()
    };
  });
  renderCryptoFocus(cryptoFocusItems);
  updateCryptoLiveStatus(`Live backup ${formatDate(new Date().toISOString())} SGT`, "live");
}

async function refreshLiveCryptoFocus() {
  if (!cryptoFocusItems.length) return;
  updateCryptoLiveStatus("Refreshing live prices...", "snapshot");
  try {
    const response = await fetch(`${CRYPTO_LIVE_URL}&t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
    const json = await response.json();
    const fallbackById = new Map(cryptoFocusItems.map((item) => [item.id, item]));
    const liveById = new Map(json.map((coin) => [coin.id, coin]));
    cryptoFocusItems = CRYPTO_LIVE_IDS.map((id) => {
      const coin = liveById.get(id);
      const fallback = fallbackById.get(id);
      return coin ? coinGeckoToCryptoFocus(coin, fallback) : fallback;
    }).filter(Boolean);
    renderCryptoFocus(cryptoFocusItems);
    updateCryptoLiveStatus(`Live ${formatDate(new Date().toISOString())} SGT`, "live");
  } catch (error) {
    try {
      await fetchBackupCryptoPrices();
    } catch (backupError) {
      updateCryptoLiveStatus("Snapshot prices - live fetch paused", "warning");
    }
  }
}

function renderCryptoFocus(items) {
  const container = document.getElementById("crypto-focus");
  container.replaceChildren();
  cryptoFocusItems = items || [];
  renderCryptoPortfolio(cryptoFocusItems);

  if (!items?.length) {
    container.append(emptyState("BTC, ETH, and HYPE detailed price-action metrics will populate after the daily refresh. CoinGecko is linked for direct verification."));
    return;
  }

  const holdings = loadCryptoHoldings();

  items.forEach((asset) => {
    const card = create("article", "crypto-focus-card");
    const header = create("div", "crypto-focus-header");
    const title = create("div");
    title.append(create("p", "card-kicker", asset.symbol || "Crypto"));
    title.append(create("h3", "", asset.name || asset.symbol || "Digital asset"));
    const rank = create("span", "pill", asset.marketCapRank ? `Rank #${asset.marketCapRank}` : "Tracked");
    header.append(title, rank);

    const priceRow = create("div", "crypto-price-row");
    priceRow.append(create("div", "crypto-price", formatSgd(asset.price)));
    priceRow.append(create("div", `crypto-main-change ${Number(asset.change24h) < 0 ? "negative" : ""}`, `${formatSignedPercent(asset.change24h)} 24h`));

    const moves = create("div", "crypto-move-grid");
    [
      ["1h", asset.change1h],
      ["7d", asset.change7d],
      ["30d", asset.change30d]
    ].forEach(([label, value]) => {
      const metric = create("div", "crypto-mini-metric");
      metric.append(create("span", "", label));
      metric.append(create("strong", Number(value) < 0 ? "negative" : "positive", formatSignedPercent(value)));
      moves.append(metric);
    });

    const metrics = create("div", "crypto-stat-grid");
    [
      ["24h high", formatSgd(asset.high24h)],
      ["24h low", formatSgd(asset.low24h)],
      ["24h volume", formatCompactSgd(asset.volume24h)],
      ["Market cap", formatCompactSgd(asset.marketCap)],
      ["FDV", formatCompactSgd(asset.fdv)],
      ["Vol / mcap", formatPercent(asset.volumeToMarketCap)],
      ["ATH drawdown", formatSignedPercent(asset.athDrawdown)],
      ["Supply", asset.circulatingSupply ? compactFmt.format(asset.circulatingSupply) : "n/a"]
    ].forEach(([label, value]) => {
      const metric = create("div", "crypto-stat");
      metric.append(create("span", "", label));
      metric.append(create("strong", "", value));
      metrics.append(metric);
    });

    const holding = create("div", "crypto-holding-panel");
    const holdingCopy = create("div");
    holdingCopy.append(create("span", "", `${asset.symbol} holding`));
    holdingCopy.append(create("strong", "", holdings[asset.id] ? `${fmt.format(holdings[asset.id])} ${asset.symbol}` : "Not set"));
    const input = create("input", "crypto-holding-input");
    input.type = "number";
    input.inputMode = "decimal";
    input.min = "0";
    input.step = "any";
    input.placeholder = `0 ${asset.symbol}`;
    input.value = holdings[asset.id] || "";
    input.setAttribute("aria-label", `${asset.symbol} holding amount`);
    holding.append(holdingCopy, input);

    const holdingMetrics = create("div", "crypto-holding-metrics");
    const valueMetric = create("div", "crypto-stat");
    valueMetric.append(create("span", "", "Holding value"));
    valueMetric.append(create("strong", "", "Add holding"));
    valueMetric.querySelector("strong").dataset.holdingValue = asset.id;
    const moveMetric = create("div", "crypto-stat");
    moveMetric.append(create("span", "", "Holding 24h move"));
    moveMetric.append(create("strong", "positive", "Local browser only"));
    moveMetric.querySelector("strong").dataset.holdingMove = asset.id;
    holdingMetrics.append(valueMetric, moveMetric);

    input.addEventListener("input", () => {
      saveCryptoHolding(asset.id, input.value);
      const updatedHoldings = loadCryptoHoldings();
      holdingCopy.querySelector("strong").textContent = updatedHoldings[asset.id] ? `${fmt.format(updatedHoldings[asset.id])} ${asset.symbol}` : "Not set";
      updateCryptoHoldingMetrics(card, asset);
      renderCryptoPortfolio(cryptoFocusItems);
    });

    const footer = create("div", "crypto-card-footer");
    footer.append(create("span", "", asset.lastUpdated ? `Updated ${formatDate(asset.lastUpdated)} SGT` : "Refresh pending"));
    const link = create("a", "button");
    link.href = asset.url || "https://www.coingecko.com/";
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Open";
    footer.append(link);

    card.append(header, priceRow, moves, metrics, holding, holdingMetrics, footer);
    updateCryptoHoldingMetrics(card, asset);
    container.append(card);
  });
}

function rateCard(item) {
  const card = create("a", "rate-card");
  card.href = item.url;
  card.target = "_blank";
  card.rel = "noopener";
  card.append(create("p", "card-kicker", item.kicker));
  card.append(create("h3", "", item.title));
  const value = create("div", "rate-value", item.primary);
  card.append(value);
  card.append(create("div", "rate-label", item.primaryLabel));
  card.append(create("div", "rate-secondary", item.secondary));
  if (item.detail) card.append(create("p", "row-meta", item.detail));
  return card;
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
  const legacyPair = (gainers, losers = []) => ({ gainers: gainers || [], losers: losers || [] });
  return {
    us: data.markets?.us || legacyPair(data.markets?.usGainers, data.markets?.usLosers),
    sgx: data.markets?.sgx || legacyPair(data.markets?.sgxGainers, data.markets?.sgxLosers),
    etfs: data.markets?.etfs || legacyPair(data.markets?.fundGainers, data.markets?.fundLosers),
    crypto: Array.isArray(data.markets?.crypto) ? legacyPair(data.markets.crypto) : (data.markets?.crypto || legacyPair()),
    commodities: Array.isArray(data.markets?.commodities) ? legacyPair(data.markets.commodities) : (data.markets?.commodities || legacyPair())
  };
}

async function loadDashboard() {
  initTheme();
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
  renderGovernmentRates(data.governmentRates);
  renderCryptoFocus(data.cryptoFocus);
  updateCryptoLiveStatus(data.cryptoFocus?.length ? "Snapshot prices - connecting live" : "Snapshot prices", "snapshot");
  if (cryptoLiveTimer) window.clearInterval(cryptoLiveTimer);
  await refreshLiveCryptoFocus();
  cryptoLiveTimer = window.setInterval(refreshLiveCryptoFocus, CRYPTO_LIVE_INTERVAL);
  renderTabbedMarket("us-market", markets.us, "US market movers will populate after the data refresh. NASDAQ is linked for official verification.");
  renderTabbedMarket("sgx-market", markets.sgx, "SGX movers will populate after refresh. SGX is linked for official verification.");
  renderTabbedMarket("etf-market", markets.etfs, "ETF movers will populate after refresh across Singapore and US ETF watchlists.");
  renderTabbedMarket("crypto-market", markets.crypto, "Crypto movers will populate after the daily refresh. Review exchange and product suitability before client use.");
  renderTabbedMarket("commodity-market", markets.commodities, "Commodity movers will populate after the daily refresh. CME is linked for official futures reference.");
  renderFx(data.fx);
}

loadDashboard();
