import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";

const stats = [
  { 
    icon: "/icons8-water-48.png", 
    alt: "Water Drop",
    value: "25% Water Savings", 
    description: "Average reduction in water usage" 
  },
  { 
    icon: "/icons8-leaf-32.png",
    alt: "Leaf",
    value: "Real-Time Monitoring", 
    description: "Soil and weather tracking" 
  },
  { 
    icon: "/icons8-clock-32.png",
    alt: "24/7 Clock",
    value: "Response", 
    description: "Rapid incident management" 
  },
];

const articles = [
  {
    title: "Sustainable Water Management in Arid Regions",
    link: "https://www.unwater.org/publications/sustainable-water-management-arid-regions"
  },
  {
    title: "Smart Irrigation Best Practices",
    link: "https://www.fao.org/3/i2800e/i2800e.pdf"
  },
  {
    title: "Water Conservation in Agriculture",
    link: "https://www.worldbank.org/en/topic/water-in-agriculture"
  }
];

const LandingPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    console.log("Get Started button clicked. Attempting navigation to /dashboard");
    try {
      navigate("/dashboard");
      console.log("Navigation command executed");
    } catch (error) {
      console.error("Navigation failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
        <Logo size="lg" withText />
        <div className="hidden md:flex space-x-8">
          <a href="#about" className="text-gray-600 hover:text-teal-600 transition-colors">About</a>
          <a href="#contact" className="text-gray-600 hover:text-teal-600 transition-colors">Contact</a>
          <a href="#products" className="text-gray-600 hover:text-teal-600 transition-colors">Products & Services</a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 md:py-32 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            Conserve Water, <span className="bg-gradient-to-r from-teal-600 to-blue-600 bg-clip-text text-transparent">Maximize Yield</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            AI-Powered Smart Irrigation for UAE Farms
          </p>
          <button 
            onClick={handleGetStarted}
            className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white px-8 py-6 text-lg rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-11"
          >
            Get Started <span className="ml-2">→</span>
          </button>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white p-6 rounded-xl shadow-md text-center">
                <div className="mx-auto mb-4 w-16 h-16 flex items-center justify-center">
                  <img 
                    src={stat.icon} 
                    alt={stat.alt} 
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{stat.value}</h3>
                <p className="text-gray-600">{stat.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Articles Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Sustainability Resources</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {articles.map((article, index) => (
              <a 
                key={index} 
                href={article.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{article.title}</h3>
                <p className="text-blue-600 flex items-center">
                  Read more <span className="ml-1">→</span>
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Logo size="sm" withText={false} className="text-teal-400" />
                <span className="text-xl font-bold">AquaNex</span>
              </div>
              <p className="text-gray-400">Smart Irrigation Solutions for Sustainable Agriculture</p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Case Studies</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#about" className="text-gray-400 hover:text-white transition-colors">About Us</a></li>
                <li><a href="#contact" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
                <li><a href="#careers" className="text-gray-400 hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <address className="not-italic text-gray-400">
                <p>Dubai, UAE</p>
                <p>Email: info@aquanex.ae</p>
                <p>Phone: +971 4 123 4567</p>
              </address>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            <p>© {new Date().getFullYear()} AquaNex. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
