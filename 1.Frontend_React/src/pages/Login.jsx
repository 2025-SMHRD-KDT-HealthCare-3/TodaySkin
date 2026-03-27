import React, { useState } from "react";
import { D } from "../styles/design";

export default function Login({ onLogin, onSignUp }) {
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");

  const inputStyle = {
    width: "100%",
    padding: "14px 16px",
    fontSize: 14,
    border: `1px solid ${D.border}`,
    borderRadius: 10,
    background: D.white,
    color: D.title,
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };

  const labelStyle = {
    fontSize: 12,
    fontWeight: 600,
    color: D.textBody,
    marginBottom: 8,
    display: "block",
    letterSpacing: "0.03em",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        fontFamily: "inherit",
      }}
    >
      {/* ── 상단 콘텐츠 ── */}
      <div
        style={{
          padding: "60px 40px 40px",
        }}
      >
        {/* 나뭇잎 아이콘 + 인사말 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img
            src="/src/assets/Leaf.png"
            alt="leaf"
            style={{
              width: 48,
              height: 48,
              objectFit: "contain",
              marginBottom: 20,
            }}
          />

          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: D.title,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            어서오세요
            <br />
            오늘의 피부입니다
          </h1>
        </div>

        {/* ── 폼 ── */}
        <div style={{ marginTop: 36 }}>
          {/* 아이디 */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>아이디</label>
            <input
              type="text"
              placeholder="아이디를 입력하세요"
              value={id}
              onChange={(e) => setId(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = D.cta)}
              onBlur={(e) => (e.target.style.borderColor = D.border)}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ marginBottom: 8 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>비밀번호</label>
              <span
                style={{
                  fontSize: 12,
                  color: D.textLight,
                  cursor: "pointer",
                }}
              >
                비밀번호 찾기
              </span>
            </div>
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = D.cta)}
              onBlur={(e) => (e.target.style.borderColor = D.border)}
            />
          </div>
        </div>

        {/* 로그인 버튼 */}
        <button
          onClick={() => onLogin?.({ id, pwd })}
          style={{
            width: "100%",
            padding: "16px",
            marginTop: 32,
            background: D.cta,
            color: D.white,
            border: "none",
            borderRadius: 28,
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: "0.05em",
            boxShadow: `0 4px 16px ${D.cta}33`,
          }}
        >
          로그인
        </button>

        {/* 회원가입 링크 */}
        <div
          style={{
            textAlign: "center",
            marginTop: 20,
            fontSize: 13,
            color: D.textLight,
          }}
        >
          계정이 없으신가요?{" "}
          <span
            onClick={() => onSignUp?.()}
            style={{ color: D.title, fontWeight: 700, cursor: "pointer" }}
          >
            회원가입
          </span>
        </div>
      </div>

      {/* ── 하단 보타니컬 이미지 ── */}
      <div
        style={{
          height: 160,
          borderRadius: "0 0 24px 24px",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <img
          src="/src/assets/Login_bottom.png"
          alt="botanical"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>
    </div>
  );
}