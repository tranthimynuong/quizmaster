import React from 'react';
import { ShieldAlert, AlertTriangle, Maximize2, ShieldCheck, Clock, FileWarning } from 'lucide-react';

/**
 * ProctoringWarningModal:
 * Displays an urgent modal when a candidate switches tabs or exits fullscreen mode.
 */
export function ProctoringWarningModal({
  isOpen,
  warning,
  onDismiss,
  isLimitReached = false,
  submitting = false
}) {
  if (!isOpen || !warning) return null;

  const { type, message, count, max } = warning;
  const remaining = Math.max(0, max - count);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border-2 border-rose-500 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl shadow-rose-500/20 text-center relative overflow-hidden">
        {/* Top Warning Banner */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-red-600 animate-pulse" />

        <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <ShieldAlert className="w-8 h-8 stroke-[2.2] animate-bounce" />
        </div>

        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
          {isLimitReached ? 'ĐÌNH CHỈ & TỰ ĐỘNG NỘP BÀI' : 'CẢNH BÁO VI PHẠM QUY CHẾ THI'}
        </h3>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/80 text-rose-700 dark:text-rose-300 font-bold text-xs mb-4">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Lần vi phạm: {count} / {max}</span>
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-5 text-left">
          <p className="font-semibold text-rose-600 dark:text-rose-400 mb-1">
            {type === 'tab_switch' ? '⚠️ Chuyển tab hoặc rời màn hình làm bài' : '⚠️ Thoát chế độ toàn màn hình'}
          </p>
          <p>{message}</p>
        </div>

        {isLimitReached ? (
          <div className="p-4 rounded-2xl bg-rose-600 text-white text-xs sm:text-sm font-semibold mb-6">
            <p className="mb-2">
              Bạn đã vi phạm quy chế thi vượt quá giới hạn cho phép ({max} lần).
            </p>
            <p className="text-rose-100 font-normal">
              Bài thi của bạn đang được hệ thống tự động thu hồi và chấm điểm kết quả hiện tại.
            </p>
            {submitting && (
              <div className="flex items-center justify-center gap-2 mt-3 text-white font-bold">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Đang gửi bài thi lên máy chủ...</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
            <span className="font-bold text-amber-600 dark:text-amber-400">Lưu ý quan trọng: </span>
            Bạn còn <strong className="text-rose-600 dark:text-rose-400">{remaining} lần</strong> vi phạm nữa trước khi bài thi bị tự động thu hồi và nộp ngay lập tức.
          </div>
        )}

        {!isLimitReached && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-indigo-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Tôi đã hiểu & Tiếp tục làm bài thi</span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * ProctoringBadge:
 * Displays active security status indicator in the exam top bar.
 */
export function ProctoringBadge({ isEnabled, violationCount, maxViolations = 3, onReenterFullscreen, isFullscreen }) {
  if (!isEnabled) return null;

  const isDanger = violationCount >= maxViolations - 1;
  const isWarning = violationCount > 0 && !isDanger;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
          isDanger
            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 animate-pulse'
            : isWarning
            ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
            : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
        }`}
        title="Chế độ giám sát thi cử (Azota Style Proctoring)"
      >
        <span className="w-2 h-2 rounded-full bg-current animate-ping" />
        <span className="hidden sm:inline">Giám sát:</span>
        <span>{violationCount}/{maxViolations} vi phạm</span>
      </div>

      {!isFullscreen && (
        <button
          type="button"
          onClick={onReenterFullscreen}
          className="flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          title="Bật lại chế độ toàn màn hình"
        >
          <Maximize2 className="w-3 h-3 text-indigo-400" />
          <span className="hidden sm:inline">Toàn màn hình</span>
        </button>
      )}
    </div>
  );
}

/**
 * ProctoringReportCard:
 * Displays an audit report card on the result screen after submitting the exam.
 */
export function ProctoringReportCard({ violations = [], violationCount = 0, maxViolations = 3 }) {
  const isClean = violationCount === 0;
  const isDisqualified = violationCount >= maxViolations;

  return (
    <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm mt-6 text-left">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
            isClean
              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : isDisqualified
              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
          }`}>
            {isClean ? (
              <ShieldCheck className="w-5 h-5" />
            ) : isDisqualified ? (
              <ShieldAlert className="w-5 h-5" />
            ) : (
              <FileWarning className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-base">
              Biên Bản Giám Sát Phòng Thi (Proctoring Report)
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ghi nhận tính trung thực và các sự kiện rời khỏi màn hình thi
            </p>
          </div>
        </div>

        <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
          isClean
            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
            : isDisqualified
            ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
        }`}>
          {isClean
            ? '✅ Bài thi Hợp Lệ (0 vi phạm)'
            : isDisqualified
            ? `⛔ Bị đình chỉ do vượt giới hạn (${violationCount}/${maxViolations})`
            : `⚠️ Có cảnh cáo (${violationCount}/${maxViolations} lần rời màn hình)`}
        </div>
      </div>

      {isClean ? (
        <div className="pt-4 flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
          <span>
            Thí sinh tuân thủ nghiêm túc 100% quy chế phòng thi: không chuyển tab, không rời toàn màn hình, không thực hiện hành vi sao chép.
          </span>
        </div>
      ) : (
        <div className="pt-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Nhật ký các mốc sự kiện ghi nhận ({violations.length}):
          </p>
          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
            {violations.map((v, i) => (
              <div
                key={v.id || i}
                className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs"
              >
                <Clock className="w-3.5 h-3.5 text-rose-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      Lần {v.count || i + 1}: {v.type === 'tab_switch' ? 'Rời tab / Cửa sổ' : 'Thoát toàn màn hình'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{v.timestamp}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400 mt-0.5">{v.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
