/*
 * 메인 > 챌린지 선택 (MainChallenge)
 - POST /api/challenge  챌린지 생성
*/

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import CTAButton from "../components/CTAButton";

export default function MainChallenge({ nickname }) {
    const navigate = useNavigate();
    const [chalType, setChalType] = useState(null);
    const [chalName, setChalName] = useState("");

    /* 챌린지 생성 핸들러 */
    const handleCreateChallenge = async () => {
        if (!chalType) return alert("챌린지 기간을 선택해주세요.");
        if (!chalName.trim()) return alert("챌린지 목표를 입력해주세요.");
        if (chalName.trim().length > 50) return alert("목표는 50자 이내로 입력해주세요.");

        try {
            const res = await fetch("/api/challenge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ chal_type: chalType, chal_name: chalName.trim() }),
            });
            const result = await res.json();
            if (result.status === "success") {
                navigate("/analyze");
            } else {
                alert(result.data?.message || "챌린지 생성에 실패했습니다.");
            }
        } catch (e) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    return (
        <>
        {/* ═══ CASE 1: 챌린지 선택 - 환영 메시지 ═══ */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
                <p style={{ fontSize: 14, color: D.cta, fontWeight: 600, marginBottom: 8 }}>
                    {nickname}님, 환영해요!
                </p>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: D.title, lineHeight: 1.5, margin: 0 }}>
                    피부 챌린지를 시작해볼까요?
                </h2>
                <p style={{ fontSize: 13, color: D.textLight, marginTop: 8, lineHeight: 1.6 }}>
                    매일 피부를 기록하고, AI 맞춤 루틴으로<br />
                    건강한 피부를 만들어가요
                </p>
            </div>

            {/* 기간 선택 카드 */}
            <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                {[7, 14].map((days) => {
                    const selected = chalType === days;
                    return (
                        <div key={days} onClick={() => setChalType(days)} style={{
                            flex: 1, padding: "20px 16px", borderRadius: 14,
                            border: `2px solid ${selected ? D.cta : D.border}`,
                            background: selected ? `${D.cta}08` : D.white,
                            cursor: "pointer", textAlign: "center", transition: "all 0.2s",
                        }}>
                            <div style={{
                                fontSize: 28, fontWeight: 700,
                                color: selected ? D.cta : D.title, marginBottom: 4,
                            }}>{days}일</div>
                            <div style={{ fontSize: 13, color: D.textLight }}>
                                {days === 7 ? "가볍게 시작하기" : "본격 피부 관리"}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 목표 입력 */}
            <div style={{ marginBottom: 32 }}>
                <label style={{
                    fontSize: 12, fontWeight: 600, color: D.textBody,
                    display: "block", marginBottom: 8, letterSpacing: "0.03em",
                }}>나의 챌린지 목표</label>
                <input type="text" placeholder="예) 피부미인이 되자!"
                    value={chalName} onChange={(e) => setChalName(e.target.value)} maxLength={50}
                    style={{
                        width: "100%", padding: "14px 16px", fontSize: 14,
                        border: `1px solid ${D.border}`, borderRadius: 10,
                        background: D.white, color: D.title, outline: "none",
                        fontFamily: "inherit", boxSizing: "border-box", transition: "border-color 0.2s",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = D.cta)}
                    onBlur={(e) => (e.target.style.borderColor = D.border)}
                />
                <div style={{ textAlign: "right", fontSize: 11, color: D.textLight, marginTop: 4 }}>
                    {chalName.length}/50
                </div>
            </div>

            {/* 시작 버튼 */}
            <CTAButton onClick={handleCreateChallenge} style={{
                opacity: chalType && chalName.trim() ? 1 : 0.5,
                pointerEvents: chalType && chalName.trim() ? "auto" : "none",
            }}>챌린지 시작하기</CTAButton>
        </>
    );
}