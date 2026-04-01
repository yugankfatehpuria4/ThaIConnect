 'use client';

// import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();

  const onSOSClick = () => {
    router.push('/select-role');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-white/80 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-red rounded-lg flex items-center justify-center shadow-md shadow-red/20 group-hover:shadow-lg group-hover:shadow-red/30 transition-shadow">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"/>
            </svg>
          </div>
          <span className="font-display text-xl font-bold text-gray-800">ThalAI Connect</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-600 hover:text-red transition-colors">Features</a>
          <a href="#stats" className="text-sm font-medium text-gray-600 hover:text-red transition-colors">Impact</a>
          <a href="#about" className="text-sm font-medium text-gray-600 hover:text-red transition-colors">About</a>
        </div>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSOSClick}
            className="text-sm font-semibold text-white bg-red hover:bg-red-dark px-5 py-2.5 rounded-xl shadow-lg shadow-red/25 hover:shadow-xl hover:shadow-red/35 transition-all active:scale-95"
          >
            <span className="text-xl group-hover:animate-bounce">🚨</span>
            Emergency SOS
          </button>
        </div>
      </div>
    </nav>
  );
}
