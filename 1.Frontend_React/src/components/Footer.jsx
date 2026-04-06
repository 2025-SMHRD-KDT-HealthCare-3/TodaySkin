/*
 * Footer — 하단 탭 네비게이션 (5탭)
 - 리포트 / 피부분석 / HOME(강조) / 화장품 / MY
*/

import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { D } from "../styles/design";

const tabs = [
    {
        label: "리포트",
        path: "/report",
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={active ? D.cta : D.textLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <path d="M8 16v-5" />
                <path d="M12 16v-8" />
                <path d="M16 16v-3" />
            </svg>
        ),
    },
    {
        label: "피부분석",
        path: "/analyze",
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={active ? D.cta : D.textLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="M16.5 16.5L21 21" />
                <circle cx="11" cy="11" r="3" />
            </svg>
        ),
    },
    // HOME은 기존 그대로
    {
        label: "HOME",
        path: "/",
        isCenter: true,
        icon: (active) => (
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
                stroke={D.white} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5L12 3l9 7.5" />
                <path d="M5 10v9a1 1 0 001 1h3v-5a1 1 0 011-1h4a1 1 0 011 1v5h3a1 1 0 001-1v-9" />
            </svg>
        ),
    },
    {
        label: "화장품",
        path: "/cosmetics",
        icon: (active) => (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={active ? D.cta : D.textLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2h6v6H9z" rx="1" />
                <rect x="7" y="8" width="10" height="14" rx="3" />
                <path d="M12 12v4" />
                <path d="M10 14h4" />
            </svg>
        ),
    },
    {
        label: "MY",
        path: "/profile",
        icon: (active) => (
            <svg width="22" height="35" viewBox="0 0 24 24" fill="none"
                stroke={active ? D.cta : D.textLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="9" r="4" />
                <path d="M5 20a7 7 0 0114 0" />
            </svg>
        ),
    },
];

export default function Footer() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <nav style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-around",
            padding: "8px 0 12px",
            background: D.white,
            flexShrink: 0,
        }}>

            {/* 구분선 — top 값으로 위치 조절 */}
            <div style={{
                position: "absolute",
                top: 10,
                left: 0,
                right: 0,
                height: 1,
                background: D.border,
            }} />

            {tabs.map((tab) => {
                const active = location.pathname === tab.path;

                /* HOME — 가운데 강조 버튼 */
                if (tab.isCenter) {
                    return (
                        <button key={tab.path}
                            onClick={() => navigate(tab.path)}
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                marginTop: -20,
                                padding: 0,
                                position: "relative",
                                zIndex: 1,
                            }}
                        >
                            <div style={{
                                width: 52,
                                height: 52,
                                borderRadius: "50%",
                                background: D.cta,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: `0 4px 14px ${D.cta}40`,
                                border: `4px solid ${D.white}`,
                                transition: "transform 0.2s",
                            }}>
                                {tab.icon(active)}
                            </div>
                            <span style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: D.cta,
                                marginTop: 4,
                            }}>{tab.label}</span>
                        </button>
                    );
                }

                /* 일반 탭 */
                return (
                    <button key={tab.path}
                        onClick={() => navigate(tab.path)}
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: "4px 0",
                            minWidth: 56,
                        }}
                    >
                        {tab.icon(active)}
                        <span style={{
                            fontSize: 10,
                            fontWeight: active ? 600 : 400,
                            color: active ? D.cta : D.textLight,
                        }}>{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}