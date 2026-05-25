import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [form, setForm] = useState({
    login: "",
    email: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [error, setError] = useState("");

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }
    if (form.password.length < 4) {
      setError("Пароль должен быть минимум 4 символа");
      return;
    }
    if (!form.email.includes("@")) {
      setError("Некорректный email");
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          login: form.login,
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка регистрации");
        return;
      }
      setAuth(data.token, data.user, data.currentDataAreaId);
      navigate("/");
    } catch {
      setError("Ошибка сети");
    }
  };

  const inputClass = "w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Регистрация</h1>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Логин</label>
          <input type="text" value={form.login} onChange={(e) => update("login", e.target.value)} className={inputClass} required />
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={inputClass} required />
        </div>

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Имя</label>
            <input type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} required />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Фамилия</label>
            <input type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} required />
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">Пароль</label>
          <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)} className={inputClass} required minLength={4} />
        </div>

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-700">Подтверждение пароля</label>
          <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} className={inputClass} required />
        </div>

        <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Зарегистрироваться
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Уже есть аккаунт?{" "}
          <Link to="/login" className="text-blue-600 hover:underline">
            Войти
          </Link>
        </p>
      </form>
    </div>
  );
}
