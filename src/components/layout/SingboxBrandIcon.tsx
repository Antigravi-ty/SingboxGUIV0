import React from "react";
import { ColorMode, TopbarIconStyle } from "../../stores/themeStore";

interface SingboxBrandIconProps {
  styleMode: TopbarIconStyle;
  colorMode: ColorMode;
  size?: number;
}

export const SingboxBrandIcon: React.FC<SingboxBrandIconProps> = ({
  styleMode,
  colorMode,
  size = 20,
}) => {
  if (styleMode === "real") {
    return (
      <img
        src="/favicon.svg"
        alt="Sing-box"
        width={size}
        height={size}
        style={{ display: "block", flexShrink: 0 }}
      />
    );
  }

  // Standardized macOS Monochrome Template Icon:
  // Light Mode -> White fill with crisp dark template stroke & seam
  // Dark Mode -> Black fill with crisp light template stroke & seam
  const isLight = colorMode === "light";
  const faceTopFill = isLight ? "#FFFFFF" : "#111418";
  const faceLeftFill = isLight ? "#F3F4F6" : "#0A0C0E";
  const faceRightFill = isLight ? "#E5E7EB" : "#1B2026";
  const strokeColor = isLight ? "#1F2328" : "#F0F6FC";
  const tapeFill = isLight ? "#1F2328" : "#F0F6FC";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="220 220 584 630"
      style={{ display: "block", flexShrink: 0 }}
      aria-label="Sing-box Monochrome Template Icon"
    >
      {/* Top, Left, Right Isometric Cube Faces */}
      <path
        d="M512 262 754.5 402 512 542 269.5 402Z"
        fill={faceTopFill}
        stroke={strokeColor}
        strokeWidth="26"
        strokeLinejoin="round"
      />
      <path
        d="M269.5 402 512 542 512 812 269.5 672Z"
        fill={faceLeftFill}
        stroke={strokeColor}
        strokeWidth="26"
        strokeLinejoin="round"
      />
      <path
        d="M512 542 754.5 402 754.5 672 512 812Z"
        fill={faceRightFill}
        stroke={strokeColor}
        strokeWidth="26"
        strokeLinejoin="round"
      />
      {/* Lid Flap Seam */}
      <path
        d="M390.75 472 633.25 332"
        stroke={strokeColor}
        strokeWidth="22"
        strokeLinecap="round"
        fill="none"
      />
      {/* Packaging Tape Strip */}
      <path
        d="M356.8 351.6 424.7 312.4 667.2 452.4 667.2 572.4 599.3 611.6 599.3 491.6Z"
        fill={tapeFill}
        opacity={0.9}
      />
    </svg>
  );
};
