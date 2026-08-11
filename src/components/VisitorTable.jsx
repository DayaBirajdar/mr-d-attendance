function VisitorTable({
  visitors,
  onEdit,
  onDelete,
}) {
  return (
    <table className="inventory-table">

      <thead>
        <tr>
          <th>ID</th>
          <th>Visitor Name</th>
          <th>Company</th>
          <th>Mobile</th>
          <th>Person To Meet</th>
          <th>Purpose</th>
          <th>Status</th>
          <th>Check In</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>

        {visitors.length === 0 ? (
          <tr>
            <td
              colSpan="9"
              style={{ textAlign: "center" }}
            >
              No Visitors Found
            </td>
          </tr>
        ) : (

          visitors.map((visitor) => (

            <tr key={visitor.id}>

              <td>{visitor.id}</td>

              <td>{visitor.visitor_name}</td>

              <td>{visitor.company}</td>

              <td>{visitor.mobile}</td>

              <td>{visitor.person_to_meet}</td>

              <td>{visitor.purpose}</td>

              <td>{visitor.status}</td>

              <td>
                {visitor.check_in
                  ? new Date(visitor.check_in).toLocaleString()
                  : "-"}
              </td>

              <td>

                <button
                  className="edit-btn"
                  onClick={() => onEdit(visitor)}
                >
                  Edit
                </button>

                <button
                  className="delete-btn"
                  style={{ marginLeft: "10px" }}
                  onClick={() => onDelete(visitor.id)}
                >
                  Delete
                </button>

              </td>

            </tr>

          ))

        )}

      </tbody>

    </table>
  );
}

export default VisitorTable;