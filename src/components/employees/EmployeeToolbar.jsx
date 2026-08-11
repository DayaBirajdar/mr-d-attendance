function EmployeeToolbar({
  search,
  setSearch,
  onAdd,
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
        onClick={onAdd}
      >
        + Add Employee
      </button>
    </div>
  );
}

export default EmployeeToolbar;