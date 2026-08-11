import { useState, useEffect } from "react";

function AddRenewalModal({
  item,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    title: "",
    category: "",
    vendor: "",
    renewal_date: "",
    amount: "",
    status: "Active",
  });

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || "",
        category: item.category || "",
        vendor: item.vendor || "",
        renewal_date: item.renewal_date || "",
        amount: item.amount || "",
        status: item.status || "Active",
      });
    } else {
      setForm({
        title: "",
        category: "",
        vendor: "",
        renewal_date: "",
        amount: "",
        status: "Active",
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
          {item ? "✏️ Edit Renewal" : "🔔 Add Renewal"}
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            name="title"
            placeholder="Renewal Title"
            value={form.title}
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
            name="vendor"
            placeholder="Vendor"
            value={form.vendor}
            onChange={handleChange}
            required
          />

          <input
            type="date"
            name="renewal_date"
            value={form.renewal_date}
            onChange={handleChange}
            required
          />

          <input
            type="number"
            name="amount"
            placeholder="Amount"
            value={form.amount}
            onChange={handleChange}
            required
          />

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option value="Active">Active</option>
            <option value="Renewed">Renewed</option>
            <option value="Expired">Expired</option>
          </select>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit">
              {item ? "Update" : "Save"}
            </button>

          </div>

        </form>

      </div>
    </div>
  );
}

export default AddRenewalModal;