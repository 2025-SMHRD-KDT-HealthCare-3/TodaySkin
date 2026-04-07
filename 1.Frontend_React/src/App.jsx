import { useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import MainBg from "./components/MainBg";
import ChatFloat from "./components/ChatFloat";

import Login from "./pages/Login";
import Join from "./pages/Join";
import Main from "./pages/Main";
import ProfileView from "./pages/ProfileView";
import ProfileEdit from "./pages/ProfileEdit";
import ImgUpload from "./pages/ImgUpload";
import SkinReport from "./pages/SkinReport";
import ChalHistory from "./pages/ChalHistory";
import Chatbot from "./pages/Chatbot";
import CosManage from "./pages/CosManage";


/* 로그인 보호 래퍼 — 미로그인 시 로그인 페이지로 이동 (원래 경로 기억) */
function ProtectedRoute({ children, isLoggedIn }) {
    const location = useLocation();

    if (!isLoggedIn) {
        return <Navigate to="/" state={{ from: location.pathname }} replace />;
    }
    return children;
}


export default function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem("user"));
    const location = useLocation();
    
    // 분석 로딩 화면일 때 전체 숨기기 (헤더, 홈 아이콘, 챗봇 아이콘)
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    //  헤더 숨김 : 회원가입, /(메인)은 로그인 안 됐을 때(로그인 페이지), 분석로딩
    const hideHeader = ["/chatbot", "/join"].includes(location.pathname) 
        || (location.pathname === "/" && !isLoggedIn)
        || isAnalyzing;


    const stored = localStorage.getItem("user");
    const nickname = stored ? JSON.parse(stored).nick : "";

    return (
        <MainBg 
        nick={nickname}
        hideHeader={hideHeader}
        hideFooter={isAnalyzing}
        bodyCard={
                <Routes>
                    <Route path="/" element={
                        isLoggedIn ? <Main /> : <Login onLoginSuccess={() => setIsLoggedIn(true)} />
                    } />
                    <Route path="/join" element={<Join />} />

                    <Route path="/profile" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}><ProfileView /></ProtectedRoute>
                    } />
                    <Route path="/profile/edit" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}><ProfileEdit /></ProtectedRoute>
                    } />
                    <Route path="/analyze" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}>
                            <ImgUpload onLoadingChange={setIsAnalyzing} />
                        </ProtectedRoute>
                    } />
                    <Route path="/report" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}><SkinReport /></ProtectedRoute>
                    } />
                    <Route path="/challenge" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}><ChalHistory /></ProtectedRoute>
                    } />
                    <Route path="/chatbot" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}><Chatbot /></ProtectedRoute>
                    } />
                    <Route path="/cosmetics" element={
                        <ProtectedRoute isLoggedIn={isLoggedIn}><CosManage /></ProtectedRoute>
                    } />
                </Routes>
        }
        floatingContent={
            !isAnalyzing && isLoggedIn && location.pathname !== "/chatbot" && <ChatFloat />
        }
        />
    );
}



/*
   * <태그 속성={값}> React의 props 전달 문법

   * 자식이 없을 때 — 셀프 클로징 (뒤에 /)
    <CTAButton />

   * 자식이 있을 때 — 여는 태그 + 닫는 태그 (앞에 /)
    <ProtectedRoute>
        <ProfileView />    ← 이게 children prop
    </ProtectedRoute>
*/