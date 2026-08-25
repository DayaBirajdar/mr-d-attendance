function EmployeeTable({
  employees,
  focusedEmployeeId,
  onEdit,
  onDelete,
  isOnline = true,
}) {
  return (
    <table className="inventory-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Photo</th>
          <th>Employee ID</th>
          <th>Full Name</th>
          <th>Department</th>
          <th>Designation</th>
          <th>Phone</th>
          <th>Email</th>
          <th>Joining Date</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {employees.length === 0 ? (
          <tr>
            <td
              colSpan="11"
              style={{ textAlign: "center" }}
            >
              No Employees Found
            </td>
          </tr>
        ) : (
          employees.map((employee) => (
            <tr
              key={employee.id}
              data-employee-id={employee.id}
              className={
                Number(employee.id) ===
                Number(focusedEmployeeId)
                  ? "employee-focus-row"
                  : ""
              }
            >
              <td>{employee.id}</td>

              <td>
                {employee.photo_url ? (
                  <img
                    src={employee.photo_url}
                    alt={employee.full_name}
                    style={{
                      width: "55px",
                      height: "55px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #ddd",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "55px",
                      height: "55px",
                      borderRadius: "50%",
                      background: "#e5e7eb",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "24px",
                    }}
                  >
                    👤
                  </div>
                )}
              </td>

              <td>{employee.employee_id}</td>

              <td>
                <strong>{employee.full_name}</strong>
              </td>

              <td>{employee.department}</td>

              <td>{employee.designation}</td>

              <td>{employee.phone}</td>

              <td>{employee.email}</td>

              <td>{employee.joining_date}</td>

              <td>
                <span
                  className={
                    employee.status === "Active"
                      ? "status-badge status-in"
                      : "status-badge status-out"
                  }
                >
                  {employee.status}
                </span>
              </td>

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
                  onClick={() => onEdit(employee)}
                >
                  Edit
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
                    marginLeft: "10px",
                    opacity: isOnline
                      ? 1
                      : 0.5,
                    cursor: isOnline
                      ? "pointer"
                      : "not-allowed",
                  }}
                  onClick={() => onDelete(employee.id)}
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

export default EmployeeTable;