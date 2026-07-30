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

  // Filter dropdown listeners
  ["dateRangeFilter", "selectMonthFilter", "selectYearFilter"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", loadAnalytics);
  });

  // Feedback sort filter — re-renders from cached data, no API call
  const sortFilter = document.getElementById("feedbackSortFilter");
  if (sortFilter) {
    sortFilter.addEventListener("change", () => {
      if (window._satisfactionRows) {
        renderFeedbackTable(window._satisfactionRows);
      }
    });
  }
});

async function loadAnalytics() {
  try {
    const range = document.getElementById("dateRangeFilter")?.value || 'monthly';
    const month = document.getElementById("selectMonthFilter")?.value || '';
    const year = document.getElementById("selectYearFilter")?.value || '';

    let url = `/analytics/performance?range=${range}`;
    if (month) url += `&month=${month}`;
    if (year) url += `&year=${year}`;
    
    // Fetch all endpoints concurrently
    const [perfData, hygieneData, satisfactionData] = await Promise.all([
      api(url),
      api("/inspections/history").catch(() => ({ history: [] })),
      api("/analytics/satisfaction").catch(() => ({ feedback: [] }))
    ]);
    
    renderDashboard(perfData);
    renderHygieneSection(hygieneData.history);
    renderSatisfactionSection(satisfactionData);
  } catch (err) {
    document.getElementById("loadingState").textContent =
      "Failed to load analytics: " + err.message;
  }
}

function renderDashboard(data) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("analyticsContent").style.display = "block";

  // Stat cards
  const stallNameEl = document.getElementById("statStallName");
  if (stallNameEl) stallNameEl.textContent = data.stallName || "My Stall";

  const stats = data.orderStats || {};
  document.getElementById("statTotalOrders").textContent = stats.totalOrders || 0;
  document.getElementById("statTotalRevenue").textContent =
    "$" + Number(stats.totalRevenue || 0).toFixed(2);
  const aovEl = document.getElementById("statAov");
  if (aovEl) {
    aovEl.textContent = "$" + Number(stats.aov || 0).toFixed(2);
  }

  // Busiest Day stat
  const busiest = data.busiestDay || {};
  const busiestEl = document.getElementById("statBusiestDay");
  if (busiestEl) {
    busiestEl.textContent = busiest.dayName && busiest.dayName !== "N/A"
      ? `${busiest.dayName} (${busiest.volume} orders)`
      : "N/A";
  }

  // Average rating across all feedback
  const ratings = data.ratingTrend || [];
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((s, r) => s + r.avgRating, 0) / ratings.length).toFixed(1)
      : "—";
  document.getElementById("statAvgRating").textContent = avgRating;

  // Chart 1: Revenue
  renderRevenueChart(data.revenueByDay || []);

  // Chart 2: Popular Items
  renderPopularItemsChart(data.popularItems || []);

  // Table: Lowest Performing Items
  renderLowestItemsTable(data.lowestPerformingItems || []);

  // Chart 3: Peak Hours
  renderPeakHoursChart(data.peakHours || []);

  // Chart 4: Rating Trend
  renderRatingTrendChart(data.ratingTrend || []);
}

// ============================================================
//   CHART 1 — Revenue (line chart)
// ============================================================
let revenueChartInstance = null;

function renderRevenueChart(rows) {
  const range = document.getElementById("dateRangeFilter")?.value || "monthly";
  const titleEl = document.getElementById("revenueChartTitle");
  const wrapper = document.getElementById("revenueChartWrapper");
  const noDataEl = document.getElementById("noRevenueData");

  if (titleEl) {
    titleEl.textContent = (range === "yearly" || range === "ytd") ? "Revenue by Month" : "Revenue by Day";
  }

  if (!rows || rows.length === 0) {
    if (revenueChartInstance) revenueChartInstance.destroy();
    if (wrapper) wrapper.style.display = "none";
    if (noDataEl) noDataEl.style.display = "block";
    return;
  }

  if (wrapper) wrapper.style.display = "block";
  if (noDataEl) noDataEl.style.display = "none";

  const ctx = document.getElementById("revenueChart").getContext("2d");
  if (revenueChartInstance) revenueChartInstance.destroy();

  const labels = rows.map((r) => {
    if (typeof r.date === "string" && r.date.match(/^\d{4}-\d{2}$/)) {
      const [year, month] = r.date.split("-");
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    const d = new Date(r.date);
    return (range === "yearly" || range === "ytd")
      ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" })
      : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const values = rows.map((r) => Number(r.revenue));

  revenueChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Revenue ($)",
        data: values,
        borderColor: "#4F46E5",
        backgroundColor: "rgba(79,70,229,0.08)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#4F46E5",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: (v) => "$" + v } } },
    },
  });
}

function renderLowestItemsTable(rows) {
  const tbody = document.getElementById("lowestItemsTableBody");
  const noLowest = document.getElementById("noLowestItems");

  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = "";
    if (noLowest) noLowest.style.display = "block";
    return;
  }

  if (noLowest) noLowest.style.display = "none";

  tbody.innerHTML = rows
    .map((item) => {
      const isZero = item.isZeroSales || item.totalQty === 0;
      const flagHtml = isZero
        ? '<span class="badge badge-closed">0 Sales (Dead Weight)</span>'
        : '<span class="badge badge-unavailable">Low Volume</span>';

      return `
        <tr>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${item.totalQty}</td>
          <td>${flagHtml}</td>
        </tr>
      `;
    })
    .join("");
}

// ============================================================
//   CHART 2 — Popular Items (horizontal bar)
// ============================================================
let popularItemsChartInstance = null;

function renderPopularItemsChart(rows) {
  const wrapper = document.getElementById("popularItemsWrapper");
  const noDataEl = document.getElementById("noPopularItems");

  if (!rows || rows.length === 0) {
    if (popularItemsChartInstance) popularItemsChartInstance.destroy();
    if (wrapper) wrapper.style.display = "none";
    if (noDataEl) noDataEl.style.display = "block";
    return;
  }

  if (wrapper) wrapper.style.display = "block";
  if (noDataEl) noDataEl.style.display = "none";

  const ctx = document.getElementById("popularItemsChart").getContext("2d");
  if (popularItemsChartInstance) popularItemsChartInstance.destroy();

  const labels = rows.map((r) => r.name);
  const values = rows.map((r) => Number(r.totalQty));
  const colors = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE"];

  popularItemsChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Qty Sold",
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderRadius: 6,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

// ============================================================
//   CHART 3 — Peak Hours (bar)
// ============================================================
let peakHoursChartInstance = null;

function renderPeakHoursChart(rows) {
  const canvas = document.getElementById("peakHoursChart");
  const wrapper = document.getElementById("peakHoursWrapper");
  const noDataEl = document.getElementById("noPeakHours");
  if (!canvas) return;

  if (!rows || rows.length === 0) {
    if (peakHoursChartInstance) peakHoursChartInstance.destroy();
    if (wrapper) wrapper.style.display = "none";
    if (noDataEl) noDataEl.style.display = "block";
    return;
  }

  if (wrapper) wrapper.style.display = "block";
  if (noDataEl) noDataEl.style.display = "none";

  const ctx = canvas.getContext("2d");
  if (peakHoursChartInstance) peakHoursChartInstance.destroy();

  const formatHour = (h) => h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
  const labels = rows.map((r) => formatHour(r.hour));
  const values = rows.map((r) => Number(r.volume));

  peakHoursChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Order Volume",
        data: values,
        backgroundColor: "#10B981",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });
}

// ============================================================
//   CHART 4 — Rating Trend (line chart)
// ============================================================
let ratingTrendChartInstance = null;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function renderRatingTrendChart(rows) {
  const wrapper = document.getElementById("ratingTrendWrapper");
  const noDataEl = document.getElementById("noRatingTrend");

  if (!rows || rows.length === 0) {
    if (ratingTrendChartInstance) ratingTrendChartInstance.destroy();
    if (wrapper) wrapper.style.display = "none";
    if (noDataEl) noDataEl.style.display = "block";
    return;
  }

  if (wrapper) wrapper.style.display = "block";
  if (noDataEl) noDataEl.style.display = "none";

  const ctx = document.getElementById("ratingTrendChart").getContext("2d");
  if (ratingTrendChartInstance) ratingTrendChartInstance.destroy();

  const labels = rows.map((r) => `${MONTH_NAMES[r.month - 1]} ${r.year}`);
  const values = rows.map((r) => r.avgRating);

  ratingTrendChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Avg Rating",
        data: values,
        borderColor: "#F59E0B",
        backgroundColor: "rgba(245,158,11,0.08)",
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: "#F59E0B",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } },
    },
  });
}

// ============================================================
//   HYGIENE SECTION
// ============================================================
function renderHygieneSection(history) {
  const tbody = document.getElementById("hygieneTableBody");
  const noRecords = document.getElementById("noHygieneRecords");

  if (!history || history.length === 0) {
    if(noRecords) noRecords.style.display = "block";
    return;
  }

  if(tbody) {
    tbody.innerHTML = history.map(record => {
      const date = new Date(record.InspectionDate).toLocaleDateString('en-SG');
      let badgeClass = 'badge-unavailable';
      if (record.Grade === 'A') badgeClass = 'badge-available';
      if (record.Grade === 'B') badgeClass = 'badge-open';

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
  }
  renderHygieneChart(history);
}

let hygieneChartInstance = null;

function renderHygieneChart(history) {
  const canvas = document.getElementById("hygieneChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
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
      datasets: [{
        label: "Score",
        data: values,
        borderColor: "#10B981", 
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: "#10B981",
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { stepSize: 20 } } },
    },
  });
}

// ============================================================
//   CUSTOMER SATISFACTION SECTION
// ============================================================
let satisfactionRows = [];

function renderSatisfactionSection(data) {
  satisfactionRows = (data && data.feedback) ? data.feedback : [];
  window._satisfactionRows = satisfactionRows;
  renderFeedbackTable(satisfactionRows);
}

function renderFeedbackTable(rows) {
  const feedbackBody = document.getElementById("feedbackTableBody");
  const noFeedback = document.getElementById("noFeedback");
  const sortValue = document.getElementById("feedbackSortFilter")?.value || "newest";

  if (!rows || rows.length === 0) {
    if (noFeedback) noFeedback.style.display = "block";
    if (feedbackBody) feedbackBody.innerHTML = "";
    return;
  }

  if (noFeedback) noFeedback.style.display = "none";

  const sorted = [...rows].sort((a, b) => {
    if (sortValue === "lowest") return a.Rating - b.Rating;
    if (sortValue === "highest") return b.Rating - a.Rating;
    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
  });

  if (feedbackBody) {
    feedbackBody.innerHTML = sorted.map(f => {
      const date = new Date(f.CreatedAt).toLocaleDateString("en-SG");
      const replyHtml = f.OwnerReply
        ? `<div style="margin-top:8px; padding:8px 12px; background:rgba(79,70,229,0.08); border-left:3px solid #4F46E5; border-radius:4px; font-size:13px;">
             <strong>Owner Reply:</strong> ${escapeHtml(f.OwnerReply)}
           </div>`
        : '';

      return `
        <tr>
          <td>${date}</td>
          <td>${escapeHtml(f.Username)}</td>
          <td><strong>${f.Rating}</strong>/5</td>
          <td>${f.Category ? `<span class="badge badge-closed">${escapeHtml(f.Category)}</span>` : "—"}</td>
          <td>
            <div>${escapeHtml(f.Comment)}</div>
            ${replyHtml}
            <div id="replyBox_${f.FeedbackId}" style="display:none; margin-top:8px;">
              <textarea id="replyInput_${f.FeedbackId}" class="form-textarea" style="width:100%; min-height:60px; margin-bottom:6px;" placeholder="Write a reply...">${f.OwnerReply ? escapeHtml(f.OwnerReply) : ''}</textarea>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-primary btn-sm" onclick="submitOwnerReply(${f.FeedbackId})">Submit Reply</button>
                <button class="btn btn-outline btn-sm" onclick="toggleReplyBox(${f.FeedbackId})">Cancel</button>
              </div>
            </div>
          </td>
          <td>
            <button class="btn btn-outline btn-sm" onclick="toggleReplyBox(${f.FeedbackId})">
              ${f.OwnerReply ? 'Edit Reply' : 'Reply'}
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }
}

window.toggleReplyBox = function(feedbackId) {
  const el = document.getElementById(`replyBox_${feedbackId}`);
  if (el) {
    el.style.display = el.style.display === "none" ? "block" : "none";
  }
};

window.submitOwnerReply = async function(feedbackId) {
  const input = document.getElementById(`replyInput_${feedbackId}`);
  const text = input ? input.value.trim() : '';

  if (!text) {
    alert("Reply message cannot be empty.");
    return;
  }

  try {
    await api(`/feedback/${feedbackId}/reply`, {
      method: "PUT",
      body: JSON.stringify({ ownerReply: text }),
    });

    const item = window._satisfactionRows.find(f => f.FeedbackId === feedbackId);
    if (item) {
      item.OwnerReply = text;
      item.RepliedAt = new Date().toISOString();
    }
    renderFeedbackTable(window._satisfactionRows);
  } catch (err) {
    alert("Failed to submit reply: " + err.message);
  }
};