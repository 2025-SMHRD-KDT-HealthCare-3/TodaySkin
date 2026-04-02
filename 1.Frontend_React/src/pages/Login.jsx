/*
 - 로그인 페이지 (Login)
 - POST /api/users/login
 - 아이디/비밀번호 입력 → 백엔드 인증 → 성공 시 localStorage에 유저 정보 저장 후 메인 이동
*/

import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { D } from "../styles/design";
import CTAButton from "../components/CTAButton";
import FormInput from "../components/FormInput";
import LeafIcon from "../assets/Leaf.png";
import LoginBImg from "../assets/Login_bottom.png";

export default function Login({ onLoginSuccess }) {

    const navigate = useNavigate();
    const location = useLocation();

    const [id, setId] = useState("");
    const [pwd, setPwd] = useState("");

    /*
     - 로그인 요청 핸들러
     - 성공 시 localStorage에 유저 정보 저장 → App에 로그인 상태 전달 → 메인 이동
    */
    const handleLogin = async () => {
        try {
            const res = await fetch("/api/users/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ id, pwd }),
            });

            const result = await res.json();

            if (result.status === "success") {
                localStorage.setItem("user", JSON.stringify(result.data));
                onLoginSuccess?.();

                const from = location.state?.from || "/";
                navigate(from, { replace: true });
            } else {
                alert(result.data.message);
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    /* 비밀번호 영역 전용 스타일 (FormInput 미적용 — "비밀번호 찾기" 링크 때문) */
    const inputStyle = {
        width: "100%",
        padding: "14px 16px",
        fontSize: 14,
        border: `1px solid ${D.border}`,
        borderRadius: 10,
        background: D.white,
        color: D.title,
        outline: "none",
        fontFamily: "inherit",
        transition: "border-color 0.2s",
        boxSizing: "border-box",
    };

    const labelStyle = {
        fontSize: 12,
        fontWeight: 600,
        color: D.textBody,
        marginBottom: 0,
        display: "block",
        letterSpacing: "0.03em",
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                fontFamily: "inherit",
            }}
        >
            {/* 상단 콘텐츠 */}
            <div style={{ padding: "60px 40px 40px" }}>

                {/* 나뭇잎 아이콘 + 인사말 */}
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                    <img
                        src={LeafIcon}
                        alt="leaf"
                        style={{
                            width: 48,
                            height: 48,
                            objectFit: "contain",
                            marginBottom: 20,
                        }}
                    />
                    <h1 style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: D.title,
                        lineHeight: 1.5,
                        margin: 0,
                        textAlign: "center",
                    }}>
                        <span style={{ fontSize: 26, display: "block" }}>어서오세요</span>
                        <span style={{ fontSize: 23, display: "block" }}>오늘의 피부입니다</span>
                    </h1>
                </div>

                {/* 폼 영역 */}
                <div style={{ marginTop: 36 }}>

                    {/* 아이디 입력 */}
                    <FormInput
                        label="아이디"
                        type="text"
                        placeholder="아이디를 입력하세요"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                    />

                    {/* 비밀번호 입력 — 우측에 "비밀번호 찾기" 링크 포함 */}
                    <div style={{ marginBottom: 8 }}>
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 8,
                            }}
                        >
                            <label style={labelStyle}>비밀번호</label>
                            <span
                                style={{
                                    fontSize: 12,
                                    color: D.textLight,
                                    cursor: "pointer",
                                }}
                            >
                                비밀번호 찾기
                            </span>
                        </div>
                        <input
                            type="password"
                            placeholder="비밀번호를 입력하세요"
                            value={pwd}
                            onChange={(e) => setPwd(e.target.value)}
                            style={inputStyle}
                            onFocus={(e) => (e.target.style.borderColor = D.cta)}
                            onBlur={(e) => (e.target.style.borderColor = D.border)}
                        />
                    </div>
                </div>

                {/* 로그인 버튼 */}
                <CTAButton onClick={handleLogin} style={{ marginTop: 32 }}>
                    로그인
                </CTAButton>

                {/* 회원가입 페이지 이동 링크 → navigate("/join") */}
                <div
                    style={{
                        textAlign: "center",
                        marginTop: 20,
                        fontSize: 13,
                        color: D.textLight,
                    }}
                >
                    계정이 없으신가요?{" "}
                    <span
                        onClick={() => navigate("/join")}
                        style={{ color: D.title, fontWeight: 700, cursor: "pointer" }}
                    >
                        회원가입
                    </span>
                </div>
            </div>

            {/* 하단 이미지 */}
            <div
                style={{
                    height: 160,
                    borderRadius: "0 0 24px 24px",
                    overflow: "hidden",
                    flexShrink: 0,
                }}
            >
                <img
                    src={LoginBImg}
                    alt="botanical"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                    }}
                />
            </div>
        </div>
    );
}