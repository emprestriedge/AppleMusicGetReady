import React from "react";

/**
 * InkBackground - Teal ombre version for Apple Music build.
 * Dark teal at edges, lighter teal glow at center.
 */
export default function InkBackground({ children }: { children?: React.ReactNode }) {
  const gradientStyle: React.CSSProperties = {
    background: `
      radial-gradient(circle at 80% 20%, rgba(45, 185, 177, 0.35) 0%, transparent 50%),
      radial-gradient(circle at 20% 80%, rgba(25, 162, 142, 0.25) 0%, transparent 60%),
      linear-gradient(135deg, #010c0c 0%, #051818 100%)
    `,
    position: "absolute",
    inset: "-10%",
    zIndex: 0,
    animation: "inkDrift 45s ease-in-out infinite"
  };

  return (
    <div style={{
      height: "100svh",
      minHeight: "-webkit-fill-available",
      width: "100%",
      position: "relative",
      backgroundColor: "#010c0c",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={gradientStyle} />
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.6) 100%)",
        pointerEvents: "none"
      }} />
      <div style={{
        position: "relative",
        zIndex: 10,
        flex: 1,
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
        {children}
      </div>
    </div>
  );
}
