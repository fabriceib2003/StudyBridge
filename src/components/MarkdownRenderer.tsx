import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`max-w-none text-[var(--text)] leading-relaxed font-sans ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text)] mt-6 mb-3 border-b border-[var(--border)] pb-2" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--primary-accent)] mt-5 mb-2.5 flex items-center gap-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base sm:text-lg font-semibold text-[var(--text)] mt-4 mb-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="my-2.5 text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 my-2.5 space-y-1 text-xs sm:text-sm text-[var(--text-secondary)]" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 my-2.5 space-y-1 text-xs sm:text-sm text-[var(--text-secondary)]" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-[var(--primary)] bg-[var(--primary-soft-bg)] px-4 py-2 my-3 rounded-r-xl text-xs sm:text-sm italic text-[var(--text-secondary)]" {...props} />
          ),
          code: ({ node, className, children, ...props }: any) => {
            const isInline = !className && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code className="bg-[var(--code-inline-bg)] text-[var(--code-inline-text)] px-1.5 py-0.5 rounded text-[11px] font-mono border border-[var(--border)]" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <div className="my-3 rounded-xl overflow-x-auto bg-[var(--code-block-bg)] text-[var(--code-block-text)] p-3.5 text-xs font-mono border border-[var(--border)]">
                <code className={className} {...props}>
                  {children}
                </code>
              </div>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 border border-[var(--border)] rounded-xl shadow-sm">
              <table className="w-full text-left text-xs border-collapse" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-[var(--table-header-bg)] px-3 py-2 font-semibold text-[var(--text)] border-b border-[var(--border)]" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="px-3 py-2 border-b border-[var(--border-subtle)] text-[var(--text-secondary)]" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-[var(--text)]" {...props} />
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
