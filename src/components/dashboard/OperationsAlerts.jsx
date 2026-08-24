import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function OperationsAlerts() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  async function loadAlerts() {
    const [
      renewalsResult,
      eventsResult,
      visitorsResult,
      inventoryResult,
    ] = await Promise.all([
      supabase
        .from("renewals")
        .select("id,title,renewal_date"),

      supabase
        .from("events")
        .select("id,title,event_date"),

      supabase
        .from("visitors")
        .select(
          "id,visitor_name,status,check_in,is_deleted"
        )
        .eq("is_deleted", false),

      supabase
        .from("inventory")
        .select("id,name,status"),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items = [];

    // --------------------------------------------------
    // RENEWALS
    // --------------------------------------------------

    renewalsResult.data?.forEach((renewal) => {
      if (!renewal.renewal_date) return;

      const renewalDate = new Date(
        renewal.renewal_date
      );

      renewalDate.setHours(
        0,
        0,
        0,
        0
      );

      const diff = Math.ceil(
        (renewalDate - today) /
          (1000 * 60 * 60 * 24)
      );

      if (diff < 0) {
        items.push({
          type: "expired",
          priority: 1,
          title: renewal.title,
          message: `Renewal expired ${Math.abs(
            diff
          )} day(s) ago`,
        });
      } else if (diff <= 30) {
        items.push({
          type: "warning",
          priority: 2,
          title: renewal.title,
          message:
            diff === 0
              ? "Renewal is due today"
              : `Renewal due in ${diff} day(s)`,
        });
      }
    });

    // --------------------------------------------------
    // VISITORS CURRENTLY CHECKED IN
    // --------------------------------------------------

    const checkedInVisitors =
      visitorsResult.data?.filter(
        (visitor) =>
          visitor.status === "Checked In"
      ) || [];

    checkedInVisitors.forEach((visitor) => {
      items.push({
        type: "visitor",
        priority: 2,
        title:
          visitor.visitor_name ||
          "Visitor",
        message:
          "Visitor is currently checked in",
      });
    });

    // --------------------------------------------------
    // EVENTS IN NEXT 7 DAYS
    // --------------------------------------------------

    eventsResult.data?.forEach((event) => {
      if (!event.event_date) return;

      const eventDate = new Date(
        event.event_date
      );

      eventDate.setHours(
        0,
        0,
        0,
        0
      );

      const diff = Math.ceil(
        (eventDate - today) /
          (1000 * 60 * 60 * 24)
      );

      if (diff >= 0 && diff <= 7) {
        items.push({
          type: "event",
          priority: 3,
          title:
            event.title ||
            "Upcoming Event",
          message:
            diff === 0
              ? "Event is today"
              : diff === 1
              ? "Event is tomorrow"
              : `Event in ${diff} days`,
        });
      }
    });

    // --------------------------------------------------
    // INVENTORY IN MAINTENANCE
    // --------------------------------------------------

    inventoryResult.data?.forEach((item) => {
      if (
        item.status ===
        "Maintenance"
      ) {
        items.push({
          type: "maintenance",
          priority: 3,
          title:
            item.name ||
            "Inventory Item",
          message:
            "Item is under maintenance",
        });
      }
    });

    // Most important alerts first
    items.sort(
      (a, b) =>
        a.priority - b.priority
    );

    setAlerts(items);
  }

  function getAlertIcon(type) {
    switch (type) {
      case "expired":
        return "🔴";

      case "warning":
        return "🟡";

      case "visitor":
        return "👤";

      case "event":
        return "📅";

      case "maintenance":
        return "🛠️";

      default:
        return "🔔";
    }
  }

  return (
    <div className="business-overview">

      <h2>
        🚨 Operations Alerts
      </h2>

      {alerts.length === 0 ? (
        <div className="overview-row">
          <div className="overview-label">
            🟢 No active alerts
          </div>
        </div>
      ) : (
        alerts.map(
          (alert, index) => (
            <div
              key={`${alert.type}-${alert.title}-${index}`}
              className="overview-row"
            >
              <div className="overview-label">
                <span>
                  {getAlertIcon(
                    alert.type
                  )}
                </span>{" "}

                <strong>
                  {alert.title}
                </strong>
              </div>

              <div className="overview-value">
                {alert.message}
              </div>
            </div>
          )
        )
      )}

    </div>
  );
}

export default OperationsAlerts;
