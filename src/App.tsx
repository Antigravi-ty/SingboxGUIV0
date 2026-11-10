import React, { useEffect } from "react";
import { useThemeStore } from "./stores/themeStore";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { TopNavigationHeader } from "./components/layout/TopNavigationHeader";
import { ChainTopologyView } from "./components/topology/ChainTopologyView";
import { SubscriptionManagerView } from "./components/subscriptions/SubscriptionManagerView";
import { TlsSecurityPolicyView } from "./components/security/TlsSecurityPolicyView";
import { DesensitizedExportView } from "./components/diagnostics/DesensitizedExportView";
import { MitmRoutingView } from "./components/mitm/MitmRoutingView";
import { CoreConsoleAndLogsView } from "./components/console/CoreConsoleAndLogsView";

export const App: React.FC = () => {
  const { initTheme, advancedMode } = useThemeStore();
  const activeTab = useWorkspaceStore((s) => s.activeTab);
  const hydrateUiConfigFromDisk = useWorkspaceStore(
    (s) => s.hydrateUiConfigFromDisk
  );
  const runSingboxCheck = useWorkspaceStore((s) => s.runSingboxCheck);

  useEffect(() => {
    initTheme();
    void hydrateUiConfigFromDisk();
    void runSingboxCheck();
  }, [initTheme, hydrateUiConfigFromDisk, runSingboxCheck]);

  const effectiveTab = advancedMode ? activeTab : "console";

  return (
    <div className="app-shell">
      <TopNavigationHeader />
      <main className="main-workspace">
        {effectiveTab === "topology" && <ChainTopologyView />}
        {effectiveTab === "subscriptions" && <SubscriptionManagerView />}
        {effectiveTab === "security" && <TlsSecurityPolicyView />}
        {effectiveTab === "diagnostics" && <DesensitizedExportView />}
        {effectiveTab === "mitm" && <MitmRoutingView />}
        {effectiveTab === "console" && <CoreConsoleAndLogsView />}
      </main>
    </div>
  );
};

export default App;
