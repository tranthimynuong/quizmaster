import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import HomePage from './pages/HomePage';
import QuizDetailPage from './pages/QuizDetailPage';
import PracticeModePage from './pages/PracticeModePage';
import ExamModePage from './pages/ExamModePage';
import CreateQuizPage from './pages/CreateQuizPage';
import SubjectsPage from './pages/SubjectsPage';

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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-indigo-500 selection:text-white transition-colors duration-200">
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/subjects" element={<SubjectsPage />} />
          <Route path="/create" element={<CreateQuizPage />} />
          <Route path="/quiz/:shareCode" element={<QuizDetailPage />} />
          <Route path="/quiz/:shareCode/practice" element={<PracticeModePage />} />
          <Route path="/quiz/:shareCode/exam" element={<ExamModePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-8 mt-12 bg-white/50 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <p className="font-semibold text-slate-600 dark:text-slate-400 mb-1">
            QuizMaster Platform • Phong cách Quizlet & Azota
          </p>
          <p>
            FastAPI • React • Tailwind CSS • Neon PostgreSQL Database
          </p>
        </div>
      </footer>
    </div>
  );
}
