import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../api/client";

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Отсутствует токен подтверждения");
      return;
    }

    api.auth
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Email успешно подтверждён!");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Ошибка подтверждения email");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow-md">
        {status === "loading" && <p className="text-slate-600">Подтверждение email...</p>}

        {status === "success" && (
          <>
            <p className="mb-4 text-green-600">{message}</p>
            <Link to="/login" className="text-blue-600 hover:underline">
              Войти
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <p className="mb-4 text-red-600">{message}</p>
            <Link to="/login" className="text-blue-600 hover:underline">
              На страницу входа
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
