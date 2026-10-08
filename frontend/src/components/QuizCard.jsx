import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, HelpCircle, Trophy, Share2, Play, GraduationCap, Trash2 } from 'lucide-react';

export default function QuizCard({ quiz, onShare, onDelete }) {
  return (
    <div className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-all duration-300 flex flex-col justify-between overflow-hidden">
      
      {/* Top Banner accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-80 group-hover:opacity-100 transition-opacity" />

      <div className="p-5 sm:p-6 flex-1 flex flex-col">
        {/* Header Tags */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/40 truncate max-w-[170px]">
            <BookOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{quiz.subject_name || 'Bộ đề tự do'}</span>
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onShare(quiz)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors"
              title="Chia sẻ bộ đề"
            >
              <Share2 className="w-4 h-4" />
            </button>
            {onDelete && (
              <button
                onClick={() => onDelete(quiz)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                title="Xóa bộ đề"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <Link
          to={`/quiz/${quiz.share_code}`}
          className="block font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 mb-2"
        >
          {quiz.title}
        </Link>

        {/* Description */}
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 flex-1">
          {quiz.description || 'Bộ đề trắc nghiệm chuẩn hóa với giải thích chi tiết cho từng phương án lựa chọn.'}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 py-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
            <span>{quiz.question_count || 0} câu hỏi</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>{quiz.attempt_count || 0} lượt làm</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <Link
            to={`/quiz/${quiz.share_code}/practice`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 font-semibold text-xs transition-colors"
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Luyện tập</span>
          </Link>

          <Link
            to={`/quiz/${quiz.share_code}/exam`}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-indigo-600 dark:bg-slate-800 dark:hover:bg-indigo-600 text-white font-semibold text-xs shadow-sm transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Thi thử</span>
          </Link>
        </div>

      </div>
    </div>
  );
}
