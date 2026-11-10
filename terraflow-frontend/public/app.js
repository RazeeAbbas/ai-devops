import { requestJson } from "/api.js";

const form = document.querySelector("#deployment-form");
const output = document.querySelector("#output");
const runState = document.querySelector("#run-state");
const workspaceName = document.querySelector("#workspace-name");
const fqdnPreview = document.querySelector("#fqdn-preview");

const DEFAULT_WORKSPACE_NAME = "workspace-name";
const DEFAULT_HOSTNAME = "hostname";
const DNS_SUFFIX = "workshop.local";
const PENDING_STATUS = "Selecting workspace and asking Terraform for a plan...";

function setRunState(text, modifier) {
  runState.textContent = text;
  runState.className = modifier ? `run-state ${modifier}` : "run-state";
}

function updatePreviews() {
  workspaceName.textContent = form.elements.resourceGroupName.value || DEFAULT_WORKSPACE_NAME;
  fqdnPreview.textContent = `${form.elements.dnsName.value || DEFAULT_HOSTNAME}.${DNS_SUFFIX}`;
}

form.addEventListener("input", updatePreviews);
form.addEventListener("change", updatePreviews);
updatePreviews();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(form).entries());
  setRunState("running", "running");
  output.textContent = PENDING_STATUS;

  try {
    const result = await requestJson("/api/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    output.textContent = result.output || result.error || "No output returned.";
    if (result.success) {
      setRunState(`workspace: ${result.workspace}`, "");
    } else {
      setRunState("failed", "error");
    }
  } catch (error) {
    output.textContent = error.body?.output || error.body?.error || error.message;
    setRunState(error.body ? "failed" : "offline", "error");
  }
});
