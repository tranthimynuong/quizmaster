import React, { useState, useRef } from 'react';
import {
  FileDown,
  Printer,
  X as CloseIcon,
  Check,
  Layers,
  Settings2,
  BookOpen,
  FileCheck2,
  Sparkles,
  Download
} from 'lucide-react';
import { getQuizPdfExportUrl } from '../services/api';

export default function ExportPdfModal({ quiz, initialChapter = null, isOpen, onClose }) {
  if (!isOpen || !quiz) return null;

  const printRef = useRef();

  const allQuestions = quiz.questions || [];
  const chaptersSummary = quiz.chapters_summary || [];
  const chapterNames = chaptersSummary.map(c => c.name);

  // Export settings
  const [selectedChapter, setSelectedChapter] = useState(initialChapter || 'all');
  const [schoolName, setSchoolName] = useState('ĐỀ THI TRẮC NGHIỆM CHUẨN');
  const [examDuration, setExamDuration] = useState('45 phút');
  const [includeAnswers, setIncludeAnswers] = useState('bottom_table'); // 'none', 'highlight', 'bottom_table'
  const [includeExplanations, setIncludeExplanations] = useState(false);
  const [twoColumnOptions, setTwoColumnOptions] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filtered questions based on chosen chapter with NFC unicode normalization
  const filteredQuestions = allQuestions.filter(q => {
    if (selectedChapter === 'all') return true;
    return (q.chapter || 'Bài 1') === selectedChapter;
  });

  const handleDownloadPdf = () => {
    setIsExporting(true);
    try {
      const downloadUrl = getQuizPdfExportUrl(quiz.share_code, {
        chapter: selectedChapter,
        schoolName,
        examDuration,
        includeAnswers,
        includeExplanations,
        twoColumnOptions
      });

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `De_Thi_${quiz.title || 'trac_nghiem'}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      handleBrowserPrint();
    } finally {
      setTimeout(() => {
        setIsExporting(false);
      }, 1500);
    }
  };

  const handleBrowserPrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Vui lòng cho phép popup trình duyệt để mở cửa sổ in ấn / lưu PDF.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${quiz.title} - Đề thi trắc nghiệm</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A4 portrait;
              margin: 15mm 15mm 15mm 15mm;
            }
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Times New Roman', Times, serif, Arial, sans-serif;
              color: #111827;
              background: #fff;
              line-height: 1.45;
              font-size: 13pt;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
            }
            .header-table td {
              vertical-align: top;
            }
            .title {
              text-align: center;
              font-size: 15pt;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .subtitle {
              text-align: center;
              font-size: 11pt;
              font-style: italic;
              margin-bottom: 12px;
            }
            .divider {
              border-bottom: 1.5px solid #000;
              margin: 12px 0 18px 0;
            }
            .question-item {
              margin-bottom: 14px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .question-title {
              font-weight: bold;
              margin-bottom: 4px;
            }
            .options-grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              column-gap: 20px;
              row-gap: 4px;
            }
            .options-grid-1 {
              display: flex;
              flex-direction: column;
              gap: 4px;
            }
            .option-text {
              margin-bottom: 2px;
            }
            .option-highlight {
              font-weight: bold;
              text-decoration: underline;
              color: #047857;
            }
            .explanation-box {
              margin-top: 5px;
              padding: 6px 10px;
              background-color: #f3f4f6;
              border-left: 3px solid #6b7280;
              font-size: 10.5pt;
              font-style: italic;
            }
            .answer-key-table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 25px;
              break-inside: avoid;
              page-break-inside: avoid;
            }
            .answer-key-table th, .answer-key-table td {
              border: 1px solid #000;
              padding: 5px 6px;
              text-align: center;
              font-size: 10.5pt;
            }
            .answer-key-table th {
              background-color: #e5e7eb;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                Xuất Đề Thi Ra File PDF / In Ấn
              </h2>
              <p className="text-xs text-slate-500">Tùy chọn xuất toàn bộ câu hỏi hoặc lọc theo từng bài cụ thể</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two columns layout */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls Form (5 cols) */}
          <div className="lg:col-span-5 space-y-4 pr-0 sm:pr-2">
            
            {/* Chapter Picker */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Phạm vi xuất đề:</span>
              </label>
              <select
                value={selectedChapter}
                onChange={(e) => setSelectedChapter(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="all">🌟 Tất cả các bài ({allQuestions.length} câu hỏi)</option>
                {chapterNames.map((chName) => {
                  const count = allQuestions.filter(q => (q.chapter || 'Bài 1') === chName).length;
                  return (
                    <option key={chName} value={chName}>
                      {chName} ({count} câu)
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Title / School Header */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Đơn vị / Tiêu đề:
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  placeholder="VD: TRƯỜNG ĐẠI HỌC..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Thời gian làm bài:
                </label>
                <input
                  type="text"
                  value={examDuration}
                  onChange={(e) => setExamDuration(e.target.value)}
                  placeholder="VD: 45 phút"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Answer Display Option */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Tùy chọn Đáp án:
              </label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <input
                    type="radio"
                    name="ans_mode"
                    checked={includeAnswers === 'bottom_table'}
                    onChange={() => setIncludeAnswers('bottom_table')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Bảng đáp án tổng hợp ở cuối đề (Chuẩn đề thi)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <input
                    type="radio"
                    name="ans_mode"
                    checked={includeAnswers === 'highlight'}
                    onChange={() => setIncludeAnswers('highlight')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Khoanh sẵn đáp án đúng (Dùng để ôn tập)</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700">
                  <input
                    type="radio"
                    name="ans_mode"
                    checked={includeAnswers === 'none'}
                    onChange={() => setIncludeAnswers('none')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Không kèm đáp án (Đề phát cho học sinh làm)</span>
                </label>
              </div>
            </div>

            {/* Explanation & Layout Options */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeExplanations}
                  onChange={(e) => setIncludeExplanations(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>In kèm lời giải thích chi tiết dưới mỗi câu</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={twoColumnOptions}
                  onChange={(e) => setTwoColumnOptions(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Chia 4 đáp án A/B, C/D thành 2 cột (Tiết kiệm giấy)</span>
              </label>
            </div>

            {/* Export Action Buttons */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <button
                type="button"
                disabled={isExporting || filteredQuestions.length === 0}
                onClick={handleDownloadPdf}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm shadow-md shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isExporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang tải file PDF xuống...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Tải về file PDF ({filteredQuestions.length} câu)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleBrowserPrint}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>In ấn trực tiếp (A4)</span>
              </button>
            </div>

          </div>

          {/* Live Preview Paper (7 cols) */}
          <div className="lg:col-span-7 bg-slate-100 dark:bg-slate-950/70 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-y-auto max-h-[500px]">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Xem trước bản in A4 ({filteredQuestions.length} câu)</span>
              <span className="font-mono text-indigo-500">Trang A4</span>
            </div>

            {/* Printable Document Box */}
            <div
              ref={printRef}
              className="bg-white text-black p-6 sm:p-8 rounded-lg shadow-sm text-[12px] sm:text-[13px] leading-relaxed"
              style={{ minHeight: '600px', color: '#111827', fontFamily: 'Arial, "Times New Roman", sans-serif' }}
            >
              {/* Header Info */}
              <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
                <div>
                  <div className="font-bold uppercase text-[11px] tracking-wide">{schoolName}</div>
                  <div className="font-bold uppercase text-sm mt-0.5 text-indigo-900">{quiz.title}</div>
                  {selectedChapter !== 'all' && (
                    <div className="text-xs font-semibold italic text-emerald-800 mt-0.5">
                      Chuyên đề: {selectedChapter}
                    </div>
                  )}
                </div>

                <div className="text-right text-[11px]">
                  <div><strong>Mã đề:</strong> {quiz.share_code}</div>
                  <div><strong>Thời gian:</strong> {examDuration}</div>
                  <div><strong>Số câu hỏi:</strong> {filteredQuestions.length} câu</div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                {filteredQuestions.map((q, idx) => {
                  const correct = (q.correct_answer || 'A').toUpperCase();
                  return (
                    <div key={q.id || idx} className="question-item">
                      <div className="font-bold mb-1">
                        Câu {idx + 1}: {q.content}
                      </div>

                      <div className={twoColumnOptions ? "grid grid-cols-2 gap-x-4 gap-y-1" : "space-y-1"}>
                        <div className={includeAnswers === 'highlight' && correct === 'A' ? "font-bold text-emerald-700 underline" : ""}>
                          <strong>A.</strong> {q.option_a}
                        </div>
                        <div className={includeAnswers === 'highlight' && correct === 'B' ? "font-bold text-emerald-700 underline" : ""}>
                          <strong>B.</strong> {q.option_b}
                        </div>
                        <div className={includeAnswers === 'highlight' && correct === 'C' ? "font-bold text-emerald-700 underline" : ""}>
                          <strong>C.</strong> {q.option_c}
                        </div>
                        <div className={includeAnswers === 'highlight' && correct === 'D' ? "font-bold text-emerald-700 underline" : ""}>
                          <strong>D.</strong> {q.option_d}
                        </div>
                      </div>

                      {includeExplanations && (
                        <div className="mt-1.5 p-2 bg-slate-50 border-l-2 border-slate-400 text-[11px] italic text-slate-700">
                          <strong>Giải thích:</strong> {q.explanation_a || q.explanation_b || q.explanation_c || q.explanation_d || 'Đáp án đúng theo chuẩn lý thuyết.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Answer Key Table at Bottom */}
              {includeAnswers === 'bottom_table' && filteredQuestions.length > 0 && (
                <div className="mt-8 pt-4 border-t-2 border-dashed border-slate-300">
                  <div className="font-bold text-center uppercase text-xs mb-2">BẢNG ĐÁP ÁN ĐỀ THI</div>
                  <table className="w-full border-collapse border border-black text-center text-xs">
                    <tbody>
                      {/* Split questions in chunks of 10 for clean table rows */}
                      {Array.from({ length: Math.ceil(filteredQuestions.length / 10) }).map((_, rIdx) => {
                        const rowQuestions = filteredQuestions.slice(rIdx * 10, rIdx * 10 + 10);
                        return (
                          <React.Fragment key={rIdx}>
                            <tr className="bg-slate-100 font-bold">
                              {rowQuestions.map((_, cIdx) => (
                                <td key={cIdx} className="border border-black p-1">
                                  {rIdx * 10 + cIdx + 1}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              {rowQuestions.map((q, cIdx) => (
                                <td key={cIdx} className="border border-black p-1 font-bold text-indigo-700">
                                  {(q.correct_answer || 'A').toUpperCase()}
                                </td>
                              ))}
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-8 text-center text-[10px] text-slate-400 italic">
                --- HẾT ---
              </div>

            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
