import React, { useEffect } from 'react'
import { useThemeStore } from './stores/themeStore'
import { useWorkspaceStore } from './stores/workspaceStore'
import { TopNavigationHeader } from './components/layout/TopNavigationHeader'
import { ChainTopologyView } from './components/topology/ChainTopologyView'
import { SubscriptionManagerView } from './components/subscriptions/SubscriptionManagerView'
import { TlsSecurityPolicyView } from './components/security/TlsSecurityPolicyView'
import { DesensitizedExportView } from './components/diagnostics/DesensitizedExportView'
import { MitmRoutingView } from './components/mitm/MitmRoutingView'
import { CoreConsoleAndLogsView } from './components/console/CoreConsoleAndLogsView'

export const App: React.FC = () => {
  const { initTheme } = useThemeStore()
  const { activeTab } = useWorkspaceStore()

  useEffect(() => {
    initTheme()
  }, [initTheme])

  return (
    <div className="app-shell">
      <TopNavigationHeader />
      <main className="main-workspace">
        {activeTab === 'topology' && <ChainTopologyView />}
        {activeTab === 'subscriptions' && <SubscriptionManagerView />}
        {activeTab === 'security' && <TlsSecurityPolicyView />}
        {activeTab === 'diagnostics' && <DesensitizedExportView />}
        {activeTab === 'mitm' && <MitmRoutingView />}
        {activeTab === 'console' && <CoreConsoleAndLogsView />}
      </main>
    </div>
  )
}

export default App
