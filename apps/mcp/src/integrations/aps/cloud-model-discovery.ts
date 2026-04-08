import type { Env } from "../../config/env";
import { ApsDataManagementService } from "./data-management";
import type { ApsCloudModelInfo, PreparedRevitOpenCloudModelPayload } from "./types";

const CLOUD_MODEL_EXTENSION_TYPE = "versions:autodesk.bim360:C4RModel";

export class ApsCloudModelDiscoveryService {
  constructor(
    private readonly dataManagement: ApsDataManagementService,
    private readonly env: Env,
  ) {}

  isConfigured(): boolean {
    return this.dataManagement.isConfigured();
  }

  listProjects() {
    return this.dataManagement.listProjects();
  }

  listTopFolders(projectId: string) {
    return this.dataManagement.listTopFolders(projectId);
  }

  listFolderContents(projectId: string, folderId: string) {
    return this.dataManagement.listFolderContents(projectId, folderId);
  }

  async getItemCloudModelInfo(projectId: string, itemId: string): Promise<ApsCloudModelInfo> {
    const projectContext = await this.dataManagement.resolveProjectContext(projectId);
    const item = await this.dataManagement.getItem(projectId, itemId);
    const version = await this.dataManagement.getTipVersionForItem(projectId, itemId);
    const versionExtensionType = version.extensionType;
    const extensionData = version.extensionData ?? {};
    const region = this.normalizeRegion(
      typeof extensionData.region === "string" ? extensionData.region : projectContext.project.region,
    );
    const projectGuid = typeof extensionData.projectGuid === "string" ? extensionData.projectGuid : null;
    const modelGuid = typeof extensionData.modelGuid === "string" ? extensionData.modelGuid : null;
    const isCloudModel = versionExtensionType === CLOUD_MODEL_EXTENSION_TYPE;

    const baseResult: ApsCloudModelInfo = {
      isCloudModel,
      projectId,
      projectName: projectContext.project.name,
      itemId,
      versionId: version.id,
      displayName: item.displayName || version.displayName,
      sourceFileName: version.sourceFileName ?? item.sourceFileName ?? null,
      region,
      projectGuid,
      modelGuid,
      versionExtensionType,
      originalItemUrn: item.originalItemUrn ?? version.originalItemUrn,
      lookupSource: "aps-data-management",
      accountContext: this.env.APS_ACCOUNT_ID ?? projectContext.project.hubId,
      userContext: this.env.APS_USER_ID ?? null,
      openCloudModelRequest: null,
    };

    if (!isCloudModel) {
      return {
        ...baseResult,
        reason: "item/version is not a Revit cloud model",
      };
    }

    if (!projectGuid || !modelGuid) {
      return {
        ...baseResult,
        reason: "cloud model metadata is present but project/model GUIDs could not be extracted",
      };
    }

    return {
      ...baseResult,
      openCloudModelRequest: this.prepareOpenCloudModelPayload(region, projectGuid, modelGuid),
    };
  }

  prepareOpenCloudModelPayload(
    region: string | null,
    projectGuid: string,
    modelGuid: string,
  ): PreparedRevitOpenCloudModelPayload | null {
    const normalizedRegion = this.normalizeRegion(region);

    if (!normalizedRegion) {
      return null;
    }

    return {
      region: normalizedRegion,
      projectGuid,
      modelGuid,
      openInUi: false,
      audit: false,
      worksets: {
        mode: "default",
      },
      cloudOpenConflictPolicy: "use_default",
    };
  }

  private normalizeRegion(value: string | null): "US" | "EMEA" | null {
    if (!value) {
      return null;
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === "US") {
      return "US";
    }

    if (normalized === "EU" || normalized === "EMEA") {
      return "EMEA";
    }

    return null;
  }
}
