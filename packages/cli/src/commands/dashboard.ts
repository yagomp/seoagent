// @ts-nocheck
import { Command } from "commander";
import { withErrorHandler } from "../helpers.js";

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Launch the local web dashboard")
    .option("--port <port>", "Port to serve on", "3847")
    .action(
      withErrorHandler(async (opts: Record<string, string>) => {
        const port = parseInt(opts.port, 10);
        console.log(`Starting dashboard on http://localhost:${port} ...`);

        // Dynamic import to avoid loading dashboard deps unless needed
        try {
          const { startDashboard } = await import("@seoagent/dashboard" as string);
          await (startDashboard as (opts: { port: number }) => Promise<void>)({ port });
        } catch {
          console.error(
            "Dashboard package not found. Make sure @seoagent/dashboard is built.\n" +
            "Run: cd packages/dashboard && pnpm build"
          );
          process.exit(1);
        }
      })
    );
}
