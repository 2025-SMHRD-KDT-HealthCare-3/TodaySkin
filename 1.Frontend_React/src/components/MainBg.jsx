/*
 - 공통 레이아웃 컴포넌트 (MainBg)
 - 전체 화면 배경 + 좌측 브랜딩 영역 + 우측 카드 패널
 - bodyCard: 카드 안에 표시할 페이지 컴포넌트를 props로 전달받음
*/

import { D } from "../styles/design";
import tsLogo from "../assets/TS_Logo.png";
import Header from "./Header";
import Footer from "./Footer";

export default function MainBg({ bodyCard, floatingContent, nick }) {
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: D.mainBg,
                display: "flex",
                overflow: "auto",
            }}
        >
            {/* 좌측 브랜딩 영역 */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    marginRight: -150,
                    pointerEvents: "none",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    <img
                        src={tsLogo}
                        alt="Today's Skin"
                        style={{
                            width: 240,
                            objectFit: "contain",
                            opacity: 0.85,
                        }}
                    />
                    <div
                        style={{
                            marginTop: 20,
                            fontSize: 11,
                            color: D.textLight,
                            letterSpacing: "0.05em",
                            fontWeight: 300,
                            textAlign: "center",
                        }}
                    >
                        © 2026 TODAY'S SKIN / SMHRD
                    </div>
                </div>
            </div>

            {/* 우측 카드 패널 */}
            <div
                style={{
                    position: "relative",
                    width: 440,
                    height: "100%",
                    margin: "0px 300px 0px 0px",
                    background: D.bgMain,
                    borderRadius: 24,
                    boxShadow: "-8px 0 40px rgba(74, 52, 40, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    flexShrink: 0,
                    overflow: "hidden",
                }}
            >
                {/* 상단 그라데이션 배경 */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 260,
                    background: `linear-gradient(to bottom, ${D.bgSub}, ${D.bgMain})`,
                    borderRadius: "24px 24px 0 0",
                    zIndex: 0,
                    pointerEvents: "none",
                }} />

                {/* 헤더 — 스크롤 밖, 상단 고정 */}
                <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
                    <Header nick={nick} />
                </div>

                {/* 스크롤 영역 */}
                <div style={{ flex: 1, overflowY: "auto", paddingBottom: 60, position: "relative", zIndex: 1 }}>
                    {bodyCard}
                </div>

                {/* 플로팅 챗봇 */}
                {floatingContent}

                {/* 하단 탭 네비게이션 */}
                <Footer />
            </div>
        </div>
    );
}