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
    <div className={`prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-100 font-sans leading-relaxed text-sm ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
        components={{
          h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-4 mb-2 tracking-tight text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2" {...props} />,
          h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-4 mb-2 tracking-tight text-slate-900 dark:text-white" {...props} />,
          h3: ({ node, ...props }) => <h3 className="text-base font-bold mt-3 mb-1.5 tracking-tight text-blue-600 dark:text-blue-400" {...props} />,
          h4: ({ node, ...props }) => <h4 className="text-sm font-semibold mt-2 mb-1 text-slate-800 dark:text-slate-200" {...props} />,
          p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-slate-700 dark:text-slate-300" {...props} />,
          ul: ({ node, ...props }) => <ul className="list-disc list-inside space-y-1 mb-3 text-slate-700 dark:text-slate-300" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-slate-700 dark:text-slate-300" {...props} />,
          li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
          strong: ({ node, ...props }) => <strong className="font-semibold text-slate-900 dark:text-white" {...props} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className="border-l-4 border-blue-500 pl-3 py-1 my-2 italic text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-r-lg" {...props} />
          ),
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            if (isInline) {
              return (
                <code className="bg-slate-100 dark:bg-slate-800 text-pink-600 dark:text-pink-400 px-1.5 py-0.5 rounded text-[13px] font-mono" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-slate-900 text-slate-100 p-3.5 rounded-xl overflow-x-auto text-xs font-mono my-3 border border-slate-800">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-800 rounded-lg" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="bg-slate-100 dark:bg-slate-800 p-2 font-semibold text-xs border-b border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="p-2 text-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300" {...props} />
          )
        }}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>
  );
};
