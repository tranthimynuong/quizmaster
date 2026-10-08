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
  User,
  CheckSquare,
  Square,
  Layers,
  Shuffle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { fetchQuizDetail, submitQuizAttempt } from '../services/api';
import OptionExplanationCard from '../components/OptionExplanationCard';

export default function ExamModePage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [allQuestions, setAllQuestions] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedChapters, setSelectedChapters] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [flaggedQuestions, setFlaggedQuestions] = useState({});
  const [takerName, setTakerName] = useState('Học viên');
  
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
      } catch (err) {
        setError(err.message || 'Lỗi khi tải đề thi');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shareCode]);

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

    setQuestions(chosenQuestions);
    setTimeLeft(selectedDurationMinutes * 60);
    setCurrentIndex(0);
    setUserAnswers({});
    setFlaggedQuestions({});
    setIsExamStarted(true);
  };

  // Timer countdown
  useEffect(() => {
    if (!isExamStarted || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamStarted, isSubmitted, userAnswers]);

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

  const handleSubmitExam = async () => {
    if (submitting || isSubmitted) return;

    const unanswered = questions.length - Object.keys(userAnswers).length;
    if (unanswered > 0 && timeLeft > 0) {
      const confirm = window.confirm(`Bạn còn ${unanswered} câu chưa làm. Bạn có chắc chắn muốn nộp bài thi ngay bây giờ?`);
      if (!confirm) return;
    }

    setSubmitting(true);
    try {
      const res = await submitQuizAttempt(quiz.id, {
        taker_name: takerName.trim() || 'Học viên',
        user_answers: userAnswers
      });
      setSubmitResult(res);
      setIsSubmitted(true);

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

          <div className="space-y-5 my-6">
            
            {/* Taker Name */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Họ và tên thí sinh:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={takerName}
                  onChange={(e) => setTakerName(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
            </div>

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
                      {item.content}
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      
      <div className="sticky top-16 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 p-4 mb-6 shadow-md flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Đang thi thử ({questions.length} câu)</span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
            {quiz.title}
          </h2>
        </div>

        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-base sm:text-lg font-extrabold border ${
          timeLeft <= 120
            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-300 animate-pulse'
            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900'
        }`}>
          <Clock className="w-5 h-5 shrink-0" />
          <span>{formatTime(timeLeft)}</span>
        </div>

        <button
          onClick={handleSubmitExam}
          disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all"
        >
          <Send className="w-4 h-4" />
          <span>{submitting ? 'Đang nộp...' : 'Nộp bài thi'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left 3 cols: Question Area */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 shadow-sm">
            
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300">
                  Câu hỏi {currentIndex + 1} / {questions.length}
                </span>
                {currentQ.chapter && (
                  <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                    {currentQ.chapter}
                  </span>
                )}
              </div>

              <button
                onClick={() => toggleFlag(currentQ.id)}
                className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-colors ${
                  flaggedQuestions[currentQ.id]
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-400 text-amber-600 dark:text-amber-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Flag className="w-3.5 h-3.5 fill-current" />
                <span>{flaggedQuestions[currentQ.id] ? 'Đã đánh cờ' : 'Đặt cờ xem lại'}</span>
              </button>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed mb-6">
              {currentQ.content}
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
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-600 text-indigo-900 dark:text-indigo-100 ring-2 ring-indigo-600/20 font-semibold'
                        : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:bg-indigo-50/30'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}>
                      {opt.key}
                    </span>
                    <span className="text-sm sm:text-base pt-0.5">{opt.text}</span>
                  </button>
                );
              })}
            </div>

          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-semibold disabled:opacity-40"
            >
              Câu trước
            </button>
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40"
            >
              Câu tiếp
            </button>
          </div>
        </div>

        {/* Right 1 col: Question Map Palette */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center justify-between">
              <span>Bảng câu hỏi ({answeredCount}/{questions.length})</span>
            </h4>

            <div className="grid grid-cols-5 gap-2 max-h-[380px] overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.id];
                const isFlagged = !!flaggedQuestions[q.id];
                const isCurrent = idx === currentIndex;

                let cls = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400';
                if (isAnswered) cls = 'bg-indigo-600 text-white font-bold';
                if (isFlagged) cls = 'bg-amber-500 text-white font-bold';
                if (isCurrent) cls += ' ring-2 ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900';

                return (
                  <button
                    key={q.id || idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl text-xs font-semibold flex items-center justify-center transition-all ${cls}`}
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
                <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-800 inline-block" />
                <span>Chưa làm ({questions.length - answeredCount})</span>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
