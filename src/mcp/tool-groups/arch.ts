import {
  mapArchSystemHealthToInternalArgs,
  mapArchWallsCreateToInternalArgs,
} from "../mapper";
import {
  mcpArchSystemHealthRequestSchema,
  mcpArchWallsCreateRequestSchema,
} from "../schemas";
import type {
  AnyMcpToolDefinition,
  McpArchSystemHealthRequest,
  McpArchWallsCreateRequest,
  McpToolCatalog,
  McpToolDefinition,
} from "../types";

export const archToolCatalog: McpToolCatalog = {
  namespace: "arch",
  prefix: "mcp-arch-",
  groups: [
    {
      name: "system",
      description: "Gateway and host reachability tools for Revit architecture nodes.",
      tools: ["mcp-arch-system-health"],
    },
    {
      name: "walls",
      description: "Architectural wall automation tools mapped to Revit wall operations.",
      tools: ["mcp-arch-walls-create"],
    },
    {
      name: "floors",
      description: "Reserved for future architectural floor automation tools.",
      tools: [],
    },
    {
      name: "roofs",
      description: "Reserved for future architectural roof automation tools.",
      tools: [],
    },
  ],
};

const archSystemHealthTool: McpToolDefinition<McpArchSystemHealthRequest> = {
  name: "mcp-arch-system-health",
  internalTool: "revit_ping",
  mode: "sync",
  namespace: "arch",
  group: "system",
  description: "Checks reachability to the target Revit host and bridge.",
  schema: mcpArchSystemHealthRequestSchema,
  toInternalArgs: mapArchSystemHealthToInternalArgs,
};

const archWallsCreateTool: McpToolDefinition<McpArchWallsCreateRequest> = {
  name: "mcp-arch-walls-create",
  internalTool: "revit_create_wall",
  mode: "async",
  namespace: "arch",
  group: "walls",
  description: "Creates a straight wall in the active Revit document.",
  schema: mcpArchWallsCreateRequestSchema,
  toInternalArgs: mapArchWallsCreateToInternalArgs,
};

export const archMcpTools: AnyMcpToolDefinition[] = [archSystemHealthTool, archWallsCreateTool];
