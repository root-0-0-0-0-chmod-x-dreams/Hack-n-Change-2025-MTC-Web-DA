import React, { useState, useRef, useEffect } from 'react';
import { initializeWidget } from '@apitable/widget-sdk';
import { Setting } from './setting';
import { LLMService } from './llmService';
import { TableService } from './tableService';
import { MarkdownRenderer } from './MarkdownRenderer';
import './chat.css';


const llmService = new LLMService('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');
const tableService = new TableService('uskqPznSd4V1OhURQNBKeRU');


export const AiChatWidget = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tableData, setTableData] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const streamingContentRef = useRef('');


  useEffect(() => {
    loadTableData();
  }, []);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);


  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputMessage]);


  const loadTableData = async () => {
    try {
      const response = await tableService.fetchRecords({
        viewId: 'viwaiHmHTClHK',
        fieldKey: 'name'
      });
      
      if (response.success && response.data?.records) {
        setTableData(response.data.records);
        console.log('Данные таблицы загружены:', response.data.records);
      }
    } catch (error) {
      console.error('Ошибка загрузки данных таблицы:', error);
    }
  };


  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;


    const userMessage = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      role: 'user',
      timestamp: new Date()
    };


    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);


    const assistantMessageId = `assistant-${Date.now()}`;
    streamingContentRef.current = '';


    setMessages(prev => [...prev, {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date()
    }]);


    try {
      const messageHistory = messages.filter(m => m.role !== 'assistant' || m.content);
      
      let openrouterMessages = llmService.formatMessages(messageHistory, userMessage.content);
      
      if (tableData && tableData.length > 0) {
        const tableContext = tableService.formatRecordsForLLM(tableData);
        
        openrouterMessages = [
          {
            role: 'system',
            content: `У тебя есть доступ к следующим данным из таблицы. Используй их для ответа на вопросы пользователя:\n\n${tableContext}`
          },
          ...openrouterMessages
        ];
      }


      await llmService.sendMessage(openrouterMessages, (chunk) => {
        streamingContentRef.current += chunk;
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessageId 
              ? { ...msg, content: streamingContentRef.current }
              : msg
          )
        );
      }, {
        model: 'meta-llama/llama-4-maverick',
        stream: true,
        max_tokens: 2000,
        temperature: 0.7
      });


    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? { ...msg, content: 'Извините, произошла ошибка. Попробуйте снова.' }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      streamingContentRef.current = '';
    }
  };


  const handleKeyPress = e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div className="chat-container">
        <div className="messages-container">
          {messages.map((m) => (
            m.content ? (
              <div
                key={m.id}
                className={`message-bubble ${m.role === 'user' ? 'user-message' : 'bot-message'}`}
              >
                {m.role === 'assistant' ? (
                  <MarkdownRenderer content={m.content} />
                ) : (
                  m.content
                )}
              </div>
            ) : null
          ))}
          {isLoading && (
            <div className="typing-indicator">AI печатает...</div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-container">
          <textarea
            ref={textareaRef}
            className="message-input"
            placeholder="Сообщение"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            rows={1}
          />
          <button
            className="send-button"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            aria-label="Отправить сообщение"
          >
            <svg className="send-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 2L11 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
      <Setting />
    </div>
  );
};


initializeWidget(AiChatWidget, process.env.WIDGET_PACKAGE_ID);
