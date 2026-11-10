import React from "react";
import { useWorkspaceStore } from "../../stores/workspaceStore";

export const GeneratedSocksEndpointsTable: React.FC = () => {
  const endpoints = useWorkspaceStore((s) => s.endpoints);
  const listenIp = useWorkspaceStore((s) => s.listenIp);
  const listenPort = useWorkspaceStore((s) => s.listenPort);

  return (
    <div className="primer-datatable-container" style={{ maxHeight: 390 }}>
      <div className="primer-datatable-header-bar">
        <div className="primer-datatable-title">
          <span>
            Generated SOCKS5 Bridge Endpoints ({endpoints.length} / 1000 slots)
          </span>
        </div>
        <div className="primer-datatable-actions">
          <span className="primer-label primer-label-neutral">
            Listen: {listenIp}:{listenPort} (auth password = 0)
          </span>
        </div>
      </div>
      <div className="primer-datatable-scroll">
        <table className="primer-datatable">
          <thead>
            <tr>
              <th>SOCKS5 User</th>
              <th>Topology Type</th>
              <th>Surge 5.10 Proxy Name (Sing-box Outbound Tag)</th>
              <th>Hop Path / Sing-box detour Chain</th>
              <th>Protocols</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "20px 12px",
                    color: "var(--fg-muted)",
                  }}
                >
                  No SOCKS5 endpoints generated yet. Import a subscription on the{" "}
                  <strong>Subscriptions &amp; Mihomo Converter</strong> tab (or
                  click <strong>Load Sample Topology</strong> above) to compile
                  Sing-box 1.14.4 outbounds.
                </td>
              </tr>
            ) : (
              endpoints.map((ep) => (
                <tr key={ep.username} className="primer-datatable-row">
                  <td>
                    <code>{ep.username}:0</code>
                  </td>
                  <td>
                    <span
                      className={`primer-label ${
                        ep.hopCount === 0
                          ? "primer-label-neutral"
                          : ep.hopCount === 2
                          ? "primer-label-done"
                          : ep.isSelfHop
                          ? "primer-label-sponsors"
                          : "primer-label-accent"
                      }`}
                    >
                      {ep.hopCount === 0
                        ? "0-Hop Direct"
                        : ep.isSelfHop
                        ? "1-Hop Self-Relay"
                        : `${ep.hopCount}-Hop Chain`}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{ep.finalTag}</td>
                  <td>
                    <code>{ep.hopTags.join(" -> ")}</code>
                  </td>
                  <td>
                    <span className="primer-label primer-label-success">
                      {ep.protocolChain.join(" => ")}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
