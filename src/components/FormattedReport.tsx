import React from 'react';
import {
  FileText,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Info,
  Radio,
} from 'lucide-react';

interface FormattedReportProps {
  report: string;
}

/**
 * Parses inline markdown tokens (**bold**, *italic*, `code`) using regex
 * and converts them to styled React elements.
 */
export function formatInlineMarkdown(text: string): React.ReactNode[] {
  if (!text) return [];

  // Match **bold**, *italic*, or `code` using regex
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)/g);

  return parts.map((part, index) => {
    // Bold matching: **text**
    if (/^\*\*[^*]+?\*\*$/.test(part)) {
      const inner = part.replace(/^\*\*|\*\*$/g, '');
      return (
        <strong key={index} className="text-white font-bold tracking-tight">
          {inner}
        </strong>
      );
    }

    // Italic matching: *text*
    if (/^\*[^*]+?\*$/.test(part)) {
      const inner = part.replace(/^\*|\*$/g, '');
      return (
        <em key={index} className="text-[#94A3B8] italic font-normal">
          {inner}
        </em>
      );
    }

    // Monospace code matching: `code`
    if (/^`[^`]+?`$/.test(part)) {
      const inner = part.replace(/^`|`$/g, '');
      return (
        <code
          key={index}
          className="font-mono text-[11px] text-[#5FE38A] bg-white/[0.08] px-1.5 py-0.5 rounded border border-white/[0.06]"
        >
          {inner}
        </code>
      );
    }

    // Normal text
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

/**
 * Cleans any raw markdown asterisks or hashes from string using regex
 */
export function cleanMarkdownRaw(text: string): string {
  return text
    .replace(/^#{1,6}\s*/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

export function FormattedReport({ report }: FormattedReportProps) {
  if (!report) return null;

  const lines = report.split('\n');

  return (
    <div className="space-y-2 text-xs leading-relaxed text-[#CBD5E1]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line spacer
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />;
        }

        // Horizontal separator line: --, ---, ___
        if (/^[-—_]{2,}\s*$/.test(trimmed)) {
          return (
            <div
              key={idx}
              className="my-3 border-t border-white/[0.08] shadow-[0_1px_0_rgba(255,255,255,0.02)]"
            />
          );
        }

        // Heading 1 & 2: # or ##
        const h12Match = trimmed.match(/^#{1,2}\s+(.*)$/);
        if (h12Match) {
          const title = cleanMarkdownRaw(h12Match[1]);
          return (
            <div
              key={idx}
              className="pt-3 pb-1 border-b border-white/[0.1] flex items-center gap-2 text-white font-extrabold text-sm tracking-wide"
            >
              <ShieldAlert size={15} className="text-[#5FE38A] shrink-0" />
              <span>{title}</span>
            </div>
          );
        }

        // Heading 3: ### (Often the Dossier Banner)
        const h3Match = trimmed.match(/^#{3}\s+(.*)$/);
        if (h3Match) {
          const title = cleanMarkdownRaw(h3Match[1]);
          return (
            <div
              key={idx}
              className="p-3 my-2 rounded-lg bg-gradient-to-r from-[#5FE38A]/15 via-[#5BC0BE]/10 to-transparent border-l-4 border-[#5FE38A] border-t border-r border-b border-white/[0.08]"
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[#5FE38A] shrink-0" />
                <span className="text-xs font-mono font-bold text-white tracking-wider uppercase">
                  {title}
                </span>
              </div>
            </div>
          );
        }

        // Heading 4 & 5 & 6: ####
        const h4Match = trimmed.match(/^#{4,6}\s+(.*)$/);
        if (h4Match) {
          const title = cleanMarkdownRaw(h4Match[1]);
          return (
            <div
              key={idx}
              className="pt-2.5 pb-0.5 flex items-center gap-1.5 text-xs font-bold text-[#5BC0BE] uppercase tracking-wider"
            >
              <ChevronRight size={13} className="text-[#5FE38A] shrink-0" />
              <span>{title}</span>
            </div>
          );
        }

        // Key-Value Pair Line: **KEY:** VALUE
        const kvMatch = trimmed.match(/^(\*\*[^*:]+?:\*\*|[A-Z0-9\s_-]{3,}:)\s*(.*)$/);
        if (kvMatch) {
          const rawKey = kvMatch[1].replace(/\*\*/g, '').replace(/:$/, '').trim();
          const rawVal = kvMatch[2].trim();

          const isUrgent = /urgent|critical|high severity|emergency|hazard/i.test(rawVal);
          const isSpillType = /oil spill|radar|synthetic aperture|sar/i.test(rawVal);

          return (
            <div
              key={idx}
              className="flex flex-wrap sm:flex-nowrap items-baseline gap-2 py-1 px-2.5 rounded bg-white/[0.02] border border-white/[0.04]"
            >
              <span className="font-mono text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider min-w-[110px] shrink-0">
                {rawKey}:
              </span>
              <div className="flex-1 min-w-0">
                {isUrgent ? (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 animate-pulse">
                    <AlertTriangle size={11} />
                    {cleanMarkdownRaw(rawVal)}
                  </span>
                ) : isSpillType ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-[#5BC0BE]/15 text-[#5BC0BE] border border-[#5BC0BE]/30 font-mono">
                    <Radio size={11} />
                    {cleanMarkdownRaw(rawVal)}
                  </span>
                ) : (
                  <span className="text-white text-xs">{formatInlineMarkdown(rawVal)}</span>
                )}
              </div>
            </div>
          );
        }

        // Bullet point: - item or * item or • item
        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="text-[#5FE38A] text-xs font-bold select-none leading-5">•</span>
              <div className="text-xs text-[#CBD5E1] leading-relaxed">
                {formatInlineMarkdown(bulletMatch[1])}
              </div>
            </div>
          );
        }

        // Numbered list: 1. item or 1) item
        const numberedMatch = trimmed.match(/^(\d+[\.\)])\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="font-mono text-[11px] font-bold text-[#5BC0BE] select-none leading-5 min-w-[18px]">
                {numberedMatch[1]}
              </span>
              <div className="text-xs text-[#CBD5E1] leading-relaxed">
                {formatInlineMarkdown(numberedMatch[2])}
              </div>
            </div>
          );
        }

        // Regular paragraph text
        return (
          <p key={idx} className="text-xs text-[#CBD5E1] leading-relaxed font-sans">
            {formatInlineMarkdown(trimmed)}
          </p>
        );
      })}
    </div>
  );
}
