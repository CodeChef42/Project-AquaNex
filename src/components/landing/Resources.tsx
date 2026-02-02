const Resources = () => {
  const resources = [
    {
      title: "UN SDG 6: Clean Water & Sanitation",
      description: "United Nations Sustainable Development Goal for clean water access"
    },
    {
      title: "UAE Water Security Strategy",
      description: "UAE National Food Security Strategy 2051 and water initiatives"
    },
    {
      title: "Smart Agriculture Tech Trends",
      description: "Latest innovations in agricultural technology and irrigation"
    }
  ];

  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <h2 className="text-5xl font-bold text-center mb-12">
        Insights on Irrigation & Sustainability
      </h2>
      <div className="grid grid-cols-3 gap-8 mb-8">
        {resources.map((resource, index) => (
          <div key={index} className="border rounded-lg overflow-hidden">
            <div className="bg-gray-200 h-32 flex items-center justify-center">
              <p>Image Placeholder</p>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-2">{resource.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{resource.description}</p>
              <button className="text-blue-600 font-semibold text-sm">
                Read →
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="text-center">
        <button className="border border-blue-600 text-blue-600 px-6 py-2 rounded">
          View All Resources →
        </button>
      </div>
    </section>
  );
};

export default Resources;
