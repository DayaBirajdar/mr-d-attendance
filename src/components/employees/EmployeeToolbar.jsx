function EmployeeToolbar({
  search,
  setSearch,
  onAdd,
  isOnline = true,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: "20px",
      }}
    >
      <input
        className="search-box"
        type="text"
        placeholder="Search Employee..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
      />

      <button
        className="add-btn"
        disabled={!isOnline}
        title={
          !isOnline
            ? "Reconnect to add employee"
            : "Add Employee"
        }
        style={{
          opacity: isOnline ? 1 : 0.5,
          cursor: isOnline
            ? "pointer"
            : "not-allowed",
        }}
        onClick={onAdd}
      >
        + Add Employee
      </button>
    </div>
  );
}

export default EmployeeToolbar;