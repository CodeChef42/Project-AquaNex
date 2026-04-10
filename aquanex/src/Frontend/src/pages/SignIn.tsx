import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from "lucide-react";
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';
import { LeafDecor } from '../components/LeafDecor';
import Logo from '@/components/Logo';

const SignIn = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(username, password);
      toast({ title: 'Success', description: 'Logged in successfully!' });
      setTimeout(() => {
        navigate('/workspaces');
      }, 600);
    } catch (error: any) {
      setLoading(false);
      toast({
        title: 'Error',
        description: error.response?.data?.error?.[0] || 'Invalid credentials',
        variant: 'destructive',
      });
    }
  };

  const handleGoogleLogin = async (credentialResponse: any) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/auth/google/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: credentialResponse.credential,
            action: "login"
          }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        localStorage.clear(); // clear any stale tokens
        loginWithTokens(data.access, data.refresh, data.user);
        setTimeout(() => {
          navigate('/workspaces');
        }, 600);
      } else {
        setLoading(false);
        toast({
          title: "Error",
          description: data.error || "Google login failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Google login error:", error);
    }
  };

  if (loading) {
    return (
      <LoadingScreen
        variant="signin"
        message="Signing you in…"
        submessage="Verifying your credentials"
      />
    );
  }

  return (
    <div
      className="relative min-h-screen flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-300"
      style={{
        background: "radial-gradient(ellipse at top left, #ecfeff 0%, #f0fdfa 35%, #e0f2fe 70%, #f8fafc 100%)",
      }}
    >
      <LeafDecor />



      <header className="relative z-10 border-b border-cyan-200/60 bg-white/50 backdrop-blur-md">
        <div className="container mx-auto px-6 max-w-7xl h-20 flex items-center justify-between">
          <Logo withText={true} size="md" />
          <Link
            to="/"
            className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 transition-colors tracking-wide"
          >
            ← Back to landing
          </Link>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 shadow-lg shadow-cyan-300/40 dark:shadow-cyan-900/50 mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-700 dark:from-cyan-300 dark:via-teal-300 dark:to-cyan-400">
              Welcome Back
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Sign in to access your irrigation command center
            </p>
          </div>

          <div className="relative bg-white/70 dark:bg-slate-900/70 border border-cyan-200/80 dark:border-cyan-800/40 rounded-2xl shadow-2xl shadow-cyan-100/60 dark:shadow-cyan-950/60 p-8 backdrop-blur-xl before:absolute before:inset-0 before:rounded-2xl before:bg-gradient-to-br before:from-cyan-50/40 before:to-teal-50/20 dark:before:from-cyan-950/20 dark:before:to-transparent before:-z-10">
            <div className="absolute top-0 left-8 right-8 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500 opacity-80" />

            {/* Google login in card */}
            <div className="w-full flex justify-center [&>div]:w-full mb-4 mt-2">
              <GoogleLogin
                onSuccess={handleGoogleLogin}
                onError={() => console.log("Google login failed")}
              />
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
              <span className="text-sm text-slate-400 font-medium px-1">or</span>
              <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-700 dark:text-slate-300 font-semibold text-sm tracking-wide">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:border-cyan-400 rounded-xl h-11 transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold text-sm tracking-wide">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pr-11 bg-slate-50/80 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:border-cyan-400 rounded-xl h-11 transition-all"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 px-3.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 rounded-xl font-bold text-white text-sm tracking-wide bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-400 hover:via-teal-400 hover:to-cyan-500 shadow-lg shadow-cyan-400/30 dark:shadow-cyan-900/50 transition-all duration-200"
              >
                Sign In
              </button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="text-cyan-600 dark:text-cyan-400 hover:text-teal-600 dark:hover:text-cyan-300 font-semibold transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-cyan-200/40 dark:border-cyan-900/30 py-4 bg-white/30 dark:bg-black/10">
        <p className="text-center text-slate-400 dark:text-slate-600 text-xs tracking-wide">
          © 2026 AquaNex. Intelligent Irrigation Systems.
        </p>
      </footer>
    </div>
  );
};

export default SignIn;