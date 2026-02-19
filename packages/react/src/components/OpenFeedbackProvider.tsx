import { createContext, useContext, useMemo } from "react";
import { OpenFeedbackClient } from "@openfeedback/client";
import type { OpenFeedbackConfig, AuthContext } from "../types";

interface OpenFeedbackContextValue {
  config: OpenFeedbackConfig;
  client: OpenFeedbackClient;
  authContext: AuthContext | null;
}

const OpenFeedbackContext = createContext<OpenFeedbackContextValue | null>(null);

export function useOpenFeedback(): OpenFeedbackContextValue {
  const context = useContext(OpenFeedbackContext);
  if (!context) {
    throw new Error(
      "useOpenFeedback must be used within an <OpenFeedbackProvider>",
    );
  }
  return context;
}

interface ProviderProps {
  config: OpenFeedbackConfig;
  /** Supabase anon key — required for public read queries via PostgREST */
  anonKey: string;
  authContext?: AuthContext;
  children: React.ReactNode;
}

export function OpenFeedbackProvider({
  config,
  anonKey,
  authContext,
  children,
}: ProviderProps): React.JSX.Element {
  const client = useMemo(
    () =>
      new OpenFeedbackClient({
        apiUrl: config.apiUrl,
        anonKey,
        projectId: config.projectId,
      }),
    [config.apiUrl, config.projectId, anonKey],
  );

  const value = useMemo(
    () => ({
      config,
      client,
      authContext: authContext ?? null,
    }),
    [config, client, authContext],
  );

  return (
    <OpenFeedbackContext.Provider value={value}>
      {children}
    </OpenFeedbackContext.Provider>
  );
}
