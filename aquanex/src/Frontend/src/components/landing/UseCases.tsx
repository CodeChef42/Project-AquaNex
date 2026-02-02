const UseCases = () => {
  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <h2 className="text-5xl font-bold text-center mb-12">
        Who AquaNex Serves
      </h2>
      <div className="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-200 h-48 flex items-center justify-center">
            <p>Urban Landscape Image</p>
          </div>
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4">Urban Landscaping</h3>
            <ul className="space-y-2 text-gray-600 mb-6">
              <li>• </li>
              <li>• </li>
              <li>• </li>
            </ul>
            <button className="text-blue-600 font-semibold">
              Learn More →
            </button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-200 h-48 flex items-center justify-center">
            <p>Farm Field Image</p>
          </div>
          <div className="p-6">
            <h3 className="text-xl font-semibold mb-4">Agriculture</h3>
            <ul className="space-y-2 text-gray-600 mb-6">
              <li>• </li>
              <li>• </li>
              <li>• </li>
            </ul>
            <button className="text-blue-600 font-semibold">
              Learn More →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default UseCases;
