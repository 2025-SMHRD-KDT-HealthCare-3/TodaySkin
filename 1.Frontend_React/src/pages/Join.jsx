/*
 - 회원가입 페이지 (Join)
 - POST /api/users/join
 - 사용자가 입력한 회원 정보를 백엔드로 전송하여 USERS 테이블에 저장
*/

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { D } from "../styles/design";
import CTAButton from "../components/CTAButton";
import FormInput from "../components/FormInput";
import SkinType from "../components/SkinType";
import tsLogo from "../assets/TS_Logo.png";


export default function Join() {
    const navigate = useNavigate();

    /* useState: USERS 테이블 컬럼에 대응하는 입력값 */
    const [id, setId] = useState("");
    const [pwd, setPwd] = useState("");
    const [pwdConfirm, setPwdConfirm] = useState(""); // 프론트 전용 (DB 저장 안 함)
    const [nick, setNick] = useState("");
    const [gender, setGender] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [skin_type, setSkinType] = useState("");

    /*
     - 회원가입 제출 핸들러
     - 프론트 검증 → birthdate 형식 변환(YYYYMMDD → YYYY-MM-DD) → 백엔드 전송
    */
    const handleSubmit = async () => {

        /* 필수값 체크 */
        if (!id || !pwd || !pwdConfirm || !nick || !gender || !birthdate || !skin_type) {
            alert("모든 항목을 입력해주세요.");
            return;
        }

        /* 비밀번호 일치 확인 */
        if (pwd !== pwdConfirm) {
            alert("비밀번호가 일치하지 않습니다.");
            return;
        }

        /* 생년월일 8자리 숫자 확인 */
        if (birthdate.length !== 8 || isNaN(birthdate)) {
            alert("생년월일을 숫자 8자리로 입력해주세요. (예: 19900101)");
            return;
        }

        try {
            /* 생년월일 형식 변환: 19900101 → 1990-01-01 (DB DATE 타입에 맞춤) */
            const formattedDate = `${birthdate.slice(0, 4)}-${birthdate.slice(4, 6)}-${birthdate.slice(6, 8)}`;

            const res = await fetch("/api/users/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id, pwd, nick, gender,
                    birthdate: formattedDate,
                    skin_type,
                }),
            });

            const result = await res.json();

            if (result.status === "success") {
                alert("회원가입이 완료되었습니다!");
                navigate("/"); // 로그인 페이지로 이동
            } else {
                alert(result.data.message);
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    return (
        <div
            style={{
                padding: "32px 28px 40px",
                fontFamily: "inherit",
            }}
        >
            {/* 페이지 제목 */}
            <div style={{ marginBottom: 28 }}>
                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: D.title,
                        margin: 0,
                    }}
                >
                    회원가입
                </h1>
                <p
                    style={{
                        fontSize: 14,
                        color: D.textLight,
                        marginTop: 8,
                    }}
                >
                    오늘의 피부에 가입하고 하루를 마무리해요
                </p>
            </div>

            {/* 아이디 입력 → USERS.id */}
            <FormInput
                label="아이디" required
                type="text"
                placeholder="아이디를 입력해주세요"
                value={id}
                onChange={(e) => setId(e.target.value)}
            />

            {/* 비밀번호 입력 → USERS.pwd (bcrypt 암호화 후 저장) */}
            <FormInput
                label="비밀번호" required
                type="password"
                placeholder="비밀번호를 입력해주세요"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
            />

            {/* 비밀번호 확인 (front전용 — DB 저장 안 함) */}
            <FormInput
                label="비밀번호 확인" required
                type="password"
                placeholder="비밀번호를 한 번 더 입력해주세요"
                value={pwdConfirm}
                onChange={(e) => setPwdConfirm(e.target.value)}
            />

            {/* 닉네임 입력 → USERS.nick */}
            <FormInput
                label="닉네임" required
                type="text"
                placeholder="닉네임을 입력해주세요"
                value={nick}
                onChange={(e) => setNick(e.target.value)}
            />

            {/* 성별 선택 → USERS.gender (M / F) */}
            <div style={{ marginBottom: 18 }}>
                <label
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: D.textBody,
                        marginBottom: 8,
                        display: "block",
                    }}
                >
                    성별 *
                </label>
                <div style={{ display: "flex", gap: 12 }}>
                    {[
                        { value: "M", label: "남" },
                        { value: "F", label: "여" },
                    ].map((g) => (
                        <button
                            key={g.value}
                            onClick={() => setGender(g.value)}
                            style={{
                                flex: 1,
                                padding: "12px",
                                border: `1.5px solid ${gender === g.value ? D.cta : D.border}`,
                                borderRadius: 10,
                                background: gender === g.value ? `${D.cta}10` : D.white,
                                color: gender === g.value ? D.cta : D.textBody,
                                fontSize: 14,
                                fontWeight: gender === g.value ? 600 : 400,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "all 0.2s",
                            }}
                        >
                            {g.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 생년월일 입력 → USERS.birthdate (8자리 → YYYY-MM-DD 변환 후 전송) */}
            <FormInput
                label="생년월일" required
                type="text"
                placeholder="숫자 8자리 입력 (예: 19900101)"
                value={birthdate}
                onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setBirthdate(val);
                }}
                maxLength={8}
                inputMode="numeric"
            />
            
            {/* 피부타입 선택 → USERS.skin_type */}
            <div style={{ marginBottom: 28 }}>
                <label
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: D.textBody,
                        marginBottom: 8,
                        display: "block",
                    }}
                >
                    피부타입 선택 *
                </label>
                <SkinType value={skin_type} onChange={setSkinType} />
            </div>

            {/* 회원가입 완료 버튼 → handleSubmit 실행 */}
            <CTAButton onClick={handleSubmit}>회원가입 완료</CTAButton>

            {/* 로그인 페이지 이동 링크 → navigate("/") */}
            <div
                style={{
                    textAlign: "center",
                    marginTop: 20,
                    fontSize: 13,
                    color: D.textLight,
                }}
            >
                이미 계정이 있으신가요?{" "}
                <span
                    onClick={() => navigate("/")}
                    style={{ color: D.title, fontWeight: 700, cursor: "pointer" }}
                >
                    로그인
                </span>
            </div>

            {/* 하단 로고 (푸터 역할) */}
            <div
                style={{
                    textAlign: "center",
                    marginTop: 60,
                    paddingBottom: 20,
                }}
            >
                <img
                    src={tsLogo}
                    alt="Today's Skin"
                    style={{
                        width: 150,
                        objectFit: "contain",
                        opacity: 0.7,
                    }}
                />
            </div>
        </div>
    );
}