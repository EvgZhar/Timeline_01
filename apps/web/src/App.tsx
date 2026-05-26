import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./auth/LoginPage";
import { RegisterPage } from "./auth/RegisterPage";
import { AuthGuard } from "./auth/AuthGuard";
import { TimelineApp } from "./TimelineApp";
import { AdminPage } from "./admin/AdminPage";
import { VerifyEmailPage } from "./auth/VerifyEmailPage";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { OAuthCallbackPage } from "./auth/OAuthCallbackPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/admin"
        element={
          <AuthGuard>
            <AdminPage />
          </AuthGuard>
        }
      />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <TimelineApp />
          </AuthGuard>
        }
      />
    </Routes>
  );
}
