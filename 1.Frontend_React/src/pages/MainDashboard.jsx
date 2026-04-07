/*
 * 메인 > 대시보드 (MainDashboard)
 - GET  /api/reports/daily   데일리 리포트
 - GET  /api/routine         루틴 조회
 - PATCH /api/routine/:action_no  루틴 체크
*/

import React from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import CTAButton from "../components/CTAButton";

export default function MainDashboard({ pageCase, challenge, report, routine, setRoutine }) {
    const navigate = useNavigate();

    /* 점수 컬러 판별 */
    const getScoreColor = (score) => {
        if (score <= 40) return D.cta;
        if (score <= 80) return D.accent;
        return D.positive;
    };

    /* 루틴 체크 토글 핸들러 */
    const handleToggle = async (action_no, completed) => {
        try {
            const res = await fetch(`/api/routine/${action_no}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ completed }),
            });
            const result = await res.json();

            if (result.status === "success") {
                setRoutine((prev) => {
                    if (!prev) return prev;
                    const updated = { ...prev, routine: { ...prev.routine } };

                    ["morning", "evening", "special"].forEach((time) => {
                        updated.routine[time] = prev.routine[time].map((item) =>
                            item.action_no === action_no ? { ...item, completed } : item
                        );
                    });

                    /* 달성률 재계산 — 아침 + 저녁, 보유 항목만 */
                    const morningItems = updated.routine.morning || [];
                    const eveningItems = updated.routine.evening || [];
                    const ownedItems = [...morningItems, ...eveningItems].filter(
                        (i) => i.source === "보유"
                    );
                    const total = ownedItems.length;
                    const done = ownedItems.filter((i) => i.completed).length;
                    updated.cumulative_achievement_rate = total > 0 ? Math.round((done / total) * 100) : 0;

                    return updated;
                });
            }
        } catch (e) {
            console.error("루틴 체크 실패:", e);
        }
    };

    const timeLabels = {
        morning: "아침 기본 루틴",
        evening: "저녁 집중 케어",
        special: "스페셜 케어",
    };

    return (
        <>
            {/* ═══ CASE 2 & 3: 챌린지 진행 중 ═══ */}
            {/* 상단 배너 - 챌린지 D-day + 타이틀 */}
            <div style={{ textAlign: "center", marginBottom: 24 }}>
                <span style={{
                    display: "inline-block", padding: "5px 14px", borderRadius: 20,
                    background: `${D.cta}15`, color: D.cta, fontSize: 13, fontWeight: 600,
                    marginBottom: 10,
                }}>
                    챌린지 {challenge?.day_count || 1}일째 진행 중
                </span>

                {/* 챌린지 사용자 작성 목표 */}
                <h2 style={{ fontSize: 20, fontWeight: 700, color: D.title, lineHeight: 1.5, margin: 0 }}>
                    " {challenge?.chal_name || ""} "
                </h2>
                {/* AI 한줄 코멘트 */}
                <p style={{ fontSize: 13, color: D.textLight, marginTop: 6, lineHeight: 1.6 }}>
                    {report.line_comment}
                </p>
            </div>

            {/* case 2: 분석 유도 CTA */}
            {pageCase === 2 && (
                <CTAButton onClick={() => navigate("/analyze")} style={{ marginTop: 10, marginBottom: 20 }}>
                    오늘의 피부 분석하러 가기
                </CTAButton>
            )}

            {/* 가장 최근 분석 카드 */}
            {report && report.total_score !== null && (
                <div style={{
                    background: D.white, borderRadius: 14,
                    padding: "20px 18px", border: `1px solid ${D.border}`, marginBottom: 20,
                }}>
                    {/* 카드 헤더 */}
                    <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 16,
                    }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: D.title }}>가장 최근 분석</span>
                        <span style={{ fontSize: 12, color: D.textLight }}>
                            {report.report_date?.slice(0, 10) || ""}
                        </span>
                    </div>

                    {/* 점수 2개 — 큰 숫자 + 컬러 바 */}
                    <div style={{ display: "flex", gap: 16 }}>
                        {/* 피부진단점수 */}
                        <div style={{ flex: 1, textAlign: "center" }}>
                            <div style={{
                                fontSize: 36, fontWeight: 700,
                                color: getScoreColor(report.total_score), lineHeight: 1,
                            }}>{report.total_score}</div>
                            <div style={{ fontSize: 11, color: D.textLight, margin: "4px 0 8px" }}>/100</div>
                            <div style={{ height: 6, borderRadius: 3, background: D.border, overflow: "hidden" }}>
                                <div style={{
                                    width: `${report.total_score}%`, height: "100%", borderRadius: 3,
                                    background: getScoreColor(report.total_score), transition: "width 0.6s ease",
                                }} />
                            </div>
                            <div style={{ fontSize: 12, color: D.textBody, marginTop: 8, fontWeight: 500 }}>
                                피부진단점수(점)
                            </div>
                        </div>

                        {/* 구분선 */}
                        <div style={{ width: 1, background: D.border }} />

                        {/* 루틴달성률 */}
                        <div style={{ flex: 1, textAlign: "center" }}>
                            <div style={{
                                fontSize: 36, fontWeight: 700,
                                color: getScoreColor(routine?.cumulative_achievement_rate || 0), lineHeight: 1,
                            }}>{routine?.cumulative_achievement_rate || 0}</div>
                            <div style={{ fontSize: 11, color: D.textLight, margin: "4px 0 8px" }}>/100</div>
                            <div style={{ height: 6, borderRadius: 3, background: D.border, overflow: "hidden" }}>
                                <div style={{
                                    width: `${routine?.cumulative_achievement_rate || 0}%`, height: "100%", borderRadius: 3,
                                    background: getScoreColor(routine?.cumulative_achievement_rate || 0),
                                    transition: "width 0.6s ease",
                                }} />
                            </div>
                            <div style={{ fontSize: 12, color: D.textBody, marginTop: 8, fontWeight: 500 }}>
                                루틴달성률(%)
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 추천 루틴카드 */}
            {routine && routine.routine && (
                <div>
                    <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center", marginBottom: 14,
                    }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: D.title }}>추천 루틴카드</span>
                        <span style={{ fontSize: 13, color: D.cta, fontWeight: 500, cursor: "pointer" }}>전체보기</span>
                    </div>

                    {["morning", "evening", "special"].map((time) => {
                        const items = routine.routine[time] || [];
                        if (items.length === 0) return null;

                        return (
                            <div key={time} style={{
                                background: D.white, borderRadius: 14,
                                border: `1px solid ${D.border}`,
                                padding: "16px 18px", marginBottom: 12,
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: D.title, marginBottom: 12 }}>
                                    {timeLabels[time]}
                                </div>

                                {items.map((item, idx) => (
                                    <div key={item.action_no} style={{
                                        display: "flex", alignItems: "center",
                                        padding: "10px 0", borderBottom: `1px solid ${D.border}`,
                                    }}>
                                        {/* 순서 번호 (왼쪽 원형) */}
                                        <span style={{
                                            width: 24, height: 24, borderRadius: "50%",
                                            background: item.completed ? D.positive : D.bgSub,
                                            color: item.completed ? D.white : D.textLight,
                                            fontSize: 12, fontWeight: 600,
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            flexShrink: 0, marginRight: 10, transition: "all 0.2s",
                                        }}>
                                            {item.completed ? "✓" : item.order || idx + 1}
                                        </span>

                                        {/* 제품명 */}
                                        <span style={{
                                            flex: 1, fontSize: 14, color: D.textBody,
                                            textDecoration: item.completed ? "line-through" : "none",
                                            opacity: item.completed ? 0.6 : 1,
                                        }}>
                                            {item.name}
                                            {item.description && item.description !== item.name && (
                                                <span style={{
                                                    display: "block",
                                                    fontSize: 11,
                                                    color: D.textLight,
                                                    fontWeight: 400,
                                                    marginTop: 2,
                                                    textDecoration: "none",
                                                }}>
                                                    {item.description}
                                                </span>
                                            )}
                                        </span>

                                        {/* 보유/추천 태그 */}
                                        {item.source && (
                                            <span style={{
                                                fontSize: 11, padding: "2px 8px", borderRadius: 10,
                                                background: item.source === "보유" ? `${D.positive}15` : `${D.accent}15`,
                                                color: item.source === "보유" ? D.positive : D.accent,
                                                fontWeight: 500, flexShrink: 0, marginRight: 8,
                                            }}>{item.source}</span>
                                        )}

                                        {/* 완료 버튼 (오른쪽) — 추천/스페셜 제외 */}
                                        {item.source !== "추천" && time !== "special" && (
                                            <span
                                                onClick={() => handleToggle(item.action_no, !item.completed)}
                                                style={{
                                                    padding: "4px 12px", borderRadius: 8,
                                                    fontSize: 12, fontWeight: 600,
                                                    background: item.completed ? D.positive : D.border,
                                                    color: item.completed ? D.white : D.textLight,
                                                    cursor: "pointer", transition: "all 0.2s", flexShrink: 0,
                                                }}
                                            >
                                                {item.completed ? "완료!" : "완료"}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}