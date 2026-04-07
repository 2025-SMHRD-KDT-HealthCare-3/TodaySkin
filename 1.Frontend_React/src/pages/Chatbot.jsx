/*
 * Chatbot — AI 피부 상담 챗봇
 - POST /api/chatbot
 - 초기 메시지로 피부 고민 유도
*/

import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import chatIcon from "../assets/chat_icon_ts.png";
import faceIcon from "../assets/face.png";

/* 피부 고민 태그 — 관리로 개선 가능한 항목만 */
const SKIN_CONCERNS = [
    { label: "건조함", query: "피부가 건조하고 당기는 느낌이 있어요" },
    { label: "번들거림", query: "피부가 번들거리고 유분이 많아요" },
    { label: "민감/홍조", query: "피부가 민감하고 홍조가 있어요" },
    { label: "트러블", query: "트러블이 자주 올라와요" },
    { label: "모공", query: "모공이 넓어서 고민이에요" },
    { label: "각질/거침", query: "각질이 일어나고 피부결이 거칠어요" },
];

export default function Chatbot() {
    const navigate = useNavigate();

    /* localStorage에서 닉네임 가져오기 */
    const stored = localStorage.getItem("user");
    const nickname = stored ? JSON.parse(stored).nick : "회원";

    /* 초기 AI 인사 메시지 */
    const initialMessage = {
        role: "assistant",
        content: `안녕하세요, ${nickname}님! 오늘의 피부에 어떤 고민이 있으신가요?`,
    };

    const [messages, setMessages] = useState([initialMessage]);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [showConcerns, setShowConcerns] = useState(true);
    const chatEndRef = useRef(null);
    const inputRef = useRef(null);

    /* 메시지 추가 시 자동 스크롤 */
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isTyping]);

    /* 메시지 전송 처리 */
    const handleSend = async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        /* 사용자 메시지 추가 */
        const userMsg = { role: "user", content: trimmed };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setShowConcerns(false);
        setIsTyping(true);

        try {
            const res = await fetch("/api/chatbot/message", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ message: trimmed }),
            });
            const result = await res.json();

            if (result.status === "success") {
                setMessages((prev) => [...prev, {
                    role: "assistant",
                    content: result.data.answer,
                }]);
            } else {
                setMessages((prev) => [...prev, {
                    role: "assistant",
                    content: "답변을 가져오지 못했어요. 다시 시도해주세요.",
                }]);
            }
        } catch {
            setMessages((prev) => [...prev, {
                role: "assistant",
                content: "서버 연결에 실패했어요. 잠시 후 다시 시도해주세요.",
            }]);
        } finally {
            setIsTyping(false);
        }
    };

    /* 고민 태그 클릭 */
    const handleConcernClick = (concern) => {
        handleSend(concern.query);
    };

    /* "채팅창에 직접 입력" 클릭 */
    const handleDirectInput = () => {
        setShowConcerns(false);
        inputRef.current?.focus();
    };

    /* 엔터키 전송 */
    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            if (e.nativeEvent.isComposing) return;  // ✅ 조합 중이면 완전 차단
            e.preventDefault();
            handleSend(input);
        }
    };

    return (
        <div style={{
            display: "flex",
            background: "transparent",
            flexDirection: "column",
            height: "100%",
            fontFamily: "inherit",            
        }}>

            {/* 채팅 영역 */}
            <div style={{
                flex: 1,
                overflowY: "auto",
                padding: "20px 15px",
                background: "transparent",
            }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                        alignItems: "flex-end",
                        gap: 8,
                        marginBottom: 14,
                    }}>
                        {/* AI 아이콘 — 왼쪽 */}
                        {msg.role === "assistant" && (
                            <img src={chatIcon} alt="AI"
                                style={{
                                    width: 36, height: 36,
                                    objectFit: "contain",
                                    flexShrink: 0,
                                    background: "transparent",
                                }}
                            />
                        )}

                        {/* 말풍선 */}
                        <div style={{
                            maxWidth: "70%",
                            padding: "12px 16px",
                            borderRadius: msg.role === "user"
                                ? "16px 16px 4px 16px"
                                : "16px 16px 16px 4px",
                            background: msg.role === "user" ? D.cta : D.white,
                            color: msg.role === "user" ? D.white : D.textBody,
                            fontSize: 14,
                            lineHeight: 1.7,
                            boxShadow: "0 1px 4px rgba(74,52,40,0.06)",
                            border: msg.role === "user" ? "none" : `1px solid ${D.border}`,
                        }}>
                            {msg.content}
                        </div>

                        {/* 사용자 아이콘 — 오른쪽 */}
                        {msg.role === "user" && (
                            <img src={faceIcon} alt="나"
                                style={{
                                    width: 36, height: 36,
                                    borderRadius: "50%",
                                    objectFit: "contain",
                                    flexShrink: 0,
                                    border: `1px solid ${D.border}`,
                                    background: D.white,
                                    padding: 4,
                                }}
                            />
                        )}
                    </div>
                ))}

                {/* 고민 태그 — 초기에만 표시 */}
                {showConcerns && (
                    <div style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        padding: "8px 0 12px",
                        marginLeft: 44,
                    }}>
                        {SKIN_CONCERNS.map((concern, i) => (
                            <button key={i} onClick={() => handleConcernClick(concern)}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: 20,
                                    border: `1.5px solid ${D.cta}`,
                                    background: `${D.cta}08`,
                                    color: D.cta,
                                    fontSize: 13,
                                    fontWeight: 500,
                                    cursor: "pointer",
                                    fontFamily: "inherit",
                                }}
                            >
                                {concern.label}
                            </button>
                        ))}
                        {/* 직접 입력 태그 */}
                        <button onClick={handleDirectInput}
                            style={{
                                padding: "8px 16px",
                                borderRadius: 20,
                                border: `1.5px solid ${D.border}`,
                                background: D.bgMain,
                                color: D.textLight,
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            채팅창에 직접 입력
                        </button>
                    </div>
                )}

                {/* AI 타이핑 인디케이터 */}
                {isTyping && (
                    <div style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 8,
                        marginBottom: 14,
                    }}>
                        <img src={chatIcon} alt="AI"
                            style={{
                                width: 36, height: 36,
                                objectFit: "contain",
                                flexShrink: 0,
                                background: D.white,
                            }}
                        />
                        <div style={{
                            padding: "12px 16px",
                            borderRadius: "16px 16px 16px 4px",
                            background: D.white,
                            border: `1px solid ${D.border}`,
                            display: "flex",
                            gap: 4,
                        }}>
                            {[0, 1, 2].map((i) => (
                                <span key={i} style={{
                                    width: 6, height: 6,
                                    borderRadius: "50%",
                                    background: D.textLight,
                                    animation: `dotBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
                                }} />
                            ))}
                        </div>
                    </div>
                )}

                <div ref={chatEndRef} />
            </div>

            {/* 입력 영역 */}
            <div style={{
                padding: "12px 15px",
                borderTop: `1px solid ${D.border}`,
                background: D.white,
                display: "flex",
                gap: 10,
                alignItems: "center",
            }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionEnd={(e) => setInput(e.target.value)}  
                    placeholder="피부 고민을 입력하세요"
                    style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: `1px solid ${D.border}`,
                        fontSize: 14,
                        fontFamily: "inherit",
                        outline: "none",
                        background: D.bgMain,
                    }}
                />
                <button
                    onClick={() => handleSend(input)}
                    disabled={!input.trim() || isTyping}
                    style={{
                        width: 44, height: 44,
                        borderRadius: 12,
                        border: "none",
                        background: input.trim() ? D.cta : D.border,
                        cursor: input.trim() ? "pointer" : "default",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.2s",
                        flexShrink: 0,
                    }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke={D.white} strokeWidth="2" strokeLinecap="round">
                        <path d="M22 2L11 13" />
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                </button>
            </div>

            {/* 타이핑 애니메이션 */}
            <style>{`
                @keyframes dotBounce {
                    0%, 80%, 100% { transform: translateY(0); }
                    40% { transform: translateY(-6px); }
                }
            `}</style>
        </div>
    );
}