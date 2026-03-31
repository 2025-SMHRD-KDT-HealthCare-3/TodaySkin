/*
 - 공통 레이아웃 컴포넌트 (MainBg)
 - 전체 화면 배경 + 좌측 브랜딩 영역 + 우측 카드 패널
 - bodyCard: 카드 안에 표시할 페이지 컴포넌트를 props로 전달받음
*/

import { D } from "../styles/design";
import tsLogo from "../assets/TS_Logo.png";

export default function MainBg({ bodyCard }) {
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

            {/* 좌측 브랜딩 영역 — 로고 + 카피라이트 (배경 전용, 클릭 불가) */}
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

                {/* 로고 + 카피라이트 묶음 (세로 가운데 정렬) */}
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

            {/* 우측 카드 패널 — bodyCard props로 전달받은 페이지를 렌더링 */}
            <div
                style={{
                    width: 440,
                    height: "100%",
                    margin: "0px 300px 0px 0px",
                    background: D.bgMain,
                    borderRadius: 24,
                    boxShadow: "-8px 0 40px rgba(74, 52, 40, 0.08)",
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                    flexShrink: 0,
                }}
            >
                {bodyCard}
            </div>
        </div>
    );
}