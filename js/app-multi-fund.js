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
  SBILargeAndMidcapFund: {
    name: "SBI Large & Midcap Fund",
    displayName: "SBI",
  },
  HDFCLargeAndMidCapFund: {
    name: "HDFC Large and Mid Cap Fund",
    displayName: "HDFC",
  },
  ICICIPrudentialLargeAndMidCapFund: {
    name: "ICICI Prudential Large & Mid Cap Fund",
    displayName: "ICICI Prudential",
  },
  KotakLargeAndMidcapFund: {
    name: "Kotak Large & Midcap Fund",
    displayName: "Kotak",
  },
  NipponIndiaVisionFund: {
    name: "Nippon India Vision Fund",
    displayName: "Nippon India",
  },
  AxisLargeAndMidCapFund: {
    name: "Axis Large & Mid Cap Fund",
    displayName: "Axis",
  },
  QuantLargeAndMidCapFund: {
    name: "Quant Large and Mid Cap Fund",
    displayName: "Quant",
  },
  UTILargeAndMidCapFund: {
    name: "UTI Large & Mid Cap Fund",
    displayName: "UTI",
  },
  DSPLargeAndMidCapFund: {
    name: "DSP Large & Mid Cap Fund",
    displayName: "DSP",
  },
  TataLargeAndMidCapFund: {
    name: "Tata Large & Mid Cap Fund",
    displayName: "Tata",
  },
  InvescoIndiaLargeAndMidCapFund: {
    name: "Invesco India Large & Mid Cap Fund",
    displayName: "Invesco",
  },
  MotilalOswalLargeAndMidcapFund: {
    name: "Motilal Oswal Large and Midcap Fund",
    displayName: "Motilal Oswal",
  },
  BandhanLargeAndMidCapFund: {
    name: "Bandhan Large & Mid Cap Fund",
    displayName: "Bandhan",
  },
  AdityaBirlaSunLifeLargeAndMidCapFund: {
    name: "Aditya Birla Sun Life Large & Mid Cap Fund",
    displayName: "Aditya Birla",
  },
  FranklinIndiaLargeAndMidCapFund: {
    name: "Franklin India Large & Mid Cap Fund",
    displayName: "Franklin",
  },
  WhiteOakCapitalLargeAndMidCapFund: {
    name: "WhiteOak Capital Large & Mid Cap Fund",
    displayName: "WhiteOak",
  },
  EdelweissLargeAndMidCapFund: {
    name: "Edelweiss Large & Mid Cap Fund",
    displayName: "Edelweiss",
  },
  SundaramLargeAndMidCapFund: {
    name: "Sundaram Large and Mid Cap Fund",
    displayName: "Sundaram",
  },
  MahindraManulifeLargeAndMidCapFund: {
    name: "Mahindra Manulife Large & Mid Cap Fund",
    displayName: "Mahindra Manulife",
  },
  HSBCLargeAndMidCapFund: {
    name: "HSBC Large and Mid Cap Fund",
    displayName: "HSBC",
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
let yearlyChart = null;
let top5TrendChart = null;
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

function populateStockDropdown() {
  const stockSelect = document.getElementById("stockSelect");
  const allStocks = new Set();

  const fundData = allData[currentFund] || {};
  Object.values(fundData).forEach((data) => {
    data.holdings.forEach((h) => allStocks.add(h.company));
  });

  stockSelect.innerHTML =
    '<option value="">Select a stock to track...</option>';
  Array.from(allStocks)
    .sort()
    .forEach((stock) => {
      const option = document.createElement("option");
      option.value = stock;
      option.textContent = stock;
      stockSelect.appendChild(option);
    });

  // Auto-select the stock with highest percentage in the latest month
  const fundMonths = availableMonths[currentFund] || [];
  if (fundMonths.length > 0) {
    const latestKey = fundMonths[fundMonths.length - 1].key;
    const latestData = fundData[latestKey];
    if (latestData && latestData.holdings && latestData.holdings.length > 0) {
      const topStock = latestData.holdings[0].company;
      stockSelect.value = topStock;
      // Trigger the chart rendering
      renderStockTrend(topStock);
    }
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

function renderStockTrend(stockName) {
  const ctx = document.getElementById("yearlyChart").getContext("2d");
  if (yearlyChart) yearlyChart.destroy();

  const fundData = allData[currentFund] || {};
  const fundMonths = availableMonths[currentFund] || [];

  const labels = [];
  const values = [];

  fundMonths.forEach((item) => {
    const data = fundData[item.key];
    if (data && data.holdings) {
      const holding = data.holdings.find((h) => h.company === stockName);
      labels.push(`${item.month.substring(0, 3)} ${item.year}`);
      values.push(holding ? holding.percentOfNAV : 0);
    }
  });

  yearlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${stockName} - % of NAV`,
          data: values,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          borderWidth: 2,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.y.toFixed(2)}% of NAV`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "% of NAV" },
        },
        x: {
          title: { display: true, text: "Month" },
        },
      },
    },
  });
}

function renderTop5Trend() {
  const ctx = document.getElementById("top5TrendChart").getContext("2d");
  if (top5TrendChart) top5TrendChart.destroy();

  const fundData = allData[currentFund] || {};
  const fundMonths = availableMonths[currentFund] || [];

  if (fundMonths.length === 0) return;

  const latestKey = fundMonths[fundMonths.length - 1].key;
  const latestData = fundData[latestKey];
  if (!latestData || !latestData.holdings) return;

  const top5Stocks = latestData.holdings.slice(0, 5).map((h) => h.company);
  const labels = fundMonths.map(
    (item) => `${item.month.substring(0, 3)} ${item.year}`,
  );

  const datasets = top5Stocks.map((stock, index) => {
    const values = fundMonths.map((item) => {
      const data = fundData[item.key];
      if (data && data.holdings) {
        const holding = data.holdings.find((h) => h.company === stock);
        return holding ? holding.percentOfNAV : 0;
      }
      return 0;
    });

    const colors = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

    return {
      label: stock.length > 25 ? stock.substring(0, 25) + "..." : stock,
      data: values,
      borderColor: colors[index],
      backgroundColor: colors[index] + "20",
      borderWidth: 2,
      tension: 0.3,
      fill: false,
      pointRadius: 4,
      pointHoverRadius: 6,
    };
  });

  top5TrendChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "bottom",
          labels: { boxWidth: 12, padding: 10 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}% of NAV`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "% of NAV" },
        },
        x: {
          title: { display: true, text: "Month" },
        },
      },
    },
  });
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
  populateStockDropdown();
  initFundSearch(availableMonths);

  // Display latest month for current fund
  const fundMonths = availableMonths[currentFund] || [];
  if (fundMonths.length > 0) {
    const latestKey = fundMonths[fundMonths.length - 1].key;
    const monthSelect = document.getElementById("monthSelect");
    monthSelect.value = latestKey;
    displayMonth(latestKey);
  }

  // Refresh charts
  renderTop5Trend();
}

function switchFund(fundKey) {
  currentFund = fundKey;
  populateDropdowns(availableMonths);
  populateStockDropdown();

  const fundMonths = availableMonths[currentFund] || [];
  if (fundMonths.length > 0) {
    const latestKey = fundMonths[fundMonths.length - 1].key;
    // Update the month selector to show the latest month
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

  if (yearlyChart) {
    yearlyChart.destroy();
    yearlyChart = null;
  }
  if (top5TrendChart) {
    top5TrendChart.destroy();
    top5TrendChart = null;
  }
  document.getElementById("stockSelect").value = "";

  renderTop5Trend();
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
    populateStockDropdown();
    initFundSearch(availableMonths);

    const fundMonths = availableMonths[currentFund] || [];
    if (fundMonths.length > 0) {
      const latestKey = fundMonths[fundMonths.length - 1].key;
      displayMonth(latestKey);
    }

    // Render top 5 trend chart
    renderTop5Trend();

    // Event listeners
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

    document.getElementById("stockSelect").addEventListener("change", (e) => {
      if (e.target.value) {
        renderStockTrend(e.target.value);
      } else {
        // Clear the chart when no stock is selected
        if (yearlyChart) {
          yearlyChart.destroy();
          yearlyChart = null;
        }
      }
    });

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
