import React, { useState } from 'react';
import { X, Copy, Check, Share2, ExternalLink, QrCode } from 'lucide-react';

export default function ShareModal({ quiz, isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !quiz) return null;

  const shareUrl = `${window.location.origin}/quiz/${quiz.share_code}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(quiz.share_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Chia sẻ bộ đề thi</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{quiz.title}</p>
          </div>
        </div>

        {/* Share Code Box */}
        <div className="mb-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
            Mã chia sẻ (Share Code)
          </label>
          <div className="flex items-center justify-between">
            <span className="font-mono text-base font-bold text-indigo-600 dark:text-indigo-400">
              {quiz.share_code}
            </span>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 px-2.5 py-1 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
            </button>
          </div>
        </div>

        {/* Share Link Box */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Đường dẫn làm bài trực tiếp
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs sm:text-sm font-mono bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 focus:outline-none"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm active:scale-95 transition-all whitespace-nowrap"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex gap-2">
          <a
            href={`/quiz/${quiz.share_code}/practice`}
            className="flex-1 text-center py-2.5 px-4 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-sm font-semibold transition-colors"
          >
            Vào Luyện tập ngay
          </a>
          <a
            href={`/quiz/${quiz.share_code}/exam`}
            className="flex-1 text-center py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:opacity-95 shadow-sm transition-opacity"
          >
            Vào Thi thử ngay
          </a>
        </div>

      </div>
    </div>
  );
}
