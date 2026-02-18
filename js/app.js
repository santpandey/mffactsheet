/**
 * Mutual Fund Allocation Tracker
 * Main Application Logic
 */

const FUND_NAME = "MiraeAssetLargeAndMidcapFund";
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
  const year = 2025;
  const available = [];

  for (const month of MONTHS_ORDER) {
    const filename = `data/${FUND_NAME}-${month}-${year}.json`;
    try {
      const response = await fetch(filename);
      if (response.ok) {
        const data = await response.json();
        allData[`${month}-${year}`] = data;
        available.push({ month, year, key: `${month}-${year}` });
      }
    } catch (e) {
      console.log(`No data for ${month} ${year}`);
    }
  }

  return available;
}

function populateDropdowns(available) {
  const monthSelect = document.getElementById("monthSelect");
  const compareSelect = document.getElementById("compareSelect");

  monthSelect.innerHTML = "";
  compareSelect.innerHTML =
    '<option value="">Select month to compare with...</option>';

  // Add "Select All" option first
  const selectAllOption = document.createElement("option");
  selectAllOption.value = "compare-all";
  selectAllOption.textContent = "📊 Select All (Historical Change)";
  compareSelect.appendChild(selectAllOption);

  // Add separator
  const separator = document.createElement("option");
  separator.disabled = true;
  separator.textContent = "─────────────────";
  compareSelect.appendChild(separator);

  available.forEach((item, index) => {
    const option = document.createElement("option");
    option.value = item.key;
    option.textContent = `${item.month} ${item.year}`;
    monthSelect.appendChild(option);

    const compareOption = option.cloneNode(true);
    compareSelect.appendChild(compareOption);
  });

  if (available.length > 0) {
    monthSelect.value = available[available.length - 1].key;
  }
}

function populateStockDropdown() {
  const stockSelect = document.getElementById("stockSelect");
  const allStocks = new Set();

  Object.values(allData).forEach((data) => {
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
    document.getElementById(
      "topHolding"
    ).textContent = `${top.company.substring(0, 20)}${
      top.company.length > 20 ? "..." : ""
    } (${formatPercent(top.percentOfNAV)})`;

    const top10Sum = data.holdings
      .slice(0, 10)
      .reduce((sum, h) => sum + (h.percentOfNAV || 0), 0);
    document.getElementById("top10Concentration").textContent =
      formatPercent(top10Sum);
  }
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
    (_, i) => baseColors[i % baseColors.length]
  );
}

function renderAllocationChart(data) {
  const ctx = document.getElementById("allocationChart").getContext("2d");
  if (allocationChart) allocationChart.destroy();

  const top15 = data.holdings.slice(0, 15);
  const labels = top15.map((h) =>
    h.company.length > 25 ? h.company.substring(0, 25) + "..." : h.company
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
    h.company.length > 20 ? h.company.substring(0, 20) + "..." : h.company
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

  // Use navDelta (% of NAV change) instead of shareDelta
  const top20 = delta.all.slice(0, 20);
  const labels = top20.map((d) =>
    d.company.length > 30 ? d.company.substring(0, 30) + "..." : d.company
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
  previousMonthKey = ""
) {
  // Update headers with month names in brackets
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

  console.log("Items to render:", items.length, items);

  // Apply search filter
  const searchTerm = document.getElementById("searchInput").value.toLowerCase();
  if (searchTerm) {
    items = items.filter((h) => h.company.toLowerCase().includes(searchTerm));
  }

  // Apply sort
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
  console.log("setActiveFilter called with:", filter);
  currentFilter = filter;

  // Update active state on cards
  document.querySelectorAll(".delta-stat.clickable").forEach((card) => {
    card.classList.remove("active");
  });
  const activeCard = document.querySelector(`[data-filter="${filter}"]`);
  if (activeCard) {
    activeCard.classList.add("active");
  }

  // Update table filter label
  const filterLabels = {
    all: "",
    added: "- New Entries Only",
    removed: "- Exited Stocks Only",
    changed: "- Changed Stocks Only",
  };
  document.getElementById("tableFilterLabel").textContent =
    filterLabels[filter] || "";

  // Re-render table with filter
  if (currentDelta) {
    const currentKey = document.getElementById("monthSelect").value;
    const compareKey = document.getElementById("compareSelect").value;
    const prevMonth =
      compareKey === "compare-all" ? availableMonths[0].key : compareKey;

    renderTable(currentDelta, filter, currentKey, prevMonth);

    // Scroll to table section so user can see the filtered results
    document
      .getElementById("tableSection")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    console.log("No currentDelta available");
  }
}

function showDelta() {
  const currentKey = document.getElementById("monthSelect").value;
  const compareKey = document.getElementById("compareSelect").value;

  if (!compareKey) {
    alert("Please select a month to compare with");
    return;
  }

  // Handle "Select All" option - show yearly matrix instead
  if (compareKey === "compare-all") {
    if (availableMonths.length < 2) {
      alert("Need at least 2 months of data for historical comparison");
      return;
    }

    // Hide delta section and regular table
    document.getElementById("deltaSection").style.display = "none";
    document.getElementById("tableSection").style.display = "none";

    // Show yearly matrix section
    const matrixSection = document.getElementById("yearlyMatrixSection");
    matrixSection.style.display = "block";

    // Render the matrix
    renderYearlyMatrix();

    // Scroll to matrix
    setTimeout(() => {
      matrixSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    return;
  }

  // Normal month-to-month comparison
  const current = allData[currentKey];
  const previous = allData[compareKey];

  if (!current || !previous) {
    alert("Data not available for selected months");
    return;
  }

  // Hide yearly matrix, show delta section and table
  document.getElementById("yearlyMatrixSection").style.display = "none";
  document.getElementById("tableSection").style.display = "block";
  document.getElementById("deltaSection").style.display = "block";

  currentDelta = calculateDelta(current, previous);
  currentFilter = "all";

  const titleText = `${currentKey} vs ${compareKey}`;
  document.getElementById("deltaTitle").textContent = titleText;

  // Add a subtitle to clarify current vs previous
  const subtitleElement = document.getElementById("deltaSubtitle");
  if (subtitleElement) {
    subtitleElement.remove();
  }

  const subtitle = document.createElement("p");
  subtitle.id = "deltaSubtitle";
  subtitle.style.cssText =
    "color: #6b7280; font-size: 0.875rem; margin-top: 8px;";
  subtitle.textContent = `📊 Comparing: ${compareKey} → ${currentKey} (Previous → Current)`;

  document
    .getElementById("deltaTitle")
    .parentNode.insertBefore(
      subtitle,
      document.getElementById("deltaTitle").nextSibling
    );
  document.getElementById("newEntries").textContent = currentDelta.added.length;
  document.getElementById("exitedEntries").textContent =
    currentDelta.removed.length;
  document.getElementById("changedEntries").textContent =
    currentDelta.changed.length;
  document.getElementById("allEntries").textContent = currentDelta.all.length;

  // Reset active filter
  document
    .querySelectorAll(".delta-stat.clickable")
    .forEach((card) => card.classList.remove("active"));
  document.getElementById("filterAll").classList.add("active");

  renderDeltaChart(currentDelta);
  renderTable(currentDelta, "all", currentKey, compareKey);

  // Scroll to delta section
  setTimeout(() => {
    document
      .getElementById("deltaSection")
      .scrollIntoView({ behavior: "smooth", block: "start" });
  }, 100);
}

function renderYearlyChart(stockName) {
  const ctx = document.getElementById("yearlyChart").getContext("2d");
  if (yearlyChart) yearlyChart.destroy();

  const labels = [];
  const values = [];

  availableMonths.forEach(({ month, year, key }) => {
    const data = allData[key];
    if (data) {
      labels.push(`${month.substring(0, 3)} ${year}`);
      const holding = data.holdings.find((h) => h.company === stockName);
      values.push(holding ? holding.percentOfNAV : 0);
    }
  });

  yearlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: stockName,
          data: values,
          borderColor: "#2563eb",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8,
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
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "% of NAV" },
        },
      },
    },
  });
}

function renderTop5TrendChart() {
  const ctx = document.getElementById("top5TrendChart").getContext("2d");
  if (top5TrendChart) top5TrendChart.destroy();

  // Get top 5 stocks from the latest month
  const latestKey = availableMonths[availableMonths.length - 1]?.key;
  if (!latestKey) return;

  const latestData = allData[latestKey];
  const top5Stocks = latestData.holdings.slice(0, 5).map((h) => h.company);

  const labels = availableMonths.map(
    ({ month, year }) => `${month.substring(0, 3)}`
  );

  const datasets = top5Stocks.map((stock, index) => {
    const values = availableMonths.map(({ key }) => {
      const data = allData[key];
      const holding = data?.holdings.find((h) => h.company === stock);
      return holding ? holding.percentOfNAV : 0;
    });

    return {
      label: stock.length > 20 ? stock.substring(0, 20) + "..." : stock,
      data: values,
      borderColor: getChartColors(5)[index],
      backgroundColor: "transparent",
      tension: 0.3,
      pointRadius: 4,
    };
  });

  top5TrendChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}%`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: "% of NAV" },
        },
      },
    },
  });
}

function displayMonth(key) {
  const data = allData[key];
  if (!data) return;

  currentData = data;
  currentDelta = null;

  updateStats(data);
  renderAllocationChart(data);
  renderPieChart(data);

  document.getElementById("deltaSection").style.display = "none";
}

function renderYearlyMatrix() {
  const header = document.getElementById("yearlyMatrixHeader");
  const body = document.getElementById("yearlyMatrixBody");

  if (!header || !body || availableMonths.length === 0) return;

  // Clear existing content
  header.innerHTML = "";
  body.innerHTML = "";

  // Create header row
  const headerRow = document.createElement("tr");

  // First column is Company Name
  const companyTh = document.createElement("th");
  companyTh.textContent = "Company Name";
  headerRow.appendChild(companyTh);

  // Add month columns
  availableMonths.forEach((m) => {
    const th = document.createElement("th");
    th.textContent = `${m.month.substring(0, 3)} ${m.year}`;
    headerRow.appendChild(th);
  });

  header.appendChild(headerRow);

  // Get all unique companies across all months
  const allCompanies = new Set();
  Object.values(allData).forEach((data) => {
    data.holdings.forEach((h) => allCompanies.add(h.company));
  });

  const sortedCompanies = Array.from(allCompanies).sort();

  // Create rows for each company
  sortedCompanies.forEach((company) => {
    const row = document.createElement("tr");

    // Company name cell
    const nameTd = document.createElement("td");
    nameTd.textContent = company;
    row.appendChild(nameTd);

    // Month cells
    availableMonths.forEach((m) => {
      const td = document.createElement("td");
      const monthData = allData[m.key];
      const holding = monthData
        ? monthData.holdings.find((h) => h.company === company)
        : null;

      if (holding) {
        td.textContent = holding.percentOfNAV.toFixed(2) + "%";
        if (holding.percentOfNAV > 5) td.style.fontWeight = "bold";
      } else {
        td.textContent = "-";
        td.style.color = "#ccc";
      }

      row.appendChild(td);
    });

    body.appendChild(row);
  });
}

function renderYearlyComparisonTable() {
  const header = document.getElementById("yearlyComparisonHeader");
  const body = document.getElementById("yearlyComparisonBody");

  if (!header || !body || availableMonths.length === 0) return;

  // Clear existing content
  header.innerHTML = "";
  body.innerHTML = "";

  // Create header row
  const headerRow = document.createElement("tr");

  // First column is Company Name
  const companyTh = document.createElement("th");
  companyTh.textContent = "Company Name";
  companyTh.className = "sticky-col";
  headerRow.appendChild(companyTh);

  // Add month columns
  availableMonths.forEach((m) => {
    const th = document.createElement("th");
    th.textContent = `${m.month.substring(0, 3)} ${m.year}`;
    headerRow.appendChild(th);
  });

  header.appendChild(headerRow);

  // Get all unique companies across all months
  const allCompanies = new Set();
  Object.values(allData).forEach((data) => {
    data.holdings.forEach((h) => allCompanies.add(h.company));
  });

  const sortedCompanies = Array.from(allCompanies).sort();

  // Create rows for each company
  sortedCompanies.forEach((company) => {
    const row = document.createElement("tr");

    // Company name cell (sticky)
    const nameTd = document.createElement("td");
    nameTd.textContent = company;
    nameTd.className = "sticky-col";
    row.appendChild(nameTd);

    // Month cells
    availableMonths.forEach((m) => {
      const td = document.createElement("td");
      const monthData = allData[m.key];
      const holding = monthData
        ? monthData.holdings.find((h) => h.company === company)
        : null;

      if (holding) {
        td.textContent = holding.percentOfNAV.toFixed(2) + "%";
        // Optional: Add coloring based on value
        if (holding.percentOfNAV > 5) td.style.fontWeight = "bold";
      } else {
        td.textContent = "-";
        td.style.color = "#ccc";
      }

      row.appendChild(td);
    });

    body.appendChild(row);
  });
}

async function init() {
  const loading = document.getElementById("loadingOverlay");

  try {
    availableMonths = await loadAvailableMonths();

    if (availableMonths.length === 0) {
      loading.innerHTML = `
        <div style="text-align: center; padding: 40px;">
          <h2>No Data Found</h2>
          <p style="margin-top: 16px; color: #666;">
            Please run the Python extraction script first:<br><br>
            <code style="background: #f3f4f6; padding: 8px 16px; border-radius: 4px;">
              .\\venv\\Scripts\\activate; python scripts/run_extraction.py
            </code>
          </p>
        </div>
      `;
      return;
    }

    populateDropdowns(availableMonths);
    populateStockDropdown();

    const latestKey = availableMonths[availableMonths.length - 1].key;
    displayMonth(latestKey);

    // Render yearly trend charts and comparison table
    renderTop5TrendChart();
    renderYearlyComparisonTable();

    // Event listeners
    document.getElementById("monthSelect").addEventListener("change", (e) => {
      displayMonth(e.target.value);
    });

    document.getElementById("compareBtn").addEventListener("click", showDelta);

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

    // Filter card click handlers
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

    console.log("Filter click handlers attached");

    // Stock select for yearly chart
    document.getElementById("stockSelect").addEventListener("change", (e) => {
      if (e.target.value) {
        renderYearlyChart(e.target.value);
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
