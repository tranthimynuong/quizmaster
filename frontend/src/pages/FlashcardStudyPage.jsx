import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  RotateCw, 
  BrainCircuit, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle, 
  Flame, 
  Trophy, 
  Calendar, 
  Layers, 
  Clock, 
  Volume2, 
  VolumeX, 
  Zap,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Check
} from 'lucide-react';
import { fetchQuizDetail, fetchSpacedCards, submitCardReview, fetchSpacedStats } from '../services/api';
import FormattedContent from '../components/FormattedContent';
import { playClickSound, playCorrectSound, playWrongSound, playFanfareSound } from '../utils/soundEffects';

export default function FlashcardStudyPage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [cards, setCards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);

  // Load quiz & cards on mount
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const quizData = await fetchQuizDetail(shareCode);
        setQuiz(quizData);

        const [cardsData, statsData] = await Promise.all([
          fetchSpacedCards(quizData.id),
          fetchSpacedStats(quizData.id).catch(() => null)
        ]);

        setCards(cardsData);
        setStats(statsData);
      } catch (err) {
        setError(err.message || 'Không thể tải thẻ flashcard.');
      } finally {
        setLoading(false);
      }
    }
    if (shareCode) {
      loadData();
    }
  }, [shareCode]);

  const currentCard = cards[currentIndex] || null;

  const handleFlip = useCallback(() => {
    if (soundEnabled) playClickSound();
    setIsFlipped(prev => !prev);
  }, [soundEnabled]);

  const handleGrade = useCallback(async (grade) => {
    if (!currentCard || submittingGrade) return;

    if (soundEnabled) {
      if (grade >= 3) playCorrectSound();
      else playWrongSound();
    }

    setSubmittingGrade(true);
    try {
      await submitCardReview(quiz.id, currentCard.question_id, grade);

      // Advance card
      if (currentIndex + 1 < cards.length) {
        setIsFlipped(false);
        setShowHint(false);
        setCurrentIndex(prev => prev + 1);
      } else {
        setSessionCompleted(true);
        if (soundEnabled) playFanfareSound();
      }

      // Refresh stats in background
      fetchSpacedStats(quiz.id).then(setStats).catch(() => {});
    } catch (err) {
      console.error('Error submitting card review:', err);
    } finally {
      setSubmittingGrade(false);
    }
  }, [currentCard, submittingGrade, quiz, currentIndex, cards.length, soundEnabled]);

  // Keyboard navigation & ratings
  useEffect(() => {
    function handleKeyDown(e) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === '1') handleGrade(1);
        else if (e.key === '2') handleGrade(2);
        else if (e.key === '3') handleGrade(3);
        else if (e.key === '4') handleGrade(4);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleGrade, isFlipped]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">
          Đang chuẩn bị bộ thẻ ghi nhớ thông minh SM-2...
        </p>
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
          {error || 'Không tìm thấy bộ đề.'}
        </h2>
        <Link
          to={`/quiz/${shareCode}`}
          className="mt-4 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-xs"
        >
          Quay lại chi tiết đề thi
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none pb-12">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/quiz/${shareCode}`}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title="Quay lại chi tiết"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white block truncate max-w-[200px] sm:max-w-md">
              {quiz.title}
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold flex items-center gap-1">
              <BrainCircuit className="w-3 h-3" />
              <span>Ghi Nhớ Spaced Repetition (SM-2)</span>
            </span>
          </div>
        </div>

        {/* Stats Pills & Sound */}
        <div className="flex items-center gap-2 sm:gap-3">
          {stats && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold">
              <span className="text-rose-500 font-bold" title="Cần ôn hôm nay">
                🔴 {stats.due_today}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-amber-500 font-bold" title="Đang ghi nhớ">
                🟡 {stats.learning}
              </span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="text-emerald-500 font-bold" title="Đã khắc sâu">
                🟢 {stats.mastered}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </header>

      {/* Main Flashcard Container */}
      <main className="flex-1 flex flex-col items-center justify-center max-w-4xl w-full mx-auto p-4 sm:p-6">

        {sessionCompleted ? (
          /* Session Completed Celebration */
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Trophy className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">
              HOÀN THÀNH PHIÊN ÔN TẬP!
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Bạn đã ôn luyện toàn bộ {cards.length} thẻ theo thuật toán lặp lại ngắt quãng SM-2.
            </p>

            <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 mb-6">
              <div className="text-center">
                <span className="text-lg font-black text-rose-500 block">
                  {stats?.due_today || 0}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  Cần ôn lại
                </span>
              </div>
              <div className="text-center border-x border-slate-200 dark:border-slate-700">
                <span className="text-lg font-black text-amber-500 block">
                  {stats?.learning || 0}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  Đang nhớ
                </span>
              </div>
              <div className="text-center">
                <span className="text-lg font-black text-emerald-500 block">
                  {stats?.mastered || 0}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  Khắc sâu
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  setSessionCompleted(false);
                  setCurrentIndex(0);
                  setIsFlipped(false);
                }}
                className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                Ôn Lại Từ Đầu
              </button>
              <Link
                to={`/quiz/${shareCode}`}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all flex items-center justify-center"
              >
                Về Trang Đề Thi
              </Link>
            </div>
          </div>
        ) : currentCard ? (
          <div className="w-full flex flex-col items-center">
            
            {/* Progress & Card Counter */}
            <div className="w-full max-w-2xl flex items-center justify-between mb-3 px-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Thẻ {currentIndex + 1} / {cards.length}</span>
              </span>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold ${
                  currentCard.state === 'mastered' ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                  currentCard.state === 'learning' ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400' :
                  'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                }`}>
                  {currentCard.state === 'mastered' ? 'Đã khắc sâu' :
                   currentCard.state === 'learning' ? 'Đang học' : 'Thẻ mới'}
                </span>
                {currentCard.repetition > 0 && (
                  <span className="text-[11px] text-slate-400 font-mono">
                    Chuỗi: {currentCard.repetition}
                  </span>
                )}
              </div>
            </div>

            {/* 3D Flip Card Container */}
            <div 
              className="w-full max-w-2xl h-[360px] sm:h-[420px] perspective-1000 cursor-pointer"
              onClick={handleFlip}
            >
              <div 
                className={`w-full h-full relative duration-500 transform-style-3d transition-transform ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
              >
                {/* ================= FRONT FACE (Question) ================= */}
                <div className="absolute inset-0 backface-hidden w-full h-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col justify-between transition-colors">
                  
                  {/* Top Bar of Front */}
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs">
                      {currentCard.chapter || 'Câu hỏi ôn tập'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowHint(!showHint);
                      }}
                      className="inline-flex items-center gap-1 text-xs text-amber-500 hover:text-amber-400 font-semibold"
                    >
                      <Lightbulb className="w-3.5 h-3.5" />
                      <span>{showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</span>
                    </button>
                  </div>

                  {/* Content (LaTeX & Code) */}
                  <div className="my-auto overflow-y-auto max-h-[220px] pr-2 text-center text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                    <FormattedContent content={currentCard.content} />
                    
                    {showHint && (
                      <div className="mt-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-normal text-left">
                        💡 4 phương án lựa chọn: A, B, C, D. Hãy suy nghĩ trong đầu trước khi lật mặt sau!
                      </div>
                    )}
                  </div>

                  {/* Bottom Prompt */}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <span className="hidden sm:inline">Phím [Space] để lật thẻ</span>
                    <span className="inline-flex items-center gap-1 text-indigo-500 font-bold ml-auto">
                      <RotateCw className="w-3.5 h-3.5" />
                      <span>Chạm để xem đáp án & giải thích</span>
                    </span>
                  </div>
                </div>

                {/* ================= BACK FACE (Answer & Explanation) ================= */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 w-full h-full bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-900 border-2 border-indigo-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between text-left text-white">
                  
                  {/* Top Bar of Back */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-1 shadow-md">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>ĐÁP ÁN: {currentCard.correct_answer}</span>
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400">
                      Chạm lại để xem mặt trước
                    </span>
                  </div>

                  {/* Correct Option & Explanation */}
                  <div className="my-auto overflow-y-auto max-h-[220px] pr-2 space-y-3">
                    <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700 font-semibold text-sm sm:text-base text-emerald-300 leading-snug">
                      <FormattedContent content={currentCard[`option_${currentCard.correct_answer.toLowerCase()}`] || ''} />
                    </div>

                    {currentCard[`explanation_${currentCard.correct_answer.toLowerCase()}`] && (
                      <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-700/50 text-xs sm:text-sm text-indigo-200 leading-relaxed">
                        <span className="font-bold text-amber-300 block mb-1">💡 Lời giải chi tiết:</span>
                        <FormattedContent content={currentCard[`explanation_${currentCard.correct_answer.toLowerCase()}`]} />
                      </div>
                    )}
                  </div>

                  {/* Bottom Indicator */}
                  <div className="pt-2 border-t border-slate-800 text-center text-xs text-slate-400">
                    Đánh giá mức độ nhớ của bạn bên dưới:
                  </div>
                </div>

              </div>
            </div>

            {/* 4 SM-2 Rating Buttons */}
            {isFlipped ? (
              <div className="w-full max-w-2xl mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
                
                {/* 1: AGAIN */}
                <button
                  type="button"
                  onClick={() => handleGrade(1)}
                  disabled={submittingGrade}
                  className="p-3 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 border-2 border-rose-500/40 text-rose-600 dark:text-rose-400 text-center transition-all group"
                >
                  <span className="text-xs font-black block group-hover:scale-105 transition-transform">
                    1. Học Lại
                  </span>
                  <span className="text-[10px] text-rose-500/80 font-mono block mt-0.5">
                    &lt; 10 phút
                  </span>
                </button>

                {/* 2: HARD */}
                <button
                  type="button"
                  onClick={() => handleGrade(2)}
                  disabled={submittingGrade}
                  className="p-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 active:bg-amber-500/35 border-2 border-amber-500/40 text-amber-600 dark:text-amber-400 text-center transition-all group"
                >
                  <span className="text-xs font-black block group-hover:scale-105 transition-transform">
                    2. Khó
                  </span>
                  <span className="text-[10px] text-amber-500/80 font-mono block mt-0.5">
                    +1 ngày
                  </span>
                </button>

                {/* 3: GOOD */}
                <button
                  type="button"
                  onClick={() => handleGrade(3)}
                  disabled={submittingGrade}
                  className="p-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 active:bg-emerald-500/35 border-2 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-center transition-all group"
                >
                  <span className="text-xs font-black block group-hover:scale-105 transition-transform">
                    3. Nhớ Tốt
                  </span>
                  <span className="text-[10px] text-emerald-500/80 font-mono block mt-0.5">
                    +3-6 ngày
                  </span>
                </button>

                {/* 4: EASY */}
                <button
                  type="button"
                  onClick={() => handleGrade(4)}
                  disabled={submittingGrade}
                  className="p-3 rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 active:bg-sky-500/35 border-2 border-sky-500/40 text-sky-600 dark:text-sky-400 text-center transition-all group"
                >
                  <span className="text-xs font-black block group-hover:scale-105 transition-transform">
                    4. Dễ Dàng
                  </span>
                  <span className="text-[10px] text-sky-500/80 font-mono block mt-0.5">
                    +10-14 ngày
                  </span>
                </button>

              </div>
            ) : (
              <div className="w-full max-w-2xl mt-5 flex items-center justify-between px-2">
                <button
                  type="button"
                  onClick={() => {
                    if (currentIndex > 0) {
                      setIsFlipped(false);
                      setCurrentIndex(prev => prev - 1);
                    }
                  }}
                  disabled={currentIndex === 0}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Thẻ trước</span>
                </button>

                <button
                  type="button"
                  onClick={handleFlip}
                  className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md active:scale-98 transition-all flex items-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Lật Xem Đáp Án (Space)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (currentIndex + 1 < cards.length) {
                      setIsFlipped(false);
                      setCurrentIndex(prev => prev + 1);
                    }
                  }}
                  disabled={currentIndex + 1 >= cards.length}
                  className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-white dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 disabled:opacity-40 transition-all flex items-center gap-1.5"
                >
                  <span>Thẻ sau</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Keyboard shortcut legend */}
            <div className="mt-6 flex items-center justify-center gap-4 text-[11px] text-slate-400 dark:text-slate-500">
              <span>Phím tắt:</span>
              <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">[Phím Cách]: Lật thẻ</span>
              <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">[1-4]: Đánh giá ghi nhớ</span>
            </div>

          </div>
        ) : null}

      </main>
    </div>
  );
}
