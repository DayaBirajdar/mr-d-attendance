import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import AddEventModal from "../components/events/AddEventModal";

function Events() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setEvents(data || []);
  }

  async function handleSave(event) {
    let error;

    if (selectedEvent) {
      ({ error } = await supabase
        .from("events")
        .update(event)
        .eq("id", selectedEvent.id));
    } else {
      ({ error } = await supabase
        .from("events")
        .insert([event]));
    }

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    setShowModal(false);
    setSelectedEvent(null);

    loadEvents();
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm(
      "Delete this event?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Unable to delete event.");
      return;
    }

    loadEvents();
  }

  function handleEdit(event) {
    setSelectedEvent(event);
    setShowModal(true);
  }

  const filteredEvents = events.filter((event) =>
    event.title
      ?.toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        📅 Events Management
      </h1>

      <p className="page-subtitle">
        Manage all company events.
      </p>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >

        <input
          type="text"
          placeholder="Search event..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          className="search-box"
        />

        <button
          className="add-btn"
          onClick={() => {
            setSelectedEvent(null);
            setShowModal(true);
          }}
        >
          + Add Event
        </button>

      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >

        <div className="summary-card">
          <h3>Total Events</h3>
          <h1>{filteredEvents.length}</h1>
        </div>

        <div className="summary-card">
          <h3>Upcoming</h3>

          <h1>
            {
              filteredEvents.filter(
                (item) =>
                  item.event_date >=
                  new Date()
                    .toISOString()
                    .split("T")[0]
              ).length
            }
          </h1>
        </div>

        <div className="summary-card">
          <h3>Completed</h3>

          <h1>
            {
              filteredEvents.filter(
                (item) =>
                  item.status === "Completed"
              ).length
            }
          </h1>
        </div>

        <div className="summary-card">
          <h3>Planned</h3>

          <h1>
            {
              filteredEvents.filter(
                (item) =>
                  item.status === "Planned"
              ).length
            }
          </h1>
        </div>

      </div>

      <table className="inventory-table">

        <thead>

          <tr>

            <th>ID</th>
            <th>Title</th>
            <th>Venue</th>
            <th>Organizer</th>
            <th>Date</th>
            <th>Status</th>
            <th>Budget</th>
            <th>Actions</th>

          </tr>

        </thead>

        <tbody>

          {filteredEvents.length === 0 ? (

            <tr>

              <td
                colSpan="8"
                style={{
                  textAlign: "center",
                }}
              >
                No Events Found
              </td>

            </tr>

          ) : (

            filteredEvents.map((event) => (

              <tr key={event.id}>

                <td>{event.id}</td>

                <td>{event.title}</td>

                <td>{event.venue}</td>

                <td>{event.organizer}</td>

                <td>{event.event_date}</td>

                <td>{event.status}</td>

                <td>₹{event.budget}</td>

                <td>

                  <button
                    className="edit-btn"
                    onClick={() =>
                      handleEdit(event)
                    }
                  >
                    Edit
                  </button>

                  <button
                    className="delete-btn"
                    style={{
                      marginLeft: "10px",
                    }}
                    onClick={() =>
                      handleDelete(event.id)
                    }
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

        <AddEventModal
          item={selectedEvent}
          onClose={() => {
            setShowModal(false);
            setSelectedEvent(null);
          }}
          onSave={handleSave}
        />

      )}

    </div>
  );
}

export default Events;