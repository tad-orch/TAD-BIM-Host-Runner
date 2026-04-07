import type { AnyMcpToolDefinition, McpToolCatalog } from "../types";

export const strToolCatalog: McpToolCatalog = {
  namespace: "str",
  prefix: "mcp-str-",
  groups: [
    {
      name: "columns",
      description: "Reserved for future structural column tools.",
      tools: [],
    },
    {
      name: "beams",
      description: "Reserved for future structural beam tools.",
      tools: [],
    },
  ],
};

export const strMcpTools: AnyMcpToolDefinition[] = [];
