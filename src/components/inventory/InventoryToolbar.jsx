
function InventoryToolbar({
  search,
  setSearch,
  onAdd,
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
        onClick={onAdd}
      >
        + Add Inventory
      </button>

    </div>
  );
}

export default InventoryToolbar;