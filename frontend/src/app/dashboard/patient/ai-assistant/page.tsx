'use client';
import { useState, useRef, useEffect } from 'react';
import { ArrowUp, Brain, Sparkles, Heart, Pill, Apple, HelpCircle } from 'lucide-react';

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

const aiResponses: Record<string, string> = {
  'When is my next transfusion due?': "Based on your 21-day cycle, your next transfusion is scheduled for **April 2, 2025** — that's in 3 days. Your last Hb reading was **10.2 g/dL**, which is within the safe range but will likely drop below 9.0 g/dL by then. I recommend confirming with your doctor and booking a donor now.",
  'Chelation therapy side effects?': "Iron chelation therapy (like **Deferasirox/Desirox**) can cause:\n\n• **Gastrointestinal** — Nausea, diarrhea, abdominal pain\n• **Renal** — Elevated creatinine (requires regular monitoring)\n• **Skin** — Rashes, itching\n• **Hearing/Vision** — Rare but possible\n\nAlways take it on an empty stomach 30 min before meals. Report any persistent symptoms to your hematologist.",
  'Diet tips for thalassemia?': "Great question! Here are key dietary guidelines:\n\n🟢 **Eat more:** Calcium-rich foods, whole grains, fruits, vegetables, and lean protein\n🔴 **Avoid:** Iron-rich foods (red meat, liver, spinach in excess)\n⚡ **Boost:** Vitamin C for chelation support, Vitamin D, Folic acid\n💧 **Stay hydrated** — at least 8 glasses of water daily\n\nWould you like me to create a sample weekly meal plan?",
  'How to manage fatigue?': "Fatigue is common in thalassemia. Here are proven strategies:\n\n1. **Maintain Hb levels** above 9.5 g/dL through regular transfusions\n2. **Sleep schedule** — Aim for 8+ hours, same time daily\n3. **Light exercise** — Walking, yoga, swimming (avoid intense activities)\n4. **Iron chelation** — Reduces iron overload that causes fatigue\n5. **Nutrition** — B12, folic acid, and balanced meals\n6. **Stress management** — Meditation and support groups help\n\nIf fatigue persists despite treatment, it may indicate iron overload in cardiac tissue. Please discuss with your doctor.",
};

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
  const [mounted, setMounted] = useState(false);

  // Set the initial timestamp only after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
    setMessages(prev => prev.map(m => m.time === '' ? { ...m, time: getTime() } : m));
  }, []);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const now = getTime();
    setMessages(prev => [...prev, { sender: 'User', text, time: now }]);
    setInput('');
    setTyping(true);

    setTimeout(() => {
      const response = aiResponses[text] || "I understand your concern. Based on your medical profile and recent transfusion data, I would recommend consulting with your hematologist for personalized advice. In the meantime, make sure to:\n\n• Keep your chelation therapy on schedule\n• Monitor for any unusual symptoms\n• Stay well-hydrated\n• Maintain a balanced diet\n\nWould you like me to help you schedule an appointment?";
      const responseTime = getTime();
      setMessages(prev => [...prev, { sender: 'AI', text: response, time: responseTime }]);
      setTyping(false);
    }, 1500);
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
                {msg.text.includes('**') ? (
                  <span dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                ) : msg.text}
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
