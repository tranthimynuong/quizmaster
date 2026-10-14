import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Gamepad2, 
  Users, 
  Play, 
  Clock, 
  Trophy, 
  Copy, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Flame, 
  Volume2, 
  VolumeX, 
  X,
  Maximize2,
  Minimize2,
  ChevronRight,
  Award,
  Crown
} from 'lucide-react';
import { fetchQuizDetail, createLiveRoom, getWebSocketBaseUrl } from '../services/api';
import FormattedContent from '../components/FormattedContent';
import { 
  playClickSound, 
  playCorrectSound, 
  playTickSound, 
  playFanfareSound 
} from '../utils/soundEffects';

const KAHOOT_COLORS = {
  A: {
    bg: 'bg-rose-600',
    hoverBg: 'hover:bg-rose-500',
    border: 'border-rose-400/40',
    badge: 'bg-rose-700 text-rose-100',
    shape: '▲',
    label: 'A'
  },
  B: {
    bg: 'bg-sky-600',
    hoverBg: 'hover:bg-sky-500',
    border: 'border-sky-400/40',
    badge: 'bg-sky-700 text-sky-100',
    shape: '◆',
    label: 'B'
  },
  C: {
    bg: 'bg-amber-500',
    hoverBg: 'hover:bg-amber-400',
    border: 'border-amber-300/40',
    badge: 'bg-amber-600 text-amber-100',
    shape: '●',
    label: 'C'
  },
  D: {
    bg: 'bg-emerald-600',
    hoverBg: 'hover:bg-emerald-500',
    border: 'border-emerald-400/40',
    badge: 'bg-emerald-700 text-emerald-100',
    shape: '■',
    label: 'D'
  }
};

export default function LiveHostPage() {
  const { shareCode } = useParams();
  const navigate = useNavigate();

  // Setup state
  const [quiz, setQuiz] = useState(null);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [questionDuration, setQuestionDuration] = useState(25);
  const [pin, setPin] = useState(null);

  // Host Game State: 'SETUP', 'LOBBY', 'QUESTION', 'REVEAL', 'LEADERBOARD', 'FINISHED'
  const [gameState, setGameState] = useState('SETUP');
  const [players, setPlayers] = useState([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Question & Answers
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [revealData, setRevealData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [finishData, setFinishData] = useState(null);

  const socketRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Fetch Quiz details on mount
  useEffect(() => {
    async function loadQuiz() {
      try {
        setLoadingQuiz(true);
        const data = await fetchQuizDetail(shareCode);
        setQuiz(data);
      } catch (err) {
        alert(err.message || 'Không thể tải đề thi để tổ chức đấu trường.');
        navigate(`/quiz/${shareCode}`);
      } finally {
        setLoadingQuiz(false);
      }
    }
    if (shareCode) {
      loadQuiz();
    }
  }, [shareCode, navigate]);

  // Connect Host WebSocket once PIN is created
  useEffect(() => {
    if (!pin) return;

    const wsBase = getWebSocketBaseUrl();
    const wsUrl = `${wsBase}/api/live/ws/host/${pin}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setGameState('LOBBY');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleHostServerMessage(msg);
      } catch (e) {
        console.error('Error in host websocket message:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('Host WebSocket error:', err);
    };

    ws.onclose = () => {
      console.log('Host WebSocket closed');
    };

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [pin]);

  const handleHostServerMessage = (msg) => {
    const { type, data } = msg;

    if (type === 'INIT_HOST' || type === 'PLAYER_LIST_UPDATE') {
      if (data && data.players) {
        setPlayers(data.players);
      }
    }

    if (type === 'ANSWER_COUNT_UPDATE') {
      setAnsweredCount(data.answered_count || 0);
    }

    if (type === 'QUESTION_START') {
      setCurrentQuestion(data);
      setRevealData(null);
      setAnsweredCount(0);
      setGameState('QUESTION');

      const dur = data.duration || questionDuration || 25;
      setTimeLeft(dur);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            // Trigger auto reveal on timeout
            sendHostAction('REVEAL_ANSWER');
            return 0;
          }
          if (prev <= 6 && soundEnabled) {
            playTickSound(prev <= 3);
          }
          return prev - 1;
        });
      }, 1000);
    }

    if (type === 'QUESTION_REVEAL') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setRevealData(data);
      setGameState('REVEAL');
      if (soundEnabled) playCorrectSound();
    }

    if (type === 'LEADERBOARD_UPDATE') {
      setLeaderboardData(data);
      setGameState('LEADERBOARD');
      if (soundEnabled) playClickSound();
    }

    if (type === 'QUIZ_FINISHED') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setFinishData(data);
      setGameState('FINISHED');
      if (soundEnabled) playFanfareSound();
    }
  };

  const sendHostAction = (action, payload = {}) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ action, ...payload }));
    }
  };

  const handleCreateRoom = async () => {
    if (!quiz) return;
    try {
      const res = await createLiveRoom(quiz.id, questionDuration);
      setPin(res.pin);
    } catch (err) {
      alert(err.message || 'Không thể tạo phòng đấu trường.');
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/live/join?pin=${pin}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* Top Theater Control Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <Link
            to={`/quiz/${shareCode}`}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Thoát chế độ Host"
          >
            <X className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-md">
              <Gamepad2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block truncate max-w-[180px] sm:max-w-md">
                {quiz?.title || 'Đấu Trường Trực Tiếp'}
              </span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                Màn Hình Host / Máy Chiếu
              </span>
            </div>
          </div>
        </div>

        {/* PIN Badge & Quick Controls */}
        <div className="flex items-center gap-3">
          {pin && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-950/80 border border-indigo-600/50 hover:bg-indigo-900/80 transition-all text-xs font-bold text-indigo-200"
            >
              <span className="text-slate-400 text-[11px]">PIN:</span>
              <span className="font-mono font-black text-white text-sm tracking-widest">{pin}</span>
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-indigo-400" />}
            </button>
          )}

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors hidden sm:block"
            title="Toàn màn hình trình chiếu"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 max-w-6xl w-full mx-auto relative z-10">

        {/* ================= STATE 1: SETUP ================= */}
        {gameState === 'SETUP' && (
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-indigo-500/25">
              <Sparkles className="w-8 h-8" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white mb-2">
              Thiết Lập Đấu Trường Live
            </h1>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Tạo phòng đấu Kahoot-style để chiếu lên máy chiếu hoặc màn hình lớp học.
            </p>

            <div className="space-y-4 text-left mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Thời gian cho mỗi câu hỏi
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 20, 30, 45].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setQuestionDuration(sec)}
                      className={`py-2.5 rounded-xl font-bold text-xs transition-all ${
                        questionDuration === sec
                          ? 'bg-indigo-600 text-white ring-2 ring-indigo-400 shadow-md'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {sec} giây
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-indigo-300">Thông tin bộ đề:</div>
                <div>• Tổng số câu: <span className="font-bold text-white">{quiz?.questions?.length || 0} câu</span></div>
                <div>• Tính điểm: <span className="font-bold text-emerald-400">Tốc độ & Chuỗi streak đúng</span></div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={loadingQuiz || !quiz?.questions?.length}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-black text-sm shadow-xl shadow-rose-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>TẠO PHÒNG & LẤY MÃ PIN</span>
            </button>
          </div>
        )}

        {/* ================= STATE 2: LOBBY ================= */}
        {gameState === 'LOBBY' && (
          <div className="w-full flex flex-col items-center text-center">
            
            {/* Massive PIN Banner for Projector */}
            <div className="w-full max-w-2xl bg-gradient-to-b from-indigo-900/60 via-slate-900/80 to-purple-900/60 border-2 border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl mb-6">
              <span className="text-xs font-black uppercase tracking-[0.25em] text-indigo-300 mb-1 block">
                Vào trang web và nhập mã PIN để tham gia:
              </span>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 my-3">
                <div className="px-5 py-2.5 rounded-2xl bg-slate-800/90 border border-slate-700 text-slate-300 text-sm font-bold font-mono">
                  {window.location.host}/live/join
                </div>
                <div className="text-slate-500 text-lg hidden sm:block">➔</div>
                <div className="text-4xl sm:text-6xl font-black font-mono tracking-[0.25em] text-amber-300 drop-shadow-[0_0_25px_rgba(251,191,36,0.4)]">
                  {pin}
                </div>
              </div>

              <div className="flex items-center justify-center gap-4 mt-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'Đã sao chép link tham gia!' : 'Sao chép link mời trực tiếp'}</span>
                </button>
              </div>
            </div>

            {/* Participants Counter & Start Action */}
            <div className="w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {players.length}
                  </span>
                  <span className="text-xs text-slate-400 block font-semibold">
                    Người chơi đã vào phòng
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => sendHostAction('START_QUIZ')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm shadow-xl shadow-emerald-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>BẮT ĐẦU TRẬN ĐẤU</span>
              </button>
            </div>

            {/* Players Grid with Bounce Avatars */}
            <div className="w-full max-w-4xl p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 min-h-[180px]">
              {players.length === 0 ? (
                <div className="py-12 text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
                  <span>Đang chờ học sinh / người chơi nhập mã PIN tham gia...</span>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5 justify-center">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-slate-800/90 border border-slate-700/80 shadow-md text-xs font-bold text-slate-200 animate-in fade-in zoom-in-75 duration-200"
                    >
                      <span className="text-lg">{p.avatar || '🦊'}</span>
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================= STATE 3: QUESTION ================= */}
        {gameState === 'QUESTION' && currentQuestion && (
          <div className="w-full max-w-5xl flex flex-col items-center">
            
            {/* Top Bar: Progress, Chapter, Answers count & Skip button */}
            <div className="w-full flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-xl bg-indigo-950/80 border border-indigo-600/50 text-indigo-300 font-bold text-xs">
                  CÂU HỎI {currentQuestion.index + 1} / {currentQuestion.total}
                </span>
                {currentQuestion.chapter && (
                  <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                    Chương: {currentQuestion.chapter}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{answeredCount} / {players.length} Đã trả lời</span>
                </div>

                <button
                  type="button"
                  onClick={() => sendHostAction('REVEAL_ANSWER')}
                  className="px-4 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
                >
                  <span>Hiện Đáp Án Ngay</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Timer & Question Box */}
            <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl mb-6 relative">
              
              {/* Circular Countdown Badge */}
              <div className="absolute -top-6 right-6 w-14 h-14 rounded-2xl bg-slate-900 border-2 border-indigo-500 flex items-center justify-center font-mono font-black text-2xl shadow-xl">
                <span className={timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-amber-300'}>
                  {timeLeft}
                </span>
              </div>

              {/* Question Content (LaTeX + Code) */}
              <div className="text-base sm:text-xl font-bold text-slate-100 leading-relaxed pr-12">
                <FormattedContent content={currentQuestion.content} />
              </div>
            </div>

            {/* 4 Massive Kahoot Option Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
              {['A', 'B', 'C', 'D'].map((key) => {
                const cfg = KAHOOT_COLORS[key];
                const optText = currentQuestion[`option_${key.toLowerCase()}`] || '';
                return (
                  <div
                    key={key}
                    className={`min-h-[110px] p-5 rounded-3xl ${cfg.bg} border-2 ${cfg.border} shadow-xl flex items-center gap-4 text-white font-bold transition-all`}
                  >
                    <div className="w-14 h-14 rounded-2xl bg-black/20 flex items-center justify-center text-3xl font-black shrink-0">
                      {cfg.shape}
                    </div>
                    <div className="flex-1 text-sm sm:text-base font-semibold leading-snug">
                      <FormattedContent content={optText} />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ================= STATE 4: REVEAL ================= */}
        {gameState === 'REVEAL' && revealData && (
          <div className="w-full max-w-4xl flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between mb-4 px-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Kết Quả Câu Hỏi {revealData.index + 1}
              </span>
              <button
                type="button"
                onClick={() => sendHostAction('SHOW_LEADERBOARD')}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-black text-xs shadow-lg shadow-indigo-500/25 flex items-center gap-2 active:scale-98 transition-all"
              >
                <span>BẢNG XẾP HẠNG</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Highlighted Correct Answer Banner */}
            <div className="w-full p-6 rounded-3xl bg-slate-900 border-2 border-emerald-500/60 shadow-2xl mb-6 text-left relative overflow-hidden">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                  ĐÁP ÁN CHÍNH XÁC: {revealData.correct_answer}
                </span>
                <span className="text-xs text-slate-400">
                  Tổng lượt trả lời: {revealData.total_answers}
                </span>
              </div>

              {/* Show explanation if available */}
              {revealData[`explanation_${revealData.correct_answer.toLowerCase()}`] && (
                <div className="mt-3 p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-700/50 text-xs sm:text-sm text-emerald-200 leading-relaxed">
                  <span className="font-bold text-emerald-300 mr-1">💡 Giải thích:</span>
                  <FormattedContent content={revealData[`explanation_${revealData.correct_answer.toLowerCase()}`]} />
                </div>
              )}
            </div>

            {/* Answer Distribution Bar Chart */}
            <div className="w-full grid grid-cols-4 gap-3 sm:gap-6 items-end min-h-[220px] p-6 rounded-3xl bg-slate-900/80 border border-slate-800">
              {['A', 'B', 'C', 'D'].map((key) => {
                const count = revealData.stats ? (revealData.stats[key] || 0) : 0;
                const total = Math.max(1, revealData.total_answers);
                const heightPercent = Math.max(15, Math.round((count / total) * 100));
                const isCorrect = key === revealData.correct_answer;
                const cfg = KAHOOT_COLORS[key];

                return (
                  <div key={key} className="flex flex-col items-center justify-end h-full gap-2">
                    <span className="font-mono font-black text-sm text-white">
                      {count}
                    </span>

                    {/* Bar */}
                    <div 
                      className={`w-full rounded-2xl transition-all duration-700 ease-out flex items-center justify-center font-black text-xl shadow-lg relative ${
                        isCorrect 
                          ? 'bg-emerald-500 ring-4 ring-emerald-400/50' 
                          : `${cfg.bg} opacity-50`
                      }`}
                      style={{ height: `${heightPercent}%`, minHeight: '48px' }}
                    >
                      {isCorrect && (
                        <span className="absolute -top-3 px-2 py-0.5 rounded-md bg-emerald-400 text-slate-950 text-[10px] font-black uppercase shadow">
                          Đúng
                        </span>
                      )}
                      <span>{cfg.shape}</span>
                    </div>

                    <span className="text-xs font-bold text-slate-300">
                      Đáp án {key}
                    </span>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ================= STATE 5: LEADERBOARD ================= */}
        {gameState === 'LEADERBOARD' && leaderboardData && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between mb-6 px-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-black text-white">
                  Bảng Xếp Hạng Vòng {leaderboardData.current_question}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => sendHostAction('NEXT_QUESTION')}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-2 active:scale-98 transition-all"
              >
                <span>{leaderboardData.is_last_question ? 'TỔNG KẾT PODIUM 🏆' : 'CÂU TIẾP THEO ➔'}</span>
              </button>
            </div>

            {/* Animated Leaderboard Bars */}
            <div className="w-full space-y-3">
              {leaderboardData.leaderboard.slice(0, 5).map((p, idx) => {
                const medals = ['🥇', '🥈', '🥉'];
                return (
                  <div
                    key={p.id || idx}
                    className={`flex items-center justify-between p-4 rounded-3xl border transition-all ${
                      idx === 0 
                        ? 'bg-gradient-to-r from-amber-950/60 to-slate-900 border-amber-500/50 shadow-xl shadow-amber-500/10' 
                        : idx === 1
                        ? 'bg-slate-900/90 border-slate-600 shadow-md'
                        : idx === 2
                        ? 'bg-slate-900/90 border-amber-800/60 shadow-md'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm">
                        {idx < 3 ? (
                          <span className="text-xl">{medals[idx]}</span>
                        ) : (
                          <span className="text-slate-400 font-mono">#{idx + 1}</span>
                        )}
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner shrink-0">
                        {p.avatar || '🦊'}
                      </div>
                      <div className="truncate">
                        <span className="text-base font-bold text-white block truncate">
                          {p.name}
                        </span>
                        {p.streak > 1 && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-bold">
                            <Flame className="w-3.5 h-3.5 fill-rose-400" />
                            <span>Chuỗi {p.streak} đúng liên tiếp</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="font-mono font-black text-amber-300 text-lg sm:text-xl shrink-0">
                      {p.score.toLocaleString()} đ
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}

        {/* ================= STATE 6: FINISHED PODIUM ================= */}
        {gameState === 'FINISHED' && finishData && (
          <div className="w-full max-w-4xl flex flex-col items-center text-center">
            
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs uppercase tracking-widest mb-3 animate-pulse">
              <Crown className="w-4 h-4" />
              <span>VINH DANH QUÁN QUÂN ĐẤU TRƯỜNG</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-white mb-8 tracking-tight">
              BỤC VINH QUANG PODIUM
            </h1>

            {/* 3-Tier Olympic Podium */}
            <div className="w-full grid grid-cols-3 gap-3 sm:gap-6 items-end max-w-2xl mb-10 min-h-[300px]">
              
              {/* 2nd Place (Silver) */}
              <div className="flex flex-col items-center">
                {finishData.podium[1] ? (
                  <>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-slate-800 border-2 border-slate-400 flex items-center justify-center text-3xl sm:text-4xl shadow-xl mb-2">
                      {finishData.podium[1].avatar || '🐼'}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-full px-1">
                      {finishData.podium[1].name}
                    </span>
                    <span className="font-mono font-black text-xs text-amber-300 mb-2">
                      {finishData.podium[1].score.toLocaleString()} đ
                    </span>
                  </>
                ) : null}
                <div className="w-full h-32 sm:h-40 rounded-t-3xl bg-gradient-to-t from-slate-800 to-slate-700 border-t-4 border-slate-400 flex flex-col items-center justify-center font-black text-3xl text-slate-300 shadow-xl">
                  <span>2</span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Hạng Nhì</span>
                </div>
              </div>

              {/* 1st Place (Gold, Tallest) */}
              <div className="flex flex-col items-center">
                {finishData.podium[0] ? (
                  <>
                    <div className="relative mb-2">
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 border-4 border-amber-300 flex items-center justify-center text-4xl sm:text-5xl shadow-2xl shadow-amber-500/40 animate-bounce">
                        {finishData.podium[0].avatar || '🦁'}
                      </div>
                      <Crown className="w-8 h-8 text-amber-300 fill-amber-300 absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-lg" />
                    </div>
                    <span className="text-sm sm:text-base font-black text-white truncate max-w-full px-1">
                      {finishData.podium[0].name}
                    </span>
                    <span className="font-mono font-black text-sm text-amber-300 mb-2">
                      {finishData.podium[0].score.toLocaleString()} đ
                    </span>
                  </>
                ) : null}
                <div className="w-full h-44 sm:h-56 rounded-t-3xl bg-gradient-to-t from-amber-600 via-amber-500 to-yellow-400 border-t-4 border-yellow-200 flex flex-col items-center justify-center font-black text-5xl text-slate-950 shadow-2xl">
                  <span>1</span>
                  <span className="text-xs uppercase font-black text-slate-900 tracking-wider">Vô Địch</span>
                </div>
              </div>

              {/* 3rd Place (Bronze) */}
              <div className="flex flex-col items-center">
                {finishData.podium[2] ? (
                  <>
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-slate-800 border-2 border-amber-700 flex items-center justify-center text-3xl sm:text-4xl shadow-xl mb-2">
                      {finishData.podium[2].avatar || '🐬'}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-200 truncate max-w-full px-1">
                      {finishData.podium[2].name}
                    </span>
                    <span className="font-mono font-black text-xs text-amber-300 mb-2">
                      {finishData.podium[2].score.toLocaleString()} đ
                    </span>
                  </>
                ) : null}
                <div className="w-full h-24 sm:h-28 rounded-t-3xl bg-gradient-to-t from-amber-950 to-amber-900 border-t-4 border-amber-600 flex flex-col items-center justify-center font-black text-2xl text-amber-200 shadow-xl">
                  <span>3</span>
                  <span className="text-[10px] uppercase font-bold text-amber-300">Hạng Ba</span>
                </div>
              </div>

            </div>

            {/* Back action */}
            <div className="flex items-center gap-4">
              <Link
                to={`/quiz/${shareCode}`}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                Về Chi Tiết Đề Thi
              </Link>
              <button
                type="button"
                onClick={() => setGameState('SETUP')}
                className="px-6 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all"
              >
                Tổ Chức Trận Khác
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
