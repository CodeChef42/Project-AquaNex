import aquanexLogo from "../../assets/Picture1.png";

interface NavbarProps {
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

const Navbar = ({ onOpenSignIn, onOpenSignUp }: NavbarProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-card border-b border-border shadow-md">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img 
              src={aquanexLogo} 
              alt="AquaNex Intelligent Irrigation Systems" 
              className="h-16 w-auto object-contain"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="flex items-center space-x-10">
            <a href="#products" className="text-foreground hover:text-primary transition-colors duration-200 font-medium">
              Products
            </a>
            <a href="#solutions" className="text-foreground hover:text-primary transition-colors duration-200 font-medium">
              Solutions
            </a>
            <a href="#about" className="text-foreground hover:text-primary transition-colors duration-200 font-medium">
              About
            </a>
            <a href="#contact" className="text-foreground hover:text-primary transition-colors duration-200 font-medium">
              Contact
            </a>
          </div>

          {/* Desktop CTAs */}
          <div className="flex items-center space-x-4">
            <button 
              onClick={onOpenSignIn}
              className="text-foreground hover:text-primary font-medium transition-colors duration-200 px-4 py-2"
            >
              Login
            </button>
            <button 
              onClick={onOpenSignUp}
              className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-md hover:shadow-lg hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
