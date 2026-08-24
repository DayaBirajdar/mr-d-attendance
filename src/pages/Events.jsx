import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";

import AddEventModal from "../components/events/AddEventModal";

function Events() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedEventId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;


  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      setSelectedEvent(null);
      setShowModal(true);

      setSearchParams(
        {},
        { replace: true }
      );
    }
  }, [
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (
      !focusedEventId ||
      events.length === 0
    ) {
      return;
    }

    const focusedEvent =
      events.find(
        (event) =>
          Number(event.id) ===
          Number(focusedEventId)
      );

    if (!focusedEvent) {
      return;
    }

    setSearch(
      focusedEvent.title || ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-event-id="${focusedEventId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedEventId,
    events,
  ]);


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

    await logActivity({
      module: "Events",
      action: selectedEvent ? "Updated" : "Added",
      title: event.title || "Event",
      details: [
        event.event_date && `Date: ${event.event_date}`,
        event.location && `Location: ${event.location}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    setShowModal(false);
    setSelectedEvent(null);

    loadEvents();
  }

  async function handleDelete(id) {
  const confirmDelete = window.confirm(
    "Move this event to Recycle Bin?"
  );

  if (!confirmDelete) return;

  const eventToDelete = events.find(
    (event) => event.id === id
  );

  if (!eventToDelete) {
    alert("Event not found.");
    return;
  }

  const {
    error: recycleError,
  } = await supabase
    .from("recycle_bin")
    .insert([
      {
        original_table: "events",
        original_id: eventToDelete.id,
        data: eventToDelete,
        deleted_by: "Admin",
        deleted_at: new Date().toISOString(),
      },
    ]);

  if (recycleError) {
    console.error(
      "Recycle Bin error:",
      recycleError
    );

    alert(
      JSON.stringify(
        recycleError,
        null,
        2
      )
    );

    return;
  }

  const {
    error: deleteError,
  } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (deleteError) {
    console.error(
      "Event delete error:",
      deleteError
    );

    alert(
      JSON.stringify(
        deleteError,
        null,
        2
      )
    );

    return;
  }

  await logActivity({
    module: "Events",
    action: "Moved to Recycle Bin",
    title: eventToDelete.title || "Event",
    details: eventToDelete.event_date
      ? `Date: ${eventToDelete.event_date}`
      : null,
  });

  loadEvents();
}

  function handleEdit(event) {
    setSelectedEvent(event);
    setShowModal(true);
  }

  const filteredEvents = focusedEventId
    ? events.filter(
        (event) =>
          Number(event.id) ===
          Number(focusedEventId)
      )
    : events.filter((event) =>
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

              <tr
                key={event.id}
                data-event-id={event.id}
                className={
                  Number(event.id) ===
                  Number(focusedEventId)
                    ? "event-focus-row"
                    : ""
                }
              >

                <td>{event.id}</td>

                <td>{event.title}</td>

                <td>{event.venue}</td>

                <td>{event.owner}</td>

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