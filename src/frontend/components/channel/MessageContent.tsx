/** Markdown message body with @mention highlights (Slack-style). */

import {
  Children,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderMentionSpans } from '@/lib/mentionRender';

function injectMentions(children: ReactNode): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') return renderMentionSpans(child);
    if (isValidElement(child)) {
      const el = child as ReactElement<{ children?: ReactNode }>;
      if (el.props.children !== undefined) {
        return cloneElement(el, {}, injectMentions(el.props.children));
      }
    }
    return child;
  });
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 leading-normal last:mb-0">{injectMentions(children)}</p>
  ),
  ul: ({ children }) => <ul className="mb-2 list-disc pl-5 leading-normal">{children}</ul>,
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal pl-5 leading-normal">{children}</ol>
  ),
  li: ({ children }) => <li>{injectMentions(children)}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-2 border-l-4 border-slack-grey-light pl-3 text-slack-grey-dark">
      {injectMentions(children)}
    </blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      className="text-slack-blue underline hover:opacity-90"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ''}
      className="my-2 max-h-80 max-w-full rounded border border-slack-grey-light object-contain"
      loading="lazy"
    />
  ),
  strong: ({ children }) => <strong className="font-bold">{injectMentions(children)}</strong>,
  em: ({ children }) => <em className="italic">{injectMentions(children)}</em>,
  h1: ({ children }) => (
    <h1 className="mb-2 text-lg font-bold">{injectMentions(children)}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-2 text-base font-bold">{injectMentions(children)}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 text-sm font-bold">{injectMentions(children)}</h3>
  ),
  hr: () => <hr className="my-3 border-slack-grey-light" />,
  code: ({ className, children, ...props }) => {
    const fenced = typeof className === 'string' && className.includes('language-');
    if (fenced) {
      return (
        <code className={`block font-mono text-sm ${className ?? ''}`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code
        className="rounded bg-slack-grey-lighter px-1 py-0.5 font-mono text-sm text-slack-grey-darkest"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 mt-2 overflow-x-auto whitespace-pre rounded border border-slack-grey-light bg-slack-grey-lighter p-3 font-mono text-sm text-slack-grey-darkest">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="mb-2 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slack-grey-light bg-slack-grey-lighter px-2 py-1 text-left font-bold">
      {injectMentions(children)}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slack-grey-light px-2 py-1">{injectMentions(children)}</td>
  ),
};

export function MessageContent({ content }: { content: string }): React.ReactElement {
  const trimmed = content.trim();
  if (!trimmed) {
    return <div className="min-w-0 text-slack-grey italic">(empty message)</div>;
  }

  return (
    <div className="message-markdown min-w-0 break-words text-black [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
