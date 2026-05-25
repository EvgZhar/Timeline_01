import { Routes, Route } from "react-router-dom";
import { LoginPage } from "./auth/LoginPage";
import { RegisterPage } from "./auth/RegisterPage";
import { AuthGuard } from "./auth/AuthGuard";
import { TimelineApp } from "./TimelineApp";
import { AdminPage } from "./admin/AdminPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
