'use client';

import { useState } from 'react';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'ai', content: data.reply }]);
      } else {
        setMessages((prev) => [...prev, { role: 'ai', content: `Error: ${data.error}` }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'ai', content: 'Connection to AI server failed.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="w-80 sm:w-96 bg-white border border-gray-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all">
          <div className="bg-red-500 text-white px-4 py-3 flex justify-between items-center text-red bg-red">
            <h3 className="font-semibold text-white">ThalAI Support</h3>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-gray-200 p-1 font-bold text-xl">
              &times;
            </button>
          </div>
          
          <div className="flex-1 p-4 h-80 overflow-y-auto space-y-3 bg-gray-50 flex flex-col">
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm text-center my-auto">How can I help you today?</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.role === 'user' 
                  ? 'bg-red text-white' 
                  : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border text-sm text-gray-500 border-gray-200 rounded-2xl px-4 py-2 italic">
                  Typing...
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Ask me anything..."
              className="flex-1 px-3 py-2 text-sm bg-gray-100 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-red/50 text-gray-800"
            />
            <button 
              onClick={sendMessage}
              disabled={loading}
              className="px-4 py-2 bg-red text-white rounded-xl text-sm font-medium hover:bg-red/90 transition-colors disabled:opacity-50 text-red bg-red bg-opacity-100"
              style={{backgroundColor: "#DC2626"}}
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-red rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 transition-transform"
          style={{backgroundColor: "#DC2626"}}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
          </svg>
        </button>
      )}
    </div>
  );
}
