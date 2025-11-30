import React, { useState } from 'react';
import { login } from '../services/authService';
import { User } from '../types';
import { Lock, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const user = await login(email, password);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('Invalid email or password.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex flex-col items-center justify-center p-4">
       <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-3xl p-8 md:p-12 shadow-2xl">
          {/* Logo Section */}
          <div className="flex justify-center mb-10">
            <img 
                src="https://mikegoldman.com/wp-content/uploads/2019/02/MikeGoldman-Logo.png" 
                alt="Mike Goldman Logo" 
                className="h-12 md:h-16 object-contain"
            />
          </div>

          <h2 className="text-2xl font-bold text-white text-center mb-2">Admin Login</h2>
          <p className="text-brand-grey text-center mb-8 text-sm">Sign in to manage assessments.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Email Address</label>
              <input 
                type="email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none transition-all"
                placeholder="you@mike-goldman.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-brand-black border border-neutral-600 rounded-xl text-white focus:ring-2 focus:ring-brand-orange outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-900/20 border border-red-900/50 rounded-lg flex items-center gap-2 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-brand-orange hover:bg-orange-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
             <div className="flex items-center justify-center gap-2 text-neutral-600 text-xs">
                <Lock className="w-3 h-3" /> Secure Access
             </div>
          </div>
       </div>
    </div>
  );
};

export default LoginScreen;
