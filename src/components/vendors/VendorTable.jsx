function VendorTable({
  vendors,
  focusedVendorId,
  onEdit,
  onDelete,
  isOnline = true,
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
                  disabled={!isOnline}
                  title={
                    !isOnline
                      ? "Reconnect to edit"
                      : "Edit"
                  }
                  style={{
                    opacity: isOnline
                      ? 1
                      : 0.5,
                    cursor: isOnline
                      ? "pointer"
                      : "not-allowed",
                  }}
                  onClick={() => onEdit(vendor)}
                >
                  ✏️
                </button>

                <button
                  className="delete-btn"
                  disabled={!isOnline}
                  title={
                    !isOnline
                      ? "Reconnect to delete"
                      : "Delete"
                  }
                  style={{
                    opacity: isOnline
                      ? 1
                      : 0.5,
                    cursor: isOnline
                      ? "pointer"
                      : "not-allowed",
                  }}
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