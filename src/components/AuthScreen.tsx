import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Brain, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification, 
  signInWithPopup 
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebaseService';

interface AuthScreenProps {
  darkMode: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ darkMode }) => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const formatAuthError = (err: any): string => {
    const code = err?.code || '';
    if (code.includes('auth/invalid-email')) return 'Please enter a valid email address.';
    if (code.includes('auth/user-not-found') || code.includes('auth/wrong-password') || code.includes('auth/invalid-credential')) return 'Incorrect email or password.';
    if (code.includes('auth/email-already-in-use')) return 'An account with this email already exists.';
    if (code.includes('auth/weak-password')) return 'Password should be at least 6 characters long.';
    if (code.includes('auth/network-request-failed')) return 'Network error. Please check your internet connection.';
    return err?.message || 'An unexpected error occurred. Please try again.';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setSuccessMessage('Password reset email sent! Check your inbox.');
        setIsForgotPassword(false);
      } else if (isSignUp) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await sendEmailVerification(cred.user);
        } catch (verr) {
          console.warn("Verification email send error:", verr);
        }
        setSuccessMessage('Account created successfully! Verification email sent.');
        navigate('/study');
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/study');
      }
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await signInWithPopup(auth, googleProvider);
      navigate('/study');
    } catch (err: any) {
      setErrorMessage(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text)] flex items-center justify-center p-4 selection:bg-[var(--primary)] selection:text-[var(--primary-text)] transition-colors">
      <div className="max-w-md w-full bg-[var(--surface)] border border-[var(--border)] rounded-3xl p-8 shadow-2xl space-y-6">
        
        {/* Logo & Header */}
        <div className="relative text-center space-y-2">
          <Link to="/" className="absolute -top-4 -left-4 p-2 rounded-full hover:bg-[var(--hover)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9-9 9 9m-9-9v18" />
            </svg>
          </Link>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--primary)] via-[var(--primary-hover)] to-[var(--content-flashcards)] flex items-center justify-center mx-auto shadow-lg text-[var(--primary-text)]">
            <Brain className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Welcome to StudyBridge</h1>
          <p className="text-xs text-[var(--muted)]">
            Offline-first AI study assistant with Firebase AI Logic hybrid inference
          </p>
        </div>

        {/* Error / Success Banners */}
        {errorMessage && (
          <div className="bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-[var(--danger)]">
            <AlertCircle className="w-4 h-4 shrink-0 text-[var(--danger)] mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-[var(--success-bg)] border border-[var(--success-border)] rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-[var(--success)]">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--success)] mt-0.5" />
            <span className="leading-relaxed">{successMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {!isForgotPassword && isSignUp && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Student"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@university.edu"
                className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>

          {!isForgotPassword && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-[var(--text-secondary)]">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[11px] text-[var(--primary-accent)] hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[var(--muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl pl-9 pr-4 py-2.5 text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--primary-text)] font-medium text-xs shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isForgotPassword ? 'Send Reset Email' : isSignUp ? 'Create Account' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Google Auth Button */}
        {!isForgotPassword && (
          <div className="space-y-4">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-[var(--border)]"></div>
              <span className="flex-shrink mx-4 text-[11px] text-[var(--muted)] uppercase tracking-wider">or</span>
              <div className="flex-grow border-t border-[var(--border)]"></div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl bg-[var(--surface-raised)] hover:bg-[var(--hover-strong)] border border-[var(--border)] text-xs font-medium text-[var(--text-secondary)] transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
        )}

        {/* Footer Toggle */}
        <div className="text-center text-xs text-[var(--muted)] pt-2">
          {isForgotPassword ? (
            <button
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMessage(null);
                setSuccessMessage(null);
              }}
              className="text-[var(--primary-accent)] font-medium hover:underline"
            >
              Back to Sign In
            </button>
          ) : isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-[var(--primary-accent)] font-medium hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{' '}
              <button
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className="text-[var(--primary-accent)] font-medium hover:underline"
              >
                Sign Up
              </button>
            </p>
          )}
        </div>

        {/* Public Footer Links */}
        <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-center gap-6 text-[11px] text-[var(--muted)]">
          <Link to="/about" className="hover:text-[var(--text)] hover:underline">About</Link>
          <Link to="/privacy" className="hover:text-[var(--text)] hover:underline">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-[var(--text)] hover:underline">Terms of Service</Link>
        </div>

      </div>
    </div>
  );
};
