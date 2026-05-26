import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Pencil, Plus, UserPlus, X } from "lucide-react";
import { TooltipButton } from "@/components/TooltipButton";
import { api } from "@/api/client";

type Tab = "users" | "data-areas";

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300"
    />
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.admin.users.list(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  const startEdit = (u: NonNullable<typeof users>[number]) => {
    setEditingId(u.id);
    setForm({ firstName: u.firstName ?? "", lastName: u.lastName ?? "", email: u.email });
  };

  const save = async (id: number) => {
    try {
      await api.admin.users.update(id, form);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch { /* ignore */ }
  };

  if (isLoading) return <div className="p-4 text-slate-400">Загрузка...</div>;

  return (
    <div className="space-y-2">
      {users?.map((u) => (
        <div key={u.id} className="flex items-center gap-3 rounded border bg-white p-3 text-sm">
          {editingId === u.id ? (
            <>
              <input className="w-24 rounded border px-2 py-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <input className="w-24 rounded border px-2 py-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              <input className="w-40 rounded border px-2 py-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <TooltipButton label="Сохранить" onClick={() => save(u.id)} className="rounded bg-green-600 p-1.5 text-white">
                <Check size={14} />
              </TooltipButton>
              <TooltipButton label="Отмена" onClick={() => setEditingId(null)} className="rounded border p-1.5">
                <X size={14} />
              </TooltipButton>
            </>
          ) : (
            <>
              <span className="w-8 text-slate-400">#{u.id}</span>
              <span className="w-24 font-medium">{u.firstName} {u.lastName}</span>
              <span className="w-20 text-slate-500">{u.login}</span>
              <span className="w-40 text-slate-500">{u.email}</span>
              <span className={`text-xs ${u.isActive ? "text-green-600" : "text-red-500"}`}>
                {u.isActive ? "активен" : "заблокирован"}
              </span>
              <TooltipButton label="Редактировать" onClick={() => startEdit(u)} className="ml-auto rounded border p-1.5 hover:bg-slate-50">
                <Pencil size={14} />
              </TooltipButton>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function DataAreasTab() {
  const { data: areas } = useQuery({
    queryKey: ["admin", "data-areas"],
    queryFn: () => api.admin.dataAreas.list(),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {areas?.map((a) => (
        <div key={a.id} className="rounded border bg-white p-3">
          <button
            onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
            className="flex w-full items-center gap-3 text-sm"
          >
            <span className="w-8 text-slate-400">#{a.id}</span>
            <span className="font-medium">{a.name}</span>
            {a.isPersonal && <span className="text-xs text-amber-600">личная</span>}
            {a.description && <span className="text-xs text-slate-400">{a.description}</span>}
          </button>

          {expandedId === a.id && <AreaUsersList dataAreaId={a.id} />}
        </div>
      ))}
    </div>
  );
}

function AreaUsersList({ dataAreaId }: { dataAreaId: number }) {
  const qc = useQueryClient();
  const { data: permissions } = useQuery({
    queryKey: ["admin", "data-areas", dataAreaId, "users"],
    queryFn: () => api.admin.dataAreas.users(dataAreaId),
  });

  const { data: allUsers } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.admin.users.list(),
  });

  const [adding, setAdding] = useState(false);
  const [newUserId, setNewUserId] = useState<number | null>(null);

  const existingUserIds = new Set(permissions?.map((p) => p.userId) ?? []);
  const availableUsers = allUsers?.filter((u) => !existingUserIds.has(u.id)) ?? [];

  const setPerm = async (userId: number, perms: { canCreate?: boolean; canRead?: boolean; canUpdate?: boolean; canDelete?: boolean }) => {
    const current = permissions?.find((p) => p.userId === userId);
    try {
      await api.admin.userDataArea.set({
        userId,
        dataAreaId,
        canCreate: perms.canCreate ?? current?.canCreate ?? false,
        canRead: perms.canRead ?? current?.canRead ?? false,
        canUpdate: perms.canUpdate ?? current?.canUpdate ?? false,
        canDelete: perms.canDelete ?? current?.canDelete ?? false,
      });
      qc.invalidateQueries({ queryKey: ["admin", "data-areas", dataAreaId, "users"] });
    } catch { /* ignore */ }
  };

  const removeUser = async (userId: number) => {
    try {
      await api.admin.userDataArea.remove(userId, dataAreaId);
      qc.invalidateQueries({ queryKey: ["admin", "data-areas", dataAreaId, "users"] });
    } catch { /* ignore */ }
  };

  const addUser = async () => {
    if (!newUserId) return;
    await setPerm(newUserId, { canRead: true, canCreate: false, canUpdate: false, canDelete: false });
    setNewUserId(null);
    setAdding(false);
  };

  return (
    <div className="mt-2 border-t pt-2">
      {(!permissions || permissions.length === 0) && (
        <p className="mb-2 text-xs text-slate-400">Нет пользователей с доступом</p>
      )}

      {permissions?.map((u) => (
        <div key={u.userId} className="flex items-center gap-4 py-1 text-xs">
          <span className="w-24">{u.userLogin}</span>
          <label className="flex items-center gap-1">
            <Checkbox checked={u.canRead} onChange={(v) => setPerm(u.userId, { canRead: v })} /> Read
          </label>
          <label className="flex items-center gap-1">
            <Checkbox checked={u.canCreate} onChange={(v) => setPerm(u.userId, { canCreate: v })} /> Create
          </label>
          <label className="flex items-center gap-1">
            <Checkbox checked={u.canUpdate} onChange={(v) => setPerm(u.userId, { canUpdate: v })} /> Update
          </label>
          <label className="flex items-center gap-1">
            <Checkbox checked={u.canDelete} onChange={(v) => setPerm(u.userId, { canDelete: v })} /> Delete
          </label>
          <button
            onClick={() => removeUser(u.userId)}
            className="ml-auto rounded border border-red-200 px-2 py-0.5 text-red-500 hover:bg-red-50"
            title="Удалить доступ"
          >
            ✕
          </button>
        </div>
      ))}

      {adding ? (
        <div className="mt-2 flex items-center gap-2 border-t pt-2">
          <select
            value={newUserId ?? ""}
            onChange={(e) => setNewUserId(Number(e.target.value))}
            className="rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">Выберите пользователя...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName} ({u.login})
              </option>
            ))}
          </select>
          <TooltipButton
            label="Добавить"
            onClick={addUser}
            disabled={!newUserId}
            className="rounded bg-blue-600 p-1.5 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Plus size={14} />
          </TooltipButton>
          <TooltipButton
            label="Отмена"
            onClick={() => { setAdding(false); setNewUserId(null); }}
            className="rounded border p-1.5"
          >
            <X size={14} />
          </TooltipButton>
        </div>
      ) : (
        <TooltipButton
          label="Добавить пользователя"
          onClick={() => setAdding(true)}
          className="mt-2 rounded p-1 text-blue-600 hover:bg-blue-50"
        >
          <UserPlus size={14} />
        </TooltipButton>
      )}
    </div>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");

  const tabs: { key: Tab; label: string }[] = [
    { key: "users", label: "Пользователи" },
    { key: "data-areas", label: "Области данных" },
  ];

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <TooltipButton
          label="На главную"
          onClick={() => navigate("/")}
          className="mb-4 rounded p-1 text-blue-600 hover:bg-blue-50"
        >
          <ArrowLeft size={20} />
        </TooltipButton>

        <h1 className="mb-6 text-2xl font-bold">Администрирование</h1>

        <div className="mb-4 flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-t px-4 py-2 text-sm font-medium ${
                tab === t.key
                  ? "bg-white text-blue-600 shadow-sm"
                  : "bg-slate-200 text-slate-500 hover:bg-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="rounded-b-lg bg-white p-4 shadow-sm">
          {tab === "users" ? <UsersTab /> : <DataAreasTab />}
        </div>
      </div>
    </div>
  );
}
