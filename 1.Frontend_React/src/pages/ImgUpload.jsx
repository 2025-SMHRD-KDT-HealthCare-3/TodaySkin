/*
 * ImgUpload — 피부분석 이미지 업로드
 - POST /api/skin/analyze (Data:skin_img)
 - 갤러리 선택 / 카메라 촬영 분리
*/

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";

/* 허용 확장자 — skinRouter.js와 동일 */
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export default function ImgUpload() {
    const navigate = useNavigate();
    const galleryRef = useRef(null);   // 갤러리용 input
    const cameraRef = useRef(null);    // 카메라용 input
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const stored = localStorage.getItem("user");
    const nick = stored ? JSON.parse(stored).nick : "";

    /* 미리보기 URL 생성/정리 */
    useEffect(() => {
        if (!selectedFile) {
            setPreviewUrl(null);
            return;
        }
        const url = URL.createObjectURL(selectedFile);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [selectedFile]);

    /* 파일 선택 핸들러 (갤러리, 카메라 공통) */
    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            alert("JPG 또는 PNG 파일만 업로드할 수 있습니다.");
            return;
        }
        setSelectedFile(file);
    };

    /* 분석 시작 — Step 3에서 API 연동 예정 */
    const handleAnalyze = async () => {
        if (!selectedFile) return;
        // TODO: API 호출 + 로딩 오버레이
        console.log("분석 시작:", selectedFile.name);
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100%",
            fontFamily: "inherit",
        }}>
            
            {/* 헤더 — 닉네임 표시 + 햄버거 메뉴 */}
            <Header nick={nick} />

            <div style={{ padding: "24px 15px", maxWidth: 480, margin: "0 auto" }}>

                {/* 제목 영역 */}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: D.title }}>피부분석</h2>
                <p style={{ fontSize: 14, color: D.textLight, marginTop: 6 }}>
                    AI가 당신의 피부 상태를 분석합니다
                </p>

                {/* 업로드 카드 */}
                <div style={{
                    background: D.white,
                    borderRadius: 16,
                    padding: "24px 20px",
                    boxShadow: "0 2px 16px rgba(74,52,40,0.06)",
                    border: `1px solid ${D.border}`,
                    marginTop: 20,
                }}>
                    {/* 점선 업로드 영역 / 미리보기 */}
                    <div style={{
                        border: `2px dashed ${D.border}`,
                        borderRadius: 16,
                        padding: previewUrl ? "12px" : "36px 20px",
                        textAlign: "center",
                        marginBottom: 20,
                        background: `${D.bgSub}40`,
                    }}>
                        {previewUrl ? (
                            /* 미리보기 상태 */
                            <div>
                                <img
                                    src={previewUrl}
                                    alt="미리보기"
                                    style={{
                                        width: "100%",
                                        maxHeight: 280,
                                        objectFit: "cover",
                                        borderRadius: 12,
                                    }}
                                />
                                <p style={{
                                    fontSize: 12, color: D.textLight,
                                    marginTop: 8,
                                }}>
                                    다른 사진을 선택하려면 아래 버튼을 눌러주세요
                                </p>
                            </div>
                        ) : (
                            /* 빈 상태 */
                            <>
                                <div style={{
                                    width: 72, height: 72, borderRadius: "50%",
                                    background: `${D.bgSub}`,
                                    margin: "0 auto 16px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}>
                                    {/* 카메라 아이콘 */}
                                    <svg width="28" height="28" viewBox="0 0 24 24"
                                         fill="none" stroke={D.secondary} strokeWidth="1.5">
                                        <rect x="2" y="4" width="20" height="16" rx="3"/>
                                        <circle cx="12" cy="12" r="4"/>
                                        <circle cx="18" cy="7" r="1" fill={D.secondary}/>
                                    </svg>
                                </div>
                                <p style={{ fontSize: 15, color: D.title, fontWeight: 500 }}>
                                    얼굴 사진을 업로드해 주세요
                                </p>
                                <p style={{ fontSize: 13, color: D.textLight, marginTop: 6 }}>
                                    정면 사진이 가장 정확합니다
                                </p>
                            </>
                        )}
                    </div>

                    {/* 숨겨진 file input 2개 */}
                    <input
                        ref={galleryRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                    />
                    <input
                        ref={cameraRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="environment"
                        style={{ display: "none" }}
                        onChange={handleFileChange}
                    />

                    {/* 버튼 2개 — 갤러리 / 카메라 */}
                    <div style={{ display: "flex", gap: 10, width: "100%" }}>
                        <button
                            onClick={() => galleryRef.current?.click()}
                            style={{
                                flex: 1, padding: "12px 0",
                                background: "transparent",
                                border: `1.5px solid ${D.cta}`,
                                borderRadius: 12, fontSize: 14,
                                fontWeight: 600, color: D.cta,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            🖼️ 갤러리 선택
                        </button>
                        <button
                            onClick={() => cameraRef.current?.click()}
                            style={{
                                flex: 1, padding: "12px 0",
                                background: "transparent",
                                border: `1.5px solid ${D.cta}`,
                                borderRadius: 12, fontSize: 14,
                                fontWeight: 600, color: D.cta,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            📷 카메라 촬영
                        </button>
                    </div>
                </div>

                {/* CTA 버튼 */}
                <div style={{ marginTop: 14 }}>
                    <CTAButton
                        onClick={handleAnalyze}
                        style={{
                            opacity: selectedFile ? 1 : 0.5,
                            pointerEvents: selectedFile ? "auto" : "none",
                        }}
                    >
                        AI 피부 분석 시작
                    </CTAButton>
                </div>
            </div>
        </div>
    );
}