function RenewalToolbar({
  search,
  setSearch,
  onAdd,
  isOnline = true,
}) {
  return (
    <div className="toolbar">

      <input
        type="text"
        placeholder="Search renewals..."
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
            ? "Reconnect to add renewal"
            : "Add Renewal"
        }
        style={{
          opacity: isOnline ? 1 : 0.5,
          cursor: isOnline
            ? "pointer"
            : "not-allowed",
        }}
        onClick={onAdd}
      >
        + Add Renewal
      </button>

    </div>
  );
}

export default RenewalToolbar;