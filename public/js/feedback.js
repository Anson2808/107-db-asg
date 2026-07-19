"use strict";

let myFeedback = [];

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

async function loadMyFeedback() {
  const list = document.getElementById("myFeedbackList");
  if (!list) return;

  list.innerHTML = `<div class="empty-state">${t("loadingFeedback")}</div>`;

  try {
    const data = await api("/feedback/my");
    myFeedback = data.feedback || [];
    renderMyFeedback();
  } catch (err) {
    list.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderMyFeedback() {
  const list = document.getElementById("myFeedbackList");
  if (!list) return;

  if (myFeedback.length === 0) {
    list.innerHTML = `<div class="empty-state">${t("noSubmittedFeedback")}</div>`;
    return;
  }

  list.innerHTML = myFeedback.map((entry) => {
    const date = entry.CreatedAt ? new Date(entry.CreatedAt).toLocaleDateString() : "";
    return `
      <article class="my-feedback-item" data-feedback-id="${entry.FeedbackId}">
        <div class="my-feedback-view">
          <div class="my-feedback-header">
            <div>
              <h3>${escapeHtml(entry.StallName)}</h3>
              <p>${escapeHtml(entry.CuisineType || "")}${date ? ` • ${escapeHtml(date)}` : ""}</p>
            </div>
            <span class="stall-rating">${escapeHtml(String(entry.Rating))} / 5</span>
          </div>
          ${entry.Category ? `<span class="badge badge-closed">${escapeHtml(entry.Category)}</span>` : `<span class="badge cuisine-badge">${t("generalFeedback")}</span>`}
          <p class="my-feedback-comment">${escapeHtml(entry.Comment)}</p>
          <div class="my-feedback-actions">
            <button type="button" class="btn btn-secondary btn-edit-feedback" data-feedback-id="${entry.FeedbackId}">${t("editFeedback")}</button>
            <button type="button" class="btn btn-danger btn-delete-feedback" data-feedback-id="${entry.FeedbackId}">${t("deleteFeedback")}</button>
          </div>
        </div>
        <form class="my-feedback-edit" data-feedback-id="${entry.FeedbackId}" style="display:none">
          <div class="form-group">
            <label class="form-label" for="editRating-${entry.FeedbackId}">${t("rating")}</label>
            <select id="editRating-${entry.FeedbackId}" class="form-select edit-rating" required>
              ${[5, 4, 3, 2, 1].map((rating) => `<option value="${rating}"${Number(entry.Rating) === rating ? " selected" : ""}>${rating}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="editCategory-${entry.FeedbackId}">${t("category")}</label>
            <select id="editCategory-${entry.FeedbackId}" class="form-select edit-category">
              <option value=""${!entry.Category ? " selected" : ""}>${t("generalFeedback")}</option>
              ${["Hygiene", "Service", "Food Quality", "Wrong Order", "Other"].map((category) => (
                `<option value="${category}"${entry.Category === category ? " selected" : ""}>${category}</option>`
              )).join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="editComment-${entry.FeedbackId}">${t("comment")}</label>
            <textarea id="editComment-${entry.FeedbackId}" class="form-textarea edit-comment" required>${escapeHtml(entry.Comment)}</textarea>
          </div>
          <div class="my-feedback-actions">
            <button type="submit" class="btn btn-primary">${t("saveFeedback")}</button>
            <button type="button" class="btn btn-secondary btn-cancel-edit" data-feedback-id="${entry.FeedbackId}">${t("cancel")}</button>
          </div>
        </form>
      </article>
    `;
  }).join("");
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
    await loadMyFeedback();
  } catch (err) {
    showFeedbackMessage(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("submitFeedback");
  }
}

function toggleFeedbackEdit(feedbackId, editing) {
  const item = document.querySelector(`.my-feedback-item[data-feedback-id="${feedbackId}"]`);
  if (!item) return;

  item.querySelector(".my-feedback-view").style.display = editing ? "none" : "";
  item.querySelector(".my-feedback-edit").style.display = editing ? "" : "none";
}

async function handleFeedbackListClick(event) {
  const editButton = event.target.closest(".btn-edit-feedback");
  const cancelButton = event.target.closest(".btn-cancel-edit");
  const deleteButton = event.target.closest(".btn-delete-feedback");

  if (editButton) {
    toggleFeedbackEdit(Number(editButton.dataset.feedbackId), true);
    return;
  }

  if (cancelButton) {
    toggleFeedbackEdit(Number(cancelButton.dataset.feedbackId), false);
    return;
  }

  if (deleteButton) {
    const feedbackId = Number(deleteButton.dataset.feedbackId);
    if (!window.confirm(t("confirmDeleteFeedback"))) return;

    deleteButton.disabled = true;
    try {
      await api(`/feedback/${feedbackId}`, { method: "DELETE" });
      showFeedbackMessage(t("feedbackDeleted"), "success");
      await loadMyFeedback();
    } catch (err) {
      showFeedbackMessage(err.message, "error");
      deleteButton.disabled = false;
    }
  }
}

async function handleFeedbackListSubmit(event) {
  const form = event.target.closest(".my-feedback-edit");
  if (!form) return;

  event.preventDefault();

  const feedbackId = Number(form.dataset.feedbackId);
  const payload = {
    rating: Number(form.querySelector(".edit-rating").value),
    category: form.querySelector(".edit-category").value,
    comment: form.querySelector(".edit-comment").value.trim(),
  };

  const validationError = validateFeedbackForm({ stallId: 1, ...payload });
  if (validationError) {
    showFeedbackMessage(validationError, "error");
    return;
  }

  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = t("saving");

  try {
    await api(`/feedback/${feedbackId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showFeedbackMessage(t("feedbackUpdated"), "success");
    await loadMyFeedback();
  } catch (err) {
    showFeedbackMessage(err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t("saveFeedback");
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
    await loadMyFeedback();
  } catch (err) {
    showFeedbackMessage(`${t("loadStallsFailed")}: ${err.message}`, "error");
  }

  applyTranslations();
  document.getElementById("feedbackForm").addEventListener("submit", handleFeedbackSubmit);
  document.getElementById("myFeedbackList").addEventListener("click", handleFeedbackListClick);
  document.getElementById("myFeedbackList").addEventListener("submit", handleFeedbackListSubmit);
}

document.addEventListener("DOMContentLoaded", initFeedbackPage);
