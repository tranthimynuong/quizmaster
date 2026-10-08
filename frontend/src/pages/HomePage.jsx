import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Sparkles, BookOpen, Plus, Flame, Filter, RefreshCw, Layers, Trash2, AlertTriangle, X } from 'lucide-react';
import { fetchSubjects, fetchQuizzes, deleteQuiz } from '../services/api';
import QuizCard from '../components/QuizCard';
import ShareModal from '../components/ShareModal';

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSubjectParam = searchParams.get('subject');

  const [subjects, setSubjects] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState(
    initialSubjectParam ? (initialSubjectParam === 'none' ? 'none' : parseInt(initialSubjectParam)) : null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sharingQuiz, setSharingQuiz] = useState(null);
  const [deletingQuiz, setDeletingQuiz] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const p = searchParams.get('subject');
    if (p) {
      setSelectedSubjectId(p === 'none' ? 'none' : (isNaN(parseInt(p)) ? p : parseInt(p)));
    } else {
      setSelectedSubjectId(null);
    }
  }, [searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [subjectsData, quizzesData] = await Promise.all([
        fetchSubjects(),
        fetchQuizzes({ subjectId: selectedSubjectId, search: searchQuery })
      ]);
      setSubjects(subjectsData);
      setQuizzes(quizzesData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedSubjectId]);

  const handleSelectSubject = (id) => {
    setSelectedSubjectId(id);
    if (id) {
      setSearchParams({ subject: id.toString() });
    } else {
      setSearchParams({});
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!deletingQuiz) return;
    setIsDeleting(true);
    try {
      await deleteQuiz(deletingQuiz.share_code || deletingQuiz.id);
      setQuizzes(prev => prev.filter(q => q.id !== deletingQuiz.id));
      setDeletingQuiz(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bộ đề');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Search & Subject Filters */}
      <div id="quiz-grid" className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm môn học, đề thi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </form>
        </div>

        {/* Subject Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => handleSelectSubject(null)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              selectedSubjectId === null
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Tất cả chủ đề
          </button>

          {subjects.map((subj) => (
            <button
              key={subj.id}
              onClick={() => handleSelectSubject(subj.id)}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                selectedSubjectId === subj.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {subj.name}
            </button>
          ))}

          <button
            onClick={() => handleSelectSubject('none')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              selectedSubjectId === 'none'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Bộ đề tự do
          </button>

          <Link
            to="/subjects"
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200/80 dark:border-indigo-900 hover:bg-indigo-100 whitespace-nowrap flex items-center gap-1.5 transition-colors ml-auto shrink-0"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Quản lý chủ đề</span>
          </Link>
        </div>
      </div>

      {/* Quizzes Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
          <p className="text-sm font-medium">Đang tải danh sách bộ đề từ Neon PostgreSQL...</p>
        </div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Không tìm thấy bộ đề phù hợp</h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Hãy thử tìm kiếm với từ khóa khác hoặc tự tạo bộ đề của riêng bạn.
          </p>
          <Link
            to="/create"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo bộ đề mới</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <QuizCard
              key={quiz.id}
              quiz={quiz}
              onShare={(q) => setSharingQuiz(q)}
              onDelete={(q) => setDeletingQuiz(q)}
            />
          ))}
        </div>
      )}

      {/* Share Modal */}
      <ShareModal
        quiz={sharingQuiz}
        isOpen={!!sharingQuiz}
        onClose={() => setSharingQuiz(null)}
      />

      {/* Delete Confirmation Modal */}
      {deletingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setDeletingQuiz(null)}
              className="absolute top-4 right-4 p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Xác nhận xóa bộ đề
                </h3>
                <p className="text-xs text-slate-500">
                  Hành động này không thể hoàn tác
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/60">
              Bạn có chắc chắn muốn xóa bộ đề <strong className="text-slate-900 dark:text-white font-bold">"{deletingQuiz.title}"</strong> (gồm {deletingQuiz.question_count || 0} câu hỏi)? Toàn bộ dữ liệu câu hỏi và lịch sử làm bài sẽ bị xóa khỏi cơ sở dữ liệu.
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingQuiz(null)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
