import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./routes.js";
import { getActiveProject } from "@seoagent/core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectSlug = process.env.SEOAGENT_PROJECT || getActiveProject();
if (!projectSlug) {
  console.error("No active project. Run: seoagent project use <slug>");
  process.exit(1);
}

const app = createApp(projectSlug);
const PORT = 3847;

// Serve static SPA files
const staticDir = path.join(__dirname, "..", "client");
app.use(express.static(staticDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`SEOAgent dashboard: http://localhost:${PORT}`);
});
