import { useState } from "react";

function AttendanceTable({
  attendance,
  onEdit,
  onDelete,
  isOnline = true,
}) {
  const [previewImage, setPreviewImage] = useState(null);

  return (
    <>
      <table className="inventory-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Attendance Selfie</th>
            <th>Employee</th>
            <th>Employee ID</th>
            <th>Department</th>
            <th>Date</th>
            <th>Check In</th>
            <th>Check Out</th>
            <th>Working Hours</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {attendance.length === 0 ? (
            <tr>
              <td
                colSpan="11"
                style={{
                  textAlign: "center",
                }}
              >
                No Attendance Found
              </td>
            </tr>
          ) : (
            attendance.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>

                {/* Attendance Selfie */}
                <td>
                  {item.selfie_url ? (
                    <img
                      src={item.selfie_url}
                      alt="Attendance Selfie"
                      onClick={() =>
                        setPreviewImage(item.selfie_url)
                      }
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "cover",
                        borderRadius: "10px",
                        border: "2px solid #ddd",
                        cursor: "pointer",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "10px",
                        background: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "28px",
                      }}
                    >
                      📷
                    </div>
                  )}
                </td>

                {/* Employee */}
                <td>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    {item.employees?.photo_url ? (
                      <img
                        src={item.employees.photo_url}
                        alt={item.employees.full_name}
                        onClick={() =>
                          setPreviewImage(
                            item.employees.photo_url
                          )
                        }
                        style={{
                          width: "45px",
                          height: "45px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: "2px solid #ddd",
                          cursor: "pointer",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "45px",
                          height: "45px",
                          borderRadius: "50%",
                          background: "#e5e7eb",
                          display: "flex",
                          justifyContent: "center",
                          alignItems: "center",
                          fontSize: "22px",
                        }}
                      >
                        👤
                      </div>
                    )}

                    <strong>
                      {item.employees?.full_name}
                    </strong>
                  </div>
                </td>

                <td>{item.employees?.employee_id}</td>

                <td>{item.employees?.department}</td>

                <td>{item.attendance_date}</td>

                <td>
                  {item.check_in
                    ? new Date(item.check_in).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : "-"}
                </td>

                <td>
                  {item.check_out
                    ? new Date(item.check_out).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )
                    : "-"}
                </td>

                <td>{item.working_hours || "-"}</td>

                <td>
                  <span
                    className={
                      item.status === "Present"
                        ? "status-badge status-in"
                        : item.status === "Absent"
                        ? "status-badge status-out"
                        : "status-badge"
                    }
                  >
                    {item.status}
                  </span>
                </td>

                <td>
                  <button
                    className="edit-btn"
                    disabled={!isOnline}
                    title={
                      !isOnline
                        ? "Reconnect to edit attendance"
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
                    onClick={() => onEdit(item)}
                  >
                    Edit
                  </button>

                  <button
                    className="delete-btn"
                    disabled={!isOnline}
                    title={
                      !isOnline
                        ? "Reconnect to delete attendance"
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
                    onClick={() =>
                      onDelete(item.id)
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,.85)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999,
            cursor: "pointer",
          }}
        >
          <img
            src={previewImage}
            alt="Preview"
            style={{
              maxWidth: "90%",
              maxHeight: "90%",
              borderRadius: "15px",
              boxShadow: "0 0 25px #000",
            }}
          />
        </div>
      )}
    </>
  );
}

export default AttendanceTable;