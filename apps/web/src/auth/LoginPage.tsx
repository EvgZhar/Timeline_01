import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "./AuthContext";

const OAUTH_PROVIDERS = [
  { id: "yandex", label: "Яндекс", color: "bg-yellow-400 hover:bg-yellow-500 text-black" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }
      setAuth(data.token, data.user, data.currentDataAreaId);
      navigate("/");
    } catch {
      setError("Ошибка сети");
    }
  };

  const handleOAuth = (provider: string) => {
    window.location.href = `/api/auth/oauth/${provider}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Вход</h1>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-slate-700">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Войти
          </button>
        </form>

        <div className="mt-2 text-right">
          <Link to="/forgot-password" className="text-sm text-slate-500 hover:text-blue-600 hover:underline">
            Забыли пароль?
          </Link>
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-sm text-slate-400">или</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="flex flex-col gap-2">
          {OAUTH_PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleOAuth(p.id)}
              className={`rounded px-4 py-2 text-sm font-medium ${p.color}`}
            >
              Войти через {p.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-center text-sm text-slate-500">
          Нет аккаунта?{" "}
          <Link to="/register" className="text-blue-600 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
