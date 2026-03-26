import React from "react";
import { D } from "../styles/design";

export default function MainBg({ children }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: D.mainBg,
        display: "flex",
        overflowY: "auto",
        overflow: "auto",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* ── 좌측 배경 영역 ── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
          marginRight: -150,
          pointerEvents: "none",
        }}
      >
        {/* 로고 + 카피라이트 묶음 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <img
            src="/src/assets/TS_Logo.png"
            alt="Today's Skin"
            style={{
              width: 240,
              objectFit: "contain",
              opacity: 0.85,
            }}
          />
          <div
            style={{
              marginTop: 20,
              fontSize: 11,
              color: D.textLight,
              letterSpacing: "0.05em",
              fontWeight: 300,
              textAlign: "center",
            }}
          >
            © 2026 TODAY'S SKIN SMHRD
          </div>
        </div>
      </div>

      {/* ── 우측 카드 패널 (가운데-오른쪽 배치) ── */}
      <div
        style={{
          width: 440,
          height: "100%",
          margin: "0px 300px 0px 0px",
          background: D.bgMain,
          borderRadius: 24,
          boxShadow: "-8px 0 40px rgba(74, 52, 40, 0.08)",
          display: "flex",
          flexDirection: "column",
          overflowY: "hidden",
          flexShrink: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}