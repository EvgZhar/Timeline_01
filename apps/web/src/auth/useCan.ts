import { useAuth } from "./AuthContext";

type Action = "canRead" | "canCreate" | "canUpdate" | "canDelete";

export function useCan(dataAreaId: number | null | undefined, action: Action): boolean {
  const { settings } = useAuth();

  if (!dataAreaId || !settings) return true;
  const hasArea = settings.availableAreas.some((a) => a.id === dataAreaId);
  if (!hasArea) return false;

  // availableAreas only includes areas where user has canCreate
  // other permissions are derived from this for now
  switch (action) {
    case "canRead": return true;
    case "canCreate": return true;
    case "canUpdate": return true;
    case "canDelete": return true;
  }
}
