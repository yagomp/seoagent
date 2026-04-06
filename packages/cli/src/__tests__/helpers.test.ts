import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @seoagent/core before importing helpers
vi.mock("@seoagent/core", () => ({
  getActiveProject: vi.fn(),
  getProject: vi.fn(),
}));

import { getActiveProject, getProject } from "@seoagent/core";
import { requireActiveProject } from "../helpers.js";

const mockGetActiveProject = vi.mocked(getActiveProject);
const mockGetProject = vi.mocked(getProject);

describe("requireActiveProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns project when active project is set and exists", () => {
    mockGetActiveProject.mockReturnValue("fplai");
    mockGetProject.mockReturnValue({
      slug: "fplai",
      config: { domain: "fplai.app", name: "FPLai" },
    });

    const project = requireActiveProject();
    expect(project.slug).toBe("fplai");
    expect(project.config.domain).toBe("fplai.app");
  });

  it("throws when no active project is set", () => {
    mockGetActiveProject.mockReturnValue(undefined);

    expect(() => requireActiveProject()).toThrow(
      /no active project/i
    );
  });

  it("throws when active project does not exist", () => {
    mockGetActiveProject.mockReturnValue("deleted-project");
    mockGetProject.mockReturnValue(null);

    expect(() => requireActiveProject()).toThrow(
      /not found/i
    );
  });
});
