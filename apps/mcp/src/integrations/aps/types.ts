export interface ApsCachedToken {
  accessToken: string;
  tokenType: string;
  expiresAtMs: number;
  scope: string;
  accountContext: string | null;
  userContext: string | null;
}

export interface ApsProjectSummary {
  id: string;
  name: string;
  hubId: string;
  hubName: string;
  region: string | null;
  projectType: string | null;
}

export interface ApsFolderSummary {
  id: string;
  name: string;
  displayName: string;
  type: string;
  extensionType: string | null;
}

export interface ApsFolderEntry {
  id: string;
  type: string;
  name: string;
  displayName: string;
  extensionType: string | null;
  mimeType: string | null;
  itemId: string | null;
  tipVersionId: string | null;
  lastModifiedTime: string | null;
}

export interface ApsItemSummary {
  id: string;
  displayName: string;
  sourceFileName: string | null;
  tipVersionId: string | null;
  originalItemUrn: string | null;
}

export interface ApsVersionSummary {
  id: string;
  displayName: string;
  sourceFileName: string | null;
  versionNumber: number | null;
  extensionType: string | null;
  lastModifiedTime: string | null;
  originalItemUrn: string | null;
  extensionData?: Record<string, unknown>;
}

export interface PreparedRevitOpenCloudModelPayload {
  region: "US" | "EMEA";
  projectGuid: string;
  modelGuid: string;
  openInUi: boolean;
  audit: boolean;
  worksets: {
    mode: "default" | "open_all" | "close_all" | "open_last_viewed";
  };
  cloudOpenConflictPolicy:
    | "use_default"
    | "discard_local_changes_and_open_latest_version"
    | "keep_local_changes"
    | "detach_from_central"
    | "cancel";
}

export interface ApsCloudModelInfo {
  isCloudModel: boolean;
  reason?: string;
  projectId: string;
  projectName: string | null;
  itemId: string;
  versionId: string | null;
  displayName: string | null;
  sourceFileName: string | null;
  region: string | null;
  projectGuid: string | null;
  modelGuid: string | null;
  versionExtensionType: string | null;
  originalItemUrn: string | null;
  lookupSource: "aps-data-management";
  accountContext: string | null;
  userContext: string | null;
  openCloudModelRequest: PreparedRevitOpenCloudModelPayload | null;
}
