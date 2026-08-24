import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

import DashboardCard from "../components/dashboard/DashboardCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import AIBriefing from "../components/dashboard/AIBriefing";
import BusinessOverview from "../components/dashboard/BusinessOverview";
import OperationsAlerts from "../components/dashboard/OperationsAlerts";

function Dashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    inventory: 0,
    expenses: 0,
    events: 0,
    vendors: 0,
    documents: 0,
    visitors: 0,
    renewals: 0,
    expiredRenewals: 0,
    dueRenewals: 0,
  });

  const [now, setNow] =
    useState(
      new Date()
    );

  const [weather, setWeather] =
    useState(null);

  const [weatherError, setWeatherError] =
    useState(false);

  const [recentActivities, setRecentActivities] =
    useState([]);

  useEffect(() => {
    loadDashboard();
    loadWeather();
    loadRecentActivities();

    const clockTimer =
      setInterval(
        () => {
          setNow(
            new Date()
          );
        },
        1000
      );

    const weatherTimer =
      setInterval(
        () => {
          loadWeather();
        },
        15 * 60 * 1000
      );

    return () => {
      clearInterval(
        clockTimer
      );

      clearInterval(
        weatherTimer
      );
    };
  }, []);

  async function loadWeather() {
    try {
      const response =
        await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=19.0760&longitude=72.8777&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code&timezone=Asia%2FKolkata&forecast_days=1"
        );

      if (!response.ok) {
        throw new Error(
          "Weather request failed"
        );
      }

      const data =
        await response.json();

      const current =
        data.current || {};

      const code =
        Number(
          current.weather_code
        );

      const condition =
        (() => {
          if (code === 0) return "Clear";
          if (code === 1) return "Mostly Clear";
          if (code === 2) return "Partly Cloudy";
          if (code === 3) return "Overcast";

          if (
            code === 45 ||
            code === 48
          ) {
            return "Fog";
          }

          if (
            [51, 53, 55, 56, 57].includes(
              code
            )
          ) {
            return "Drizzle";
          }

          if (
            [61, 63, 65, 66, 67].includes(
              code
            )
          ) {
            return "Rain";
          }

          if (
            [80, 81, 82].includes(
              code
            )
          ) {
            return "Rain Showers";
          }

          if (
            [95, 96, 99].includes(
              code
            )
          ) {
            return "Thunderstorm";
          }

          return "Weather";
        })();

      setWeather({
        temperature:
          current.temperature_2m,
        feelsLike:
          current.apparent_temperature,
        humidity:
          current.relative_humidity_2m,
        condition,
      });

      setWeatherError(false);
    } catch (error) {
      console.error(
        "Dashboard weather error:",
        error
      );

      setWeatherError(true);
    }
  }

  async function loadDashboard() {
    const [
      inventory,
      expenses,
      events,
      vendors,
      documents,
      visitors,
      renewals,
    ] = await Promise.all([
      supabase
        .from("inventory")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("expenses")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("events")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("vendors")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("documents")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("visitors")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("renewals")
        .select("*", { count: "exact", head: true }),
    ]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: renewalData } = await supabase
      .from("renewals")
      .select("renewal_date");

    const expiredRenewals =
      renewalData?.filter((item) => {
        const renewalDate = new Date(item.renewal_date);
        renewalDate.setHours(0, 0, 0, 0);

        return renewalDate < today;
      }).length || 0;

    const dueRenewals =
      renewalData?.filter((item) => {
        const renewalDate = new Date(item.renewal_date);
        renewalDate.setHours(0, 0, 0, 0);

        const diff = Math.ceil(
          (renewalDate - today) /
            (1000 * 60 * 60 * 24)
        );

        return diff >= 0 && diff <= 30;
      }).length || 0;

    setStats({
      inventory: inventory.count || 0,
      expenses: expenses.count || 0,
      events: events.count || 0,
      vendors: vendors.count || 0,
      documents: documents.count || 0,
      visitors: visitors.count || 0,
      renewals: renewals.count || 0,
      expiredRenewals,
      dueRenewals,
    });
  }

  async function loadRecentActivities() {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) {
      console.error(
        "Recent Activities error:",
        error
      );
      return;
    }

    const getIcon = (module) => {
      switch (module) {
        case "Inventory":
          return "📦";
        case "Visitors":
          return "👤";
        case "Expenses":
          return "💰";
        case "Events":
          return "📅";
        case "Renewals":
          return "🔔";
        case "Documents":
          return "📄";
        case "Vendors":
          return "👥";
        case "Employees":
          return "👨‍💼";
        case "Attendance":
          return "🕒";
        case "Leave Management":
          return "📋";
        default:
          return "⚡";
      }
    };

    const getTimeLabel = (createdAt) => {
      if (!createdAt) return "";

      const created = new Date(createdAt);
      const now = new Date();

      const diffSeconds = Math.floor(
        (now - created) / 1000
      );

      if (diffSeconds < 60) {
        return "Just now";
      }

      const diffMinutes = Math.floor(
        diffSeconds / 60
      );

      if (diffMinutes < 60) {
        return `${diffMinutes} min ago`;
      }

      const diffHours = Math.floor(
        diffMinutes / 60
      );

      if (diffHours < 24) {
        return `${diffHours} hr ago`;
      }

      return created.toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    };

    const formatted =
      (data || []).map((item) => ({
        id: item.id,
        icon: getIcon(item.module),
        module: item.module,
        action: item.action,
        title: item.title,
        actor: item.actor || "Daya Birajdar",
        details: item.details || "",
        time: getTimeLabel(item.created_at),
      }));

    setRecentActivities(formatted);
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-heading">
          <h1>Operations Dashboard</h1>
          <p>Welcome to Mr.D AI Operations Platform.</p>
        </div>

        <div className="dashboard-live-card">
          <div className="dashboard-live-location">
            <span className="dashboard-weather-icon">
              {weather?.condition === "Clear"
                ? "☀️"
                : weather?.condition?.includes("Cloud")
                ? "⛅"
                : weather?.condition?.includes("Rain") ||
                  weather?.condition === "Drizzle"
                ? "🌧️"
                : weather?.condition === "Thunderstorm"
                ? "⛈️"
                : "🌤️"}
            </span>

            <div>
              <strong>Mumbai</strong>

              <span>
                {weather
                  ? `${weather.temperature}°C · ${weather.condition}`
                  : weatherError
                  ? "Weather unavailable"
                  : "Loading weather..."}
              </span>
            </div>
          </div>

          <div className="dashboard-live-divider" />

          <div className="dashboard-live-time">
            <strong>
              {now.toLocaleTimeString(
                "en-IN",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                }
              )}
            </strong>

            <span>
              {now.toLocaleDateString(
                "en-IN",
                {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }
              )}
            </span>
          </div>

          {weather && (
            <div className="dashboard-live-meta">
              Feels {weather.feelsLike}°C · Humidity {weather.humidity}%
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-quick-actions">
        <div className="dashboard-quick-actions-header">
          <div>
            <h3>⚡ Quick Actions</h3>
            <p>Jump straight into common operations.</p>
          </div>
        </div>

        <div className="dashboard-quick-actions-grid">
          <button
            type="button"
            onClick={() =>
              navigate("/inventory?action=add")
            }
          >
            <span>📦</span>
            <strong>Add Inventory</strong>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/visitors?action=add")
            }
          >
            <span>👤</span>
            <strong>Check In Visitor</strong>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/expenses?action=add")
            }
          >
            <span>💰</span>
            <strong>Add Expense</strong>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/events?action=add")
            }
          >
            <span>📅</span>
            <strong>Add Event</strong>
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/renewals?action=add")
            }
          >
            <span>🔔</span>
            <strong>Add Renewal</strong>
          </button>
        </div>
      </div>

      <AIBriefing />

<OperationsAlerts />

<BusinessOverview stats={stats} />

      <div className="dashboard-grid">

        <DashboardCard
          title="Inventory"
          value={stats.inventory}
          icon="📦"
          color="#2563eb"
        />

        <DashboardCard
          title="Expenses"
          value={stats.expenses}
          icon="💰"
          color="#16a34a"
        />

        <DashboardCard
          title="Events"
          value={stats.events}
          icon="📅"
          color="#ea580c"
        />

        <DashboardCard
          title="Vendors"
          value={stats.vendors}
          icon="👥"
          color="#9333ea"
        />

        <DashboardCard
          title="Visitors"
          value={stats.visitors}
          icon="👤"
          color="#0f766e"
        />

        <DashboardCard
          title="Documents"
          value={stats.documents}
          icon="📄"
          color="#0891b2"
        />

        <DashboardCard
          title="Renewals"
          value={stats.renewals}
          icon="🔔"
          color="#f59e0b"
        />

        <DashboardCard
          title="Expired Renewals"
          value={stats.expiredRenewals}
          icon="🔴"
          color="#dc2626"
        />

        <DashboardCard
          title="Due in 30 Days"
          value={stats.dueRenewals}
          icon="🟡"
          color="#facc15"
        />

        <DashboardCard
          title="AI Assistant"
          value="Ready"
          icon="🤖"
          color="#dc2626"
        />

      </div>

      <div className="recent-section">
        <h2>Recent Activities</h2>

        {recentActivities.map((activity) => (
          <RecentActivity
            key={activity.id}
            activity={activity}
          />
        ))}
      </div>
    </div>
  );
}

export default Dashboard;