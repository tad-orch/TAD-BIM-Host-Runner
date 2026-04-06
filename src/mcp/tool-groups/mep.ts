import type { AnyMcpToolDefinition, McpToolCatalog } from "../types";

export const mepToolCatalog: McpToolCatalog = {
  namespace: "mep",
  prefix: "mcp-mep-",
  groups: [
    {
      name: "pipes",
      description: "Reserved for future MEP pipe tools.",
      tools: [],
    },
  ],
};

export const mepMcpTools: AnyMcpToolDefinition[] = [];
