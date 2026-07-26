import { Fragment, type ReactNode } from 'react';

export function renderFormattedText(text: string): ReactNode {
  return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
    const boldMatch = part.match(/^\*\*(.*?)\*\*$/);
    if (boldMatch) {
      return <strong key={index}>{boldMatch[1]}</strong>;
    }

    return <Fragment key={index}>{part}</Fragment>;
  });
}
