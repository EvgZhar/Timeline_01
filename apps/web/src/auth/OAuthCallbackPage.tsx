import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "./AuthContext";

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setAuth } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      setError("Отсутствует код авторизации");
      return;
    }

    api.auth
      .exchangeOAuthCode(code)
      .then(async () => {
        const [user, settings] = await Promise.all([api.auth.me(), api.auth.getSettings()]);
        setAuth(user, settings.currentDataAreaId);
        navigate("/");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Ошибка авторизации");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-md">
        {error ? (
          <>
            <p className="mb-4 text-red-600">{error}</p>
            <button
              onClick={() => navigate("/login")}
              className="text-blue-600 hover:underline"
            >
              Вернуться к входу
            </button>
          </>
        ) : (
          <p className="text-slate-600">Выполняется вход...</p>
        )}
      </div>
    </div>
  );
}
