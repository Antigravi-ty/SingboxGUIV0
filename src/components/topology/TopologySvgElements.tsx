import React from "react";
import { TopologyProviderNode } from "../../types/chainProxy";

export const COL_ENTRY_X = 115;
export const COL_TRANSIT_X = 365;
export const COL_EXIT_X = 615;
export const COL_BRIDGE_X = 855;

export function buildCubicBezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = Math.abs(x2 - x1) * 0.48;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function buildSelfRelayLoopPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const midX = (x1 + x2) * 0.5;
  const arcY = Math.max(22, y1 - 32);
  return `M ${x1} ${y1} C ${midX - 40} ${arcY}, ${midX + 40} ${arcY}, ${x2} ${y2}`;
}

interface TopologyProviderNodeRowsProps {
  providerNodes: TopologyProviderNode[];
  rowMap: Map<string, number>;
  hoveredProvider: string | null;
  onHoverProvider: (prefix: string | null) => void;
}

export const TopologyProviderNodeRows: React.FC<
  TopologyProviderNodeRowsProps
> = ({ providerNodes, rowMap, hoveredProvider, onHoverProvider }) => {
  return (
    <>
      {providerNodes.map((pNode) => {
        const y = rowMap.get(pNode.prefix) || 80;
        const isHovered = hoveredProvider === pNode.prefix;

        return (
          <g
            key={`row-${pNode.prefix}`}
            onMouseEnter={() => onHoverProvider(pNode.prefix)}
            onMouseLeave={() => onHoverProvider(null)}
          >
            {/* Stage 1 Entry Box */}
            <g transform={`translate(${COL_ENTRY_X}, ${y})`}>
              <rect
                x={-74}
                y={-24}
                width={148}
                height={48}
                rx={7}
                fill="var(--bg-canvas-default)"
                stroke={pNode.colorHex}
                strokeWidth={isHovered ? 2.4 : 1.5}
              />
              <circle cx={-58} cy={-6} r={5} fill={pNode.colorHex} />
              <text
                x={-46}
                y={-2}
                fontSize={12}
                fontWeight={700}
                fill="var(--fg-default)"
              >
                {pNode.prefix} Entry
              </text>
              <text
                x={64}
                y={-2}
                textAnchor="end"
                fontSize={10}
                fontWeight={600}
                fill="var(--fg-muted)"
              >
                {pNode.nodeCount}n
              </text>
              <text x={-58} y={14} fontSize={9.5} fill="var(--fg-muted)">
                {pNode.protocols.join("/").slice(0, 18)}
                {pNode.hasCustomDoH ? " • DoH" : ""}
              </text>
            </g>

            {/* Stage 3 Exit Box */}
            <g transform={`translate(${COL_EXIT_X}, ${y})`}>
              <rect
                x={-74}
                y={-24}
                width={148}
                height={48}
                rx={7}
                fill="var(--bg-canvas-default)"
                stroke={pNode.colorHex}
                strokeWidth={isHovered ? 2.4 : 1.5}
              />
              <circle cx={-58} cy={-6} r={5} fill={pNode.colorHex} />
              <text
                x={-46}
                y={-2}
                fontSize={12}
                fontWeight={700}
                fill="var(--fg-default)"
              >
                {pNode.prefix} Exit
              </text>
              <text
                x={64}
                y={-2}
                textAnchor="end"
                fontSize={10}
                fontWeight={600}
                fill="var(--fg-muted)"
              >
                {pNode.insecureCount > 0
                  ? `${pNode.insecureCount} insec`
                  : "strict"}
              </text>
              <text x={-58} y={14} fontSize={9.5} fill="var(--fg-muted)">
                {pNode.sampleNodes[0]?.slice(0, 19) || pNode.prefix}
              </text>
            </g>
          </g>
        );
      })}
    </>
  );
};

interface TopologyBridgeNodeBoxProps {
  bridgeCenterY: number;
  listenIp: string;
  listenPort: number;
  totalEndpoints: number;
}

export const TopologyBridgeNodeBox: React.FC<TopologyBridgeNodeBoxProps> = ({
  bridgeCenterY,
  listenIp,
  listenPort,
  totalEndpoints,
}) => (
  <g transform={`translate(${COL_BRIDGE_X}, ${bridgeCenterY})`}>
    <rect
      x={-78}
      y={-42}
      width={156}
      height={84}
      rx={8}
      fill="var(--bg-canvas-default)"
      stroke="var(--fg-success)"
      strokeWidth={2}
    />
    <text
      x={0}
      y={-18}
      textAnchor="middle"
      fontSize={11.5}
      fontWeight={700}
      fill="var(--fg-success)"
    >
      sing-box 1.14.4
    </text>
    <text
      x={0}
      y={-2}
      textAnchor="middle"
      fontSize={10.5}
      fontWeight={600}
      fill="var(--fg-default)"
    >
      {listenIp}:{listenPort}
    </text>
    <text
      x={0}
      y={14}
      textAnchor="middle"
      fontSize={9.5}
      fill="var(--fg-muted)"
    >
      users: 000..{String(Math.max(0, totalEndpoints - 1)).padStart(3, "0")}
    </text>
    <text
      x={0}
      y={29}
      textAnchor="middle"
      fontSize={9.5}
      fontWeight={600}
      fill="var(--fg-accent)"
    >
      -&gt; Surge 5.10 Smart
    </text>
  </g>
);
