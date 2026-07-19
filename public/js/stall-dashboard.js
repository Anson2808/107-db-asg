/**
 * stall-dashboard.js — Stall owner dashboard for CoWork
 */
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  // Guard: must be logged in as stallOwner
  if (!isLoggedIn()) {
    window.location.href = "/login.html";
    return;
  }
  if (!isRole("stallOwner")) {
    window.location.href = "/";
    return;
  }

  loadDashboard();

  // Stall edit
  document.getElementById("editBtn").addEventListener("click", showEditForm);
  document.getElementById("cancelEditBtn").addEventListener("click", hideEditForm);
  document.getElementById("updateStallForm").addEventListener("submit", handleStallUpdate);

  // Add item form
  document.getElementById("showAddFormBtn").addEventListener("click", showAddItemForm);
  document.getElementById("cancelAddBtn").addEventListener("click", hideAddItemForm);
  document.getElementById("createMenuItemForm").addEventListener("submit", handleAddItem);

  // Event delegation for edit/delete/cancel buttons on menu table
  document.getElementById("menuTableBody").addEventListener("click", handleMenuAction);
});

// ============================================================
//   TOAST
// ============================================================
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================================
//   DATA LOADING
// ============================================================
async function loadDashboard() {
  try {
    const data = await api("/stalls/my");
    renderStall(data.stall, data.menu);
  } catch (err) {
    document.getElementById("loadingState").textContent = "Failed to load stall data: " + err.message;
  }
}

function renderStall(stall, menu) {
  document.getElementById("loadingState").style.display = "none";
  document.getElementById("stallContent").style.display = "block";

  // Stall info
  document.getElementById("stallNameDisplay").textContent = stall.StallName;
  document.getElementById("stallCuisine").textContent = stall.CuisineType;
  document.getElementById("stallStatus").innerHTML = statusBadge(stall.Status);
  document.getElementById("stallDescription").textContent = stall.Description || "\u2014";

  // Pre-fill edit form
  document.getElementById("editStallName").value = stall.StallName || "";
  document.getElementById("editCuisineType").value = stall.CuisineType || "";
  document.getElementById("editDescription").value = stall.Description || "";
  document.getElementById("editStatus").value = stall.Status || "open";

  // Stats
  document.getElementById("menuCount").textContent = menu.length;
  const totalLikes = menu.reduce((sum, item) => sum + (item.LikeCount || 0), 0);
  document.getElementById("totalLikes").textContent = totalLikes;

  // Menu table
  renderMenuTable(menu);
}

function renderMenuTable(menu) {
  const tbody = document.getElementById("menuTableBody");
  const noItems = document.getElementById("noMenuItems");

  if (menu.length === 0) {
    tbody.innerHTML = "";
    noItems.style.display = "block";
  } else {
    noItems.style.display = "none";
    tbody.innerHTML = menu.map((item) => `
      <tr id="menuRow-${item.MenuItemId}">
        <td><strong>${escapeHtml(item.Name)}</strong></td>
        <td>${escapeHtml(item.Description || "\u2014")}</td>
        <td>$${Number(item.Price).toFixed(2)}</td>
        <td>${item.IsAvailable ? '<span class="badge badge-available">Available</span>' : '<span class="badge badge-unavailable">Unavailable</span>'}</td>
        <td>${item.LikeCount}</td>
        <td>
          <button class="btn btn-outline btn-sm edit-item-btn" data-id="${item.MenuItemId}">Edit</button>
          <button class="btn btn-danger btn-sm delete-item-btn" data-id="${item.MenuItemId}">Delete</button>
        </td>
      </tr>
      <tr id="menuEdit-${item.MenuItemId}" class="edit-form" style="display:none">
        <td colspan="6" style="padding:16px; background:var(--bg)">
          <div class="alert alert-error" style="display:none" id="editItemError-${item.MenuItemId}"></div>
          <form class="edit-item-form" data-id="${item.MenuItemId}">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Name</label>
                <input type="text" class="form-input edit-name" value="${escapeAttr(item.Name)}">
              </div>
              <div class="form-group">
                <label class="form-label">Price</label>
                <input type="number" class="form-input edit-price" step="0.01" min="0.01" value="${item.Price}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Description</label>
              <textarea class="form-textarea edit-description">${escapeHtml(item.Description || "")}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Available</label>
              <select class="form-select edit-available">
                <option value="true" ${item.IsAvailable ? "selected" : ""}>Yes</option>
                <option value="false" ${item.IsAvailable ? "" : "selected"}>No</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Image URL</label>
              <input type="text" class="form-input edit-imageUrl" value="${escapeAttr(item.ImageUrl || "")}" placeholder="e.g. /menu_image/dish.jpg">
            </div>
            <div style="display:flex; gap:8px">
              <button type="submit" class="btn btn-primary btn-sm">Save</button>
              <button type="button" class="btn btn-outline btn-sm cancel-edit-btn" data-id="${item.MenuItemId}">Cancel</button>
            </div>
          </form>
        </td>
      </tr>
    `).join("");
  }
}

// ============================================================
//   MENU ACTIONS (event delegation)
// ============================================================
async function handleMenuAction(e) {
  const target = e.target;
  const id = Number(target.dataset.id);

  // 1. Edit button clicked
  if (target.classList.contains("edit-item-btn")) {
    const editRow = document.getElementById(`menuEdit-${id}`);
    const viewRow = document.getElementById(`menuRow-${id}`);
    if (editRow) {
      editRow.style.display = "table-row";
      viewRow.style.display = "none";
    }
    return;
  }

  // 2. Cancel edit
  if (target.classList.contains("cancel-edit-btn")) {
    const editRow = document.getElementById(`menuEdit-${id}`);
    const viewRow = document.getElementById(`menuRow-${id}`);
    if (editRow) {
      editRow.style.display = "none";
      viewRow.style.display = "table-row";
    }
    return;
  }

  // 3. Delete button
  if (target.classList.contains("delete-item-btn")) {
    if (!confirm("Delete this menu item? This cannot be undone.")) return;
    target.disabled = true;
    target.textContent = "Deleting...";
    try {
      await api(`/menu/${id}`, { method: "DELETE" });
      showToast("Menu item deleted.", "success");
      await loadDashboard();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      target.disabled = false;
      target.textContent = "Delete";
    }
    return;
  }

  // 4. Edit form submit (The Save Button)
  const saveBtn = target.closest("button[type='submit']");
  const form = target.closest(".edit-item-form");

  if (saveBtn && form) {
    e.preventDefault();
    const id2 = Number(form.dataset.id);
    const errorEl = document.getElementById(`editItemError-${id2}`);

    const name = form.querySelector(".edit-name").value.trim();
    const price = parseFloat(form.querySelector(".edit-price").value);
    const description = form.querySelector(".edit-description").value.trim();
    const isAvailable = form.querySelector(".edit-available").value === "true";
    const imageUrl = form.querySelector(".edit-imageUrl").value.trim();

    errorEl.style.display = "none";
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
      await api(`/menu/${id2}`, {
        method: "PUT",
        body: JSON.stringify({ name, price, description, isAvailable, imageUrl }),
      });
      showToast("Menu item updated.", "success");
      await loadDashboard();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.style.display = "block";
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save";
    }
    return;
  }
}

// ============================================================
//   ADD ITEM FORM
// ============================================================
function showAddItemForm() {
  document.getElementById("addItemForm").classList.add("visible");
  document.getElementById("showAddFormBtn").style.display = "none";
  document.getElementById("addItemError").style.display = "none";
  document.getElementById("createMenuItemForm").reset();
}

function hideAddItemForm() {
  document.getElementById("addItemForm").classList.remove("visible");
  document.getElementById("showAddFormBtn").style.display = "";
}

async function handleAddItem(e) {
  e.preventDefault();

  const errorEl = document.getElementById("addItemError");
  const submitBtn = document.querySelector("#createMenuItemForm button[type='submit']");

  errorEl.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Adding...";

  const payload = {
    name: document.getElementById("addName").value.trim(),
    price: parseFloat(document.getElementById("addPrice").value),
    description: document.getElementById("addDescription").value.trim(),
    isAvailable: document.getElementById("addAvailable").value === "true",
    imageUrl: document.getElementById("addImageUrl").value.trim(),
  };

  try {
    await api("/menu", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast("Menu item added.", "success");
    hideAddItemForm();
    await loadDashboard();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Add Item";
  }
}

// ============================================================
//   STALL EDIT FORM
// ============================================================
function showEditForm() {
  document.getElementById("stallInfoView").style.display = "none";
  document.getElementById("stallEditForm").classList.add("visible");
  document.getElementById("editBtn").style.display = "none";
}

function hideEditForm() {
  document.getElementById("stallInfoView").style.display = "block";
  document.getElementById("stallEditForm").classList.remove("visible");
  document.getElementById("editBtn").style.display = "";
  document.getElementById("editStallError").style.display = "none";
}

async function handleStallUpdate(e) {
  e.preventDefault();

  const errorEl = document.getElementById("editStallError");
  const submitBtn = document.querySelector("#updateStallForm button[type='submit']");

  errorEl.style.display = "none";
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  const payload = {
    stallName: document.getElementById("editStallName").value.trim(),
    cuisineType: document.getElementById("editCuisineType").value.trim(),
    description: document.getElementById("editDescription").value.trim(),
    status: document.getElementById("editStatus").value,
  };

  try {
    await api("/stalls/my", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    showToast("Stall updated.", "success");
    await loadDashboard();
    hideEditForm();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Changes";
  }
}

// ============================================================
//   HELPERS
// ============================================================
function statusBadge(status) {
  const cls = status === "open" ? "badge-open" : "badge-closed";
  const label = status === "open" ? "Open" : "Closed";
  return `<span class="badge ${cls}">${label}</span>`;
}

// escapeHtml comes from auth.js (loaded before this file on every page).

function escapeAttr(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}