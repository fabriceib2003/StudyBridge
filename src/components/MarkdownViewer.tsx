import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, className = '' }) => {
  // Normalize unicode dashes (en-dash, em-dash, unicode minus) that LLMs sometimes put inside LaTeX math
  const cleanContent = React.useMemo(() => {
    if (!content) return '';
    let res = content.replace(/\$([^\n$]+)\$|\$\$([^\n$]+)\$\$/g, (match) => {
      return match.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
    });
    // Restore carriage return corruption where \rho was decoded to \r + ho
    res = res.replace(/\r([a-zA-Z]+)/g, '\\$1');
    // Restore mangled (ho) where \rho was stripped or parsed as ho
    res = res.replace(/\(\s*ho\s*\)/g, '($\\rho$)');
    res = res.replace(/\$ho\$/g, '$\\rho$');
    res = res.replace(/(density\s*(?:\([^\)]*\))?\s*(?:,|and|is|of)?\s*)\(?ho\)?/gi, '$1($\\rho$)');
    return res;
  }, [content]);

  return (
    <div className={`max-w-none text-[var(--text)] font-sans leading-relaxed text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 tracking-tight text-[var(--text)] border-b border-[var(--border)] pb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2 tracking-tight text-[var(--text)]" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-3 mb-1.5 tracking-tight text-[var(--primary-accent)]" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-[var(--text)]" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-[var(--text-secondary)]" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 mb-3 text-[var(--text-secondary)]" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-[var(--text-secondary)]" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-[var(--text)]" {...props} />,
          a: ({ node, ...props }) => <a className="text-[var(--primary-accent)] hover:underline font-medium" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-[var(--primary)] pl-3 py-1 my-2 italic text-[var(--muted)] bg-[var(--surface-raised)] rounded-r-lg" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            if (isInline) {
              return (
                <code className="bg-[var(--code-inline-bg)] text-[var(--code-inline-text)] px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-[var(--code-block-bg)] text-[var(--code-block-text)] p-3.5 rounded-xl overflow-x-auto text-xs font-mono my-3 border border-[var(--border)]">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-left border-collapse border border-[var(--border)] rounded-lg" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-[var(--table-header-bg)] p-2 font-semibold text-xs border-b border-[var(--border)] text-[var(--text)]" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-2 text-xs border-b border-[var(--border-subtle)] text-[var(--text-secondary)]" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-[var(--table-row-hover)] transition-colors" {...props} />
          )
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};
