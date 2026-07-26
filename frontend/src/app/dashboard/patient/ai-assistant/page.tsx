'use client';
import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Brain, Sparkles, Heart, Pill, Apple, HelpCircle } from 'lucide-react';
import { renderFormattedText } from '@/utils/renderFormattedText';

type Message = {
  sender: 'AI' | 'User';
  text: string;
  time: string;
};

const quickQuestions = [
  { icon: <Heart size={14} />, text: 'When is my next transfusion due?' },
  { icon: <Pill size={14} />, text: 'Chelation therapy side effects?' },
  { icon: <Apple size={14} />, text: 'Diet tips for thalassemia?' },
  { icon: <HelpCircle size={14} />, text: 'How to manage fatigue?' },
];

function getTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'AI', text: "Hello Rohan! 👋 I'm your ThalAI Health Assistant. I'm trained to help with thalassemia-related questions, transfusion reminders, medication guidance, and emotional support.\n\nFeel free to ask me anything, or use the quick questions below to get started!", time: '' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Set the initial timestamp only after hydration to avoid mismatch
  useEffect(() => {
    setMessages(prev => prev.map(m => m.time === '' ? { ...m, time: getTime() } : m));
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const now = getTime();
    setMessages(prev => [...prev, { sender: 'User', text, time: now }]);
    setInput('');
    setTyping(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      const reply = data.reply || data.message || data.response || 'I received your message. Please consult your hematologist for personalized medical advice.';
      const responseTime = getTime();
      setMessages(prev => [...prev, { sender: 'AI', text: reply, time: responseTime }]);
    } catch {
      const responseTime = getTime();
      setMessages(prev => [...prev, { sender: 'AI', text: 'AI assistant is temporarily unavailable. Please try again later.', time: responseTime }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-glow rounded-xl flex items-center justify-center text-red">
            <Brain size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">AI Health Assistant</h1>
            <div className="flex items-center gap-1.5 text-xs text-green font-medium">
              <span className="w-2 h-2 rounded-full bg-green animate-pulse"></span> Online · Powered by ThalAI
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="chip chip-blue"><Sparkles size={12} /> AI Powered</span>
        </div>
      </div>

      {/* Chat Area */}
      <div ref={chatRef} className="flex-1 overflow-y-auto bg-white border border-gray-100 rounded-2xl p-5 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 max-w-[80%] ${msg.sender === 'User' ? 'ml-auto flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-1 ${msg.sender === 'User' ? 'bg-blue-bg text-blue' : 'bg-red-glow text-red'}`}>
              {msg.sender === 'User' ? 'R' : 'AI'}
            </div>
            <div className="flex flex-col gap-1">
              <div className={`p-4 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap ${msg.sender === 'User' ? 'bg-red text-white rounded-br-sm' : 'bg-gray-50 text-gray-800 border border-gray-100 rounded-bl-sm'}`}>
                {renderFormattedText(msg.text)}
              </div>
              <span className={`text-[10px] font-medium ${msg.sender === 'User' ? 'text-right' : ''} text-gray-400`}>{msg.time}</span>
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-red-glow text-red flex items-center justify-center text-[11px] font-bold shrink-0">AI</div>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl rounded-bl-sm">
              <div className="typing"><span></span><span></span><span></span></div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Questions */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {quickQuestions.map((q, i) => (
          <button
            key={i}
            onClick={() => sendMessage(q.text)}
            className="flex items-center gap-1.5 bg-white border border-gray-200 hover:border-red/30 hover:bg-red-glow/20 px-3 py-2 rounded-xl text-[12px] text-gray-600 font-medium transition-colors"
          >
            {q.icon} {q.text}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Ask about thalassemia, diet, medications..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red transition-colors"
        />
        <button
          onClick={() => sendMessage(input)}
          className="w-11 h-11 bg-red text-white flex items-center justify-center rounded-xl hover:bg-red-dark transition-colors shrink-0"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  );
}
