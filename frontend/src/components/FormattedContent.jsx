import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import Prism from 'prismjs';
import { Copy, Check, Code2, Terminal, ZoomIn, X, ExternalLink } from 'lucide-react';

// Load Prism language components
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-typescript';

/**
 * Maps common language aliases to Prism supported languages
 */
const LANGUAGE_MAP = {
  py: 'python',
  python: 'python',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cs: 'csharp',
  csharp: 'csharp',
  java: 'java',
  sql: 'sql',
  html: 'markup',
  xml: 'markup',
  css: 'css',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  json: 'json'
};

/**
 * Automatically detects language from code content when not explicitly specified
 */
function detectLanguage(codeStr) {
  if (!codeStr) return 'python';
  if (/^#include|std::|cout\s*<<|cin\s*>>/m.test(codeStr)) return 'cpp';
  if (/public\s+class|public\s+static\s+void|System\.out\.print/m.test(codeStr)) return 'java';
  if (/\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|CREATE\s+TABLE)\b/i.test(codeStr)) return 'sql';
  if (/\b(const|let|var|function|console\.log|=>)\b/.test(codeStr)) return 'javascript';
  if (/\b(def|elif|import|self|print|len|range|lambda)\b/.test(codeStr) || /[a-zA-Z_]\w*\s*=\s*[\{\[\(]/.test(codeStr)) return 'python';
  return 'python';
}

/**
 * Syntax-highlighter with Prism
 */
function highlightCode(code, lang) {
  if (!code) return '';
  const normalized = (lang || '').toLowerCase();
  const targetLang = LANGUAGE_MAP[normalized] || detectLanguage(code);
  const grammar = Prism.languages[targetLang] || Prism.languages.python || Prism.languages.clike;

  try {
    return Prism.highlight(code, grammar, targetLang);
  } catch (err) {
    // Safe HTML escape fallback
    return code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

/**
 * Modern dark-themed code block with language badge, copy button, and optional line numbers
 */
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  const cleanCode = code ? code.replace(/\r\n/g, '\n').trimEnd() : '';
  const detectedLang = language || detectLanguage(cleanCode);
  const displayLang = (LANGUAGE_MAP[detectedLang] || detectedLang).toUpperCase();

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedHtml = highlightCode(cleanCode, detectedLang);
  const lines = cleanCode.split('\n');
  const showLineNumbers = lines.length > 2;

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-slate-700/80 bg-[#16181d] shadow-lg text-left select-text group/code transition-all">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1e222a] border-b border-slate-700/60 text-xs text-slate-300 select-none">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-indigo-400 font-mono text-[11px]">
          {detectedLang === 'bash' || detectedLang === 'sh' ? (
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
          )}
          <span>{displayLang}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-[11px] font-sans font-medium border border-slate-700/50"
          title="Sao chép đoạn mã"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">Đã chép</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span>Chép code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className="p-3.5 overflow-x-auto text-[13px] sm:text-sm font-mono leading-relaxed text-slate-100 flex">
        {showLineNumbers && (
          <div className="select-none pr-3 mr-3 border-r border-slate-800 text-slate-600 text-right font-mono text-[12px] leading-relaxed">
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        )}
        <div className="flex-1 whitespace-pre overflow-x-auto font-mono">
          <code
            className={`language-${detectedLang}`}
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Intelligent text preprocessor:
 * 1. Normalizes LaTeX expressions: \(...\) -> $...$, \[...\] -> $$...$$, trims spaces inside $...$, and wraps environments
 * 2. Detects raw multiline & single-line programming code blocks, preserves continuation and indented lines
 * 3. Formats fill-in-the-blank tokens (e.g. (1) for · (2) in) and short code choices in compact mode
 */
function preprocessContent(rawText, compact = false) {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Normalize LaTeX delimiters
  // Convert escaped \( ... \) or raw \( ... \) to $ ... $
  text = text.replace(/\\\\?\((.*?)\\\\?\)/gs, (_, eq) => `$${eq.trim()}$`);
  // Convert escaped \[ ... \] or raw \[ ... \] to $$ ... $$
  text = text.replace(/\\\\?\[([\s\S]*?)\\\\?\]/gs, (_, eq) => `\n\n$$\n${eq.trim()}\n$$\n\n`);

  // Trim spaces inside $ ... $ so remark-math does not treat it as literal string
  text = text.replace(/(?<!\$)\$(?!\$)\s*([^\$\n]+?)\s*\$(?!\$)/g, (_, eq) => `$${eq.trim()}$`);

  // Wrap stand-alone LaTeX environments (aligned, cases, matrix, pmatrix) if not yet wrapped
  text = text.replace(/(?<!\$)\s*(\\begin\{(?:aligned|matrix|cases|pmatrix|bmatrix|vmatrix)\}[\s\S]*?\\end\{(?:aligned|matrix|cases|pmatrix|bmatrix|vmatrix)\})\s*(?!\$)/g, '\n\n$$\n$1\n$$\n\n');

  // Convert legacy [IMAGE_URL: ...] tags to Markdown image
  text = text.replace(/\[IMAGE_URL:\s*([^\]]+)\]/gi, '\n\n![]($1)\n\n');

  // If text already has code fences, return normalized math
  if (text.includes('```')) {
    return text;
  }

  // 2. Compact mode (e.g. Question options or short inline snippets)
  if (compact) {
    const trimmed = text.trim();
    // shortcut: handles standard "·" or "/" separator for blanks; upgrade if user introduces custom delimiters
    if (/^\(?\d+\)?\s*[\w\:\<\>\=\+\-\*\/\%]+\s*·/.test(trimmed)) {
      return trimmed.split(/\s*·\s*/).map(part => {
        return part.replace(/(\(?\d+\)?\s*)(.*)/, (_, num, token) => `${num}\`${token}\``);
      }).join(' · ');
    }
    // Single line code options (e.g. range(1, 6), [1, 2, 3], print('x'), x = 5)
    if (!trimmed.includes('\n') && !trimmed.startsWith('$') && !trimmed.startsWith('`')) {
      if (/^(def\s+|class\s+|print\s*\(|range\s*\(|len\s*\(|[a-zA-Z_]\w*\s*[\+\-\*\/\%]?=|[\[\{\(].*[\]\}\)]|continue$|break$|pass$|finally:$|except:?$|else:$|elif\s+)/.test(trimmed)) {
        return `\`${trimmed}\``;
      }
    }
    return text;
  }

  // 3. Multi-line code block detection
  const lines = text.split('\n');
  if (lines.length === 1) {
    const trimmed = text.trim();
    if (!trimmed.startsWith('$') && !trimmed.startsWith('`')) {
      if (/^(def\s+|class\s+|print\s*\(|range\s*\(|[a-zA-Z_]\w*\s*[\+\-\*\/\%]?=|[\[\{].*[\]\}])/.test(trimmed) && !trimmed.endsWith('?') && !trimmed.endsWith(':')) {
        const lang = detectLanguage(trimmed);
        return `\`\`\`${lang}\n` + trimmed + '\n```';
      }
    }
    return text;
  }

  const isExplicitCodeLine = (l) => {
    const trimmed = l.trim();
    if (!trimmed) return null; // empty line
    // Comments
    if (/^(#|\/\/|\/\*)/.test(trimmed)) return true;
    // Keywords / statements
    if (/^(def\s+|class\s+|import\s+|from\s+|for\s+|while\s+|if\s+|elif\s+|else:|return\b|yield\b|raise\b|try:|except\b|finally:|break$|continue$|pass$|print\s*\(|console\.log|#include|public\s+|private\s+|int\s+|float\s+|double\s+|char\s+|SELECT\s+)/i.test(trimmed)) return true;
    // Assignments: x = ..., total += ..., arr[i] = ...
    if (/^[a-zA-Z_]\w*(\[[^\]]*\])?\s*(\+|-|\*|\/|%|\/\/|&|\||\^)?=\s*/.test(trimmed)) return true;
    // Standalone function calls or methods
    if (/^[a-zA-Z_]\w*\s*\(.*\)\s*;?$/.test(trimmed)) return true;
    if (/\b(\.append|\.extend|\.split|\.join|\.issubset|len\(|range\()/.test(trimmed)) return true;
    if (/^[{}();\[\]]+$/.test(trimmed)) return true;
    return false;
  };

  let inCode = false;
  let codeChunk = [];
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const explicit = isExplicitCodeLine(line);
    const isIndented = line.startsWith('  ') || line.startsWith('\t');

    // While in code, indented lines, operators or continuation lines belong to the code block
    const isCode = inCode 
      ? (explicit === true || (explicit === null && i + 1 < lines.length && (isExplicitCodeLine(lines[i + 1]) || lines[i + 1].startsWith(' '))) || isIndented)
      : (explicit === true && !trimmed.endsWith('?'));

    if (isCode) {
      inCode = true;
      codeChunk.push(line);
    } else {
      if (inCode && codeChunk.length > 0) {
        const lang = detectLanguage(codeChunk.join('\n'));
        newLines.push(`\`\`\`${lang}\n` + codeChunk.join('\n').trimEnd() + '\n```');
        codeChunk = [];
        inCode = false;
      }
      newLines.push(line);
    }
  }

  if (inCode && codeChunk.length > 0) {
    const lang = detectLanguage(codeChunk.join('\n'));
    newLines.push(`\`\`\`${lang}\n` + codeChunk.join('\n').trimEnd() + '\n```');
  }

  return newLines.join('\n');
}

/**
 * Clickable Image with Lightbox Zoom
 */
function ImageCard({ src, alt }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!src) return null;

  return (
    <>
      <div className="my-3 inline-block group relative cursor-pointer" onClick={() => setIsOpen(true)}>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shadow-sm transition hover:shadow-md hover:border-indigo-400">
          <img
            src={src}
            alt={alt || "Hình minh hoạ câu hỏi"}
            className="max-h-64 max-w-full sm:max-w-md object-contain rounded-2xl mx-auto block"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white font-medium text-xs backdrop-blur-[1px]">
            <ZoomIn className="w-4 h-4" />
            <span>Xem cỡ lớn</span>
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-2xl border border-slate-700/50 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 px-2 border-b border-slate-200 dark:border-slate-800 mb-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Hình ảnh minh hoạ câu hỏi
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-400 hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Mở tab mới"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[78vh] flex items-center justify-center">
              <img
                src={src}
                alt={alt || "Hình minh hoạ"}
                className="max-h-full max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Universal FormattedContent Component:
 * - Renders rich Markdown (lists, tables, bold, blockquotes)
 * - Renders LaTeX mathematical formulas via KaTeX ($inline$ and $$block$$)
 * - Renders programming code blocks with PrismJS syntax highlighting, copy button, line numbers
 * - Renders question illustration images with interactive lightbox
 */
export default function FormattedContent({ text, content, imageUrl = null, className = '', compact = false }) {
  const actualText = text ?? content;
  if (!actualText && !imageUrl) return null;

  const rawText = typeof actualText === 'string' ? actualText : String(actualText);
  const processedText = useMemo(() => preprocessContent(rawText, compact), [rawText, compact]);

  // Check if text already has the image to prevent duplicate rendering
  const textHasImage = imageUrl && (rawText.includes(imageUrl) || processedText.includes(imageUrl));

  return (
    <div className={`formatted-content ${className} ${compact ? 'inline-block align-baseline' : ''}`}>
      {imageUrl && !textHasImage && (
        <div className="mb-3">
          <ImageCard src={imageUrl} alt="Hình minh hoạ câu hỏi" />
        </div>
      )}

      {processedText && (
        <ReactMarkdown
          remarkPlugins={[remarkMath, remarkGfm]}
          rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
          components={{
            img({ src, alt }) {
              return <ImageCard src={src} alt={alt} />;
            },
            code({ node, inline, className: codeClassName, children, ...props }) {
              const match = /language-(\w+)/.exec(codeClassName || '');
              const codeString = String(children).replace(/\n$/, '');

              if (!inline && (match || codeString.includes('\n'))) {
                return (
                  <CodeBlock
                    code={codeString}
                    language={match ? match[1] : undefined}
                  />
                );
              }

              return (
                <code
                  className="font-mono text-[0.88em] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-lg border border-slate-200/90 dark:border-slate-700/80 font-bold mx-0.5 select-text inline-block align-baseline whitespace-pre-wrap"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            p({ children }) {
              if (compact) {
                return <span className="inline leading-relaxed">{children}</span>;
              }
              return <p className="mb-2 last:mb-0 leading-relaxed text-inherit">{children}</p>;
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                    {children}
                  </table>
                </div>
              );
            },
            th({ children }) {
              return (
                <th className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800/90 font-bold text-left text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                  {children}
                </th>
              );
            },
            td({ children }) {
              return (
                <td className="px-3.5 py-2 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                  {children}
                </td>
              );
            },
            ul({ children }) {
              return <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>;
            },
            ol({ children }) {
              return <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>;
            },
            li({ children }) {
              return <li className="leading-relaxed">{children}</li>;
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-4 border-indigo-500 pl-3 my-2 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 py-1 rounded-r">
                  {children}
                </blockquote>
              );
            }
          }}
        >
          {processedText}
        </ReactMarkdown>
      )}
    </div>
  );
}
