import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import QuizPage from './pages/QuizPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage/>} />
      <Route path="/home" element={<DashboardPage />} />
      <Route path="/loginpg" element={<LoginPage />} />
      <Route path="/quiz" element={<QuizPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}