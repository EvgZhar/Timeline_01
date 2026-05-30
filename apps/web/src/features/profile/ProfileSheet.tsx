import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";
import { Check, LogOut, Shield } from "lucide-react";
import { TooltipButton } from "@/components/TooltipButton";
import { useAuth } from "@/auth/AuthContext";
import { useNavigate } from "react-router-dom";

interface ProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSheet({ open, onOpenChange }: ProfileSheetProps) {
  const { user, isAdmin, logout, settings, currentDataAreaId, setCurrentDataAreaId } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Reset form when sheet opens
  const resetForm = () => {
    setFirstName(user?.firstName ?? "");
    setLastName(user?.lastName ?? "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setProfileError("");
    setPasswordError("");
    setProfileSuccess(false);
    setPasswordSuccess(false);
  };

  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const updateProfileMut = useMutation({
    mutationFn: (body: { firstName?: string; lastName?: string }) =>
      api.auth.updateProfile(body),
    onSuccess: () => {
      setProfileSuccess(true);
      setProfileError("");
      setTimeout(() => setProfileSuccess(false), 3000);
      qc.invalidateQueries({ queryKey: ["auth"] });
    },
    onError: (err: Error) => {
      setProfileError(err.message);
      setProfileSuccess(false);
    },
  });

  const changePasswordMut = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.auth.changePassword(body),
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setPasswordError(err.message);
      setPasswordSuccess(false);
    },
  });

  const handleSaveProfile = () => {
    setProfileError("");
    const body: { firstName?: string; lastName?: string } = {};
    if (firstName !== (user?.firstName ?? "")) body.firstName = firstName;
    if (lastName !== (user?.lastName ?? "")) body.lastName = lastName;
    if (Object.keys(body).length === 0) {
      setProfileError("Нет изменений");
      return;
    }
    updateProfileMut.mutate(body);
  };

  const handleChangePassword = () => {
    setPasswordError("");
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Заполните все поля");
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError("Новый пароль: минимум 4 символа");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Новые пароли не совпадают");
      return;
    }
    changePasswordMut.mutate({ currentPassword, newPassword });
  };

  const handleAreaChange = async (areaId: number) => {
    try {
      await api.auth.putSettings({ currentDataAreaId: areaId });
      setCurrentDataAreaId(areaId);
    } catch { /* ignore */ }
  };

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() || user.login[0].toUpperCase()
    : "?";

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }} side="right" title="Личный кабинет">
      <div className="space-y-6">
        {/* User info header */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
            {initials}
          </div>
          <div>
            <div className="font-medium">{user?.firstName} {user?.lastName}</div>
            <div className="text-xs text-slate-500">{user?.login}</div>
            <div className="text-xs text-slate-400">{user?.email}</div>
          </div>
        </div>

        {/* Profile info / edit */}
        <section className="space-y-3">
          <h3 className="font-medium">Профиль</h3>

          <div className="text-xs text-slate-500">Логин: <span className="text-slate-700">{user?.login}</span></div>
          <div className="text-xs text-slate-500">
            Email: <span className="text-slate-700">{user?.email}</span>
            {user?.emailConfirmed
              ? <span className="ml-1 text-green-600">(подтверждён)</span>
              : <span className="ml-1 text-amber-600">(не подтверждён)</span>
            }
          </div>

          <div className="flex gap-2">
            <label className="block flex-1 text-sm">
              Имя
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block flex-1 text-sm">
              Фамилия
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
          </div>

          {profileError && (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">{profileError}</div>
          )}
          {profileSuccess && (
            <div className="rounded bg-green-50 p-2 text-xs text-green-600">Профиль сохранён</div>
          )}

          <TooltipButton
            label="Сохранить профиль"
            onClick={handleSaveProfile}
            disabled={updateProfileMut.isPending}
            className="self-start rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            <Check size={16} />
          </TooltipButton>
        </section>

        {/* Data area selector */}
        {settings && settings.availableAreas.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-medium">Область данных</h3>
            <select
              value={currentDataAreaId ?? ""}
              onChange={(e) => handleAreaChange(Number(e.target.value))}
              className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-sm"
            >
              {settings.availableAreas.map((area) => (
                <option key={area.id} value={area.id}>{area.name}</option>
              ))}
            </select>
          </section>
        )}

        {/* Change password */}
        <section className="space-y-3">
          <h3 className="font-medium">Смена пароля</h3>

          <div className="space-y-2">
            <label className="block text-sm">
              Текущий пароль
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Новый пароль
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm">
              Подтверждение
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-sm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>
          </div>

          {passwordError && (
            <div className="rounded bg-red-50 p-2 text-xs text-red-600">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="rounded bg-green-50 p-2 text-xs text-green-600">Пароль изменён</div>
          )}

          <TooltipButton
            label="Сменить пароль"
            onClick={handleChangePassword}
            disabled={changePasswordMut.isPending}
            className="self-start rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            <Check size={16} />
          </TooltipButton>
        </section>

        {/* Separator */}
        <hr className="border-slate-200" />

        {/* Actions */}
        <div className="space-y-2">
          {isAdmin && (
            <TooltipButton
              label="Администрирование"
              onClick={() => { onOpenChange(false); navigate("/admin"); }}
              className="flex w-full items-center gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700 hover:bg-amber-100"
            >
              <Shield size={16} />
              Администрирование
            </TooltipButton>
          )}

          <TooltipButton
            label="Выйти"
            onClick={async () => {
              await logout();
              navigate("/login");
            }}
            className="flex w-full items-center gap-2 rounded border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={16} />
            Выйти
          </TooltipButton>
        </div>
      </div>
    </Sheet>
  );
}
