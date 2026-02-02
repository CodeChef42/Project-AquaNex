import arrowRightIcon from "../../assets/icons/icons8-right-arrow-32.png";
import playIcon from "../../assets/icons/icons8-play-48.png";

interface HeroSectionProps {
  onGetStarted?: () => void;
}

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <div className="grid grid-cols-2 gap-16 items-center">
        {/* Left Content */}
        <div>
          <h1 className="text-6xl font-bold text-foreground mb-8 leading-tight tracking-tight">
            Transform Irrigation Risk into Intelligent Action
          </h1>
          <p className="text-2xl text-muted-foreground mb-10 leading-relaxed font-light">
            AI-powered platform that detects pipeline failures, optimizes water demand, and reduces losses by 30-50% in UAE's harshest conditions
          </p>
          
          {/* CTAs */}
          <div className="flex gap-6 mb-12">
            <button 
              onClick={onGetStarted}
              className="bg-success text-success-foreground px-8 py-4 rounded-xl hover:bg-success/90 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center group"
            >
              Get Started
              <img src={arrowRightIcon} alt="Arrow Right Icon" width={20} height={20} className="ml-3 group-hover:translate-x-1 transition-transform duration-300" />
            </button>
            <button className="border-2 border-primary text-primary px-8 py-4 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-semibold flex items-center justify-center group">
              <img src={playIcon} alt="Play Icon" width={20} height={20} className="mr-3 group-hover:scale-110 transition-transform duration-300" />
              Watch Demo
            </button>
          </div>
          
          {/* Micro-trust Line */}
          <div className="flex items-center text-muted-foreground text-sm font-medium">
            <div className="w-3 h-3 bg-success rounded-full mr-3 shadow-sm"></div>
            Powered by UOWD Research | Serving UAE Agriculture
          </div>
        </div>

        {/* Right Content - Hero Image/Animation Space */}
        <div>
          <div className="relative bg-gradient-to-br from-primary/10 to-secondary/10 rounded-3xl p-12 h-[500px] flex items-center justify-center border border-border shadow-xl">
            <div className="text-center">
              <div className="w-20 h-20 bg-primary rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                <div className="w-10 h-10 bg-primary-foreground rounded-lg"></div>
              </div>
              <h3 className="text-2xl font-semibold text-foreground mb-3">Dashboard Preview</h3>
              <p className="text-muted-foreground font-medium">Real-time system interface</p>
              <div className="mt-6 flex justify-center space-x-2">
                <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
