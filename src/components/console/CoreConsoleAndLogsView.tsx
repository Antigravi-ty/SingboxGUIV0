import React from "react";
import { useThemeStore } from "../../stores/themeStore";
import { ConnectivityDiagnosticPanel } from "./ConnectivityDiagnosticPanel";
import { ConsoleRealtimeLogPanel } from "./ConsoleRealtimeLogPanel";
import { CoreBinaryValidatorPanel } from "./CoreBinaryValidatorPanel";
import { SimplifiedConsoleControlBar } from "./SimplifiedConsoleControlBar";
import { SocksBridgeEndpointPanel } from "./SocksBridgeEndpointPanel";

export const CoreConsoleAndLogsView: React.FC = () => {
  const advancedMode = useThemeStore((s) => s.advancedMode);

  return (
    <div className="view-container">
      {!advancedMode ? (
        <SimplifiedConsoleControlBar />
      ) : (
        <>
          <div className="responsive-two-col-grid">
            <CoreBinaryValidatorPanel />
            <SocksBridgeEndpointPanel />
          </div>
          <ConnectivityDiagnosticPanel />
        </>
      )}

      <ConsoleRealtimeLogPanel />
    </div>
  );
};
