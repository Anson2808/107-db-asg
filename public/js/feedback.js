"use strict";

function showFeedbackMessage(message, type) {
  const el = document.getElementById("feedbackMessage");
  if (!el) return;

  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = "block";
}

async function loadStalls() {
  const select = document.getElementById("stallId");
  if (!select) return;

  const data = await api("/stalls");
  const stalls = data.stalls || [];

  select.innerHTML = `<option value="">${t("selectStall")}</option>` +
    stalls.map((stall) => (
      `<option value="${stall.StallId}">${escapeHtml(stall.StallName)} (${escapeHtml(stall.CuisineType)})</option>`
    )).join("");
}

function validateFeedbackForm(payload) {
  if (!payload.stallId) return t("chooseStall");
  if (!payload.rating || payload.rating < 1 || payload.rating > 5) return t("chooseRating");
  if (!payload.comment) return t("enterComment");
  return "";
}

async function handleFeedbackSubmit(event) {
  event.preventDefault();

  const submitBtn = document.getElementById("submitFeedbackBtn");
  const payload = {
    stallId: Number(document.getElementById("stallId").value),
    rating: Number(document.getElementById("rating").value),
    category: document.getElementById("category").value,
    comment: document.getElementById("comment").value.trim(),
  };

  const validationError = validateFeedbackForm(payload);
  if (validationError) {
    showFeedbackMessage(validationError, "error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t("submitting");

  try {
    await api("/feedback", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    event.target.reset();
    showFeedbackMessage(t("feedbackSuccess"), "success");
  } catch (err) {
    showFeedbackMessage(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("submitFeedback");
  }
}

async function initFeedbackPage() {
  renderNavbar();

  if (!isLoggedIn()) {
    window.location.href = "/login.html";
    return;
  }

  if (!isRole("customer")) {
    showFeedbackMessage(t("customerOnlyFeedback"), "error");
    document.getElementById("feedbackForm").style.display = "none";
    return;
  }

  try {
    await loadStalls();
  } catch (err) {
    showFeedbackMessage(`${t("loadStallsFailed")}: ${err.message}`, "error");
  }

  applyTranslations();
  document.getElementById("feedbackForm").addEventListener("submit", handleFeedbackSubmit);
}

document.addEventListener("DOMContentLoaded", initFeedbackPage);
