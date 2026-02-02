import { Link } from "react-router-dom";
import aquanexLogo from "../assets/Picture1.png";

const SignUp = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 max-w-7xl py-6">
          <div className="flex items-center space-x-3">
            <img 
              src={aquanexLogo} 
              alt="AquaNex Intelligent Irrigation Systems" 
              className="h-10 w-auto object-contain"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center py-12">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Get Started</h1>
            <p className="text-muted-foreground">Create your account to transform your irrigation system</p>
          </div>
          
          <div className="bg-card border border-border rounded-xl shadow-sm p-6 text-center">
            <p className="mb-4">This is a demo version. No sign up required.</p>
            <Link 
              to="/dashboard" 
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-md inline-block"
            >
              Go to Dashboard
            </Link>
          </div>

          <div className="text-center mt-6">
            <p className="text-muted-foreground">
              Already have an account?{" "}
              <Link 
                to="/sign-in" 
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign in
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

export default SignUp;
