'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import AIAssistant from '../components/AIAssistant';

/* ──────────────────────────────────────────────────────────
   Animated counter hook — counts from 0 to target
   ────────────────────────────────────────────────────────── */
function useCounter(target: number, duration = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const interval = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(interval);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return { count, setStarted };
}

/* ──────────────────────────────────────────────────────────
   Floating blood drop component
   ────────────────────────────────────────────────────────── */
function FloatingDrop({ delay, size, left, duration }: { delay: number; size: number; left: string; duration: number }) {
  return (
    <div
      className="blood-drop absolute pointer-events-none"
      style={{
        left,
        animationDelay: `${delay}s`,
        animationDuration: `${duration}s`,
        width: size,
        height: size,
        opacity: 0.08,
      }}
    >
      <svg viewBox="0 0 24 24" fill="#C0392B" className="w-full h-full">
        <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
      </svg>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Feature card
   ────────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, desc, accent }: { icon: string; title: string; desc: string; accent: string }) {
  return (
    <div className="group relative bg-white rounded-2xl border border-gray-100 p-8 shadow-sm hover:shadow-xl hover:border-transparent hover:-translate-y-1 transition-all duration-300 cursor-default overflow-hidden">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-linear-to-br ${accent}`} />
      <div className="relative z-10">
        <div className="text-4xl mb-5">{icon}</div>
        <h3 className="text-xl font-bold text-gray-800 mb-3 group-hover:text-gray-900">{title}</h3>
        <p className="text-gray-500 leading-relaxed group-hover:text-gray-600">{desc}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   HERO LANDING PAGE
   ══════════════════════════════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const donors = useCounter(2800, 2000);
  const lives = useCounter(1200, 2000);
  const emergencies = useCounter(150, 2000);

  useEffect(() => {
    // Start counters once stats section is in view
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) {
            donors.setStarted(true);
            lives.setStarted(true);
            emergencies.setStarted(true);
          }
        });
      },
      { threshold: 0.3 }
    );
    const el = document.getElementById('stats');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [donors, emergencies, lives]);

  return (
    <div className="bg-white text-gray-800 w-full overflow-x-hidden">
      <Navbar />

      {/* ── FLOATING BLOOD DROPS BACKGROUND ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <FloatingDrop delay={0} size={40} left="5%" duration={14} />
        <FloatingDrop delay={2} size={28} left="15%" duration={18} />
        <FloatingDrop delay={4} size={36} left="30%" duration={15} />
        <FloatingDrop delay={1} size={24} left="45%" duration={20} />
        <FloatingDrop delay={3} size={32} left="60%" duration={16} />
        <FloatingDrop delay={5} size={20} left="75%" duration={19} />
        <FloatingDrop delay={2.5} size={30} left="88%" duration={17} />
        <FloatingDrop delay={6} size={26} left="95%" duration={13} />
      </div>

      {/* ═══════════════════════════════════════
          🔴 HERO SECTION
          ═══════════════════════════════════════ */}
      <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-6 pt-16 overflow-hidden">
        <div className="absolute top-24 right-6 z-20">
          {/* <button
            onClick={() => router.push('/login')}
            className="bg-red hover:bg-red-dark text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg shadow-red/25 transition-colors"
          >
            🚨 Get Started — It&apos;s Free
          </button> */}
        </div>

        {/* Gradient orbs */}
        <div className="absolute top-20 -left-32 w-96 h-96 bg-red/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 -right-32 w-96 h-96 bg-blue/10 rounded-full blur-3xl" />

        <div className="relative z-10 transition-all duration-1000 opacity-100 translate-y-0">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-red-glow text-red text-sm font-semibold px-4 py-2 rounded-full mb-8 animate-sos-pulse">
            <span className="w-2 h-2 rounded-full bg-red" />
            AI-Powered Life Saving Platform
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight max-w-4xl">
            Connecting Lives Through{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red to-red-dark">
              AI-Powered
            </span>{' '}
            Blood Donation
          </h1>

          <p className="mt-8 text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            ThalAI Connect helps thalassemia patients instantly find compatible donors
            using intelligent matching and real-time emergency alerts.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="group flex items-center gap-2 bg-red hover:bg-red-dark text-white font-semibold px-8 py-4 rounded-2xl shadow-lg shadow-red/25 hover:shadow-xl hover:shadow-red/35 transition-all active:scale-95 text-base"
            >
              <span className="text-xl group-hover:animate-bounce">🚨</span>
              Get Started — It&apos;s Free
            </button>


            {/* <button
              onClick={() => router.push('/register')}
              className="flex items-center gap-2 bg-white border-2 border-gray-200 hover:border-red/30 text-gray-700 font-semibold px-8 py-4 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 text-base"
            >
              Find a Donor
              <svg className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </button> */}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" /></svg>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          📊 STATS SECTION
          ═══════════════════════════════════════ */}
      <section id="stats" className="relative py-24 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-8 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red to-red-dark tabular-nums">
                {donors.count.toLocaleString()}+
              </h2>
              <p className="text-gray-500 mt-3 font-medium">Registered Donors</p>
              <div className="mt-3 w-12 h-1 bg-red/20 rounded-full mx-auto" />
            </div>

            <div className="text-center p-8 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red to-red-dark tabular-nums">
                {lives.count.toLocaleString()}+
              </h2>
              <p className="text-gray-500 mt-3 font-medium">Lives Impacted</p>
              <div className="mt-3 w-12 h-1 bg-red/20 rounded-full mx-auto" />
            </div>

            <div className="text-center p-8 rounded-2xl bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <h2 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red to-red-dark tabular-nums">
                {emergencies.count.toLocaleString()}+
              </h2>
              <p className="text-gray-500 mt-3 font-medium">Emergency Responses</p>
              <div className="mt-3 w-12 h-1 bg-red/20 rounded-full mx-auto" />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          ⚡ FEATURES SECTION
          ═══════════════════════════════════════ */}
      <section id="features" className="relative py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-red uppercase tracking-widest">Why Choose Us</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-gray-800 mt-4">
              Why ThalAI Connect?
            </h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">
              A comprehensive platform designed to bridge the gap between patients and donors with cutting-edge technology.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon="🤖"
              title="Smart AI Matching"
              desc="AI-based donor ranking using blood compatibility, distance, availability, and health compatibility scores."
              accent="from-red-glow/50 to-transparent"
            />
            <FeatureCard
              icon="⚡"
              title="Instant SOS Alerts"
              desc="Trigger emergency alerts and get real-time donor responses with live location tracking and notifications."
              accent="from-amber-bg/50 to-transparent"
            />
            <FeatureCard
              icon="💬"
              title="AI Health Assistant"
              desc="Get personalized guidance, medication reminders, and empathetic support from our OpenAI-powered assistant."
              accent="from-blue-bg/50 to-transparent"
            />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          ℹ️ ABOUT / HOW IT WORKS
          ═══════════════════════════════════════ */}
      <section id="about" className="py-24 px-6 bg-gradient-to-b from-white to-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-red uppercase tracking-widest">How It Works</span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-gray-800 mt-4">
              Three Simple Steps
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Register', desc: 'Sign up as a patient or donor with your blood type and location.', color: 'bg-red-glow text-red' },
              { step: '02', title: 'Connect', desc: 'Our AI matches you with compatible donors in real-time.', color: 'bg-blue-bg text-blue' },
              { step: '03', title: 'Save Lives', desc: 'Receive or donate blood with our coordinated emergency system.', color: 'bg-green-bg text-green' },
            ].map((item) => (
              <div key={item.step} className="relative text-center">
                <div className={`w-16 h-16 rounded-2xl ${item.color} flex items-center justify-center text-2xl font-bold mx-auto mb-6`}>
                  {item.step}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{item.title}</h3>
                <p className="text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          🔥 CTA SECTION
          ═══════════════════════════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red to-red-dark" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center px-6">
          <h2 className="font-display text-4xl md:text-5xl font-bold text-white">
            Be a Lifesaver Today
          </h2>
          <p className="mt-6 text-lg text-white/80 max-w-xl mx-auto">
            Join the network of heroes. Every donation counts. Every second matters.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <button
              onClick={() => router.push('/register')}
              className="bg-white text-red font-bold px-10 py-4 rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all active:scale-95 text-lg"
            >
              Get Started — It&apos;s Free
            </button>
            <button
              onClick={() => router.push('/register')}
              className="border-2 border-white/40 text-white font-semibold px-10 py-4 rounded-2xl hover:bg-white/10 transition-all active:scale-95 text-lg"
            >
              Emergency SOS 🚨
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════ */}
      <footer className="py-12 px-6 bg-gray-800 text-gray-400">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-red rounded-lg flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
                <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
              </svg>
            </div>
            <span className="font-display text-lg font-bold text-white">ThalAI Connect</span>
          </div>
          <p className="text-sm">&copy; {new Date().getFullYear()} ThalAI Connect. Built with ❤️ for thalassemia patients.</p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* AI Assistant Floating Button */}
      <AIAssistant />
    </div>
  );
}
