import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient, ApiError } from '../services/apiClient.js';

const SessionContext = createContext();

/**
 * Gates the whole app on a live gateway session (MICROAPP_AUTH.md). Checks
 * GET /session once on mount; a 401 there already redirects the browser to
 * /auth/login (apiClient.js), so this component's only job while that's
 * in flight is to render nothing rather than flash the app's real content
 * to a signed-out visitor.
 */
export function SessionProvider({ children }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | redirecting

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get('/session')
      .then((data) => {
        if (!cancelled) {
          setSession(data);
          setStatus('ready');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 401) {
          setStatus('redirecting'); // apiClient already kicked off the redirect
          return;
        }
        throw error;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status !== 'ready') return null;

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
