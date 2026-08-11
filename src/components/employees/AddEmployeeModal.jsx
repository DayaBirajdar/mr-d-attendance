import { useEffect, useState } from "react";

function AddEmployeeModal({
  item,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    employee_id: "",
    full_name: "",
    department: "",
    designation: "",
    phone: "",
    email: "",
    joining_date: "",
    status: "Active",
    photo_url: "",
  });

  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");

  useEffect(() => {
    if (item) {
      setForm({
        employee_id: item.employee_id || "",
        full_name: item.full_name || "",
        department: item.department || "",
        designation: item.designation || "",
        phone: item.phone || "",
        email: item.email || "",
        joining_date: item.joining_date || "",
        status: item.status || "Active",
        photo_url: item.photo_url || "",
      });

      setPhotoPreview(item.photo_url || "");
    } else {
      setForm({
        employee_id: "",
        full_name: "",
        department: "",
        designation: "",
        phone: "",
        email: "",
        joining_date: "",
        status: "Active",
        photo_url: "",
      });

      setPhoto(null);
      setPhotoPreview("");
    }
  }, [item]);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function handlePhotoChange(e) {
    const file = e.target.files[0];

    if (!file) return;

    setPhoto(file);

    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleSubmit(e) {
    e.preventDefault();

    onSave({
      ...form,
      photo,
    });
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {item ? "✏️ Edit Employee" : "👤 Add Employee"}
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            name="employee_id"
            placeholder="Employee ID"
            value={form.employee_id}
            onChange={handleChange}
            required
          />

          <input
            name="full_name"
            placeholder="Full Name"
            value={form.full_name}
            onChange={handleChange}
            required
          />

          <input
            name="department"
            placeholder="Department"
            value={form.department}
            onChange={handleChange}
          />

          <input
            name="designation"
            placeholder="Designation"
            value={form.designation}
            onChange={handleChange}
          />

          <input
            name="phone"
            placeholder="Phone"
            value={form.phone}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
          />

          <input
            type="date"
            name="joining_date"
            value={form.joining_date}
            onChange={handleChange}
          />

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <div style={{ marginTop: "15px" }}>

            <label>
              <strong>Employee Photo</strong>
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
            />

            {photoPreview && (
              <div style={{ marginTop: "10px" }}>
                <img
                  src={photoPreview}
                  alt="Employee"
                  style={{
                    width: "120px",
                    height: "120px",
                    objectFit: "cover",
                    borderRadius: "12px",
                    border: "2px solid #ddd",
                  }}
                />
              </div>
            )}

          </div>

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
              {item ? "Update Employee" : "Save Employee"}
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

export default AddEmployeeModal;