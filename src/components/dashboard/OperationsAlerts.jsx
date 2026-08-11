import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function OperationsAlerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    const { data } = await supabase
      .from("renewals")
      .select("*");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = [];

    data?.forEach((renewal) => {
      const renewalDate = new Date(renewal.renewal_date);
      renewalDate.setHours(0, 0, 0, 0);

      const diff = Math.ceil(
        (renewalDate - today) /
          (1000 * 60 * 60 * 24)
      );

      if (diff < 0) {
        items.push({
          type: "expired",
          title: renewal.title,
          message: `Expired ${Math.abs(diff)} day(s) ago`,
        });
      } else if (diff <= 30) {
        items.push({
          type: "warning",
          title: renewal.title,
          message: `Expires in ${diff} day(s)`,
        });
      }
    });

    setAlerts(items);
  }

  return (
    <div className="business-overview">

      <h2>🚨 Operations Alerts</h2>

      {alerts.length === 0 ? (

        <div className="overview-row">
          <div className="overview-label">
            🟢 No active alerts
          </div>
        </div>

      ) : (

        alerts.map((alert, index) => (
          <div
            key={index}
            className="overview-row"
          >
            <div className="overview-label">
              {alert.type === "expired"
                ? "🔴"
                : "🟡"}{" "}
              <strong>{alert.title}</strong>
            </div>

            <div className="overview-value">
              {alert.message}
            </div>
          </div>
        ))

      )}

    </div>
  );
}

export default OperationsAlerts;