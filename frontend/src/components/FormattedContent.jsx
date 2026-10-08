import React, { useState } from 'react';
import { Copy, Check, Code2 } from 'lucide-react';

// Lightweight token-based syntax highlighter for Python / JS / SQL code
function highlightCode(codeStr) {
  if (!codeStr) return '';

  // Escape HTML entities first
  const escaped = codeStr
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Regex patterns
  const patterns = [
    // Comments (# or //)
    {
      regex: /(#.*?$|\/\/.*?$)/gm,
      cls: 'text-slate-400 dark:text-slate-500 italic'
    },
    // Strings ('...' or "..." or `...`)
    {
      regex: /("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g,
      cls: 'text-amber-500 dark:text-amber-400 font-normal'
    },
    // Python & JS Keywords
    {
      regex: /\b(def|class|return|import|from|if|elif|else|for|while|in|try|except|finally|with|as|lambda|yield|pass|break|continue|raise|is|not|and|or|async|await|const|let|var|function|new|switch|case|default|typeof|instanceof|void|SELECT|FROM|WHERE|INSERT|INTO|UPDATE|DELETE|GROUP|BY|ORDER|JOIN|LEFT|RIGHT|INNER|ON|CREATE|TABLE|DROP|ALTER|PRIMARY|KEY)\b/g,
      cls: 'text-purple-600 dark:text-purple-400 font-bold'
    },
    // Builtins & Booleans / None
    {
      regex: /\b(True|False|None|null|undefined|true|false|self|this)\b/g,
      cls: 'text-rose-500 dark:text-rose-400 font-bold'
    },
    // Common built-in functions
    {
      regex: /\b(print|len|range|enumerate|zip|append|extend|pop|get|items|keys|values|sum|min|max|sorted|type|isinstance|int|float|str|list|dict|set|tuple|open|input|map|filter|console\.log)\b/g,
      cls: 'text-sky-600 dark:text-sky-400 font-semibold'
    },
    // Numbers
    {
      regex: /\b(\d+(?:\.\d+)?)\b/g,
      cls: 'text-emerald-600 dark:text-emerald-400'
    }
  ];

  // We split text into safe highlighted chunks using token replacement
  let tokens = [];
  let tokenized = escaped;

  patterns.forEach(({ regex, cls }) => {
    tokenized = tokenized.replace(regex, (match) => {
      const id = `___TOK${tokens.length}___`;
      tokens.push(`<span class="${cls}">${match}</span>`);
      return id;
    });
  });

  // Restore tokens
  tokens.forEach((html, i) => {
    tokenized = tokenized.replace(new RegExp(`___TOK${i}___`, 'g'), html);
  });

  return tokenized;
}

// Multi-line code block component
function CodeBlock({ code, language = 'python' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightedHtml = highlightCode(code.trim());

  return (
    <div className="my-2.5 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900 shadow-md text-left text-xs sm:text-sm font-mono select-text">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/90 border-b border-slate-700/60 text-[11px] text-slate-300 font-sans">
        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
          <Code2 className="w-3.5 h-3.5" />
          <span>{language || 'Code'}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          title="Sao chép mã nguồn"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Đã chép' : 'Chép code'}</span>
        </button>
      </div>

      {/* Code Body */}
      <div className="p-3.5 overflow-x-auto text-slate-100 leading-relaxed whitespace-pre font-mono">
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </div>
    </div>
  );
}

// Inline code badge
function InlineCode({ code }) {
  return (
    <code className="font-mono text-[0.88em] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-lg border border-slate-200/90 dark:border-slate-700/80 font-bold mx-0.5 select-text inline-block align-baseline whitespace-pre-wrap">
      {code}
    </code>
  );
}

/**
 * FormattedContent component:
 * Parses text and intelligently renders code blocks (fenced ```), inline code (`...`),
 * and regular formatted text.
 */
export default function FormattedContent({ text, className = '' }) {
  if (!text) return null;

  if (typeof text !== 'string') {
    return <span className={className}>{String(text)}</span>;
  }

  // 1. Check for fenced code blocks: ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    parts.push({
      type: 'code_block',
      language: match[1] || 'code',
      content: match[2]
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  // Helper to parse inline backticks in text segments
  const renderTextSegment = (str, partIdx) => {
    // Check if the string has inline backticks: `code`
    if (!str.includes('`')) {
      // Check if the text contains code-like structure with newlines (heuristic)
      return <span key={partIdx}>{str}</span>;
    }

    const inlineParts = [];
    const inlineRegex = /`([^`]+)`/g;
    let inlineLastIndex = 0;
    let inlineMatch;

    while ((inlineMatch = inlineRegex.exec(str)) !== null) {
      if (inlineMatch.index > inlineLastIndex) {
        inlineParts.push(str.slice(inlineLastIndex, inlineMatch.index));
      }
      inlineParts.push(
        <InlineCode key={`inline-${inlineMatch.index}`} code={inlineMatch[1]} />
      );
      inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
    }

    if (inlineLastIndex < str.length) {
      inlineParts.push(str.slice(inlineLastIndex));
    }

    return <span key={partIdx}>{inlineParts}</span>;
  };

  return (
    <span className={className}>
      {parts.map((part, idx) => {
        if (part.type === 'code_block') {
          return <CodeBlock key={`block-${idx}`} code={part.content} language={part.language} />;
        }
        return renderTextSegment(part.content, idx);
      })}
    </span>
  );
}
