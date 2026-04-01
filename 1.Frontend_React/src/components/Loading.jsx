/*
 * Loading — AI 피부분석 로딩 오버레이
 - 꽃 블룸 애니메이션 + 진행률 바
 - onDone: 분석 완료 시 호출되는 콜백
*/

import React, { useState, useEffect, useRef } from "react";
import { D } from "../styles/design";

/* 꽃 애니메이션 1사이클 시간 (ms) */
const CYCLE_DURATION = 3200;

/* 키프레임 — 이 컴포넌트에서만 사용 */
const LOADING_KEYFRAMES = `
@keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes petalScale { 0%{transform:scale(0);opacity:0} 70%{transform:scale(1.08);opacity:1} 100%{transform:scale(1);opacity:1} }
@keyframes flowerCycle { 0%{opacity:0;transform:scale(0.8)} 10%{opacity:1;transform:scale(1)} 55%{opacity:1;transform:scale(1)} 75%{opacity:1;transform:scale(1.05) rotate(8deg)} 95%{opacity:0;transform:scale(0.6) rotate(15deg)} 100%{opacity:0;transform:scale(0.5)} }
@keyframes floatUp { 0%{transform:translateY(0) rotate(0deg);opacity:0.7} 100%{transform:translateY(-60px) rotate(15deg);opacity:0} }
@keyframes dotPulse { 0%,80%,100%{opacity:0.3} 40%{opacity:1} }
`;

export default function Loading({ onDone }) {
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState("분석을 위해 피부 이미지를 정밀하게 스캔하고 있어요");
    const [cycle, setCycle] = useState(0);
    const doneRef = useRef(false);

    /* 진행률 카운터 + 상태 메시지 전환 */
    useEffect(() => {
        const msgs = [
            { at: 0, text: "분석을 위해 피부 이미지를 정밀하게 스캔하고 있어요" },
            { at: 25, text: "피부 표면의 세부 특징들을 탐색하고 있어요" },
            { at: 50, text: "추출된 데이터를 바탕으로 집중 분석을 진행 중이에요" },
            { at: 75, text: "분석된 정보를 종합하여 컨디션을 체크하고 있어요" },
            { at: 95, text: "당신만을 위한 맞춤형 결과를 정리하고 있어요" },
        ];

        const interval = setInterval(() => {
            setProgress((p) => {
                const next = Math.min(p + 1, 100);
                const msg = [...msgs].reverse().find((m) => next >= m.at);
                if (msg) setStatusText(msg.text);

                if (next >= 100 && !doneRef.current) {
                    doneRef.current = true;
                    clearInterval(interval);
                    setTimeout(() => onDone?.(), 800);
                }
                return next;
            });
        }, 50);

        return () => clearInterval(interval);
    }, [onDone]);

    /* 꽃 애니메이션 반복 (key 변경으로 CSS 리마운트) */
    useEffect(() => {
        if (doneRef.current) return;
        const timer = setInterval(() => {
            if (!doneRef.current) setCycle((c) => c + 1);
        }, CYCLE_DURATION);
        return () => clearInterval(timer);
    }, []);

    /* 꽃잎 8장 설정 */
    const petals = [
        { angle: 0, delay: 0.0, color: `${D.cta}CC` },
        { angle: 45, delay: 0.08, color: `${D.secondary}CC` },
        { angle: 90, delay: 0.16, color: `${D.cta}99` },
        { angle: 135, delay: 0.24, color: `${D.accent}BB` },
        { angle: 180, delay: 0.32, color: `${D.cta}CC` },
        { angle: 225, delay: 0.40, color: `${D.secondary}BB` },
        { angle: 270, delay: 0.48, color: `${D.cta}99` },
        { angle: 315, delay: 0.56, color: `${D.accent}CC` },
    ];

    return (
        <>
            <style>{LOADING_KEYFRAMES}</style>

            <div style={{
                position: "fixed", inset: 0, zIndex: 200,
                background: `linear-gradient(160deg, ${D.bgMain} 0%, ${D.bgSub} 100%)`,
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
            }}>
                {/* 배경 파티클 */}
                {[...Array(6)].map((_, i) => (
                    <div key={i} style={{
                        position: "absolute",
                        width: 6 + i * 2, height: 6 + i * 2,
                        borderRadius: "50%",
                        background: [D.cta, D.secondary, D.accent, D.positive, D.nav, D.cta][i],
                        opacity: 0.15,
                        left: `${15 + i * 14}%`,
                        bottom: `${20 + (i % 3) * 20}%`,
                        animation: `floatUp ${3 + i * 0.5}s ${i * 0.8}s ease-in infinite`,
                    }} />
                ))}

                {/* 꽃 애니메이션 — key 변경으로 사이클 반복 */}
                <div key={cycle} style={{
                    marginBottom: 40,
                    animation: `flowerCycle ${CYCLE_DURATION}ms ease both`,
                }}>
                    <svg width="140" height="140" viewBox="0 0 140 140" style={{ overflow: "visible" }}>
                        {/* 바깥 꽃잎 */}
                        {petals.map((p, i) => {
                            const rad = (p.angle - 90) * Math.PI / 180;
                            const cx = 70 + Math.cos(rad) * 30;
                            const cy = 70 + Math.sin(rad) * 30;
                            return (
                                <g key={i} style={{
                                    transformOrigin: `${cx}px ${cy}px`,
                                    animation: `petalScale 0.8s ${p.delay}s cubic-bezier(0.34,1.56,0.64,1) both`,
                                }}>
                                    <ellipse cx={cx} cy={cy} rx="14" ry="24"
                                        fill={p.color}
                                        transform={`rotate(${p.angle}, ${cx}, ${cy})`} />
                                </g>
                            );
                        })}
                        {/* 안쪽 꽃잎 */}
                        {petals.map((p, i) => {
                            const offsetAngle = p.angle + 22.5;
                            const rad = (offsetAngle - 90) * Math.PI / 180;
                            const cx = 70 + Math.cos(rad) * 18;
                            const cy = 70 + Math.sin(rad) * 18;
                            return (
                                <g key={`inner-${i}`} style={{
                                    transformOrigin: `${cx}px ${cy}px`,
                                    animation: `petalScale 0.7s ${p.delay + 0.5}s cubic-bezier(0.34,1.56,0.64,1) both`,
                                }}>
                                    <ellipse cx={cx} cy={cy} rx="10" ry="17"
                                        fill={p.color} opacity="0.5"
                                        transform={`rotate(${offsetAngle}, ${cx}, ${cy})`} />
                                </g>
                            );
                        })}
                        {/* 꽃 중심 */}
                        <circle cx="70" cy="70" r="12" fill={D.accent}
                            style={{ transformOrigin: "70px 70px", animation: "petalScale 0.6s 1.0s ease both" }} />
                        <circle cx="70" cy="70" r="6" fill={`${D.accent}88`}
                            style={{ transformOrigin: "70px 70px", animation: "petalScale 0.5s 1.2s ease both" }} />
                    </svg>
                </div>

                {/* 상태 텍스트 + 프로그레스 바 */}
                <div style={{ textAlign: "center", animation: "fadeIn 0.8s 0.3s ease both", opacity: 0 }}>
                    <p style={{ fontSize: 16, color: D.title, fontWeight: 500, marginBottom: 6 }}>
                        AI가 피부를 분석 중이에요
                    </p>
                    <p style={{ fontSize: 13, color: D.textLight, marginBottom: 24, minHeight: 20 }}>
                        {statusText}
                        <span style={{ animation: "dotPulse 1.5s infinite" }}>...</span>
                    </p>

                    {/* 프로그레스 바 */}
                    <div style={{
                        width: 200, height: 4,
                        background: D.border, borderRadius: 4,
                        overflow: "hidden", margin: "0 auto",
                    }}>
                        <div style={{
                            height: "100%",
                            background: `linear-gradient(90deg, ${D.cta}, ${D.accent})`,
                            borderRadius: 4,
                            transition: "width 0.3s ease",
                            width: `${progress}%`,
                        }} />
                    </div>
                    <span style={{ fontSize: 11, color: D.textLight, marginTop: 8, display: "block" }}>
                        {progress}%
                    </span>
                </div>
            </div>
        </>
    );
}