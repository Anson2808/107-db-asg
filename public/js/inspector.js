/**
 * inspector.js — NEA Inspector dashboard: record inspections and view history
 */
'use strict';

document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  // Guard: must be logged in as inspector
  if (!isLoggedIn()) {
    window.location.href = "/login.html";
    return;
  }
  if (!isRole("inspector")) {
    window.location.href = "/";
    return;
  }

  // Set today's date as default
  document.getElementById("inspectionDate").value = new Date().toISOString().split("T")[0];

  // Load stalls dropdown
  loadStalls();

  // Form submit
  document.getElementById("inspectionForm").addEventListener("submit", handleSubmit);

  // Stall change → reload history
  document.getElementById("stallId").addEventListener("change", loadHistory);

  applyTranslations();
});

/* ============================================================
   TOAST
============================================================ */
function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ============================================================
   STALLS DROPDOWN
============================================================ */
async function loadStalls() {
  const select = document.getElementById("stallId");
  try {
    const data = await api("/stalls");
    const stalls = data.stalls || [];

    select.innerHTML = '<option value="">' + t("selectStall") + '</option>' +
      stalls.map((s) => `<option value="${s.StallId}">${escapeHtml(s.StallName)}</option>`).join("");
  } catch (err) {
    console.error("Failed to load stalls:", err);
    showToast(t("loadStallsFailed"), "error");
  }
}

/* ============================================================
   SUBMIT INSPECTION
============================================================ */
async function handleSubmit(e) {
  e.preventDefault();

  const messageEl = document.getElementById("inspectionMessage");
  const submitBtn = document.getElementById("submitInspectionBtn");
  messageEl.style.display = "none";

  const stallId = parseInt(document.getElementById("stallId").value, 10);
  if (!stallId) {
    messageEl.textContent = t("chooseStall");
    messageEl.className = "alert alert-error";
    messageEl.style.display = "block";
    return;
  }

  const payload = {
    stallId,
    inspectionDate: document.getElementById("inspectionDate").value,
    score: parseInt(document.getElementById("score").value, 10),
    grade: document.getElementById("grade").value,
    violations: document.getElementById("violations").value.trim(),
    notes: document.getElementById("notes").value.trim(),
  };

  submitBtn.disabled = true;
  submitBtn.textContent = t("submitting");

  try {
    await api("/inspections", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    showToast(t("inspectionSuccess"), "success");
    document.getElementById("inspectionForm").reset();
    document.getElementById("inspectionDate").value = new Date().toISOString().split("T")[0];
    await loadHistory();
  } catch (err) {
    messageEl.textContent = err.message || t("inspectionFailed");
    messageEl.className = "alert alert-error";
    messageEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("submitInspection");
  }
}

/* ============================================================
   INSPECTION HISTORY TABLE
============================================================ */
async function loadHistory() {
  const stallId = parseInt(document.getElementById("stallId").value, 10);
  const tbody = document.getElementById("historyTableBody");

  if (!stallId) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${t("noInspections")}</td></tr>`;
    return;
  }

  tbody.innerHTML = `<tr><td colspan="5" class="loading">${t("loadingReviews")}</td></tr>`;

  try {
    const data = await api(`/inspections/stall/${stallId}`);
    const history = data.history || [];

    if (history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${t("noInspections")}</td></tr>`;
      return;
    }

    tbody.innerHTML = history.map((insp) => `
      <tr>
        <td>${formatDate(insp.InspectionDate)}</td>
        <td>${insp.Score}</td>
        <td><span class="badge grade-badge-${insp.Grade.toLowerCase()}">${insp.Grade}</span></td>
        <td>${escapeHtml(insp.Violations || "—")}</td>
        <td>${escapeHtml(insp.Notes || "—")}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("Failed to load inspection history:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">${t("failedReviews")}</td></tr>`;
  }
}

/* ============================================================
   HELPERS
============================================================ */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
}

// escapeHtml from auth.js, t() from i18n.js
