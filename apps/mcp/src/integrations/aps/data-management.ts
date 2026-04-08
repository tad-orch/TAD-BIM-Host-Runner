import { AppError } from "../../lib/errors";
import type { Env } from "../../config/env";
import { ApsClient } from "./client";
import type { ApsFolderEntry, ApsFolderSummary, ApsItemSummary, ApsProjectSummary, ApsVersionSummary } from "./types";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNestedRecord(record: JsonRecord | null, ...keys: string[]): JsonRecord | null {
  let current: JsonRecord | null = record;

  for (const key of keys) {
    current = asRecord(current?.[key]);
  }

  return current;
}

function getNestedString(record: JsonRecord | null, ...keys: string[]): string | null {
  const lastKey = keys[keys.length - 1];
  const parent = getNestedRecord(record, ...keys.slice(0, -1));
  return asString(parent?.[lastKey]);
}

export interface ApsProjectContext {
  project: ApsProjectSummary;
}

export class ApsDataManagementService {
  constructor(
    private readonly client: ApsClient,
    private readonly env: Env,
  ) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async listProjects(): Promise<ApsProjectSummary[]> {
    const hubs = await this.listHubs();
    const projects: ApsProjectSummary[] = [];

    for (const hub of hubs) {
      const hubId = asString(hub.id);

      if (!hubId) {
        continue;
      }

      const hubAttributes = asRecord(hub.attributes);
      const hubName = asString(hubAttributes?.name) ?? hubId;
      const hubRegion = asString(hubAttributes?.region);
      const payload = await this.client.getJson(`/project/v1/hubs/${encodeURIComponent(hubId)}/projects`);

      for (const projectRecord of asArray(payload.data)) {
        const project = this.mapProject(projectRecord, hubId, hubName, hubRegion);

        if (project) {
          projects.push(project);
        }
      }
    }

    return projects.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }));
  }

  async resolveProjectContext(projectId: string): Promise<ApsProjectContext> {
    const projects = await this.listProjects();
    const project = projects.find((candidate) => candidate.id === projectId);

    if (!project) {
      throw new AppError(404, "aps_resource_not_found", `APS project '${projectId}' was not found.`);
    }

    return {
      project,
    };
  }

  async listTopFolders(projectId: string): Promise<{
    project: ApsProjectSummary;
    folders: ApsFolderSummary[];
  }> {
    const projectContext = await this.resolveProjectContext(projectId);
    const payload = await this.client.getJson(
      `/project/v1/hubs/${encodeURIComponent(projectContext.project.hubId)}/projects/${encodeURIComponent(projectId)}/topFolders`,
    );

    return {
      project: projectContext.project,
      folders: asArray(payload.data)
        .map((resource) => this.mapFolderLikeResource(resource))
        .filter(Boolean) as ApsFolderSummary[],
    };
  }

  async listFolderContents(projectId: string, folderId: string): Promise<{
    projectId: string;
    folderId: string;
    entries: ApsFolderEntry[];
  }> {
    const payload = await this.client.getJson(
      `/data/v1/projects/${encodeURIComponent(projectId)}/folders/${encodeURIComponent(folderId)}/contents`,
    );

    return {
      projectId,
      folderId,
      entries: asArray(payload.data)
        .map((resource) => this.mapFolderEntry(resource))
        .filter(Boolean) as ApsFolderEntry[],
    };
  }

  async getItem(projectId: string, itemId: string): Promise<ApsItemSummary> {
    const payload = await this.client.getJson(
      `/data/v1/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}`,
    );
    const record = asRecord(payload.data);

    if (!record) {
      throw new AppError(404, "aps_resource_not_found", "APS item was not found.");
    }

    return this.mapItem(record);
  }

  async getTipVersionForItem(projectId: string, itemId: string): Promise<ApsVersionSummary> {
    const item = await this.getItem(projectId, itemId);

    if (!item.tipVersionId) {
      throw new AppError(404, "aps_resource_not_found", `APS item '${itemId}' does not expose a tip version.`);
    }

    return this.getVersion(projectId, item.tipVersionId);
  }

  async getVersion(projectId: string, versionId: string): Promise<ApsVersionSummary> {
    const payload = await this.client.getJson(
      `/data/v1/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(versionId)}`,
    );
    const record = asRecord(payload.data);

    if (!record) {
      throw new AppError(404, "aps_resource_not_found", "APS version was not found.");
    }

    return this.mapVersion(record);
  }

  private async listHubs(): Promise<JsonRecord[]> {
    const payload = await this.client.getJson("/project/v1/hubs");
    const hubs = asArray(payload.data).map((value) => asRecord(value)).filter(Boolean) as JsonRecord[];

    if (!this.env.APS_ACCOUNT_ID) {
      return hubs;
    }

    return hubs.filter((hub) => {
      const hubId = asString(hub.id);
      const extensionData = getNestedRecord(asRecord(hub.attributes), "extension", "data");
      const accountId = asString(extensionData?.accountId);

      return hubId === this.env.APS_ACCOUNT_ID || accountId === this.env.APS_ACCOUNT_ID;
    });
  }

  private mapProject(
    resource: unknown,
    hubId: string,
    hubName: string,
    hubRegion: string | null,
  ): ApsProjectSummary | null {
    const record = asRecord(resource);

    if (!record) {
      return null;
    }

    const attributes = asRecord(record.attributes);

    return {
      id: asString(record.id) ?? "",
      name: asString(attributes?.name) ?? asString(attributes?.displayName) ?? "",
      hubId,
      hubName,
      region: asString(attributes?.region) ?? hubRegion,
      projectType: getNestedString(attributes, "extension", "type"),
    };
  }

  private mapFolderLikeResource(resource: unknown): ApsFolderSummary | null {
    const record = asRecord(resource);

    if (!record) {
      return null;
    }

    const attributes = asRecord(record.attributes);

    return {
      id: asString(record.id) ?? "",
      name: asString(attributes?.name) ?? asString(attributes?.displayName) ?? "",
      displayName: asString(attributes?.displayName) ?? asString(attributes?.name) ?? "",
      type: asString(record.type) ?? "unknown",
      extensionType: getNestedString(attributes, "extension", "type"),
    };
  }

  private mapFolderEntry(resource: unknown): ApsFolderEntry | null {
    const record = asRecord(resource);

    if (!record) {
      return null;
    }

    const attributes = asRecord(record.attributes);
    const tipData = getNestedRecord(record, "relationships", "tip", "data");

    return {
      id: asString(record.id) ?? "",
      type: asString(record.type) ?? "unknown",
      name: asString(attributes?.name) ?? asString(attributes?.displayName) ?? "",
      displayName: asString(attributes?.displayName) ?? asString(attributes?.name) ?? "",
      extensionType: getNestedString(attributes, "extension", "type"),
      mimeType: asString(attributes?.mimeType),
      itemId: asString(record.type) === "items" ? asString(record.id) : null,
      tipVersionId: asString(tipData?.id),
      lastModifiedTime: asString(attributes?.lastModifiedTime),
    };
  }

  private mapItem(record: JsonRecord): ApsItemSummary {
    const attributes = asRecord(record.attributes);
    const tipData = getNestedRecord(record, "relationships", "tip", "data");
    const originalItemUrn = asString(getNestedRecord(record, "relationships", "storage", "data")?.id) ?? asString(record.id);

    return {
      id: asString(record.id) ?? "",
      displayName: asString(attributes?.displayName) ?? asString(attributes?.name) ?? "",
      sourceFileName: asString(attributes?.name) ?? asString(attributes?.displayName),
      tipVersionId: asString(tipData?.id),
      originalItemUrn,
    };
  }

  private mapVersion(record: JsonRecord): ApsVersionSummary {
    const attributes = asRecord(record.attributes);
    const originalItemUrn =
      asString(getNestedRecord(record, "relationships", "item", "data")?.id) ??
      asString(getNestedRecord(record, "relationships", "derivatives", "data")?.id) ??
      null;

    return {
      id: asString(record.id) ?? "",
      displayName: asString(attributes?.displayName) ?? asString(attributes?.name) ?? "",
      sourceFileName: asString(attributes?.name) ?? asString(attributes?.displayName),
      versionNumber: asNumber(attributes?.versionNumber),
      extensionType: getNestedString(attributes, "extension", "type"),
      lastModifiedTime: asString(attributes?.lastModifiedTime),
      originalItemUrn,
      extensionData: getNestedRecord(attributes, "extension", "data") ?? undefined,
    };
  }
}
