import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyHistory } from '../services/api';
import {
  History,
  Trophy,
  Calendar,
  ArrowRight,
  BookOpen,
  Award,
  Sparkles,
  RefreshCw,
  Clock
} from 'lucide-react';

export default function MyHistoryPage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyHistory();
      setHistory(data);
    } catch (err) {
      setError(err.message || 'Không thể tải lịch sử làm bài.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const totalAttempts = history.length;
  const avgScore = totalAttempts > 0
    ? (history.reduce((acc, h) => acc + h.score, 0) / totalAttempts).toFixed(1)
    : 0;
  const maxScore = totalAttempts > 0
    ? Math.max(...history.map(h => h.score)).toFixed(1)
    : 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-2xl text-white shadow-lg shadow-amber-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Lịch Sử Làm Bài Của Tôi
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
              Theo dõi tiến độ học tập và kết quả các bài thi đã làm
            </p>
          </div>
        </div>

        <button
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium border border-slate-200 dark:border-slate-700 transition-colors self-start sm:self-auto shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalAttempts}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Lượt thi đã hoàn thành</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{avgScore} <span className="text-xs font-normal text-slate-400">/ 10</span></div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Điểm trung bình</div>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center gap-4 shadow-sm">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{maxScore} <span className="text-xs font-normal text-slate-400">/ 10</span></div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Điểm cao nhất</div>
          </div>
        </div>
      </div>

      {/* Attempts List */}
      <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          Chi Tiết Các Lượt Làm Bài
        </h2>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải lịch sử làm bài...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <History className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">Bạn chưa làm bài thi nào</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-6">Hãy thử sức với các bộ đề trắc nghiệm ngay!</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              Xem danh sách bộ đề
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => {
              const scoreNum = parseFloat(item.score);
              const isHigh = scoreNum >= 8.0;
              const isMedium = scoreNum >= 5.0 && scoreNum < 8.0;

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-bold text-base shrink-0 border ${
                        isHigh
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                          : isMedium
                          ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      <span>{scoreNum}</span>
                      <span className="text-[10px] font-normal opacity-70">Điểm</span>
                    </div>

                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white text-base hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                        <Link to={`/quiz/${item.quiz_share_code}`}>
                          {item.quiz_title || 'Bộ đề trắc nghiệm'}
                        </Link>
                      </h3>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {item.submitted_at
                            ? new Date(item.submitted_at).toLocaleString('vi-VN')
                            : 'Vừa xong'}
                        </span>
                        <span className="font-mono text-slate-400 dark:text-slate-500">Mã: {item.quiz_share_code}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Link
                      to={`/quiz/${item.quiz_share_code}/exam`}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium transition-colors"
                    >
                      Thi lại
                    </Link>
                    <Link
                      to={`/quiz/${item.quiz_share_code}/practice`}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-medium transition-colors"
                    >
                      Ôn tập
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
