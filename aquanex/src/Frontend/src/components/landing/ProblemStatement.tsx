import dropletsIcon from "../../assets/icons/icons8-water-droplet-32.png";
import cloudIcon from "../../assets/icons/icons8-cloud-48.png";
import thermometerIcon from "../../assets/icons/icons8-thermometer-48.png";
import alertTriangleIcon from "../../assets/icons/icons8-error-32.png";

const ProblemStatement = () => {
  const stats = [
    {
      value: "30-50%",
      label: "Water Loss",
      description: "Aging infrastructure causes leaks",
      icon: <img src={dropletsIcon} alt="Water Loss Icon" width={24} height={24} className="icon-hover" />,
      color: "text-destructive",
      bgColor: "bg-destructive/10",
      borderColor: "border-destructive/20"
    },
    {
      value: "<100mm",
      label: "Annual Rain",
      description: "High salinity groundwater",
      icon: <img src={cloudIcon} alt="Annual Rain Icon" width={24} height={24} className="icon-hover" />,
      color: "text-info",
      bgColor: "bg-info/10",
      borderColor: "border-info/20"
    },
    {
      value: ">50°C",
      label: "Summer Temps",
      description: "Crop stress & evaporation",
      icon: <img src={thermometerIcon} alt="Summer Temps Icon" width={24} height={24} className="icon-hover" />,
      color: "text-warning",
      bgColor: "bg-warning/10",
      borderColor: "border-warning/20"
    }
  ];

  return (
    <section className="container mx-auto px-4 max-w-7xl py-32">
      {/* Section Header */}
      <div className="text-center mb-20">
        <div className="flex items-center justify-center mb-6">
          <img src={alertTriangleIcon} alt="Irrigation Crisis Warning Icon" width={40} height={40} className="text-warning mr-4 icon-hover" />
          <h2 className="text-5xl font-bold text-foreground">
            The Irrigation Crisis in the UAE & MEA
          </h2>
        </div>
        <p className="text-xl text-muted-foreground max-w-4xl mx-auto font-light leading-relaxed">
          Harsh climate conditions and aging infrastructure create unprecedented challenges for agriculture
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-10 mb-16">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="text-center p-10 bg-card border-2 border-border rounded-3xl hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 group cursor-pointer"
          >
            {/* Icon */}
            <div className={`w-20 h-20 ${stat.bgColor} rounded-2xl flex items-center justify-center mx-auto mb-8 group-hover:scale-110 transition-transform duration-500 border ${stat.borderColor}`}>
              <div className={stat.color}>
                {stat.icon}
              </div>
            </div>
            
            {/* Value */}
            <div className={`text-6xl font-bold ${stat.color} mb-4`}>
              {stat.value}
            </div>
            
            {/* Label */}
            <div className="text-2xl font-semibold text-foreground mb-4">
              {stat.label}
            </div>
            
            {/* Description */}
            <div className="text-muted-foreground leading-relaxed font-medium">
              {stat.description}
            </div>
          </div>
        ))}
      </div>

      {/* Context Paragraph */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-muted/50 p-12 rounded-3xl border border-border">
          <p className="text-muted-foreground text-center leading-relaxed text-xl font-light">
            <span className="font-semibold text-foreground">Traditional systems rely on manual inspections, 
            reactive maintenance, and static schedules</span> — 
            costing farms millions in lost water and yield. 
            In a region where every drop counts, these outdated approaches are no longer sustainable.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProblemStatement;
