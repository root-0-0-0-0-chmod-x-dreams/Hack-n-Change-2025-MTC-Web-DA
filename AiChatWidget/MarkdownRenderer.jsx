// MarkdownRenderer.jsx
import React from 'react';

export const MarkdownRenderer = ({ content }) => {
  if (!content) return null;

  const parseInline = (text) => {
    // Экранируем HTML
    text = text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
    
    // Жирный текст **text**
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Курсив *text*
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Курсив _text_
    text = text.replace(/\b_([^_]+)_\b/g, '<em>$1</em>');
    
    // Код `code`
    text = text.replace(/`([^`]+)`/g, 'de>$1</code>');
    
    // Ссылки [text](url)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    return text;
  };

  const lines = content.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null;

  const flushList = () => {
    if (listItems.length > 0) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={`list-${elements.length}`}>
          {listItems.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // Заголовки
    if (trimmed.startsWith('#### ')) {
      flushList();
      elements.push(<h4 key={index}>{trimmed.slice(5)}</h4>);
    } else if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={index}>{trimmed.slice(4)}</h3>);
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={index}>{trimmed.slice(3)}</h2>);
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={index}>{trimmed.slice(2)}</h1>);
    }
    // Нумерованный список
    else if (/^\d+\.\s/.test(trimmed)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(trimmed.replace(/^\d+\.\s/, ''));
    }
    // Маркированный список
    else if (/^[-*]\s/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(trimmed.replace(/^[-*]\s/, ''));
    }
    // Горизонтальная линия
    else if (trimmed === '---' || trimmed === '***') {
      flushList();
      elements.push(<hr key={index} />);
    }
    // Пустая строка
    else if (trimmed === '') {
      flushList();
      if (elements.length > 0) {
        elements.push(<br key={`br-${index}`} />);
      }
    }
    // Обычный текст
    else {
      flushList();
      elements.push(
        <p key={index} dangerouslySetInnerHTML={{ __html: parseInline(line) }} />
      );
    }
  });

  flushList();

  return <div className="markdown-content">{elements}</div>;
};
