import { requestJson } from "/api.js";

const root = document.querySelector("#jobs");
const REFRESH_INTERVAL_MS = 5000;

function createLabeledValue(label, value) {
  const element = document.createElement("div");
  element.append(`${label}: `);
  const strong = document.createElement("strong");
  strong.textContent = value;
  element.append(strong);
  return element;
}

function createSummary(job) {
  const summary = document.createElement("div");
  summary.className = "job-summary";

  const title = document.createElement("div");
  title.className = "job-title";
  const heading = document.createElement("h2");
  heading.textContent = `Job ID: ${job.id}`;
  const badge = document.createElement("span");
  badge.className = `badge ${job.status}`;
  badge.textContent = job.status;
  title.append(heading, badge);

  summary.append(
    title,
    createLabeledValue("Workspace", job.workspace),
    createLabeledValue("Action", job.action),
    createLabeledValue("Started", new Date(job.started).toLocaleString()),
    createLabeledValue("Last updated", new Date(job.updated).toLocaleString())
  );
  return summary;
}

function createStateFields(job) {
  const fields = document.createElement("div");
  fields.className = "job-fields";
  const label = document.createElement("span");
  label.textContent = "State file";
  const value = document.createElement("strong");
  value.textContent = job.stateFile;
  fields.append(label, value);
  return fields;
}

function createActions() {
  const actions = document.createElement("div");
  actions.className = "job-actions";
  const link = document.createElement("a");
  link.className = "primary-button";
  link.href = "/deploy.html";
  link.textContent = "New deployment";
  const arrow = document.createElement("span");
  arrow.className = "button-arrow";
  arrow.textContent = "→";
  link.append(arrow);
  actions.append(link);
  return actions;
}

function render(job) {
  const card = document.createElement("article");
  card.className = "panel job-card";
  card.dataset.jobId = job.id;

  const log = document.createElement("pre");
  log.className = "job-log";
  log.textContent = job.output || "No log output yet.";

  card.append(createSummary(job), createStateFields(job), log, createActions());
  return card;
}

function renderMessage(text) {
  const panel = document.createElement("div");
  panel.className = "panel empty-jobs";
  panel.textContent = text;
  return panel;
}

async function loadJobs() {
  try {
    const jobs = await requestJson("/api/jobs");
    root.replaceChildren();
    if (!jobs.length) {
      root.append(renderMessage("No Terraform jobs yet. Start a deployment to create the first workspace run."));
      return;
    }
    jobs.forEach((job) => root.append(render(job)));
  } catch (error) {
    root.replaceChildren(renderMessage(`Unable to load jobs: ${error.message}`));
  }
}

loadJobs();
setInterval(loadJobs, REFRESH_INTERVAL_MS);
