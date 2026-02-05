import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import aquanexLogo from "../assets/Picture1.png";

const SignIn = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(username, password);
      toast({
        title: 'Success',
        description: 'Logged in successfully!',
      });
      navigate('/home');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.error?.[0] || 'Invalid credentials',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 max-w-7xl py-6">
          <div className="flex items-center space-x-3">
            <img 
              src={aquanexLogo} 
              alt="AquaNex Intelligent Irrigation Systems" 
              className="h-16 w-auto object-contain"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">Sign in to access your irrigation dashboard</p>
          </div>
          
          <div className="bg-card border border-border rounded-xl shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="johndoe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-md"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </div>

          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              Don't have an account?{" "}
              <Link 
                to="/signup" 
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 max-w-7xl">
          <p className="text-center text-muted-foreground text-sm">
            © 2024 AquaNex. Intelligent Irrigation Systems.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default SignIn;
