/*
 * 챌린지 히스토리 (ChalHistory)
 - GET /api/challenge/history  지난 챌린지 기록 조회
 - GET /api/challenge          현재 진행중 챌린지 조회
*/

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Spinner from "../components/Spinner";

export default function ChalHistory() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [current, setCurrent] = useState(null);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        const load = async () => {
            try {
                const [curRes, histRes] = await Promise.allSettled([
                    fetch("/api/challenge", { credentials: "include" }),
                    fetch("/api/challenge/history", { credentials: "include" }),
                ]);

                if (curRes.status === "fulfilled" && curRes.value.ok) {
                    const curJson = await curRes.value.json();
                    if (curJson.status === "success" && curJson.data?.chal_status === "진행중") {
                        setCurrent(curJson.data);
                    }
                }

                if (histRes.status === "fulfilled" && histRes.value.ok) {
                    const histJson = await histRes.value.json();
                    if (histJson.status === "success") {
                        setHistory(histJson.data || []);
                    }
                }
            } catch (e) {
                console.error("히스토리 로드 실패:", e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    /* 날짜 포맷 (YY/MM/DD) */
    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const yy = String(d.getFullYear()).slice(2);
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yy}/${mm}/${dd}`;
    };

    /* 상태별 색상 */
    const statusStyle = (status) => {
        switch (status) {
            case "완료":
                return { color: D.positive, bg: `${D.positive}15` };
            case "진행중":
                return { color: D.accent, bg: `${D.accent}15` };
            case "중단":
                return { color: D.warning, bg: `${D.warning}15` };
            default:
                return { color: D.textLight, bg: D.bgSub };
        }
    };

    /* 챌린지 항목 렌더 */
    const renderItem = (item) => {
        const ss = statusStyle(item.chal_status);
        return (
            <div
                key={item.chal_no}
                onClick={() => navigate(`/report?chal_no=${item.chal_no}`)}
                style={{
                    display: "flex", alignItems: "center",
                    padding: "14px 0",
                    borderBottom: `1px solid ${D.border}`,
                    cursor: "pointer",
                }}
            >
                {/* 상태 태그 */}
                <span style={{
                    fontSize: 12, fontWeight: 600, padding: "4px 10px",
                    borderRadius: 8, color: ss.color, background: ss.bg,
                    flexShrink: 0, minWidth: 44, textAlign: "center",
                }}>
                    {item.chal_status}
                </span>

                {/* 기간 + 목표 */}
                <div style={{ flex: 1, marginLeft: 14 }}>
                    <div style={{ fontSize: 14, color: D.title }}>
                        {formatDate(item.start_date)} ~ {formatDate(item.end_date)}
                    </div>
                    {item.chal_name && (
                        <div style={{ fontSize: 12, color: D.textLight, marginTop: 2 }}>
                            {item.chal_name}
                        </div>
                    )}
                </div>

                {/* 화살표 */}
                <span style={{ color: D.textLight, fontSize: 14, flexShrink: 0 }}>&gt;&gt;</span>
            </div>
        );
    };

    if (loading) {
        return (
            <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
                <div style={{ flex: 1 }}>
                    <Spinner message="챌린지 기록을 불러오는 중..." />
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>

            <div style={{ padding: "24px 15px" }}>

                {/* 타이틀 */}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: D.title, margin: 0, marginBottom: 6 }}>
                    Challenge History
                </h2>
                <p style={{ fontSize: 14, color: D.textLight, marginBottom: 24 }}>
                    지난 챌린지 기록 확인
                </p>

                {/* 리스트 카드 */}
                <div style={{
                    background: D.white, borderRadius: 14,
                    border: `1px solid ${D.border}`, padding: "4px 18px",
                }}>
                    {/* 현재 진행중 */}
                    {current && renderItem({ ...current, chal_status: "진행중" })}

                    {/* 과거 기록 */}
                    {history.length > 0 ? (
                        history.map((item) => renderItem(item))
                    ) : (
                        !current && (
                            <div style={{
                                padding: "40px 0", textAlign: "center",
                                fontSize: 14, color: D.textLight,
                            }}>
                                챌린지 기록이 없습니다
                            </div>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}