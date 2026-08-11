function VendorToolbar({
  search,
  setSearch,
  onAdd,
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
        onClick={onAdd}
      >
        + Add Vendor
      </button>

    </div>
  );
}

export default VendorToolbar;