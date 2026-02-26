import React from "react";

/**
 * InkBackground - Deep teal ombre, near-black at edges for strong contrast.
 */
export default function InkBackground({ children }: { children?: React.ReactNode }) {
  const gradientStyle: React.CSSProperties = {
    background: `
      radial-gradient(circle at 55% 45%, rgba(45, 185, 177, 0.28) 0%, transparent 45%),
      radial-gradient(circle at 20% 70%, rgba(25, 162, 142, 0.15) 0%, transparent 40%),
      linear-gradient(135deg, #000000 0%, #020d0d 35%, #041414 65%, #061a1a 100%)
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
      backgroundColor: "#000000",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={gradientStyle} />
      {/* Stronger darkening overlay — more contrast top and bottom */}
      <div style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0.65) 100%)",
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
