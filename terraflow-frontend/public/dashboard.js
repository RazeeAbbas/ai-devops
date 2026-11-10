import { requestJson } from "/api.js";

const REFRESH_INTERVAL_MS = 6000;

// Elements
const totalCountEl = document.querySelector("#kpi-total");
const successCountEl = document.querySelector("#kpi-success");
const successRateEl = document.querySelector("#kpi-success-rate");
const failedCountEl = document.querySelector("#kpi-failed");
const failureRateEl = document.querySelector("#kpi-failure-rate");
const runningCountEl = document.querySelector("#kpi-running");
const totalCostEl = document.querySelector("#kpi-total-cost");

const barChartContainer = document.querySelector("#bar-chart-container");
const pieChartContainer = document.querySelector("#pie-chart-container");
const costTableBody = document.querySelector("#cost-table-body");
const redeployListEl = document.querySelector("#redeploy-list");
const actionFeedbackEl = document.querySelector("#action-feedback");

function renderBarChart(data) {
  const width = 500;
  const height = 260;
  const padding = { top: 30, right: 30, bottom: 45, left: 45 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = 28; // Ticks: 0, 7, 14, 21, 28
  const ticks = [0, 7, 14, 21, 28];

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="dashboard-chart-svg" preserveAspectRatio="xMidYMid meet">`;

  // Grid lines and Y-axis labels
  ticks.forEach((tick) => {
    const y = padding.top + chartH - (tick / maxVal) * chartH;
    svg += `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${padding.left - 8}" y="${y + 4}" font-size="11" fill="#64748b" text-anchor="end" font-family="'DM Mono', monospace">${tick}</text>
    `;
  });

  // Y-axis solid baseline and left border
  const baseY = padding.top + chartH;
  svg += `<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1.2" />`;
  svg += `<line x1="${padding.left}" y1="${baseY}" x2="${width - padding.right}" y2="${baseY}" stroke="#cbd5e1" stroke-width="1.2" />`;

  // Bars
  const n = data.length;
  const slotW = chartW / n;
  const barW = Math.min(46, slotW * 0.72);

  data.forEach((item, index) => {
    const x = padding.left + index * slotW + (slotW - barW) / 2;
    const barH = (item.count / maxVal) * chartH;
    const y = baseY - barH;

    svg += `
      <g class="bar-group" data-type="${item.type}" data-count="${item.count}">
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="#1677ff" rx="2" class="chart-bar" />
        <text x="${x + barW / 2}" y="${baseY + 16}" font-size="10" fill="#475569" text-anchor="middle" font-family="sans-serif">${item.type}</text>
        <title>${item.type}: ${item.count} deployments</title>
      </g>
    `;
  });

  // Legend at bottom
  svg += `
    <g transform="translate(${width / 2 - 40}, ${height - 6})">
      <rect x="0" y="-8" width="10" height="10" fill="#1677ff" rx="1.5" />
      <text x="16" y="0" font-size="11" fill="#475569" font-family="sans-serif">Deployments</text>
    </g>
  `;

  svg += `</svg>`;
  barChartContainer.innerHTML = svg;
}

function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
}

function describeArc(x, y, radius, startAngle, endAngle) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y, "L", x, y, "Z"].join(" ");
}

function renderPieChart(distribution) {
  const width = 450;
  const height = 260;
  const cx = 225;
  const cy = 135;
  const radius = 78;

  const total = distribution.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return;

  let svg = `<svg viewBox="0 0 ${width} ${height}" class="dashboard-chart-svg" preserveAspectRatio="xMidYMid meet">`;

  let currentAngle = 0;
  const slices = [];

  distribution.forEach((d) => {
    const angle = (d.count / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const midAngle = startAngle + angle / 2;
    currentAngle = endAngle;

    slices.push({
      ...d,
      startAngle,
      endAngle,
      midAngle,
      path: describeArc(cx, cy, radius, startAngle, endAngle)
    });
  });

  // Render slices
  slices.forEach((slice) => {
    svg += `<path d="${slice.path}" fill="${slice.color}" stroke="#ffffff" stroke-width="1.5" class="chart-slice">
      <title>${slice.status}: ${slice.count} (${slice.percentage}%)</title>
    </path>`;
  });

  // Render callouts matching the mockup
  slices.forEach((slice) => {
    const labelPos = polarToCartesian(cx, cy, radius + 32, slice.midAngle);
    let anchor = "middle";
    if (labelPos.x > cx + 20) anchor = "start";
    else if (labelPos.x < cx - 20) anchor = "end";

    svg += `
      <text x="${labelPos.x}" y="${labelPos.y + 4}" font-size="11" font-weight="600" fill="${slice.color}" text-anchor="${anchor}" font-family="sans-serif">
        ${slice.status}: ${slice.count} (${slice.percentage}%)
      </text>
    `;
  });

  svg += `</svg>`;
  pieChartContainer.innerHTML = svg;
}

function renderCostTable(workspacesCost) {
  if (!costTableBody) return;
  if (!workspacesCost.length) {
    costTableBody.innerHTML = `<tr><td colspan="7" class="empty-cell">No workspace state files detected.</td></tr>`;
    return;
  }

  costTableBody.innerHTML = workspacesCost
    .map(
      (ws) => `
      <tr>
        <td><strong>${ws.workspace}</strong></td>
        <td><span class="badge ${ws.hasState ? "completed" : "pending"}">${ws.hasState ? "active" : "unprovisioned"}</span></td>
        <td><code>${ws.vmSize}</code></td>
        <td>$${ws.computeCost.toFixed(2)}</td>
        <td>$${ws.storageCost.toFixed(2)}</td>
        <td>$${ws.ipCost.toFixed(2)}</td>
        <td><strong class="cost-total">$${ws.monthlyTotal.toFixed(2)}/mo</strong></td>
      </tr>
    `
    )
    .join("");
}

function renderRedeploymentHub(workspacesCost, recentDeployments) {
  if (!redeployListEl) return;

  if (!workspacesCost.length) {
    redeployListEl.innerHTML = `<div class="empty-notice">No workspaces available for redeployment.</div>`;
    return;
  }

  redeployListEl.innerHTML = workspacesCost
    .map((ws) => {
      const isTracked = ws.hasState;
      const lastJob = recentDeployments.find((j) => j.workspace === ws.workspace);
      const statusClass = lastJob ? lastJob.status : isTracked ? "completed" : "pending";
      const statusText = lastJob ? lastJob.status : isTracked ? "tracked" : "no state";

      return `
        <div class="redeploy-item">
          <div class="redeploy-info">
            <div class="redeploy-header">
              <h3>${ws.workspace}</h3>
              <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <div class="redeploy-meta">
              <span>SKU: <strong>${ws.vmSize}</strong></span>
              <span>Backups: <strong>${ws.backupCount}</strong></span>
              <span>Est. Cost: <strong>$${ws.monthlyTotal.toFixed(2)}/mo</strong></span>
            </div>
          </div>
          <div class="redeploy-action">
            <button class="redeploy-button" data-workspace="${ws.workspace}">
              <span class="btn-icon">↻</span> Redeploy
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  // Attach button click handlers
  redeployListEl.querySelectorAll(".redeploy-button").forEach((btn) => {
    btn.addEventListener("click", () => triggerRedeploy(btn.dataset.workspace));
  });
}

function showFeedback(message, type = "info") {
  if (!actionFeedbackEl) return;
  actionFeedbackEl.className = `action-feedback ${type}`;
  actionFeedbackEl.innerHTML = message;
  actionFeedbackEl.style.display = "block";
  setTimeout(() => {
    actionFeedbackEl.style.display = "none";
  }, 9000);
}

async function triggerRedeploy(workspace) {
  showFeedback(`Triggering redeployment dry-run for <strong>${workspace}</strong>...`, "running");
  try {
    const result = await requestJson("/api/redeploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace })
    });

    if (result.success) {
      showFeedback(
        `✓ Redeployment plan for <strong>${workspace}</strong> completed successfully! <a href="/jobs.html">View Job Log →</a>`,
        "success"
      );
    } else {
      showFeedback(
        `✕ Redeployment plan failed: ${result.error || "Terraform error"}. <a href="/jobs.html">Inspect Log →</a>`,
        "error"
      );
    }
    loadDashboard();
  } catch (error) {
    showFeedback(`Failed to initiate redeploy: ${error.message}`, "error");
  }
}

const azurePillEl = document.querySelector("#azure-status-pill");
const azureStatusTextEl = document.querySelector("#azure-status-text");
const azureSyncBtn = document.querySelector("#azure-sync-btn");

if (azureSyncBtn) {
  azureSyncBtn.addEventListener("click", async () => {
    azureSyncBtn.disabled = true;
    azureSyncBtn.textContent = "Syncing...";
    try {
      await requestJson("/api/azure/sync", { method: "POST" });
      await loadDashboard();
    } catch (err) {
      console.error("Azure sync error:", err);
    } finally {
      azureSyncBtn.disabled = false;
      azureSyncBtn.textContent = "↻ Sync Azure";
    }
  });
}

async function loadDashboard() {
  try {
    const data = await requestJson("/api/dashboard");
    const { summary, deploymentsByType, statusDistribution, workspacesCost, recentDeployments } = data;
    const { summary, deploymentsByType, statusDistribution, workspacesCost, recentDeployments, azure } = data;

    // Render Azure Status Pill
    if (azurePillEl && azure) {
      azurePillEl.style.display = "inline-flex";
      if (azure.connected) {
        azureStatusTextEl.textContent = `Azure Connected: ${azure.subscription.name} (${azure.subscription.id.slice(0, 8)}...)`;
        azurePillEl.className = "azure-status-pill connected";
      } else {
        azureStatusTextEl.textContent = `Azure Disconnected (${azure.error || "Login required"})`;
        azurePillEl.className = "azure-status-pill disconnected";
      }
    }

    // Update KPI cards
    if (totalCountEl) totalCountEl.textContent = summary.totalDeployments;
    if (successCountEl) successCountEl.textContent = summary.successful;
    if (successRateEl) successRateEl.textContent = `${summary.successRate} success rate`;
    if (failedCountEl) failedCountEl.textContent = summary.failed;
    if (failureRateEl) failureRateEl.textContent = `${summary.failureRate} failure rate`;
    if (runningCountEl) runningCountEl.textContent = summary.running;
    if (totalCostEl) totalCostEl.textContent = `${summary.totalEstimatedMonthlyCost}/mo`;

    // Render Charts
    renderBarChart(deploymentsByType);
    renderPieChart(statusDistribution);

    // Render Cost & Redeployment
    renderCostTable(workspacesCost);
    renderRedeploymentHub(workspacesCost, recentDeployments);
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

// Initial load and recurring interval
loadDashboard();
setInterval(loadDashboard, REFRESH_INTERVAL_MS);

