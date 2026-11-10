import React, { useMemo, useState } from "react";
import {
  TopologyProviderNode,
  TopologyVisualEdge,
} from "../../types/chainProxy";
import {
  buildCubicBezierPath,
  buildSelfRelayLoopPath,
  COL_BRIDGE_X,
  COL_ENTRY_X,
  COL_EXIT_X,
  COL_TRANSIT_X,
  TopologyBridgeNodeBox,
  TopologyProviderNodeRows,
} from "./TopologySvgElements";

interface ChainTopologySvgCanvasProps {
  providerNodes: TopologyProviderNode[];
  visualEdges: TopologyVisualEdge[];
  selectedRuleId: string | null;
  onSelectRule: (ruleId: string | null) => void;
  listenIp: string;
  listenPort: number;
  totalEndpoints: number;
}

const ROW_HEIGHT = 76;
const TOP_PADDING = 54;

export const ChainTopologySvgCanvas: React.FC<ChainTopologySvgCanvasProps> = ({
  providerNodes,
  visualEdges,
  selectedRuleId,
  onSelectRule,
  listenIp,
  listenPort,
  totalEndpoints,
}) => {
  const [hoveredProvider, setHoveredProvider] = useState<string | null>(null);
  const [focusSelectedOnly, setFocusSelectedOnly] = useState<boolean>(false);

  const rowMap = useMemo(() => {
    const map = new Map<string, number>();
    providerNodes.forEach((p, idx) => {
      map.set(p.prefix, TOP_PADDING + idx * ROW_HEIGHT + 24);
    });
    return map;
  }, [providerNodes]);

  const svgHeight = Math.max(
    300,
    TOP_PADDING + providerNodes.length * ROW_HEIGHT + 36
  );
  const bridgeCenterY = svgHeight / 2;

  return (
    <div className="primer-box" style={{ overflow: "hidden" }}>
      <div className="primer-box-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>
            Interactive Multi-Hop &amp; Self-Relay Chain Proxy Topology Graph
          </span>
          <span className="primer-label primer-label-accent">
            {providerNodes.length} Provider Groups
          </span>
          <span className="primer-label primer-label-success">
            {visualEdges.filter((e) => e.enabled).length} Active Chain Links
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {selectedRuleId && (
            <button
              type="button"
              className="primer-btn primer-card-action-btn"
              onClick={() => onSelectRule(null)}
            >
              Show All Lanes
            </button>
          )}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              cursor: "pointer",
              color: "var(--fg-muted)",
            }}
          >
            <input
              type="checkbox"
              checked={focusSelectedOnly}
              onChange={(e) => setFocusSelectedOnly(e.target.checked)}
            />
            <span>Focus Selected Lineage Only</span>
          </label>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          overflowX: "auto",
          backgroundColor: "var(--bg-canvas-inset)",
          borderBottom: "1px solid var(--border-muted)",
        }}
      >
        <svg
          width={980}
          height={svgHeight}
          viewBox={`0 0 980 ${svgHeight}`}
          style={{ display: "block", margin: "0 auto", userSelect: "none" }}
        >
          <defs>
            <marker
              id="chain-arrow"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#58a6ff" />
            </marker>
          </defs>

          {/* Column Stage Headers */}
          <g transform="translate(0, 22)" style={{ fontSize: 11, fontWeight: 700 }}>
            <text x={COL_ENTRY_X} y={0} textAnchor="middle" fill="var(--fg-muted)">
              STAGE 1: ENTRY HOP (DETOUR DIALER)
            </text>
            <text x={COL_TRANSIT_X} y={0} textAnchor="middle" fill="var(--fg-muted)">
              STAGE 2: TRANSIT HOP (2-HOP RELAY)
            </text>
            <text x={COL_EXIT_X} y={0} textAnchor="middle" fill="var(--fg-muted)">
              STAGE 3: LANDING EXIT GROUP
            </text>
            <text x={COL_BRIDGE_X} y={0} textAnchor="middle" fill="var(--fg-muted)">
              STAGE 4: SURGE SOCKS5 BRIDGE
            </text>
          </g>

          {/* Vertical Spine Guide Lines */}
          {[COL_ENTRY_X, COL_TRANSIT_X, COL_EXIT_X, COL_BRIDGE_X].map((cx, i) => (
            <line
              key={i}
              x1={cx}
              y1={36}
              x2={cx}
              y2={svgHeight - 18}
              stroke="var(--border-muted)"
              strokeWidth={1}
              strokeDasharray="3 4"
            />
          ))}

          {providerNodes.length === 0 && (
            <g transform={`translate(365, ${bridgeCenterY})`}>
              <rect
                x={-230}
                y={-34}
                width={460}
                height={68}
                rx={8}
                fill="var(--bg-canvas-default)"
                stroke="var(--border-default)"
                strokeDasharray="4 3"
              />
              <text
                x={0}
                y={-6}
                textAnchor="middle"
                fontSize={12}
                fontWeight={600}
                fill="var(--fg-default)"
              >
                No Subscription Provider Groups Imported Yet
              </text>
              <text
                x={0}
                y={14}
                textAnchor="middle"
                fontSize={10.5}
                fill="var(--fg-muted)"
              >
                Import a subscription (or click &quot;Load Sample Topology&quot;) to render Stage 1–4 lanes
              </text>
            </g>
          )}

          {/* Direct Baseline Connections from Exit Stage -> SOCKS5 Bridge */}
          {providerNodes.map((pNode) => {
            const y = rowMap.get(pNode.prefix) || 80;
            const isHighlighted =
              hoveredProvider === null || hoveredProvider === pNode.prefix;
            return (
              <path
                key={`direct-bridge-${pNode.prefix}`}
                d={buildCubicBezierPath(
                  COL_EXIT_X + 74,
                  y,
                  COL_BRIDGE_X - 78,
                  bridgeCenterY
                )}
                fill="none"
                stroke={pNode.colorHex}
                strokeWidth={1.6}
                strokeOpacity={isHighlighted ? 0.42 : 0.12}
                strokeDasharray="2 3"
              />
            );
          })}

          {/* Dynamic Chain Proxy Edges (1-Hop, 2-Hop, and Self-Relay Loops) */}
          {visualEdges.map((edge) => {
            const yFrom = rowMap.get(edge.fromPrefix);
            const yTo = rowMap.get(edge.toPrefix);
            const yVia = edge.viaPrefix ? rowMap.get(edge.viaPrefix) : undefined;
            if (yFrom === undefined || yTo === undefined) return null;

            const isSelected = selectedRuleId === edge.ruleId;
            const isProviderHovered =
              hoveredProvider === null ||
              hoveredProvider === edge.fromPrefix ||
              hoveredProvider === edge.toPrefix ||
              hoveredProvider === edge.viaPrefix;

            let opacity = edge.enabled ? 0.86 : 0.22;
            let strokeWidth = isSelected ? 3.2 : 2.2;

            if (selectedRuleId && focusSelectedOnly && !isSelected) {
              opacity = 0.1;
              strokeWidth = 1.3;
            } else if (!isProviderHovered) {
              opacity = 0.18;
            }

            const xEntryRight = COL_ENTRY_X + 74;
            const xExitLeft = COL_EXIT_X - 74;

            if (edge.hopCount === 2 && yVia !== undefined) {
              const xTransitLeft = COL_TRANSIT_X - 66;
              const xTransitRight = COL_TRANSIT_X + 66;
              const pathLeg1 = buildCubicBezierPath(
                xEntryRight,
                yFrom,
                xTransitLeft,
                yVia
              );
              const pathLeg2 = buildCubicBezierPath(
                xTransitRight,
                yVia,
                xExitLeft,
                yTo
              );
              return (
                <g
                  key={edge.id}
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    onSelectRule(isSelected ? null : edge.ruleId)
                  }
                >
                  <path
                    d={pathLeg1}
                    fill="none"
                    stroke={edge.colorHex}
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                  />
                  <path
                    d={pathLeg2}
                    fill="none"
                    stroke={edge.colorHex}
                    strokeWidth={strokeWidth}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    markerEnd="url(#chain-arrow)"
                  />
                  {/* Transit Hop Pill */}
                  <g transform={`translate(${COL_TRANSIT_X}, ${yVia})`}>
                    <rect
                      x={-66}
                      y={-18}
                      width={132}
                      height={36}
                      rx={6}
                      fill="var(--bg-canvas-default)"
                      stroke={edge.colorHex}
                      strokeWidth={isSelected ? 2 : 1.3}
                    />
                    <text
                      x={0}
                      y={-2}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={700}
                      fill="var(--fg-default)"
                    >
                      VIA {edge.viaPrefix} ({edge.middleFilter || "*"})
                    </text>
                    <text
                      x={0}
                      y={11}
                      textAnchor="middle"
                      fontSize={9.5}
                      fill="var(--fg-muted)"
                    >
                      CP2 ({edge.generatedCount} socks5)
                    </text>
                  </g>
                </g>
              );
            }

            const curvePath = edge.isSelfHop
              ? buildSelfRelayLoopPath(xEntryRight, yFrom, xExitLeft, yTo)
              : buildCubicBezierPath(xEntryRight, yFrom, xExitLeft, yTo);

            const labelX = (xEntryRight + xExitLeft) * 0.5;
            const labelY = edge.isSelfHop
              ? Math.max(28, yFrom - 26)
              : (yFrom + yTo) * 0.5 - 6;

            return (
              <g
                key={edge.id}
                style={{ cursor: "pointer" }}
                onClick={() => onSelectRule(isSelected ? null : edge.ruleId)}
              >
                <path
                  d={curvePath}
                  fill="none"
                  stroke={edge.colorHex}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  strokeDasharray={edge.isSelfHop ? "5 3" : undefined}
                  strokeLinecap="round"
                  markerEnd="url(#chain-arrow)"
                />
                <g
                  transform={`translate(${labelX}, ${labelY})`}
                  opacity={opacity}
                >
                  <rect
                    x={-68}
                    y={-11}
                    width={136}
                    height={20}
                    rx={10}
                    fill="var(--bg-canvas-default)"
                    stroke={edge.colorHex}
                    strokeWidth={1}
                  />
                  <text
                    x={0}
                    y={3}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight={700}
                    fill="var(--fg-default)"
                  >
                    {edge.isSelfHop
                      ? `SELF ${edge.fromPrefix}->${edge.toPrefix} (${edge.generatedCount})`
                      : `CP1 ${edge.fromPrefix}->${edge.toPrefix} (${edge.generatedCount})`}
                  </text>
                </g>
              </g>
            );
          })}

          {/* Stage 1 (Entry Provider Nodes) & Stage 3 (Exit Provider Nodes) */}
          <TopologyProviderNodeRows
            providerNodes={providerNodes}
            rowMap={rowMap}
            hoveredProvider={hoveredProvider}
            onHoverProvider={setHoveredProvider}
          />

          {/* Stage 4: Local Sing-box 1.14.4 SOCKS5 Bridge Node */}
          <TopologyBridgeNodeBox
            bridgeCenterY={bridgeCenterY}
            listenIp={listenIp}
            listenPort={listenPort}
            totalEndpoints={totalEndpoints}
          />
        </svg>
      </div>
    </div>
  );
};
