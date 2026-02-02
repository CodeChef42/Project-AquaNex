const Technology = () => {
  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <h2 className="text-5xl font-bold text-center mb-12">
        Built on Modern AI & Cloud Infrastructure
      </h2>
      <div className="bg-gray-100 p-8 rounded-lg mb-8">
        <div className="text-center text-gray-600">
          <p>Architecture diagram showing:</p>
          <p>Edge Sensors → Cloud Gateway → AI Agents → Dashboards</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xl font-semibold mb-4">Key Technologies</h3>
          <ul className="space-y-2 text-gray-600">
            <li>• LSTM/RNN forecasting models</li>
            <li>• MQTT/REST real-time ingestion</li>
            <li>• Geospatial mapping (GIS)</li>
            <li>• Role-based access control (RBAC)</li>
          </ul>
        </div>
        <div>
          <h3 className="text-xl font-semibold mb-4">Differentiators</h3>
          <ul className="space-y-2 text-gray-600">
            <li>✓ Human-in-the-Loop governance</li>
            <li>✓ UAE-climate optimized</li>
            <li>✓ Microservices architecture</li>
            <li>✓ Research-backed</li>
          </ul>
        </div>
      </div>
      <div className="text-center">
        <button className="border border-blue-600 text-blue-600 px-6 py-2 rounded">
          View Technical Documentation →
        </button>
      </div>
    </section>
  );
};

export default Technology;
