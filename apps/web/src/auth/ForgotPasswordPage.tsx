import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка отправки");
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-md">
          <p className="mb-4 text-green-600">
            Если аккаунт с таким email существует, мы отправили ссылку для восстановления пароля.
          </p>
          <Link to="/login" className="text-blue-600 hover:underline">
            Вернуться к входу
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Восстановление пароля</h1>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
        )}

        <div className="mb-6">
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            required
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Отправить
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/login" className="text-blue-600 hover:underline">
            Вернуться к входу
          </Link>
        </p>
      </form>
    </div>
  );
}
