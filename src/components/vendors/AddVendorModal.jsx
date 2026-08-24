import { useEffect, useState } from "react";

function AddVendorModal({
  item,
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({
    company: "",
    contact_person: "",
    phone: "",
    email: "",
    gst: "",
    address: "",
    remarks: "",
  });

  useEffect(() => {
    if (item) {
      setFormData({
        company: item.company || "",
        contact_person: item.contact_person || "",
        phone: item.phone || "",
        email: item.email || "",
        gst: item.gst || "",
        address: item.address || "",
        remarks: item.remarks || "",
      });
    } else {
      setFormData({
        company: "",
        contact_person: "",
        phone: "",
        email: "",
        gst: "",
        address: "",
        remarks: "",
      });
    }
  }, [item]);

  function handleChange(e) {
    const {
      name,
      value,
    } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    onSave(formData);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {item ? "✏️ Edit Vendor" : "➕ Add Vendor"}
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            name="company"
            placeholder="Company Name"
            value={formData.company}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="contact_person"
            placeholder="Contact Person"
            value={formData.contact_person}
            onChange={handleChange}
          />

          <input
            type="text"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
          />

          <input
            type="email"
            name="email"
            placeholder="Email Address"
            value={formData.email}
            onChange={handleChange}
          />

          <input
            type="text"
            name="gst"
            placeholder="GST Number"
            value={formData.gst}
            onChange={handleChange}
          />

          <textarea
            name="address"
            placeholder="Address"
            value={formData.address}
            onChange={handleChange}
          />

          <textarea
            name="remarks"
            placeholder="Remarks"
            value={formData.remarks}
            onChange={handleChange}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >

            <button type="submit">
              {item
                ? "Update Vendor"
                : "💾 Save Vendor"}
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

export default AddVendorModal;