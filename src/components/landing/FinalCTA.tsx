interface FinalCTAProps {
  onGetStarted?: () => void;
}

const FinalCTA = ({ onGetStarted }: FinalCTAProps) => {
  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <div className="text-center max-w-3xl mx-auto">
        <h2 className="text-5xl font-bold mb-6 text-foreground">
          Ready to Transform Your Irrigation?
        </h2>
        <p className="text-lg text-muted-foreground mb-8">
          Join farms and facilities reducing water waste by 30% with AI-powered risk management
        </p>
        <div className="flex gap-4 justify-center mb-6">
          <button className="border-2 border-primary text-primary px-8 py-3 rounded-xl hover:bg-primary hover:text-primary-foreground transition-all duration-300 font-semibold">
            Schedule a Demo
          </button>
        </div>
      </div>
    </section>
  );
};

export default FinalCTA;
