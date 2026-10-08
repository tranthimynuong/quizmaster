import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  HelpCircle,
  Shuffle,
  Grid,
  BookOpen,
  ArrowLeft,
  FileText,
  GraduationCap,
  Sparkles,
  CheckSquare,
  Square,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { fetchQuizDetail } from '../services/api';
import FormattedContent from '../components/FormattedContent';

export default function PracticeModePage() {
  const { shareCode } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const targetChapterParam = searchParams.get('chapter');
  const shouldAutoResume = searchParams.get('resume') === 'true';
  const initialMode = searchParams.get('mode') === 'study' ? 'study' : 'practice';
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [practiceMode, setPracticeMode] = useState(initialMode);
  const [savedProgress, setSavedProgress] = useState(null);

  // Configuration State
  const [isConfiguring, setIsConfiguring] = useState(!targetChapterParam && !shouldAutoResume);
  const [selectedCount, setSelectedCount] = useState(50);
  const [orderMode, setOrderMode] = useState('shuffle');
  const [showExplanationToggle, setShowExplanationToggle] = useState(true);
  const [isQuestionPickerOpen, setIsQuestionPickerOpen] = useState(false);

  // Storage key helper
  const storageKey = `quiz_practice_progress_${shareCode}`;

  const loadSavedProgress = () => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Error reading saved practice progress:', err);
    }
    return null;
  };

  const handleResumeProgress = (progressData) => {
    const data = progressData || savedProgress || loadSavedProgress();
    if (!data || !data.questions || data.questions.length === 0) return;

    setQuestions(data.questions);
    setCurrentIndex(Math.min(data.currentIndex || 0, data.questions.length - 1));
    setUserAnswers(data.userAnswers || {});
    if (data.practiceMode) setPracticeMode(data.practiceMode);
    if (data.selectedChapters) setSelectedChapters(data.selectedChapters);
    setIsConfiguring(false);
  };

  const handleClearSavedProgress = () => {
    try {
      localStorage.removeItem(storageKey);
      setSavedProgress(null);
    } catch (err) {}
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchQuizDetail(shareCode);
        setQuiz(data);
        const qList = data.questions || [];
        setAllQuestions(qList);

        const chList = data.chapters || [];
        const chMap = {};
        if (chList.length === 0) {
          const uniqueCh = [...new Set(qList.map(q => q.chapter || 'Bài 1'))];
          setChapters(uniqueCh);
          uniqueCh.forEach(c => { chMap[c] = true; });
        } else {
          setChapters(chList);
          chList.forEach(c => { chMap[c] = true; });
        }
        setSelectedChapters(chMap);

        // Check local progress
        const existingProgress = loadSavedProgress();
        setSavedProgress(existingProgress);

        // If resume param is explicitly in URL and progress exists
        if (shouldAutoResume && existingProgress) {
          handleResumeProgress(existingProgress);
          return;
        }

        // If targetChapterParam is provided in URL
        if (targetChapterParam) {
          const filteredByChapter = qList.filter(q => (q.chapter || 'Bài 1') === targetChapterParam);
          if (filteredByChapter.length > 0) {
            setQuestions(filteredByChapter);
            setIsConfiguring(false);
          } else {
            setQuestions(qList);
          }
        } else {
          const defaultCount = Math.min(50, qList.length);
          setSelectedCount(defaultCount);
        }
      } catch (err) {
        setError(err.message || 'Lỗi khi tải bộ đề');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shareCode, targetChapterParam, shouldAutoResume]);

  // Auto-save progress whenever answering or moving to another question
  useEffect(() => {
    if (!isConfiguring && questions.length > 0) {
      try {
        const progressToSave = {
          shareCode,
          quizId: quiz?.id,
          quizTitle: quiz?.title,
          questions,
          currentIndex,
          userAnswers,
          selectedChapters,
          selectedCount,
          orderMode,
          practiceMode,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(progressToSave));
        setSavedProgress(progressToSave);
      } catch (e) {
        console.error('Failed to auto-save progress', e);
      }
    }
  }, [currentIndex, userAnswers, isConfiguring, questions, practiceMode]);

  const toggleChapter = (ch) => {
    setSelectedChapters(prev => ({
      ...prev,
      [ch]: !prev[ch]
    }));
  };

  const selectAllChapters = (val) => {
    const updated = {};
    chapters.forEach(c => { updated[c] = val; });
    setSelectedChapters(updated);
  };

  const eligibleQuestions = allQuestions.filter(q => {
    const ch = q.chapter || 'Bài 1';
    return !!selectedChapters[ch];
  });

  const handleStartPractice = () => {
    if (eligibleQuestions.length === 0) {
      alert('Vui lòng chọn ít nhất 1 Bài để luyện tập!');
      return;
    }

    const countToPick = Math.min(selectedCount, eligibleQuestions.length);

    let chosen = [];
    if (orderMode === 'shuffle') {
      chosen = [...eligibleQuestions].sort(() => Math.random() - 0.5).slice(0, countToPick);
    } else {
      chosen = eligibleQuestions.slice(0, countToPick);
    }

    setQuestions(chosen);
    setCurrentIndex(0);
    setUserAnswers({});
    setIsConfiguring(false);
  };

  // Keyboard navigation & Shortcuts (Left/Right arrows, A/B/C/D, 1/2/3/4)
  useEffect(() => {
    if (isConfiguring || questions.length === 0) return;

    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      const currentQItem = questions[currentIndex];

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key) && currentQItem && practiceMode !== 'study') {
        handleSelectOption(e.key.toUpperCase());
      } else if (['1', '2', '3', '4'].includes(e.key) && currentQItem && practiceMode !== 'study') {
        const numMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        handleSelectOption(numMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfiguring, currentIndex, questions, practiceMode, userAnswers]);

  const currentQ = questions[currentIndex];
  const selectedOption = currentQ ? userAnswers[currentQ.id] : null;
  const isAnswered = selectedOption !== undefined && selectedOption !== null;

  const handleSelectOption = (optionKey) => {
    if (!currentQ) return;
    
    setUserAnswers(prev => ({
      ...prev,
      [currentQ.id]: optionKey
    }));

    if (optionKey.toUpperCase() === currentQ.correct_answer?.toUpperCase()) {
      confetti({
        particleCount: 35,
        spread: 55,
        origin: { y: 0.75 }
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleReset = () => {
    if (window.confirm('Bạn có muốn cấu hình lại phiên luyện tập không? Tiến độ hiện tại vẫn được lưu.')) {
      setIsConfiguring(true);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-500">Đang chuẩn bị bộ câu hỏi...</p>
      </div>
    );
  }

  if (error || !quiz || allQuestions.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <HelpCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Không có câu hỏi luyện tập</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{error || 'Bộ đề này chưa có câu hỏi nào.'}</p>
          <Link
            to={`/quiz/${shareCode}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Về chi tiết bộ đề</span>
          </Link>
        </div>
      </div>
    );
  }

  // PRE-PRACTICE CONFIGURATION SCREEN
  if (isConfiguring) {
    const totalEligible = eligibleQuestions.length;
    const countOptions = [20, 30, 40, 50, 100].filter(c => c < totalEligible);
    const hasValidSavedProgress = savedProgress && (savedProgress.currentIndex > 0 || Object.keys(savedProgress.userAnswers || {}).length > 0);

    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Cấu Hình Phiên Luyện Tập
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 line-clamp-1">{quiz.title}</p>
            </div>
          </div>

          {/* RESUME SAVED PROGRESS PROMPT BANNER */}
          {hasValidSavedProgress && (
            <div className="my-5 p-4 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-pink-50/90 dark:from-indigo-950/50 dark:via-purple-950/40 dark:to-pink-950/50 border border-indigo-200/90 dark:border-indigo-800/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
                    Phát hiện phiên học dở gần nhất!
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    Bạn đã làm <strong>{Object.keys(savedProgress.userAnswers || {}).length}</strong>/{savedProgress.questions?.length} câu • Dừng lại ở câu <strong>{savedProgress.currentIndex + 1}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleResumeProgress()}
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Tiếp tục học ngay</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearSavedProgress}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 text-xs font-semibold transition-colors"
                  title="Xóa phiên học dở này"
                >
                  Xóa
                </button>
              </div>
            </div>
          )}

          <div className="space-y-5 my-6">
            
            {/* Chapter Selection */}
            {chapters.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Chọn các Bài / Chương muốn luyện tập:
                  </label>
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    <button type="button" onClick={() => selectAllChapters(true)} className="hover:underline">
                      Chọn tất cả
                    </button>
                    <span>•</span>
                    <button type="button" onClick={() => selectAllChapters(false)} className="hover:underline">
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {chapters.map((ch) => {
                    const countInChapter = allQuestions.filter(q => (q.chapter || 'Bài 1') === ch).length;
                    const isChecked = !!selectedChapters[ch];
                    return (
                      <div
                        key={ch}
                        onClick={() => toggleChapter(ch)}
                        className={`cursor-pointer flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs ${
                          isChecked
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 text-indigo-950 dark:text-indigo-100 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isChecked ? <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" /> : <Square className="w-4 h-4 text-slate-400 shrink-0" />}
                          <span className="truncate">{ch}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 font-mono shrink-0 ml-1">
                          {countInChapter} câu
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Question Count Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Số lượng câu hỏi muốn học ({totalEligible} câu khả dụng):
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {countOptions.map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSelectedCount(cnt)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                      selectedCount === cnt
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cnt} câu
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setSelectedCount(totalEligible)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                    selectedCount === totalEligible
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({totalEligible} câu)
                </button>
              </div>
            </div>

            {/* Ordering Mode */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Chế độ hiển thị câu hỏi:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOrderMode('shuffle')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    orderMode === 'shuffle'
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs sm:text-sm mb-0.5">Xáo trộn ngẫu nhiên</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Trộn lộn xộn các bài</div>
                </button>

                <button
                  type="button"
                  onClick={() => setOrderMode('sequential')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    orderMode === 'sequential'
                      ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-600 text-indigo-950 dark:text-indigo-100 ring-1 ring-indigo-600'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-bold text-xs sm:text-sm mb-0.5">Theo thứ tự đề gốc</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Tuần tự từng bài</div>
                </button>
              </div>
            </div>

          </div>

          <div className="flex gap-3 pt-2">
            <Link
              to={`/quiz/${quiz.share_code}`}
              className="px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Hủy
            </Link>
            <button
              onClick={handleStartPractice}
              disabled={totalEligible === 0}
              className="flex-1 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-40"
            >
              Bắt đầu Luyện tập ({Math.min(selectedCount, totalEligible)} câu)
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ACTIVE PRACTICE SCREEN
  const optionList = [
    { key: 'A', text: currentQ?.option_a, exp: currentQ?.explanation_a },
    { key: 'B', text: currentQ?.option_b, exp: currentQ?.explanation_b },
    { key: 'C', text: currentQ?.option_c, exp: currentQ?.explanation_c },
    { key: 'D', text: currentQ?.option_d, exp: currentQ?.explanation_d },
  ];

  const correctKey = (currentQ?.correct_answer || '').toUpperCase();
  const isStudy = practiceMode === 'study';

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      
      {/* Top Header / Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-500 dark:text-slate-400 mb-4 sm:mb-6 gap-2.5">
        <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              to={`/quiz/${quiz.share_code}`}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 shadow-xs"
              title="Thoát"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <button
              onClick={() => setIsQuestionPickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 font-bold text-xs sm:text-sm border border-slate-200 dark:border-slate-700 shadow-xs transition-colors shrink-0 whitespace-nowrap"
              title="Bấm để mở danh sách câu hỏi"
            >
              <Grid className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              <span>Câu {currentIndex + 1}/{questions.length}</span>
            </button>
          </div>
          
          {currentQ.chapter && (
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1.5 rounded-xl truncate max-w-[140px] sm:max-w-[200px] border border-slate-200/70 dark:border-slate-700/60 shrink">
              {currentQ.chapter}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shadow-xs shrink-0">
            <button
              onClick={() => setPracticeMode('study')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                isStudy
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Học
            </button>
            <button
              onClick={() => setPracticeMode('practice')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                !isStudy
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Luyện tập
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-xs transition-colors shrink-0"
            title="Cấu hình lại"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isStudy && (
        <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200/90 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium flex items-center justify-between shadow-xs">
          <span>📖 Chế độ Học: Đáp án đúng và giải thích được hiển thị sẵn để ôn bài nhanh.</span>
        </div>
      )}

      {/* QUESTION CARD (FRAMED WITH BORDER) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 p-4 sm:p-6 shadow-sm mb-5 transition-all">
        
        {/* Question Header & Badge */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/70 dark:border-teal-900/60">
              Câu {currentIndex + 1} / {questions.length}
            </span>
            {currentQ.chapter && (
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                • {currentQ.chapter}
              </span>
            )}
          </div>

          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            {isStudy ? 'Chế độ xem đáp án' : (isAnswered ? 'Đã trả lời' : 'Chọn 1 đáp án')}
          </span>
        </div>

        {/* Question Content Box */}
        <div className="mb-5 sm:mb-6">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-relaxed">
            <FormattedContent text={currentQ.content} />
          </h1>
        </div>

        {/* Options List */}
        <div className="space-y-3 sm:space-y-3.5">
          {optionList.map((opt) => {
            const optKey = opt.key;
            const isSelected = selectedOption?.toUpperCase() === optKey;
            const isCorrect = optKey === correctKey;
            const showAnswer = isStudy || isAnswered;

            let cardBorder = 'border-slate-200 dark:border-slate-700/80 bg-slate-50/50 hover:bg-slate-100/80 dark:bg-slate-800/40 dark:hover:bg-slate-800/80';
            let circleStyle = 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300';
            let letterStyle = 'text-slate-800 dark:text-slate-200 font-bold';
            let textStyle = 'text-slate-800 dark:text-slate-200 font-medium';

            if (showAnswer) {
              if (isCorrect) {
                cardBorder = 'border-2 border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 ring-1 ring-emerald-500/20';
                circleStyle = 'border-emerald-500 bg-emerald-600 text-white';
                letterStyle = 'text-emerald-900 dark:text-emerald-200 font-black';
                textStyle = 'text-emerald-950 dark:text-emerald-100 font-semibold';
              } else if (isSelected && !isCorrect && !isStudy) {
                cardBorder = 'border-2 border-rose-400 bg-rose-50/80 dark:bg-rose-950/30 ring-1 ring-rose-400/20';
                circleStyle = 'border-rose-500 bg-rose-600 text-white';
                letterStyle = 'text-rose-900 dark:text-rose-200 font-black';
                textStyle = 'text-rose-950 dark:text-rose-100 font-semibold';
              } else {
                cardBorder = 'border-slate-200/60 dark:border-slate-800/60 bg-slate-50/30 dark:bg-slate-900/30 opacity-75';
                circleStyle = 'border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400';
                letterStyle = 'text-slate-500 dark:text-slate-400 font-medium';
                textStyle = 'text-slate-600 dark:text-slate-400';
              }
            } else if (isSelected) {
              cardBorder = 'border-2 border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/40 ring-1 ring-indigo-600/20';
              circleStyle = 'border-indigo-600 bg-indigo-600 text-white';
              letterStyle = 'text-indigo-950 dark:text-indigo-200 font-black';
              textStyle = 'text-indigo-950 dark:text-indigo-100 font-bold';
            }

            return (
              <div
                key={optKey}
                onClick={() => {
                  if (!isStudy) handleSelectOption(optKey);
                }}
                className={`cursor-pointer rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 ${cardBorder}`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio Indicator & Letter Badge */}
                  <div className={`w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-xs sm:text-sm font-bold shadow-xs transition-colors ${circleStyle}`}>
                    {showAnswer && isCorrect ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : showAnswer && isSelected && !isCorrect ? (
                      <X className="w-4 h-4 stroke-[3]" />
                    ) : (
                      <span>{optKey}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    <span className={`text-sm sm:text-base leading-relaxed ${textStyle}`}>
                      <strong className={`mr-1.5 ${letterStyle}`}>{optKey}.</strong>
                      <FormattedContent text={opt.text} />
                    </span>
                  </div>
                </div>

                {showAnswer && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60">
                    {isCorrect && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400 mb-1">
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>{isStudy ? 'Đáp án đúng' : 'Câu trả lời chính xác'}</span>
                      </div>
                    )}

                    {isSelected && !isCorrect && !isStudy && (
                      <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-rose-600 dark:text-rose-400 mb-1">
                        <X className="w-4 h-4 stroke-[3]" />
                        <span>Chưa chính xác!</span>
                      </div>
                    )}

                    {showExplanationToggle && (
                      <div className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 mt-1.5">
                        <strong className="text-slate-800 dark:text-slate-200">💡 Giải thích: </strong>
                        {opt.exp ? (
                          <FormattedContent text={opt.exp} />
                        ) : isCorrect ? (
                          'Lựa chọn chính xác theo nội dung kiến thức của đề bài.'
                        ) : (
                          'Phương án này chưa chính xác theo lý thuyết đề bài.'
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom Bar: Action buttons */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={() => setShowExplanationToggle(!showExplanationToggle)}
          className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold border transition-all shadow-xs ${
            showExplanationToggle
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
              : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-indigo-500" />
          <span>Giải thích {showExplanationToggle ? '(Bật)' : '(Tắt)'}</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
          >
            Trước
          </button>

          <button
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-sm shadow-indigo-500/20 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Tiếp theo
          </button>
        </div>
      </div>

      {/* Keyboard navigation shortcut guide */}
      <div className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500 hidden sm:flex items-center justify-center gap-3 select-none">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">◀</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">▶</kbd>
          <span>hoặc phím Mũi Tên để lùi/tới câu</span>
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">A</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">B</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">C</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">D</kbd>
          <span>để chọn nhanh đáp án</span>
        </span>
      </div>

      {/* QUESTION PICKER MODAL */}
      {isQuestionPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh]">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Grid className="w-4 h-4 text-indigo-500" />
                <span>Chọn nhanh câu hỏi ({questions.length} câu)</span>
              </h3>
              <button
                onClick={() => setIsQuestionPickerOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 overflow-y-auto pr-1 flex-1 py-1">
              {questions.map((q, idx) => {
                const ans = userAnswers[q.id];
                const isCurrent = idx === currentIndex;
                const isRight = ans && ans.toUpperCase() === q.correct_answer?.toUpperCase();
                const isWrong = ans && ans.toUpperCase() !== q.correct_answer?.toUpperCase();

                let cls = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60';
                if (isRight) cls = 'bg-emerald-500 border-emerald-600 text-white font-bold shadow-xs';
                else if (isWrong) cls = 'bg-rose-500 border-rose-600 text-white font-bold shadow-xs';
                else if (ans) cls = 'bg-indigo-600 border-indigo-700 text-white font-bold';

                if (isCurrent) cls += ' ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 font-black';

                return (
                  <button
                    key={q.id || idx}
                    onClick={() => {
                      setCurrentIndex(idx);
                      setIsQuestionPickerOpen(false);
                    }}
                    className={`h-10 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
              <span>Đã làm: <strong className="text-slate-900 dark:text-white font-bold">{Object.keys(userAnswers).length}</strong>/{questions.length} câu</span>
              <button
                onClick={() => setIsQuestionPickerOpen(false)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-xs"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
