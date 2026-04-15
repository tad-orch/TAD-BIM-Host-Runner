import {
  mapArchRevitActivateDocumentToInternalArgs,
  mapArchRevitExportNwcToInternalArgs,
  mapArchRevitLaunchToInternalArgs,
  mapArchRevitList3dViewsToInternalArgs,
  mapArchRevitOpenCloudModelToInternalArgs,
  mapArchRevitSessionStatusToInternalArgs,
  mapArchSystemHealthToInternalArgs,
  mapArchWallsCreateToInternalArgs,
} from "../mapper";
import {
  mcpArchRevitActivateDocumentRequestSchema,
  mcpArchRevitExportNwcRequestSchema,
  mcpArchRevitLaunchRequestSchema,
  mcpArchRevitList3dViewsRequestSchema,
  mcpArchRevitOpenCloudModelRequestSchema,
  mcpArchRevitSessionStatusRequestSchema,
  mcpArchSystemHealthRequestSchema,
  mcpArchWallsCreateRequestSchema,
} from "../schemas";
import type {
  AnyMcpToolDefinition,
  McpArchRevitActivateDocumentRequest,
  McpArchRevitExportNwcRequest,
  McpArchRevitLaunchRequest,
  McpArchRevitList3dViewsRequest,
  McpArchRevitOpenCloudModelRequest,
  McpArchRevitSessionStatusRequest,
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
      name: "sessions",
      description: "Revit session inspection and launch tools for the current operational workflow.",
      tools: ["mcp-arch-revit-session-status", "mcp-arch-revit-launch"],
    },
    {
      name: "models",
      description: "Cloud model opening tools for ACC/BIM 360 backed Revit workflows.",
      tools: ["mcp-arch-revit-open-cloud-model", "mcp-arch-revit-activate-document"],
    },
    {
      name: "views",
      description: "3D view inspection and export preparation tools.",
      tools: ["mcp-arch-revit-list-3d-views", "mcp-arch-revit-export-nwc"],
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

const archRevitSessionStatusTool: McpToolDefinition<McpArchRevitSessionStatusRequest> = {
  name: "mcp-arch-revit-session-status",
  internalTool: "revit_session_status",
  mode: "sync",
  namespace: "arch",
  group: "sessions",
  description: "Checks whether a Revit session is available on the target host.",
  schema: mcpArchRevitSessionStatusRequestSchema,
  toInternalArgs: mapArchRevitSessionStatusToInternalArgs,
};

const archRevitLaunchTool: McpToolDefinition<McpArchRevitLaunchRequest> = {
  name: "mcp-arch-revit-launch",
  internalTool: "revit_launch",
  mode: "sync",
  namespace: "arch",
  group: "sessions",
  description: "Launches Revit on the target host and optionally waits for readiness.",
  schema: mcpArchRevitLaunchRequestSchema,
  toInternalArgs: mapArchRevitLaunchToInternalArgs,
};

const archRevitOpenCloudModelTool: McpToolDefinition<McpArchRevitOpenCloudModelRequest> = {
  name: "mcp-arch-revit-open-cloud-model",
  internalTool: "revit_open_cloud_model",
  mode: "async",
  namespace: "arch",
  group: "models",
  description: "Opens a specific Revit cloud model using explicit project and model identity.",
  schema: mcpArchRevitOpenCloudModelRequestSchema,
  toInternalArgs: mapArchRevitOpenCloudModelToInternalArgs,
};

const archRevitList3dViewsTool: McpToolDefinition<McpArchRevitList3dViewsRequest> = {
  name: "mcp-arch-revit-list-3d-views",
  internalTool: "revit_list_3d_views",
  mode: "sync",
  namespace: "arch",
  group: "views",
  description: "Lists 3D views from the currently open Revit model.",
  schema: mcpArchRevitList3dViewsRequestSchema,
  toInternalArgs: mapArchRevitList3dViewsToInternalArgs,
};

const archRevitExportNwcTool: McpToolDefinition<McpArchRevitExportNwcRequest> = {
  name: "mcp-arch-revit-export-nwc",
  internalTool: "revit_export_nwc",
  mode: "async",
  namespace: "arch",
  group: "views",
  description: "Exports one or more selected 3D views to an NWC file.",
  schema: mcpArchRevitExportNwcRequestSchema,
  toInternalArgs: mapArchRevitExportNwcToInternalArgs,
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

const archRevitActivateDocumentTool: McpToolDefinition<McpArchRevitActivateDocumentRequest> = {
  name: "mcp-arch-revit-activate-document",
  internalTool: "revit_activate_document",
  mode: "sync",
  namespace: "arch",
  group: "models",
  description: "Activates a specific open document in the current Revit session by title.",
  schema: mcpArchRevitActivateDocumentRequestSchema,
  toInternalArgs: mapArchRevitActivateDocumentToInternalArgs,
};

export const archMcpTools: AnyMcpToolDefinition[] = [
  archSystemHealthTool,
  archRevitSessionStatusTool,
  archRevitLaunchTool,
  archRevitOpenCloudModelTool,
  archRevitActivateDocumentTool,
  archRevitList3dViewsTool,
  archRevitExportNwcTool,
  archWallsCreateTool,
];
