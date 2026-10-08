import React from 'react';
import { Check, X } from 'lucide-react';

export default function OptionExplanationCard({
  question,
  selectedOption,
  showAll = true
}) {
  if (!question) return null;

  const options = [
    { key: 'A', text: question.option_a, exp: question.explanation_a },
    { key: 'B', text: question.option_b, exp: question.explanation_b },
    { key: 'C', text: question.option_c, exp: question.explanation_c },
    { key: 'D', text: question.option_d, exp: question.explanation_d },
  ];

  const correctKey = (question.correct_answer || '').toUpperCase();

  return (
    <div className="space-y-3">
      {options.map((opt) => {
        const isCorrect = opt.key === correctKey;
        const isChosen = selectedOption?.toUpperCase() === opt.key;

        let cardStyle = 'border-2 border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40';
        let circleStyle = 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
        let letterStyle = 'text-slate-700 dark:text-slate-300 font-bold';
        let textStyle = 'text-slate-700 dark:text-slate-300 font-medium';

        if (isCorrect) {
          cardStyle = 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-500/20';
          circleStyle = 'border-emerald-500 bg-emerald-600 text-white';
          letterStyle = 'text-emerald-900 dark:text-emerald-200 font-black';
          textStyle = 'text-emerald-950 dark:text-emerald-100 font-semibold';
        } else if (isChosen && !isCorrect) {
          cardStyle = 'border-2 border-rose-400 bg-rose-50/80 dark:bg-rose-950/30 ring-1 ring-rose-400/20';
          circleStyle = 'border-rose-500 bg-rose-600 text-white';
          letterStyle = 'text-rose-900 dark:text-rose-200 font-black';
          textStyle = 'text-rose-950 dark:text-rose-100 font-semibold';
        }

        return (
          <div
            key={opt.key}
            className={`rounded-2xl p-3.5 sm:p-4 border transition-all ${cardStyle}`}
          >
            {/* Option text */}
            <div className="flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full border text-xs sm:text-sm font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-colors ${circleStyle}`}>
                {isCorrect ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : isChosen && !isCorrect ? (
                  <X className="w-4 h-4 stroke-[3]" />
                ) : (
                  <span>{opt.key}</span>
                )}
              </div>

              <div className="flex-1 min-w-0 pt-0.5">
                <span className={`text-sm sm:text-base leading-relaxed ${textStyle}`}>
                  <strong className={`mr-1.5 ${letterStyle}`}>{opt.key}.</strong>
                  {opt.text}
                </span>
              </div>
            </div>

            {/* Status & Explanation */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
              {isCorrect && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Câu trả lời chính xác</span>
                </div>
              )}

              {isChosen && !isCorrect && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">
                  <X className="w-4 h-4 stroke-[3]" />
                  <span>Lựa chọn của bạn (Chưa đúng)</span>
                </div>
              )}

              <div className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 mt-1">
                <strong className="text-slate-800 dark:text-slate-200">💡 Giải thích: </strong>
                {opt.exp ? (
                  opt.exp
                ) : isCorrect ? (
                  'Lựa chọn chính xác theo nội dung đề bài.'
                ) : (
                  'Phương án này chưa chính xác theo nội dung đề bài.'
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
