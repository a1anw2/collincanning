/** Redirects / to the company #general channel. */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_WORKSPACE_ID } from '@shared/constants';

export function HomeRedirect(): React.ReactElement {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/w/${DEFAULT_WORKSPACE_ID}`, { replace: true });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-slack-surface text-slack-text">
      Loading…
    </div>
  );
}
