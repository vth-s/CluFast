import { useState } from "react";
import { useAuthStore } from "../stores/auth-store.js";
import { useDataStore } from "../stores/data-store.js";
import { api } from "../lib/api.js";

export function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const fetchServers = useDataStore((s) => s.fetchServers);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegister) {
        const { user, token } = await api.register({
          username,
          email,
          password,
        });
        login(user, token);
        fetchServers(token);
      } else {
        const { user, token } = await api.login({ email, password });
        login(user, token);
        fetchServers(token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full items-center justify-center bg-zinc-900">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-800 p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            CordFast
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {isRegister
              ? "Create an account to get started"
              : "Welcome back! Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-zinc-700 transition-shadow focus:ring-2 focus:ring-indigo-500"
                placeholder="Choose a username"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-zinc-700 transition-shadow focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-zinc-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none ring-1 ring-zinc-700 transition-shadow focus:ring-2 focus:ring-indigo-500"
              placeholder="Min. 6 characters"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : isRegister
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-zinc-500">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError("");
            }}
            className="font-semibold text-indigo-400 transition-colors hover:text-indigo-300"
          >
            {isRegister ? "Sign In" : "Register"}
          </button>
        </p>
      </div>
    </div>
  );
}
