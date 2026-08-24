import { useState, useEffect } from "react";

function AddEventModal({
  item,
  onClose,
  onSave,
}) {
  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [budget, setBudget] = useState("");
  const [status, setStatus] = useState("Planned");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setVenue(item.venue || "");
      setOrganizer(item.organizer || "");
      setEventDate(item.event_date || "");
      setEventTime(item.event_time || "");
      setBudget(item.budget || "");
      setStatus(item.status || "Planned");
      setRemarks(item.remarks || "");
    } else {
      setTitle("");
      setVenue("");
      setOrganizer("");
      setEventDate("");
      setEventTime("");
      setBudget("");
      setStatus("Planned");
      setRemarks("");
    }
  }, [item]);

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      title,
      venue,
      owner: organizer,
      event_date: eventDate,
      event_time: eventTime,
      budget,
      status,
      remarks,
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>
          {item ? "✏️ Edit Event" : "📅 Add Event"}
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Venue"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Organizer"
            value={organizer}
            onChange={(e) => setOrganizer(e.target.value)}
          />

          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            required
          />

          <input
            type="time"
            value={eventTime}
            onChange={(e) => setEventTime(e.target.value)}
          />

          <input
            type="number"
            placeholder="Budget"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Planned">Planned</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <textarea
            placeholder="Remarks"
            rows="4"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <button type="submit">
              {item ? "Update Event" : "Save Event"}
            </button>

            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddEventModal;