/*
 * ImgUpload — 피부분석 이미지 업로드
 - POST /api/skin/analyze (Data:skin_img)
 - 갤러리 선택 / 카메라 촬영 분리
*/

/*
 * 연결 흐름 정리 : 버튼 클릭 → handleAnalyze
    1) localStorage에서 JWT 토큰 추출
    2) FormData에 skin_img 첨부 후 POST /api/skin/analyze 호출
    3) setIsLoading(true) → <Loading> 오버레이 표시
    4) API 응답 완료 시 결과를 analysisResultRef에 저장 → tryFinish() 호출
    5) Loading 애니메이션 완료 시 handleLoadingDone → tryFinish() 호출
    6) 둘 다 완료된 시점에 성공이면 /report로 state.analysisData 전달, 실패면 alert
*/

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";
import Loading from "../components/Loading";

/* 허용 확장자 — skinRouter.js와 동일 */
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export default function ImgUpload() {
    const navigate = useNavigate();
    const galleryRef = useRef(null);   // 갤러리용 input
    const cameraRef = useRef(null);    // 카메라용 input
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showWebcam, setShowWebcam] = useState(false);
    const videoRef = useRef(null);
    const streamRef = useRef(null);

    const stored = localStorage.getItem("user");
    const nick = stored ? JSON.parse(stored).nick : "";

    /* API 응답 + 애니메이션 완료를 모두 기다린 후 이동 */
    const analysisResultRef = useRef(null);
    const loadingDoneRef = useRef(false);

    const tryFinish = () => {
        if (!analysisResultRef.current || !loadingDoneRef.current) return;
        const result = analysisResultRef.current;
        if (result.ok) {
            navigate("/", { state: { analysisData: result.data } });
        } else {
            setIsLoading(false);
            alert(result.message);
        }
    };

    const handleLoadingDone = () => {
        loadingDoneRef.current = true;
        tryFinish();
    };

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

    /* 카메라 API를 위해 모바일 여부 판별 */
    const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

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

    /* 웹캠 열기 */
    const openWebcam = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "user", width: 640, height: 480 }
            });
            streamRef.current = stream;
            setShowWebcam(true);

            /* 비디오 연결은 state 변경 후 DOM이 생긴 다음에 */
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            }, 100);
        } catch (err) {
            alert("카메라에 접근할 수 없습니다. 브라우저 권한을 확인해주세요.");
        }
    };

    /* 웹캠 닫기 */
    const closeWebcam = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setShowWebcam(false);
    };

    /* 웹캠 캡처 → File 객체 생성 */
    const capturePhoto = () => {
        const video = videoRef.current;
        if (!video) return;

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], "webcam_capture.jpg", { type: "image/jpeg" });
                setSelectedFile(file);
                closeWebcam();
            }
        }, "image/jpeg");
    };

    /* 분석 시작 — POST /api/skin/analyze */
    const handleAnalyze = async () => {
        if (!selectedFile) return;

        analysisResultRef.current = null;
        loadingDoneRef.current = false;
        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append("skin_img", selectedFile);

            const res = await fetch("/api/skin/analyze", {
                method: "POST",
                credentials: "include",
                body: formData,
            });
            const result = await res.json();

            if (result.status === "success") {
                analysisResultRef.current = { ok: true, data: result.data };
            } else {
                analysisResultRef.current = { ok: false, message: result.message || "분석 중 오류가 발생했습니다." };
            }
        } catch {
            analysisResultRef.current = { ok: false, message: "서버 연결에 실패했습니다." };
        }

        tryFinish();
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100%",
            fontFamily: "inherit",
        }}>

            {/* 로딩 오버레이 — 분석 중일 때 전체 화면 덮음 */}
            {isLoading && <Loading onDone={handleLoadingDone} />}

            {/* 헤더 — 닉네임 표시 + 햄버거 메뉴 */}
            <Header nick={nick} />

            <div style={{ padding: "24px 15px" }}>

                {/* 제목 영역 */}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: D.title, textAlign: "center" }}>피부분석</h2>
                <p style={{ fontSize: 14, color: D.textLight, marginTop: 6, textAlign: "center" }}>
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
                        padding: showWebcam ? "0" : previewUrl ? "12px" : "36px 20px",
                        textAlign: "center",
                        marginBottom: 20,
                        background: `${D.bgSub}40`,
                        overflow: "hidden",
                    }}>
                        {showWebcam ? (
                            /* 웹캠 상태 */
                            <div style={{ position: "relative" }}>
                                <video
                                    ref={videoRef}
                                    autoPlay playsInline muted
                                    style={{
                                        width: "100%",
                                        borderRadius: 14,
                                        transform: "scaleX(-1)",
                                        background: "#000",
                                        display: "block",
                                    }}
                                />
                                {/* 얼굴 가이드라인 — 타원 */}
                                <div style={{
                                    position: "absolute",
                                    top: "50%", left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    width: "45%", height: "65%",
                                    border: `2px solid ${D.white}`,
                                    borderRadius: "50%",
                                    opacity: 0.6,
                                    pointerEvents: "none",
                                }} />
                                <p style={{
                                    position: "absolute",
                                    top: 12, left: 0, right: 0,
                                    fontSize: 13, color: D.white,
                                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                                }}>
                                    타원 안에 얼굴을 맞춰주세요
                                </p>

                                {/* 촬영/취소 버튼 */}
                                <div style={{
                                    position: "absolute",
                                    bottom: 12, left: 12, right: 12,
                                    display: "flex", gap: 10,
                                }}>
                                    <button onClick={closeWebcam} style={{
                                        flex: 1, padding: "10px 0",
                                        background: "rgba(0,0,0,0.4)",
                                        border: "none", borderRadius: 10,
                                        fontSize: 13, color: D.white,
                                        cursor: "pointer", fontFamily: "inherit",
                                    }}>취소</button>
                                    <button onClick={capturePhoto} style={{
                                        flex: 1, padding: "10px 0",
                                        background: D.cta,
                                        border: "none", borderRadius: 10,
                                        fontSize: 13, fontWeight: 600,
                                        color: D.white, cursor: "pointer",
                                        fontFamily: "inherit",
                                    }}>📸 촬영</button>
                                </div>
                            </div>

                        ) : previewUrl ? (
                            /* 미리보기 상태 */
                            <div style={{ padding: 12 }}>
                                <img src={previewUrl} alt="미리보기"
                                    style={{
                                        width: "100%", maxHeight: 280,
                                        objectFit: "cover", borderRadius: 12,
                                    }}
                                />
                                <p style={{ fontSize: 12, color: D.textLight, marginTop: 8 }}>
                                    다른 사진을 선택하려면 아래 버튼을 눌러주세요
                                </p>
                            </div>

                        ) : (
                            /* 빈 상태 */
                            <>
                                <div style={{
                                    width: 72, height: 72, borderRadius: "50%",
                                    background: D.bgSub,
                                    margin: "0 auto 16px",
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                }}>
                                    <svg width="28" height="28" viewBox="0 0 24 24"
                                        fill="none" stroke={D.secondary} strokeWidth="1.5">
                                        <rect x="2" y="4" width="20" height="16" rx="3" />
                                        <circle cx="12" cy="12" r="4" />
                                        <circle cx="18" cy="7" r="1" fill={D.secondary} />
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

                    {/* 모바일에서 연결 시, 전면카메라 동작 */}
                    <input
                        ref={cameraRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        capture="user"
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
                            onClick={() => {
                                if (isMobile()) {
                                    cameraRef.current?.click();
                                } else {
                                    openWebcam();
                                }
                            }}
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