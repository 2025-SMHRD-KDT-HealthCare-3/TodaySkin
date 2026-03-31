import React, { useState } from "react";
import { D } from "../styles/design";
import tsLogo from "../assets/TS_Logo.png";

export default function Header({ nick = "수아", onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const menuItems = [
    { label: "HOME", page: "main" },
    { label: "피부분석", page: "analysis" },
    { label: "리포트", page: "report" },
    { label: "화장품관리", page: "cosmetics" },
    { label: "MY Page", page: "mypage" },
  ];

  return (
    <>
      <header
        style={{
          background: D.nav,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* 좌측: 로고 */}
        <div
          style={{ cursor: "pointer" }}
          onClick={() => onNavigate?.("main")}
        >
          <img
            src={tsLogo}
            alt="Today's Skin"
            style={{
              height: 32,
              objectFit: "contain",
              filter: "brightness(0) invert(1)",
              opacity: 0.9,
            }}
          />
        </div>

        {/* 우측: 인사말 + 햄버거 */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span
            style={{
              fontSize: 13,
              color: D.bgMain,
              opacity: 0.9,
              fontWeight: 300,
            }}
          >
            {nick}님, 오늘도 예쁜 하루 되세요 ✿
          </span>

          {/* 햄버거 아이콘 */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ display: "block", width: 20, height: 2, background: D.bgMain, borderRadius: 2 }} />
            <span style={{ display: "block", width: 20, height: 2, background: D.bgMain, borderRadius: 2 }} />
            <span style={{ display: "block", width: 20, height: 2, background: D.bgMain, borderRadius: 2 }} />
          </button>
        </div>
      </header>

      {/* 사이드 메뉴 */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.3)",
          }}
          onClick={() => setMenuOpen(false)}
        >
          <nav
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 260,
              height: "100%",
              background: D.bgMain,
              padding: "30px 24px",
              boxShadow: "-4px 0 20px rgba(0,0,0,0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {menuItems.map((item, i) => (
              <button
                key={i}
                onClick={() => {
                  setMenuOpen(false);
                  onNavigate?.(item.page);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 8px",
                  border: "none",
                  background: "none",
                  fontSize: 16,
                  color: D.title,
                  cursor: "pointer",
                  borderBottom: `1px solid ${D.border}`,
                  fontFamily: "inherit",
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}