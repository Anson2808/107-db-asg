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
});

async function loadAnalytics() {
  try {
    const data = await api("/analytics/performance");
    renderDashboard(data);
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

  // Chart 3: Rating Trend
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
//   CHART 3 — Rating Trend (line chart)
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
