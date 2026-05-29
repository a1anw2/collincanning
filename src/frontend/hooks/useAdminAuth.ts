/** Admin auth state backed by sessionStorage + Basic Auth header. */

import { useCallback, useEffect, useState } from 'react';
import {
  checkAdminAuth,
  clearAdminCredentials,
  getAdminAuthHeader,
  setAdminCredentials,
} from '@/lib/adminApi';

export function useAdminAuth(): {
  ok: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasStoredCredentials: boolean;
} {
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(true);

  const verify = useCallback(async (): Promise<boolean> => {
    if (!getAdminAuthHeader()) {
      setOk(false);
      return false;
    }
    const valid = await checkAdminAuth();
    setOk(valid);
    if (!valid) clearAdminCredentials();
    return valid;
  }, []);

  useEffect(() => {
    void verify().finally(() => setLoading(false));
  }, [verify]);

  const login = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setAdminCredentials(username, password);
      setLoading(true);
      const valid = await verify();
      setLoading(false);
      return valid;
    },
    [verify],
  );

  const logout = useCallback((): void => {
    clearAdminCredentials();
    setOk(false);
  }, []);

  return {
    ok,
    loading,
    login,
    logout,
    hasStoredCredentials: !!getAdminAuthHeader(),
  };
}
