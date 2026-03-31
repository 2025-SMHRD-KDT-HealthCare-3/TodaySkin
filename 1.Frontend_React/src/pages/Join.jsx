import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import tsLogo from "../assets/TS_Logo.png";
import { WiRaindrop } from "react-icons/wi";
import { FiSun, FiLayers } from "react-icons/fi";
import { MdOutlineSpa } from "react-icons/md";
import { RiLeafLine } from "react-icons/ri";

// ====================================================================
// 피부타입 설명
// ====================================================================
const skinTypes = [
    {
        value: "건성",
        label: "건성",
        desc: "수분이 부족하고 당김이 자주 발생합니다. 세안 후 당기는 느낌이 있어요.",
        icon: WiRaindrop,
    },
    {
        value: "지성",
        label: "지성",
        desc: "피지 분비가 많고 모공이 넓습니다. 세안 후에도 번들거림이 남아요.",
        icon: FiSun,
    },
    {
        value: "복합성",
        label: "복합성",
        desc: "T존(이마·코·턱)은 지성, 볼은 건성의 특성을 보입니다.",
        icon: FiLayers,
    },
    {
        value: "민감성",
        label: "민감성",
        desc: "자극에 쉽게 반응하고 붉어짐, 따가움이 나타납니다.",
        icon: MdOutlineSpa,
    },
    {
        value: "중성",
        label: "중성",
        desc: "균형 잡힌 피부로 큰 트러블 없이 관리가 비교적 쉬운 편입니다.",
        icon: RiLeafLine,
    },
];

export default function Join() {
    const navigate = useNavigate();

    const [id, setId] = useState("");
    const [pwd, setPwd] = useState("");
    const [pwdConfirm, setPwdConfirm] = useState("");
    const [nick, setNick] = useState("");
    const [gender, setGender] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [skin_type, setSkinType] = useState("");

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
        fontSize: 13,
        fontWeight: 600,
        color: D.textBody,
        marginBottom: 8,
        display: "block",
    };

    const handleSubmit = async () => {
        if (!id || !pwd || !pwdConfirm || !nick || !gender || !birthdate || !skin_type) {
            alert("모든 항목을 입력해주세요.");
            return;
        }
        if (pwd !== pwdConfirm) {
            alert("비밀번호가 일치하지 않습니다.");
            return;
        }
        if (birthdate.length !== 8 || isNaN(birthdate)) {
            alert("생년월일을 숫자 8자리로 입력해주세요. (예: 19900101)");
            return;
        }

        try {
            const res = await fetch("/api/user/join", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, pwd, nick, gender, birthdate, skin_type }),
            });
            const result = await res.json();

            if (result.status === "success") {
                alert("회원가입이 완료되었습니다!");
                navigate("/");
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
            {/* 제목 */}
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

            {/* 아이디 */}
            <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>아이디 *</label>
                <input
                    type="text"
                    placeholder="아이디를 입력해주세요"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = D.cta)}
                    onBlur={(e) => (e.target.style.borderColor = D.border)}
                />
            </div>

            {/* 비밀번호 */}
            <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>비밀번호 *</label>
                <input
                    type="password"
                    placeholder="비밀번호를 입력해주세요"
                    value={pwd}
                    onChange={(e) => setPwd(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = D.cta)}
                    onBlur={(e) => (e.target.style.borderColor = D.border)}
                />
            </div>

            {/* 비밀번호 확인 */}
            <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>비밀번호 확인 *</label>
                <input
                    type="password"
                    placeholder="비밀번호를 한 번 더 입력해주세요"
                    value={pwdConfirm}
                    onChange={(e) => setPwdConfirm(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = D.cta)}
                    onBlur={(e) => (e.target.style.borderColor = D.border)}
                />
            </div>

            {/* 닉네임 */}
            <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>닉네임 *</label>
                <input
                    type="text"
                    placeholder="닉네임을 입력해주세요"
                    value={nick}
                    onChange={(e) => setNick(e.target.value)}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = D.cta)}
                    onBlur={(e) => (e.target.style.borderColor = D.border)}
                />
            </div>

            {/* 성별 */}
            <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>성별 *</label>
                <div style={{ display: "flex", gap: 12 }}>
                    {["남", "여"].map((g) => (
                        <button
                            key={g}
                            onClick={() => setGender(g)}
                            style={{
                                flex: 1,
                                padding: "12px",
                                border: `1.5px solid ${gender === g ? D.cta : D.border}`,
                                borderRadius: 10,
                                background: gender === g ? `${D.cta}10` : D.white,
                                color: gender === g ? D.cta : D.textBody,
                                fontSize: 14,
                                fontWeight: gender === g ? 600 : 400,
                                cursor: "pointer",
                                fontFamily: "inherit",
                                transition: "all 0.2s",
                            }}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            {/* 생년월일 */}
            <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>생년월일 *</label>
                <input
                    type="text"
                    placeholder="숫자 8자리 입력 (예: 19900101)"
                    value={birthdate}
                    onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setBirthdate(val);
                    }}
                    style={inputStyle}
                    onFocus={(e) => (e.target.style.borderColor = D.cta)}
                    onBlur={(e) => (e.target.style.borderColor = D.border)}
                    maxLength={8}
                    inputMode="numeric"
                />
            </div>

            {/* 피부타입 선택 */}
            <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>피부타입 선택 *</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {skinTypes.map((type) => {
                        const selected = skin_type === type.value;
                        const Icon = type.icon;
                        return (
                            <button
                                key={type.value}
                                onClick={() => setSkinType(type.value)}
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    padding: "14px 16px",
                                    border: `1.5px solid ${selected ? D.cta : D.border}`,
                                    borderRadius: 12,
                                    background: selected ? `${D.cta}10` : D.white,
                                    cursor: "pointer",
                                    textAlign: "left",
                                    fontFamily: "inherit",
                                    transition: "all 0.2s",
                                }}
                            >
                                <Icon
                                    size={22}
                                    color={selected ? D.cta : D.textLight}
                                    style={{ flexShrink: 0, marginTop: 2 }}
                                />
                                <div>
                                    <div
                                        style={{
                                            fontSize: 14,
                                            fontWeight: 600,
                                            color: selected ? D.cta : D.title,
                                            marginBottom: 4,
                                        }}
                                    >
                                        {type.label}
                                    </div>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: D.textLight,
                                            lineHeight: 1.5,
                                        }}
                                    >
                                        {type.desc}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 회원가입 완료 버튼 */}
            <button
                onClick={handleSubmit}
                style={{
                    width: "100%",
                    padding: "16px",
                    background: D.cta,
                    color: D.white,
                    border: "none",
                    borderRadius: 28,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    letterSpacing: "0.05em",
                    boxShadow: `0 4px 16px ${D.cta}33`,
                }}
            >
                회원가입 완료
            </button>

            {/* 로그인 링크 */}
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
                    marginTop: 40,
                    paddingBottom: 20,
                }}
            >
                <img
                    src={tsLogo}
                    alt="Today's Skin"
                    style={{
                        width: 60,
                        objectFit: "contain",
                        opacity: 0.3,
                    }}
                />
            </div>
        </div>
    );
}