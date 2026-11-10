# Workshop prerequisites

Complete this **before** the workshop. Day 1 starts immediately. There is no time to install tools during the session.

This workshop is for experienced DevOps engineers. We do not teach basic Azure, Terraform, Git, or JavaScript.

You will **not** receive this application’s source code in advance. Bring a laptop with the tools below installed and working. You will generate Terraform, React, and Node.js during the labs using AI prompts.

## Accounts

| Account | Why |
|---|---|
| **Your own** Microsoft Azure subscription | The instructor will **not** provide a subscription. You must bring one you can deploy into. |
| Azure login (MFA device if required) | `az login` must work on your laptop |
| An AI assistant you already use | Labs are prompt-driven |

Cursor is **not** required. Use GitHub Copilot, Claude, Gemini, ChatGPT, Cursor, or another LLM you can access on the day.

You need **Contributor** (or equivalent) rights in **your** subscription to create a resource group, VNet, subnet, public IP, NSG, Windows VM, and DNS zone. Pay-as-you-go, MSDN, or a company sub you are allowed to use are all fine. A sandbox the instructor runs is **not** part of this workshop.

## Software to install

Windows 10/11, macOS, or Linux. 16 GB RAM recommended.

| Tool | Version | Check |
|---|---|---|
| Git | latest | `git --version` |
| Node.js | **20 or newer** | `node -v` |
| npm | **10 or newer** | `npm -v` |
| Terraform | **1.6.x or newer** (minimum 1.3.0) | `terraform -version` |
| Azure CLI | latest | `az version` |
| kubectl | latest | `kubectl version --client` |
| Docker | latest, **running** | `docker version` |
| A code editor | any | VS Code, Cursor, JetBrains, Neovim, etc. |

**AI assistant:** have **one** of Copilot, Claude, Gemini, ChatGPT, Cursor, or similar signed in and working.

Optional: Windows Terminal.

### Windows (winget)

```powershell
winget install Git.Git
winget install OpenJS.NodeJS.LTS
winget install Hashicorp.Terraform
winget install Microsoft.AzureCLI
winget install Kubernetes.kubectl
winget install Docker.DockerDesktop
```

Restart the PC after Docker Desktop install, then **start Docker Desktop** and wait until it says running. WSL 2 is required on Windows.

### macOS (Homebrew)

```bash
brew install git node terraform azure-cli kubernetes-cli
brew install --cask docker
```

Open **Docker Desktop** once after install and wait until the engine is running.

### Linux

Install Git, Node 20, Terraform, Azure CLI, and kubectl with your distro packages or the official installers.

Install **Docker Engine** (not only the CLI). Follow [Docker’s Linux install](https://docs.docker.com/engine/install/), add your user to the `docker` group, then log out and back in.

```bash
sudo usermod -aG docker $USER
```

`docker version` must work **without** sudo. Podman is not a substitute unless `docker` already works the same way.

## Docker smoke test

Docker must be **running** before the workshop (Windows/Mac: Docker Desktop open; Linux: Docker Engine started).

```bash
docker version
docker run --rm hello-world
```

Both commands must succeed.

## Azure login

```bash
az login
az account show
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
az group list -o table
```

You must be able to create resources in **your** subscription (resource group, VNet, VM, public IP, NSG, DNS zone). The instructor will not issue a subscription or guest access. If you cannot deploy, fix it before the workshop.

## Terraform smoke test

In an empty folder:

```bash
terraform version
```

Must report **1.3.0 or newer** (1.6.x preferred). You do not need a project cloned. Provider download happens in the lab with `terraform init`.

## Node smoke test

```bash
node -v    # v20 or higher
npm -v     # 10 or higher
```

Create a throwaway folder and confirm npm works:

```bash
mkdir ws-npm-check
cd ws-npm-check
npm init -y
```

Delete that folder afterward. Corporate proxy/VPN must allow **registry.npmjs.org** and **registry.terraform.io**.

## kubectl

```bash
kubectl version --client
```

Cluster credentials are **not** required before the workshop. Install the CLI only.

## Ports that should be free on the day

| Port | Used for |
|---|---|
| 3000 | React app you will generate |
| 3001 | Node API you will generate |

## Pre-workshop checklist

- [ ] Git installed
- [ ] Node 20+ and npm 10+
- [ ] Terraform 1.6+ (`terraform -version`)
- [ ] Azure CLI installed
- [ ] **Your own Azure subscription** (instructor will not provide one)
- [ ] `az login` works against that subscription and you can list resource groups
- [ ] kubectl client installed
- [ ] Docker installed and running (`docker version` and `docker run --rm hello-world` succeed)
- [ ] Windows: **Docker Desktop** (not only the CLI)
- [ ] macOS: **Docker Desktop**
- [ ] Linux: **Docker Engine**
- [ ] A code editor
- [ ] **One** working AI assistant (Copilot, Claude, Gemini, ChatGPT, Cursor, etc.)
- [ ] Laptop charger
- [ ] Network can reach npm and the Terraform registry (or your proxy is already set)

## What we will not do for you on the day

- Install Node, Terraform, Azure CLI, Git, kubectl, or Docker
- Provide an Azure subscription
- Complete Azure login / MFA
- Set up your AI assistant account

Do **not** expect a copy of the instructor portal codebase. You will build your own Terraform modules and portal during the two days.

If a check fails, fix it before the workshop or send the instructor the **exact command and error**.
