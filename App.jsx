import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Chat from './pages/Chat';
import { useAuthStore } from './store';
import socketService from './services/socket';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

function App() {
  const { isAuthenticated, token, logout } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && token) {
      socketService.connect(token);
      
      socketService.on('error', (error) => {
        console.error('Socket error:', error);
        if (error.message === 'Authentication error') {
          logout();
        }
      });

      return () => {
        socketService.disconnect();
      };
    }
  }, [isAuthenticated, token, logout]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route 
              path="/login" 
              element={
                isAuthenticated ? <Navigate to="/" replace /> : <Login />
              } 
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Chat />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#0f172a',
              color: '#e5e7eb',
              border: '1px solid #1f2937',
            },
          }}
        />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  );
}

export default App;
