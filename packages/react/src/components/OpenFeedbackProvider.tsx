import { createContext, useContext, useMemo, useRef, useCallback } from "react";
import { OpenFeedbackClient } from "@openfeedback/client";
import type { Suggestion, OpenFeedbackConfig, OpenFeedbackProviderProps } from "../types";

type SuggestionUpdateCallback = (
  id: string,
  updater: (s: Suggestion) => Suggestion,
) => void;

interface OpenFeedbackContextValue {
  config: OpenFeedbackConfig;
  proxyUrl: string;
  client: OpenFeedbackClient;
  subscribeSuggestionUpdate: (cb: SuggestionUpdateCallback) => () => void;
  emitSuggestionUpdate: SuggestionUpdateCallback;
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

export function OpenFeedbackProvider({
  config,
  anonKey,
  children,
}: OpenFeedbackProviderProps): React.JSX.Element {
  const client = useMemo(
    () =>
      new OpenFeedbackClient({
        apiUrl: config.apiUrl,
        anonKey,
        projectId: config.projectId,
      }),
    [config.apiUrl, config.projectId, anonKey],
  );

  const listenersRef = useRef(new Set<SuggestionUpdateCallback>());

  const subscribeSuggestionUpdate = useCallback(
    (cb: SuggestionUpdateCallback) => {
      listenersRef.current.add(cb);
      return () => {
        listenersRef.current.delete(cb);
      };
    },
    [],
  );

  const emitSuggestionUpdate: SuggestionUpdateCallback = useCallback(
    (id, updater) => {
      listenersRef.current.forEach((cb) => cb(id, updater));
    },
    [],
  );

  const value = useMemo(
    () => ({
      config,
      proxyUrl: config.proxyUrl ?? "/api/openfeedback",
      client,
      subscribeSuggestionUpdate,
      emitSuggestionUpdate,
    }),
    [config, client, subscribeSuggestionUpdate, emitSuggestionUpdate],
  );

  return (
    <OpenFeedbackContext.Provider value={value}>
      {children}
    </OpenFeedbackContext.Provider>
  );
}
