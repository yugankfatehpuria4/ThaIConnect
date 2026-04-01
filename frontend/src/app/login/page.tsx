'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'patient' as 'patient' | 'donor' | 'admin',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // For now, just log the data and navigate to dashboard
    console.log('Login data:', formData);

    try {
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email, password: formData.password }),
      });

      if (loginRes.ok) {
        const data = await loginRes.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        router.replace(`/dashboard/${data.user.role}`);
        return;
      }

      if (loginRes.status === 401 || loginRes.status === 404) {
        const registerRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });

        if (!registerRes.ok) {
          const data = await registerRes.json();
          throw new Error(data.error || 'Registration failed');
        }

        const data = await registerRes.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        router.replace(`/dashboard/${data.user.role}`);
        return;
      }

      const loginData = await loginRes.json();
      throw new Error(loginData.error || 'Invalid credentials');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected auth error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red/5 to-blue/5 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your ThalAI Connect account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red focus:border-red transition-colors"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red focus:border-red transition-colors"
              placeholder="Enter your password"
            />
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              I am a
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red focus:border-red transition-colors"
            >
              <option value="patient">Patient</option>
              <option value="donor">Blood Donor</option>
              <option value="admin">Administrator</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-red hover:bg-red-dark text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-lg shadow-red/25 hover:shadow-xl hover:shadow-red/35"
            disabled={loading}
          >
            Sign In
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red">{error}</p>}

        {loading && <p className="mt-4 text-sm text-gray-600">Authenticating...</p>}

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => router.push('/register')}
              className="text-red hover:text-red-dark font-medium"
            >
              Sign up here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}