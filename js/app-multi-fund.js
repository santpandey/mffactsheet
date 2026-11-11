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
  InvescoIndiaMulticapFund: {
    name: "Invesco India Multicap Fund",
    displayName: "Invesco Multicap",
  },
  CanaraRobecoSmallCapFund: {
    name: "Canara Robeco Small Cap Fund",
    displayName: "Canara Small Cap",
  },
  TrustMFSmallCapFund: {
    name: "TrustMF Small Cap Fund",
    displayName: "TrustMF Small Cap",
  },
  QuantSmallCapFund: {
    name: "Quant Small Cap Fund",
    displayName: "Quant Small Cap",
  },
  MotilalOswalMidcapFund: {
    name: "Motilal Oswal Midcap Fund",
    displayName: "Motilal Midcap",
  },
  HDFCMultiAssetAllocationFund: {
    name: "HDFC Multi-Asset Allocation Fund",
    displayName: "HDFC Multi Asset",
  },
  OldBridgeFocusedFund: {
    name: "Old Bridge Focused Fund",
    displayName: "Old Bridge Focused",
  },
  PPFASFlexiCapFund: {
    name: "Parag Parikh Flexi Cap Fund",
    displayName: "PPFAS Flexi Cap",
  },
  QuantFlexiCapFund: {
    name: "Quant Flexi Cap Fund",
    displayName: "Quant Flexi Cap",
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

const MONTH_INDEX = new Map(MONTHS_ORDER.map((m, i) => [m, i]));

let currentFund = "CanaraRobecoLargeAndMidCapFund";
let allData = {};
let currentData = null;
let currentDelta = null;
let currentFilter = "all";
let allocationChart = null;
let pieChart = null;
let deltaChart = null;
let availableMonths = [];

// Memoized element lookup — hot paths (renderTable runs per keystroke)
// shouldn't pay for repeated getElementById calls.
const _els = {};
const $ = (id) => (_els[id] ??= document.getElementById(id));

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

  // Build the list of files to load, then fetch them concurrently.
  // Sequential `await` per file was the main load-time bottleneck (75+ files).
  const tasks = [];
  for (const filename of uniqueFiles) {
    const match = filename.match(filePattern);
    if (!match) continue;

    const [, fundKey, month, yearText] = match;
    if (!FUNDS[fundKey]) continue;

    tasks.push({
      filename,
      fundKey,
      month,
      year: Number(yearText),
      key: `${month}-${yearText}`,
    });
  }

  // Bounded concurrency pool: fast on HTTP/2 (Netlify multiplexes), without
  // firing hundreds of simultaneous requests on larger datasets.
  const CONCURRENCY = 12;
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const t = tasks[cursor++];
      try {
        const response = await fetch(`data/${t.filename}`);
        if (!response.ok) continue;

        const data = await response.json();
        allData[t.fundKey][t.key] = data;
        available[t.fundKey].push({ month: t.month, year: t.year, key: t.key });
      } catch (e) {
        console.error(`Failed to load ${t.filename}`, e);
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker()),
  );

  for (const fundKey of Object.keys(available)) {
    available[fundKey].sort(
      (a, b) =>
        a.year - b.year || MONTH_INDEX.get(a.month) - MONTH_INDEX.get(b.month),
    );
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

  for (const item of fundMonths) {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = `${item.month} ${item.year}`;
    monthSelect.appendChild(option);
    compareSelect.appendChild(option.cloneNode(true));
  }

  if (fundMonths.length > 0) {
    monthSelect.value = fundMonths[fundMonths.length - 1].key;
  }
}

const TYPE_LABELS = {
  equity: "Equity",
  debt: "Debt",
  corporate_bond: "Corp Bond",
  government_bond: "Govt Bond",
  securitized_debt: "Securitized",
  preference_shares: "Pref Shares",
  treasury_bill: "T-Bill",
  commercial_paper: "Comm Paper",
  certificate_of_deposit: "CD",
  commercial_bill: "Comm Bill",
  money_market: "Money Mkt",
  fixed_deposit: "Fixed Dep",
  treps: "TREPS",
  net_receivable: "Net Rec/Pay",
  margin: "Margin",
  futures: "Futures",
  options: "Options",
  derivatives: "Derivative",
  etf: "ETF",
  foreign_equity: "Foreign Eq",
  mutual_fund_units: "MF Units",
  reit_invit: "REIT/InvIT",
  aif: "AIF",
  others: "Other",
};

// Broad buckets for the diff view's category filter. Anything not listed
// (net_receivable, margin, mutual_fund_units, reit_invit, etf, aif, others)
// falls under "other".
const TYPE_CATEGORY = {
  stocks: new Set(["equity", "foreign_equity", "preference_shares"]),
  debt: new Set([
    "debt",
    "corporate_bond",
    "government_bond",
    "securitized_debt",
    "treasury_bill",
    "commercial_paper",
    "certificate_of_deposit",
    "commercial_bill",
    "money_market",
    "fixed_deposit",
    "treps",
  ]),
  derivatives: new Set(["futures", "options", "derivatives"]),
};

const categoryOf = (type) =>
  Object.keys(TYPE_CATEGORY).find((c) => TYPE_CATEGORY[c].has(type)) ??
  "other";

function typeBadge(instrumentType) {
  const t = instrumentType ?? "equity";
  return t === "equity"
    ? ""
    : ` <span class="type-badge">${TYPE_LABELS[t] || t}</span>`;
}

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n)}...` : s);

function formatPercent(num) {
  return num == null ? "-" : `${num.toFixed(2)}%`;
}

function formatDelta(num) {
  return num == null ? "-" : `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

function updateStats(data) {
  $("totalHoldings").textContent = data.holdings.length;

  if (data.holdings.length > 0) {
    const top = data.holdings[0];
    $("topHolding").textContent =
      `${truncate(top.company, 20)} (${formatPercent(top.percentOfNAV)})`;

    const top10Sum = data.holdings
      .slice(0, 10)
      .reduce((sum, h) => sum + (h.percentOfNAV || 0), 0);
    $("top10Concentration").textContent = formatPercent(top10Sum);
  }

  // Update fund name display
  $("currentFundName").textContent = FUNDS[currentFund].name;
}

const BASE_COLORS = [
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

function getChartColors(count) {
  return Array.from(
    { length: count },
    (_, i) => BASE_COLORS[i % BASE_COLORS.length],
  );
}

function renderAllocationChart(data) {
  const ctx = document.getElementById("allocationChart").getContext("2d");
  if (allocationChart) allocationChart.destroy();

  const top15 = data.holdings.slice(0, 15);
  const labels = top15.map((h) => truncate(h.company, 25));
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

  const labels = top10.map((h) => truncate(h.company, 20));
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
  const byCompany = (list) =>
    new Map(list.map((h) => [h.company.toLowerCase(), h]));
  const currentMap = byCompany(current.holdings);
  const previousMap = byCompany(previous.holdings);

  const entry = (h, currentNAV, previousNAV, status) => ({
    company: h.company,
    instrumentType: h.instrumentType ?? "equity",
    currentNAV,
    previousNAV,
    navDelta: currentNAV - previousNAV,
    status,
  });

  const delta = { added: [], removed: [], changed: [], all: [] };

  for (const [key, h] of currentMap) {
    const cur = h.percentOfNAV ?? 0;
    const prev = previousMap.get(key);
    if (!prev) {
      delta.added.push(entry(h, cur, 0, "new"));
    } else {
      const prevNAV = prev.percentOfNAV ?? 0;
      const navDelta = cur - prevNAV;
      const status =
        navDelta > 0 ? "increased" : navDelta < 0 ? "decreased" : "unchanged";
      delta.changed.push(entry(h, cur, prevNAV, status));
    }
  }

  for (const [key, h] of previousMap) {
    if (!currentMap.has(key)) {
      delta.removed.push(entry(h, 0, h.percentOfNAV ?? 0, "exited"));
    }
  }

  delta.all = [...delta.added, ...delta.changed, ...delta.removed].sort(
    (a, b) => Math.abs(b.navDelta) - Math.abs(a.navDelta),
  );
  return delta;
}

function renderDeltaChart(delta) {
  const ctx = document.getElementById("deltaChart").getContext("2d");
  if (deltaChart) deltaChart.destroy();

  const top20 = delta.all.slice(0, 20);
  const labels = top20.map((d) => truncate(d.company, 30));
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
  return `${month.slice(0, 3)} ${year}`;
}

function renderTable(
  delta,
  filter = "all",
  currentMonthKey = "",
  previousMonthKey = "",
) {
  const currentLabel = formatMonthKey(currentMonthKey);
  const prevLabel = formatMonthKey(previousMonthKey);

  $("headerCurrent").textContent = currentLabel
    ? `Current % (${currentLabel})`
    : "Current %";
  $("headerPrevious").textContent = prevLabel
    ? `Previous % (${prevLabel})`
    : "Previous %";

  const tbody = $("holdingsBody");

  // filter value -> delta bucket; "all" falls through to delta.all
  const FILTER_LISTS = {
    added: delta.added,
    removed: delta.removed,
    changed: delta.changed,
  };
  let items = [...(FILTER_LISTS[filter] ?? delta.all)];

  // Rebuild the instrument-type filter from whatever this delta contains,
  // preserving the user's current selection when possible. The dropdown
  // offers broad categories (Stocks / Debt / Derivatives / Other) plus the
  // specific instrument types present in this delta.
  const typeSelect = $("typeSelect");
  if (typeSelect) {
    const prevVal = typeSelect.value || "all";
    const types = [
      ...new Set(delta.all.map((h) => h.instrumentType || "equity")),
    ].sort();
    typeSelect.innerHTML =
      '<option value="all">All Types</option>' +
      '<optgroup label="By Category">' +
      '<option value="cat:stocks">Stocks</option>' +
      '<option value="cat:debt">Debt / Money Market</option>' +
      '<option value="cat:derivatives">Futures & Derivatives</option>' +
      '<option value="cat:other">Other (Cash, MF Units, REITs)</option>' +
      "</optgroup>" +
      '<optgroup label="Specific Type">' +
      types
        .map((t) => `<option value="${t}">${TYPE_LABELS[t] || t}</option>`)
        .join("") +
      "</optgroup>";
    typeSelect.value = [...typeSelect.options].some((o) => o.value === prevVal)
      ? prevVal
      : "all";
    if (typeSelect.value !== "all") {
      const v = typeSelect.value;
      if (v.startsWith("cat:")) {
        const cat = v.slice(4);
        items = items.filter(
          (h) => categoryOf(h.instrumentType || "equity") === cat,
        );
      } else {
        items = items.filter(
          (h) => (h.instrumentType || "equity") === v,
        );
      }
    }
  }

  const searchTerm = $("searchInput").value.toLowerCase();
  if (searchTerm) {
    items = items.filter((h) => h.company.toLowerCase().includes(searchTerm));
  }

  const HOLDING_SORTERS = {
    "nav-desc": (a, b) => (b.currentNAV || 0) - (a.currentNAV || 0),
    "nav-asc": (a, b) => (a.currentNAV || 0) - (b.currentNAV || 0),
    "delta-desc": (a, b) => (b.navDelta || 0) - (a.navDelta || 0),
    "delta-asc": (a, b) => (a.navDelta || 0) - (b.navDelta || 0),
    "name-asc": (a, b) => a.company.localeCompare(b.company),
  };
  items.sort(HOLDING_SORTERS[$("sortSelect").value] ?? HOLDING_SORTERS["nav-desc"]);

  const STATUS_CLASSES = {
    new: ["delta-new", "NEW"],
    exited: ["delta-exited", "EXITED"],
  };

  tbody.innerHTML = items
    .map((h, i) => {
      const [statusClass, statusText] = STATUS_CLASSES[h.status] ?? [
        h.navDelta > 0 ? "delta-positive" : h.navDelta < 0 ? "delta-negative" : "",
        h.navDelta > 0 ? "INCREASED" : h.navDelta < 0 ? "DECREASED" : "NO CHANGE",
      ];

      const changeClass = h.navDelta >= 0 ? "delta-positive" : "delta-negative";

      return `
      <tr>
        <td>${i + 1}</td>
        <td>
          <span class="company-cell">
            <span class="cell-name">${escapeHtml(h.company)}</span>${typeBadge(h.instrumentType)}
          </span>
        </td>
        <td>${formatPercent(h.currentNAV)}</td>
        <td>${formatPercent(h.previousNAV)}</td>
        <td class="${changeClass}">${formatDelta(h.navDelta)}</td>
        <td><span class="${statusClass}">${statusText}</span></td>
      </tr>
    `;
    })
    .join("");
}

// ---------------------------------------------------------------------------
// Resizable columns (Google Sheets style) — drag the handle at each header's
// right edge. Widths persist in localStorage; double-click a handle to reset.
// ---------------------------------------------------------------------------

const COL_WIDTH_KEY = "mf_col_widths";

const _loadColWidths = () => {
  try {
    return JSON.parse(localStorage.getItem(COL_WIDTH_KEY)) || {};
  } catch {
    return {};
  }
};

const _saveColWidth = (idx, px) => {
  const w = _loadColWidths();
  if (px == null) delete w[idx];
  else w[idx] = px;
  localStorage.setItem(COL_WIDTH_KEY, JSON.stringify(w));
};

function initColumnResize() {
  const table = $("holdingsTable");
  if (!table) return;
  const saved = _loadColWidths();

  table.querySelectorAll("th").forEach((th, i) => {
    // Restore persisted widths, but never below a readable floor — a stale
    // saved width (or the base CSS) can otherwise clip the cell's text.
    const minW = i === 0 ? 68 : 48;
    if (saved[i] != null) th.style.width = `${Math.max(minW, saved[i])}px`;

    const handle = document.createElement("span");
    handle.className = "col-resizer";
    handle.title = "Drag to resize · double-click to reset";
    th.appendChild(handle);

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = th.offsetWidth;
      document.body.classList.add("col-resizing");

      const onMove = (ev) => {
        th.style.width = `${Math.max(minW, startW + ev.clientX - startX)}px`;
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.classList.remove("col-resizing");
        _saveColWidth(i, th.offsetWidth);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });

    handle.addEventListener("dblclick", () => {
      th.style.width = "";
      _saveColWidth(i, null);
    });
  });
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
  initFundSearch();
  initConsensus();

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

// Group key: same company across funds despite spelling/casing variants
// ("InterGlobe Aviation" vs "Interglobe Aviation", "Divi's" vs "Divis").
// Strips legal suffixes and all non-alphanumerics so those merge, while
// distinct instruments (e.g. a Call Option name) stay separate.
function companyGroupKey(name) {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd|pvt|private)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
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

let _fundSearchBound = false;
let _companySearchBound = false;

/**
 * Wire up a search modal: open/close, clear button, live filtering on input,
 * and arrow/Enter/Esc navigation. `render(query, resultsEl)` rebuilds the
 * result list on every keystroke; each item carries its own click handler,
 * so Enter simply clicks the highlighted (or first) item.
 */
function createSearchModal(ids, render) {
  const modal = $(ids.modal);
  const input = $(ids.input);
  const results = $(ids.results);
  const clearBtn = $(ids.clear);
  let highlightIdx = -1;

  const open = () => {
    modal.style.display = "flex";
    input.value = "";
    clearBtn.classList.remove("visible");
    render("", results);
    setTimeout(() => input.focus(), 100);
  };
  const close = () => {
    modal.style.display = "none";
    highlightIdx = -1;
  };
  const moveHighlight = (dir) => {
    const items = results.querySelectorAll(".fund-search-item");
    if (!items.length) return;
    items.forEach((el) => el.classList.remove("highlighted"));
    highlightIdx = Math.max(
      0,
      Math.min(items.length - 1, highlightIdx + dir),
    );
    items[highlightIdx].classList.add("highlighted");
    items[highlightIdx].scrollIntoView({ block: "nearest" });
  };

  $(ids.openBtn).addEventListener("click", open);
  $(ids.closeBtn).addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  input.addEventListener("input", () => {
    const q = input.value.trim();
    clearBtn.classList.toggle("visible", q.length > 0);
    render(q, results);
  });
  input.addEventListener("keydown", (e) => {
    const actions = {
      ArrowDown: () => moveHighlight(1),
      ArrowUp: () => moveHighlight(-1),
      Enter: () =>
        (
          results.querySelector(".fund-search-item.highlighted") ??
          results.querySelector(".fund-search-item")
        )?.click(),
      Escape: close,
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  });
  clearBtn.addEventListener("click", () => {
    input.value = "";
    clearBtn.classList.remove("visible");
    render("", results);
    input.focus();
  });

  return { open, close };
}

function initFundSearch() {
  // Bind listeners once — reloadData() calls this on every sync and each
  // call used to stack duplicate listeners (incl. the document Ctrl+K handler).
  if (_fundSearchBound) return;
  _fundSearchBound = true;

  const api = createSearchModal(
    {
      openBtn: "fundSearchBtn",
      modal: "fundSearchModal",
      closeBtn: "fundSearchClose",
      input: "fundSearchInput",
      results: "fundSearchResults",
      clear: "fundSearchClear",
    },
    renderFundResults,
  );

  function getResults(query) {
    // Read the live global — an `available` captured here goes stale after syncs
    const months = availableMonths;
    return Object.entries(FUNDS)
      .map(([key, config]) => ({
        key,
        config,
        score: query ? fuzzyScore(query, config.name) : 100,
        months: months[key]?.length ?? 0,
      }))
      .filter((r) => r.months > 0 && r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }

  function renderFundResults(query, results) {
    const items = getResults(query);
    results.innerHTML = "";
    if (items.length === 0) {
      results.innerHTML = `<div class="fund-search-no-results">No funds found for "${escapeHtml(query)}"</div>`;
      return;
    }
    for (const { key, config, months } of items) {
      const item = document.createElement("div");
      item.className = "fund-search-item";
      const highlighted = query
        ? highlightMatch(query, config.name)
        : escapeHtml(config.name);
      item.innerHTML = `
        <div class="fund-search-badge">${escapeHtml(fundBadgeText(config.displayName))}</div>
        <div class="fund-search-item-info">
          <div class="fund-search-item-name">${highlighted}</div>
          <div class="fund-search-item-meta">${months} month${months !== 1 ? "s" : ""} of data available</div>
        </div>
      `;
      item.addEventListener("click", () => selectFund(key));
      results.appendChild(item);
    }
  }

  function selectFund(key) {
    $("fundSelect").value = key;
    switchFund(key);
    api.close();
  }

  // Keyboard shortcut to open search (Ctrl+K or Cmd+K)
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      api.open();
    }
  });
}

// ---------------------------------------------------------------------------
// Global Company Search (latest month of every fund, no backend calls)
// ---------------------------------------------------------------------------

function initCompanySearch() {
  if (_companySearchBound) return;
  _companySearchBound = true;

  const api = createSearchModal(
    {
      openBtn: "companySearchBtn",
      modal: "companySearchModal",
      closeBtn: "companySearchClose",
      input: "companySearchInput",
      results: "companySearchResults",
      clear: "companySearchClear",
    },
    renderCompanyResults,
  );

  // Search each fund's latest month; returns companies grouped with every
  // fund that holds them, sorted by the highest % of NAV.
  function getCompanyResults(query) {
    const q = query.toLowerCase();
    const byCompany = new Map();

    for (const [fundKey, fundConfig] of Object.entries(FUNDS)) {
      const months = availableMonths[fundKey] || [];
      const latest = (allData[fundKey] || {})[months[months.length - 1]?.key];
      if (!latest?.holdings) continue;

      for (const h of latest.holdings) {
        if (!h.company?.toLowerCase().includes(q)) continue;
        const key = companyGroupKey(h.company);
        if (!key) continue;
        if (!byCompany.has(key)) byCompany.set(key, []);
        byCompany.get(key).push({
          fundKey,
          displayName: fundConfig.displayName,
          rawName: h.company,
          type: h.instrumentType ?? "equity",
          pct: h.percentOfNAV,
        });
      }
    }

    return [...byCompany.values()]
      .map((hits) => {
        hits.sort((a, b) => b.pct - a.pct);
        // Prefer the spelling variant that matches the query so the card
        // title (and its highlight) reflect what the user typed.
        const display =
          hits.find((h) => h.rawName.toLowerCase().includes(q)) ?? hits[0];
        return { company: display.rawName, hits, maxPct: hits[0].pct };
      })
      .sort((a, b) => b.maxPct - a.maxPct)
      .slice(0, 15);
  }

  function renderCompanyResults(query, results) {
    if (query.length < 2) {
      results.innerHTML =
        '<div class="fund-search-no-results">Type at least 2 characters to search holdings across all funds</div>';
      return;
    }
    const items = getCompanyResults(query);
    results.innerHTML = "";
    if (items.length === 0) {
      results.innerHTML = `<div class="fund-search-no-results">No holdings found for "${escapeHtml(query)}"</div>`;
      return;
    }

    for (const { company, hits } of items) {
      const item = document.createElement("div");
      item.className = "fund-search-item";

      // One linked row per fund holding — clicking lands on that fund.
      const fundRows = hits
        .map((x) => {
          const typeChip =
            x.type !== "equity"
              ? ` <span class="fund-search-fund-type">${escapeHtml(TYPE_LABELS[x.type] || x.type)}</span>`
              : "";
          return `
          <div class="fund-search-fund-row" data-fund="${x.fundKey}" role="link" tabindex="-1" title="Open ${escapeHtml(x.displayName)} holdings">
            <span class="fund-search-fund-name">${escapeHtml(x.displayName)}${typeChip}</span>
            <span class="fund-search-fund-pct">${formatPercent(x.pct)}</span>
          </div>`;
        })
        .join("");

      item.innerHTML = `
        <div class="fund-search-badge">${hits.length}</div>
        <div class="fund-search-item-info">
          <div class="fund-search-item-name">${highlightMatch(query, company)}</div>
          <div class="fund-search-fund-list">${fundRows}</div>
        </div>
      `;

      // Row-level links win over the card-level default (top-weighted fund).
      item.querySelectorAll(".fund-search-fund-row").forEach((row) => {
        row.addEventListener("click", (e) => {
          e.stopPropagation();
          selectResult(row.dataset.fund, company);
        });
      });
      item.addEventListener("click", () =>
        selectResult(hits[0].fundKey, company),
      );
      results.appendChild(item);
    }
  }

  // Jump to the chosen fund and flash-highlight the stock's row so it's
  // obvious we've landed in the right place.
  function selectResult(fundKey, company) {
    $("fundSelect").value = fundKey;
    switchFund(fundKey);

    const tableSearch = $("searchInput");
    tableSearch.value = company;

    // Render the holdings table (latest vs earliest month) so the row is
    // actually visible — the table only exists inside the delta view.
    $("compareSelect").value = "compare-all";
    showDelta();

    for (const tr of $("holdingsBody").querySelectorAll("tr")) {
      tr.classList.add("row-flash");
    }
    api.close();
  }
}

// ---------------------------------------------------------------------------
// Smart Money Moves — cross-fund consensus
// Aggregates each fund's month-over-month delta across ALL funds for a chosen
// month: which stocks were newly bought / increased / decreased / exited, and
// by how many funds. Equity-category moves only — TREPS/cash churn and debt
// reshuffles aren't a stock-picking signal.
// ---------------------------------------------------------------------------

let consensusFilter = "all";
let consensusSortCol = "funds";
let consensusSortDir = "desc";
let _consensusBound = false;
let _consensusCache = { monthKey: null, result: null };

const CONS_STATUS_ORDER = ["new", "increased", "decreased", "exited"];
const CONS_STATUS_WORDS = {
  new: "New entry",
  increased: "Increased",
  decreased: "Decreased",
  exited: "Exited",
};

// Months where at least one fund has data AND a prior month to diff against.
function consensusMonthKeys() {
  const keys = new Set();
  for (const fundKey of Object.keys(FUNDS)) {
    const months = availableMonths[fundKey] || [];
    months.forEach((m, i) => {
      if (i > 0) keys.add(m.key);
    });
  }
  return [...keys].sort((a, b) => {
    const [am, ay] = a.split("-");
    const [bm, by] = b.split("-");
    return ay - by || MONTH_INDEX.get(am) - MONTH_INDEX.get(bm);
  });
}

function buildConsensus(monthKey) {
  const byCompany = new Map();
  const fundsReporting = [];

  for (const [fundKey, cfg] of Object.entries(FUNDS)) {
    const months = availableMonths[fundKey] || [];
    const idx = months.findIndex((m) => m.key === monthKey);
    if (idx <= 0) continue; // month not published for this fund, or no baseline
    const cur = allData[fundKey]?.[monthKey];
    const prev = allData[fundKey]?.[months[idx - 1].key];
    if (!cur?.holdings || !prev?.holdings) continue;

    fundsReporting.push(fundKey);
    const delta = calculateDelta(cur, prev);
    for (const d of delta.all) {
      if (d.status === "unchanged") continue;
      if (categoryOf(d.instrumentType || "equity") !== "stocks") continue;
      const gk = companyGroupKey(d.company);
      if (!gk) continue;
      let rec = byCompany.get(gk);
      if (!rec) {
        rec = { moves: [] };
        byCompany.set(gk, rec);
      }
      rec.moves.push({
        company: d.company,
        fundKey,
        displayName: cfg.displayName,
        status: d.status,
        navDelta: d.navDelta,
        currentNAV: d.currentNAV,
        previousNAV: d.previousNAV,
      });
    }
  }

  const rows = [...byCompany.values()].map((r) => {
    const counts = { new: 0, increased: 0, decreased: 0, exited: 0 };
    for (const m of r.moves) counts[m.status]++;
    // Display spelling: variant attached to the largest single move
    const topMove = r.moves.reduce((a, b) =>
      Math.abs(b.navDelta) > Math.abs(a.navDelta) ? b : a,
    );
    return {
      company: topMove.company,
      moves: r.moves,
      counts,
      netDelta: r.moves.reduce((s, m) => s + m.navDelta, 0),
      currentWeight: r.moves.reduce((s, m) => s + (m.currentNAV || 0), 0),
      fundCount: r.moves.length,
    };
  });

  return { rows, fundsReporting };
}

function getConsensus(monthKey) {
  if (_consensusCache.monthKey !== monthKey || !_consensusCache.result) {
    _consensusCache = { monthKey, result: buildConsensus(monthKey) };
  }
  return _consensusCache.result;
}

// Aggregate navDelta restricted to one status — secondary sort key inside a
// bucket (a company can be "new" in one fund and "decreased" in another).
function statusDelta(row, status) {
  return row.moves.reduce(
    (s, m) => s + (m.status === status ? m.navDelta : 0),
    0,
  );
}

const CONS_SORTERS = {
  all: (a, b) =>
    b.fundCount - a.fundCount || Math.abs(b.netDelta) - Math.abs(a.netDelta),
  new: (a, b) =>
    b.counts.new - a.counts.new || statusDelta(b, "new") - statusDelta(a, "new"),
  increased: (a, b) =>
    b.counts.increased - a.counts.increased ||
    statusDelta(b, "increased") - statusDelta(a, "increased"),
  decreased: (a, b) =>
    b.counts.decreased - a.counts.decreased ||
    statusDelta(a, "decreased") - statusDelta(b, "decreased"),
  exited: (a, b) =>
    b.counts.exited - a.counts.exited ||
    statusDelta(a, "exited") - statusDelta(b, "exited"),
};

// Clickable column sorts (dir = "asc" | "desc"). For the Funds column inside
// a bucket filter we count only moves of that status — "# funds newly
// buying" is the meaningful number there, not total moves.
const CONS_COL_SORTERS = {
  company: (a, b, dir) =>
    dir === "asc"
      ? a.company.localeCompare(b.company)
      : b.company.localeCompare(a.company),
  funds: (a, b, dir) =>
    (dir === "asc" ? 1 : -1) *
    ((consensusFilter === "all" ? a.fundCount : a.counts[consensusFilter]) -
      (consensusFilter === "all" ? b.fundCount : b.counts[consensusFilter])),
  nav: (a, b, dir) => (dir === "asc" ? 1 : -1) * (a.currentWeight - b.currentWeight),
  netdelta: (a, b, dir) => (dir === "asc" ? 1 : -1) * (a.netDelta - b.netDelta),
};

const CONS_COL_DEF_DIR = { company: "asc" }; // everything else defaults to desc

function populateConsensusMonths() {
  const sel = $("consensusMonth");
  const keys = consensusMonthKeys();
  sel.innerHTML = keys
    .map((k) => {
      const [m, y] = k.split("-");
      return `<option value="${k}">${m} ${y}</option>`;
    })
    .join("");
  if (keys.length) sel.value = keys[keys.length - 1];
}

// Collapse state persists across visits — the section defaults to collapsed
// so it doesn't push the holdings table down the page.
const CONS_OPEN_KEY = "mf_consensus_open";

function setConsensusOpen(open) {
  const head = $("consHead");
  head.setAttribute("aria-expanded", open ? "true" : "false");
  $("consBody").style.display = open ? "block" : "none";
  $("consArrow").textContent = open ? "▾" : "▸";
  $("consMini").style.display = open ? "none" : "";
  try {
    localStorage.setItem(CONS_OPEN_KEY, open ? "1" : "0");
  } catch {}
}

function renderConsensus() {
  const section = $("consensusSection");
  const monthKey = $("consensusMonth").value;
  if (!monthKey) {
    section.style.display = "none";
    return;
  }

  const { rows, fundsReporting } = getConsensus(monthKey);
  section.style.display = "block";

  const [m, y] = monthKey.split("-");
  $("consensusScope").textContent =
    `${m} ${y} · ${fundsReporting.length} of ${Object.keys(FUNDS).length} funds published · ` +
    `each fund vs its previous published month · equity moves only`;

  // Collapsed-state teaser: the headline numbers stay visible in the header.
  $("consMini").textContent =
    `${m} ${y} · ${fundsReporting.length}/${Object.keys(FUNDS).length} funds · ` +
    `${rows.length} equity moves`;

  $("consCountAll").textContent = rows.length;
  for (const f of ["new", "increased", "decreased", "exited"]) {
    const elId = `consCount${f[0].toUpperCase() + f.slice(1)}`;
    $(elId).textContent = rows.filter((r) => r.counts[f] > 0).length;
  }

  const q = $("consensusSearch").value.trim().toLowerCase();
  let items = rows.filter(
    (r) => consensusFilter === "all" || r.counts[consensusFilter] > 0,
  );
  if (q) items = items.filter((r) => r.company.toLowerCase().includes(q));
  const colSort = CONS_COL_SORTERS[consensusSortCol];
  items.sort(
    (a, b) => colSort(a, b, consensusSortDir) || CONS_SORTERS.all(a, b),
  );

  document
    .querySelectorAll("#consensusTable th.sortable")
    .forEach((th) => {
      const active = th.dataset.col === consensusSortCol;
      th.classList.toggle("sorted", active);
      const arrow = th.querySelector(".sort-arrow");
      if (arrow) {
        arrow.textContent = active
          ? consensusSortDir === "asc"
            ? "▲"
            : "▼"
          : "";
      }
    });

  const tbody = $("consensusBody");
  if (!items.length) {
    tbody.innerHTML =
      `<tr><td colspan="6" class="consensus-empty">` +
      `No moves${q ? ` matching &quot;${escapeHtml(q)}&quot;` : ""} for ${m} ${y}` +
      `</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((r, i) => {
      const chips = r.moves
        .filter(
          (mv) => consensusFilter === "all" || mv.status === consensusFilter,
        )
        .sort(
          (a, b) =>
            CONS_STATUS_ORDER.indexOf(a.status) -
              CONS_STATUS_ORDER.indexOf(b.status) ||
            Math.abs(b.navDelta) - Math.abs(a.navDelta),
        )
        .map(
          (mv) =>
            `<span class="cons-chip chip-${mv.status}" ` +
            `title="${CONS_STATUS_WORDS[mv.status]}: ${formatPercent(mv.previousNAV)} → ${formatPercent(mv.currentNAV)}">` +
            `${escapeHtml(mv.displayName)} ${formatDelta(mv.navDelta)}</span>`,
        )
        .join("");
      const netCls = r.netDelta >= 0 ? "delta-positive" : "delta-negative";
      return `<tr>
        <td>${i + 1}</td>
        <td><span class="cell-name">${escapeHtml(r.company)}</span></td>
        <td class="num">${r.fundCount}</td>
        <td class="num">${formatPercent(r.currentWeight)}</td>
        <td class="num ${netCls}">${formatDelta(r.netDelta)}</td>
        <td><div class="cons-fundmoves">${chips}</div></td>
      </tr>`;
    })
    .join("");
}

// Bound-once listener wiring + (re)build. Called from init() and reloadData()
// — a sync can add a new month to the dropdown and invalidates the cache.
function initConsensus() {
  if (!_consensusBound) {
    _consensusBound = true;
    const toggle = () =>
      setConsensusOpen(
        $("consHead").getAttribute("aria-expanded") !== "true",
      );
    $("consHead").addEventListener("click", toggle);
    $("consHead").addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
    $("consensusMonth").addEventListener("change", renderConsensus);
    $("consensusSearch").addEventListener("input", renderConsensus);
    document
      .querySelectorAll("#consensusTable th.sortable")
      .forEach((th) => {
        th.addEventListener("click", () => {
          const col = th.dataset.col;
          if (consensusSortCol === col) {
            consensusSortDir = consensusSortDir === "asc" ? "desc" : "asc";
          } else {
            consensusSortCol = col;
            consensusSortDir = CONS_COL_DEF_DIR[col] ?? "desc";
          }
          renderConsensus();
        });
      });
    document
      .querySelectorAll("#consensusCards .delta-stat")
      .forEach((card) => {
        card.addEventListener("click", () => {
          consensusFilter = card.dataset.consfilter;
          document
            .querySelectorAll("#consensusCards .delta-stat")
            .forEach((c) => c.classList.remove("active"));
          card.classList.add("active");
          renderConsensus();
        });
      });
  }
  _consensusCache = { monthKey: null, result: null };
  populateConsensusMonths();
  renderConsensus();
  let savedOpen = null;
  try {
    savedOpen = localStorage.getItem(CONS_OPEN_KEY);
  } catch {}
  setConsensusOpen(savedOpen === "1");
}

async function init() {
  const loading = document.getElementById("loadingOverlay");

  // Sync button only works locally against sync_server.py; production
  // sync is handled by the scheduled GitHub Actions workflow
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
              uv run python scripts/extract_all_funds.py
            </code>
          </p>
        </div>
      `;
      return;
    }

    populateFundSelector(availableMonths);
    populateDropdowns(availableMonths);
    initFundSearch();
    initCompanySearch();
    initConsensus();
    initColumnResize();

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

    document.getElementById("typeSelect").addEventListener("change", () => {
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
