import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Gamepad2, Play, Shuffle, Sparkles, ArrowLeft, Trophy, Users } from 'lucide-react';
import { fetchLiveRoomInfo } from '../services/api';

const AVATARS = ['🦊', '🐼', '🦁', '🐬', '🐧', '🦝', '🐯', '🦄', '🐨', '🐸', '🦉', '🐙'];

const ANIMAL_NICKNAMES = [
  'Cáo Thông Thái',
  'Gấu Trúc Bá Đạo',
  'Sư Tử Chiến',
  'Cá Heo Siêu Tốc',
  'Cánh Cụt Đam Mê',
  'Gấu Mèo Siêu Cấp',
  'Hổ Lĩnh Xướng',
  'Kỳ Lân Tri Thức'
];

export default function LiveJoinPage() {
  const [searchParams] = useSearchParams();
  const initialPin = searchParams.get('pin') || '';
  const navigate = useNavigate();

  const [pin, setPin] = useState(initialPin);
  const [nickname, setNickname] = useState(() => {
    return ANIMAL_NICKNAMES[Math.floor(Math.random() * ANIMAL_NICKNAMES.length)];
  });
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return AVATARS[Math.floor(Math.random() * AVATARS.length)];
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleRandomizeName = () => {
    const randomNick = ANIMAL_NICKNAMES[Math.floor(Math.random() * ANIMAL_NICKNAMES.length)];
    const randomNum = Math.floor(10 + Math.random() * 90);
    setNickname(`${randomNick} #${randomNum}`);
    setSelectedAvatar(AVATARS[Math.floor(Math.random() * AVATARS.length)]);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    const cleanPin = pin.trim().replace(/\s+/g, '');
    if (!cleanPin || cleanPin.length < 5) {
      setError('Vui lòng nhập mã PIN phòng gồm 6 chữ số hợp lệ.');
      return;
    }

    if (!nickname.trim()) {
      setError('Vui lòng nhập biệt danh để tham gia thi đấu.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate room exists before navigating
      await fetchLiveRoomInfo(cleanPin);

      // Store player profile in session
      const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      sessionStorage.setItem(`quiz_player_${cleanPin}`, JSON.stringify({
        playerId,
        name: nickname.trim(),
        avatar: selectedAvatar
      }));

      navigate(`/live/play/${cleanPin}`);
    } catch (err) {
      setError(err.message || 'Không thể tìm thấy phòng đấu trường với mã PIN này.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white relative overflow-hidden">
      
      {/* Decorative Background Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center">
        
        {/* Header Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-500/20 text-white">
          <Gamepad2 className="w-9 h-9 stroke-[2.2]" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-1 bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent">
          Đấu Trường Trực Tiếp
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mb-6">
          Nhập mã PIN để tham gia thi đấu trực tuyến cùng cả lớp
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold text-left flex items-start gap-2">
            <span className="shrink-0 text-base">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleJoin} className="space-y-4 text-left">
          {/* PIN Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Mã PIN Phòng Thi (6 Chữ Số)
            </label>
            <input
              type="text"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              placeholder="Ví dụ: 849201"
              maxLength={6}
              className="w-full text-center tracking-[0.3em] font-mono text-2xl sm:text-3xl font-black py-3.5 px-4 rounded-2xl bg-slate-800/90 border-2 border-slate-700 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 text-white placeholder-slate-600 focus:outline-none transition-all shadow-inner"
              autoFocus
            />
          </div>

          {/* Nickname & Avatar Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Biệt danh của bạn
              </label>
              <button
                type="button"
                onClick={handleRandomizeName}
                className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Shuffle className="w-3 h-3" />
                <span>Đổi tên khác</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Avatar Selector Dropdown or Display */}
              <div className="w-14 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl shadow-inner shrink-0">
                {selectedAvatar}
              </div>

              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nhập tên của bạn..."
                maxLength={25}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 border border-slate-700 focus:border-indigo-500 text-white text-sm font-bold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* Quick Avatar Picker */}
            <div className="flex items-center justify-between gap-1 mt-2.5 px-1 overflow-x-auto py-1">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  type="button"
                  onClick={() => setSelectedAvatar(av)}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all ${
                    selectedAvatar === av
                      ? 'bg-indigo-600 ring-2 ring-indigo-400 scale-110 shadow-md'
                      : 'bg-slate-800/60 hover:bg-slate-700 opacity-60 hover:opacity-100'
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:from-indigo-400 hover:to-pink-500 text-white font-black text-base shadow-xl shadow-indigo-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>VÀO PHÒNG ĐẤU TRƯỜNG</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <Link to="/" className="inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về trang chủ</span>
          </Link>
          <span className="flex items-center gap-1 text-indigo-400 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Chơi miễn phí 100%</span>
          </span>
        </div>

      </div>
    </div>
  );
}
