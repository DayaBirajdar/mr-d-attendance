function RecentActivity({ activity }) {
  return (
    <div className="activity-card">

      <div className="activity-icon">
        {activity.icon}
      </div>

      <div className="activity-info">
        <h4>{activity.title}</h4>
        <p>{activity.time}</p>
      </div>

    </div>
  );
}

export default RecentActivity;