import aquanexLogo from "../../assets/Picture1.png";

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-4 gap-8 mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <img 
                src={aquanexLogo} 
                alt="AquaNex" 
                className="h-6 w-auto object-contain"
              />
              <span className="font-bold">AquaNex</span>
            </div>
            <p className="text-sm text-gray-400">
              AI-powered irrigation risk management
            </p>
          </div>
          <div>
            <h5 className="font-semibold mb-4">PRODUCT</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Features</li>
              <li>Demo</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold mb-4">COMPANY</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>About</li>
              <li>Team</li>
            </ul>
          </div>
          <div>
            <h5 className="font-semibold mb-4">RESOURCES</h5>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>Documentation</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
          <p>© 2026 AquaNex | UOWD CSIT321 Capstone </p>
          <div className="flex justify-center space-x-4 mt-4">
            <span>[GitHub]</span>
            <span>[Instagram]</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
