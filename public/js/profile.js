"use strict";

function showProfileMessage(message, type) {
  const el = document.getElementById("profileMessage");
  if (!el) return;

  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.style.display = "block";
}

/** Load profile from API and populate display + form fields */
async function loadProfile() {
  try {
    const data = await api("/users/me");
    const user = data.user;

    // Read-only fields
    document.getElementById("dispUsername").textContent = user.Username;
    document.getElementById("dispRole").textContent = user.Role;
    document.getElementById("dispCreatedAt").textContent = new Date(user.CreatedAt).toLocaleDateString();

    // Pre-fill form
    document.getElementById("email").value = user.Email || "";
    document.getElementById("fullName").value = user.FullName || "";
  } catch (err) {
    showProfileMessage(err.message, "error");
  }
}

/** Submit email/fullName update */
async function handleProfileSubmit(event) {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const fullName = document.getElementById("fullName").value.trim();

  if (!email && !fullName) {
    showProfileMessage(t("noChanges"), "error");
    return;
  }

  const btn = document.getElementById("saveProfileBtn");
  btn.disabled = true;
  btn.textContent = t("saving");

  try {
    const body = {};
    if (email) body.email = email;
    if (fullName) body.fullName = fullName;

    await api("/users/me", {
      method: "PUT",
      body: JSON.stringify(body),
    });

    showProfileMessage(t("profileUpdated"), "success");
    await loadProfile();
  } catch (err) {
    showProfileMessage(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("saveChanges");
  }
}

/** Submit password change */
async function handlePasswordSubmit(event) {
  event.preventDefault();

  const currentPassword = document.getElementById("currentPassword").value;
  const newPassword = document.getElementById("newPassword").value;
  const confirmNewPassword = document.getElementById("confirmNewPassword").value;

  // Client-side validation
  if (!currentPassword || !newPassword || !confirmNewPassword) {
    showProfileMessage(t("allPasswordFieldsRequired"), "error");
    return;
  }

  if (newPassword !== confirmNewPassword) {
    showProfileMessage(t("passwordsDoNotMatch"), "error");
    return;
  }

  if (newPassword.length < 8) {
    showProfileMessage(t("passwordMinLength"), "error");
    return;
  }

  const btn = document.getElementById("savePasswordBtn");
  btn.disabled = true;
  btn.textContent = t("saving");

  try {
    await api("/users/me", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    showProfileMessage(t("passwordUpdated"), "success");
    document.getElementById("passwordForm").reset();
  } catch (err) {
    showProfileMessage(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = t("updatePassword");
  }
}

async function initProfilePage() {
  renderNavbar();

  if (!isLoggedIn()) {
    window.location.href = "/login.html";
    return;
  }

  applyTranslations();

  document.getElementById("profileForm").addEventListener("submit", handleProfileSubmit);
  document.getElementById("passwordForm").addEventListener("submit", handlePasswordSubmit);

  await loadProfile();
}

document.addEventListener("DOMContentLoaded", initProfilePage);
