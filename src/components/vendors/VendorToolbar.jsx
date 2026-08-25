function VendorToolbar({
  search,
  setSearch,
  onAdd,
  isOnline = true,
}) {
  return (
    <div className="toolbar">

      <input
        type="text"
        placeholder="Search vendor..."
        value={search}
        onChange={(e) =>
          setSearch(e.target.value)
        }
        className="search-box"
      />

      <button
        className="add-btn"
        disabled={!isOnline}
        title={
          !isOnline
            ? "Reconnect to add vendor"
            : "Add Vendor"
        }
        style={{
          opacity: isOnline ? 1 : 0.5,
          cursor: isOnline
            ? "pointer"
            : "not-allowed",
        }}
        onClick={onAdd}
      >
        + Add Vendor
      </button>

    </div>
  );
}

export default VendorToolbar;