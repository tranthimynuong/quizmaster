import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, PlusCircle, Moon, Sun, Sparkles, Compass } from 'lucide-react';

export default function Navbar({ darkMode, setDarkMode }) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 glass-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
              QuizMaster
            </span>
            <span className="hidden sm:inline-block ml-1.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
              Azota/Quizlet
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            <Compass className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">Khám phá đề</span>
          </Link>

          <Link
            to="/subjects"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">Chủ đề & Môn học</span>
          </Link>

          <Link
            to="/create"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-95 shadow-md shadow-indigo-500/20 active:scale-95 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Tạo đề / Nạp PDF</span>
          </Link>

          {/* Dark / Light Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={darkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
          >
            {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
          </button>
        </nav>
      </div>
    </header>
  );
}
