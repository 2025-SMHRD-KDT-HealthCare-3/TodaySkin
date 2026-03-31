/*
 - 공통 CTA 버튼 컴포넌트 (CTAButton)
 - 로그인, 회원가입, 회원정보수정 등 주요 액션 버튼으로 재사용
 - children: 버튼 텍스트, onClick: 클릭 핸들러, style: 추가 스타일 오버라이드
 */

import { D } from "../styles/design";

export default function CTAButton({ children, onClick, style }) {
  return (
    <button
      onClick={onClick}
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
        marginTop: 35,
        ...style,
      }}
    >
      {children}
    </button>
  );
}