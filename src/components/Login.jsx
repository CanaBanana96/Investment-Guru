import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { signInWithGoogle } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { isFirebaseConfigured, continueAsGuest } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    if (!isFirebaseConfigured) {
      toast.error('Firebase sign-in is not configured yet.');
      return;
    }

    setLoading(true);
    try {
      await signInWithGoogle();
      toast.success('Welcome back to INVESTMENT GURU!');
      navigate('/dashboard');
    } catch (error) {
      if (error.message === 'Only Gmail accounts are allowed') {
        toast.error('Only Gmail accounts are allowed');
      } else if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in was cancelled');
      } else {
        toast.error('Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    continueAsGuest();
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f6f3ec] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-[32px] border border-teal-900/10 bg-white/95 p-8 shadow-soft backdrop-blur-sm sm:p-12">
          <div className="text-center">
            <div className="mx-auto mb-8 flex h-12 w-12 items-center justify-center rounded-full bg-teal-900">
              <span className="text-white font-bold text-xl">G</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 mb-2">Welcome to INVESTMENT GURU</h1>
            <p className="text-slate-500 mb-8">Your personal investment copilot</p>
            {!isFirebaseConfigured && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
                Add your Firebase values to `.env` with `VITE_FIREBASE_*` names to enable Google sign-in.
              </div>
            )}
            <button
              onClick={handleGoogleSignIn}
              disabled={loading || !isFirebaseConfigured}
              className="flex w-full items-center justify-center gap-3 rounded-2xl border border-teal-900/10 bg-white px-5 py-4 text-sm font-semibold text-slate-900 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent"></div>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={handleGuestAccess}
              className="mt-3 w-full rounded-2xl bg-teal-900 px-5 py-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              Continue as guest
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
