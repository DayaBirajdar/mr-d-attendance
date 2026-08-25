import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

function AIBriefing({
  isOnline = true,
}) {
  const [summary, setSummary] = useState({
    inventory: 0,
    expenses: 0,
    events: 0,
    documents: 0,
    vendors: 0,
    visitorsToday: 0,
    checkedIn: 0,
    maintenanceItems: 0,
  });

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    loadSummary();
  }, [isOnline]);

  async function loadSummary() {
    if (!navigator.onLine) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    const [
      inventory,
      expenses,
      events,
      documents,
      vendors,
      visitors,
    ] = await Promise.all([
      supabase
        .from("inventory")
        .select("*", { count: "exact" }),

      supabase
        .from("expenses")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("events")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("documents")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("vendors")
        .select("*", { count: "exact", head: true }),

      supabase
        .from("visitors")
        .select("*"),
    ]);

    const inventoryList = inventory.data || [];
    const visitorList = visitors.data || [];

    const maintenanceItems = inventoryList.filter(
      (item) => item.status === "Maintenance"
    ).length;

    const visitorsToday = visitorList.filter(
      (v) =>
        v.created_at &&
        v.created_at.slice(0, 10) === today
    ).length;

    const checkedIn = visitorList.filter(
      (v) => v.status === "Checked In"
    ).length;

    setSummary({
      inventory: inventory.count || 0,
      expenses: expenses.count || 0,
      events: events.count || 0,
      documents: documents.count || 0,
      vendors: vendors.count || 0,
      visitorsToday,
      checkedIn,
      maintenanceItems,
    });
  }

  const hour = new Date().getHours();

  let greeting = "Good Evening";

  if (hour < 12) greeting = "Good Morning";
  else if (hour < 17) greeting = "Good Afternoon";

  return (
    <div className="ai-briefing">

      <h2>🤖 {greeting}, Daya 👋</h2>

      <p>Here's your Operations Summary for today.</p>

      <ul>

        <li>
          👥 Visitors Today :
          <strong> {summary.visitorsToday}</strong>
        </li>

        <li>
          🟢 Currently Checked In :
          <strong> {summary.checkedIn}</strong>
        </li>

        <li>
          📦 Inventory Items :
          <strong> {summary.inventory}</strong>
        </li>

        <li>
          💰 Expenses :
          <strong> {summary.expenses}</strong>
        </li>

        <li>
          📅 Events :
          <strong> {summary.events}</strong>
        </li>

        <li>
          📄 Documents :
          <strong> {summary.documents}</strong>
        </li>

        <li>
          👥 Vendors :
          <strong> {summary.vendors}</strong>
        </li>

      </ul>

      <hr
        style={{
          margin: "20px 0",
        }}
      />

      <h3>📌 Today's Recommendations</h3>

      <ul>

        {summary.checkedIn > 0 && (
          <li>
            🟢 {summary.checkedIn} visitor(s) are still inside the office.
          </li>
        )}

        {summary.events > 0 && (
          <li>
            📅 Review your upcoming events.
          </li>
        )}

        {summary.maintenanceItems > 0 && (
          <li>
            🛠️ {summary.maintenanceItems} inventory item(s) need maintenance attention.
          </li>
        )}

        {summary.documents > 0 && (
          <li>
            📄 Review uploaded documents.
          </li>
        )}

      </ul>

    </div>
  );
}

export default AIBriefing;