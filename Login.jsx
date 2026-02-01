import { useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { Code2, Zap, Users, MessageSquare } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuthStore } from '../store';
import toast from 'react-hot-toast';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const { data } = await authAPI.googleLogin(tokenResponse.access_token);
        setAuth(data.user, data.token);
        toast.success(`Welcome, ${data.user.name}!`);
      } catch (error) {
        console.error('Login failed:', error);
        toast.error('Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      toast.error('Google login failed');
    },
    flow: 'implicit',
  });

  return (
    <div className="min-h-screen flex bg-dark-bg">
      {/* Left Panel - Hero */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-dark-panel-2 via-dark-bg to-dark-panel-2 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `repeating-linear-gradient(0deg, #3b82f6 0px, #3b82f6 1px, transparent 1px, transparent 40px),
                             repeating-linear-gradient(90deg, #3b82f6 0px, #3b82f6 1px, transparent 1px, transparent 40px)`
          }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
              <Code2 className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white">
              Gizmo<span className="text-accent">Chat</span>
            </h1>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-5xl font-black text-white leading-tight mb-4">
                WhatsApp for
                <br />
                <span className="bg-gradient-to-r from-accent to-success bg-clip-text text-transparent">
                  Developers
                </span>
              </h2>
              <p className="text-xl text-dark-muted max-w-md">
                Real-time chat, collaborative boards, and seamless team communication built by developers, for developers.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: MessageSquare, text: 'Instant messaging with code syntax highlighting' },
                { icon: Users, text: 'Multiplayer collaborative boards' },
                { icon: Zap, text: 'Lightning-fast real-time sync' },
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-dark-panel rounded-lg flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-dark-text">{feature.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-6 text-sm text-dark-muted">
          <span>Built with React + Socket.io</span>
          <span>•</span>
          <span>Open Source</span>
          <span>•</span>
          <span>Self-hosted</span>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 justify-center mb-4">
              <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center">
                <Code2 className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-3xl font-black text-white">
                Gizmo<span className="text-accent">Chat</span>
              </h1>
            </div>
          </div>

          <div className="card p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome Back
              </h2>
              <p className="text-dark-muted">
                Sign in with Google to continue
              </p>
            </div>

            <button
              onClick={() => handleGoogleLogin()}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            <div className="mt-6 text-center text-sm text-dark-muted">
              <p>
                By signing in, you agree to our
                <br />
                <a href="#" className="text-accent hover:underline">Terms of Service</a>
                {' '}&{' '}
                <a href="#" className="text-accent hover:underline">Privacy Policy</a>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-dark-muted">
              Don't have a Google account?
              <br />
              <a href="https://accounts.google.com/signup" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                Create one for free
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
