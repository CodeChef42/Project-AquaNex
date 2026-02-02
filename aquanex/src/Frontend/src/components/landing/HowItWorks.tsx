const HowItWorks = () => {
  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <h2 className="text-5xl font-bold text-center mb-12">
        How AquaNex Works
      </h2>
      <div className="grid grid-cols-3 gap-8 items-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold mb-4">1. SENSE</h3>
          <p className="text-gray-600">
            IoT sensors stream real-time telemetry (flow, pressure, EC, pH, soil data)
          </p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold mb-4">2. ANALYZE</h3>
          <p className="text-gray-600">
            AI agents detect anomalies, predict water demand, and generate repair plans with crew allocation
          </p>
        </div>
        <div className="text-center">
          <div className="w-16 h-16 bg-purple-600 rounded-full mx-auto mb-4"></div>
          <h3 className="text-xl font-semibold mb-4">3. ACT</h3>
          <p className="text-gray-600">
            Human-in-the-loop approves actions via role-based dashboard: approve work orders, review schedules, track ROI
          </p>
        </div>
      </div>
      <div className="text-center mt-8">
        <button className="border border-blue-600 text-blue-600 px-6 py-2 rounded">
          Explore Platform Architecture →
        </button>
      </div>
    </section>
  );
};

export default HowItWorks;
