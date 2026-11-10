# Terraflow Frontend

A dependency-free Node.js frontend and backend for the Terraform project in `../Terraform/main`.

## Run

From this folder:

```powershell
npm start
```

Open http://localhost:3000.

The UI sends deployment variables to the Node backend. The backend selects or creates a Terraform workspace using the resource-group name, then runs `terraform plan` in the existing Terraform root.

Requirements:

- Node.js 18+
- Terraform available on `PATH`
- Azure CLI authenticated for the AzureRM provider
