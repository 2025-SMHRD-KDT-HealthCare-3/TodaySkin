/*
 * 메인 페이지 (Main)
 - GET  /api/challenge       현재 챌린지 조회
 - GET  /api/reports/daily   데일리 리포트
 - GET  /api/routine         루틴 조회
 - POST /api/challenge       챌린지 생성
 - PATCH /api/routine/:action_no  루틴 체크
*/

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import MainChallenge from "./MainChallenge";
import MainDashboard from "./MainDashboard";

export default function Main() {
    const navigate = useNavigate();
    const stored = localStorage.getItem("user");
    const nickname = stored ? JSON.parse(stored).nick : "";

    /* 페이지 상태 */
    const [pageCase, setPageCase] = useState(null);
    const [loading, setLoading] = useState(true);

    /* case 2, 3 — 챌린지 + 리포트 + 루틴 */
    const [challenge, setChallenge] = useState(null);
    const [report, setReport] = useState(null);
    const [routine, setRoutine] = useState(null);

    /* 데이터 로드 */
    useEffect(() => {
        const load = async () => {
            try {
                const [chalRes, reportRes, routineRes] = await Promise.allSettled([
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

                /* 리포트 → case 2/3 판별 */
                let reportData = null;
                if (reportRes.status === "fulfilled" && reportRes.value.ok) {
                    const reportJson = await reportRes.value.json();
                    if (reportJson.status === "success") {
                        reportData = reportJson.data;
                        setReport(reportData);
                    }
                }

                /* 챌린지는 있는데 분석 기록 자체가 없으면 → 분석 페이지로 이동 */
                if (reportData?.total_score == null) {
                    navigate("/analyze");
                    return;
                }

                setPageCase(reportData.has_today_analysis ? 3 : 2);

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

    return (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", fontFamily: "inherit" }}>
            <Header nick={nickname} />
            <div style={{ padding: "24px 15px", flex: 1 }}>
                {pageCase === 1 && <MainChallenge nickname={nickname} />}
                {(pageCase === 2 || pageCase === 3) && (
                    <MainDashboard
                        pageCase={pageCase}
                        challenge={challenge}
                        report={report}
                        routine={routine}
                        setRoutine={setRoutine}
                    />
                )}
            </div>
        </div>
    );
}