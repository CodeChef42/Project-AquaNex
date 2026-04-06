import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LeafDecor } from '../components/LeafDecor';
import Logo from '@/components/Logo';
import api from '@/lib/api';



const inputCls = `
  bg-slate-50/80 dark:bg-slate-800/60
  border-slate-200 dark:border-slate-700
  text-slate-900 dark:text-white
  placeholder:text-slate-400 dark:placeholder:text-slate-500
  focus-visible:ring-2 focus-visible:ring-cyan-500
  focus-visible:border-cyan-400
  rounded-xl h-11 transition-all
`;


type AvailStatus = 'idle' | 'checking' | 'available' | 'taken';


const AvailabilityIndicator = ({ status, takenMsg }: { status: AvailStatus; takenMsg: string }) => {
  if (status === 'idle') return null;
  if (status === 'checking') return (
    <span className="flex items-center gap-1 text-xs text-slate-400 mt-1">
      <Loader2 className="w-3 h-3 animate-spin" /> Checking...
    </span>
  );
  if (status === 'available') return (
    <span className="flex items-center gap-1 text-xs text-emerald-500 mt-1">
      <CheckCircle className="w-3 h-3" /> Available
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-red-500 mt-1">
      <XCircle className="w-3 h-3" /> {takenMsg}
    </span>
  );
};



const SignUp = () => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generatedSecretKey, setGeneratedSecretKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [usernameStatus, setUsernameStatus] = useState<AvailStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<AvailStatus>('idle');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);

  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();


  // Debounced username check
  useEffect(() => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (!username || username.length < 3) {
      setUsernameStatus('idle');
      setUsernameSuggestions([]);
      return;
    }
    setUsernameStatus('checking');
    usernameTimer.current = setTimeout(async () => {
      try {
        const res = await api.post('/auth/check-availability/', { username });
        setUsernameStatus(res.data.username_taken ? 'taken' : 'available');
        setUsernameSuggestions(res.data.username_taken ? (res.data.suggestions || []) : []);
      } catch {
        setUsernameStatus('idle');
        setUsernameSuggestions([]);
      }
    }, 500);
    return () => { if (usernameTimer.current) clearTimeout(usernameTimer.current); };
  }, [username]);


  // Debounced email check
  useEffect(() => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    if (!email || !email.includes('@')) { setEmailStatus('idle'); return; }
    setEmailStatus('checking');
    emailTimer.current = setTimeout(async () => {
      try {
        const res = await api.post('/auth/check-availability/', { email });
        setEmailStatus(res.data.email_taken ? 'taken' : 'available');
      } catch {
        setEmailStatus('idle');
      }
    }, 500);
    return () => { if (emailTimer.current) clearTimeout(emailTimer.current); };
  }, [email]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    if (usernameStatus === 'taken') {
      toast({ title: 'Error', description: 'Username is already taken', variant: 'destructive' });
      return;
    }
    if (emailStatus === 'taken') {
      toast({ title: 'Error', description: 'Email is already registered', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const returnedSecretKey = await register(username, password, fullName, email);
      setGeneratedSecretKey(returnedSecretKey);
    } catch (error: any) {
      toast({
        title: 'Error',
        description:
          error.response?.data?.username?.[0] ||
          error.response?.data?.email?.[0] ||
          error.response?.data?.detail ||
          'Registration failed',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };


  const handleCopy = () => {
    if (generatedSecretKey) {
      navigator.clipboard.writeText(generatedSecretKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };


  const handleContinue = () => {
    setGeneratedSecretKey(null);
    navigate('/onboarding');
  };


  return (
    <div
      className="relative min-h-screen flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-300"
      style={{
        background:
          'radial-gradient(ellipse at top left, #ecfeff 0%, #f0fdfa 35%, #e0f2fe 70%, #f8fafc 100%)',
      }}
    >
      <LeafDecor />


      {generatedSecretKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
          <div className="relative bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800/50 rounded-2xl shadow-2xl shadow-cyan-200/40 dark:shadow-cyan-950 p-8 w-full max-w-md mx-4 space-y-5">
            <div className="absolute top-0 left-8 right-8 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500" />
            <div className="flex items-start gap-3 mt-2">
              <div className="text-2xl">🔑</div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Save Your Secret Key</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Required for password recovery.{' '}
                  <span className="text-red-500 font-semibold">Not shown again.</span>
                </p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 flex items-center justify-between gap-3 border border-slate-200 dark:border-slate-700">
              <code className="text-sm font-mono text-cyan-700 dark:text-cyan-300 break-all select-all">
                {generatedSecretKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0 border-cyan-300 dark:border-cyan-700 text-cyan-700 dark:text-cyan-300"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </div>
            <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              ⚠️ Store in a safe place (e.g. password manager). Cannot be recovered after closing.
            </div>
            <Button
              className="w-full h-11 rounded-xl font-bold text-white bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 shadow-lg shadow-cyan-400/30 border-0"
              onClick={handleContinue}
            >
              Continue to Onboarding →
            </Button>
          </div>
        </div>
      )}


      <header className="relative z-10 border-b border-cyan-200/60 bg-white/50 backdrop-blur-md">
        <div className="container mx-auto px-6 max-w-7xl h-20 flex items-center justify-between">
          <Logo withText={true} size="md" />
          <Link to="/" className="text-sm font-semibold text-cyan-700 hover:text-cyan-900 transition-colors tracking-wide">
            ← Back to landing
          </Link>
        </div>
      </header>


      <main className="relative z-10 flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-teal-500 shadow-lg shadow-cyan-300/40 dark:shadow-cyan-900/50 mb-4">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-4xl font-extrabold mb-2 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-teal-500 to-cyan-700 dark:from-cyan-300 dark:via-teal-300 dark:to-cyan-400">
              Get Started
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Create your account to transform your irrigation system
            </p>
          </div>


          <div className="relative bg-white/70 dark:bg-slate-900/70 border border-cyan-200/80 dark:border-cyan-800/40 rounded-2xl shadow-2xl shadow-cyan-100/60 dark:shadow-cyan-950/60 p-8 backdrop-blur-xl">
            <div className="absolute top-0 left-8 right-8 h-[3px] rounded-full bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500 opacity-80" />


            <div className="mt-2 space-y-4">
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={(credentialResponse) => { console.log('Google login success:', credentialResponse); }}
                  onError={() => { console.log('Login Failed'); }}
                />
              </div>


              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
                <span className="text-sm text-slate-400 dark:text-slate-500 font-medium">or</span>
                <div className="h-px flex-1 bg-slate-300 dark:bg-slate-700" />
              </div>


              <form onSubmit={handleSubmit} className="space-y-4">

                {/* ── Username ── */}
                <div className="space-y-1">
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
                    className={`${inputCls} ${
                      usernameStatus === 'taken'
                        ? 'border-red-400 focus-visible:ring-red-400'
                        : usernameStatus === 'available'
                        ? 'border-emerald-400 focus-visible:ring-emerald-400'
                        : ''
                    }`}
                  />
                  <AvailabilityIndicator status={usernameStatus} takenMsg="Username already taken" />

                  {/* Suggestions */}
                  {usernameStatus === 'taken' && usernameSuggestions.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-xs text-slate-400">Try:</span>
                      {usernameSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setUsername(s);
                            setUsernameSuggestions([]);
                          }}
                          className="text-xs px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-900/30 dark:border-cyan-700 dark:text-cyan-300 dark:hover:bg-cyan-800/50 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>


                {/* ── Full Name ── */}
                <div className="space-y-1">
                  <Label htmlFor="fullName" className="text-slate-700 dark:text-slate-300 font-semibold text-sm tracking-wide">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputCls}
                  />
                </div>


                {/* ── Email ── */}
                <div className="space-y-1">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-semibold text-sm tracking-wide">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={`${inputCls} ${
                      emailStatus === 'taken'
                        ? 'border-red-400 focus-visible:ring-red-400'
                        : emailStatus === 'available'
                        ? 'border-emerald-400 focus-visible:ring-emerald-400'
                        : ''
                    }`}
                  />
                  <AvailabilityIndicator status={emailStatus} takenMsg="Email already registered" />
                </div>


                {/* ── Password ── */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold text-sm tracking-wide">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={`w-full pr-11 ${inputCls}`}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 px-3.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>


                {/* ── Confirm Password ── */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-300 font-semibold text-sm tracking-wide">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className={`w-full pr-11 ${inputCls}`}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 px-3.5 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                      onClick={() => setShowConfirmPassword((v) => !v)}
                      aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>


                <Button
                  type="submit"
                  disabled={
                    loading ||
                    usernameStatus === 'taken' ||
                    emailStatus === 'taken' ||
                    usernameStatus === 'checking' ||
                    emailStatus === 'checking'
                  }
                  className="w-full h-11 rounded-xl font-bold text-white text-sm tracking-wide bg-gradient-to-r from-cyan-500 via-teal-500 to-cyan-600 hover:from-cyan-400 hover:via-teal-400 hover:to-cyan-500 shadow-lg shadow-cyan-400/30 dark:shadow-cyan-900/50 transition-all duration-200 border-0 mt-2"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </div>
          </div>


          <div className="text-center mt-6">
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              Already have an account?{' '}
              <Link to="/signin" className="text-cyan-600 dark:text-cyan-400 hover:text-teal-600 dark:hover:text-cyan-300 font-semibold transition-colors">
                Sign in
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


export default SignUp;