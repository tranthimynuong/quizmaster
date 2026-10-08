import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Clock,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  Send,
  Flag,
  RotateCcw,
  Trophy,
  Award,
  AlertTriangle,
  AlertCircle,
  User,
  CheckSquare,
  Square,
  Layers,
  Shuffle,
  Sparkles,
  Play,
  LogOut,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { fetchQuizDetail, submitQuizAttempt } from '../services/api';
import { useAuth } from '../context/AuthContext';
import OptionExplanationCard from '../components/OptionExplanationCard';
import FormattedContent from '../components/FormattedContent';

const ANIMAL_NAMES = [
  { name: 'Gấu Mèo', icon: '🦝' },
  { name: 'Cua Đồng', icon: '🦀' },
  { name: 'Mèo Con', icon: '🐱' },
  { name: 'Cáo Tuyết', icon: '🦊' },
  { name: 'Gấu Trúc', icon: '🐼' },
  { name: 'Chim Cánh Cụt', icon: '🐧' },
  { name: 'Sóc Chuột', icon: '🐿️' },
  { name: 'Hải Cẩu', icon: '🦭' },
  { name: 'Vịt Vàng', icon: '🦆' },
  { name: 'Thỏ Ngọc', icon: '🐰' },
  { name: 'Cú Mèo', icon: '🦉' },
  { name: 'Cá Heo', icon: '🐬' },
  { name: 'Sư Tử Nhỏ', icon: '🦁' },
  { name: 'Hươu Cao Cổ', icon: '🦒' },
  { name: 'Rùa Biển', icon: '🐢' },
  { name: 'Cá Voi Xanh', icon: '🐋' },
  { name: 'Ong Vàng', icon: '🐝' },
  { name: 'Chuột Túi', icon: '🦘' },
  { name: 'Khỉ Con', icon: '🐒' },
  { name: 'Cừu Bông', icon: '🐑' },
];

function getRandomGuestAnimal() {
  const chosen = ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${chosen.icon} ${chosen.name} #${num}`;
}

export default function ExamModePage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [quiz, setQuiz] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [takerName, setTakerName] = useState(() => {
    return user?.full_name || user?.username || getRandomGuestAnimal();
  });
  
  // Custom Settings
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(50);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(45);
  const [timeLeft, setTimeLeft] = useState(45 * 60);

  const [isExamStarted, setIsExamStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [savedExamSession, setSavedExamSession] = useState(null);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const examStorageKey = `quiz_exam_session_${shareCode}`;

  const loadSavedExamSession = () => {
    try {
      const raw = localStorage.getItem(examStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0 && parsed.startTime) {
          const now = Date.now();
          const elapsed = Math.floor((now - parsed.startTime) / 1000);
          const remaining = (parsed.durationSeconds || (45 * 60)) - elapsed;
          return {
            ...parsed,
            remainingSeconds: remaining,
            isExpired: remaining <= 0
          };
        }
      }
    } catch (e) {
      console.error('Error loading saved exam session:', e);
    }
    return null;
  };

  const handleResumeExam = (sessionData) => {
    const data = sessionData || savedExamSession || loadSavedExamSession();
    if (!data) return;

    if (data.isExpired || data.remainingSeconds <= 0) {
      alert('Thời gian làm bài của phiên thi trước đã kết thúc! Hệ thống sẽ nộp bài với kết quả bạn đã làm trước đó.');
      setQuestions(data.questions);
      setUserAnswers(data.userAnswers || {});
      handleSubmitExam(true, data.userAnswers || {}, data.questions);
      return;
    }

    setQuestions(data.questions);
    setTimeLeft(data.remainingSeconds);
    setCurrentIndex(data.currentIndex || 0);
    setUserAnswers(data.userAnswers || {});
    setFlaggedQuestions(data.flaggedQuestions || {});
    if (data.takerName) setTakerName(data.takerName);
    setIsExamStarted(true);
    setSavedExamSession(null);
  };

  const handleClearExamSession = () => {
    try {
      localStorage.removeItem(examStorageKey);
      setSavedExamSession(null);
    } catch (e) {}
  };

  const handleQuitExam = () => {
    if (window.confirm('Bạn có chắc chắn muốn HỦY BỎ phiên thi này không? Toàn bộ kết quả chưa nộp sẽ bị xóa.')) {
      handleClearExamSession();
      setIsExamStarted(false);
      setIsExitModalOpen(false);
      navigate(`/quiz/${shareCode}`);
    }
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await fetchQuizDetail(shareCode);
        setQuiz(data);
        const qList = data.questions || [];
        setAllQuestions(qList);

        // Group chapters and question counts
        const chList = data.chapters || [];
        const chMap = {};
        chList.forEach(c => { chMap[c] = true; });
        
        // If no explicit chapters, find from questions
        if (chList.length === 0) {
          const uniqueCh = [...new Set(qList.map(q => q.chapter || 'Bài 1'))];
          setChapters(uniqueCh);
          uniqueCh.forEach(c => { chMap[c] = true; });
        } else {
          setChapters(chList);
        }
        setSelectedChapters(chMap);

        const defaultCount = Math.min(50, qList.length);
        setSelectedQuestionCount(defaultCount);
        
        const defaultMins = Math.min(90, Math.max(15, Math.ceil(defaultCount * 0.9)));
        setSelectedDurationMinutes(defaultMins);
        setTimeLeft(defaultMins * 60);

        // Check for active ongoing exam session
        const session = loadSavedExamSession();
        if (session) {
          setSavedExamSession(session);
        }
      } catch (err) {
        setError(err.message || 'Lỗi khi tải đề thi');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shareCode]);

  useEffect(() => {
    if (user) {
      setTakerName(user.full_name || user.username);
    }
  }, [user]);

  // BeforeUnload protection to warn user when accidentally closing or reloading during exam
  useEffect(() => {
    if (!isExamStarted || isSubmitted) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = 'Bạn đang làm bài thi kiểm tra! Dữ liệu bài thi đang được tính giờ liên tục. Bạn có chắc chắn muốn rời đi?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isExamStarted, isSubmitted]);

  // Auto-save exam state during active exam
  useEffect(() => {
    if (isExamStarted && !isSubmitted && questions.length > 0) {
      try {
        const existing = loadSavedExamSession();
        const startTime = existing?.startTime || Date.now();
        const durationSeconds = existing?.durationSeconds || (selectedDurationMinutes * 60);
        
        const sessionData = {
          shareCode,
          quizId: quiz?.id,
          takerName: takerName.trim() || 'Học viên',
          questions,
          startTime,
          durationSeconds,
          userAnswers,
          flaggedQuestions,
          currentIndex,
          updatedAt: new Date().toISOString()
        };
        localStorage.setItem(examStorageKey, JSON.stringify(sessionData));
      } catch (e) {
        console.error('Error saving exam state:', e);
      }
    }
  }, [isExamStarted, isSubmitted, userAnswers, flaggedQuestions, currentIndex, questions, takerName]);

  // Toggle chapter inclusion
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

  // Filter available pool of questions based on chosen chapters
  const eligibleQuestions = allQuestions.filter(q => {
    const ch = q.chapter || 'Bài 1';
    return !!selectedChapters[ch];
  });

  // Handle Starting Exam
  const handleStartExam = () => {
    if (eligibleQuestions.length === 0) {
      alert('Vui lòng chọn ít nhất 1 Bài để thi thử!');
      return;
    }

    const countToPick = Math.min(selectedQuestionCount, eligibleQuestions.length);

    // Mix randomly across all selected lessons
    const shuffled = [...eligibleQuestions].sort(() => Math.random() - 0.5);
    const chosenQuestions = shuffled.slice(0, countToPick);
    const totalSecs = selectedDurationMinutes * 60;

    setQuestions(chosenQuestions);
    setTimeLeft(totalSecs);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions({});
    setIsExamStarted(true);

    // Write initial session
    try {
      localStorage.setItem(examStorageKey, JSON.stringify({
        shareCode,
        quizId: quiz?.id,
        takerName: takerName.trim() || 'Học viên',
        questions: chosenQuestions,
        startTime: Date.now(),
        durationSeconds: totalSecs,
        userAnswers: {},
        flaggedQuestions: {},
        currentIndex: 0,
        updatedAt: new Date().toISOString()
      }));
    } catch (e) {}
  };

  // Timer countdown with real-time accuracy
  useEffect(() => {
    if (!isExamStarted || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, isSubmitted, userAnswers, questions]);

  const handleSelectOption = (optKey) => {
    if (isSubmitted || !currentQ) return;
    setUserAnswers(prev => ({
      ...prev,
      [currentQ.id]: optKey
    }));
  };

  const toggleFlag = (qId) => {
    setFlaggedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  // Keyboard navigation & Shortcuts for Exam mode
  useEffect(() => {
    if (!isExamStarted || isSubmitted || questions.length === 0) return;

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
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key) && currentQItem) {
        handleSelectOption(e.key.toUpperCase());
      } else if (['1', '2', '3', '4'].includes(e.key) && currentQItem) {
        const numMap = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        handleSelectOption(numMap[e.key]);
      } else if (['f', 'F'].includes(e.key) && currentQItem) {
        toggleFlag(currentQItem.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExamStarted, isSubmitted, currentIndex, questions, userAnswers]);

  const handleSubmitExam = async (forced = false, customAnswers = null, customQuestions = null) => {
    if (submitting || isSubmitted) return;

    const activeAnswers = customAnswers || userAnswers;
    const activeQuestions = customQuestions || questions;

    if (!forced) {
      const unanswered = activeQuestions.length - Object.keys(activeAnswers).length;
      if (unanswered > 0 && timeLeft > 0) {
        const confirm = window.confirm(`Bạn còn ${unanswered} câu chưa làm. Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?`);
        if (!confirm) return;
      }
    }

    setSubmitting(true);
    try {
      const res = await submitQuizAttempt(quiz.id, {
        taker_name: takerName.trim() || 'Học viên',
        user_answers: activeAnswers
      });
      setSubmitResult(res);
      setIsSubmitted(true);
      setIsExitModalOpen(false);
      handleClearExamSession();

      if (res.score >= 7.0) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi nộp bài');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-medium text-slate-500">Đang chuẩn bị phòng thi...</p>
      </div>
    );
  }

  if (error || !quiz || allQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Không thể tải đề thi</h2>
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

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // PRE-EXAM CONFIGURATION SCREEN WITH CHAPTER SELECTOR
  if (!isExamStarted && !isSubmitted) {
    const totalEligible = eligibleQuestions.length;
    const countOptions = [20, 30, 40, 50, 100].filter(c => c < totalEligible);

    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
          
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
                Cấu Hình Đề Thi Thử
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 line-clamp-1">{quiz.title}</p>
            </div>
          </div>

          {/* ACTIVE ONGOING EXAM PROMPT BANNER */}
          {savedExamSession && (
            <div className={`my-5 p-4 sm:p-5 rounded-2xl border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
              savedExamSession.isExpired
                ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60'
                : 'bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-indigo-50/90 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-indigo-950/40 border-amber-200/90 dark:border-amber-800/70'
            }`}>
              <div className="flex items-start gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md mt-0.5 ${
                  savedExamSession.isExpired ? 'bg-rose-600 shadow-rose-600/20' : 'bg-amber-600 shadow-amber-600/20'
                }`}>
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>{savedExamSession.isExpired ? 'Phiên thi trước đó đã hết giờ!' : 'Bạn có bài thi đang diễn ra!'}</span>
                    {!savedExamSession.isExpired && (
                      <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-amber-600 text-white animate-pulse">
                        Còn {formatTime(savedExamSession.remainingSeconds)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    Đã làm: <strong>{Object.keys(savedExamSession.userAnswers || {}).length}</strong>/{savedExamSession.questions?.length} câu
                    {savedExamSession.isExpired
                      ? ' • Bấm bên dưới để hệ thống thu bài và tính điểm số câu bạn đã làm.'
                      : ' • Đồng hồ vẫn đang đếm ngược theo thời gian thực.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => handleResumeExam()}
                  className={`px-4 py-2.5 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5 ${
                    savedExamSession.isExpired
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{savedExamSession.isExpired ? 'Thu bài & Tính điểm' : 'Tiếp tục làm bài ngay'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearExamSession}
                  className="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 text-xs font-semibold transition-colors"
                  title="Hủy phiên thi này"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          )}

          <div className="space-y-5 my-6">
            
            {/* Taker Name / User Badge */}
            {isAuthenticated ? (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-500/30">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                  {(user.full_name || user.username)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold uppercase tracking-wider">
                    Thí sinh dự thi (Đã đăng nhập)
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {user.full_name || user.username} <span className="text-xs font-normal text-slate-500">(@{user.username})</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Guest Auto-Generated Animal Name Card */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800/70">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/80 flex items-center justify-center text-xl shadow-xs shrink-0">
                      {takerName.split(' ')[0] || '🐾'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] text-amber-700 dark:text-amber-400 font-bold uppercase tracking-wider">
                        Bí danh ngẫu nhiên (Khách ẩn danh)
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {takerName}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setTakerName(getRandomGuestAnimal())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-100/70 dark:hover:bg-slate-700 transition-colors shrink-0 shadow-xs"
                    title="Đổi tên con vật khác"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    <span>Đổi tên</span>
                  </button>
                </div>
              </div>
            )}

            {/* Chapter Selection (Thi lộn xộn giữa các bài đã chọn) */}
            {chapters.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Chọn các Bài / Chương cần kiểm tra:
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
                Số lượng câu hỏi bốc ngẫu nhiên ({totalEligible} câu khả dụng):
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {countOptions.map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setSelectedQuestionCount(cnt)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                      selectedQuestionCount === cnt
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {cnt} câu
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setSelectedQuestionCount(totalEligible)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                    selectedQuestionCount === totalEligible
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  Tất cả ({totalEligible} câu)
                </button>
              </div>
            </div>

            {/* Duration Minutes Selection */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Thời gian làm bài:
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {[15, 30, 45, 60, 90].map(mins => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSelectedDurationMinutes(mins)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-all ${
                      selectedDurationMinutes === mins
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {mins} phút
                  </button>
                ))}
              </div>
            </div>

            {/* Summary info */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 space-y-1">
              <p>• Hệ thống sẽ <strong>xáo trộn lộn xộn {Math.min(selectedQuestionCount, totalEligible)} câu</strong> từ các Bài đã chọn.</p>
              <p>• Chấm điểm theo thang 10.0 và lưu kết quả vào bảng xếp hạng.</p>
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
              onClick={handleStartExam}
              disabled={totalEligible === 0}
              className="flex-1 py-3 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 active:scale-95 transition-all disabled:opacity-40"
            >
              Bắt đầu làm bài thi ({Math.min(selectedQuestionCount, totalEligible)} câu - {selectedDurationMinutes}p)
            </button>
          </div>

        </div>
      </div>
    );
  }

  // POST-EXAM RESULTS SCREEN
  if (isSubmitted && submitResult) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm mb-8 text-center">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 shadow-md">
            <Award className="w-8 h-8" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
            Kết Quả Bài Thi Thử
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Thí sinh: <span className="font-bold text-slate-800 dark:text-slate-200">{submitResult.taker_name}</span> • Đề: {quiz.title}
          </p>

          <div className="inline-flex flex-col items-center justify-center px-8 py-6 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-500/20 mb-8">
            <span className="text-xs uppercase font-extrabold tracking-widest text-indigo-100 mb-1">
              ĐIỂM SỐ (THANG 10)
            </span>
            <span className="text-5xl sm:text-6xl font-black tracking-tight">
              {submitResult.score}
            </span>
            <span className="text-xs font-semibold text-indigo-100 mt-2">
              Đúng {submitResult.correct_count} / {submitResult.total_questions} câu hỏi
            </span>
          </div>

          {!isAuthenticated && (
            <div className="p-4 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-left flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
                  Lưu trữ kết quả thi vào tài khoản cá nhân?
                </h4>
                <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5">
                  Đăng nhập bằng tài khoản được cấp để xem lại toàn bộ lịch sử thi và thống kê tiến độ học tập.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/login"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm transition"
                >
                  Đăng nhập ngay
                </Link>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to={`/quiz/${quiz.share_code}/practice`}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-sm transition-all"
            >
              Chuyển sang Luyện tập
            </Link>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setIsExamStarted(false);
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-all"
            >
              Thi lại đề này
            </button>
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm transition-all"
            >
              Về trang chủ
            </Link>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-indigo-500" />
            <span>Xem lại chi tiết từng câu hỏi & lời giải</span>
          </h2>

          {submitResult.details?.map((item, idx) => {
            const rawQ = questions.find(q => q.id === item.question_id) || item;
            return (
              <div
                key={item.question_id || idx}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-sm space-y-4"
              >
                <div className="flex items-start gap-3">
                  <span className={`w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 ${
                    item.is_correct ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {idx + 1}
                  </span>
                  <div>
                    {item.chapter && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 mb-1 inline-block">
                        {item.chapter}
                      </span>
                    )}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white pt-0.5">
                      <FormattedContent text={item.content} />
                    </h3>
                  </div>
                </div>

                <OptionExplanationCard
                  question={rawQ}
                  selectedOption={item.user_choice}
                  showAll={true}
                />
              </div>
            );
          })}
        </div>

      </div>
    );
  }

  // ACTIVE EXAM RUNNING SCREEN
  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(userAnswers).length;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      
      {/* Sticky Exam Top Bar */}
      <div className="sticky top-16 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border-2 border-slate-200/90 dark:border-slate-800 p-3 sm:p-4 mb-4 sm:mb-6 shadow-md flex items-center justify-between gap-2 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsExitModalOpen(true)}
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 transition-colors shrink-0 shadow-xs"
            title="Rời phòng thi"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Đang thi thử ({questions.length} câu)</span>
            <h2 className="text-xs sm:text-base font-bold text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-md">
              {quiz.title}
            </h2>
          </div>
        </div>

        <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-mono text-sm sm:text-lg font-extrabold border ${
          timeLeft <= 120
            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 animate-pulse'
            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
        }`}>
          <Clock className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>{formatTime(timeLeft)}</span>
        </div>

        <button
          onClick={() => handleSubmitExam(false)}
          disabled={submitting}
          className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all shrink-0"
        >
          <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>{submitting ? 'Đang nộp...' : 'Nộp bài'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Left 3 cols: Question Area */}
        <div className="lg:col-span-3 space-y-4 sm:space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 p-4 sm:p-7 shadow-sm">
            
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-100 dark:border-slate-800/80 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-900/60">
                  Câu hỏi {currentIndex + 1} / {questions.length}
                </span>
                {currentQ.chapter && (
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                    {currentQ.chapter}
                  </span>
                )}
              </div>

              <button
                onClick={() => toggleFlag(currentQ.id)}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors shadow-xs ${
                  flaggedQuestions[currentQ.id]
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-600 dark:text-amber-400 font-bold'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Flag className="w-3.5 h-3.5 fill-current" />
                <span>{flaggedQuestions[currentQ.id] ? 'Đã đánh cờ' : 'Đặt cờ xem lại'}</span>
              </button>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed mb-5 sm:mb-6">
              <FormattedContent text={currentQ.content} />
            </h3>

            <div className="space-y-3">
              {[
                { key: 'A', text: currentQ.option_a },
                { key: 'B', text: currentQ.option_b },
                { key: 'C', text: currentQ.option_c },
                { key: 'D', text: currentQ.option_d },
              ].map((opt) => {
                const isSelected = userAnswers[currentQ.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(opt.key)}
                    className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-600 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-600/20 font-bold'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:bg-slate-100/70 hover:border-slate-300'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full border text-xs sm:text-sm font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-xs transition-colors ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {opt.key}
                    </span>
                    <span className="text-sm sm:text-base pt-0.5 flex-1 leading-relaxed">
                      <strong className="mr-1.5">{opt.key}.</strong>
                      <FormattedContent text={opt.text} />
                    </span>
                  </button>
                );
              })}
            </div>

          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-4 sm:px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold disabled:opacity-40 shadow-xs hover:bg-slate-50"
            >
              Câu trước
            </button>
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-5 sm:px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold disabled:opacity-40 shadow-sm shadow-indigo-500/20 active:scale-95 transition-all"
            >
              Câu tiếp theo
            </button>
          </div>

          {/* Keyboard shortcut guide for exam */}
          <div className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500 hidden sm:flex items-center justify-center gap-3 select-none">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">◀</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">▶</kbd>
              <span>để chuyển câu</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">A-D</kbd>
              <span>chọn đáp án</span>
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px] text-slate-700 dark:text-slate-300 font-bold">F</kbd>
              <span>đặt cờ</span>
            </span>
          </div>
        </div>

        {/* Right 1 col: Question Map Palette */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
              <span>Bảng câu hỏi ({answeredCount}/{questions.length})</span>
            </h4>

            <div className="grid grid-cols-5 gap-2 max-h-[360px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.id];
                const isFlagged = !!flaggedQuestions[q.id];
                const isCurrent = idx === currentIndex;

                let cls = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60';
                if (isAnswered) cls = 'bg-indigo-600 border-indigo-700 text-white font-bold';
                if (isFlagged) cls = 'bg-amber-500 border-amber-600 text-white font-bold';
                if (isCurrent) cls += ' ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900 font-black';

                return (
                  <button
                    key={q.id || idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all shadow-xs ${cls}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3 mt-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
                <span>Đã làm ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                <span>Đặt cờ xem lại</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 inline-block" />
                <span>Chưa làm ({questions.length - answeredCount})</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* EXIT CONFIRMATION MODAL */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <button
              onClick={() => setIsExitModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-inner shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Rời khỏi phòng thi?
                </h3>
                <p className="text-xs text-slate-500">
                  Bài thi của bạn đang diễn ra
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 leading-relaxed">
              Bạn đã trả lời được <strong className="text-slate-900 dark:text-white font-bold">{answeredCount}/{questions.length}</strong> câu hỏi. Thời gian làm bài vẫn còn <strong className="text-indigo-600 dark:text-indigo-400 font-mono font-bold">{formatTime(timeLeft)}</strong>. Bạn muốn xử lý như thế nào?
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleSubmitExam(true)}
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Nộp bài ngay & xem kết quả ({answeredCount} câu)</span>
              </button>

              <button
                type="button"
                onClick={handleQuitExam}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-bold active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Hủy bỏ bài thi này (Không tính điểm)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsExitModalOpen(false)}
                className="w-full py-2.5 px-4 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors text-center"
              >
                Tiếp tục làm bài
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
