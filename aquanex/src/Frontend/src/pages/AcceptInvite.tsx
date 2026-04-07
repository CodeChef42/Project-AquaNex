import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import LoadingScreen from '@/components/LoadingScreen';
import { LeafDecor } from '../components/LeafDecor';
import Logo from '@/components/Logo';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

type InviteInfo = {
  email: string;
  workspace_name: string;
};

const AcceptInvite = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviteError, setInviteError] = useState('');

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/accept-invite/${token}/`)
      .then((res) => setInviteInfo(res.data))
      .catch((err) => {
        setInviteError(
          err.response?.data?.error || 'This invitation link is invalid or has expired.'
        );
      })
      .finally(() => setLoadingInvite(false));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/accept-invite/${token}/`, {
        full_name: fullName,
        password,
      });
      localStorage.setItem('access_token', res.data.access);
      localStorage.setItem('refresh_token', res.data.refresh);
      toast({ title: 'Account created!', description: `Welcome to ${inviteInfo?.workspace_name}.` });
      window.location.href = '/home';
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  if (loadingInvite) {
    return (
      <LoadingScreen variant="signin" message="Checking your invitation…" submessage="" />
    );
  }

  return (
    <div
      className="relative min-h-screen flex flex-col text-slate-800 dark:text-slate-100 transition-colors duration-300"
      style={{
        background:
          'radial-gradient(ellipse at top left, #ecfeff 0%, #f0fdfa 35%, #e0f2fe 70%, #f8fafc 100%)',
      }}
    >
      <LeafDecor />

      <header className="relative z-10 border-b border-cyan-200/60 bg-white/50 backdrop-blur-md">
        <div className="container mx-auto px-6 max-w-7xl h-20 flex items-center">
          <Logo />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-cyan-100 p-8">
          {inviteError ? (
            <div className="text-center space-y-3">
              <h1 className="text-2xl font-bold text-slate-800">Invitation Unavailable</h1>
              <p className="text-slate-500 text-sm">{inviteError}</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Accept your invitation</h1>
                <p className="text-slate-500 text-sm mt-1">
                  You've been invited to join{' '}
                  <span className="font-semibold text-slate-700">{inviteInfo?.workspace_name}</span>{' '}
                  on AquaNex.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email — read-only, pre-filled from invite */}
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteInfo?.email ?? ''}
                    readOnly
                    className="bg-slate-50 text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowConfirm((v) => !v)}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Creating account…' : 'Create Account & Join'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default AcceptInvite;
