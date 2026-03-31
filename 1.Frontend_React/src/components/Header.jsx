/*
 * 공통 헤더 컴포넌트 (Header)
 - 로그인 후 모든 페이지 상단에 표시
 - 좌측: TS_Logo, 우측: 닉네임 인사말 + 햄버거 메뉴
 - 메뉴 항목 hover 시 배경색 변경
 - 메뉴 하단에 로그아웃 — localStorage 토큰 삭제 후 로그인 페이지 이동
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import tsLogo from "../assets/TS_Logo.png";

export default function Header({ nick = "회원님" }) {
    const navigate = useNavigate();
    const [menuOpen, setMenuOpen] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    /* 햄버거 메뉴 항목 — page 값은 App.jsx 라우팅 경로와 매칭 */
    const menuItems = [
        { label: "HOME", page: "/" },
        { label: "피부분석", page: "/analyze" },
        { label: "리포트", page: "/report" },
        { label: "화장품관리", page: "/cosmetics" },
        { label: "MY Page", page: "/profile" },
    ];

    /* 로그아웃 — localStorage 삭제 후 로그인 페이지로 이동 */
    const handleLogout = () => {
        localStorage.removeItem("user");
        navigate("/");
        window.location.reload();
    };

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
                {/* 좌측: 로고 클릭 시 메인으로 이동 */}
                <div
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate("/")}
                >
                    <img
                        src={tsLogo}
                        alt="Today's Skin"
                        style={{
                            height: 30,
                            objectFit: "contain",
                            filter: "brightness(0) invert(1)",
                        }}
                    />
                </div>

                {/* 우측: 닉네임 인사말 + 햄버거 아이콘 */}
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <span
                        style={{
                            fontSize: 13,
                            color: D.bgMain,
                            opacity: 0.9,
                            fontWeight: 300,
                        }}
                    >
                        {nick}님, 오늘도 어여쁜 하루 되세요 ✿
                    </span>

                    {/* 햄버거 아이콘 — span 3줄로 구성 */}
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

            {/* 사이드 메뉴 — 햄버거 클릭 시 오른쪽에서 슬라이드, 바깥 클릭 시 닫힘 */}
            {menuOpen && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
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
                            display: "flex",
                            flexDirection: "column",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 메뉴 항목 — hover 시 배경색 변경 */}
                        {menuItems.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setMenuOpen(false);
                                    navigate(item.page);
                                }}
                                onMouseEnter={() => setHoveredIndex(i)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                style={{
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "16px 8px",
                                    border: "none",
                                    background: hoveredIndex === i ? `${D.bgSub}` : "none",
                                    fontSize: 16,
                                    color: D.title,
                                    cursor: "pointer",
                                    borderBottom: `1px solid ${D.border}`,
                                    fontFamily: "inherit",
                                    borderRadius: 8,
                                    transition: "background 0.2s",
                                }}
                            >
                                {item.label}
                            </button>
                        ))}

                        {/* 로그아웃 — 메뉴 목록 바로 아래 */}
                        <button
                            onClick={handleLogout}
                            style={{
                                display: "block",
                                width: "100%",
                                textAlign: "right",
                                padding: "16px 8px",
                                border: "none",
                                background: "none",
                                fontSize: 16,
                                color: D.cta,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                borderRadius: 8,
                            }}
                        >
                            Logout
                        </button>
                    </nav>
                </div>
            )}
        </>
    );
}