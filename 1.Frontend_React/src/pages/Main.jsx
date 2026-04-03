/*
 * 메인 페이지 (Main)
 - GET  /api/challenge       현재 챌린지 조회
 - GET  /api/reports/daily   데일리 리포트 (점수 + 분석 유무)
 - GET  /api/routine         루틴 조회
 - POST /api/challenge       챌린지 생성
 - PATCH /api/routine/:action_no  루틴 체크
*/

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";

export default function Main() {
    const navigate = useNavigate();
    const stored = localStorage.getItem("user");
    const nickname = stored ? JSON.parse(stored).nick : "";

    /* 페이지 상태 */
    const [pageCase, setPageCase] = useState(null); // 1, 2, 3
    const [loading, setLoading] = useState(true);

    /* case 1 — 챌린지 선택 */
    const [chalType, setChalType] = useState(null); // 7 or 14
    const [chalName, setChalName] = useState("");

    /* case 2, 3 — 챌린지 + 리포트 + 루틴 */
    const [challenge, setChallenge] = useState(null);
    const [skinResult, setSkinResult] = useState(null);
    const [routine, setRoutine] = useState(null);

    /* 데이터 로드 */
    useEffect(() => {
        const load = async () => {
            try {
                const [chalRes, skinRes, routineRes] = await Promise.allSettled([
                    fetch("/api/challenge", { credentials: "include" }),
                    fetch("/api/reports/daily", { credentials: "include" }),
                    fetch("/api/routine", { credentials: "include" }),
                ]);

                /* 챌린지 판별 */
                let chalData = null;
                if (chalRes.status === "fulfilled" && chalRes.value.ok) {
                    const chalJson = await chalRes.value.json();
                    if (chalJson.status === "success" && chalJson.data && chalJson.data.chal_status === "진행중") {
                        chalData = chalJson.data;
                        setChallenge(chalData);
                    }
                }

                /* 챌린지 없음 → case 1 */
                if (!chalData) {
                    setPageCase(1);
                    setLoading(false);
                    return;
                }

                /* 스킨 결과로 오늘 분석 유무 판별 */
                if (skinRes.status === "fulfilled" && skinRes.value.ok) {
                    const skinJson = await skinRes.value.json();
                    if (skinJson.status === "success") {
                        const analysisDate = skinJson.data.created_at?.slice(0, 10);
                        const now = new Date();
                        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

                        setSkinResult(skinJson.data);
                        setPageCase(analysisDate === today ? 3 : 2);
                    } else {
                        setPageCase(2);
                    }
                } else {
                    setPageCase(2);
                }

                /* 루틴 */
                if (routineRes.status === "fulfilled" && routineRes.value.ok) {
                    const routineJson = await routineRes.value.json();
                    if (routineJson.status === "success") {
                        setRoutine(routineJson.data);
                    }
                }
            } catch (e) {
                console.error("메인 데이터 로드 실패:", e);
                setPageCase(1);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

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
                            item.action_no === action_no
                                ? { ...item, completed }
                                : item
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

    /* 점수 컬러 판별 */
    const getScoreColor = (score) => {
        if (score <= 40) return D.cta;
        if (score <= 80) return D.accent;
        return D.positive;
    };

    /* 로딩 */
    if (loading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
                <Header nick={nickname} />
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <p style={{ color: D.textLight, fontSize: 14 }}>불러오는 중...</p>
                </div>
            </div>
        );
    }

    /* ───── 렌더링 시작 ───── */
    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
            <Header nick={nickname} />

            <div style={{ padding: "24px 15px", flex: 1 }}>

                {/* ═══ CASE 1: 챌린지 선택 ═══ */}
                {pageCase === 1 && (
                    <>
                        {/* 환영 메시지 */}
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
                                    <div
                                        key={days}
                                        onClick={() => setChalType(days)}
                                        style={{
                                            flex: 1,
                                            padding: "20px 16px",
                                            borderRadius: 14,
                                            border: `2px solid ${selected ? D.cta : D.border}`,
                                            background: selected ? `${D.cta}08` : D.white,
                                            cursor: "pointer",
                                            textAlign: "center",
                                            transition: "all 0.2s",
                                        }}
                                    >
                                        <div style={{
                                            fontSize: 28, fontWeight: 700,
                                            color: selected ? D.cta : D.title,
                                            marginBottom: 4,
                                        }}>
                                            {days}일
                                        </div>
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
                            }}>
                                나의 챌린지 목표
                            </label>
                            <input
                                type="text"
                                placeholder="예) 피부미인이 되자!"
                                value={chalName}
                                onChange={(e) => setChalName(e.target.value)}
                                maxLength={50}
                                style={{
                                    width: "100%",
                                    padding: "14px 16px",
                                    fontSize: 14,
                                    border: `1px solid ${D.border}`,
                                    borderRadius: 10,
                                    background: D.white,
                                    color: D.title,
                                    outline: "none",
                                    fontFamily: "inherit",
                                    boxSizing: "border-box",
                                    transition: "border-color 0.2s",
                                }}
                                onFocus={(e) => (e.target.style.borderColor = D.cta)}
                                onBlur={(e) => (e.target.style.borderColor = D.border)}
                            />
                            <div style={{
                                textAlign: "right", fontSize: 11, color: D.textLight, marginTop: 4,
                            }}>
                                {chalName.length}/50
                            </div>
                        </div>

                        {/* 시작 버튼 */}
                        <CTAButton
                            onClick={handleCreateChallenge}
                            style={{
                                opacity: chalType && chalName.trim() ? 1 : 0.5,
                                pointerEvents: chalType && chalName.trim() ? "auto" : "none",
                            }}
                        >
                            챌린지 시작하기
                        </CTAButton>
                    </>
                )}

                {/* ═══ CASE 2 & 3: 챌린지 진행 중 ═══ */}
                {(pageCase === 2 || pageCase === 3) && (
                    <>
                        {/* 상단 배너 — 챌린지 D-day + 타이틀 */}
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                            <span style={{
                                display: "inline-block", padding: "5px 14px", borderRadius: 20,
                                background: `${D.cta}15`, color: D.cta, fontSize: 13, fontWeight: 600,
                                marginBottom: 10,
                            }}>
                                챌린지 {challenge?.day_count || 1}일째 진행 중
                            </span>
                            <h2 style={{ fontSize: 20, fontWeight: 700, color: D.title, lineHeight: 1.5, margin: 0 }}>
                                오늘도 피부를 위한 한 걸음
                            </h2>
                            <p style={{ fontSize: 13, color: D.textLight, marginTop: 6, lineHeight: 1.6 }}>
                                AI가 분석한 맞춤 루틴으로 건강한 피부를 만들어가요
                            </p>
                        </div>

                        {/* case 2: 분석 유도 CTA */}
                        {pageCase === 2 && (
                            <CTAButton onClick={() => navigate("/analyze")} style={{ marginBottom: 20 }}>
                                오늘의 피부 분석하러 가기
                            </CTAButton>
                        )}

                        {/* 가장 최근 분석 카드 */}
                        {skinResult && skinResult.total_score !== null && (
                            <div style={{
                                background: D.white,
                                borderRadius: 14,
                                padding: "20px 18px",
                                border: `1px solid ${D.border}`,
                                marginBottom: 20,
                            }}>
                                {/* 카드 헤더 */}
                                <div style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "center", marginBottom: 16,
                                }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: D.title }}>
                                        가장 최근 분석
                                    </span>
                                    <span style={{ fontSize: 12, color: D.textLight }}>
                                        {skinResult.created_at?.slice(0, 10) || ""}
                                    </span>
                                </div>

                                {/* 점수 2개 — 큰 숫자 + 컬러 바 */}
                                <div style={{ display: "flex", gap: 16 }}>
                                    {/* 피부진단점수 */}
                                    <div style={{ flex: 1, textAlign: "center" }}>
                                        <div style={{
                                            fontSize: 36, fontWeight: 700,
                                            color: getScoreColor(skinResult.total_score),
                                            lineHeight: 1,
                                        }}>
                                            {skinResult.total_score}
                                        </div>
                                        <div style={{ fontSize: 11, color: D.textLight, margin: "4px 0 8px" }}>/100</div>
                                        <div style={{
                                            height: 6, borderRadius: 3, background: D.border, overflow: "hidden",
                                        }}>
                                            <div style={{
                                                width: `${skinResult.total_score}%`, height: "100%", borderRadius: 3,
                                                background: getScoreColor(skinResult.total_score),
                                                transition: "width 0.6s ease",
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
                                            color: getScoreColor(routine?.cumulative_achievement_rate || 0),
                                            lineHeight: 1,
                                        }}>
                                            {routine?.cumulative_achievement_rate || 0}
                                        </div>
                                        <div style={{ fontSize: 11, color: D.textLight, margin: "4px 0 8px" }}>/100</div>
                                        <div style={{
                                            height: 6, borderRadius: 3, background: D.border, overflow: "hidden",
                                        }}>
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

                                {/* AI 한줄 코멘트 */}
                                {skinResult.line_comment && (
                                    <div style={{
                                        marginTop: 16, padding: "12px 14px", borderRadius: 10,
                                        background: D.bgSub, fontSize: 13, color: D.textBody,
                                        lineHeight: 1.6,
                                    }}>
                                        {skinResult.line_comment}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 추천 루틴카드 */}
                        {routine && routine.routine && (
                            <div>
                                <div style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "center", marginBottom: 14,
                                }}>
                                    <span style={{ fontSize: 16, fontWeight: 700, color: D.title }}>
                                        추천 루틴카드
                                    </span>
                                    <span style={{ fontSize: 13, color: D.cta, fontWeight: 500, cursor: "pointer" }}>
                                        전체보기
                                    </span>
                                </div>

                                {["morning", "evening", "special"].map((time) => {
                                    const items = routine.routine[time] || [];
                                    if (items.length === 0) return null;

                                    const timeLabels = {
                                        morning: "아침 기본 루틴",
                                        evening: "저녁 집중 케어",
                                        special: "스페셜 케어",
                                    };

                                    return (
                                        <div key={time} style={{
                                            background: D.white,
                                            borderRadius: 14,
                                            border: `1px solid ${D.border}`,
                                            padding: "16px 18px",
                                            marginBottom: 12,
                                        }}>
                                            <div style={{
                                                fontSize: 14, fontWeight: 700, color: D.title, marginBottom: 12,
                                            }}>
                                                {timeLabels[time]}
                                            </div>

                                            {items.map((item, idx) => (
                                                <div
                                                    key={item.action_no}
                                                    style={{
                                                        display: "flex", alignItems: "center",
                                                        padding: "10px 0",
                                                        borderBottom: `1px solid ${D.border}`,
                                                    }}
                                                >
                                                    {/* 순서 번호 (왼쪽 원형) */}
                                                    <span style={{
                                                        width: 24, height: 24, borderRadius: "50%",
                                                        background: item.completed ? D.positive : D.bgSub,
                                                        color: item.completed ? D.white : D.textLight,
                                                        fontSize: 12, fontWeight: 600,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        flexShrink: 0, marginRight: 10,
                                                        transition: "all 0.2s",
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
                                                    </span>

                                                    {/* 보유/추천 태그 */}
                                                    {item.source && (
                                                        <span style={{
                                                            fontSize: 11, padding: "2px 8px", borderRadius: 10,
                                                            background: item.source === "보유" ? `${D.positive}15` : `${D.accent}15`,
                                                            color: item.source === "보유" ? D.positive : D.accent,
                                                            fontWeight: 500, flexShrink: 0, marginRight: 8,
                                                        }}>
                                                            {item.source}
                                                        </span>
                                                    )}

                                                    {/* 완료 버튼 (오른쪽) */}
                                                    <span
                                                        onClick={() => handleToggle(item.action_no, !item.completed)}
                                                        style={{
                                                            padding: "4px 12px", borderRadius: 8,
                                                            fontSize: 12, fontWeight: 600,
                                                            background: item.completed ? D.positive : D.border,
                                                            color: item.completed ? D.white : D.textLight,
                                                            cursor: "pointer",
                                                            transition: "all 0.2s",
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {item.completed ? "완료!" : "완료"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}