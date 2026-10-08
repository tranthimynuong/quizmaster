import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import QuizDetailPage from './pages/QuizDetailPage';
import PracticeModePage from './pages/PracticeModePage';
import ExamModePage from './pages/ExamModePage';
import CreateQuizPage from './pages/CreateQuizPage';
import SubjectsPage from './pages/SubjectsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminUsersPage from './pages/AdminUsersPage';
import MyHistoryPage from './pages/MyHistoryPage';
import MyQuizzesPage from './pages/MyQuizzesPage';

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('quiz_theme') === 'dark' ||
      (!('quiz_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('quiz_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('quiz_theme', 'light');
    }
  }, [darkMode]);

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors duration-200 font-sans">
        <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

        <main className="flex-1">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomePage />} />
            <Route path="/subjects" element={<SubjectsPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/quiz/:shareCode" element={<QuizDetailPage />} />
            <Route path="/quiz/:shareCode/practice" element={<PracticeModePage />} />
            <Route path="/quiz/:shareCode/exam" element={<ExamModePage />} />

            {/* Authenticated User Routes */}
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <MyHistoryPage />
                </ProtectedRoute>
              }
            />

            {/* Teacher / Admin Routes */}
            <Route
              path="/create"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <CreateQuizPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-quizzes"
              element={
                <ProtectedRoute allowedRoles={['teacher', 'admin']}>
                  <MyQuizzesPage />
                </ProtectedRoute>
              }
            />

            {/* Admin Only Routes */}
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminUsersPage />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-8 mt-12 bg-white/60 dark:bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500 dark:text-slate-500">
            <p className="font-semibold text-slate-700 dark:text-slate-400 mb-1">
              QuizMaster Platform • Nền Tảng Luyện Thi & Trắc Nghiệm Thông Minh
            </p>
            <p>
              Hệ Thống Ôn Luyện, Tạo Đề Thi Trắc Nghiệm & Phân Quyền Trực Tuyến
            </p>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
