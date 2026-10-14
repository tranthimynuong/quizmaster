import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  X,
  Send,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { askAITutor } from '../services/api';
import FormattedContent from './FormattedContent';

export default function AITutorModal({
  isOpen,
  onClose,
  quizId,
  question,
  userChoice = null
}) {
  const [currentMode, setCurrentMode] = useState('explain_wrong');
  const [loading, setLoading] = useState(false);
  const [aiData, setAiData] = useState(null);
  const [error, setError] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');

  // Similar Question interactive state
  const [similarAnswer, setSimilarAnswer] = useState(null);
  const [showSimilarResult, setShowSimilarResult] = useState(false);

  // Initialize or reset when opened
  useEffect(() => {
    if (isOpen && question) {
      setError(null);
      setCustomPrompt('');
      setSimilarAnswer(null);
      setShowSimilarResult(false);

      const isWrong = userChoice && userChoice !== question.correct_answer;
      const initialMode = isWrong ? 'explain_wrong' : 'mnemonic_tip';
      setCurrentMode(initialMode);
      fetchGuidance(initialMode);
    } else {
      setAiData(null);
    }
  }, [isOpen, question?.id, userChoice]);

  const fetchGuidance = async (mode, promptText = '') => {
    if (!question || !quizId) return;
    setLoading(true);
    setError(null);
    setSimilarAnswer(null);
    setShowSimilarResult(false);

    try {
      const data = await askAITutor(quizId, question.id, {
        userChoice: userChoice,
        studentPrompt: promptText,
        mode: mode
      });
      setAiData(data);
    } catch (err) {
      setError(err.message || 'Lỗi khi trò chuyện cùng Gia sư AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    fetchGuidance(mode);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customPrompt.trim() || loading) return;
    setCurrentMode('chat');
    fetchGuidance('chat', customPrompt.trim());
  };

  const handleAnswerSimilar = (optKey) => {
    if (showSimilarResult) return;
    setSimilarAnswer(optKey);
    setShowSimilarResult(true);

    if (optKey === aiData?.similar_question?.correct_answer) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
  };

  if (!isOpen || !question) return null;

  const isWrongChoice = userChoice && userChoice !== question.correct_answer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl shadow-indigo-500/10 overflow-hidden text-left">
        
        {/* Header Bar */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/80 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-white">
                  Gia Sư AI QuizMaster
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Gemini Tutor</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Phân tích bản chất, gỡ bẫy tư duy & thực hành tức thì
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Snapshot Strip */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800/60 text-xs">
          <div className="text-slate-700 dark:text-slate-300 line-clamp-2 font-medium mb-1.5">
            <span className="font-bold text-indigo-600 dark:text-indigo-400 mr-1.5">Câu hỏi:</span>
            {question.content}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {userChoice && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold ${
                isWrongChoice
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
              }`}>
                {isWrongChoice ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                <span>Bạn chọn: ({userChoice})</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
              <Check className="w-3 h-3" />
              <span>Đáp án đúng: ({question.correct_answer})</span>
            </span>
          </div>
        </div>

        {/* Quick Action Chips */}
        <div className="px-5 py-2.5 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto select-none">
          {isWrongChoice && (
            <button
              type="button"
              onClick={() => handleModeChange('explain_wrong')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
                currentMode === 'explain_wrong'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-rose-300" />
              <span>Vì sao tôi sai?</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleModeChange('mnemonic_tip')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              currentMode === 'mnemonic_tip'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
            <span>Mẹo ghi nhớ cốt lõi</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('generate_similar')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0 ${
              currentMode === 'generate_similar'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-300" />
            <span>Luyện 1 câu tương tự</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-500 animate-pulse">
                Gia sư AI đang phân tích logic câu hỏi và biên soạn lời giải...
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {!loading && aiData && (
            <div className="space-y-4">
              {/* AI Answer Content with KaTeX & Prism Markdown */}
              <div className="p-4 rounded-2xl bg-indigo-50/40 dark:bg-slate-800/40 border border-indigo-100 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 text-sm leading-relaxed">
                <FormattedContent text={aiData.answer} />
              </div>

              {/* Key Takeaway Banner */}
              {aiData.key_takeaway && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold uppercase tracking-wider block text-[10px] text-amber-700 dark:text-amber-400">
                      Điểm Cốt Lõi Cần Nhớ
                    </strong>
                    <p className="mt-0.5">{aiData.key_takeaway}</p>
                  </div>
                </div>
              )}

              {/* Similar Practice Question Card */}
              {aiData.similar_question && (
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border-2 border-indigo-200 dark:border-indigo-900/60 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-[11px] font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Bài tập thử thách tương tự</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      Bấm chọn để kiểm tra độ hiểu bài
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    <FormattedContent text={aiData.similar_question.content} />
                  </div>

                  {/* Options A, B, C, D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                    {['A', 'B', 'C', 'D'].map((key) => {
                      const optText = aiData.similar_question[`option_${key.toLowerCase()}`];
                      if (!optText) return null;

                      const isChosen = similarAnswer === key;
                      const isCorrect = key === aiData.similar_question.correct_answer;

                      let btnCls = 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100';
                      if (showSimilarResult) {
                        if (isCorrect) {
                          btnCls = 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200 font-bold';
                        } else if (isChosen && !isCorrect) {
                          btnCls = 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-800 dark:text-rose-200 font-bold';
                        }
                      } else if (isChosen) {
                        btnCls = 'bg-indigo-600 text-white font-bold border-indigo-600';
                      }

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleAnswerSimilar(key)}
                          disabled={showSimilarResult}
                          className={`p-2.5 rounded-xl border text-left flex items-start gap-2 transition-all ${btnCls}`}
                        >
                          <span className="font-bold shrink-0">{key}.</span>
                          <span className="flex-1"><FormattedContent text={optText} compact /></span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Immediate Feedback for similar question */}
                  {showSimilarResult && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-700 text-xs">
                      {similarAnswer === aiData.similar_question.correct_answer ? (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Xuất sắc! Bạn đã hiểu đúng bài học và trả lời chính xác!</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 font-bold">
                          <XCircle className="w-4 h-4" />
                          <span>Chưa chính xác! Đáp án đúng của câu này là ({aiData.similar_question.correct_answer}).</span>
                        </div>
                      )}
                      {aiData.similar_question.explanation && (
                        <p className="mt-1 text-slate-500 dark:text-slate-400">
                          {aiData.similar_question.explanation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Free-form Chat Input at Bottom */}
        <form onSubmit={handleCustomSubmit} className="p-3 sm:p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center gap-2">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Hỏi thêm Gia sư AI (ví dụ: 'Cho tôi thêm ví dụ', 'Giải thích dòng 3')..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!customPrompt.trim() || loading}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all disabled:opacity-40 shrink-0"
            title="Gửi câu hỏi cho Gia sư AI"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
