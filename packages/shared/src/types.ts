export interface UserDto {
  id: number;
  login: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  emailConfirmed: boolean;
  defaultDataAreaId: number;
  aiQuotaTotal?: number;
  aiQuotaUsed?: number;
  createdAt: string;
}

export interface AuthResponse {
  user: UserDto;
  currentDataAreaId: number;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  login: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  dataAreaName?: string;
}

export interface DataAreaDto {
  id: number;
  name: string;
  description: string | null;
  isPersonal: boolean;
  createdAt: string;
}

export interface UserDataAreaDto {
  userId: number;
  dataAreaId: number;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  dataAreaName?: string;
  userLogin?: string;
}

export interface AuthSettingsDto {
  currentDataAreaId: number;
  availableAreas: { id: number; name: string }[];
}

export interface TimelineDto {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  sortIndex: number;
  visible: boolean;
  dataAreaId?: number | null;
  createdDateTime: string;
}

export interface TagDto {
  id: number;
  name: string;
  color: number;
  previewUrl?: string;
  dataAreaId?: number | null;
  createdDateTime: string;
}

export interface DocumentDto {
  documentId: number;
  description: string;
  originalLink: string | null;
  storageLink: string | null;
  resourceType: string | null;
  isPrimary: boolean;
  previewUrl?: string;
  dataAreaId?: number | null;
  createdDateTime: string;
}

export type DependencyType = "part_of" | "contains" | "influences" | "influenced_by";

export function reverseDependencyType(t: DependencyType): DependencyType {
  switch (t) {
    case "part_of": return "contains";
    case "contains": return "part_of";
    case "influences": return "influenced_by";
    case "influenced_by": return "influences";
  }
}

export function dependencyTypeLabel(t: DependencyType, short?: boolean): string {
  if (short) {
    switch (t) {
      case "part_of": return "часть";
      case "contains": return "содержит";
      case "influences": return "влияет";
      case "influenced_by": return "подвержен";
    }
  }
  switch (t) {
    case "part_of": return "Является частью";
    case "contains": return "Содержит";
    case "influences": return "Влияет на";
    case "influenced_by": return "Подвержен влиянию";
  }
}

export interface EventDependencyDto {
  eventId: number;
  depEventId: number;
  dependencyType: DependencyType;
  createdDateTime: string;
  depEventName?: string;
}

export interface EventDto {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdDateTime: string;
  timelines: { id: number; name: string }[];
  tags: TagDto[];
  documents: DocumentDto[];
  dependencies: EventDependencyDto[];
  dataAreaId?: number | null;
}

export interface SettingsDto {
  settings: Record<string, string | null | { configured: true }>;
}

export interface OAuthCallbackResponse {
  code: string;
}

export interface ExchangeOAuthCodeResponse {
  ok: boolean;
  userId: number;
  login: string;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}


