// Simple React context for Prometheus connection state
import { createContext, useContext } from "react";
import type { PrometheusConfig, TSDBStatus, TargetInfo } from "./prometheus";

export interface ConnectionState {
  config: PrometheusConfig | null;
  isConnected: boolean;
  tsdbStatus: TSDBStatus | null;
  targets: TargetInfo | null;
  promConfig: string | null;
  allMetricNames: string[];
  allLabelNames: string[];
}

export interface AppContextType {
  connection: ConnectionState;
  setConnection: (state: ConnectionState) => void;
  disconnect: () => void;
}

export const AppContext = createContext<AppContextType>({
  connection: { config: null, isConnected: false, tsdbStatus: null, targets: null, promConfig: null, allMetricNames: [], allLabelNames: [] },
  setConnection: () => {},
  disconnect: () => {},
});

export const useAppContext = () => useContext(AppContext);
