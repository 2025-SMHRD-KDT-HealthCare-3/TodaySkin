/*
 * CosManage — 화장품 관리 (검색 / 등록 / 수정 / 삭제)
 - GET    /api/cosmetics/search?keyword=검색어  화장품 검색
 - GET    /api/cosmetics/user-cosmetics         보유 화장품 목록 조회
 - POST   /api/cosmetics/user-cosmetics         보유 화장품 등록
 - PUT    /api/cosmetics/user-cosmetics/:ucos_no 유통기한 수정
 - DELETE /api/cosmetics/user-cosmetics/:ucos_no 보유 화장품 삭제
*/

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { D } from "../styles/design";
import Header from "../components/Header";
import CTAButton from "../components/CTAButton";

export default function CosManage() {
    const navigate = useNavigate();
    const stored = localStorage.getItem("user");
    const nickname = stored ? JSON.parse(stored).nick : "";

    /* ── 검색 관련 state ── */
    const [keyword, setKeyword] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef(null);

    /* ── 등록 관련 state (검색 결과에서 선택한 화장품) ── */
    const [selectedCos, setSelectedCos] = useState(null);
    const [expiryDate, setExpiryDate] = useState("");

    /* ── 내 화장품 목록 ── */
    const [myCosmetics, setMyCosmetics] = useState([]);

    /* ── 수정 모드 ── */
    const [editingId, setEditingId] = useState(null);
    const [editExpiryDate, setEditExpiryDate] = useState("");

    /* ── 보유 / 추천 분리 ── */
    const ownedList = myCosmetics.filter((item) => item.expired_at);
    const recommendedList = myCosmetics.filter((item) => !item.expired_at);

    /* 공통 fetch 헬퍼 : 현 파일 내 모든 API 호출에서 반복되는 코드(헤더 설정, 토큰 첨부 등) 처리 */
    const apiFetch = async (url, options = {}) => {
        const res = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...options.headers,
            },
        });
        return res.json();
    };

    /* ── 내 화장품 목록 조회 ── */
    const fetchMyCosmetics = async () => {
        try {
            const result = await apiFetch("/api/cosmetics/user-cosmetics");
            if (result.status === "success") {
                setMyCosmetics(result.data.list || []);
            }
        } catch (error) {
            console.error("목록 조회 실패:", error);
        }
    };

    useEffect(() => {
        fetchMyCosmetics();
    }, []);

    /* ── 화장품 검색
     : 입력 시 300ms 디바운스 후 API 호출, 드롭다운으로 결과 표시. 외부 클릭하면 드롭다운 닫힘 ── */
    const debounceRef = useRef(null);

    const handleSearch = (value) => {
        setKeyword(value);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!value.trim()) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }

        debounceRef.current = setTimeout(async () => {
            try {
                const result = await apiFetch(
                    `/api/cosmetics/search?keyword=${encodeURIComponent(value.trim())}`
                );
                if (result.status === "success") {
                    setSearchResults(result.data || []);
                    setShowDropdown(true);
                }
            } catch (error) {
                console.error("검색 실패:", error);
            }
        }, 300);
    };

    /* ── 검색 결과 항목 클릭 → 등록 준비 ── */
    const handleSelectCos = (cos) => {
        setSelectedCos(cos);
        setExpiryDate("");
        setKeyword("");
        setShowDropdown(false);
        setSearchResults([]);
    };

    /* ── 화장품 아이템 카드 ── */
    const CosItem = ({ item }) => (
        <div style={{
            background: D.white, borderRadius: 12,
            padding: "3px 15px", marginBottom: 4,
            border: `1px solid ${D.border}`,
        }}>
            <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center",
            }}>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: D.title }}>
                        {item.cos_name}
                    </p>
                    <p style={{ fontSize: 11, color: D.textLight, marginTop: 2 }}>
                        {item.cos_brand} · {item.cos_type}
                        {item.expired_at && (() => {
                            const today = new Date();
                            const expiry = new Date(item.expired_at);
                            const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

                            return (
                                <span style={{ marginLeft: 8 }}>
                                    <span style={{ color: D.secondary }}>~ {formatDate(item.expired_at)}</span>
                                    {diffDays < 0 && (
                                        <span style={{ color: D.cta, fontWeight: 700, marginLeft: 6 }}>(만료)</span>
                                    )}
                                    {diffDays >= 0 && diffDays <= 20 && (
                                        <span style={{ color: D.accent, fontWeight: 700, marginLeft: 6 }}>(만료임박)</span>
                                    )}
                                </span>
                            );
                        })()}
                    </p>
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <button onClick={() => {
                        setEditingId(item.ucos_no);
                        setEditExpiryDate(item.expired_at?.slice(0, 10) || "");
                    }} style={{
                        background: "none", border: "none",
                        cursor: "pointer", padding: 4,
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke={D.textLight} strokeWidth="1.5">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button onClick={() => handleDelete(item.ucos_no)} style={{
                        background: "none", border: "none",
                        cursor: "pointer", padding: 4,
                    }}>
                        <svg width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke={D.warning} strokeWidth="1.5">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* 수정 모드 */}
            {editingId === item.ucos_no && (
                <div style={{
                    display: "flex", gap: 8,
                    alignItems: "center", marginTop: 8,
                    padding: "10px", borderRadius: 10,
                    background: D.bgMain,
                }}>
                    <input
                        type="date"
                        value={editExpiryDate}
                        onChange={(e) => setEditExpiryDate(e.target.value)}
                        style={{
                            flex: 1, padding: "7px 10px",
                            borderRadius: 8, border: `1px solid ${D.border}`,
                            fontSize: 13, fontFamily: "inherit", outline: "none",
                        }}
                    />
                    <button onClick={() => handleUpdate(item.ucos_no)} style={{
                        padding: "7px 14px", borderRadius: 8,
                        background: D.cta, color: D.white,
                        border: "none", fontSize: 13,
                        fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                    }}>저장</button>
                    <button onClick={() => setEditingId(null)} style={{
                        padding: "7px 10px", borderRadius: 8,
                        background: "transparent", color: D.textLight,
                        border: `1px solid ${D.border}`, fontSize: 13,
                        cursor: "pointer", fontFamily: "inherit",
                    }}>취소</button>
                </div>
            )}
        </div>
    );

    /* ── 화장품 등록 ── */
    const handleRegister = async () => {
        if (!selectedCos) return;

        try {
            const result = await apiFetch("/api/cosmetics/user-cosmetics", {
                method: "POST",
                body: JSON.stringify({
                    cos_no: selectedCos.cos_no,
                    expired_at: expiryDate || null,
                }),
            });

            if (result.status === "success") {
                alert("등록되었습니다.");
                setSelectedCos(null);
                setExpiryDate("");
                fetchMyCosmetics();
            } else {
                alert(result.data?.message || "등록에 실패했습니다.");
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    /* ── 유통기한 수정 ── */
    const handleUpdate = async (ucos_no) => {
        try {
            const result = await apiFetch(`/api/cosmetics/user-cosmetics/${ucos_no}`, {
                method: "PUT",
                body: JSON.stringify({ expired_at: editExpiryDate || null }),
            });

            if (result.status === "success") {
                setEditingId(null);
                setEditExpiryDate("");
                fetchMyCosmetics();
            } else {
                alert(result.data?.message || "수정에 실패했습니다.");
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    /* ── 화장품 삭제 ── */
    const handleDelete = async (ucos_no) => {
        if (!window.confirm("이 화장품을 목록에서 삭제할까요?")) return;

        try {
            const result = await apiFetch(`/api/cosmetics/user-cosmetics/${ucos_no}`, {
                method: "DELETE",
            });

            if (result.status === "success") {
                fetchMyCosmetics();
            } else {
                alert(result.data?.message || "삭제에 실패했습니다.");
            }
        } catch (error) {
            alert("서버 연결에 실패했습니다.");
        }
    };

    /* 드롭다운 외부 클릭 닫기 */
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    /* 유통기한 포맷 (YYYY-MM-DD → YYYY.MM.DD) */
    const formatDate = (dateStr) => {
        if (!dateStr) return "미설정";
        return dateStr.slice(0, 10).replace(/-/g, ".");
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100%",
            fontFamily: "inherit",
        }}>
            <Header nick={nickname} />

            <div style={{ padding: "24px 15px" }}>

                {/* 페이지 제목 */}
                <h2 style={{ fontSize: 22, fontWeight: 700, color: D.title, marginBottom: 6 }}>
                    화장품 관리
                </h2>
                <p style={{ fontSize: 14, color: D.textLight }}>
                    보유 제품을 등록하고 관리하세요
                </p>

                {/* ── 검색 영역 ── */}
                <div ref={searchRef} style={{ position: "relative", marginBottom: 20 }}>
                    <div style={{
                        display: "flex", alignItems: "center",
                        border: `1px solid ${D.border}`,
                        borderRadius: 12, padding: "0 14px",
                        background: D.white,
                    }}>
                        {/* 검색 아이콘 */}
                        <svg width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke={D.textLight} strokeWidth="2">
                            <circle cx="11" cy="11" r="7" />
                            <path d="M21 21l-4.35-4.35" />
                        </svg>
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder="화장품 이름 또는 브랜드 검색"
                            style={{
                                flex: 1, border: "none", outline: "none",
                                padding: "13px 10px", fontSize: 14,
                                fontFamily: "inherit", background: "transparent",
                            }}
                        />
                    </div>

                    {/* 검색 결과 드롭다운 */}
                    {showDropdown && (
                        <div style={{
                            position: "absolute", top: "100%", left: 0, right: 0,
                            zIndex: 10, marginTop: 4,
                            background: D.white, borderRadius: 12,
                            border: `1px solid ${D.border}`,
                            boxShadow: "0 4px 16px rgba(74,52,40,0.1)",
                            maxHeight: 240, overflowY: "auto",
                        }}>
                            {searchResults.length === 0 ? (
                                <div style={{
                                    padding: "16px", textAlign: "center",
                                    fontSize: 13, color: D.textLight,
                                }}>
                                    검색 결과가 없습니다
                                </div>
                            ) : (
                                searchResults.map((cos) => (
                                    <div key={cos.cos_no}
                                        onClick={() => handleSelectCos(cos)}
                                        style={{
                                            padding: "8px 16px",
                                            cursor: "pointer",
                                            borderBottom: `1px solid ${D.border}20`,
                                            transition: "background 0.15s",
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = D.bgSub}
                                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                    >
                                        <p style={{ fontSize: 14, fontWeight: 500, color: D.title }}>
                                            {cos.cos_name}
                                        </p>
                                        <p style={{ fontSize: 12, color: D.textLight, marginTop: 2 }}>
                                            {cos.cos_brand} · {cos.cos_type}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* ── 선택된 화장품 → 유통기한 입력 + 등록 ── */}
                {selectedCos && (
                    <div style={{
                        background: D.white, borderRadius: 12,
                        padding: "16px", marginBottom: 24,
                        border: `1.5px solid ${D.cta}30`,
                        boxShadow: "0 2px 12px rgba(74,52,40,0.06)",
                    }}>
                        <div style={{
                            display: "flex", justifyContent: "space-between",
                            alignItems: "flex-start", marginBottom: 14,
                        }}>
                            <div>
                                <p style={{ fontSize: 15, fontWeight: 600, color: D.title }}>
                                    {selectedCos.cos_name}
                                </p>
                                <p style={{ fontSize: 13, color: D.textLight, marginTop: 2 }}>
                                    {selectedCos.cos_brand} · {selectedCos.cos_type}
                                </p>
                            </div>
                            {/* 선택 취소 */}
                            <button onClick={() => setSelectedCos(null)} style={{
                                background: "none", border: "none",
                                fontSize: 18, color: D.textLight,
                                cursor: "pointer", padding: 4,
                            }}>✕</button>
                        </div>

                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <label style={{ fontSize: 13, color: D.textBody, flexShrink: 0 }}>
                                유통기한
                            </label>
                            <input
                                type="date"
                                value={expiryDate}
                                onChange={(e) => setExpiryDate(e.target.value)}
                                style={{
                                    flex: 1, padding: "10px 12px",
                                    borderRadius: 10, border: `1px solid ${D.border}`,
                                    fontSize: 14, fontFamily: "inherit",
                                    outline: "none", background: D.bgMain,
                                }}
                            />
                        </div>

                        <div>
                            <CTAButton onClick={handleRegister}>등록하기</CTAButton>
                        </div>
                    </div>
                )}

                {/* ── 내 화장품 리스트 ── */}
                <h3 style={{
                    fontSize: 17, fontWeight: 700, color: D.title,
                    marginBottom: 14,
                }}>
                    내 화장품 ({ownedList.length})
                </h3>

                {myCosmetics.length === 0 ? (
                    <div style={{
                        textAlign: "center", padding: "40px 20px",
                        color: D.textLight, fontSize: 14,
                    }}>
                        등록된 화장품이 없습니다
                    </div>
                ) : (
                    <>
                        {/* 보유 화장품 */}
                        {ownedList.length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                                <div style={{
                                    fontSize: 13, fontWeight: 600, color: D.positive,
                                    marginBottom: 8, padding: "4px 10px",
                                    background: `${D.positive}10`, borderRadius: 8,
                                    display: "inline-block",
                                }}>
                                    보유 {ownedList.length}
                                </div>
                                {ownedList.map((item) => (
                                    <CosItem key={item.ucos_no} item={item} />
                                ))}
                            </div>
                        )}

                        {/* 추천 화장품 */}
                        {recommendedList.length > 0 && (
                            <div>
                                <div style={{
                                    fontSize: 13, fontWeight: 600, color: D.accent,
                                    marginBottom: 8, padding: "4px 10px",
                                    background: `${D.accent}10`, borderRadius: 8,
                                    display: "inline-block",
                                }}>
                                    추천 {recommendedList.length}
                                </div>
                                {recommendedList.map((item) => (
                                    <CosItem key={item.ucos_no} item={item} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}