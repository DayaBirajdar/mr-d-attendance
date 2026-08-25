
function InventoryToolbar({
  search,
  setSearch,
  onAdd,
  isOnline = true,
}) {
  return (
    <div className="inventory-toolbar">

      <input
        type="text"
        placeholder="🔍 Search inventory..."
        className="inventory-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select className="inventory-filter">
        <option>All Categories</option>
      </select>

      <select className="inventory-filter">
        <option>All Locations</option>
      </select>

      <select className="inventory-filter">
        <option>All Status</option>
      </select>

      <button
        className="btn-primary"
        disabled={!isOnline}
        title={
          !isOnline
            ? "Reconnect to add inventory"
            : "Add Inventory"
        }
        style={{
          opacity: isOnline ? 1 : 0.5,
          cursor: isOnline
            ? "pointer"
            : "not-allowed",
        }}
        onClick={onAdd}
      >
        + Add Inventory
      </button>

    </div>
  );
}

export default InventoryToolbar;