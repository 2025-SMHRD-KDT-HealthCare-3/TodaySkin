/*
 * 공통 헤더 컴포넌트 (Header)
 - 투명 배경 + 닉네임 환영 문구
*/

import React from "react";
import { D } from "../styles/design";

export default function Header({ nick = "회원님" }) {
    return (
        <header
            style={{
                background: "transparent",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
            }}
        >
            <span
                style={{
                    fontSize: 13,
                    color: D.textLight,
                    fontWeight: 450,
                }}
            >
                ✿ {nick}님, 오늘도 어여쁜 하루 되세요
            </span>
        </header>
    );
}