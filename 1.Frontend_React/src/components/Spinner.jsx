/*
 * Spinner — 데이터 로딩용 간단 스피너
 - 페이지 전체 또는 부분 로딩 시 사용
*/

import React from "react";
import { D } from "../styles/design";

export default function Spinner({ message = "불러오는 중..." }) {
    return (
        <div style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "60px 20px", gap: 16,
        }}>
            <div style={{
                width: 32, height: 32,
                border: `3px solid ${D.border}`,
                borderTop: `3px solid ${D.cta}`,
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
            }} />
            <p style={{ fontSize: 14, color: D.textLight }}>{message}</p>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}