// Simple React context for Prometheus connection state
import { createContext, useContext } from "react";
import type { PrometheusConfig, TSDBStatus, TargetInfo } from "./prometheus";
import type { ExportRule, ExportSettings } from "./exportMatch";
import { DEFAULT_EXPORT_SETTINGS } from "./exportMatch";

export interface ConnectionState {
  config: PrometheusConfig | null;
  isConnected: boolean;
  tsdbStatus: TSDBStatus | null;
  targets: TargetInfo | null;
  promConfig: string | null;
  allMetricNames: string[];
  allLabelNames: string[];
  exportRules: ExportRule[];
  exportRulesRaw: string;
  exportSettings: ExportSettings;
}

export interface AppContextType {
  connection: ConnectionState;
  setConnection: (state: ConnectionState) => void;
  disconnect: () => void;
}

export const initialConnectionState: ConnectionState = {
  config: null,
  isConnected: false,
  tsdbStatus: null,
  targets: null,
  promConfig: null,
  allMetricNames: [],
  allLabelNames: [],
  exportRules: [],
  exportRulesRaw: "",
  exportSettings: { ...DEFAULT_EXPORT_SETTINGS },
};

export const AppContext = createContext<AppContextType>({
  connection: initialConnectionState,
  setConnection: () => {},
  disconnect: () => {},
});

export const useAppContext = () => useContext(AppContext);
