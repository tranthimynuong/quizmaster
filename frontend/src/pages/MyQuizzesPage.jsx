import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyQuizzes, deleteQuiz } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  FolderKanban,
  PlusCircle,
  BookOpen,
  Calendar,
  Trash2,
  ExternalLink,
  Users,
  HelpCircle,
  RefreshCw,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function MyQuizzesPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMyQuizzes();
      setQuizzes(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách đề thi của bạn.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleDelete = async (quiz) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bộ đề "${quiz.title}"?`)) return;

    setDeletingId(quiz.share_code);
    try {
      await deleteQuiz(quiz.share_code);
      setQuizzes(quizzes.filter(q => q.share_code !== quiz.share_code));
    } catch (err) {
      alert(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-purple-500/20">
            <FolderKanban className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Kho Đề Thi Của Tôi
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
              Quản lý các bộ đề trắc nghiệm bạn đã soạn thảo trên hệ thống
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadQuizzes}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            to="/create"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Tạo đề thi mới
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <div className="w-8 h-8 border-3 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Đang tải danh sách đề thi...</p>
          </div>
        ) : error ? (
          <div className="py-12 text-center text-rose-500">{error}</div>
        ) : quizzes.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">Bạn chưa tạo bộ đề nào</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-6">Hãy tạo bộ đề đầu tiên bằng tay hoặc import từ file PDF bằng AI</p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              Tạo đề ngay
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                      {quiz.subject_name || 'Chưa phân loại'}
                    </span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
                      #{quiz.share_code}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-lg hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-2 mb-2">
                    <Link to={`/quiz/${quiz.share_code}`}>{quiz.title}</Link>
                  </h3>

                  {quiz.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                      {quiz.description}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 py-3 border-t border-slate-200 dark:border-slate-800/80 mb-4">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-indigo-500" />
                      {quiz.question_count} câu hỏi
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-emerald-500" />
                      {quiz.attempt_count} lượt thi
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={`/quiz/${quiz.share_code}`}
                      className="flex-1 py-2 px-3 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium text-center transition-colors flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Xem chi tiết
                    </Link>
                    <button
                      onClick={() => handleDelete(quiz)}
                      disabled={deletingId === quiz.share_code}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                      title="Xóa đề thi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
