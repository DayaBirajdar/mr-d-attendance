function RecentActivity({ activity }) {
  return (
    <div className="activity-card">

      <div className="activity-icon">
        {activity.icon}
      </div>

      <div className="activity-info">
        <div className="activity-title-row">
          <strong>{activity.module}</strong>

          <span className="activity-action">
            {activity.action}
          </span>
        </div>

        <div className="activity-name">
          {activity.title}
        </div>

        {activity.details && (
          <div className="activity-details">
            {activity.details}
          </div>
        )}
      </div>

      <div className="activity-meta">
        <div className="activity-actor">
          👤 {activity.actor}
        </div>

        <div className="activity-time">
          {activity.time}
        </div>
      </div>

    </div>
  );
}

export default RecentActivity;
