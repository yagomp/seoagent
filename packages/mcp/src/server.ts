import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUtilityTools } from "./tools/utility.js";
import { registerKeywordTools } from "./tools/keywords.js";
import { registerRankTrackingTools } from "./tools/rank-tracking.js";
import { registerAuditTools } from "./tools/audit.js";
import { registerCompetitorTools } from "./tools/competitor.js";
import { registerContentTools } from "./tools/content.js";
import { registerDomainTools } from "./tools/domain.js";
import { registerStrategyTools } from "./tools/strategy.js";
import { registerGscTools } from "./tools/gsc.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "seoagent",
    version: "0.1.0",
  });

  registerUtilityTools(server);
  registerKeywordTools(server);
  registerRankTrackingTools(server);
  registerAuditTools(server);
  registerCompetitorTools(server);
  registerContentTools(server);
  registerDomainTools(server);
  registerStrategyTools(server);
  registerGscTools(server);

  return server;
}
