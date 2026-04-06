import { archToolCatalog, archMcpTools } from "./arch";
import { mepToolCatalog, mepMcpTools } from "./mep";
import { strToolCatalog, strMcpTools } from "./str";
import type { AnyMcpToolDefinition, McpToolCatalog, McpToolName } from "../types";

export class McpToolRegistry {
  constructor(
    private readonly tools: Map<McpToolName, AnyMcpToolDefinition>,
    private readonly catalogs: McpToolCatalog[],
  ) {}

  get(name: string): AnyMcpToolDefinition | undefined {
    return this.tools.get(name as McpToolName);
  }

  all(): AnyMcpToolDefinition[] {
    return [...this.tools.values()];
  }

  groups(): McpToolCatalog[] {
    return [...this.catalogs];
  }
}

export function createMcpToolRegistry(): McpToolRegistry {
  const tools = new Map<McpToolName, AnyMcpToolDefinition>();

  for (const tool of [...archMcpTools, ...strMcpTools, ...mepMcpTools]) {
    tools.set(tool.name, tool);
  }

  return new McpToolRegistry(tools, [archToolCatalog, strToolCatalog, mepToolCatalog]);
}
