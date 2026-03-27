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

      const handleLogin = async (data) => {
    try {
        const res = await fetch("http://localhost:3000/api/users/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        const result = await res.json();

        if (result.status === "success") {
            // 로그인 성공 → 메인 페이지로 이동
            console.log("환영합니다!", result.data.nick);
        } else {
            // 실패 → 에러 메시지 표시
            alert(result.data.message);
        }
    } catch (error) {
        alert("서버 연결에 실패했습니다.");
    }
};

  return (
    <MainBg>
      <LoginPage onLogin={handleLogin} />
    </MainBg>
  );
}