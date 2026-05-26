export interface UserDto {
  id: number;
  login: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  emailConfirmed: boolean;
  defaultDataAreaId: number;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
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
  dataAreaId?: number | null;
}

export interface SettingsDto {
  settings: Record<string, string | null | { configured: true }>;
}

export interface OAuthCallbackResponse {
  code: string;
}

export interface ExchangeOAuthCodeResponse {
  token: string;
  userId: number;
  login: string;
}


