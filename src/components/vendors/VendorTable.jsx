function VendorTable({
  vendors,
  focusedVendorId,
  onEdit,
  onDelete,
}) {
  return (
    <table className="inventory-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Company</th>
          <th>Contact Person</th>
          <th>Phone</th>
          <th>Email</th>
          <th>GST</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {vendors.length === 0 ? (
          <tr>
            <td colSpan="7" style={{ textAlign: "center" }}>
              No Vendors Found
            </td>
          </tr>
        ) : (
          vendors.map((vendor) => (
            <tr
              key={vendor.id}
              data-vendor-id={vendor.id}
              className={
                Number(vendor.id) ===
                Number(focusedVendorId)
                  ? "vendor-focus-row"
                  : ""
              }
            >
              <td>{vendor.id}</td>
              <td>{vendor.company}</td>
              <td>{vendor.contact_person}</td>
              <td>{vendor.phone}</td>
              <td>{vendor.email}</td>
              <td>{vendor.gst}</td>

              <td>
                <button
                  className="edit-btn"
                  onClick={() => onEdit(vendor)}
                >
                  ✏️
                </button>

                <button
                  className="delete-btn"
                  onClick={() => onDelete(vendor.id)}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default VendorTable;