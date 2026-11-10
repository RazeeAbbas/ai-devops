import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const stateDirectory = path.resolve(
  currentDirectory,
  "..",
  "..",
  "..",
  "Terraform",
  "main",
  "terraform.tfstate.d"
);

function readWorkspaceNames() {
  return fs
    .readdirSync(stateDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

test.describe("GET /api/statefiles", () => {
  test("returns valid JSON instead of the static 404 body", async ({ request }) => {
    const response = await request.get("/api/statefiles");

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/json");

    const raw = await response.text();
    expect(raw).not.toContain("Not found");
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  test("lists exactly the workspaces that exist on disk", async ({ request }) => {
    const response = await request.get("/api/statefiles");
    const body = await response.json();

    expect(body.map((entry) => entry.workspace).sort()).toEqual(readWorkspaceNames());
  });

  test("reports complete metadata for every workspace", async ({ request }) => {
    const response = await request.get("/api/statefiles");
    const body = await response.json();

    for (const workspace of body) {
      expect(typeof workspace.workspace).toBe("string");
      expect(typeof workspace.hasState).toBe("boolean");
      expect(typeof workspace.backupCount).toBe("number");

      if (workspace.hasState) {
        expect(workspace.file).toBe("terraform.tfstate");
        expect(workspace.relativePath).toContain(workspace.workspace);
        expect(workspace.size).toBeGreaterThan(0);
        expect(Number.isNaN(Date.parse(workspace.updated))).toBe(false);
      } else {
        expect(workspace.file).toBeNull();
        expect(workspace.relativePath).toBeNull();
        expect(workspace.size).toBe(0);
        expect(workspace.updated).toBeNull();
      }
    }
  });

  test("marks workspaces with no state file as hasState false", async ({ request }) => {
    const response = await request.get("/api/statefiles");
    const body = await response.json();

    const expected = readWorkspaceNames().map((name) => ({
      workspace: name,
      hasState: fs.existsSync(path.join(stateDirectory, name, "terraform.tfstate"))
    }));

    expect(body.map(({ workspace, hasState }) => ({ workspace, hasState }))).toEqual(
      expect.arrayContaining(expected)
    );
  });
});
