import { useEffect, useState } from "react";

function AddInventoryModal({ item, onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    category: "",
    location: "",
    assigned_to: "",
    status: "Available",
  });

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name || "",
        category: item.category || "",
        location: item.location || "",
        assigned_to: item.assigned_to || "",
        status: item.status || "Available",
      });
    } else {
      setForm({
        name: "",
        category: "",
        location: "",
        assigned_to: "",
        status: "Available",
      });
    }
  }, [item]);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {item ? "Edit Inventory" : "Add Inventory"}
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            name="name"
            placeholder="Item Name"
            value={form.name}
            onChange={handleChange}
            required
          />

          <input
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
            required
          />

          <input
            name="location"
            placeholder="Location"
            value={form.location}
            onChange={handleChange}
            required
          />

          <input
            name="assigned_to"
            placeholder="Assigned To"
            value={form.assigned_to}
            onChange={handleChange}
          />

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option>Available</option>
            <option>In Use</option>
            <option>Maintenance</option>
          </select>

          <div className="modal-buttons">

            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn-primary"
            >
              {item ? "Update" : "Save"}
            </button>

          </div>

        </form>

      </div>
    </div>
  );
}

export default AddInventoryModal;