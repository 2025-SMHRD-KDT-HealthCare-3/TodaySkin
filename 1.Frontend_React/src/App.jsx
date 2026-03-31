import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import MainBg from "./components/MainBg";

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
import CosRec from "./pages/CosRec";


export default function App() {
    // 초기값을 localStorage에서 확인 : 로그인 성공하면 로그인 유지
    const [ isLoggedIn, setIsLoggedIn ] = useState(() => !!localStorage.getItem("user"));

    return (
        <MainBg bodyCard={
            <Routes>
                <Route path="/" element={isLoggedIn ? <Main /> : <Login onLoginSuccess={() => setIsLoggedIn(true)} />} />
                <Route path="/join" element={<Join />} />
                <Route path="/profile" element={<ProfileView />} />
                <Route path="/profile/edit" element={<ProfileEdit />} />
                <Route path="/analysis" element={<ImgUpload />} />
                <Route path="/report" element={<SkinReport />} />
                <Route path="/challenge" element={<ChalHistory />} />
                <Route path="/chatbot" element={<Chatbot />} />
                <Route path="/cosmetics" element={<CosManage />} />
                <Route path="/recommend" element={<CosRec />} />
            </Routes>
        }>
        </MainBg>
    );
}