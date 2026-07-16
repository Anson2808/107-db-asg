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
  if (payload.type === "feedback" && (!payload.rating || payload.rating < 1 || payload.rating > 5)) {
    return t("chooseRating");
  }
  if (payload.type === "complaint" && !payload.category) {
    return t("chooseCategory");
  }
  if (!payload.comment) return t("enterComment");
  return "";
}

function renderRatingOptions() {
  const rating = document.getElementById("rating");
  rating.innerHTML = `
    <option value="">${t("selectRating")}</option>
    <option value="5">5 - ${t("excellent")}</option>
    <option value="4">4 - ${t("good")}</option>
    <option value="3">3 - ${t("okay")}</option>
    <option value="2">2 - ${t("poor")}</option>
    <option value="1">1 - ${t("veryPoor")}</option>
  `;
}

function updateFormMode() {
  const type = document.getElementById("requestType").value;
  const isComplaint = type === "complaint";
  const ratingGroup = document.getElementById("ratingGroup");
  const categoryGroup = document.getElementById("categoryGroup");
  const rating = document.getElementById("rating");
  const category = document.getElementById("category");
  const comment = document.getElementById("comment");
  const submitBtn = document.getElementById("submitFeedbackBtn");

  ratingGroup.style.display = isComplaint ? "none" : "";
  categoryGroup.style.display = isComplaint ? "" : "none";
  rating.required = !isComplaint;
  category.required = isComplaint;
  comment.placeholder = isComplaint ? t("complaintPlaceholder") : t("feedbackPlaceholder");
  submitBtn.textContent = isComplaint ? t("submitComplaint") : t("submitFeedback");
}

async function handleFeedbackSubmit(event) {
  event.preventDefault();

  const submitBtn = event.target.querySelector("button[type='submit']");
  const type = document.getElementById("requestType").value;
  const payload = {
    type,
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
    const path = type === "complaint" ? "/complaints" : "/feedback";
    const body = type === "complaint"
      ? {
          stallId: payload.stallId,
          category: payload.category,
          description: payload.comment,
        }
      : {
          stallId: payload.stallId,
          rating: payload.rating,
          comment: payload.comment,
        };

    await api(path, {
      method: "POST",
      body: JSON.stringify(body),
    });

    event.target.reset();
    updateFormMode();
    showFeedbackMessage(type === "complaint" ? t("complaintSuccess") : t("feedbackSuccess"), "success");
  } catch (err) {
    showFeedbackMessage(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    updateFormMode();
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

  renderRatingOptions();
  applyTranslations();
  document.getElementById("requestType").addEventListener("change", updateFormMode);
  updateFormMode();
  document.getElementById("feedbackForm").addEventListener("submit", handleFeedbackSubmit);
}

document.addEventListener("DOMContentLoaded", initFeedbackPage);
