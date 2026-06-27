import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Pencil, Plus, Save, Search, UserPlus, X } from "lucide-react";
import { TooltipButton } from "@/components/TooltipButton";
import { api } from "@/api/client";
import type { CreateUserRequest } from "@timeline/shared";

type Tab = "users" | "data-areas" | "smtp";

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

  const { data: allAreas = [] } = useQuery({
    queryKey: ["admin", "data-areas"],
    queryFn: () => api.admin.dataAreas.list(),
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchField, setSearchField] = useState<"lastName" | "firstName" | "email" | "login">("lastName");
  const [userAreaIds, setUserAreaIds] = useState<number[]>([]);

  const startEdit = async (u: NonNullable<typeof users>[number]) => {
    setEditingId(u.id);
    setForm({ firstName: u.firstName ?? "", lastName: u.lastName ?? "", email: u.email, aiQuotaTotal: String(u.aiQuotaTotal ?? 10) });
    try {
      const ids = await api.admin.users.dataAreas(u.id);
      setUserAreaIds(ids);
    } catch {
      setUserAreaIds([]);
    }
  };

  const save = async (id: number) => {
    try {
      const body = { ...form, aiQuotaTotal: Number(form.aiQuotaTotal) || 10 };
      await api.admin.users.update(id, body);

      const current = userAreaIds;
      const prev = await api.admin.users.dataAreas(id);

      const toAdd = current.filter((aid) => !prev.includes(aid));
      const toRemove = prev.filter((aid) => !current.includes(aid));

      for (const areaId of toAdd) {
        await api.admin.userDataArea.set({ userId: id, dataAreaId: areaId, canCreate: true, canRead: true, canUpdate: true, canDelete: true });
      }
      for (const areaId of toRemove) {
        await api.admin.userDataArea.remove(id, areaId);
      }

      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "data-areas"] });
    } catch { /* ignore */ }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setUserAreaIds([]);
  };

  if (isLoading) return <div className="p-4 text-slate-400">Загрузка...</div>;

  const fieldLabels: Record<string, string> = {
    lastName: "Фамилии",
    firstName: "Имени",
    email: "Email",
    login: "Логину",
  };

  const filtered = (users ?? []).filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const val = u[searchField] ?? "";
    return val.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Пользователи</span>
        <TooltipButton label="Создать пользователя" onClick={() => setShowCreate(true)} className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-slate-300 hover:bg-slate-50">
          <Plus size={18} />
        </TooltipButton>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-xs"
          value={searchField}
          onChange={(e) => setSearchField(e.target.value as typeof searchField)}
        >
          {Object.entries(fieldLabels).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      <CreateUserDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {filtered.map((u) => (
        <div key={u.id} className="flex items-center gap-3 rounded border bg-white p-3 text-sm">
          {editingId === u.id ? (
            <div className="flex w-full flex-col gap-2">
              <div className="flex items-center gap-3">
                <input className="w-24 rounded border px-2 py-1" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                <input className="w-24 rounded border px-2 py-1" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                <input className="w-40 rounded border px-2 py-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  AI-квота
                  <input className="w-16 rounded border px-2 py-1 text-xs" type="number" min={0} value={form.aiQuotaTotal ?? "10"} onChange={(e) => setForm({ ...form, aiQuotaTotal: e.target.value })} />
                </label>
                <TooltipButton label="Сохранить" onClick={() => save(u.id)} className="rounded bg-green-600 p-1.5 text-white">
                  <Check size={14} />
                </TooltipButton>
              </div>
              <div className="border-t pt-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="mb-1 block text-xs font-medium text-slate-500">Области данных</span>
                    <div className="flex flex-wrap gap-3">
                      {allAreas.filter((a) => !a.isPersonal).map((a) => {
                        const checked = userAreaIds.includes(a.id);
                        return (
                          <label key={a.id} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              className="rounded border-slate-300"
                              checked={checked}
                              onChange={() => {
                                setUserAreaIds((prev) =>
                                  checked ? prev.filter((id) => id !== a.id) : [...prev, a.id],
                                );
                              }}
                            />
                            {a.name}
                          </label>
                        );
                      })}
                      {allAreas.filter((a) => !a.isPersonal).length === 0 && (
                        <span className="text-xs text-slate-400">Нет доступных областей</span>
                      )}
                    </div>
                  </div>
                  <TooltipButton label="Отмена" onClick={cancelEdit} className="shrink-0 rounded border p-1.5">
                    <X size={14} />
                  </TooltipButton>
                </div>
              </div>
            </div>
          ) : (
            <>
              <span className="w-8 shrink-0 text-slate-400">#{u.id}</span>
              <span className="w-24 shrink-0 font-medium">{u.firstName} {u.lastName}</span>
              <span className="w-20 shrink-0 text-slate-500">{u.login}</span>
              <span className="w-36 shrink-0 truncate text-slate-500">{u.email}</span>
              <span className="shrink-0 text-xs text-violet-600" title="AI-квота">
                AI {u.aiQuotaUsed ?? 0}/{u.aiQuotaTotal ?? 10}
              </span>
              <span className={`ml-auto shrink-0 text-xs ${u.isActive ? "text-green-600" : "text-red-500"}`}>
                {u.isActive ? "активен" : "заблокирован"}
              </span>
              <TooltipButton label="Редактировать" onClick={() => startEdit(u)} className="shrink-0 rounded border p-1.5 hover:bg-slate-50">
                <Pencil size={14} />
              </TooltipButton>
            </>
          )}
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="py-4 text-center text-xs text-slate-400">Нет совпадений</p>
      )}
    </div>
  );
}

function CreateUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [nextCode, setNextCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      api.admin.nextUserCode().then((r) => setNextCode(r.code)).catch(() => {});
    }
  }, [open]);

  const createMut = useMutation({
    mutationFn: (body: CreateUserRequest) => api.admin.users.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "data-areas"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const handleSubmit = () => {
    setError("");
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      setError("Заполните все обязательные поля");
      return;
    }
    if (password !== confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    createMut.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      password,
    });
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-24 z-50 w-[420px] max-w-[90vw] -translate-x-1/2 rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold">Создание пользователя</h2>
          <TooltipButton label="Закрыть" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </TooltipButton>
        </div>

        <div className="space-y-3 p-4">
          {error && (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</div>
          )}

          <label className="block text-sm">
            Код пользователя
            <input className="mt-1 w-full rounded border bg-slate-50 px-2 py-1 text-sm text-slate-500" value={nextCode} readOnly />
          </label>

          <div className="flex gap-3">
            <label className="block flex-1 text-sm">
              Фамилия
              <input className="mt-1 w-full rounded border px-2 py-1" value={lastName} onChange={(e) => setLastName(e.target.value)} autoFocus />
            </label>
            <label className="block flex-1 text-sm">
              Имя
              <input className="mt-1 w-full rounded border px-2 py-1" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
          </div>

          <label className="block text-sm">
            Email
            <input className="mt-1 w-full rounded border px-2 py-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>

          <div className="flex gap-3">
            <label className="block flex-1 text-sm">
              Пароль
              <input className="mt-1 w-full rounded border px-2 py-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label className="block flex-1 text-sm">
              Подтверждение
              <input className="mt-1 w-full rounded border px-2 py-1" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
          </div>

        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <TooltipButton
            label="Создать"
            onClick={handleSubmit}
            disabled={createMut.isPending}
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
          >
            <Save size={18} />
          </TooltipButton>
          <TooltipButton label="Отмена" onClick={onClose} className="rounded border px-3 py-1">
            <X size={18} />
          </TooltipButton>
        </div>
      </div>
    </>
  );
}

function CreateAreaDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const createMut = useMutation({
    mutationFn: () => api.admin.dataAreas.create({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "data-areas"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed left-1/2 top-24 z-50 w-[400px] max-w-[90vw] -translate-x-1/2 rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold">Создание области данных</h2>
          <TooltipButton label="Закрыть" onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={16} />
          </TooltipButton>
        </div>

        <div className="space-y-3 p-4">
          {error && <div className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</div>}
          <label className="block text-sm">
            Название
            <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="block text-sm">
            Описание
            <input className="mt-1 w-full rounded border px-2 py-1" value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
          <TooltipButton
            label="Создать"
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
          >
            <Save size={18} />
          </TooltipButton>
          <TooltipButton label="Отмена" onClick={onClose} className="rounded border px-3 py-1">
            <X size={18} />
          </TooltipButton>
        </div>
      </div>
    </>
  );
}

function DataAreasTab() {
  const qc = useQueryClient();
  const { data: areas } = useQuery({
    queryKey: ["admin", "data-areas"],
    queryFn: () => api.admin.dataAreas.list(),
  });

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const updateMut = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => api.admin.dataAreas.update(id, { name }),
    onSuccess: () => {
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "data-areas"] });
    },
    onError: (e: Error) => alert("Ошибка: " + e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.admin.dataAreas.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "data-areas"] }),
    onError: (e: Error) => alert("Ошибка: " + e.message),
  });

  const filtered = (areas ?? []).filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.description ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">Области данных</span>
        <TooltipButton label="Создать область" onClick={() => setShowCreate(true)} className="flex h-9 w-9 items-center justify-center rounded border border-dashed border-slate-300 hover:bg-slate-50">
          <Plus size={18} />
        </TooltipButton>
      </div>

      <div className="relative flex-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded border border-slate-300 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-400"
          placeholder="Поиск по названию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <CreateAreaDialog open={showCreate} onClose={() => setShowCreate(false)} />
      {filtered.map((a) => (
        <div key={a.id} className="rounded border bg-white p-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="w-8 shrink-0 text-slate-400">#{a.id}</span>
            {editingId === a.id ? (
              <div className="flex w-full items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    className="w-60 rounded border px-2 py-1 text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && editName.trim()) {
                        updateMut.mutate({ id: a.id, name: editName.trim() });
                      }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                  />
                  <TooltipButton label="Сохранить" onClick={() => updateMut.mutate({ id: a.id, name: editName.trim() })} disabled={!editName.trim()} className="rounded bg-green-600 p-1.5 text-white disabled:opacity-50">
                    <Check size={14} />
                  </TooltipButton>
                </div>
                <TooltipButton label="Отмена" onClick={() => setEditingId(null)} className="rounded border p-1.5">
                  <X size={14} />
                </TooltipButton>
              </div>
            ) : (
              <>
                <button
                  onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <span className="font-medium">{a.name}</span>
                  {a.isPersonal && <span className="text-xs text-amber-600">личная</span>}
                  {a.description && <span className="text-xs text-slate-400">{a.description}</span>}
                </button>
                {!a.isPersonal && (
                  <div className="flex shrink-0 items-center gap-1">
                    <TooltipButton label="Редактировать" onClick={() => { setEditingId(a.id); setEditName(a.name); }} className="rounded p-1.5 text-slate-500 hover:bg-slate-100">
                      <Pencil size={14} />
                    </TooltipButton>
                    <TooltipButton label="Удалить" onClick={() => { if (confirm(`Удалить область «${a.name}»?`)) deleteMut.mutate(a.id); }} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                      <X size={14} />
                    </TooltipButton>
                  </div>
                )}
              </>
            )}
          </div>

          {expandedId === a.id && <AreaUsersList dataAreaId={a.id} />}
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="py-4 text-center text-xs text-slate-400">Нет совпадений</p>
      )}
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

function SmtpTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => api.admin.settings.get(),
  });

  const settings = data?.settings ?? {};

  const [form, setForm] = useState({ SMTP_HOST: "", SMTP_PORT: "", SMTP_USER: "", SMTP_PASS: "", DEFAULT_AI_QUOTA: "", AI_SYSTEM_PROMPT: "", AI_USER_PROMPT_TEMPLATE: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({
        SMTP_HOST: typeof s.SMTP_HOST === "string" ? s.SMTP_HOST : "",
        SMTP_PORT: typeof s.SMTP_PORT === "string" ? s.SMTP_PORT : "",
        SMTP_USER: typeof s.SMTP_USER === "string" ? s.SMTP_USER : "",
        SMTP_PASS: "",
        DEFAULT_AI_QUOTA: typeof s.DEFAULT_AI_QUOTA === "string" ? s.DEFAULT_AI_QUOTA : "10",
        AI_SYSTEM_PROMPT: typeof s.AI_SYSTEM_PROMPT === "string" ? s.AI_SYSTEM_PROMPT : "",
        AI_USER_PROMPT_TEMPLATE: typeof s.AI_USER_PROMPT_TEMPLATE === "string" ? s.AI_USER_PROMPT_TEMPLATE : "",
      });
    }
  }, [data]);

  const handleSave = async () => {
    setError("");
    setSaved(false);
    try {
      await api.admin.settings.put({
        SMTP_HOST: form.SMTP_HOST || null,
        SMTP_PORT: form.SMTP_PORT || null,
        SMTP_USER: form.SMTP_USER || null,
        SMTP_PASS: form.SMTP_PASS || null,
        DEFAULT_AI_QUOTA: form.DEFAULT_AI_QUOTA || null,
        AI_SYSTEM_PROMPT: form.AI_SYSTEM_PROMPT || null,
        AI_USER_PROMPT_TEMPLATE: form.AI_USER_PROMPT_TEMPLATE || null,
      });
      setSaved(true);
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка сохранения");
    }
  };

  const smtpConfigured = typeof settings.SMTP_HOST === "string" || (settings.SMTP_HOST as { configured?: boolean })?.configured;

  if (isLoading) return <div className="p-4 text-slate-400">Загрузка...</div>;

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-slate-500">
        SMTP / Почта {smtpConfigured ? <span className="text-green-600">(настроен)</span> : <span className="text-amber-600">(не настроен)</span>}
      </p>

      {error && (
        <div className="rounded bg-red-50 p-2 text-xs text-red-600">{error}</div>
      )}

      {saved && (
        <div className="rounded bg-green-50 p-2 text-xs text-green-700">Настройки сохранены</div>
      )}

      <label className="block text-sm">
        SMTP Хост
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          value={form.SMTP_HOST}
          onChange={(e) => setForm({ ...form, SMTP_HOST: e.target.value })}
          placeholder="smtp.yandex.ru"
        />
      </label>

      <label className="block text-sm">
        SMTP Порт
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          value={form.SMTP_PORT}
          onChange={(e) => setForm({ ...form, SMTP_PORT: e.target.value })}
          placeholder="465"
        />
      </label>

      <label className="block text-sm">
        SMTP Пользователь
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          value={form.SMTP_USER}
          onChange={(e) => setForm({ ...form, SMTP_USER: e.target.value })}
          placeholder="your-email@yandex.ru"
        />
      </label>

      <label className="block text-sm">
        SMTP Пароль (приложение)
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          type="password"
          value={form.SMTP_PASS}
          onChange={(e) => setForm({ ...form, SMTP_PASS: e.target.value })}
          placeholder={typeof settings.SMTP_PASS === "object" ? "••••••••" : ""}
        />
      </label>

      <hr className="border-slate-200" />
      <p className="text-xs font-medium text-slate-500">AI-справка (YandexGPT)</p>

      <label className="block text-sm">
        Квота AI по умолчанию для новых пользователей
        <input
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
          type="number"
          min={0}
          value={form.DEFAULT_AI_QUOTA}
          onChange={(e) => setForm({ ...form, DEFAULT_AI_QUOTA: e.target.value })}
          placeholder="10"
        />
      </label>

      <label className="block text-sm">
        System prompt (AI)
        <textarea
          className="mt-1 w-full rounded border px-2 py-1 text-xs"
          rows={3}
          value={form.AI_SYSTEM_PROMPT}
          onChange={(e) => setForm({ ...form, AI_SYSTEM_PROMPT: e.target.value })}
        />
      </label>

      <label className="block text-sm">
        Шаблон промпта пользователя (используйте {'{eventName}'} как placeholder)
        <textarea
          className="mt-1 w-full rounded border px-2 py-1 text-xs"
          rows={2}
          value={form.AI_USER_PROMPT_TEMPLATE}
          onChange={(e) => setForm({ ...form, AI_USER_PROMPT_TEMPLATE: e.target.value })}
        />
      </label>

      <TooltipButton
        label="Сохранить настройки"
        onClick={handleSave}
        className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        <Save size={16} className="mr-1 inline" /> Сохранить
      </TooltipButton>
    </div>
  );
}

export function AdminPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("users");

  const tabs: { key: Tab; label: string }[] = [
    { key: "users", label: "Пользователи" },
    { key: "data-areas", label: "Области данных" },
    { key: "smtp", label: "SMTP / Почта" },
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
          {tab === "users" ? <UsersTab /> : tab === "data-areas" ? <DataAreasTab /> : <SmtpTab />}
        </div>
      </div>
    </div>
  );
}
