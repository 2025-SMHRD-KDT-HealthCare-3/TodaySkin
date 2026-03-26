import { Route, Routes } from 'react-router-dom'
import MainBg from "./components/MainBg";
import LoginPage from "./pages/LoginPage";
/*
* 참고! 각각 포트번호가 달라야 충돌 없습니다.
React      → http://localhost:5173  (Vite 기본값)
Node.js    → http://localhost:3000
FastAPI    → http://localhost:8000
*/

export default function App() {
  return (
    <MainBg>
      <LoginPage />
    </MainBg>
  );
}