const ImpactStats = () => {
  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      <h2 className="text-5xl font-bold text-center mb-12">
        Measurable Impact
      </h2>
      <div className="grid grid-cols-3 gap-8 mb-12">
        <div className="text-center p-8 border rounded-lg">
          <div className="text-5xl font-bold text-blue-600 mb-2">30%</div>
          <div className="text-lg font-semibold mb-2">Water Savings</div>
          <div className="text-sm text-gray-600">(Target)</div>
        </div>
        <div className="text-center p-8 border rounded-lg">
          <div className="text-5xl font-bold text-green-600 mb-2">25%</div>
          <div className="text-lg font-semibold mb-2">Reduction in Operational Costs</div>
        </div>
        <div className="text-center p-8 border rounded-lg">
          <div className="text-5xl font-bold text-purple-600 mb-2">Hours to Days</div>
          <div className="text-lg font-semibold mb-2">MTTR Reduced from Weeks</div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-gray-600 max-w-2xl mx-auto">
          Aligned with UN SDG 6 (Clean Water) & UAE National Food Security Strategy 2051
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Estimated impact based on system design and UAE water loss benchmarks (EcoMENA, 2023)
        </p>
      </div>
    </section>
  );
};

export default ImpactStats;
