'use client';
import { Trophy, Star, Zap, Heart, Shield, Target, Award, TrendingUp } from 'lucide-react';

type Badge = {
  icon: string;
  label: string;
  description: string;
  earned: boolean;
  earnedDate?: string;
};

const badges: Badge[] = [
  { icon: '🩸', label: 'First Drop', description: 'Complete your first blood donation', earned: true, earnedDate: 'Aug 2023' },
  { icon: '⚡', label: 'SOS Hero', description: 'Respond to an emergency SOS within 30 minutes', earned: true, earnedDate: 'Nov 2024' },
  { icon: '🏅', label: '5 Lives Saved', description: 'Complete 5 blood donations', earned: true, earnedDate: 'May 2024' },
  { icon: '🌟', label: '10 Lives Saved', description: 'Complete 10 blood donations', earned: false },
  { icon: '💪', label: 'Iron Will', description: 'Donate every 90 days for a full year', earned: false },
  { icon: '🎯', label: 'Perfect Match', description: 'Get a 95+ AI compatibility score', earned: true, earnedDate: 'Feb 2025' },
  { icon: '🤝', label: 'Community Builder', description: 'Refer 3 new donors to the platform', earned: false },
  { icon: '👑', label: 'Platinum Donor', description: 'Reach 2,000 impact points', earned: false },
];

const milestones = [
  { label: 'Bronze', points: 500, achieved: true },
  { label: 'Silver', points: 1000, achieved: true },
  { label: 'Gold', points: 2000, achieved: false, current: true },
  { label: 'Platinum', points: 5000, achieved: false },
];

export default function AchievementsPage() {
  const currentPoints = 1260;
  const nextMilestone = milestones.find(m => !m.achieved);
  const progress = nextMilestone ? (currentPoints / nextMilestone.points) * 100 : 100;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Achievements</h1>
        <p className="text-sm text-gray-500 mt-1">Track your badges, milestones, and impact on the community</p>
      </div>

      {/* Points Card */}
      <div className="bg-gradient-to-r from-red to-red-dark text-white rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
        <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-1">Impact Points</div>
            <div className="text-5xl font-bold">{currentPoints.toLocaleString()}</div>
            <div className="text-sm opacity-80 mt-2 flex items-center gap-2">
              <TrendingUp size={14} /> +260 points this month
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl p-4 min-w-[200px]">
            <div className="text-xs opacity-80 mb-2">Next Milestone: {nextMilestone?.label}</div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="text-xs mt-2 opacity-80">{currentPoints} / {nextMilestone?.points} pts</div>
          </div>
        </div>
      </div>

      {/* Milestone Track */}
      <div className="card">
        <h2 className="card-title mb-4">Milestone Progress</h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex items-center gap-2">
              <div className={`flex flex-col items-center min-w-[80px] ${m.achieved ? 'opacity-100' : 'opacity-50'}`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mb-1 ${m.achieved ? 'bg-amber-bg text-amber shadow-md' : m.current ? 'bg-red-glow text-red border-2 border-red/30' : 'bg-gray-100 text-gray-400'}`}>
                  {m.achieved ? '✓' : m.current ? <Star size={20} /> : <Shield size={16} />}
                </div>
                <span className={`text-[11px] font-bold ${m.achieved ? 'text-gray-800' : 'text-gray-400'}`}>{m.label}</span>
                <span className="text-[10px] text-gray-400">{m.points} pts</span>
              </div>
              {i < milestones.length - 1 && (
                <div className={`h-0.5 w-8 rounded-full ${m.achieved ? 'bg-amber' : 'bg-gray-200'}`}></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Badges Grid */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">Badges ({badges.filter(b => b.earned).length}/{badges.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className={`card text-center transition-all ${badge.earned ? 'hover:shadow-md' : 'opacity-60 grayscale'}`}
            >
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-3 ${badge.earned ? 'bg-amber-bg shadow-[0_0_0_4px_var(--color-amber-bg)]' : 'bg-gray-100'}`}>
                {badge.icon}
              </div>
              <div className="text-sm font-bold text-gray-800 mb-1">{badge.label}</div>
              <div className="text-[11px] text-gray-500 leading-relaxed mb-2">{badge.description}</div>
              {badge.earned ? (
                <span className="chip chip-green text-[10px]"><span className="chip-dot"></span>Earned · {badge.earnedDate}</span>
              ) : (
                <span className="chip chip-amber text-[10px]"><span className="chip-dot"></span>Locked</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h2 className="card-title mb-4">Donor Leaderboard — Top 5</h2>
        <div className="flex flex-col gap-2">
          {[
            { rank: 1, name: 'Priya K.', points: 3450, badge: '👑' },
            { rank: 2, name: 'Vikram M.', points: 2820, badge: '🥈' },
            { rank: 3, name: 'You (Arjun S.)', points: 1260, badge: '🥉', isYou: true },
            { rank: 4, name: 'Deepika R.', points: 980, badge: '' },
            { rank: 5, name: 'Amit T.', points: 750, badge: '' },
          ].map(entry => (
            <div key={entry.rank} className={`flex items-center gap-3 p-3 rounded-xl ${entry.isYou ? 'bg-red-glow/20 border border-red/20' : 'bg-gray-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${entry.rank <= 3 ? 'bg-amber-bg text-amber' : 'bg-gray-200 text-gray-500'}`}>
                {entry.badge || entry.rank}
              </div>
              <div className="flex-1">
                <span className={`text-sm font-semibold ${entry.isYou ? 'text-red' : 'text-gray-800'}`}>{entry.name}</span>
              </div>
              <span className="text-sm font-bold text-gray-800">{entry.points.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
