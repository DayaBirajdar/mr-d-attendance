import { useEffect, useState } from "react";

function AddVisitorModal({
  item,
  onClose,
  onSave,
}) {
  const [visitorName, setVisitorName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [personToMeet, setPersonToMeet] = useState("");
  const [purpose, setPurpose] = useState("");
  const [status, setStatus] = useState("Checked In");

  useEffect(() => {
    if (item) {
      setVisitorName(item.visitor_name || "");
      setCompany(item.company || "");
      setPhone(item.phone || "");
      setPersonToMeet(item.person_to_meet || "");
      setPurpose(item.purpose || "");
      setStatus(item.status || "Checked In");
    } else {
      setVisitorName("");
      setCompany("");
      setPhone("");
      setPersonToMeet("");
      setPurpose("");
      setStatus("Checked In");
    }
  }, [item]);

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      visitor_name: visitorName,
      company,
      phone,
      person_to_meet: personToMeet,
      purpose,
      status,
      check_in:
        item?.check_in || new Date().toISOString(),
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {item ? "✏️ Edit Visitor" : "👥 Visitor Check In"}
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            placeholder="Visitor Name"
            value={visitorName}
            onChange={(e) => setVisitorName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />

          <input
            type="text"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            type="text"
            placeholder="Person To Meet"
            value={personToMeet}
            onChange={(e) => setPersonToMeet(e.target.value)}
          />

          <textarea
            rows="3"
            placeholder="Purpose of Visit"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="Checked In">Checked In</option>
            <option value="Checked Out">Checked Out</option>
          </select>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <button
              type="submit"
              className="add-btn"
            >
              {item ? "Update Visitor" : "Check In"}
            </button>

            <button
              type="button"
              className="delete-btn"
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

export default AddVisitorModal;