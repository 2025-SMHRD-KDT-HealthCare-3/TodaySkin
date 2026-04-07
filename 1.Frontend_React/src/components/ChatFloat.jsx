/*
 * ChatFloat — 플로팅 챗봇 바로가기 버튼
 - 꽃잎 아이콘 + 말풍선 점(···)
 - 모든 페이지에서 고정 표시 (챗봇 페이지 제외)
*/

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";

export default function ChatFloat() {
    const navigate = useNavigate();
    const [hovered, setHovered] = useState(false);

    return (
        <div style={{ position: "absolute", bottom: 80, right: 16, zIndex: 90 }}>
            {/* 툴팁 말풍선 */}
            {hovered && (
                <div style={{
                    position: "absolute",
                    bottom: 64,
                    right: 0,
                    background: D.bgMain,
                    color: D.textBody,
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "8px 14px",
                    borderRadius: 10,
                    boxShadow: "0 2px 12px rgba(74,52,40,0.12)",
                    whiteSpace: "nowrap",
                    animation: "fadeIn 0.2s ease",
                }}>
                    궁금한 점이 있으신가요?
                    {/* 말풍선 꼬리 */}
                    <div style={{
                        position: "absolute",
                        bottom: -6,
                        right: 20,
                        width: 12,
                        height: 12,
                        background: D.white,
                        transform: "rotate(45deg)",
                        boxShadow: "2px 2px 4px rgba(74,52,40,0.06)",
                    }} />
                </div>
            )}


            <button
                onClick={() => navigate("/chatbot")}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "transform 0.3s ease",
                    transform: hovered ? "scale(1.08)" : "scale(1)",
                    filter: "drop-shadow(0 3px 6px rgba(196,112,90,0.4))",
                    opacity: hovered ? 0.8 : 0.6
                }}
            >
                <svg
                    width="46"
                    height="46"
                    viewBox="0 0 50 50"
                    fill="none"
                    style={{
                        overflow: "visible",
                        transition: "transform 0.5s ease",
                        transform: hovered ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                >
                    {[0, 72, 144, 216, 288].map((angle, i) => {
                        const rad = ((angle - 90) * Math.PI) / 180;
                        const cx = 25 + Math.cos(rad) * 8;
                        const cy = 25 + Math.sin(rad) * 8;
                        return (
                            <ellipse
                                key={i}
                                cx={cx}
                                cy={cy}
                                rx="12"
                                ry="17"
                                fill={D.warning}
                                opacity={0.9}
                                transform={`rotate(${angle}, ${cx}, ${cy})`}
                            />
                        );
                    })}
                    <circle cx="25" cy="25" r="8" fill={D.white} />
                    {[-5, 0, 5].map((dx, i) => (
                        <circle key={`dot-${i}`} cx={25 + dx} cy="25" r="1.5" fill={D.warning} />
                    ))}
                </svg>
            </button>
        </div>
    );
}