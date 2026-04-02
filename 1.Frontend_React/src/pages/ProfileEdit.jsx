/*
 - 내 정보 수정 페이지 (ProfileEdit)
 - GET /api/users/my → 기존 정보 조회 (닉네임, 피부타입 미리 채움)
 - PUT /api/users/my → 변경된 정보 저장
*/

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";
import FormInput from "../components/FormInput";
import SkinType from "../components/SkinType";


export default function ProfileEdit() {
    const navigate = useNavigate();

    /* 비밀번호 변경용 */
    const [currentPwd, setCurrentPwd] = useState("");
    const [newPwd, setNewPwd] = useState("");
    const [newPwdConfirm, setNewPwdConfirm] = useState("");

    /* 닉네임 변경용 */
    const [nick, setNick] = useState("");

    /* 피부타입 변경용 */
    const [skin_type, setSkinType] = useState("");

    /* 헤더 표시용 닉네임 */
    const [headerNick, setHeaderNick] = useState("");

    /*
     - 페이지 로딩 시 기존 유저 정보 조회
     - 닉네임, 피부타입을 기존 값으로 미리 채움
    */
    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/users/my", {
                    credentials: "include",
                });
                const result = await res.json();
                if (result.status === "success") {
                    setNick(result.data.nick);
                    setSkinType(result.data.skin_type);
                    setHeaderNick(result.data.nick);
                }
            } catch (error) {
                console.log("유저 정보 불러오기 실패");
            }
        };
        fetchUser();
    }, []);

    /*
     - 변경사항 저장 핸들러
     - 비밀번호: 입력했을 때만 전송, 닉네임/피부타입: 항상 전송
    */
    const handleSave = async () => {
        /* 비밀번호를 입력한 경우에만 검증 */
        if (currentPwd || newPwd || newPwdConfirm) {
            if (!currentPwd || !newPwd || !newPwdConfirm) {
                alert("비밀번호 변경 시 모든 항목을 입력해주세요.");
                return;
            }
            if (newPwd !== newPwdConfirm) {
                alert("새 비밀번호가 일치하지 않습니다.");
                return;
            }
        }

        if (!nick.trim()) {
            alert("닉네임을 입력해주세요.");
            return;
        }

        if (!skin_type) {
            alert("피부타입을 선택해주세요.");
            return;
        }

        try {
            const stored = localStorage.getItem("user");

            /* 전송 데이터 구성 — 비밀번호는 입력한 경우에만 포함 */
            const body = { nick, skin_type };
            if (currentPwd && newPwd) {
                body.currentPwd = currentPwd;
                body.newPwd = newPwd;
            }

            const res = await fetch("/api/users/my", {
                method: "PUT",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });

            const result = await res.json();

            if (result.status === "success") {
                alert("변경사항이 저장되었습니다!");
                /* localStorage 유저 정보도 업데이트 */
                const updatedUser = { ...JSON.parse(stored), nick, skin_type };
                localStorage.setItem("user", JSON.stringify(updatedUser));
                navigate("/profile");
            } else {
                alert(result.data.message);
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    /* 카드 스타일 (비밀번호, 닉네임, 피부타입 영역 공통) */
    const cardStyle = {
        background: D.white,
        borderRadius: 16,
        padding: "24px 20px",
        boxShadow: "0 2px 12px rgba(74,52,40,0.05)",
        border: `1px solid ${D.border}`,
        marginBottom: 20,
    };

    const cardTitle = {
        fontSize: 16,
        fontWeight: 700,
        color: D.title,
        marginBottom: 20,
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                minHeight: "100%",
                fontFamily: "inherit",
            }}
        >
            {/* 헤더 */}
            <Header nick={headerNick} />

            {/* 페이지 제목 */}
            <div style={{ padding: "28px 24px 0" }}>
                <h1
                    style={{
                        fontSize: 24,
                        fontWeight: 700,
                        color: D.title,
                        margin: 15,
                        textAlign: "center",
                    }}
                >
                    내 정보 수정
                </h1>
            </div>

            {/* 폼 영역 */}
            <div style={{ padding: "24px 24px 0" }}>

                {/* 비밀번호 변경 카드 */}
                <div style={cardStyle}>
                    <div style={cardTitle}>비밀번호 변경</div>
                    <FormInput
                        label="현재 비밀번호"
                        type="password"
                        placeholder="현재 비밀번호를 입력하세요"
                        value={currentPwd}
                        onChange={(e) => setCurrentPwd(e.target.value)}
                    />
                    <FormInput
                        label="새 비밀번호"
                        type="password"
                        placeholder="새 비밀번호를 입력하세요"
                        value={newPwd}
                        onChange={(e) => setNewPwd(e.target.value)}
                    />
                    <FormInput
                        label="새 비밀번호 확인"
                        type="password"
                        placeholder="새 비밀번호를 다시 입력하세요"
                        value={newPwdConfirm}
                        onChange={(e) => setNewPwdConfirm(e.target.value)}
                    />
                </div>

                {/* 닉네임 변경 카드 */}
                <div style={cardStyle}>
                    <div style={cardTitle}>닉네임 변경</div>
                    <FormInput
                        label="새로운 닉네임"
                        type="text"
                        placeholder="새로운 닉네임을 입력하세요"
                        value={nick}
                        onChange={(e) => setNick(e.target.value)}
                    />
                </div>

                {/* 피부타입 변경 카드 */}
                <div style={cardStyle}>
                    <div style={cardTitle}>피부 타입 변경</div>
                    <SkinType value={skin_type} onChange={setSkinType} />
                </div>

                {/* 변경사항 저장 버튼 */}
                <CTAButton onClick={handleSave} style={{ marginBottom: 150 }}>
                    변경사항 저장
                </CTAButton>
            </div>
        </div>
    );
}