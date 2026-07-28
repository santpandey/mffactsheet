/**
 * Multi-Fund Allocation Tracker
 * Supports multiple mutual funds with fund selector
 */

// Fund configurations
const FUNDS = {
  CanaraRobecoLargeAndMidCapFund: {
    name: "Canara Robeco Large and Mid Cap Fund",
    displayName: "Canara Robeco",
  },
  MiraeAssetLargeAndMidcapFund: {
    name: "Mirae Asset Large & Midcap Fund",
    displayName: "Mirae Asset",
  },
  SBIChildrensFund: {
    name: "SBI Children's Fund - Investment Plan",
    displayName: "SBI Children's",
  },
};

const MONTHS_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

let currentFund = "CanaraRobecoLargeAndMidCapFund";
let allData = {};
let currentData = null;
let currentDelta = null;
let currentFilter = "all";
let allocationChart = null;
let pieChart = null;
let deltaChart = null;
let availableMonths = [];

async function loadAvailableMonths() {
  const available = {};
  for (const fundKey of Object.keys(FUNDS)) {
    available[fundKey] = [];
    if (!allData[fundKey]) allData[fundKey] = {};
  }

  let fileNames = [];

  // Authoritative local source: directory listing avoids guessing filenames (and avoids 404 spam)
  try {
    const listingResponse = await fetch("data/");
    if (listingResponse.ok) {
      const listingHtml = await listingResponse.text();
      const matches = listingHtml.matchAll(/href="([^"]+\.json)"/gi);
      fileNames = Array.from(matches, (m) => decodeURIComponent(m[1])).filter(
        (name) => name !== "manifest.json",
      );
    }
  } catch (e) {
    console.warn("Unable to read data directory listing.", e);
  }

  // Fallback for hosts without directory listing support
  if (fileNames.length === 0) {
    try {
      const manifestResponse = await fetch("data/manifest.json");
      if (manifestResponse.ok) {
        const manifest = await manifestResponse.json();
        fileNames = Object.values(manifest)
          .flat()
          .map((entry) => entry.filename)
          .filter(Boolean);
      }
    } catch (e) {
      console.warn("No manifest available for data discovery.", e);
    }
  }

  const uniqueFiles = [...new Set(fileNames)];
  const filePattern = /^([A-Za-z0-9]+)-([A-Za-z]+)-(\d{4})\.json$/;

  for (const filename of uniqueFiles) {
    const match = filename.match(filePattern);
    if (!match) continue;

    const [, fundKey, month, yearText] = match;
    if (!FUNDS[fundKey]) continue;

    const year = Number(yearText);
    const key = `${month}-${year}`;

    try {
      const response = await fetch(`data/${filename}`);
      if (!response.ok) continue;

      const data = await response.json();
      allData[fundKey][key] = data;
      available[fundKey].push({ month, year, key });
    } catch (e) {
      console.error(`Failed to load ${filename}`, e);
    }
  }

  for (const fundKey of Object.keys(available)) {
    available[fundKey].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return MONTHS_ORDER.indexOf(a.month) - MONTHS_ORDER.indexOf(b.month);
    });
  }

  return available;
}

function populateFundSelector(available) {
  const fundSelect = document.getElementById("fundSelect");
  fundSelect.innerHTML = "";

  for (const [fundKey, fundConfig] of Object.entries(FUNDS)) {
    if (available[fundKey] && available[fundKey].length > 0) {
      const option = document.createElement("option");
      option.value = fundKey;
      option.textContent = `${fundConfig.displayName} (${available[fundKey].length} months)`;
      fundSelect.appendChild(option);
    }
  }

  fundSelect.value = currentFund;
}

function populateDropdowns(available) {
  const monthSelect = document.getElementById("monthSelect");
  const compareSelect = document.getElementById("compareSelect");

  const fundMonths = available[currentFund] || [];

  monthSelect.innerHTML = "";
  compareSelect.innerHTML =
    '<option value="">Select month to compare with...</option>';

  if (fundMonths.length > 1) {
    const selectAllOption = document.createElement("option");
    selectAllOption.value = "compare-all";
    selectAllOption.textContent = "📊 Select All (Historical Change)";
    compareSelect.appendChild(selectAllOption);

    const separator = document.createElement("option");
    separator.disabled = true;
    separator.textContent = "─────────────────";
    compareSelect.appendChild(separator);
  }

  fundMonths.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = `${item.month} ${item.year}`;
    monthSelect.appendChild(option);

    const compareOption = option.cloneNode(true);
    compareSelect.appendChild(compareOption);
  });

  if (fundMonths.length > 0) {
    monthSelect.value = fundMonths[fundMonths.length - 1].key;
  }
}

function formatNumber(num) {
  if (num === null || num === undefined) return "-";
  return new Intl.NumberFormat("en-IN").format(Math.round(num));
}

function formatPercent(num) {
  if (num === null || num === undefined) return "-";
  return num.toFixed(2) + "%";
}

function formatDelta(num) {
  if (num === null || num === undefined) return "-";
  const sign = num >= 0 ? "+" : "";
  return sign + num.toFixed(2) + "%";
}

function updateStats(data) {
  document.getElementById("totalHoldings").textContent = data.holdings.length;

  if (data.holdings.length > 0) {
    const top = data.holdings[0];
    document.getElementById("topHolding").textContent =
      `${top.company.substring(0, 20)}${top.company.length > 20 ? "..." : ""} (${formatPercent(top.percentOfNAV)})`;

    const top10Sum = data.holdings
      .slice(0, 10)
      .reduce((sum, h) => sum + (h.percentOfNAV || 0), 0);
    document.getElementById("top10Concentration").textContent =
      formatPercent(top10Sum);
  }

  // Update fund name display
  document.getElementById("currentFundName").textContent =
    FUNDS[currentFund].name;
}

function getChartColors(count) {
  const baseColors = [
    "#2563eb",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#6366f1",
    "#14b8a6",
    "#a855f7",
    "#eab308",
    "#22c55e",
    "#3b82f6",
  ];
  return Array.from(
    { length: count },
    (_, i) => baseColors[i % baseColors.length],
  );
}

function renderAllocationChart(data) {
  const ctx = document.getElementById("allocationChart").getContext("2d");
  if (allocationChart) allocationChart.destroy();

  const top15 = data.holdings.slice(0, 15);
  const labels = top15.map((h) =>
    h.company.length > 25 ? h.company.substring(0, 25) + "..." : h.company,
  );
  const values = top15.map((h) => h.percentOfNAV || 0);

  allocationChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "% of NAV",
          data: values,
          backgroundColor: getChartColors(15),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => `${ctx.parsed.x.toFixed(2)}%` },
        },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: "% of NAV" } },
      },
    },
  });
}

function renderPieChart(data) {
  const ctx = document.getElementById("pieChart").getContext("2d");
  if (pieChart) pieChart.destroy();

  const top10 = data.holdings.slice(0, 10);
  const othersSum = data.holdings
    .slice(10)
    .reduce((sum, h) => sum + (h.percentOfNAV || 0), 0);

  const labels = top10.map((h) =>
    h.company.length > 20 ? h.company.substring(0, 20) + "..." : h.company,
  );
  const values = top10.map((h) => h.percentOfNAV || 0);

  if (othersSum > 0) {
    labels.push("Others");
    values.push(othersSum);
  }

  pieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: getChartColors(labels.length),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { boxWidth: 12, padding: 8, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(2)}%`,
          },
        },
      },
    },
  });
}

function calculateDelta(current, previous) {
  const currentMap = new Map();
  const previousMap = new Map();

  current.holdings.forEach((h) => currentMap.set(h.company.toLowerCase(), h));
  previous.holdings.forEach((h) => previousMap.set(h.company.toLowerCase(), h));

  const delta = { added: [], removed: [], changed: [], all: [] };

  currentMap.forEach((holding, key) => {
    const prev = previousMap.get(key);
    if (!prev) {
      delta.added.push({
        company: holding.company,
        currentNAV: holding.percentOfNAV,
        previousNAV: 0,
        navDelta: holding.percentOfNAV || 0,
        status: "new",
      });
    } else {
      const navDelta = (holding.percentOfNAV || 0) - (prev.percentOfNAV || 0);
      delta.changed.push({
        company: holding.company,
        currentNAV: holding.percentOfNAV,
        previousNAV: prev.percentOfNAV,
        navDelta: navDelta,
        status:
          navDelta > 0 ? "increased" : navDelta < 0 ? "decreased" : "unchanged",
      });
    }
  });

  previousMap.forEach((holding, key) => {
    if (!currentMap.has(key)) {
      delta.removed.push({
        company: holding.company,
        currentNAV: 0,
        previousNAV: holding.percentOfNAV,
        navDelta: -(holding.percentOfNAV || 0),
        status: "exited",
      });
    }
  });

  delta.all = [...delta.added, ...delta.changed, ...delta.removed];
  delta.all.sort((a, b) => Math.abs(b.navDelta) - Math.abs(a.navDelta));

  return delta;
}

function renderDeltaChart(delta) {
  const ctx = document.getElementById("deltaChart").getContext("2d");
  if (deltaChart) deltaChart.destroy();

  const top20 = delta.all.slice(0, 20);
  const labels = top20.map((d) =>
    d.company.length > 30 ? d.company.substring(0, 30) + "..." : d.company,
  );
  const values = top20.map((d) => d.navDelta);
  const colors = values.map((v) => (v >= 0 ? "#10b981" : "#ef4444"));

  deltaChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "% of NAV Change",
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed.x;
              const sign = val >= 0 ? "+" : "";
              return `${sign}${val.toFixed(2)}% of NAV`;
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Change in % of NAV" } },
      },
    },
  });
}

function formatMonthKey(key) {
  if (!key || key === "compare-all") return "";
  const [month, year] = key.split("-");
  return `${month.substring(0, 3)} ${year}`;
}

function renderTable(
  delta,
  filter = "all",
  currentMonthKey = "",
  previousMonthKey = "",
) {
  const headerCurrent = document.getElementById("headerCurrent");
  const headerPrevious = document.getElementById("headerPrevious");

  const currentLabel = formatMonthKey(currentMonthKey);
  const prevLabel = formatMonthKey(previousMonthKey);

  if (headerCurrent) {
    headerCurrent.textContent = currentLabel
      ? `Current % (${currentLabel})`
      : "Current %";
  }
  if (headerPrevious) {
    headerPrevious.textContent = prevLabel
      ? `Previous % (${prevLabel})`
      : "Previous %";
  }

  const tbody = document.getElementById("holdingsBody");

  let items = [];
  switch (filter) {
    case "added":
      items = [...delta.added];
      break;
    case "removed":
      items = [...delta.removed];
      break;
    case "changed":
      items = [...delta.changed];
      break;
    default:
      items = [...delta.all];
  }

  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  if (searchTerm) {
    items = items.filter((h) => h.company.toLowerCase().includes(searchTerm));
  }

  const sortValue = document.getElementById("sortSelect").value;
  switch (sortValue) {
    case "nav-desc":
      items.sort((a, b) => (b.currentNAV || 0) - (a.currentNAV || 0));
      break;
    case "nav-asc":
      items.sort((a, b) => (a.currentNAV || 0) - (b.currentNAV || 0));
      break;
    case "delta-desc":
      items.sort((a, b) => (b.navDelta || 0) - (a.navDelta || 0));
      break;
    case "delta-asc":
      items.sort((a, b) => (a.navDelta || 0) - (b.navDelta || 0));
      break;
    case "name-asc":
      items.sort((a, b) => a.company.localeCompare(b.company));
      break;
  }

  tbody.innerHTML = items
    .map((h, i) => {
      let statusClass = "";
      let statusText = "";

      if (h.status === "new") {
        statusClass = "delta-new";
        statusText = "NEW";
      } else if (h.status === "exited") {
        statusClass = "delta-exited";
        statusText = "EXITED";
      } else if (h.navDelta > 0) {
        statusClass = "delta-positive";
        statusText = "INCREASED";
      } else if (h.navDelta < 0) {
        statusClass = "delta-negative";
        statusText = "DECREASED";
      } else {
        statusText = "NO CHANGE";
      }

      const changeClass = h.navDelta >= 0 ? "delta-positive" : "delta-negative";

      return `
      <tr>
        <td>${i + 1}</td>
        <td>${h.company}</td>
        <td>${formatPercent(h.currentNAV)}</td>
        <td>${formatPercent(h.previousNAV)}</td>
        <td class="${changeClass}">${formatDelta(h.navDelta)}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
      </tr>
    `;
    })
    .join("");
}

function setActiveFilter(filter) {
  currentFilter = filter;

  document.querySelectorAll(".delta-stat.clickable").forEach((card) => {
    card.classList.remove("active");
  });
  const activeCard = document.querySelector(`[data-filter="${filter}"]`);
  if (activeCard) {
    activeCard.classList.add("active");
  }

  const filterLabels = {
    all: "",
    added: "- New Entries Only",
    removed: "- Exited Stocks Only",
    changed: "- Changed Stocks Only",
  };
  document.getElementById("tableFilterLabel").textContent =
    filterLabels[filter] || "";

  if (currentDelta) {
    const currentKey = document.getElementById("monthSelect").value;
    const compareKey = document.getElementById("compareSelect").value;
    const fundMonths = availableMonths[currentFund] || [];
    const prevMonth =
      compareKey === "compare-all" ? fundMonths[0].key : compareKey;

    renderTable(currentDelta, filter, currentKey, prevMonth);

    document
      .getElementById("tableSection")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showDelta() {
  const currentKey = document.getElementById("monthSelect").value;
  const compareKey = document.getElementById("compareSelect").value;

  if (!compareKey) {
    alert("Please select a month to compare with");
    return;
  }

  const fundData = allData[currentFund] || {};
  const current = fundData[currentKey];

  // Handle "Select All (Historical Change)" option
  let previous;
  let actualPrevKey;
  if (compareKey === "compare-all") {
    const fundMonths = availableMonths[currentFund] || [];
    if (fundMonths.length === 0) {
      alert("No data available");
      return;
    }
    actualPrevKey = fundMonths[0].key;
    previous = fundData[actualPrevKey];
  } else {
    actualPrevKey = compareKey;
    previous = fundData[compareKey];
  }

  if (!current || !previous) {
    alert("Data not available for selected months");
    return;
  }

  document.getElementById("deltaSection").style.display = "block";
  document.getElementById("minInvestSection").style.display = "none";

  currentDelta = calculateDelta(current, previous);
  currentFilter = "all";

  const titleText =
    compareKey === "compare-all"
      ? `${currentKey} vs ${actualPrevKey} (Historical Change)`
      : `${currentKey} vs ${compareKey}`;
  document.getElementById("deltaTitle").textContent = titleText;

  document.getElementById("newEntries").textContent = currentDelta.added.length;
  document.getElementById("exitedEntries").textContent =
    currentDelta.removed.length;
  document.getElementById("changedEntries").textContent =
    currentDelta.changed.length;
  document.getElementById("allEntries").textContent = currentDelta.all.length;

  document
    .querySelectorAll(".delta-stat.clickable")
    .forEach((card) => card.classList.remove("active"));
  document.getElementById("filterAll").classList.add("active");

  renderDeltaChart(currentDelta);
  renderTable(currentDelta, "all", currentKey, actualPrevKey);

  setTimeout(() => {
    document
      .getElementById("deltaSection")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

function displayMonth(key) {
  const fundData = allData[currentFund] || {};
  const data = fundData[key];
  if (!data) return;

  currentData = data;
  currentDelta = null;

  updateStats(data);
  renderAllocationChart(data);
  renderPieChart(data);

  document.getElementById("deltaSection").style.display = "none";
}

// ---------------------------------------------------------------------------
// Diff Export + Minimum Investment Summary
// ---------------------------------------------------------------------------

// Cache: symbol -> last closing price (₹)
const _priceCache = new Map();

// Cache: normalizedName -> NSE symbol (populated from EQUITY_L.csv)
const _nseSymbolMap = new Map();
let _nseMapLoaded = false;

/**
 * Normalise a company name for fuzzy matching:
 * lowercase, strip legal suffixes, remove punctuation.
 */
function _normName(s) {
  return s
    .toLowerCase()
    .replace(/\b(limited|ltd\.?|pvt\.?|private|corporation|corp\.?)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Load NSE EQUITY_L.csv (Symbol, Name_of_Company, ...) from NSE archives.
 * Falls back silently — hardcoded overrides still apply.
 * CSV URL via corsproxy.io to bypass CORS.
 */
async function _loadNseSymbolMap() {
  if (_nseMapLoaded) return;
  _nseMapLoaded = true; // mark early to prevent parallel loads
  const csvUrl =
    "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(csvUrl)}`;
  try {
    const res = await fetch(proxyUrl);
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.split("\n").slice(1); // skip header
    for (const line of lines) {
      if (!line.trim()) continue;
      // Format: SYMBOL,"NAME OF COMPANY",SERIES,...
      const parts = line.split(",");
      if (parts.length < 2) continue;
      const symbol = parts[0].trim().replace(/"/g, "");
      const rawName = parts[1].trim().replace(/"/g, "");
      if (!symbol || !rawName) continue;
      const key = _normName(rawName);
      if (key) _nseSymbolMap.set(key, symbol);
    }
  } catch {
    // silently fall back to hardcoded overrides
  }
}

/**
 * Find NSE symbol for a company name using the loaded CSV map.
 * Uses substring matching on normalised names.
 */
function _lookupInNseMap(name) {
  if (_nseSymbolMap.size === 0) return null;
  const query = _normName(name);
  // Exact match first
  if (_nseSymbolMap.has(query)) return _nseSymbolMap.get(query);
  // Substring: find the CSV entry whose name contains our query (or vice versa)
  let best = null;
  let bestLen = 0;
  for (const [key, symbol] of _nseSymbolMap) {
    if (key.includes(query) || query.includes(key)) {
      // prefer the longer (more specific) key match
      if (key.length > bestLen) {
        bestLen = key.length;
        best = symbol;
      }
    }
  }
  return best;
}

/**
 * Derive NSE ticker symbol from fund holding company name.
 * Priority: 1) hardcoded overrides  2) EQUITY_L.csv lookup  3) generic fallback
 * Yahoo Finance uses ".NS" suffix for NSE symbols.
 */
function _toNseTicker(name) {
  const overrides = {
    // Large caps
    "reliance industries": "RELIANCE",
    "hdfc bank": "HDFCBANK",
    infosys: "INFY",
    "tata consultancy services": "TCS",
    "icici bank": "ICICIBANK",
    "kotak mahindra bank": "KOTAKBANK",
    "axis bank": "AXISBANK",
    "larsen & toubro": "LT",
    "larsen and toubro": "LT",
    "bharti airtel": "BHARTIARTL",
    "state bank of india": "SBIN",
    "hindustan unilever": "HINDUNILVR",
    itc: "ITC",
    "bajaj finance": "BAJFINANCE",
    "maruti suzuki": "MARUTI",
    "sun pharmaceutical": "SUNPHARMA",
    wipro: "WIPRO",
    "hcl technologies": "HCLTECH",
    "titan co": "TITAN",
    "titan company": "TITAN",
    "asian paints": "ASIANPAINT",
    "ultratech cement": "ULTRACEMCO",
    "tata motors": "TATAMOTORS",
    "power grid corporation": "POWERGRID",
    "power grid corp": "POWERGRID",
    ntpc: "NTPC",
    ongc: "ONGC",
    "oil & natural gas": "ONGC",
    "mahindra & mahindra": "M&M",
    "adani enterprises": "ADANIENT",
    "adani ports": "ADANIPORTS",
    "adani green": "ADANIGREEN",
    "adani total gas": "ATGL",
    "adani transmission": "ADANITRANS",
    "jsw steel": "JSWSTEEL",
    "tata steel": "TATASTEEL",
    "dr. reddy": "DRREDDY",
    "dr reddy": "DRREDDY",
    cipla: "CIPLA",
    "divis laboratories": "DIVISLAB",
    "divi's laboratories": "DIVISLAB",
    "eicher motors": "EICHERMOT",
    "hero motocorp": "HEROMOTOCO",
    "bajaj auto": "BAJAJ-AUTO",
    "sbi life insurance": "SBILIFE",
    "hdfc life insurance": "HDFCLIFE",
    "apollo hospitals": "APOLLOHOSP",
    "britannia industries": "BRITANNIA",
    "nestle india": "NESTLEIND",
    "pidilite industries": "PIDILITIND",
    "havells india": "HAVELLS",
    dmart: "DMART",
    "avenue supermarts": "DMART",
    zomato: "ZOMATO",
    nykaa: "NYKAA",
    "fsl beauty": "NYKAA",
    paytm: "PAYTM",
    "one 97": "PAYTM",
    // Mid caps
    "billionbrains garage": "HONASA",
    honasa: "HONASA",
    mamaearth: "HONASA",
    "premier energies": "PREMIENRG",
    biocon: "BIOCON",
    "hindustan aeronautics": "HAL",
    hal: "HAL",
    "balkrishna industries": "BALKRISIND",
    "hindustan petroleum": "HINDPETRO",
    "pb fintech": "PBFINTECH",
    policybazaar: "PBFINTECH",
    "jubilant foodworks": "JUBLFOOD",
    "jubilant food": "JUBLFOOD",
    "persistent systems": "PERSISTENT",
    mphasis: "MPHASIS",
    ltimindtree: "LTIM",
    "lti mindtree": "LTIM",
    "l&t technology": "LTTS",
    "l&t finance": "LTF",
    "shriram finance": "SHRIRAMFIN",
    "cholamandalam investment": "CHOLAFIN",
    cholamandalam: "CHOLAFIN",
    "max financial": "MFSL",
    "muthoot finance": "MUTHOOTFIN",
    "bajaj finserv": "BAJAJFINSV",
    "icici prudential": "ICICIPRULI",
    "sbi cards": "SBICARD",
    "indusind bank": "INDUSINDBK",
    "yes bank": "YESBANK",
    "bank of baroda": "BANKBARODA",
    "canara bank": "CANARABANK",
    "punjab national bank": "PNB",
    "union bank": "UNIONBANK",
    "indian bank": "INDIANB",
    "federal bank": "FEDERALBNK",
    "idfc first bank": "IDFCFIRSTB",
    "bandhan bank": "BANDHANBNK",
    "tata power": "TATAPOWER",
    "tata chemicals": "TATACHEM",
    "tata consumer": "TATACONSUM",
    "tata elxsi": "TATAELXSI",
    "tata communications": "TATACOMM",
    voltas: "VOLTAS",
    "cummins india": "CUMMINSIND",
    "polycab india": "POLYCAB",
    "dixon technologies": "DIXON",
    "blue star": "BLUESTARCO",
    "crompton greaves consumer": "CROMPTON",
    "bata india": "BATAIND",
    "page industries": "PAGEIND",
    "metro brands": "METROBRAND",
    "dalmia bharat": "DALMIA",
    "shree cement": "SHREECEM",
    acc: "ACC",
    "ambuja cements": "AMBUJACEM",
    birlasoft: "BSOFT",
    "kpit technologies": "KPITTECH",
    "tata technologies": "TATATECH",
    cyient: "CYIENT",
    coforge: "COFORGE",
    "happiest minds": "HAPPSTMNDS",
    "solar industries": "SOLARINDS",
    "hindustan zinc": "HINDZINC",
    vedanta: "VEDL",
    "national aluminium": "NALCO",
    hindalco: "HINDALCO",
    nmdc: "NMDC",
    "coal india": "COALINDIA",
    "oil india": "OIL",
    "petronet lng": "PETRONET",
    gail: "GAIL",
    "indraprastha gas": "IGL",
    "mahanagar gas": "MGL",
    "gujarat gas": "GUJGASLTD",
    "torrent power": "TORNTPOWER",
    "jsw energy": "JSWENERGY",
    "suzlon energy": "SUZLON",
    "kalpataru projects": "KPIL",
    "abb india": "ABB",
    siemens: "SIEMENS",
    "bharat heavy electricals": "BHEL",
    bhel: "BHEL",
    "bharat electronics": "BEL",
    bel: "BEL",
    rites: "RITES",
    rvnl: "RVNL",
    "rail vikas nigam": "RVNL",
    "indian hotels": "INDHOTEL",
    ihcl: "INDHOTEL",
    "lemon tree": "LEMONTREE",
    irctc: "IRCTC",
    "indian railway catering": "IRCTC",
    "container corporation": "CONCOR",
    delhivery: "DELHIVERY",
    "interglobe aviation": "INDIGO",
    indigo: "INDIGO",
    "gland pharma": "GLAND",
    "alkem laboratories": "ALKEM",
    "ipca laboratories": "IPCALAB",
    "aarti industries": "AARTIIND",
    "navin fluorine": "NAVINFLUOR",
    srf: "SRF",
    "deepak nitrite": "DEEPAKNTR",
    "pi industries": "PIIND",
    upl: "UPL",
    "coromandel international": "COROMANDEL",
    "chambal fertilisers": "CHAMBLFERT",
  };
  const lower = name
    .toLowerCase()
    .replace(/\s+ltd\.?$/i, "")
    .replace(/\s+limited$/i, "")
    .trim();
  // 1) Hardcoded overrides
  for (const [key, ticker] of Object.entries(overrides)) {
    if (lower.includes(key)) return ticker + ".NS";
  }
  // 2) Dynamic NSE EQUITY_L.csv map (loaded async before this is called)
  const fromCsv = _lookupInNseMap(name);
  if (fromCsv) return fromCsv + ".NS";
  // 3) Generic string-munge fallback
  const generic = lower
    .replace(
      /\s+(ltd|limited|pvt|private|india|industries|corporation|company|enterprises|technologies|solutions|services|group)$/i,
      "",
    )
    .replace(/[^a-z0-9&]/gi, "")
    .toUpperCase()
    .slice(0, 10);
  return generic + ".NS";
}

/**
 * Fetch last closing price for a single Yahoo Finance ticker.
 * Yahoo Finance blocks direct browser fetches (CORS), so we route through
 * corsproxy.io which adds the required CORS headers transparently.
 */
async function _fetchOneTicker(ticker) {
  if (_priceCache.has(ticker)) return;
  const yhUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  // Try direct first (works in some environments), fallback to CORS proxy
  const urls = [
    yhUrl,
    `https://corsproxy.io/?url=${encodeURIComponent(yhUrl)}`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const meta = json?.chart?.result?.[0]?.meta;
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
      const price =
        meta?.chartPreviousClose ??
        meta?.regularMarketPrice ??
        (closes ? closes.filter(Boolean).at(-1) : null);
      if (price) {
        _priceCache.set(ticker, +price.toFixed(2));
        return; // success
      }
    } catch {
      // try next url
    }
  }
}

/**
 * Fetch prices for all tickers in parallel (capped at 8 concurrent).
 */
async function _fetchPrices(tickers) {
  const missing = tickers.filter((t) => !_priceCache.has(t));
  if (missing.length === 0) return;

  const CONCURRENCY = 8;
  for (let i = 0; i < missing.length; i += CONCURRENCY) {
    const batch = missing.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((t) => _fetchOneTicker(t)));
  }
}

/**
 * Parse Indian rupee budget string — handles 1,00,000 / 100000 / ₹50000
 */
function _parseBudget(str) {
  if (!str || !str.trim()) return null;
  const clean = str.replace(/[,\s₹]/g, "");
  const n = parseFloat(clean);
  return isNaN(n) || n <= 0 ? null : n;
}

/**
 * Build enriched diff rows with prices and budget-aware quantities.
 *
 * Base qty logic (no budget):
 *   - Use the 10th-percentile |navDelta| as base unit to avoid exploding
 *     ratios when one stock barely moved.
 *   - qty = round(delta / baseDelta), capped at 20.
 *   - Smallest movers get qty 1.
 *
 * Budget logic (budget provided):
 *   - Compute base total cost at qty above.
 *   - Find integer multiplier M = floor(budget / baseTotal).
 *   - Apply M to all qtys so total fits within budget.
 */
async function _buildEnrichedRows() {
  if (!currentDelta) return [];

  // Load NSE master CSV first (no-op if already loaded)
  await _loadNseSymbolMap();

  const actionable = currentDelta.all.filter((d) => d.status !== "unchanged");
  const tickers = actionable.map((d) => _toNseTicker(d.company));
  await _fetchPrices(tickers);

  const deltas = actionable.map((d) => Math.abs(d.navDelta));
  const maxDelta = Math.max(...deltas, 0.0001);

  // Normalize: largest mover gets qty 10, all others scale proportionally.
  // This avoids any arbitrary cap while keeping numbers meaningful.
  // e.g. a stock with 50% of max delta → qty 5, 20% → qty 2, etc.
  const REF_QTY = 10;
  const baseQtys = deltas.map((d) =>
    Math.max(1, Math.round((d / maxDelta) * REF_QTY)),
  );

  // Budget scaling
  const budget = _parseBudget(document.getElementById("budgetInput").value);
  let multiplier = 1;
  if (budget) {
    const baseTotal = actionable.reduce((s, d, i) => {
      const price = _priceCache.get(tickers[i]) ?? null;
      return s + (price ? price * baseQtys[i] : 0);
    }, 0);
    if (baseTotal > 0) {
      multiplier = Math.max(1, Math.floor(budget / baseTotal));
    }
  }

  return actionable.map((d, i) => {
    const ticker = tickers[i];
    const price = _priceCache.get(ticker) ?? null;
    const absDelta = Math.abs(d.navDelta);
    const weight = absDelta / maxDelta;
    const qty = baseQtys[i] * multiplier;
    return {
      company: d.company,
      ticker: ticker.replace(".NS", ""),
      status: d.status,
      change_pct: +d.navDelta.toFixed(4),
      weight: +(weight * 100).toFixed(1),
      price,
      qty,
      min_investment: price ? +(price * qty).toFixed(2) : null,
    };
  });
}

// Cached rows from last fetch — used to re-render on multiplier change
let _lastEnrichedRows = [];
let _lotMultiplier = 1;

function _inr(n) {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function _renderInvestTable() {
  const rows = _lastEnrichedRows;
  if (!rows.length) return;
  const m = _lotMultiplier;
  let running = 0;
  const priced = rows.filter((r) => r.price !== null).length;

  const rowsHtml = rows
    .map((r) => {
      const cls = r.change_pct >= 0 ? "export-positive" : "export-negative";
      const sign = r.change_pct >= 0 ? "+" : "";
      const qty = r.qty * m;
      const inv = r.price != null ? r.price * qty : null;
      if (inv != null) running += inv;
      return `<tr>
          <td>${r.company}</td>
          <td><span class="export-ticker">${r.ticker}</span></td>
          <td class="${cls}">${sign}${r.change_pct}%</td>
          <td>${r.weight}%</td>
          <td>${r.price != null ? _inr(r.price) : "<span class='na-cell'>N/A</span>"}</td>
          <td>${qty}</td>
          <td>${inv != null ? _inr(inv) : "<span class='na-cell'>N/A</span>"}</td>
          <td class="running-total">${inv != null ? _inr(running) : "—"}</td>
        </tr>`;
    })
    .join("");

  const total = rows.reduce(
    (s, r) => s + (r.price ? r.price * r.qty * m : 0),
    0,
  );

  document.getElementById("minInvestMeta").textContent =
    `Prices from NSE via Yahoo Finance · ${priced}/${rows.length} fetched`;
  document.getElementById("minInvestTotal").innerHTML =
    `Total (${m}× lot): <strong>${_inr(total)}</strong>`;
  document.getElementById("lotMultValue").textContent = `${m}×`;
  document.getElementById("minInvestTbody").innerHTML = rowsHtml;
}

async function showMinInvestment() {
  const btn = document.getElementById("showMinInvestBtn");
  const orig = btn.textContent;
  btn.textContent = "⏳ Fetching prices…";
  btn.disabled = true;

  _lotMultiplier = 1;
  _lastEnrichedRows = await _buildEnrichedRows();

  btn.textContent = orig;
  btn.disabled = false;

  if (!_lastEnrichedRows.length) return;

  const priced = _lastEnrichedRows.filter((r) => r.price !== null).length;

  document.getElementById("minInvestTable").innerHTML = `
    <p class="export-meta" id="minInvestMeta"></p>
    <div class="invest-toolbar">
      <div class="export-total" id="minInvestTotal"></div>
      <div class="lot-multiplier">
        <span class="export-label">Lot size:</span>
        <button class="mult-ctrl" id="lotMinus">−</button>
        <span id="lotMultValue">1×</span>
        <button class="mult-ctrl" id="lotPlus">+</button>
      </div>
    </div>
    <div class="export-table-wrap">
      <table class="export-price-table">
        <thead><tr>
          <th>Company</th><th>Ticker</th><th>Change</th>
          <th>Rel. Weight</th><th>Last Close</th>
          <th>Qty</th><th>Investment</th><th>Running Total</th>
        </tr></thead>
        <tbody id="minInvestTbody"></tbody>
      </table>
    </div>`;

  document.getElementById("lotPlus").addEventListener("click", () => {
    _lotMultiplier = Math.min(_lotMultiplier * 2, 1024);
    _renderInvestTable();
  });
  document.getElementById("lotMinus").addEventListener("click", () => {
    _lotMultiplier = Math.max(1, Math.floor(_lotMultiplier / 2));
    _renderInvestTable();
  });

  _renderInvestTable();
  document.getElementById("minInvestSection").style.display = "block";
}

async function exportDiffCsv() {
  const btn = document.getElementById("exportCsvBtn");
  btn.textContent = "⏳ Fetching…";
  btn.disabled = true;
  const rows = await _buildEnrichedRows();
  btn.textContent = "⬇ CSV";
  btn.disabled = false;
  if (!rows.length) return;
  const header =
    "Company,Ticker,Status,Change %,Rel. Weight %,Last Close (₹),Min Qty,Min Investment (₹)";
  const lines = rows.map(
    (r) =>
      `"${r.company.replace(/"/g, '""')}",${r.ticker},${r.status},${r.change_pct},${r.weight},${r.price ?? ""},${r.qty},${r.min_investment ?? ""}`,
  );
  const csv = [header, ...lines].join("\n");
  const fileTitle = document
    .getElementById("deltaTitle")
    .textContent.trim()
    .replace(/\s+/g, "_");
  _downloadFile(`diff_${fileTitle}.csv`, csv, "text/csv");
}

async function exportDiffJson() {
  const btn = document.getElementById("exportJsonBtn");
  btn.textContent = "⏳ Fetching…";
  btn.disabled = true;
  const rows = await _buildEnrichedRows();
  btn.textContent = "⬇ JSON";
  btn.disabled = false;
  if (!rows.length) return;
  const title = document.getElementById("deltaTitle").textContent.trim();
  const total = rows.reduce((s, r) => s + (r.min_investment ?? 0), 0);
  const payload = {
    fund: document.getElementById("currentFundName").textContent.trim(),
    comparison: title,
    exported_at: new Date().toISOString(),
    minimum_total_investment: +total.toFixed(2),
    diff: rows,
  };
  _downloadFile(
    `diff_${title.replace(/\s+/g, "_")}.json`,
    JSON.stringify(payload, null, 2),
    "application/json",
  );
}

async function exportDiffCopy() {
  const btn = document.getElementById("exportCopyBtn");
  btn.textContent = "⏳ Fetching…";
  btn.disabled = true;
  const rows = await _buildEnrichedRows();
  btn.disabled = false;
  if (!rows.length) return;
  const header =
    "Company\tTicker\tStatus\tChange %\tRel. Weight %\tLast Close (₹)\tMin Qty\tMin Investment (₹)";
  const lines = rows.map(
    (r) =>
      `${r.company}\t${r.ticker}\t${r.status}\t${r.change_pct}\t${r.weight}\t${r.price ?? "N/A"}\t${r.qty}\t${r.min_investment ?? "N/A"}`,
  );
  await navigator.clipboard.writeText([header, ...lines].join("\n"));
  btn.textContent = "✓ Copied!";
  btn.classList.add("copied");
  setTimeout(() => {
    btn.textContent = "📋 Copy";
    btn.classList.remove("copied");
  }, 2000);
}

function _downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleSync() {
  const syncBtn = document.getElementById("syncBtn");
  const originalText = syncBtn.textContent;

  try {
    // Disable button and show syncing state
    syncBtn.disabled = true;
    syncBtn.classList.add("syncing");
    syncBtn.textContent = "🔄 Syncing...";

    // Call sync API (assumes sync_server.py is running on port 8001)
    const response = await fetch("http://localhost:8001/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Show result
    if (result.success) {
      syncBtn.textContent = "✓ Synced!";

      // Reload data after successful sync
      await reloadData();

      // Reset button after 2 seconds
      setTimeout(() => {
        syncBtn.textContent = originalText;
        syncBtn.classList.remove("syncing");
        syncBtn.disabled = false;
      }, 2000);
    } else {
      throw new Error(result.message || "Sync completed with warnings");
    }
  } catch (error) {
    console.error("Sync error:", error);
    syncBtn.textContent = "✗ Sync Failed";
    syncBtn.classList.remove("syncing");

    // Show error to user
    alert(
      `Sync failed: ${error.message}\n\nMake sure sync_server.py is running:\npython scripts/sync_server.py`,
    );

    // Reset button after 3 seconds
    setTimeout(() => {
      syncBtn.textContent = originalText;
      syncBtn.disabled = false;
    }, 3000);
  }
}

async function reloadData() {
  // Reload all data from JSON files
  const newAvailableMonths = await loadAvailableMonths();
  availableMonths = newAvailableMonths;

  // Update UI
  populateFundSelector(availableMonths);
  populateDropdowns(availableMonths);
  initFundSearch(availableMonths);

  // Display latest month for current fund
  const fundMonths = availableMonths[currentFund] || [];
  if (fundMonths.length > 0) {
    const latestKey = fundMonths[fundMonths.length - 1].key;
    const monthSelect = document.getElementById("monthSelect");
    monthSelect.value = latestKey;
    displayMonth(latestKey);
  }
}

function switchFund(fundKey) {
  currentFund = fundKey;
  populateDropdowns(availableMonths);

  const fundMonths = availableMonths[currentFund] || [];
  if (fundMonths.length > 0) {
    const latestKey = fundMonths[fundMonths.length - 1].key;
    const monthSelect = document.getElementById("monthSelect");
    monthSelect.value = latestKey;
    displayMonth(latestKey);
  } else {
    // No data for this fund
    currentData = null;
    document.getElementById("totalHoldings").textContent = "0";
    document.getElementById("topHolding").textContent = "N/A";
    document.getElementById("top10Concentration").textContent = "0%";
  }

  document.getElementById("deltaSection").style.display = "none";
}

// ---------------------------------------------------------------------------
// Fuzzy Fund Search
// ---------------------------------------------------------------------------

/**
 * Lightweight fuzzy scorer.
 * Returns a score >= 0 (higher = better match), or -1 if no match.
 * Strategy: consecutive run bonus + position bonus + acronym bonus.
 */
function fuzzyScore(query, target) {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact substring → highest priority
  if (t.includes(q)) {
    return 1000 - t.indexOf(q);
  }

  // Acronym match: "sbi" matches "SBI Large & Midcap Fund"
  const words = t.split(/[\s&]+/);
  const acronym = words.map((w) => w[0] || "").join("");
  if (acronym.includes(q)) {
    return 800;
  }

  // Character-by-character fuzzy match
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10 + consecutive * 5;
      consecutive++;
      qi++;
    } else {
      consecutive = 0;
    }
  }

  if (qi < q.length) return -1; // not all chars matched
  return score;
}

/**
 * Highlight matched characters in the fund name.
 * For substring matches, wraps the matched portion in <mark>.
 */
function highlightMatch(query, text) {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx !== -1) {
    return (
      escapeHtml(text.slice(0, idx)) +
      "<mark>" +
      escapeHtml(text.slice(idx, idx + q.length)) +
      "</mark>" +
      escapeHtml(text.slice(idx + q.length))
    );
  }
  // Fuzzy: highlight individual matched chars
  let result = "";
  let qi = 0;
  const qLow = q;
  for (let ti = 0; ti < text.length; ti++) {
    if (qi < qLow.length && text[ti].toLowerCase() === qLow[qi]) {
      result += "<mark>" + escapeHtml(text[ti]) + "</mark>";
      qi++;
    } else {
      result += escapeHtml(text[ti]);
    }
  }
  return result;
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Return initials badge text (up to 3 chars) */
function fundBadgeText(displayName) {
  const words = displayName.split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

let _searchHighlightIdx = -1;

function initFundSearch(available) {
  const modal = document.getElementById("fundSearchModal");
  const searchBtn = document.getElementById("fundSearchBtn");
  const closeBtn = document.getElementById("fundSearchClose");
  const input = document.getElementById("fundSearchInput");
  const results = document.getElementById("fundSearchResults");
  const clearBtn = document.getElementById("fundSearchClear");
  const fundSelect = document.getElementById("fundSelect");

  function openModal() {
    modal.style.display = "flex";
    input.value = "";
    clearBtn.classList.remove("visible");
    renderResults("");
    setTimeout(() => input.focus(), 100);
  }

  function closeModal() {
    modal.style.display = "none";
    _searchHighlightIdx = -1;
  }

  function getResults(query) {
    const resultList = [];
    for (const [key, config] of Object.entries(FUNDS)) {
      if (!available[key] || available[key].length === 0) continue;
      const score = query ? fuzzyScore(query, config.name) : 100;
      if (score >= 0) {
        resultList.push({ key, config, score, months: available[key].length });
      }
    }
    resultList.sort((a, b) => b.score - a.score);
    return resultList.slice(0, 10);
  }

  function renderResults(query) {
    const items = getResults(query);
    _searchHighlightIdx = -1;
    results.innerHTML = "";

    if (items.length === 0) {
      results.innerHTML = `<div class="fund-search-no-results">No funds found for "${escapeHtml(query)}"</div>`;
      return;
    }

    items.forEach(({ key, config, months }) => {
      const item = document.createElement("div");
      item.className = "fund-search-item";
      item.dataset.fundKey = key;

      const badge = fundBadgeText(config.displayName);
      const highlighted = query
        ? highlightMatch(query, config.name)
        : escapeHtml(config.name);

      item.innerHTML = `
        <div class="fund-search-badge">${escapeHtml(badge)}</div>
        <div class="fund-search-item-info">
          <div class="fund-search-item-name">${highlighted}</div>
          <div class="fund-search-item-meta">${months} month${months !== 1 ? "s" : ""} of data available</div>
        </div>
      `;

      item.addEventListener("click", () => {
        selectFund(key);
      });

      results.appendChild(item);
    });
  }

  function selectFund(key) {
    fundSelect.value = key;
    switchFund(key);
    closeModal();
  }

  function moveHighlight(dir) {
    const items = results.querySelectorAll(".fund-search-item");
    if (!items.length) return;
    items.forEach((el) => el.classList.remove("highlighted"));
    _searchHighlightIdx = Math.max(
      0,
      Math.min(items.length - 1, _searchHighlightIdx + dir),
    );
    items[_searchHighlightIdx].classList.add("highlighted");
    items[_searchHighlightIdx].scrollIntoView({ block: "nearest" });
  }

  // Event listeners
  searchBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearBtn.classList.toggle("visible", q.length > 0);
    renderResults(q);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const highlighted = results.querySelector(
        ".fund-search-item.highlighted",
      );
      if (highlighted) {
        selectFund(highlighted.dataset.fundKey);
      } else {
        const first = results.querySelector(".fund-search-item");
        if (first) selectFund(first.dataset.fundKey);
      }
    } else if (e.key === "Escape") {
      closeModal();
    }
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.remove("visible");
    renderResults("");
    input.focus();
  });

  // Keyboard shortcut to open search (Ctrl+K or Cmd+K)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      openModal();
    }
  });
}

// ---------------------------------------------------------------------------
// Top Movers (NIFTY 50)
// ---------------------------------------------------------------------------

let currentMoversPeriod = "daily";

async function loadTopMovers(period = "daily") {
  try {
    const response = await fetch(`data/top_movers_${period}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load top movers: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading top movers:", error);
    return null;
  }
}

function renderTopMovers(data) {
  const content = document.getElementById("moversContent");

  if (!data || !data.top_movers || data.top_movers.length === 0) {
    content.innerHTML =
      '<p class="loading-text">No top movers data available</p>';
    return;
  }

  const changeKey =
    data.period === "daily" ? "daily_change_pct" : "weekly_change_pct";
  const priceKey = data.period === "daily" ? "prev_close" : "week_ago_close";

  const rows = data.top_movers
    .map((mover) => {
      const change = mover[changeKey];
      const changeClass =
        change >= 0 ? "mover-change" : "mover-change negative";
      const changeSign = change >= 0 ? "+" : "";
      return `
      <tr>
        <td class="mover-symbol">${mover.symbol}</td>
        <td class="mover-price">₹${mover.last_price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
        <td class="${changeClass}">${changeSign}${change.toFixed(2)}%</td>
        <td class="mover-price">₹${mover[priceKey].toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
      </tr>
    `;
    })
    .join("");

  content.innerHTML = `
    <table class="movers-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Last Price</th>
          <th>${data.period === "daily" ? "Daily Change" : "Weekly Change"}</th>
          <th>${data.period === "daily" ? "Prev Close" : "Week Ago Close"}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top: 12px; font-size: 0.8rem; color: var(--gray-400);">
      Updated: ${new Date(data.generated_at).toLocaleString()}
    </p>
  `;
}

async function initTopMovers() {
  const data = await loadTopMovers(currentMoversPeriod);
  renderTopMovers(data);

  // Tab switching
  document.querySelectorAll(".mover-tab").forEach((tab) => {
    tab.addEventListener("click", async () => {
      document
        .querySelectorAll(".mover-tab")
        .forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      currentMoversPeriod = tab.dataset.period;
      const newData = await loadTopMovers(currentMoversPeriod);
      renderTopMovers(newData);
    });
  });
}

async function init() {
  const loading = document.getElementById("loadingOverlay");

  // Hide sync button in production (Netlify) - only works on localhost
  const syncBtn = document.getElementById("syncBtn");
  if (
    syncBtn &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    syncBtn.style.display = "none";
  }

  try {
    availableMonths = await loadAvailableMonths();

    const totalMonths = Object.values(availableMonths).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    if (totalMonths === 0) {
      loading.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h2>No Data Found</h2>
          <p style="margin-top: 16px; color: #666;">
            Please run the extraction script first:<br><br>
            <code style="background: #f3f4f6; padding: 8px 16px; border-radius: 4px;">
              .\\venv\\Scripts\\activate; python scripts/extract_all_funds.py
            </code>
          </p>
        </div>
      `;
      return;
    }

    populateFundSelector(availableMonths);
    populateDropdowns(availableMonths);
    initFundSearch(availableMonths);
    initTopMovers();

    const fundMonths = availableMonths[currentFund] || [];
    if (fundMonths.length > 0) {
      const latestKey = fundMonths[fundMonths.length - 1].key;
      displayMonth(latestKey);
    }

    // Event listeners
    document.getElementById("fundSelect").addEventListener("change", (e) => {
      switchFund(e.target.value);
    });

    document.getElementById("monthSelect").addEventListener("change", (e) => {
      displayMonth(e.target.value);
    });

    document.getElementById("compareBtn").addEventListener("click", showDelta);

    document.getElementById("syncBtn").addEventListener("click", handleSync);

    document.getElementById("searchInput").addEventListener("input", () => {
      if (currentDelta) {
        renderTable(currentDelta, currentFilter);
      }
    });

    document.getElementById("sortSelect").addEventListener("change", () => {
      if (currentDelta) {
        renderTable(currentDelta, currentFilter);
      }
    });

    document
      .getElementById("filterAdded")
      .addEventListener("click", () => setActiveFilter("added"));
    document
      .getElementById("filterRemoved")
      .addEventListener("click", () => setActiveFilter("removed"));
    document
      .getElementById("filterChanged")
      .addEventListener("click", () => setActiveFilter("changed"));
    document
      .getElementById("filterAll")
      .addEventListener("click", () => setActiveFilter("all"));

    document
      .getElementById("showMinInvestBtn")
      .addEventListener("click", showMinInvestment);
    document
      .getElementById("exportCsvBtn")
      .addEventListener("click", exportDiffCsv);
    document
      .getElementById("exportJsonBtn")
      .addEventListener("click", exportDiffJson);
    document
      .getElementById("exportCopyBtn")
      .addEventListener("click", exportDiffCopy);

    loading.classList.add("hidden");
  } catch (error) {
    console.error("Initialization error:", error);
    loading.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ef4444;">
        <h2>Error Loading Data</h2>
        <p style="margin-top: 16px;">${error.message}</p>
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", init);
