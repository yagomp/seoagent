import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  addProject,
  listProjects,
  getProject,
  removeProject,
  getActiveProject,
  setActiveProject,
} from "../project.js";

describe("project", () => {
  let tmpDir: string;
  const originalEnv = process.env;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seoagent-proj-test-"));
    process.env = { ...originalEnv, SEOAGENT_HOME: tmpDir };
  });

  afterEach(() => {
    process.env = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("adds a project and creates its directory", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });

    const projectDir = path.join(tmpDir, "projects", "my-site");
    expect(fs.existsSync(projectDir)).toBe(true);

    const projectJson = JSON.parse(
      fs.readFileSync(path.join(projectDir, "project.json"), "utf-8")
    );
    expect(projectJson.domain).toBe("my-site.com");
    expect(projectJson.name).toBe("My Site");
  });

  it("lists all projects", () => {
    addProject("site-a", { domain: "a.com", name: "Site A" });
    addProject("site-b", { domain: "b.com", name: "Site B" });

    const projects = listProjects();
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.slug).sort()).toEqual(["site-a", "site-b"]);
  });

  it("returns empty array when no projects exist", () => {
    const projects = listProjects();
    expect(projects).toEqual([]);
  });

  it("gets a single project by slug", () => {
    addProject("my-site", {
      domain: "my-site.com",
      name: "My Site",
      niche: "tech",
    });

    const project = getProject("my-site");
    expect(project).not.toBeNull();
    expect(project!.config.domain).toBe("my-site.com");
    expect(project!.config.niche).toBe("tech");
  });

  it("returns null for non-existent project", () => {
    const project = getProject("nope");
    expect(project).toBeNull();
  });

  it("removes a project", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });
    removeProject("my-site");

    const project = getProject("my-site");
    expect(project).toBeNull();

    const projectDir = path.join(tmpDir, "projects", "my-site");
    expect(fs.existsSync(projectDir)).toBe(false);
  });

  it("throws when adding a project that already exists", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });
    expect(() => {
      addProject("my-site", { domain: "other.com", name: "Other" });
    }).toThrow(/already exists/);
  });

  it("sets and gets the active project", () => {
    addProject("my-site", { domain: "my-site.com", name: "My Site" });
    setActiveProject("my-site");

    const active = getActiveProject();
    expect(active).toBe("my-site");
  });

  it("throws when setting active project that does not exist", () => {
    expect(() => setActiveProject("nope")).toThrow(/not found/);
  });
});
