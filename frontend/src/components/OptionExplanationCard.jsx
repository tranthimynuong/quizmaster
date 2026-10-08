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

        let cardStyle = 'bg-slate-50/50 dark:bg-slate-900/40 border-transparent';
        let letterStyle = 'text-slate-500 dark:text-slate-400 font-medium';
        let textStyle = 'text-slate-700 dark:text-slate-300 font-normal';

        if (isCorrect) {
          cardStyle = 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60';
          letterStyle = 'text-emerald-800 dark:text-emerald-200 font-bold';
          textStyle = 'text-emerald-900 dark:text-emerald-100 font-semibold';
        } else if (isChosen && !isCorrect) {
          cardStyle = 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60';
          letterStyle = 'text-rose-800 dark:text-rose-200 font-bold';
          textStyle = 'text-rose-900 dark:text-rose-100 font-semibold';
        }

        return (
          <div
            key={opt.key}
            className={`rounded-2xl p-4 border transition-all ${cardStyle}`}
          >
            {/* Option text */}
            <div className="flex items-start gap-2">
              <span className={`text-sm sm:text-base shrink-0 ${letterStyle}`}>
                {opt.key}.
              </span>
              <span className={`text-sm sm:text-base leading-snug flex-1 ${textStyle}`}>
                {opt.text}
              </span>
            </div>

            {/* Status & Explanation */}
            <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
              {isCorrect && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Câu trả lời chính xác</span>
                </div>
              )}

              {isChosen && !isCorrect && (
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">
                  <X className="w-4 h-4 stroke-[3]" />
                  <span>Chưa đúng lắm!</span>
                </div>
              )}

              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed pl-0.5">
                {opt.exp ? (
                  opt.exp
                ) : isCorrect ? (
                  'Lựa chọn chính xác theo nội dung đề bài.'
                ) : (
                  'Phương án này chưa chính xác theo nội dung đề bài.'
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
