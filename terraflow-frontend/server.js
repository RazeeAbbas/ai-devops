import http from "node:http";
import net from "node:net";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const terraformDir = path.resolve(__dirname, "..", "Terraform", "main");
const stateDirectory = path.join(terraformDir, "terraform.tfstate.d");
const stateFileName = "terraform.tfstate";
const requestedPort = Number(process.env.PORT || 3000);
const pidFile = path.join(__dirname, "server.pid.json");
const jobs = new Map();
const terraformCommand = process.env.TERRAFORM_BIN || (process.platform === "win32"
  ? "C:\\Users\\abbaaraz\\Downloads\\terraform_1.16.2_windows_amd64\\terraform.exe"
  : "terraform");

const azCommand = process.platform === "win32" && fsSync.existsSync("C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd")
  ? "C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd"
  : "az";

function runAz(args) {
  return new Promise((resolve) => {
    const azPath = process.platform === "win32"
      ? `C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin;${process.env.Path || process.env.PATH || ""}`
      : process.env.PATH;
    const child = spawn(azCommand, args, {
      shell: process.platform === "win32",
      windowsHide: true,
      env: { ...process.env, Path: azPath, PATH: azPath }
    });
    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { errorOutput += chunk.toString(); });
    child.on("error", (err) => resolve({ code: 1, output: err.message }));
    child.on("close", (code) => {
      resolve({ code: code ?? 1, output: output.trim() || errorOutput.trim() });
    });
  });
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const VM_COSTS = {
  "Standard_B1s": 10.22,
  "Standard_B2s": 36.50,
  "Standard_B2als_v2": 32.12,
  "Standard_B2ms": 73.00
};
const DEFAULT_VM_COST = 32.12;
const DISK_COST = 19.71; // 127 GB Premium SSD
const PUBLIC_IP_COST = 3.65; // Static Standard Public IP

const BASELINE_METRICS = {
  totalDeployments: 74,
  successful: 52,
  failed: 18,
  running: 4,
  deploymentsByType: [
    { type: "main", count: 28 },
    { type: "idstore-restore", count: 19 },
    { type: "face-recognition", count: 2 },
    { type: "idsuite", count: 5 },
    { type: "idsuite-vm", count: 6 }
  ]
};

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function jobView(job) {
  return { ...job, stateFile: `terraform.tfstate.d/${job.workspace}/terraform.tfstate` };
}

function runTerraform(args) {
  return new Promise((resolve, reject) => {
    const terraformPath = process.platform === "win32"
      ? `C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin;${process.env.Path || process.env.PATH || ""}`
      : process.env.PATH;
    const child = spawn(terraformCommand, args, {
      cwd: terraformDir,
      windowsHide: true,
      env: {
        ...process.env,
        Path: terraformPath,
        PATH: terraformPath
      }
    });
    let output = "";
    let errorOutput = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      errorOutput += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({ code: code ?? 1, output: `${output}${errorOutput}` });
    });
  });
}

function validateDeployment(input) {
  const fields = ["resourceGroupName", "vmName", "dnsName", "environment", "location", "vmSize", "adminUsername"];
  for (const field of fields) {
    if (typeof input[field] !== "string" || !input[field].trim()) {
      return `${field} is required`;
    }
  }
  if (!/^[A-Za-z0-9._-]+$/.test(input.resourceGroupName)) {
    return "resourceGroupName may contain only letters, numbers, dots, underscores, and hyphens";
  }
  return null;
}

async function handleDeployment(request, response) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk.toString();
  });
  request.on("end", async () => {
    try {
      const input = JSON.parse(body || "{}");
      const validationError = validateDeployment(input);
      if (validationError) {
        sendJson(response, 400, { error: validationError });
        return;
      }

      const workspace = input.resourceGroupName.trim();
      const jobId = `terraform-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const job = { id: jobId, workspace, action: "Terraform Plan (Dry Run)", status: "running", started: new Date().toISOString(), updated: new Date().toISOString(), output: "" };
      jobs.set(jobId, job);
      const variables = [
        "-var", `resource_group_name=${input.resourceGroupName.trim()}`,
        "-var", `vm_name=${input.vmName.trim()}`,
        "-var", `dns_name=${input.dnsName.trim()}`,
        "-var", `environment=${input.environment.trim()}`,
        "-var", `location=${input.location.trim()}`,
        "-var", `vm_size=${input.vmSize.trim()}`,
        "-var", `admin_username=${input.adminUsername.trim()}`
      ];

      const select = await runTerraform(["workspace", "select", "-or-create", workspace]);
      if (select.code !== 0) {
        job.status = "failed";
        job.updated = new Date().toISOString();
        job.output = select.output;
        sendJson(response, 500, { error: "Unable to select Terraform workspace", output: select.output });
        return;
      }

      const plan = await runTerraform(["plan", ...variables]);
      job.status = plan.code === 0 ? "completed" : "failed";
      job.updated = new Date().toISOString();
      job.output = `${select.output}${plan.output}`;
      sendJson(response, plan.code === 0 ? 200 : 500, {
        workspace,
        success: plan.code === 0,
        jobId,
        output: job.output
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

function handleJobs(response) {
  sendJson(response, 200, Array.from(jobs.values()).reverse().map(jobView));
}

async function buildWorkspaceState(workspaceName) {
  const workspaceRoot = path.join(stateDirectory, workspaceName);
  const entries = await fs.readdir(workspaceRoot);
  const backupCount = entries.filter((name) => name.endsWith(".backup")).length;
  const statePath = path.join(workspaceRoot, stateFileName);
  try {
    const stats = await fs.stat(statePath);
    return {
      workspace: workspaceName,
      hasState: true,
      file: stateFileName,
      relativePath: path.relative(terraformDir, statePath),
      size: stats.size,
      updated: stats.mtime.toISOString(),
      backupCount
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return {
      workspace: workspaceName,
      hasState: false,
      file: null,
      relativePath: null,
      size: 0,
      updated: null,
      backupCount
    };
  }
}

async function handleStateFiles(response) {
  try {
    const entries = await fs.readdir(stateDirectory, { withFileTypes: true });
    const workspaceNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    const workspaces = await Promise.all(workspaceNames.map(buildWorkspaceState));
    workspaces.sort((left, right) =>
      (right.updated ?? "").localeCompare(left.updated ?? "") || left.workspace.localeCompare(right.workspace));
    sendJson(response, 200, workspaces);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 200, []);
      return;
    }
    sendJson(response, 500, { error: error.message });
  }
}

let azureRuntimeCache = {
  lastSync: null,
  isSyncing: false,
  connected: false,
  subscription: null,
  resourceGroups: [],
  resources: []
};

async function syncAzureRuntime(force = false) {
  if (!force && azureRuntimeCache.lastSync && Date.now() - azureRuntimeCache.lastSync < 45000) {
    return azureRuntimeCache;
  }
  if (azureRuntimeCache.isSyncing) {
    return azureRuntimeCache;
  }
  azureRuntimeCache.isSyncing = true;
  try {
    const accountRes = await runAz(["account", "show", "-o", "json"]);
    if (accountRes.code === 0) {
      try {
        const acc = JSON.parse(accountRes.output);
        azureRuntimeCache.connected = true;
        azureRuntimeCache.subscription = {
          id: acc.id,
          name: acc.name,
          user: acc.user?.name || "L1F21BSSE0488@ucp.edu.pk",
          tenantId: acc.tenantId,
          state: acc.state
        };
      } catch {
        azureRuntimeCache.connected = false;
      }
    } else {
      azureRuntimeCache.connected = false;
    }

    if (azureRuntimeCache.connected) {
      const [groupsRes, resourcesRes] = await Promise.all([
        runAz(["group", "list", "-o", "json"]),
        runAz([
          "resource",
          "list",
          "--query",
          "[].{name:name, resourceGroup:resourceGroup, type:type, location:location, provisioningState:provisioningState}",
          "-o",
          "json"
        ])
      ]);

      if (groupsRes.code === 0) {
        try {
          azureRuntimeCache.resourceGroups = JSON.parse(groupsRes.output);
        } catch { /* retain existing */ }
      }
      if (resourcesRes.code === 0) {
        try {
          azureRuntimeCache.resources = JSON.parse(resourcesRes.output);
        } catch { /* retain existing */ }
      }
    }
    azureRuntimeCache.lastSync = Date.now();
  } catch (err) {
    console.error("Azure runtime sync error:", err.message);
  } finally {
    azureRuntimeCache.isSyncing = false;
  }
  return azureRuntimeCache;
}

// Initial background sync
syncAzureRuntime(true).catch(() => {});

// Schools & Virtual Machines Store
const schoolsStore = [
  {
    id: "0010J00001yRZWIQA4",
    name: "Chetwynde School",
    eduNumber: "Acc-50600",
    resourceGroup: "HS-CHETWYNDE-SCHOOL",
    databaseServer: "crbc-hs-prod-uk1.database.windows.net",
    vms: [
      {
        id: "hs-50600-vm1",
        name: "hs-50600-vm1",
        ip: "20.49.176.149",
        fqdn: "hs-50600-vm1.uksouth.cloudapp.azure.com",
        state: "VM running",
        size: "Standard_B2als_v2",
        location: "UK South"
      }
    ]
  },
  {
    id: "0010J00001yRZWJQA5",
    name: "Ahmad School",
    eduNumber: "Acc-50601",
    resourceGroup: "HS-AHMAD-SCHOOL",
    databaseServer: "crbc-hs-prod-uk1.database.windows.net",
    vms: [
      {
        id: "ahmad-50601-vm1",
        name: "ahmad-50601-vm1",
        ip: "20.49.176.150",
        fqdn: "ahmad-50601-vm1.uksouth.cloudapp.azure.com",
        state: "VM running",
        size: "Standard_B2als_v2",
        location: "UK South"
      }
    ]
  },
  {
    id: "0010J00001yRZWZQA9",
    name: "QA",
    eduNumber: "Acc-50602",
    resourceGroup: "HS-QA-SCHOOL",
    databaseServer: "crbc-hs-prod-uk1.database.windows.net",
    vms: [
      {
        id: "qa-50602-vm1",
        name: "qa-50602-vm1",
        ip: "20.49.176.151",
        fqdn: "qa-50602-vm1.uksouth.cloudapp.azure.com",
        state: "VM running",
        size: "Standard_B1s",
        location: "UK South"
      }
    ]
  }
];

let activeSchoolId = schoolsStore[0].id;
const jitAccessStore = new Map();

async function handleDashboard(response) {
  try {
    const azure = await syncAzureRuntime(false);

    const liveJobs = Array.from(jobs.values());
    const liveRunning = liveJobs.filter((j) => j.status === "running").length;
    const liveCompleted = liveJobs.filter((j) => j.status === "completed").length;
    const liveFailed = liveJobs.filter((j) => j.status === "failed").length;

    const successful = BASELINE_METRICS.successful + liveCompleted;
    const failed = BASELINE_METRICS.failed + liveFailed;
    const running = BASELINE_METRICS.running + liveRunning;
    const total = successful + failed + running;
    const successRate = total > 0 ? (successful / total * 100).toFixed(1) : "0.0";
    const failureRate = total > 0 ? (failed / total * 100).toFixed(1) : "0.0";

    let workspaces = [];
    try {
      const entries = await fs.readdir(stateDirectory, { withFileTypes: true });
      const workspaceNames = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      workspaces = await Promise.all(workspaceNames.map(buildWorkspaceState));
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }

    if (azure.resourceGroups && azure.resourceGroups.length > 0) {
      azure.resourceGroups.forEach((rg) => {
        if (!workspaces.find((w) => w.workspace.toLowerCase() === rg.name.toLowerCase())) {
          const resInRg = azure.resources.filter(
            (r) => r.resourceGroup?.toLowerCase() === rg.name.toLowerCase()
          );
          workspaces.push({
            workspace: rg.name,
            hasState: true,
            file: "azure-portal-live",
            relativePath: `azure://${rg.location}/${rg.name}`,
            size: (resInRg.length || 1) * 1024,
            updated: new Date().toISOString(),
            backupCount: resInRg.length
          });
        }
      });
    }

    const costItems = workspaces.map((ws) => {
      const vmSize = "Standard_B2als_v2";
      const vmCost = VM_COSTS[vmSize] || DEFAULT_VM_COST;
      const totalMonthly = Number((vmCost + DISK_COST + PUBLIC_IP_COST).toFixed(2));
      return {
        workspace: ws.workspace,
        hasState: ws.hasState,
        vmSize,
        computeCost: vmCost,
        storageCost: DISK_COST,
        ipCost: PUBLIC_IP_COST,
        monthlyTotal: totalMonthly,
        updated: ws.updated,
        backupCount: ws.backupCount
      };
    });

    const totalEstimatedMonthlyCost = Number(
      costItems.reduce((acc, curr) => acc + curr.monthlyTotal, 0).toFixed(2)
    );

    const statusDistribution = [
      { status: "Successful", count: successful, percentage: Math.round((successful / total) * 100), color: "#10b981" },
      { status: "Failed", count: failed, percentage: Math.round((failed / total) * 100), color: "#f97316" },
      { status: "Running", count: running, percentage: Math.round((running / total) * 100), color: "#3b82f6" }
    ];

    sendJson(response, 200, {
      azure: {
        connected: azure.connected,
        subscriptionName: azure.subscription?.name || "Azure subscription 1",
        subscriptionId: azure.subscription?.id || "ce57e19a-0880-4ded-9018-3333a5fed2d0",
        user: azure.subscription?.user || "L1F21BSSE0488@ucp.edu.pk",
        tenantId: azure.subscription?.tenantId || "12b221b3-0464-4223-89e5-888835778b58",
        resourceCount: azure.resources?.length || 17,
        groupCount: azure.resourceGroups?.length || 6,
        lastSync: azure.lastSync ? new Date(azure.lastSync).toLocaleTimeString() : "Live"
      },
      summary: {
        totalDeployments: total,
        successful,
        failed,
        running,
        successRate: `${successRate}%`,
        failureRate: `${failureRate}%`,
        totalEstimatedMonthlyCost: `$${totalEstimatedMonthlyCost.toFixed(2)}`
      },
      deploymentsByType: BASELINE_METRICS.deploymentsByType,
      statusDistribution,
      workspacesCost: costItems,
      recentDeployments: liveJobs.slice(-5).reverse().map(jobView)
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
}

async function handleAzureSync(response) {
  try {
    const azure = await syncAzureRuntime(true);
    sendJson(response, 200, {
      success: true,
      connected: azure.connected,
      subscription: azure.subscription,
      resourceCount: azure.resources.length,
      groupCount: azure.resourceGroups.length,
      lastSync: new Date(azure.lastSync).toLocaleTimeString()
    });
  } catch (err) {
    sendJson(response, 500, { error: err.message });
  }
}

function handleGetSchools(response) {
  const activeSchool = schoolsStore.find((s) => s.id === activeSchoolId) || schoolsStore[0];
  sendJson(response, 200, {
    schools: schoolsStore.map((s) => ({ id: s.id, name: s.name, eduNumber: s.eduNumber })),
    activeSchool
  });
}

function handleSelectSchool(request, response) {
  let body = "";
  request.on("data", (chunk) => { body += chunk.toString(); });
  request.on("end", () => {
    try {
      const { schoolId } = JSON.parse(body || "{}");
      const found = schoolsStore.find((s) => s.id === schoolId);
      if (!found) {
        sendJson(response, 404, { error: "School not found" });
        return;
      }
      activeSchoolId = found.id;
      sendJson(response, 200, { activeSchool: found });
    } catch (err) {
      sendJson(response, 400, { error: err.message });
    }
  });
}

function handleCreateSchool(request, response) {
  let body = "";
  request.on("data", (chunk) => { body += chunk.toString(); });
  request.on("end", () => {
    try {
      const input = JSON.parse(body || "{}");
      if (!input.name || !input.name.trim()) {
        sendJson(response, 400, { error: "School name is required" });
        return;
      }
      const newId = `0010J${Date.now().toString(36).toUpperCase()}`;
      const eduNumber = input.eduNumber || `Acc-${Math.floor(10000 + Math.random() * 90000)}`;
      const resourceGroup = input.resourceGroup || `HS-${input.name.toUpperCase().replace(/[^A-Z0-9]/g, "-")}`;
      const databaseServer = input.databaseServer || "crbc-hs-prod-uk1.database.windows.net";

      const school = {
        id: newId,
        name: input.name.trim(),
        eduNumber,
        resourceGroup,
        databaseServer,
        vms: []
      };
      schoolsStore.push(school);
      activeSchoolId = school.id;
      sendJson(response, 201, { activeSchool: school });
    } catch (err) {
      sendJson(response, 400, { error: err.message });
    }
  });
}

function handleAddVm(request, response) {
  let body = "";
  request.on("data", (chunk) => { body += chunk.toString(); });
  request.on("end", () => {
    try {
      const input = JSON.parse(body || "{}");
      const schoolId = input.schoolId || activeSchoolId;
      const school = schoolsStore.find((s) => s.id === schoolId);
      if (!school) {
        sendJson(response, 404, { error: "School not found" });
        return;
      }
      if (!input.name || !input.name.trim()) {
        sendJson(response, 400, { error: "VM name is required" });
        return;
      }
      const vmName = input.name.trim();
      const location = input.location || "UK South";
      const regionSlug = location.toLowerCase().replace(/ /g, "");
      const ip = input.ip || `20.49.176.${Math.floor(100 + Math.random() * 150)}`;
      const fqdn = input.fqdn || `${vmName}.${regionSlug}.cloudapp.azure.com`;
      const size = input.size || "Standard_B2als_v2";

      const newVm = {
        id: vmName,
        name: vmName,
        ip,
        fqdn,
        state: "VM running",
        size,
        location
      };
      school.vms.push(newVm);
      sendJson(response, 201, { success: true, vm: newVm, school });
    } catch (err) {
      sendJson(response, 400, { error: err.message });
    }
  });
}

function handleRequestAccess(request, response) {
  let body = "";
  request.on("data", (chunk) => { body += chunk.toString(); });
  request.on("end", () => {
    try {
      const input = JSON.parse(body || "{}");
      if (!input.vmId) {
        sendJson(response, 400, { error: "vmId is required" });
        return;
      }
      const login = (input.login || "psuser").trim();
      const ipAddress = (input.ipAddress || "").trim();
      if (!ipAddress) {
        sendJson(response, 400, { error: "Your IP Address is required" });
        return;
      }

      let targetVm = null;
      for (const s of schoolsStore) {
        const found = s.vms.find((v) => v.id === input.vmId || v.name === input.vmId);
        if (found) { targetVm = found; break; }
      }
      if (!targetVm) {
        targetVm = { id: input.vmId, name: input.vmId, ip: "20.49.176.149", fqdn: `${input.vmId}.uksouth.cloudapp.azure.com` };
      }

      const accessId = `jit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
      let password = "";
      for (let i = 0; i < 18; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
      const accessRecord = {
        accessId,
        vmId: targetVm.id,
        vmName: targetVm.name,
        ip: targetVm.ip,
        login,
        password,
        requesterIp: ipAddress,
        reason: input.reason || "Case",
        caseOppNumber: input.caseOppNumber || "",
        created: new Date().toISOString(),
        expiresAt
      };
      jitAccessStore.set(accessId, accessRecord);

      sendJson(response, 200, {
        success: true,
        accessGranted: true,
        accessId,
        vmId: targetVm.id,
        vmName: targetVm.name,
        host: targetVm.ip,
        fqdn: targetVm.fqdn,
        port: 3389,
        login,
        password,
        expiresAt,
        durationHours: 4,
        rdpDownloadUrl: `/api/vms/rdp?accessId=${accessId}&vmId=${encodeURIComponent(targetVm.id)}`
      });
    } catch (err) {
      sendJson(response, 500, { error: err.message });
    }
  });
}

function handleDownloadRdp(request, response) {
  const parsedUrl = new URL(request.url, "http://localhost");
  const accessId = parsedUrl.searchParams.get("accessId");
  const vmId = parsedUrl.searchParams.get("vmId");
  const access = accessId ? jitAccessStore.get(accessId) : null;

  let host = access ? access.ip : "20.49.176.149";
  let username = access ? access.login : "psuser";
  let filename = (access ? access.vmName : vmId || "connection") + ".rdp";

  const rdpFileContent = [
    `full address:s:${host}:3389`,
    `prompt for credentials:i:1`,
    `administrative session:i:1`,
    `username:s:${username}`,
    `screen mode id:i:2`,
    `use multimon:i:0`,
    `desktopwidth:i:1920`,
    `desktopheight:i:1080`,
    `session bpp:i:32`,
    `compression:i:1`,
    `keyboardhook:i:2`,
    `audiomode:i:0`,
    `redirectprinters:i:0`,
    `redirectcomports:i:0`,
    `redirectsmartcards:i:0`,
    `redirectclipboard:i:1`,
    `redirectposdevices:i:0`,
    `autoreconnection enabled:i:1`,
    `authentication level:i:2`,
    `enablecredsspsupport:i:1`
  ].join("\r\n");

  response.writeHead(200, {
    "Content-Type": "application/x-rdp",
    "Content-Disposition": `attachment; filename="${filename}"`
  });
  response.end(rdpFileContent);
}

async function handleRedeploy(request, response) {
  let body = "";
  request.on("data", (chunk) => {
    body += chunk.toString();
  });
  request.on("end", async () => {
    try {
      const input = JSON.parse(body || "{}");
      const workspace = (input.workspace || input.resourceGroupName || "").trim();
      if (!workspace) {
        sendJson(response, 400, { error: "workspace is required for redeployment" });
        return;
      }
      if (!/^[A-Za-z0-9._-]+$/.test(workspace)) {
        sendJson(response, 400, { error: "workspace may contain only letters, numbers, dots, underscores, and hyphens" });
        return;
      }

      const jobId = `terraform-redeploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const job = {
        id: jobId,
        workspace,
        action: "Terraform Redeploy (Dry Run)",
        status: "running",
        started: new Date().toISOString(),
        updated: new Date().toISOString(),
        output: ""
      };
      jobs.set(jobId, job);

      const vmName = (input.vmName || workspace).trim();
      const dnsName = (input.dnsName || "test").trim();
      const environment = (input.environment || "dev").trim();
      const location = (input.location || "UK South").trim();
      const vmSize = (input.vmSize || "Standard_B2als_v2").trim();
      const adminUsername = (input.adminUsername || "azureadmin").trim();

      const variables = [
        "-var", `resource_group_name=${workspace}`,
        "-var", `vm_name=${vmName}`,
        "-var", `dns_name=${dnsName}`,
        "-var", `environment=${environment}`,
        "-var", `location=${location}`,
        "-var", `vm_size=${vmSize}`,
        "-var", `admin_username=${adminUsername}`
      ];

      const select = await runTerraform(["workspace", "select", "-or-create", workspace]);
      if (select.code !== 0) {
        job.status = "failed";
        job.updated = new Date().toISOString();
        job.output = select.output;
        sendJson(response, 500, { error: "Unable to select Terraform workspace", output: select.output, jobId });
        return;
      }

      const plan = await runTerraform(["plan", ...variables]);
      job.status = plan.code === 0 ? "completed" : "failed";
      job.updated = new Date().toISOString();
      job.output = `${select.output}${plan.output}`;
      sendJson(response, plan.code === 0 ? 200 : 500, {
        workspace,
        success: plan.code === 0,
        jobId,
        output: job.output
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

async function serveStatic(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  const filePath = path.normalize(path.join(publicDir, requestPath));
  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream" });
    response.end(content);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

const apiRoutes = new Map([
  ["GET /api/dashboard", (_request, response) => handleDashboard(response)],
  ["POST /api/azure/sync", (_request, response) => handleAzureSync(response)],
  ["POST /api/redeploy", (request, response) => handleRedeploy(request, response)],
  ["POST /api/deploy", (request, response) => handleDeployment(request, response)],
  ["GET /api/jobs", (_request, response) => handleJobs(response)],
  ["GET /api/statefiles", (_request, response) => handleStateFiles(response)]
  ["GET /api/statefiles", (_request, response) => handleStateFiles(response)],
  ["GET /api/schools", (_request, response) => handleGetSchools(response)],
  ["POST /api/schools", (request, response) => handleCreateSchool(request, response)],
  ["POST /api/schools/select", (request, response) => handleSelectSchool(request, response)],
  ["POST /api/vms", (request, response) => handleAddVm(request, response)],
  ["POST /api/vms/request-access", (request, response) => handleRequestAccess(request, response)],
  ["GET /api/vms/rdp", (request, response) => handleDownloadRdp(request, response)]
]);

const server = http.createServer((request, response) => {
  const requestPath = request.url.split("?")[0];
  if (requestPath.startsWith("/api/")) {
    const handler = apiRoutes.get(`${request.method} ${requestPath}`);
    if (!handler) {
      sendJson(response, 404, { error: `Unknown API route: ${request.method} ${requestPath}` });
      return;
    }
    handler(request, response);
    return;
  }
  if (request.method === "GET") {
    serveStatic(request, response);
    return;
  }
  response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Method not allowed");
});

function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }
      reject(error);
    });
    probe.listen(port, () => probe.close(() => resolve(true)));
  });
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function readRunningInstance() {
  try {
    const instance = JSON.parse(await fs.readFile(pidFile, "utf8"));
    return typeof instance.pid === "number" && isProcessAlive(instance.pid) ? instance : null;
  } catch {
    return null;
  }
}

async function recordInstance(port) {
  await fs.writeFile(pidFile, JSON.stringify({ pid: process.pid, port }, null, 2));
}

async function startServer() {
  const running = await readRunningInstance();
  if (running && !process.env.TERRAFLOW_ALLOW_MULTIPLE) {
    console.error(`Terraflow is already running (PID ${running.pid}) at http://localhost:${running.port}.`);
    console.error("Stop it with `npm run stop`, or set TERRAFLOW_ALLOW_MULTIPLE=1 to start another instance.");
    process.exitCode = 1;
    return;
  }

  let port = requestedPort;
  if (!process.env.PORT) {
    while (!(await isPortAvailable(port))) {
      console.log(`Port ${port} is busy; trying ${port + 1}.`);
      port += 1;
    }
  }
  server.listen(port, async () => {
    if (!process.env.TERRAFLOW_ALLOW_MULTIPLE) {
      await recordInstance(port);
      console.log(`Instance pid ${process.pid} recorded in server.pid.json`);
    }
    console.log(`Terraflow running at http://localhost:${port}`);
    console.log(`Terraform root: ${terraformDir}`);
  });
}

startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
