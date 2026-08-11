import { useEffect, useState } from "react";

function AddVendorModal({
  vendor,
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
    if (vendor) {
      setFormData({
        company: vendor.company || "",
        contact_person: vendor.contact_person || "",
        phone: vendor.phone || "",
        email: vendor.email || "",
        gst: vendor.gst || "",
        address: vendor.address || "",
        remarks: vendor.remarks || "",
      });
    }
  }, [vendor]);

  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {vendor ? "Edit Vendor" : "Add Vendor"}
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
              💾 Save
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