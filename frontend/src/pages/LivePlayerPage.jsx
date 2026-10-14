import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Gamepad2, 
  Flame, 
  Trophy, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowLeft,
  Volume2,
  VolumeX,
  Zap,
  Award
} from 'lucide-react';
import { getWebSocketBaseUrl } from '../services/api';
import FormattedContent from '../components/FormattedContent';
import { 
  playClickSound, 
  playCorrectSound, 
  playWrongSound, 
  playTickSound, 
  playFanfareSound 
} from '../utils/soundEffects';

const KAHOOT_COLORS = {
  A: {
    bg: 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700',
    border: 'border-rose-400/40',
    shadow: 'shadow-rose-600/30',
    shape: '▲',
    label: 'A'
  },
  B: {
    bg: 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700',
    border: 'border-sky-400/40',
    shadow: 'shadow-sky-600/30',
    shape: '◆',
    label: 'B'
  },
  C: {
    bg: 'bg-amber-500 hover:bg-amber-400 active:bg-amber-600',
    border: 'border-amber-300/40',
    shadow: 'shadow-amber-500/30',
    shape: '●',
    label: 'C'
  },
  D: {
    bg: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700',
    border: 'border-emerald-400/40',
    shadow: 'shadow-emerald-600/30',
    shape: '■',
    label: 'D'
  }
};

export default function LivePlayerPage() {
  const { pin } = useParams();
  const navigate = useNavigate();

  const [player, setPlayer] = useState(null);
  const [gameState, setGameState] = useState('CONNECTING'); // CONNECTING, LOBBY, QUESTION, REVEAL, LEADERBOARD, FINISHED, ERROR
  const [errorMessage, setErrorMessage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Question State
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [myAnswerResult, setMyAnswerResult] = useState(null); // from server ANSWER_RECEIVED
  const [revealData, setRevealData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState(null);
  const [finishData, setFinishData] = useState(null);

  // Score & Streak
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);

  // Timer
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionDuration, setQuestionDuration] = useState(25);

  const socketRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Load player from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem(`quiz_player_${pin}`);
    if (!raw) {
      navigate(`/live/join?pin=${pin}`);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      setPlayer(parsed);
    } catch {
      navigate(`/live/join?pin=${pin}`);
    }
  }, [pin, navigate]);

  // Connect WebSocket once player is ready
  useEffect(() => {
    if (!player || !pin) return;

    const wsBase = getWebSocketBaseUrl();
    const wsUrl = `${wsBase}/api/live/ws/player/${pin}?name=${encodeURIComponent(player.name)}&avatar=${encodeURIComponent(player.avatar)}&player_id=${encodeURIComponent(player.playerId)}`;

    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setGameState('LOBBY');
      setErrorMessage(null);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleServerMessage(msg);
      } catch (err) {
        console.error('Error parsing WS message:', err);
      }
    };

    ws.onerror = (e) => {
      console.error('WebSocket Error:', e);
      setErrorMessage('Lỗi kết nối tới máy chủ đấu trường.');
    };

    ws.onclose = () => {
      if (gameState !== 'FINISHED') {
        setErrorMessage('Đã ngắt kết nối với phòng đấu trường.');
      }
    };

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [player, pin]);

  const handleServerMessage = (msg) => {
    const { type, data } = msg;

    if (type === 'ERROR') {
      setErrorMessage(msg.message || 'Có lỗi xảy ra.');
      setGameState('ERROR');
      return;
    }

    if (type === 'JOIN_SUCCESS') {
      setGameState('LOBBY');
    }

    if (type === 'QUESTION_START') {
      setCurrentQuestion(data);
      setSelectedChoice(null);
      setMyAnswerResult(null);
      setRevealData(null);
      setGameState('QUESTION');

      const dur = data.duration || 25;
      setQuestionDuration(dur);
      setTimeLeft(dur);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerIntervalRef.current);
            return 0;
          }
          if (prev <= 6 && soundEnabled) {
            playTickSound(prev <= 3);
          }
          return prev - 1;
        });
      }, 1000);
    }

    if (type === 'ANSWER_RECEIVED') {
      setMyAnswerResult(data);
      if (data.total_score !== undefined) setScore(data.total_score);
      if (data.streak !== undefined) setStreak(data.streak);
    }

    if (type === 'QUESTION_REVEAL') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setRevealData(data);
      setGameState('REVEAL');

      // Check if player's choice was correct
      if (myAnswerResult) {
        if (myAnswerResult.is_correct && soundEnabled) {
          playCorrectSound();
        } else if (!myAnswerResult.is_correct && soundEnabled) {
          playWrongSound();
        }
      }
    }

    if (type === 'LEADERBOARD_UPDATE') {
      setLeaderboardData(data);
      setGameState('LEADERBOARD');
    }

    if (type === 'QUIZ_FINISHED') {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setFinishData(data);
      setGameState('FINISHED');
      if (soundEnabled) {
        playFanfareSound();
      }
    }
  };

  const handleAnswerClick = (choiceKey) => {
    if (selectedChoice !== null || gameState !== 'QUESTION') return;

    if (soundEnabled) playClickSound();
    if (navigator.vibrate) navigator.vibrate(50);

    setSelectedChoice(choiceKey);

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        action: 'SUBMIT_ANSWER',
        choice: choiceKey
      }));
    }
  };

  // Find player rank in leaderboard
  const getMyRank = (list) => {
    if (!list || !player) return null;
    const index = list.findIndex(p => p.id === player.playerId);
    return index !== -1 ? index + 1 : null;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* Top Header Bar */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center font-mono font-bold text-sm shadow-md">
            {player?.avatar || '🦊'}
          </div>
          <div>
            <span className="text-xs font-bold text-slate-200 line-clamp-1 max-w-[120px] sm:max-w-[180px]">
              {player?.name || 'Đang kết nối...'}
            </span>
            <span className="block text-[10px] text-indigo-400 font-mono font-bold tracking-wider">
              PIN: {pin}
            </span>
          </div>
        </div>

        {/* Real-time score & sound toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700">
            <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            <span className="text-xs font-black font-mono text-amber-300">
              {score.toLocaleString()} đ
            </span>
          </div>

          {streak > 1 && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold animate-pulse">
              <Flame className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
              <span>x{streak}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </header>

      {/* Main Game Screen */}
      <main className="flex-1 flex flex-col justify-center items-center p-3 sm:p-6 max-w-4xl w-full mx-auto relative z-10">

        {/* STATE: CONNECTING */}
        {gameState === 'CONNECTING' && (
          <div className="text-center py-16">
            <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-200">Đang kết nối phòng thi đấu...</h2>
            <p className="text-xs text-slate-400 mt-1">Mã PIN: {pin}</p>
          </div>
        )}

        {/* STATE: ERROR */}
        {gameState === 'ERROR' && (
          <div className="text-center max-w-sm p-6 bg-slate-900 border border-rose-500/40 rounded-3xl shadow-xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3">
              <XCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-white mb-2">Không thể tham gia</h2>
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              {errorMessage || 'Phòng đấu trường đã kết thúc hoặc không tồn tại.'}
            </p>
            <Link
              to="/live/join"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Nhập mã PIN khác</span>
            </Link>
          </div>
        )}

        {/* STATE: LOBBY */}
        {gameState === 'LOBBY' && (
          <div className="w-full max-w-md text-center py-8 px-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-5xl shadow-xl shadow-indigo-500/25 animate-bounce">
                {player?.avatar}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
              </span>
            </div>

            <h2 className="text-2xl font-black text-white mb-1">
              {player?.name}
            </h2>
            <p className="text-xs text-emerald-400 font-bold uppercase tracking-wider mb-6">
              ● Đã Sẵn Sàng Vào Trận
            </p>

            <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 text-left space-y-2 mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Bí quyết đạt điểm cao:</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                <li>Trả lời thật nhanh để nhận điểm cộng tốc độ (tối đa 1000 điểm).</li>
                <li>Duy trì chuỗi đúng (streak) để leo top nhanh hơn.</li>
                <li>Nhìn lên màn hình lớn của Host để đọc kỹ câu hỏi!</li>
              </ul>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-medium">
              <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Đang chờ Host bắt đầu trận đấu...</span>
            </div>
          </div>
        )}

        {/* STATE: QUESTION */}
        {gameState === 'QUESTION' && currentQuestion && (
          <div className="w-full flex flex-col h-full max-w-3xl">
            
            {/* Top Timer Bar & Progress */}
            <div className="w-full mb-3">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5 px-1">
                <span className="text-indigo-400 uppercase tracking-wider">
                  Câu hỏi {currentQuestion.index + 1} / {currentQuestion.total}
                </span>
                <span className={`font-mono flex items-center gap-1 ${timeLeft <= 5 ? 'text-rose-400 animate-pulse text-sm font-black' : 'text-slate-300'}`}>
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeLeft}s</span>
                </span>
              </div>
              
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    timeLeft <= 5 ? 'bg-rose-500' : timeLeft <= 10 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{ width: `${Math.max(0, (timeLeft / questionDuration) * 100)}%` }}
                />
              </div>
            </div>

            {/* Question Card with FormattedContent (Latex & Code) */}
            <div className="w-full p-4 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl mb-4 text-left">
              {currentQuestion.chapter && (
                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-[10px] font-bold mb-2 uppercase">
                  {currentQuestion.chapter}
                </span>
              )}
              <div className="text-sm sm:text-base font-semibold text-slate-100 leading-relaxed">
                <FormattedContent content={currentQuestion.content} />
              </div>
            </div>

            {/* Locked Feedback if Player has chosen */}
            {selectedChoice !== null ? (
              <div className="w-full py-10 px-4 rounded-3xl bg-slate-900/90 border border-slate-800 text-center flex flex-col items-center justify-center shadow-2xl">
                <div className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl font-black text-white mb-3 shadow-xl ${KAHOOT_COLORS[selectedChoice]?.bg}`}>
                  {KAHOOT_COLORS[selectedChoice]?.shape}
                </div>
                <h3 className="text-lg font-black text-white">
                  ĐÃ CHỌN ĐÁP ÁN {selectedChoice}!
                </h3>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Đang chờ mọi người hoàn thành & xem kết quả...</span>
                </p>
              </div>
            ) : (
              /* 4 Kahoot-style Answer Buttons */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full flex-1">
                {['A', 'B', 'C', 'D'].map((key) => {
                  const cfg = KAHOOT_COLORS[key];
                  const optText = currentQuestion[`option_${key.toLowerCase()}`] || '';
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleAnswerClick(key)}
                      disabled={timeLeft <= 0}
                      className={`min-h-[90px] sm:min-h-[110px] p-3.5 sm:p-4 rounded-2xl ${cfg.bg} border ${cfg.border} text-white font-bold text-left shadow-lg ${cfg.shadow} transition-all active:scale-[0.98] flex items-center gap-3.5 group`}
                    >
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-black/20 flex items-center justify-center text-xl sm:text-2xl font-black shrink-0 group-hover:scale-110 transition-transform">
                        {cfg.shape}
                      </div>
                      <div className="flex-1 text-xs sm:text-sm font-semibold line-clamp-3 overflow-hidden leading-snug">
                        <FormattedContent content={optText} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* STATE: REVEAL */}
        {gameState === 'REVEAL' && revealData && (
          <div className="w-full max-w-lg text-center py-6 px-4 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            
            {myAnswerResult ? (
              myAnswerResult.is_correct ? (
                <div>
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase tracking-wider mb-1">
                    CHÍNH XÁC!
                  </span>
                  <h2 className="text-3xl font-black text-white">
                    +{myAnswerResult.score_earned} Điểm
                  </h2>

                  {myAnswerResult.streak > 1 && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-black text-xs shadow-md mt-2">
                      <Flame className="w-4 h-4 fill-white" />
                      <span>Chuỗi {myAnswerResult.streak} câu đúng liên tiếp!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="w-20 h-20 rounded-3xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-rose-500/20">
                    <XCircle className="w-12 h-12 stroke-[2.5]" />
                  </div>
                  <span className="inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs uppercase tracking-wider mb-1">
                    CHƯA CHÍNH XÁC
                  </span>
                  <h2 className="text-xl font-bold text-white">
                    Đáp án đúng là: <span className="text-emerald-400 font-black text-2xl">{revealData.correct_answer}</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Bạn đã chọn: <span className="font-bold text-rose-400">{myAnswerResult.choice}</span>
                  </p>
                </div>
              )
            ) : (
              <div>
                <div className="w-20 h-20 rounded-3xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Clock className="w-12 h-12" />
                </div>
                <h2 className="text-xl font-bold text-slate-200">Hết thời gian!</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Đáp án đúng: <span className="text-emerald-400 font-black text-lg">{revealData.correct_answer}</span>
                </p>
              </div>
            )}

            {/* Total score pill */}
            <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Tổng điểm hiện tại:</span>
              <span className="text-base font-black font-mono text-amber-300">
                {score.toLocaleString()} đ
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-indigo-400">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
              <span>Chờ Host mở Bảng Xếp Hạng...</span>
            </div>
          </div>
        )}

        {/* STATE: LEADERBOARD */}
        {gameState === 'LEADERBOARD' && leaderboardData && (
          <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-black text-white">
                  Bảng Xếp Hạng
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-400">
                Câu {leaderboardData.current_question} / {leaderboardData.total_questions}
              </span>
            </div>

            {/* My Rank Banner */}
            {(() => {
              const myRank = getMyRank(leaderboardData.leaderboard);
              return myRank ? (
                <div className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-indigo-600 font-black text-xs flex items-center justify-center">
                      #{myRank}
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white block">Vị trí của bạn</span>
                      <span className="text-[11px] text-indigo-300">
                        {myRank <= 3 ? '🎉 Đang nằm trong Top 3!' : 'Cố gắng bứt phá nhé!'}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-amber-300 text-sm">
                    {score.toLocaleString()} đ
                  </span>
                </div>
              ) : null;
            })()}

            {/* Top 5 list */}
            <div className="space-y-2">
              {leaderboardData.leaderboard.slice(0, 5).map((p, idx) => {
                const isMe = p.id === player?.playerId;
                return (
                  <div
                    key={p.id || idx}
                    className={`flex items-center justify-between p-2.5 rounded-2xl transition-all ${
                      isMe 
                        ? 'bg-indigo-600/30 border border-indigo-500 text-white font-bold'
                        : 'bg-slate-800/60 border border-slate-700/60 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                        idx === 0 ? 'bg-amber-500 text-slate-950 font-black' :
                        idx === 1 ? 'bg-slate-300 text-slate-950 font-black' :
                        idx === 2 ? 'bg-amber-700 text-white font-black' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-base">{p.avatar || '🦊'}</span>
                      <span className="text-xs truncate max-w-[140px] sm:max-w-[180px]">
                        {p.name} {isMe && '(Bạn)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {p.streak > 1 && (
                        <span className="text-[10px] text-rose-400 font-bold flex items-center gap-0.5">
                          <Flame className="w-3 h-3 fill-rose-400" />
                          <span>{p.streak}</span>
                        </span>
                      )}
                      <span className="font-mono font-black text-amber-300 text-xs">
                        {p.score.toLocaleString()} đ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-center text-[11px] text-slate-400 mt-4 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
              <span>Chờ Host sang câu hỏi tiếp theo...</span>
            </p>
          </div>
        )}

        {/* STATE: FINISHED */}
        {gameState === 'FINISHED' && finishData && (
          <div className="w-full max-w-md text-center py-8 px-6 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-500/20 animate-bounce">
              <Award className="w-12 h-12" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
              TRẬN ĐẤU KẾT THÚC!
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Bạn đã hoàn thành tất cả các câu hỏi
            </p>

            {/* Player Final Result Card */}
            {(() => {
              const myRank = getMyRank(finishData.leaderboard);
              return (
                <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-950 via-slate-900 to-purple-950 border border-indigo-500/40 mb-6 text-left">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-slate-400 font-semibold">Thứ hạng của bạn:</span>
                    <span className="px-3 py-1 rounded-xl bg-amber-500 text-slate-950 font-black text-sm">
                      {myRank ? `Hạng #${myRank}` : 'Hoàn thành'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Tổng điểm đạt được:</span>
                    <span className="text-xl font-black font-mono text-amber-300">
                      {score.toLocaleString()} đ
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="flex flex-col sm:flex-row gap-2.5">
              <Link
                to="/live/join"
                className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition-all text-center"
              >
                Chơi Ván Mới
              </Link>
              <Link
                to="/"
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-all text-center"
              >
                Về Trang Chủ
              </Link>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
