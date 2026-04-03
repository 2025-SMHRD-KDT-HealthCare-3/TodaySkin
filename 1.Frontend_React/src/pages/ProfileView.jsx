/*
 * 내 정보 확인 페이지 (ProfileView)
 - GET /api/users/my → 로그인된 사용자의 USERS 테이블 정보 조회
 - DELETE /api/users/my → 회원탈퇴 (비밀번호 확인 모달)
*/

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";
import profileImg from "../assets/face.png";
import { FiBell, FiMail, FiShield } from "react-icons/fi";

export default function ProfileView() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [alarmOn, setAlarmOn] = useState(true);
    const [showPrivacy, setShowPrivacy] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);
    const [withdrawPwd, setWithdrawPwd] = useState("");

    /*
     - 페이지 로딩 시 내 정보 조회
     - 쿠키에 저장된 토큰을 함께 보내서 본인 확인 후 유저 데이터 수신
    */
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/users/my", {
                    credentials: "include",
                });
                const result = await res.json();
                if (result.status === "success") {
                    setUser(result.data);
                }
            } catch (error) {
                console.log("유저 정보 불러오기 실패");
            } finally {
                setLoading(false);
            }
        };
        fetchUser();
    }, []);

    /* 날짜 포맷 변환: "2000-01-01" → "2000년 1월 1일" */
    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    };

    /* 성별 변환: M → 남성, F → 여성 */
    const genderLabel = (g) => {
        if (g === "M") return "남성";
        if (g === "F") return "여성";
        return g;
    };

    /*
     * 회원탈퇴 핸들러
     - 비밀번호 확인 후 DELETE /api/users/my 호출
     - 성공 시 localStorage 삭제 → 로그인 페이지로 이동
    */
    const handleWithdraw = async () => {
        if (!withdrawPwd.trim()) {
            alert("비밀번호를 입력해주세요.");
            return;
        }

        try {
            const res = await fetch("/api/users/my", {
                method: "DELETE",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ pwd: withdrawPwd }),
            });

            const result = await res.json();

            if (result.status === "success") {
                alert("회원탈퇴가 완료되었습니다.");
                localStorage.removeItem("user");
                navigate("/");
                window.location.reload();
            } else {
                alert(result.data.message);
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    /* 로딩 중 표시 */
    if (loading) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: D.textLight }}>
                불러오는 중...
            </div>
        );
    }

    /* 기본 정보 카드에 표시할 항목 */
    const infoRows = [
        { label: "생년월일", value: formatDate(user?.birthdate) },
        { label: "피부타입", value: user?.skin_type },
        { label: "성별", value: genderLabel(user?.gender) },
        { label: "가입일", value: formatDate(user?.joined_at) },
    ];

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                fontFamily: "inherit",
            }}
        >
            {/* 헤더 — 닉네임 표시 + 햄버거 메뉴 */}
            <Header nick={user?.nick || ""} />

            {/* 프로필 영역 — 기본 이미지 + 닉네임 + 아이디 */}
            <div
                style={{
                    textAlign: "center",
                    padding: "36px 20px 28px",
                    background: `linear-gradient(180deg, ${D.bgSub}40 0%, ${D.bgMain} 100%)`,
                }}
            >
                <div
                    style={{
                        width: 110,
                        height: 110,
                        borderRadius: "50%",
                        overflow: "hidden",
                        margin: "0 auto 16px",
                        border: `3px solid ${D.cta}`,
                    }}
                >
                    <img
                        src={profileImg}
                        alt="프로필"
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                </div>
                <div
                    style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: D.title,
                        marginBottom: 4,
                    }}
                >
                    {user?.nick}
                </div>
                <div
                    style={{
                        fontSize: 13,
                        color: D.textLight,
                    }}
                >
                    {user?.id}
                </div>
            </div>

            {/* 기본 정보 카드 — USERS 테이블 데이터 표시 */}
            <div style={{ padding: "0 24px" }}>
                <div
                    style={{
                        background: D.white,
                        borderRadius: 16,
                        padding: "24px 20px",
                        boxShadow: "0 2px 12px rgba(74,52,40,0.05)",
                        border: `1px solid ${D.border}`,
                        marginBottom: 24,
                    }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: D.title,
                            marginBottom: 20,
                        }}
                    >
                        기본 정보
                    </div>
                    {infoRows.map((row, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                padding: "14px 0",
                                borderBottom: i < infoRows.length - 1 ? `1px solid ${D.border}` : "none",
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 13,
                                    color: D.textLight,
                                    width: 80,
                                    flexShrink: 0,
                                }}
                            >
                                {row.label}
                            </span>
                            <span
                                style={{
                                    fontSize: 14,
                                    color: D.title,
                                    fontWeight: 500,
                                }}
                            >
                                {row.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* 서비스 정보 카드 — 알림, 연락처, 개인정보처리방침 */}
                <div
                    style={{
                        background: D.white,
                        borderRadius: 16,
                        padding: "24px 20px",
                        boxShadow: "0 2px 12px rgba(74,52,40,0.05)",
                        border: `1px solid ${D.border}`,
                        marginBottom: 32,
                    }}
                >
                    <div
                        style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: D.title,
                            marginBottom: 20,
                        }}
                    >
                        서비스 정보
                    </div>

                    {/* 루틴 알림 ON/OFF 토글 */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "12px 0",
                            borderBottom: `1px solid ${D.border}`,
                        }}
                    >
                        <FiBell size={18} color={D.textLight} style={{ marginRight: 12 }} />
                        <span style={{ fontSize: 14, color: D.title, flex: 1 }}>루틴 알림</span>
                        <div
                            onClick={() => setAlarmOn(!alarmOn)}
                            style={{
                                width: 44,
                                height: 24,
                                borderRadius: 12,
                                background: alarmOn ? D.cta : D.border,
                                cursor: "pointer",
                                position: "relative",
                                transition: "background 0.2s",
                            }}
                        >
                            <div
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    background: D.white,
                                    position: "absolute",
                                    top: 2,
                                    left: alarmOn ? 22 : 2,
                                    transition: "left 0.2s",
                                    boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                                }}
                            />
                        </div>
                    </div>

                    {/* Contact us — 메일 연결 */}
                    <a
                        href="mailto:todayskin@smhrd.or.kr"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "12px 0",
                            borderBottom: `1px solid ${D.border}`,
                            textDecoration: "none",
                            cursor: "pointer",
                        }}
                    >
                        <FiMail size={18} color={D.textLight} style={{ marginRight: 12 }} />
                        <span style={{ fontSize: 14, color: D.title }}>Contact us</span>
                    </a>

                    {/* Privacy policy — 모달로 개인정보처리방침 표시 */}
                    <div
                        onClick={() => setShowPrivacy(true)}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "12px 0",
                            cursor: "pointer",
                        }}
                    >
                        <FiShield size={18} color={D.textLight} style={{ marginRight: 12 }} />
                        <span style={{ fontSize: 14, color: D.title }}>Privacy policy</span>
                    </div>
                </div>

                {/* 회원정보수정 버튼 → ProfileEdit.jsx로 이동 */}
                <CTAButton
                    onClick={() => navigate("/profile/edit")}
                    style={{ marginBottom: 20 }}
                >
                    회원정보수정
                </CTAButton>

                {/* 회원탈퇴 링크 */}
                <div
                    style={{
                        textAlign: "center",
                        marginTop: 30,
                        marginBottom: 150,
                        fontSize: 13,
                        color: D.textLight,
                    }}
                >
                    <span
                        onClick={() => setShowWithdraw(true)}
                        style={{ cursor: "pointer" }}
                    >
                        회원을 탈퇴하시겠어요?
                    </span>
                </div>
            </div>

            {/* Privacy Policy 모달 — 배경 클릭 시 닫힘 */}
            {showPrivacy && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 300,
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => setShowPrivacy(false)}
                >
                    <div
                        style={{
                            width: "85%",
                            maxWidth: 380,
                            maxHeight: "70vh",
                            background: D.bgMain,
                            borderRadius: 20,
                            padding: "28px 24px",
                            overflowY: "auto",
                            boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 20,
                            }}
                        >
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: D.title, margin: 0 }}>
                                개인정보 처리방침
                            </h2>
                            <button
                                onClick={() => setShowPrivacy(false)}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: 20,
                                    color: D.textLight,
                                    cursor: "pointer",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ fontSize: 13, color: D.textBody, lineHeight: 1.8 }}>
                            <p style={{ marginBottom: 14 }}>
                                <strong>1. 수집하는 개인정보 항목</strong>
                                <br />
                                아이디, 비밀번호(암호화 저장), 닉네임, 성별, 생년월일, 피부타입
                            </p>
                            <p style={{ marginBottom: 14 }}>
                                <strong>2. 이미지 데이터 처리</strong>
                                <br />
                                피부 분석을 위해 업로드된 얼굴 이미지는 AI 분석 완료 후 즉시 삭제되며, 서버에 저장되지 않습니다.
                            </p>
                            <p style={{ marginBottom: 14 }}>
                                <strong>3. 개인정보의 이용 목적</strong>
                                <br />
                                피부 상태 분석, 맞춤 루틴 추천, 서비스 개선을 위해 활용됩니다.
                            </p>
                            <p style={{ marginBottom: 14 }}>
                                <strong>4. 개인정보 보유 기간</strong>
                                <br />
                                회원 탈퇴 시까지 보유하며, 탈퇴 즉시 모든 정보가 삭제됩니다.
                            </p>
                            <p>
                                <strong>5. 문의</strong>
                                <br />
                                todayskin@smhrd.or.kr
                            </p>
                        </div>

                        <CTAButton
                            onClick={() => setShowPrivacy(false)}
                            style={{ marginTop: 20, padding: "14px", borderRadius: 24, fontSize: 14 }}
                        >
                            닫기
                        </CTAButton>
                    </div>
                </div>
            )}

            {/* 회원탈퇴 모달 — 비밀번호 확인 후 탈퇴 처리 */}
            {showWithdraw && (
                <div
                    style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 300,
                        background: "rgba(0,0,0,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                    onClick={() => { setShowWithdraw(false); setWithdrawPwd(""); }}
                >
                    <div
                        style={{
                            width: "85%",
                            maxWidth: 380,
                            background: D.bgMain,
                            borderRadius: 20,
                            padding: "28px 24px",
                            boxShadow: "0 8px 40px rgba(0,0,0,0.15)",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: 20,
                            }}
                        >
                            <h2 style={{ fontSize: 18, fontWeight: 700, color: D.title, margin: 0 }}>
                                회원탈퇴
                            </h2>
                            <button
                                onClick={() => { setShowWithdraw(false); setWithdrawPwd(""); }}
                                style={{
                                    background: "none",
                                    border: "none",
                                    fontSize: 20,
                                    color: D.textLight,
                                    cursor: "pointer",
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <p style={{ fontSize: 13, color: D.textBody, lineHeight: 1.7, marginBottom: 20 }}>
                            탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.
                            <br />
                            계속하시려면 비밀번호를 입력해주세요.
                        </p>

                        <input
                            type="password"
                            placeholder="비밀번호를 입력하세요"
                            value={withdrawPwd}
                            onChange={(e) => setWithdrawPwd(e.target.value)}
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
                                marginBottom: 16,
                            }}
                            onFocus={(e) => (e.target.style.borderColor = D.warning)}
                            onBlur={(e) => (e.target.style.borderColor = D.border)}
                        />

                        <CTAButton
                            onClick={handleWithdraw}
                            style={{
                                background: D.warning,
                                boxShadow: `0 4px 16px ${D.warning}33`,
                            }}
                        >
                            탈퇴하기
                        </CTAButton>

                        <div
                            style={{
                                textAlign: "center",
                                marginTop: 12,
                                fontSize: 13,
                                color: D.textLight,
                                cursor: "pointer",
                            }}
                            onClick={() => { setShowWithdraw(false); setWithdrawPwd(""); }}
                        >
                            취소
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}