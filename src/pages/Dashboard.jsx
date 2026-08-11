import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import DashboardCard from "../components/dashboard/DashboardCard";
import RecentActivity from "../components/dashboard/RecentActivity";
import AIBriefing from "../components/dashboard/AIBriefing";
import BusinessOverview from "../components/dashboard/BusinessOverview";
import OperationsAlerts from "../components/dashboard/OperationsAlerts";

function Dashboard() {
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

  useEffect(() => {
    loadDashboard();
  }, []);

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

  const recentActivities = [
    {
      id: 1,
      title: "Dashboard connected successfully",
      time: "Today",
    },
    {
      id: 2,
      title: "Supabase Live Data Enabled",
      time: "Today",
    },
    {
      id: 3,
      title: "Visitors Module Connected",
      time: "Today",
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Operations Dashboard</h1>
        <p>Welcome to Mr.D AI Operations Platform.</p>
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