import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import AddVisitorModal from "../components/visitors/AddVisitorModal";

function Visitors() {
  const [visitors, setVisitors] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  useEffect(() => {
  loadVisitors();

  const interval = setInterval(() => {
    setVisitors((prev) => [...prev]);
  }, 60000);

  return () => clearInterval(interval);
}, []);

  async function loadVisitors() {
    const { data, error } = await supabase
      .from("visitors")
.select("*")
.eq("is_deleted", false)
.order("check_in", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setVisitors(data || []);
  }

  async function handleSave(visitor) {
    let error;

    if (selectedVisitor) {
      ({ error } = await supabase
        .from("visitors")
        .update(visitor)
        .eq("id", selectedVisitor.id));
    } else {
      ({ error } = await supabase
        .from("visitors")
        .insert([visitor]));
    }

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    setShowModal(false);
    setSelectedVisitor(null);
    loadVisitors();
  }

  async function handleDelete(id) {
  if (!window.confirm("Move this visitor to Recycle Bin?"))
    return;

  const visitor = visitors.find((v) => v.id === id);

  if (!visitor) return;

  const { error: recycleError } = await supabase
    .from("recycle_bin")
    .insert([
      {
        original_table: "visitors",
        original_id: visitor.id,
        data: visitor,
        deleted_by: "Admin",
        deleted_at: new Date().toISOString(),
      },
    ]);

  if (recycleError) {
    console.error(recycleError);
    alert(JSON.stringify(recycleError, null, 2));
    return;
  }

  const { error } = await supabase
    .from("visitors")
    .delete()
    .eq("id", id);

  if (error) {
    console.error(error);
    alert("Unable to delete visitor.");
    return;
  }

  loadVisitors();
}

  async function handleCheckout(visitor) {
    const { error } = await supabase
      .from("visitors")
      .update({
        status: "Checked Out",
        check_out: new Date().toISOString(),
      })
      .eq("id", visitor.id);

    if (error) {
      console.error(error);
      return;
    }

    loadVisitors();
  }

  function handleEdit(visitor) {
    setSelectedVisitor(visitor);
    setShowModal(true);
  }

  function calculateDuration(checkIn, checkOut) {
    if (!checkIn) return "-";

    const start = new Date(checkIn);
    const end = checkOut ? new Date(checkOut) : new Date();

    const diff = Math.floor((end - start) / 1000);

    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (hours === 0) return `${minutes} min`;

    return `${hours}h ${minutes}m`;
  }

  const filteredVisitors = visitors.filter((visitor) =>
    visitor.visitor_name
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        👥 Visitor Management
      </h1>

      <p className="page-subtitle">
        Manage visitor check-in and check-out.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >

        <input
          className="search-box"
          placeholder="Search visitor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button
          className="add-btn"
          onClick={() => {
            setSelectedVisitor(null);
            setShowModal(true);
          }}
        >
          + Check In Visitor
        </button>

      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >

        <div className="summary-card">
          <h3>Total Visitors</h3>
          <h1>{filteredVisitors.length}</h1>
        </div>

        <div className="summary-card">
          <h3>Checked In</h3>
          <h1>
            {filteredVisitors.filter(v => v.status === "Checked In").length}
          </h1>
        </div>

        <div className="summary-card">
          <h3>Checked Out</h3>
          <h1>
            {filteredVisitors.filter(v => v.status === "Checked Out").length}
          </h1>
        </div>

        <div className="summary-card">
          <h3>Today's Visitors</h3>
          <h1>
            {filteredVisitors.filter(v => {
              if (!v.created_at) return false;

              return (
                v.created_at.slice(0, 10) ===
                new Date().toISOString().slice(0, 10)
              );
            }).length}
          </h1>
        </div>

      </div>

      <table className="inventory-table">

        <thead>

          <tr>

            <th>ID</th>
            <th>Visitor</th>
            <th>Company</th>
            <th>Host</th>
            <th>Mobile</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Duration</th>
            <th>Status</th>
            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {filteredVisitors.length === 0 ? (

            <tr>
              <td colSpan="10" style={{ textAlign: "center" }}>
                No Visitors Found
              </td>
            </tr>

          ) : (

            filteredVisitors.map((visitor) => (

              <tr key={visitor.id}>

                <td>{visitor.id}</td>

                <td>{visitor.visitor_name}</td>

                <td>{visitor.company}</td>

                <td>{visitor.person_to_meet}</td>

                <td>{visitor.phone}</td>

                <td>
                  {visitor.check_in
                    ? new Date(visitor.check_in).toLocaleString()
                    : "-"}
                </td>

                <td>
                  {visitor.check_out
                    ? new Date(visitor.check_out).toLocaleString()
                    : "-"}
                </td>

                <td>
                  {calculateDuration(
                    visitor.check_in,
                    visitor.check_out
                  )}
                </td>

                <td>
  <span
    className={
      visitor.status === "Checked In"
        ? "status-badge status-in"
        : "status-badge status-out"
    }
  >
    {visitor.status}
  </span>
</td>

                <td>

                  <button
                    className="edit-btn"
                    onClick={() => handleEdit(visitor)}
                  >
                    Edit
                  </button>

                  {visitor.status === "Checked In" && (

                    <button
                      style={{ marginLeft: "8px" }}
                      onClick={() => handleCheckout(visitor)}
                    >
                      Check Out
                    </button>

                  )}

                  <button
                    className="delete-btn"
                    style={{ marginLeft: "8px" }}
                    onClick={() => handleDelete(visitor.id)}
                  >
                    Delete
                  </button>

                </td>

              </tr>

            ))

          )}

        </tbody>

      </table>

      {showModal && (

        <AddVisitorModal
          item={selectedVisitor}
          onClose={() => {
            setShowModal(false);
            setSelectedVisitor(null);
          }}
          onSave={handleSave}
        />

      )}

    </div>
  );
}

export default Visitors;