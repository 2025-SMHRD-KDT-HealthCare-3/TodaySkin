/*
 - 공통 폼 입력 컴포넌트 (FormInput)
 - label + input 한 세트로 구성, 여러 페이지에서 재사용
*/

import React from "react";
import { D } from "../styles/design";

export default function FormInput({ label, required, ...props }) {
  return (
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
        {label}{required && " *"}
      </label>
      <input
        {...props}
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
          transition: "border-color 0.2s",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = D.cta)}
        onBlur={(e) => (e.target.style.borderColor = D.border)}
      />
    </div>
  );
}