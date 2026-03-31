/*
 - 피부타입 선택 컴포넌트 (SkinType)
 - 피부타입 목록 + 선택 UI를 포함한 재사용 컴포넌트
 - Join.jsx, ProfileEdit.jsx에서 사용
 - value: 현재 선택된 피부타입, onChange: 선택 변경 함수
*/

import React from "react";
import { D } from "../styles/design";
import { WiRaindrop } from "react-icons/wi";
import { FiSun, FiLayers } from "react-icons/fi";
import { MdOutlineSpa } from "react-icons/md";
import { RiLeafLine } from "react-icons/ri";

/*
 - 피부타입 목록 (DB skin_type 컬럼에 value로 저장)
*/
const skinTypes = [
    {
        value: "건성",
        desc: "수분이 부족하고 당김이 자주 발생합니다. 세안 후 당기는 느낌이 있고, 피부 결이 다소 거칠고 푸석해요.",
        icon: WiRaindrop,
    },
    {
        value: "지성",
        desc: "피지 분비가 많고 모공이 넓습니다. 세안 후에도 번들거림이 남아요. 유분기로 인해 트러블이 잦은 상태입니다.",
        icon: FiSun,
    },
    {
        value: "복합성",
        desc: "부위별로 피부 상태가 다릅니다. T존(이마·코·턱)은 지성, 볼은 건성의 특성을 보입니다.",
        icon: FiLayers,
    },
    {
        value: "민감성",
        desc: "외부 환경 변화나 화장품 성분 등 자극에 쉽게 반응하고 붉어짐, 따가움이 나타납니다.",
        icon: MdOutlineSpa,
    },
    {
        value: "중성",
        desc: "유분과 수분의 균형이 잡힌 피부로 큰 트러블 없이 관리가 비교적 쉬운 편입니다.",
        icon: RiLeafLine,
    },
];

/*
 - 피부타입 선택 → USERS.skin_type
*/
export default function SkinType({ value, onChange }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {skinTypes.map((type) => {
                const selected = value === type.value;
                const Icon = type.icon;
                return (
                    <button
                        key={type.value}
                        onClick={() => onChange(type.value)}
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
                                {type.value}
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
    );
}