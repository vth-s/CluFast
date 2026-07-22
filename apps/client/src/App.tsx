import { useEffect } from "react";
import { useAuthStore } from "./stores/auth-store.js";
import { useDataStore } from "./stores/data-store.js";
import { AuthScreen } from "./components/AuthScreen.js";
import { MainLayout } from "./components/MainLayout.js";
import { api } from "./lib/api.js";

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setUser = useAuthStore((s) => s.setUser);
  const fetchServers = useDataStore((s) => s.fetchServers);

  useEffect(() => {
    if (token && !user) {
      api
        .getMe(token)
        .then(({ user }) => {
          setUser(user);
          fetchServers(token);
        })
        .catch(() => {
          useAuthStore.getState().logout();
        });
    }
  }, [token, user, setUser, fetchServers]);

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-900">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-indigo-500" />
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return <MainLayout />;
}
