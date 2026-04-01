'use client';
import { useState } from 'react';
import { Settings, Bell, Shield, Database, Globe, Moon, Sun, Save, CheckCircle2, AlertCircle, Server, Cpu, HardDrive } from 'lucide-react';

type SettingSection = {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
};

const sections: SettingSection[] = [
  { id: 'general', icon: <Settings size={18} />, title: 'General', desc: 'App name, timezone, and language' },
  { id: 'notifications', icon: <Bell size={18} />, title: 'Notifications', desc: 'Email, push, and SOS alerts' },
  { id: 'security', icon: <Shield size={18} />, title: 'Security', desc: 'Authentication and access control' },
  { id: 'system', icon: <Server size={18} />, title: 'System', desc: 'Backend, database, and AI services' },
];

export default function AdminSettingsPage() {
  const [activeSection, setActiveSection] = useState('general');
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    appName: 'ThalAI Connect',
    timezone: 'Asia/Kolkata',
    language: 'en',
    darkMode: false,
    emailNotifs: true,
    pushNotifs: true,
    sosAlerts: true,
    sosSound: true,
    weeklyReport: true,
    twoFactor: false,
    sessionTimeout: '24',
    apiRateLimit: '100',
    backendUrl: 'http://localhost:5002',
    mongoUri: 'mongodb+srv://****@cluster0.mongodb.net/',
    aiServiceUrl: 'http://localhost:5001',
    matchingThreshold: '70',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure platform, notification, and system preferences</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-red hover:bg-red-dark text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          {saved ? <><CheckCircle2 size={16} /> Saved!</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5">
        {/* Sidebar Nav */}
        <div className="flex flex-col gap-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors ${activeSection === s.id ? 'bg-red-glow text-red' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <span className={`opacity-70 ${activeSection === s.id ? 'opacity-100' : ''}`}>{s.icon}</span>
              <div>
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="text-[10px] text-gray-400">{s.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Settings Content */}
        <div className="card">
          {activeSection === 'general' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">General Settings</h2>
              <SettingField label="Application Name" desc="Display name shown across the platform">
                <input
                  value={settings.appName}
                  onChange={e => updateSetting('appName', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red transition-colors"
                />
              </SettingField>
              <SettingField label="Timezone" desc="Server timezone for scheduling">
                <select
                  value={settings.timezone}
                  onChange={e => updateSetting('timezone', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red bg-white"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST)</option>
                </select>
              </SettingField>
              <SettingField label="Language" desc="Default interface language">
                <select
                  value={settings.language}
                  onChange={e => updateSetting('language', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red bg-white"
                >
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                </select>
              </SettingField>
              <SettingToggle
                label="Dark Mode"
                desc="Enable dark theme across the platform"
                icon={settings.darkMode ? <Moon size={16} /> : <Sun size={16} />}
                enabled={settings.darkMode}
                onChange={v => updateSetting('darkMode', v)}
              />
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Notification Preferences</h2>
              <SettingToggle label="Email Notifications" desc="Receive updates and alerts via email" enabled={settings.emailNotifs} onChange={v => updateSetting('emailNotifs', v)} />
              <SettingToggle label="Push Notifications" desc="Browser push notifications for real-time alerts" enabled={settings.pushNotifs} onChange={v => updateSetting('pushNotifs', v)} />
              <SettingToggle label="SOS Alert Sounds" desc="Play alert sound for incoming SOS requests" enabled={settings.sosSound} onChange={v => updateSetting('sosSound', v)} />
              <SettingToggle label="SOS Alerts" desc="Receive emergency blood request notifications" enabled={settings.sosAlerts} onChange={v => updateSetting('sosAlerts', v)} />
              <SettingToggle label="Weekly Report" desc="Receive a weekly summary of platform activity" enabled={settings.weeklyReport} onChange={v => updateSetting('weeklyReport', v)} />
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">Security Settings</h2>
              <SettingToggle label="Two-Factor Authentication" desc="Add an extra layer of security to admin accounts" enabled={settings.twoFactor} onChange={v => updateSetting('twoFactor', v)} />
              <SettingField label="Session Timeout" desc="Auto-logout after inactivity (hours)">
                <select
                  value={settings.sessionTimeout}
                  onChange={e => updateSetting('sessionTimeout', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red bg-white"
                >
                  <option value="1">1 hour</option>
                  <option value="8">8 hours</option>
                  <option value="24">24 hours</option>
                  <option value="168">1 week</option>
                </select>
              </SettingField>
              <SettingField label="API Rate Limit" desc="Max requests per minute per user">
                <input
                  type="number"
                  value={settings.apiRateLimit}
                  onChange={e => updateSetting('apiRateLimit', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red"
                />
              </SettingField>
              <div className="bg-amber-bg border border-amber/20 text-amber px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2">
                <AlertCircle size={16} /> JWT Secret is configured via environment variables and cannot be changed here.
              </div>
            </div>
          )}

          {activeSection === 'system' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-gray-800">System Configuration</h2>

              {/* Service Status */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">Service Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <ServiceCard icon={<Server size={16} />} name="Backend API" url="localhost:5002" status="online" />
                  <ServiceCard icon={<Database size={16} />} name="MongoDB Atlas" url="cluster0.mongodb.net" status="online" />
                  <ServiceCard icon={<Cpu size={16} />} name="AI Service" url="localhost:5001" status="offline" />
                </div>
              </div>

              <SettingField label="Backend URL" desc="Express API server endpoint">
                <input
                  value={settings.backendUrl}
                  onChange={e => updateSetting('backendUrl', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red font-mono"
                />
              </SettingField>
              <SettingField label="MongoDB URI" desc="Database connection string (masked)">
                <input
                  value={settings.mongoUri}
                  disabled
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 font-mono cursor-not-allowed"
                />
              </SettingField>
              <SettingField label="AI Matching Threshold" desc="Minimum compatibility score (0-100) to suggest a donor">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={settings.matchingThreshold}
                  onChange={e => updateSetting('matchingThreshold', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-red"
                />
              </SettingField>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingField({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-gray-800 block mb-0.5">{label}</label>
      <p className="text-[11px] text-gray-400 mb-2">{desc}</p>
      {children}
    </div>
  );
}

function SettingToggle({ label, desc, enabled, onChange, icon }: { label: string; desc: string; enabled: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {icon && <span className="text-gray-400">{icon}</span>}
        <div>
          <div className="text-sm font-semibold text-gray-800">{label}</div>
          <div className="text-[11px] text-gray-400">{desc}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-red' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'left-[22px]' : 'left-0.5'}`}></div>
      </button>
    </div>
  );
}

function ServiceCard({ icon, name, url, status }: { icon: React.ReactNode; name: string; url: string; status: 'online' | 'offline' }) {
  return (
    <div className={`bg-white border rounded-xl p-3 ${status === 'online' ? 'border-green/20' : 'border-red/20'}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-gray-500">{icon}</span>
        <span className="text-sm font-semibold text-gray-800">{name}</span>
      </div>
      <div className="text-[10px] text-gray-400 font-mono mb-2">{url}</div>
      <span className={`chip text-[10px] ${status === 'online' ? 'chip-green' : 'chip-red'}`}>
        <span className="chip-dot"></span>{status === 'online' ? 'Online' : 'Offline'}
      </span>
    </div>
  );
}
