import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import aquanexLogo from '../assets/Picture1.png';

const ACCESS_KEY = 'adminTester'; // your existing registration gate key

const SignUp = () => {
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);

  // Secret key modal state
  const [generatedSecretKey, setGeneratedSecretKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (secretKey !== ACCESS_KEY) {
      toast({ title: 'Access Denied', description: 'Invalid access key. Registration is currently restricted.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const returnedSecretKey = await register(username, password, fullName, email);
      setGeneratedSecretKey(returnedSecretKey); // show the modal
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
    <div className="min-h-screen bg-background flex flex-col">

      {/* Secret Key Modal */}
      {generatedSecretKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-xl p-8 w-full max-w-md mx-4 space-y-5">
            <div className="flex items-start gap-3">
              <div className="text-2xl">🔑</div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Save Your Secret Key</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This key is required to reset your password in the future.
                  <span className="text-destructive font-semibold"> It will not be shown again.</span>
                </p>
              </div>
            </div>

            <div className="bg-muted rounded-xl px-4 py-3 flex items-center justify-between gap-3 border border-border">
              <code className="text-sm font-mono text-foreground break-all select-all">
                {generatedSecretKey}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
                {copied ? '✓ Copied' : 'Copy'}
              </Button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              ⚠️ Store this in a safe place (e.g. a password manager). You cannot recover it once you close this window.
            </div>

            <Button
              className="w-full"
              onClick={handleContinue}
            >
              I've saved my key — Continue
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 max-w-7xl py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img src={aquanexLogo} alt="AquaNex Intelligent Irrigation Systems" className="h-10 w-auto object-contain" />
            </div>
            <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Back to landing
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Get Started</h1>
            <p className="text-muted-foreground">Create your account to transform your irrigation system</p>
          </div>

          <div className="bg-card border border-border rounded-xl shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" type="text" placeholder="johndoe" value={username} onChange={(e) => setUsername(e.target.value)} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input id="confirmPassword" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretKey">
                  Access Key <span className="text-xs text-muted-foreground font-normal">(required for registration)</span>
                </Label>
                <Input id="secretKey" type="password" placeholder="Enter access key" value={secretKey} onChange={(e) => setSecretKey(e.target.value)} required className="w-full" />
              </div>

              <Button
                type="submit"
                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-md"
                disabled={loading}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link to="/signin" className="text-primary hover:text-primary/80 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 max-w-7xl">
          <p className="text-center text-muted-foreground text-sm">© 2026 AquaNex. Intelligent Irrigation Systems.</p>
        </div>
      </footer>
    </div>
  );
};

export default SignUp;
