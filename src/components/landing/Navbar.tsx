import aquanexLogo from "../../assets/Picture1.png";

interface NavbarProps {
  onOpenSignIn?: () => void;
  onOpenSignUp?: () => void;
}

const Navbar = ({ onOpenSignIn, onOpenSignUp }: NavbarProps) => {
  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex justify-between items-center py-6">
          {/* Logo - AquaNex Brand */}
          <div className="flex items-center space-x-3">
            <img 
              src={aquanexLogo} 
              alt="AquaNex Intelligent Irrigation Systems" 
              className="h-10 w-auto object-contain"
            />
          </div>

          {/* Desktop Navigation */}
          <div className="flex items-center space-x-10">
            <a href="#products" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium">
              Products
            </a>
            <a href="#solutions" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium">
              Solutions
            </a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium">
              About
            </a>
            <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium">
              Contact
            </a>
          </div>

          {/* Desktop CTAs */}
          <div className="flex items-center space-x-4">
              <button 
                onClick={onOpenSignIn}
                className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200 px-4 py-2"
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

          {/* MOBILE - DISABLED: Mobile Menu Button */}
          {/* <div className="lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 p-2"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div> */}
        </div>

        {/* MOBILE - DISABLED: Mobile Menu */}
        {/* {isMobileMenuOpen && (
          <div className="lg:hidden py-6 border-t border-border">
            <div className="flex flex-col space-y-6">
              <a href="#products" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium text-lg">
                Products
              </a>
              <a href="#solutions" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium text-lg">
                Solutions
              </a>
              <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium text-lg">
                About
              </a>
              <a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors duration-200 font-medium text-lg">
                Contact
              </a>
              <div className="flex flex-col space-y-4 pt-6 border-t border-border">
                <button className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200 text-left px-4 py-3 text-lg">
                  Login
                </button>
                <button className="bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-all duration-200 font-medium shadow-md">
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )} */}
      </div>
    </nav>
  );
};

export default Navbar;
