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

  setupInitialDates();
  loadAnalytics();

  // Preset dropdown listener
  const presetSelect = document.getElementById("datePresetSelect");
  const customContainer = document.getElementById("customDateContainer");
  if (presetSelect) {
    presetSelect.addEventListener("change", () => {
      if (presetSelect.value === "custom") {
        if (customContainer) customContainer.style.display = "flex";
      } else {
        if (customContainer) customContainer.style.display = "none";
        loadAnalytics();
      }
    });
  }

  // Custom date Apply button
  const applyBtn = document.getElementById("applyCustomDateBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", loadAnalytics);
  }

  // Feedback sort filter
  const sortFilter = document.getElementById("feedbackSortFilter");
  if (sortFilter) {
    sortFilter.addEventListener("change", () => {
      if (window._satisfactionRows) {
        renderFeedbackTable(window._satisfactionRows);
      }
    });
  }
});

function setupInitialDates() {
  const startInput = document.getElementById("startDateInput");
  const endInput = document.getElementById("endDateInput");
  const { startDate, endDate } = getPresetDates("thisMonth");
  if (startInput && !startInput.value) startInput.value = startDate;
  if (endInput && !endInput.value) endInput.value = endDate;
}

function getPresetDates(preset) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const dayOfWeek = now.getDay();

  const formatDate = (d) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  let start = new Date(now);
  let end = new Date(now);

  if (preset === "thisWeek") {
    const distanceToMon = (dayOfWeek + 6) % 7;
    start.setDate(day - distanceToMon);
    end = new Date(now);
  } else if (preset === "lastWeek") {
    const distanceToMon = (dayOfWeek + 6) % 7;
    start.setDate(day - distanceToMon - 7);
    end.setDate(day - distanceToMon - 1);
  } else if (preset === "thisMonth") {
    start = new Date(year, month, 1);
    end = new Date(now);
  } else if (preset === "lastMonth") {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 0);
  } else if (preset === "custom") {
    const sVal = document.getElementById("startDateInput")?.value;
    const eVal = document.getElementById("endDateInput")?.value;
    return {
      startDate: sVal || formatDate(new Date(year, month, 1)),
      endDate: eVal || formatDate(now)
    };
  }

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

async function loadAnalytics() {
  try {
    const preset = document.getElementById("datePresetSelect")?.value || "thisMonth";
    const { startDate, endDate } = getPresetDates(preset);

    const url = `/analytics/performance?startDate=${startDate}&endDate=${endDate}`;

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
  renderRevenueChart(data.revenueByDay || [], data.startDate, data.endDate);

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

function renderRevenueChart(rows, startDate, endDate) {
  const titleEl = document.getElementById("revenueChartTitle");
  const wrapper = document.getElementById("revenueChartWrapper");
  const noDataEl = document.getElementById("noRevenueData");

  if (titleEl) {
    if (startDate && endDate) {
      titleEl.textContent = `Revenue: ${startDate} to ${endDate}`;
    } else {
      titleEl.textContent = "Revenue Overview";
    }
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

  const labels = rows.map((r) => r.date);
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
        pointRadius: rows.length === 1 ? 6 : 4,
        pointHoverRadius: 7,
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
//   HYGIENE / INSPECTION SECTION
// ============================================================
let hygieneChartInstance = null;

function renderHygieneSection(history) {
  renderHygieneChart(history || []);
  renderHygieneTable(history || []);
}

function renderHygieneChart(history) {
  const ctx = document.getElementById("hygieneChart")?.getContext("2d");
  if (!ctx) return;

  if (hygieneChartInstance) hygieneChartInstance.destroy();

  if (!history || history.length === 0) return;

  const sorted = [...history].sort(
    (a, b) => new Date(a.InspectionDate) - new Date(b.InspectionDate)
  );

  const labels = sorted.map((h) =>
    new Date(h.InspectionDate).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    })
  );
  const scores = sorted.map((h) => h.Score);

  hygieneChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Inspection Score",
          data: scores,
          borderColor: "#10B981",
          backgroundColor: "rgba(16,185,129,0.08)",
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
      plugins: { legend: { display: false } },
      scales: { y: { min: 0, max: 100, ticks: { stepSize: 20 } } },
    },
  });
}

function renderHygieneTable(history) {
  const tbody = document.getElementById("hygieneTableBody");
  const noRec = document.getElementById("noHygieneRecords");

  if (!tbody) return;

  if (!history || history.length === 0) {
    tbody.innerHTML = "";
    if (noRec) noRec.style.display = "block";
    return;
  }

  if (noRec) noRec.style.display = "none";

  const sorted = [...history].sort(
    (a, b) => new Date(b.InspectionDate) - new Date(a.InspectionDate)
  );

  tbody.innerHTML = sorted
    .map((record) => {
      const dateStr = new Date(record.InspectionDate).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "short", day: "numeric" }
      );
      const gradeClass =
        record.Grade === "A"
          ? "badge-available"
          : record.Grade === "B"
          ? "badge-low-stock"
          : "badge-closed";

      return `
        <tr>
          <td>${dateStr}</td>
          <td>${record.Score}</td>
          <td><span class="badge ${gradeClass}">${record.Grade}</span></td>
          <td>${escapeHtml(record.Violations || "None")}</td>
          <td>${escapeHtml(record.Notes || "-")}</td>
        </tr>
      `;
    })
    .join("");
}

// ============================================================
//   CUSTOMER SATISFACTION SECTION
// ============================================================
function renderSatisfactionSection(data) {
  window._satisfactionRows = data.feedback || [];
  renderFeedbackTable(window._satisfactionRows);
}

function renderFeedbackTable(rows) {
  const tbody = document.getElementById("feedbackTableBody");
  const noFb = document.getElementById("noFeedback");

  if (!tbody) return;

  if (!rows || rows.length === 0) {
    tbody.innerHTML = "";
    if (noFb) noFb.style.display = "block";
    return;
  }

  if (noFb) noFb.style.display = "none";

  const sortVal = document.getElementById("feedbackSortFilter")?.value || "newest";

  const sorted = [...rows].sort((a, b) => {
    if (sortVal === "lowest") return a.Rating - b.Rating;
    if (sortVal === "highest") return b.Rating - a.Rating;
    return new Date(b.CreatedAt) - new Date(a.CreatedAt);
  });

  tbody.innerHTML = sorted
    .map((f) => {
      const dateStr = new Date(f.CreatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      const stars = "★".repeat(f.Rating) + "☆".repeat(5 - f.Rating);

      const hasReply = f.OwnerReply && f.OwnerReply.trim() !== "";
      let replyHtml = "";
      if (hasReply) {
        const replyDate = new Date(f.RepliedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        replyHtml = `
          <div class="owner-reply-box" style="margin-top:8px; padding:8px 12px; background:var(--bg-muted); border-left:3px solid var(--primary); border-radius:4px; font-size:13px;">
            <strong>Owner Response (${replyDate}):</strong> ${escapeHtml(f.OwnerReply)}
          </div>
        `;
      }

      const actionHtml = hasReply
        ? `<span class="badge badge-available">Replied</span>`
        : `<button class="btn btn-secondary btn-sm" onclick="toggleReplyForm(${f.FeedbackId})">Reply</button>`;

      return `
        <tr>
          <td>${dateStr}</td>
          <td>${escapeHtml(f.CustomerName || "Anonymous")}</td>
          <td><span style="color:#F59E0B;">${stars}</span> (${f.Rating})</td>
          <td>${escapeHtml(f.Category || "General")}</td>
          <td>
            <div>${escapeHtml(f.Comment || "No comment provided.")}</div>
            ${replyHtml}
            <div id="replyForm_${f.FeedbackId}" class="edit-form" style="margin-top:8px;">
              <textarea id="replyText_${f.FeedbackId}" class="form-select" style="width:100%; min-height:60px;" placeholder="Write your response to customer..."></textarea>
              <div style="display:flex; gap:8px; margin-top:6px;">
                <button class="btn btn-primary btn-sm" onclick="submitOwnerReply(${f.FeedbackId})">Submit Reply</button>
                <button class="btn btn-secondary btn-sm" onclick="toggleReplyForm(${f.FeedbackId})">Cancel</button>
              </div>
            </div>
          </td>
          <td>${actionHtml}</td>
        </tr>
      `;
    })
    .join("");
}

function toggleReplyForm(feedbackId) {
  const form = document.getElementById(`replyForm_${feedbackId}`);
  if (form) {
    form.classList.toggle("visible");
  }
}

async function submitOwnerReply(feedbackId) {
  try {
    const textEl = document.getElementById(`replyText_${feedbackId}`);
    const ownerReply = textEl?.value?.trim();

    if (!ownerReply) {
      showToast("Please enter a reply before submitting.", "error");
      return;
    }

    await api(`/feedback/${feedbackId}/reply`, {
      method: "PUT",
      body: JSON.stringify({ ownerReply }),
    });

    showToast("Reply submitted successfully!", "success");

    const row = window._satisfactionRows?.find((r) => r.FeedbackId === feedbackId);
    if (row) {
      row.OwnerReply = ownerReply;
      row.RepliedAt = new Date().toISOString();
    }

    renderFeedbackTable(window._satisfactionRows || []);
  } catch (err) {
    showToast("Failed to submit reply: " + err.message, "error");
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}