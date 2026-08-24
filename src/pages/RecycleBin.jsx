import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import "../styles/RecycleBin.css";

function RecycleBin() {
  const [items, setItems] = useState([]);

  function getActivityModule(table) {
    const modules = {
      inventory: "Inventory",
      visitors: "Visitors",
      expenses: "Expenses",
      events: "Events",
      renewals: "Renewals",
      vendors: "Vendors",
      documents: "Documents",
      employees: "Employees",
      attendance: "Attendance",
    };

    return modules[table] || "Recycle Bin";
  }

  function getActivityTitle(item) {
    const asset = item?.data || {};

    return (
      asset.name ||
      asset.title ||
      asset.company ||
      asset.expense_name ||
      asset.visitor_name ||
      `Record ${item?.original_id || ""}`.trim()
    );
  }

  useEffect(() => {
    loadRecycleBin();
  }, []);

  async function loadRecycleBin() {
    const { data, error } = await supabase
      .from("recycle_bin")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
  }

  async function restoreItem(item) {
    const asset = { ...item.data };

    // Remove old database-generated values before restoring
    delete asset.id;
    delete asset.created_at;

    const { error: insertError } = await supabase
      .from(item.original_table)
      .insert([asset]);

    if (insertError) {
      console.error(insertError);
      alert(JSON.stringify(insertError, null, 2));
      return;
    }

    const { error: deleteError } = await supabase
      .from("recycle_bin")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      console.error(deleteError);
      alert(JSON.stringify(deleteError, null, 2));
      return;
    }

    await logActivity({
      module: getActivityModule(
        item.original_table
      ),
      action: "Restored",
      title: getActivityTitle(item),
      details: "Restored from Recycle Bin",
    });

    loadRecycleBin();
  }

  async function deleteForever(item) {
    if (!window.confirm("Delete permanently?")) return;

    const { error } = await supabase
      .from("recycle_bin")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await logActivity({
      module: getActivityModule(
        item.original_table
      ),
      action: "Deleted Forever",
      title: getActivityTitle(item),
      details: "Permanently deleted from Recycle Bin",
    });

    loadRecycleBin();
  }

  return (
    <div className="recycle-page">
      <h1>🗑 Recycle Bin</h1>

      <table className="inventory-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Category</th>
            <th>Location</th>
            <th>Assigned To</th>
            <th>Status</th>
            <th>Deleted At</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                Recycle Bin is Empty
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const asset = item.data || {};

              // Support Events as well as existing Inventory records
              const isEvent = item.original_table === "events";

              const displayId =
                asset.id ?? item.original_id ?? item.id;

              const isVendor =
  item.original_table === "vendors";
  const isExpense =
  item.original_table === "expenses";
  const isVisitor =
  item.original_table === "visitors";

const displayName =
  asset.name ??
  asset.title ??
  asset.company ??
  asset.expense_name ??
  asset.visitor_name ??
  "-";

const displayCategory =
  asset.category ??
  (isEvent
    ? "Event"
    : isVendor
    ? "Vendor"
    : isExpense
    ? "Expense"
    : isVisitor
    ? "Visitor"
    : "-");

const displayLocation =
  asset.location ??
  asset.venue ??
  asset.address ??
  asset.company ??
  "-";

const displayAssignedTo =
  asset.assigned_to ??
  asset.owner ??
  asset.contact_person ??
  asset.vendor ??
  asset.person_to_meet ??
  "-";

const displayStatus =
  asset.status ??
  "-";

              return (
                <tr key={item.id}>
                  <td>{displayId}</td>

                  <td>{displayName}</td>

                  <td>{displayCategory}</td>

                  <td>{displayLocation}</td>

                  <td>{displayAssignedTo}</td>

                  <td>{displayStatus}</td>

                  <td>
                    {item.deleted_at
                      ? new Date(
                          item.deleted_at
                        ).toLocaleString()
                      : "-"}
                  </td>

                  <td>
                    <button
                      onClick={() =>
                        restoreItem(item)
                      }
                    >
                      Restore
                    </button>

                    <button
                      style={{
                        marginLeft: 10,
                        background: "red",
                        color: "white",
                      }}
                      onClick={() =>
                        deleteForever(item)
                      }
                    >
                      Delete Forever
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RecycleBin;