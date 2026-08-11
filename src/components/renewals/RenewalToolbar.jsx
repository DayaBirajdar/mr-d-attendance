function RenewalToolbar({
  search,
  setSearch,
  onAdd,
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
        onClick={onAdd}
      >
        + Add Renewal
      </button>

    </div>
  );
}

export default RenewalToolbar;