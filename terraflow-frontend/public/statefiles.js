import { requestJson } from "/api.js";

const root = document.querySelector("#statefiles");
const KILOBYTE = 1024;
const REFRESH_INTERVAL_MS = 5000;

function formatBytes(bytes) {
  if (bytes < KILOBYTE) return `${bytes} B`;
  return `${(bytes / KILOBYTE).toFixed(1)} KB`;
}

function appendField(container, label, value) {
  const labelElement = document.createElement("span");
  labelElement.textContent = label;
  const valueElement = document.createElement("strong");
  valueElement.textContent = value;
  container.append(labelElement, valueElement);
}

function buildFields(workspace) {
  const fields = document.createElement("div");
  fields.className = "job-fields";
  if (workspace.hasState) {
    appendField(fields, "File", workspace.file);
    appendField(fields, "Size", formatBytes(workspace.size));
    appendField(fields, "Last updated", new Date(workspace.updated).toLocaleString());
  } else {
    appendField(fields, "State file", "not created yet");
  }
  appendField(fields, "Backups", String(workspace.backupCount));
  return fields;
}

function renderWorkspace(workspace) {
  const card = document.createElement("article");
  card.className = "panel job-card statefile-card";
  card.dataset.workspace = workspace.workspace;

  const title = document.createElement("div");
  title.className = "job-title";
  const heading = document.createElement("h2");
  heading.textContent = workspace.workspace;
  const badge = document.createElement("span");
  badge.className = workspace.hasState ? "badge completed" : "badge pending";
  badge.textContent = workspace.hasState ? "tracked" : "no state yet";
  title.append(heading, badge);

  const path = document.createElement("div");
  path.className = "statefile-path";
  path.textContent = workspace.relativePath || `${workspace.workspace}/${"terraform.tfstate"}`;

  card.append(title, path, buildFields(workspace));
  return card;
}

function renderMessage(text) {
  const panel = document.createElement("div");
  panel.className = "panel empty-jobs";
  panel.textContent = text;
  return panel;
}

async function loadStatefiles() {
  try {
    const workspaces = await requestJson("/api/statefiles");
    root.replaceChildren();
    if (!workspaces.length) {
      root.append(renderMessage("No Terraform workspaces found yet."));
      return;
    }
    workspaces.forEach((workspace) => root.append(renderWorkspace(workspace)));
  } catch (error) {
    root.replaceChildren(renderMessage(`Unable to load statefiles: ${error.message}`));
  }
}

loadStatefiles();
setInterval(loadStatefiles, REFRESH_INTERVAL_MS);
