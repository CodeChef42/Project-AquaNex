import Header from "@/components/landing/Header";
import HeroSection from "@/components/landing/HeroSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import StatsSection from "@/components/landing/StatsSection";
import SolutionsSection from "@/components/landing/SolutionsSection";
import CTASection from "@/components/landing/CTASection";
import Logo from "@/components/Logo";

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
  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100/60 via-white to-sky-50">
      <Header />

      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <SolutionsSection />
      <CTASection />

      {/* Articles Section */}
      <section id="resources" className="py-16 bg-sky-50/30">
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
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Us</h4>
              <address className="not-italic text-gray-400">
                <p>Dubai, UAE</p>
                <p>Email: info@aquanex.app</p>
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
