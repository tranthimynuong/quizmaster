import React, { useState } from 'react';
import { X, Copy, Check, Share2, ExternalLink, QrCode, MessageCircle, Send, Globe, Smartphone } from 'lucide-react';

export default function ShareModal({ quiz, isOpen, onClose }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!isOpen || !quiz) return null;

  const shareCode = quiz.share_code || quiz.id;
  const shareUrl = `${window.location.origin}/quiz/${shareCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareUrl)}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(shareCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2200);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: quiz.title,
          text: `Cùng ôn luyện đề thi "${quiz.title}" trên QuizMaster! Mã đề: ${shareCode}`,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleFacebookShare = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const handleTelegramShare = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`Cùng làm bộ đề thi: ${quiz.title} (Mã: ${shareCode})`)}`;
    window.open(tgUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Đóng"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5 pr-8">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
              Chia sẻ bộ đề thi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5" title={quiz.title}>
              {quiz.title}
            </p>
          </div>
        </div>

        {/* Share Code Card */}
        <div className="mb-4 p-3.5 bg-gradient-to-r from-indigo-50/70 to-purple-50/70 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
              Mã chia sẻ (Share Code)
            </div>
            <div className="font-mono text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-wide mt-0.5">
              {shareCode}
            </div>
          </div>
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700 active:scale-95 transition-all"
          >
            {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
          </button>
        </div>

        {/* Share Link Input */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Đường dẫn làm bài trực tiếp
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs font-mono bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-700 dark:text-slate-200 focus:outline-none select-all"
            />
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shadow-indigo-500/20 active:scale-95 transition-all shrink-0"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLink ? 'Đã chép link' : 'Chép link'}</span>
            </button>
          </div>
        </div>

        {/* Quick Social & Device Sharing */}
        <div className="mb-5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5">
            Tùy chọn chia sẻ nhanh
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 transition-all text-center group"
            >
              <Smartphone className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Gửi qua App</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQr(!showQr)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center group ${
                showQr
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700'
              }`}
            >
              <QrCode className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Mã QR</span>
            </button>

            <button
              type="button"
              onClick={handleFacebookShare}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/80 dark:border-slate-700 transition-all text-center group"
            >
              <Globe className="w-5 h-5 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Facebook</span>
            </button>
          </div>
        </div>

        {/* QR Code Section (Collapsible) */}
        {showQr && (
          <div className="mb-5 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center animate-in fade-in zoom-in-95">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-200 mb-2">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-40 h-40 object-contain"
                loading="lazy"
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quét mã bằng camera điện thoại hoặc Zalo để mở đề thi ngay
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <a
            href={`/quiz/${shareCode}/practice`}
            className="flex-1 text-center py-2.5 px-3 rounded-xl border border-indigo-200 dark:border-indigo-800/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs font-bold transition-colors"
          >
            Luyện tập ngay
          </a>
          <a
            href={`/quiz/${shareCode}/exam`}
            className="flex-1 text-center py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all"
          >
            Thi thử ngay
          </a>
        </div>

      </div>
    </div>
  );
}
