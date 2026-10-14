import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for Online Exam Proctoring & Anti-cheating (Azota-style)
 * 
 * Features:
 * 1. Enforced Fullscreen monitoring
 * 2. Tab switching & window blur detection
 * 3. Copy/cut/paste and right-click context menu prevention
 * 4. DevTools and source inspection keyboard shortcuts prevention
 * 5. Automatic violation logging with timestamps and duration
 * 6. Auto-submit callback when violation count reaches max limit
 */
export default function useExamProctoring({
  isActive = false,
  enabled = true,
  maxViolations = 3,
  onViolationLimitReached = null,
}) {
  const [violations, setViolations] = useState([]);
  const [violationCount, setViolationCount] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [currentWarning, setCurrentWarning] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const blurTimestampRef = useRef(null);
  const lastViolationTimeRef = useRef(0);
  const isEnforcingFullscreenRef = useRef(false);
  const toastTimeoutRef = useRef(null);

  // Play a soft warning sound using Web Audio API
  const playWarningChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      osc.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.35); // E4

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch (e) {
      // AudioContext could be blocked by autoplay policies
    }
  }, []);

  // Show a temporary unobtrusive toast message
  const triggerToast = useCallback((msg) => {
    setToastMessage(msg);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  // Safe Fullscreen request
  const requestFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen();
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen();
      }
      setIsFullscreen(true);
      isEnforcingFullscreenRef.current = true;
      return true;
    } catch (err) {
      console.warn('Fullscreen request denied or not supported:', err);
      return false;
    }
  }, []);

  // Safe Fullscreen exit
  const exitFullscreen = useCallback(async () => {
    try {
      isEnforcingFullscreenRef.current = false;
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        }
      }
      setIsFullscreen(false);
    } catch (err) {
      console.warn('Error exiting fullscreen:', err);
    }
  }, []);

  // Register a violation
  const recordViolation = useCallback((type, message, details = {}) => {
    const now = Date.now();
    // Cooldown check (ignore duplicate triggers within 1.5s)
    if (now - lastViolationTimeRef.current < 1500) {
      return;
    }
    lastViolationTimeRef.current = now;

    playWarningChime();

    setViolationCount((prevCount) => {
      const nextCount = prevCount + 1;
      const newViolation = {
        id: `viol_${now}`,
        count: nextCount,
        type,
        message,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...details
      };

      setViolations((prevList) => [...prevList, newViolation]);

      const warningData = {
        type,
        message,
        count: nextCount,
        max: maxViolations,
        isExceeded: nextCount >= maxViolations
      };
      setCurrentWarning(warningData);
      setShowWarningModal(true);

      if (nextCount >= maxViolations && typeof onViolationLimitReached === 'function') {
        onViolationLimitReached(warningData);
      }

      return nextCount;
    });
  }, [maxViolations, onViolationLimitReached, playWarningChime]);

  // Dismiss warning modal and try to restore fullscreen
  const dismissWarning = useCallback(() => {
    setShowWarningModal(false);
    setCurrentWarning(null);
    if (enabled && isActive) {
      requestFullscreen();
    }
  }, [enabled, isActive, requestFullscreen]);

  // Reset all violation states
  const resetProctoring = useCallback(() => {
    setViolations([]);
    setViolationCount(0);
    setShowWarningModal(false);
    setCurrentWarning(null);
    setToastMessage(null);
  }, []);

  // Monitor visibility change (Tab switching)
  useEffect(() => {
    if (!isActive || !enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        blurTimestampRef.current = Date.now();
      } else {
        if (blurTimestampRef.current) {
          const duration = Math.round((Date.now() - blurTimestampRef.current) / 1000);
          blurTimestampRef.current = null;
          if (duration >= 1) {
            recordViolation(
              'tab_switch',
              `Bạn vừa chuyển sang tab khác hoặc rời màn hình làm bài (${duration} giây).`,
              { durationSeconds: duration }
            );
          }
        }
      }
    };

    const handleWindowBlur = () => {
      if (!blurTimestampRef.current) {
        blurTimestampRef.current = Date.now();
      }
    };

    const handleWindowFocus = () => {
      if (blurTimestampRef.current) {
        const duration = Math.round((Date.now() - blurTimestampRef.current) / 1000);
        blurTimestampRef.current = null;
        if (duration >= 2) {
          recordViolation(
            'window_blur',
            `Bạn vừa chuyển tiêu điểm sang cửa sổ ứng dụng khác (${duration} giây).`,
            { durationSeconds: duration }
          );
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isActive, enabled, recordViolation]);

  // Monitor Fullscreen Exit
  useEffect(() => {
    if (!isActive || !enabled) return;

    const handleFullscreenChange = () => {
      const inFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement);
      setIsFullscreen(inFullscreen);

      if (!inFullscreen && isEnforcingFullscreenRef.current) {
        recordViolation(
          'fullscreen_exit',
          'Bạn vừa thoát khỏi chế độ thi Toàn Màn Hình bắt buộc.'
        );
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isActive, enabled, recordViolation]);

  // Anti-Copy, Anti-RightClick, Anti-DevTools
  useEffect(() => {
    if (!isActive || !enabled) return;

    const handleContextMenu = (e) => {
      e.preventDefault();
      triggerToast('🔒 Chuột phải bị vô hiệu hóa trong phòng thi!');
      return false;
    };

    const handleCopyCutPaste = (e) => {
      e.preventDefault();
      triggerToast('🔒 Sao chép / Cắt / Dán bị vô hiệu hóa trong phòng thi!');
      return false;
    };

    const handleKeyDown = (e) => {
      // Allow normal typing in input/textarea if any
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // F12 or Ctrl+Shift+I or Ctrl+Shift+J or Ctrl+Shift+C (DevTools)
      if (
        e.key === 'F12' ||
        (isCtrlOrCmd && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))
      ) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('⚠️ Phím tắt mở công cụ kiểm tra (DevTools) bị cấm!');
        return false;
      }

      // Ctrl+U (View Source) or Ctrl+P (Print)
      if (isCtrlOrCmd && ['u', 'U', 'p', 'P'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('⚠️ Tính năng in hoặc xem mã nguồn trang bị cấm!');
        return false;
      }

      // Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A (Select All)
      if (isCtrlOrCmd && ['c', 'C', 'v', 'V', 'x', 'X', 'a', 'A'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        triggerToast('🔒 Thao tác bàn phím này bị vô hiệu hóa!');
        return false;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('copy', handleCopyCutPaste);
    window.addEventListener('cut', handleCopyCutPaste);
    window.addEventListener('paste', handleCopyCutPaste);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('copy', handleCopyCutPaste);
      window.removeEventListener('cut', handleCopyCutPaste);
      window.removeEventListener('paste', handleCopyCutPaste);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isActive, enabled, triggerToast]);

  return {
    violations,
    violationCount,
    isFullscreen,
    showWarningModal,
    currentWarning,
    toastMessage,
    requestFullscreen,
    exitFullscreen,
    dismissWarning,
    resetProctoring,
    isDisqualified: violationCount >= maxViolations
  };
}
