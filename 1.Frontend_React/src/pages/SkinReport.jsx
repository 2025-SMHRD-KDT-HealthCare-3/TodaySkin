/*
 * 피부변화 리포트 (SkinReport)
 - GET /api/challenge                    현재 챌린지 조회
 - GET /api/reports/challenge/:chal_no   피부 변화 + 달성률
 - GET /api/skin/history                 날짜별 점수 (차트)
*/

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";
import Spinner from "../components/Spinner";

export default function SkinReport() {
    const navigate = useNavigate();
    const stored = localStorage.getItem("user");
    const nickname = stored ? JSON.parse(stored).nick : "";

    const [loading, setLoading] = useState(true);
    const [challenge, setChallenge] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [scoreHistory, setScoreHistory] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                /* 1) 현재 챌린지 조회 */
                const chalRes = await fetch("/api/challenge", { credentials: "include" });
                const chalJson = await chalRes.json();

                if (chalJson.status !== "success" || !chalJson.data) {
                    setLoading(false);
                    return;
                }

                const chalData = chalJson.data;
                setChallenge(chalData);

                /* 2) 피부 변화 리포트 + 달성률 */
                const [reportRes, historyRes] = await Promise.allSettled([
                    fetch(`/api/reports/challenge/${chalData.chal_no}`, { credentials: "include" }),
                    fetch("/api/skin/history", { credentials: "include" }),
                ]);

                if (reportRes.status === "fulfilled" && reportRes.value.ok) {
                    const reportJson = await reportRes.value.json();
                    if (reportJson.status === "success") {
                        setReportData(reportJson.data);
                    }
                }

                /* 3) 점수 히스토리 — 챌린지 기간만 필터 */
                if (historyRes.status === "fulfilled" && historyRes.value.ok) {
                    const historyJson = await historyRes.value.json();
                    if (historyJson.status === "success") {
                        const sd = new Date(chalData.start_date);
                        const startDate = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, "0")}-${String(sd.getDate()).padStart(2, "0")}`;
                        const filtered = historyJson.data.filter(
                            (item) => item.date?.slice(0, 10) >= startDate
                        );

                        /* 날짜별 최신 1건만 (history는 DESC 정렬이라 첫 번째가 최신) */
                        const uniqueByDate = [];
                        const seen = new Set();
                        filtered.forEach((item) => {
                            const date = item.date?.slice(0, 10);
                            if (!seen.has(date)) {
                                seen.add(date);
                                uniqueByDate.push(item);
                            }
                        });
                        setScoreHistory(uniqueByDate.reverse());
                    }
                }
            } catch (e) {
                console.error("리포트 로드 실패:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    /* 점수 컬러 */
    const getScoreColor = (score) => {
        if (score <= 40) return D.cta;
        if (score <= 80) return D.accent;
        return D.positive;
    };

    /* 날짜 포맷 (YYYY-MM-DD → MM/DD) */
    const shortDate = (dateStr) => {
        if (!dateStr) return "";
        const parts = dateStr.slice(0, 10).split("-");
        return `${Number(parts[1])}/${Number(parts[2])}`;
    };

    /* 날짜 포맷 (YYYY-MM-DD → YYYY.MM.DD) */
    const dotDate = (dateStr) => {
        if (!dateStr) return "";
        return dateStr.slice(0, 10).replace(/-/g, ".");
    };

    /* SVG 차트 생성 헬퍼 */
    const renderChart = (data, valueKey, label, tagColor) => {
        if (!data || data.length === 0) return null;

        const chartW = 320, chartH = 160;
        const padL = 36, padR = 16, padT = 20, padB = 28;
        const plotW = chartW - padL - padR;
        const plotH = chartH - padT - padB;
        const maxVal = 100;

        const points = data.map((d, i) => ({
            x: padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW),
            y: padT + plotH - ((d[valueKey] || 0) / maxVal) * plotH,
            value: d[valueKey] || 0,
            date: d.date,
        }));

        const pathD = points.map((p, i) => {
            if (i === 0) return `M${p.x},${p.y}`;
            const prev = points[i - 1];
            const cpx1 = prev.x + (p.x - prev.x) * 0.4;
            const cpx2 = p.x - (p.x - prev.x) * 0.4;
            return `C${cpx1},${prev.y} ${cpx2},${p.y} ${p.x},${p.y}`;
        }).join(" ");

        const areaD = pathD + ` L${points[points.length - 1].x},${chartH - padB} L${points[0].x},${chartH - padB} Z`;
        const lastPoint = points[points.length - 1];

        return (
            <div style={{
                background: D.white, borderRadius: 14,
                border: `1px solid ${D.border}`, padding: "20px 18px", marginBottom: 16,
            }}>
                {/* 헤더 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div>
                        <span style={{ fontSize: 32, fontWeight: 700, color: D.title }}>
                            {Math.round(data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0) / data.length)}
                        </span>
                        <span style={{ fontSize: 14, color: D.textLight, marginLeft: 4 }}>/100</span>
                    </div>
                    <span style={{
                        padding: "4px 12px", borderRadius: 20,
                        background: `${tagColor}15`, color: tagColor,
                        fontSize: 13, fontWeight: 600,
                    }}>{label}</span>
                </div>

                {/* 차트 */}
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: "100%", height: "auto" }}>
                    <defs>
                        <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={tagColor} stopOpacity="0.15" />
                            <stop offset="100%" stopColor={tagColor} stopOpacity="0.02" />
                        </linearGradient>
                    </defs>

                    {/* 그리드 */}
                    {[20, 40, 60, 80, 100].map((v) => {
                        const y = padT + plotH - (v / maxVal) * plotH;
                        return (
                            <g key={v}>
                                <line x1={padL} y1={y} x2={chartW - padR} y2={y}
                                    stroke={D.border} strokeWidth="0.5" strokeDasharray="3,3" />
                                <text x={padL - 6} y={y + 4} textAnchor="end"
                                    fontSize="10" fill={D.textLight}>{v}</text>
                            </g>
                        );
                    })}

                    {/* 영역 + 라인 */}
                    <path d={areaD} fill={`url(#grad-${valueKey})`} />
                    <path d={pathD} fill="none" stroke={tagColor} strokeWidth="2" strokeLinecap="round" />

                    {/* 포인트 + 날짜 */}
                    {points.map((p, i) => (
                        <g key={i}>
                            {/* 점수 라벨 */}
                            <text x={p.x} y={p.y - 10} textAnchor="middle"
                                fontSize="9" fontWeight="600" fill={D.textBody}>
                                {Math.round(p.value)}
                            </text>
                            <circle cx={p.x} cy={p.y}
                                r={i === points.length - 1 ? 5 : 3}
                                fill={i === points.length - 1 ? tagColor : D.white}
                                stroke={tagColor} strokeWidth="2" />
                            <text x={p.x} y={chartH - 8} textAnchor="middle"
                                fontSize="10" fill={D.textLight}>
                                {shortDate(p.date)}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>
        );
    };

    // 로딩화면
    if (loading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
                <Header nick={nickname} />
                <div style={{ flex: 1 }}>
                    <Spinner message="리포트를 준비하고 있어요" />
                </div>
            </div>
        );
    }

    if (!challenge) {
        return (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
                <Header nick={nickname} />
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
                    <p style={{ color: D.textLight, fontSize: 14 }}>진행 중인 챌린지가 없습니다</p>
                    <CTAButton onClick={() => navigate("/")} style={{ width: "auto", padding: "12px 32px" }}>
                        홈으로 돌아가기
                    </CTAButton>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
            <Header nick={nickname} />

            <div style={{ padding: "24px 15px" }}>

                {/* 타이틀 + 히스토리 아이콘 */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: D.title, margin: 0 }}>
                            피부변화 리포트
                        </h2>
                        <p style={{ fontSize: 14, color: D.textLight, marginTop: 6 }}>
                            진행중 챌린지 피부 점수 변화
                        </p>
                    </div>
                    {/* 히스토리 아이콘 */}
                    <button onClick={() => navigate("/challenge")} style={{
                        background: "none", border: "none", cursor: "pointer", padding: 6, marginTop: 2,
                    }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={D.textLight} strokeWidth="1.5">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                    </button>
                </div>

                {/* 피부진단점수 차트 */}
                {renderChart(scoreHistory, "total_score", "평균 피부진단점수", D.cta)}

                {/* 달성률 차트 */}
                {reportData?.daily_rates && renderChart(reportData.daily_rates, "rate", "평균 루틴달성률", D.positive)}

                {/* 이미지 비교 */}
                {reportData && (reportData.first_day?.image_url || reportData.latest_day?.image_url) && (
                    <div style={{
                        background: D.white, borderRadius: 14,
                        border: `1px solid ${D.border}`, padding: "20px 18px", marginBottom: 16,
                    }}>
                        <p style={{ fontSize: 15, fontWeight: 700, color: D.title, marginBottom: 4 }}>
                            변화추이 사진비교
                        </p>
                        <p style={{ fontSize: 12, color: D.textLight, marginBottom: 16 }}>
                            두 시점의 피부 사진을 비교해보세요
                        </p>

                        <div style={{ display: "flex", gap: 12 }}>
                            {/* 첫날 */}
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 12, color: D.textLight, textAlign: "center", marginBottom: 8 }}>이전</p>
                                {reportData.first_day?.image_url ? (
                                    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                                        <img src={reportData.first_day.image_url} alt="첫날"
                                            style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                                        <div style={{
                                            position: "absolute", bottom: 0, left: 0, right: 0,
                                            padding: "8px 10px", background: "rgba(0,0,0,0.5)",
                                            color: D.white, fontSize: 11,
                                        }}>
                                            <div>{dotDate(reportData.first_day.created_at)}</div>
                                            <div>점수: {reportData.first_day.total_score}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        aspectRatio: "3/4", borderRadius: 12, background: D.bgSub,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 13, color: D.textLight,
                                    }}>사진 없음</div>
                                )}
                            </div>

                            {/* 최신 */}
                            <div style={{ flex: 1 }}>
                                <p style={{ fontSize: 12, color: D.textLight, textAlign: "center", marginBottom: 8 }}>현재</p>
                                {reportData.latest_day?.image_url ? (
                                    <div style={{ position: "relative", borderRadius: 12, overflow: "hidden" }}>
                                        <img src={reportData.latest_day.image_url} alt="최신"
                                            style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }} />
                                        <div style={{
                                            position: "absolute", bottom: 0, left: 0, right: 0,
                                            padding: "8px 10px", background: "rgba(0,0,0,0.5)",
                                            color: D.white, fontSize: 11,
                                        }}>
                                            <div>{dotDate(reportData.latest_day.created_at)}</div>
                                            <div>점수: {reportData.latest_day.total_score}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{
                                        aspectRatio: "3/4", borderRadius: 12, background: D.bgSub,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 13, color: D.textLight,
                                    }}>사진 없음</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 루틴 다시 시작하기 */}
                <CTAButton onClick={async () => {
                    if (!window.confirm("현재 챌린지를 종료하고 새로 시작할까요?")) return;
                    try {
                        const res = await fetch("/api/challenge/stop", {
                            method: "PATCH",
                            credentials: "include",
                        });
                        const result = await res.json();
                        if (result.status === "success") {
                            navigate("/");
                        } else {
                            alert("챌린지 종료에 실패했습니다.");
                        }
                    } catch (e) {
                        alert("서버 연결에 실패했습니다.");
                    }
                }}>
                    루틴 다시 시작하기
                </CTAButton>
            </div>
        </div>
    );
}