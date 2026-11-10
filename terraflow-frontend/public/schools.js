import { requestJson } from "/api.js";

let currentTenants = [];
let activeTenantId = null;
let selectedVmForAccess = null;

// DOM Elements
const tenantTabsEl = document.querySelector("#tenant-tabs");
const tenantIdEl = document.querySelector("#tenant-id");
const tenantNameEl = document.querySelector("#tenant-name");
const tenantEduEl = document.querySelector("#tenant-edu");
const tenantRgEl = document.querySelector("#tenant-rg");
const tenantDbEl = document.querySelector("#tenant-db");
const vmCardsGridEl = document.querySelector("#vm-cards-grid");

// Modals
const accessModalEl = document.querySelector("#access-modal");
const modalVmTitleEl = document.querySelector("#modal-vm-title");
const accessFormEl = document.querySelector("#access-request-form");
const accessResultEl = document.querySelector("#access-result");
const closeAccessModalBtn = document.querySelector("#close-access-modal");

const credHostEl = document.querySelector("#cred-host");
const credUserEl = document.querySelector("#cred-user");
const credPassEl = document.querySelector("#cred-pass");
const credExpiryEl = document.querySelector("#cred-expiry");
const rdpDownloadLink = document.querySelector("#rdp-download-link");

const addVmModalEl = document.querySelector("#add-vm-modal");
const addVmBtn = document.querySelector("#add-vm-btn");
const closeVmModalBtn = document.querySelector("#close-vm-modal");
const addVmFormEl = document.querySelector("#add-vm-form");
const addVmTenantNameEl = document.querySelector("#add-vm-tenant-name");

const addTenantModalEl = document.querySelector("#add-tenant-modal");
const addTenantBtn = document.querySelector("#add-tenant-btn");
const closeTenantModalBtn = document.querySelector("#close-tenant-modal");
const addTenantFormEl = document.querySelector("#add-tenant-form");

function renderTabs() {
  tenantTabsEl.innerHTML = currentTenants
    .map(
      (tenant) => `
      <button class="tenant-tab ${tenant.id === activeTenantId ? "active" : ""}" data-tenant-id="${tenant.id}">
        ${tenant.name}
      </button>
    `
    )
    .join("");

  tenantTabsEl.querySelectorAll(".tenant-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTenantId = btn.dataset.tenantId;
      renderActiveTenant();
    });
  });
}

function renderActiveTenant() {
  const tenant = currentTenants.find((t) => t.id === activeTenantId) || currentTenants[0];
  if (!tenant) return;

  activeTenantId = tenant.id;
  renderTabs();

  // Populate metadata table
  tenantIdEl.textContent = tenant.id;
  tenantNameEl.textContent = tenant.name;
  tenantEduEl.textContent = tenant.eduNumber;
  tenantRgEl.textContent = tenant.resourceGroup;
  tenantDbEl.textContent = tenant.databaseServer;

  // Render VM cards matching mockup 1
  if (!tenant.vms || !tenant.vms.length) {
    vmCardsGridEl.innerHTML = `<div class="empty-vms">No virtual machines currently provisioned for ${tenant.name}. Click "Add Virtual Machine" to assign one.</div>`;
    return;
  }

  vmCardsGridEl.innerHTML = tenant.vms
    .map(
      (vm) => `
      <article class="vm-card" data-vm-name="${vm.name}">
        <div class="vm-card-header">
          <h3>${vm.name}</h3>
        </div>
        <div class="vm-card-body">
          <div class="vm-row">
            <span class="vm-label">IP</span>
            <strong class="vm-value mono-text">${vm.ip}</strong>
          </div>
          <div class="vm-row">
            <span class="vm-label">FQDN</span>
            <span class="vm-value mono-text">${vm.fqdn}</span>
          </div>
          <div class="vm-row">
            <span class="vm-label">State</span>
            <span class="vm-value state-indicator">
              <span class="status-dot"></span> ${vm.state || "VM running"}
            </span>
          </div>
        </div>
        <div class="vm-card-footer">
          <button class="primary-button req-access-btn" data-vm="${vm.name}">
            Request Access
          </button>
          <button class="secondary-btn edit-vm-btn" data-vm="${vm.name}">
            Edit
          </button>
        </div>
      </article>
    `
    )
    .join("");

  // Attach Request Access triggers
  vmCardsGridEl.querySelectorAll(".req-access-btn").forEach((btn) => {
    btn.addEventListener("click", () => openAccessModal(btn.dataset.vm));
  });
}

function openAccessModal(vmName) {
  selectedVmForAccess = vmName;
  modalVmTitleEl.textContent = vmName;

  // Show form, hide result
  accessFormEl.style.display = "block";
  accessResultEl.style.display = "none";
  accessModalEl.style.display = "flex";
}

function closeAccessModal() {
  accessModalEl.style.display = "none";
}

// Request Access Form Submit
accessFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(accessFormEl);
  const payload = {
    vmName: selectedVmForAccess,
    login: formData.get("login"),
    ipAddress: formData.get("ipAddress"),
    reason: formData.get("reason"),
    caseNumber: formData.get("caseNumber"),
    notes: formData.get("notes")
  };

  const submitBtn = document.querySelector("#submit-access-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Processing...";

  try {
    const result = await requestJson("/api/access-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (result.success) {
      // Show result
      accessFormEl.style.display = "none";
      accessResultEl.style.display = "block";

      credHostEl.textContent = `${result.host}:${result.port}`;
      credUserEl.textContent = result.username;
      credPassEl.textContent = result.password;
      credExpiryEl.textContent = `Valid until ${result.expiresAt}`;
      rdpDownloadLink.href = result.rdpDownloadUrl;
    }
  } catch (err) {
    alert(`Failed to grant access: ${err.message}`);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Request access";
  }
});

closeAccessModalBtn.addEventListener("click", closeAccessModal);
accessModalEl.addEventListener("click", (e) => {
  if (e.target === accessModalEl) closeAccessModal();
});

// Add VM modal
addVmBtn.addEventListener("click", () => {
  const tenant = currentTenants.find((t) => t.id === activeTenantId);
  if (tenant) addVmTenantNameEl.textContent = tenant.name;
  addVmModalEl.style.display = "flex";
});

closeVmModalBtn.addEventListener("click", () => {
  addVmModalEl.style.display = "none";
});

addVmFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(addVmFormEl);
  const payload = {
    tenantId: activeTenantId,
    name: formData.get("vmName"),
    ip: formData.get("vmIp"),
    vmSize: formData.get("vmSize")
  };

  try {
    await requestJson("/api/tenants/add-vm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    addVmModalEl.style.display = "none";
    addVmFormEl.reset();
    await loadTenants();
  } catch (err) {
    alert(`Failed to add VM: ${err.message}`);
  }
});

// Add Tenant modal
addTenantBtn.addEventListener("click", () => {
  addTenantModalEl.style.display = "flex";
});

closeTenantModalBtn.addEventListener("click", () => {
  addTenantModalEl.style.display = "none";
});

addTenantFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(addTenantFormEl);
  const payload = {
    name: formData.get("tenantName"),
    resourceGroup: formData.get("tenantRg"),
    eduNumber: formData.get("tenantEdu"),
    databaseServer: formData.get("tenantDb")
  };

  try {
    const created = await requestJson("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    addTenantModalEl.style.display = "none";
    addTenantFormEl.reset();
    activeTenantId = created.id;
    await loadTenants();
  } catch (err) {
    alert(`Failed to create tenant: ${err.message}`);
  }
});

// Load tenants on init
async function loadTenants() {
  try {
    currentTenants = await requestJson("/api/tenants");
    if (!activeTenantId && currentTenants.length > 0) {
      activeTenantId = currentTenants[0].id;
    }
    renderActiveTenant();
  } catch (err) {
    console.error("Unable to load tenants:", err);
  }
}

loadTenants();

