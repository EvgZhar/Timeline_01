import { useAuth } from "./AuthContext";

type Action = "canRead" | "canCreate" | "canUpdate" | "canDelete";

export function useCan(dataAreaId: number | null | undefined, action: Action): boolean {
  const { settings } = useAuth();

  if (!dataAreaId || !settings) return true;
  const perm = settings.availableAreas.find((a) => a.id === dataAreaId);
  if (!perm) return false;

  switch (action) {
    case "canRead": return true;
    case "canCreate": return perm.canCreate;
    case "canUpdate": return perm.canCreate;
    case "canDelete": return perm.canCreate;
  }
}
