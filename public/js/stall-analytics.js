/**
 * stall-analytics.js — Performance dashboard for stall owners
 */
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  // Guard
  if (!isLoggedIn()) {
    window.location.href = "/login.html";
    return;
  }
  if (!isRole("stallOwner")) {
    window.location.href = "/";
    return;
  }

  loadAnalytics();

  // Ensure the dropdown triggers a reload
  const filterDropdown = document.getElementById("dateRangeFilter");
  if (filterDropdown) {
    filterDropdown.addEventListener("change", loadAnalytics);
  }
});

async function loadAnalytics() {
  try {
    // Grab the current filter value
    const range = document.getElementById("dateRangeFilter")?.value || 'monthly';
    
    // Fetch both endpoints at the same time for speed
    const [perfData, hygieneData] = await Promise.all([
      api(`/analytics/performance?range=${range}`),
      api("/inspections/history").catch(() => ({ history: [] })) // Graceful fallback if no hygiene data exists yet
    ]);
    
    renderDashboard(perfData);
    renderHygieneSection(hygieneData.history);
  } catch (err) {
    document.getElementById("loadingState").textContent =
      "Failed to load analytics: " + err.message;
  }
}

function renderDashboard(data) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("analyticsContent").style.display = "block";

  // Stat cards
  const stats = data.orderStats || {};
  document.getElementById("statTotalOrders").textContent = stats.totalOrders || 0;
  document.getElementById("statTotalRevenue").textContent =
    "$" + Number(stats.totalRevenue || 0).toFixed(2);

  // Average rating across all feedback
  const ratings = data.ratingTrend || [];
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.avgRating, 0) / ratings.length).toFixed(1)
      : "—";
  document.getElementById("statAvgRating").textContent = avgRating;

  // Chart 1: Revenue by Day
  renderRevenueChart(data.revenueByDay || []);

  // Chart 2: Popular Items
  renderPopularItemsChart(data.popularItems || []);

  // Chart 3: Peak Hours
  if (data.peakHours) {
    renderPeakHoursChart(data.peakHours);
  }

  // Chart 4: Rating Trend
  renderRatingTrendChart(data.ratingTrend || []);
}

// ============================================================
//   CHART 1 — Revenue by Day (line chart)
// ============================================================
let revenueChartInstance = null;

function renderRevenueChart(rows) {
  const ctx = document.getElementById("revenueChart").getContext("2d");

  if (revenueChartInstance) revenueChartInstance.destroy();

  const labels = rows.map((r) => {
    const d = new Date(r.date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const values = rows.map((r) => Number(r.revenue));

  revenueChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue ($)",
          data: values,
          borderColor: "#4F46E5",
          backgroundColor: "rgba(79,70,229,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#4F46E5",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => "$" + v },
        },
      },
    },
  });
}

// ============================================================
//   CHART 2 — Popular Items (horizontal bar)
// ============================================================
let popularItemsChartInstance = null;

function renderPopularItemsChart(rows) {
  const ctx = document.getElementById("popularItemsChart").getContext("2d");

  if (popularItemsChartInstance) popularItemsChartInstance.destroy();

  const labels = rows.map((r) => r.name);
  const values = rows.map((r) => Number(r.totalQty));

  const colors = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE"];

  popularItemsChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Qty Sold",
          data: values,
          backgroundColor: colors.slice(0, labels.length),
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

// ============================================================
//   CHART 3 — Peak Hours (bar)
// ============================================================
let peakHoursChartInstance = null;

function renderPeakHoursChart(rows) {
  const canvas = document.getElementById("peakHoursChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (peakHoursChartInstance) peakHoursChartInstance.destroy();

  // Format hours from 0-23 to 12AM-11PM
  const formatHour = (h) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
  
  const labels = rows.map((r) => formatHour(r.hour));
  const values = rows.map((r) => Number(r.volume));

  peakHoursChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Order Volume",
          data: values,
          backgroundColor: "#10B981", // Success Green
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

// ============================================================
//   CHART 4 — Rating Trend (line chart)
// ============================================================
let ratingTrendChartInstance = null;

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function renderRatingTrendChart(rows) {
  const ctx = document.getElementById("ratingTrendChart").getContext("2d");

  if (ratingTrendChartInstance) ratingTrendChartInstance.destroy();

  const labels = rows.map(
    (r) => `${MONTH_NAMES[r.month - 1]} ${r.year}`
  );
  const values = rows.map((r) => r.avgRating);

  ratingTrendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Avg Rating",
          data: values,
          borderColor: "#F59E0B",
          backgroundColor: "rgba(245,158,11,0.08)",
          fill: true,
          tension: 0.3,
          pointRadius: 5,
          pointBackgroundColor: "#F59E0B",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 1,
          max: 5,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

// ============================================================
//   HYGIENE SECTION (Chart & Table)
// ============================================================
function renderHygieneSection(history) {
  const tbody = document.getElementById("hygieneTableBody");
  const noRecords = document.getElementById("noHygieneRecords");

  // 1. Render Table
  if (!history || history.length === 0) {
    noRecords.style.display = "block";
    return;
  }

  tbody.innerHTML = history.map(record => {
    // Format date specifically for Singapore standards
    const date = new Date(record.InspectionDate).toLocaleDateString('en-SG');
    
    let badgeClass = 'badge-unavailable'; // Default red/gray
    if (record.Grade === 'A') badgeClass = 'badge-available'; // Green
    if (record.Grade === 'B') badgeClass = 'badge-open'; // Blue

    return `
      <tr>
        <td>${date}</td>
        <td><span class="badge ${badgeClass}">Grade ${record.Grade}</span></td>
        <td><strong>${record.Score}</strong>/100</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size: 12px; color: var(--text-muted); padding-top: 0; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
          Note: ${record.Violations || 'None'}
        </td>
      </tr>
    `;
  }).join("");

  // 2. Render Chart
  renderHygieneChart(history);
}

let hygieneChartInstance = null;

function renderHygieneChart(history) {
  const ctx = document.getElementById("hygieneChart").getContext("2d");
  if (hygieneChartInstance) hygieneChartInstance.destroy();

  const labels = history.map(r => {
    const d = new Date(r.InspectionDate);
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  });
  const values = history.map(r => r.Score);

  hygieneChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Score",
          data: values,
          borderColor: "#10B981", 
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: "#10B981",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
      },
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20 },
        },
      },
    },
  });
}