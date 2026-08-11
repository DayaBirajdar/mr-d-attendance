function DashboardCard({
  title,
  value,
  icon,
  color,
}) {
  return (
    <div
      className="dashboard-card"
      style={{
        borderTop: `5px solid ${color}`,
      }}
    >
      <div className="dashboard-icon">
        {icon}
      </div>

      <div className="dashboard-info">
        <h3>{title}</h3>
        <h1>{value}</h1>
      </div>
    </div>
  );
}

export default DashboardCard;