import wrenchIcon from "../../assets/icons/icons8-wrench-32.png";
import dropletsIcon from "../../assets/icons/icons8-water-droplet-32(1).png";
import calendarIcon from "../../assets/icons/icons8-calendar-48.png";
import beakerIcon from "../../assets/icons/icons8-beaker-32.png";
import barChartIcon from "../../assets/icons/icons8-bar-chart-32.png";
import arrowRightIcon from "../../assets/icons/icons8-right-arrow-32.png";

const SolutionGrid = () => {
  const features = [
    {
      icon: <img src={wrenchIcon} alt="Pipeline Management Icon" width={40} height={40} className="icon-hover" />,
      title: "Pipeline Management",
      description: "Detect breaks, geolocate, allocate crews",
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20"
    },
    {
      icon: <img src={dropletsIcon} alt="Soil Salinity Icon" width={40} height={40} className="icon-hover" />,
      title: "Soil Salinity",
      description: "Monitor EC levels, predict mitigation",
      color: "text-success",
      bgColor: "bg-success/10",
      borderColor: "border-success/20"
    },
    {
      icon: <img src={calendarIcon} alt="Water Demand Icon" width={40} height={40} className="icon-hover" />,
      title: "Water Demand",
      description: "Forecast needs via weather + AI models",
      color: "text-info",
      bgColor: "bg-info/10",
      borderColor: "border-info/20"
    },
    {
      icon: <img src={beakerIcon} alt="Water Quality Icon" width={40} height={40} className="icon-hover" />,
      title: "Water Quality",
      description: "Track pH, EC, TDS, turbidity in real time",
      color: "text-secondary",
      bgColor: "bg-secondary/10",
      borderColor: "border-secondary/20"
    },
    {
      icon: <img src={barChartIcon} alt="Incident Analysis Icon" width={40} height={40} className="icon-hover" />,
      title: "Incident Analysis",
      description: "Correlate incidents with costs for ROI insights",
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20"
    }
  ];

  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      {/* Section Header */}
      <div className="text-center mb-20">
        <h2 className="text-5xl font-bold text-foreground mb-6">
          Five Intelligent Agents. One Platform.
        </h2>
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto font-light leading-relaxed">
          Integrated AI-powered solutions that work together to transform irrigation management
        </p>
      </div>

      {/* Features Grid - 3 top row, 2 bottom row */}
      <div className="grid grid-cols-3 gap-10 mb-12">
        {features.slice(0, 3).map((feature, index) => (
          <div
            key={index}
            className={`p-10 bg-card border-2 ${feature.borderColor} rounded-3xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group cursor-pointer`}
          >
            {/* Icon */}
            <div className={`w-20 h-20 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 border ${feature.borderColor}`}>
              <div className={feature.color}>
                {feature.icon}
              </div>
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-foreground mb-6">
              {feature.title}
            </h3>
            
            {/* Description */}
            <p className="text-muted-foreground leading-relaxed mb-8 font-medium text-lg">
              {feature.description}
            </p>
            
            {/* Learn More Link */}
            <div className="flex items-center text-primary font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-y-1">
              <span>Learn more</span>
              <img src={arrowRightIcon} alt="Arrow Right Icon" width={20} height={20} className="ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Row - 2 centered cards */}
      <div className="grid grid-cols-2 gap-10 max-w-5xl mx-auto">
        {features.slice(3).map((feature, index) => (
          <div
            key={index + 3}
            className={`p-10 bg-card border-2 ${feature.borderColor} rounded-3xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group cursor-pointer`}
          >
            {/* Icon */}
            <div className={`w-20 h-20 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 border ${feature.borderColor}`}>
              <div className={feature.color}>
                {feature.icon}
              </div>
            </div>
            
            {/* Title */}
            <h3 className="text-2xl font-bold text-foreground mb-6">
              {feature.title}
            </h3>
            
            {/* Description */}
            <p className="text-muted-foreground leading-relaxed mb-8 font-medium text-lg">
              {feature.description}
            </p>
            
            {/* Learn More Link */}
            <div className="flex items-center text-primary font-semibold opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:translate-y-1">
              <span>Learn more</span>
              <img src={arrowRightIcon} alt="Arrow Right Icon" width={20} height={20} className="ml-2 group-hover:translate-x-1 transition-transform duration-300" />
            </div>
          </div>
        ))}
      </div>

      {/* Platform Integration Note */}
      <div className="text-center mt-16">
        <div className="inline-flex items-center bg-primary/10 px-8 py-4 rounded-full border border-primary/20">
          <div className="w-3 h-3 bg-primary rounded-full mr-4 shadow-sm"></div>
          <span className="text-primary font-semibold text-lg">
            All agents work seamlessly together in a unified platform
          </span>
        </div>
      </div>
    </section>
  );
};

export default SolutionGrid;
