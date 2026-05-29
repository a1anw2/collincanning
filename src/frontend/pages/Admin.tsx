/** Admin shell with navigation and login. */

import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export function Admin(): React.ReactElement {
  const { ok, loading, login, logout } = useAdminAuth();
  const loc = useLocation();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    const valid = await login(username, password);
    if (!valid) {
      setError('Invalid username or password.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#2c2d30] text-slack-text">
        Checking auth…
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#2c2d30] px-4 text-slack-text">
        <h1 className="text-xl font-bold text-white">Cannery Admin</h1>
        <p className="text-sm text-slack-text-dim">
          Sign in with the credentials from <code className="text-slack-text">data/.env</code>
          (<code className="text-slack-text">ADMIN_USER</code> /{' '}
          <code className="text-slack-text">ADMIN_PASSWORD</code>).
        </p>
        <form
          onSubmit={(e) => void handleLogin(e)}
          className="w-full max-w-sm space-y-4 rounded-lg border border-slack-border bg-slack-surface p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="admin-user">Username</Label>
            <Input
              id="admin-user"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-pass">Password</Label>
            <Input
              id="admin-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>
        <Link to="/" className="text-sm text-slack-active hover:underline">
          ← Back to viewer
        </Link>
      </div>
    );
  }

  const tabs = [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/personas', label: 'Personas' },
    { to: '/admin/sim', label: 'Sim Control' },
    { to: '/admin/usage', label: 'AI Usage' },
  ];

  return (
    <div className="min-h-screen bg-[#2c2d30] text-slack-text">
      <nav className="flex items-center gap-6 border-b border-slack-border px-6 py-4">
        <span className="font-bold text-white">Cannery Admin</span>
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            end={t.end}
            className={`text-sm ${
              loc.pathname === t.to || (t.end && loc.pathname === '/admin')
                ? 'text-white font-medium'
                : 'text-slack-text-dim hover:text-white'
            }`}
          >
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={logout}
          className="ml-auto text-sm text-slack-text-dim hover:text-white"
        >
          Sign out
        </button>
        <Link to="/" className="text-sm text-slack-active hover:underline">
          ← Viewer
        </Link>
      </nav>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
