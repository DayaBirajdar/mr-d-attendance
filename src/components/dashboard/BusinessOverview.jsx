function BusinessOverview({ stats }) {
  const max = Math.max(
    stats.inventory,
    stats.expenses,
    stats.events,
    stats.vendors,
    stats.documents,
    stats.visitors,
    1
  );

  const items = [
    {
      label: "Inventory",
      value: stats.inventory,
      icon: "📦",
      color: "#2563eb",
    },
    {
      label: "Expenses",
      value: stats.expenses,
      icon: "💰",
      color: "#16a34a",
    },
    {
      label: "Events",
      value: stats.events,
      icon: "📅",
      color: "#ea580c",
    },
    {
      label: "Visitors",
      value: stats.visitors,
      icon: "👤",
      color: "#0f766e",
    },
    {
      label: "Documents",
      value: stats.documents,
      icon: "📄",
      color: "#0891b2",
    },
    {
      label: "Vendors",
      value: stats.vendors,
      icon: "👥",
      color: "#9333ea",
    },
  ];

  return (
    <div className="business-overview">

      <h2>📊 Business Overview</h2>

      {items.map((item) => (

        <div
          key={item.label}
          className="overview-row"
        >

          <div className="overview-label">
            <span>{item.icon}</span>

            <strong>{item.label}</strong>
          </div>

          <div className="overview-bar">

            <div
              className="overview-fill"
              style={{
                width: `${(item.value / max) * 100}%`,
                background: item.color,
              }}
            />

          </div>

          <div className="overview-value">
            {item.value}
          </div>

        </div>

      ))}

    </div>
  );
}

export default BusinessOverview;