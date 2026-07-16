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

  select.innerHTML = '<option value="">Select a stall</option>' +
    stalls.map((stall) => (
      `<option value="${stall.StallId}">${escapeHtml(stall.StallName)} (${escapeHtml(stall.CuisineType)})</option>`
    )).join("");
}

function validateFeedbackForm(payload) {
  if (!payload.stallId) return "Please select a food stall.";
  if (payload.type === "feedback" && (!payload.rating || payload.rating < 1 || payload.rating > 5)) {
    return "Please select a rating from 1 to 5.";
  }
  if (payload.type === "complaint" && !payload.category) {
    return "Please select a complaint category.";
  }
  if (!payload.comment) return "Please enter a comment.";
  return "";
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
  comment.placeholder = isComplaint ? "Describe what happened" : "Tell us what stood out about the food or service";
  submitBtn.textContent = isComplaint ? "Submit Complaint" : "Submit Feedback";
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
  submitBtn.textContent = "Submitting...";

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
    showFeedbackMessage(type === "complaint" ? "Complaint submitted successfully." : "Feedback submitted successfully.", "success");
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
    showFeedbackMessage("Only customer accounts can submit feedback.", "error");
    document.getElementById("feedbackForm").style.display = "none";
    return;
  }

  try {
    await loadStalls();
  } catch (err) {
    showFeedbackMessage("Failed to load stalls: " + err.message, "error");
  }

  document.getElementById("requestType").addEventListener("change", updateFormMode);
  updateFormMode();
  document.getElementById("feedbackForm").addEventListener("submit", handleFeedbackSubmit);
}

document.addEventListener("DOMContentLoaded", initFeedbackPage);
