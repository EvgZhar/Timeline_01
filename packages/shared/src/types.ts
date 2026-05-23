export interface TimelineDto {
  id: number;
  name: string;
  description: string | null;
  iconUrl: string | null;
  sortIndex: number;
  visible: boolean;
  createdDateTime: string;
}

export interface TagDto {
  id: number;
  name: string;
  color: number;
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
}

export interface SettingsDto {
  settings: Record<string, string | null | { configured: true }>;
}

export interface YandexStatusDto {
  configured: boolean;
  baseFolder: string;
}
