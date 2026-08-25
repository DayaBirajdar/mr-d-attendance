function ExpenseToolbar({
  search,
  setSearch,
  onAdd,
  isOnline = true,
}) {
  return (
    <div className="inventory-toolbar">

      <input
        type="text"
        placeholder="Search expenses..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <button
        className="add-btn"
        disabled={!isOnline}
        title={
          !isOnline
            ? "Reconnect to add expense"
            : "Add Expense"
        }
        style={{
          opacity: isOnline ? 1 : 0.5,
          cursor: isOnline
            ? "pointer"
            : "not-allowed",
        }}
        onClick={onAdd}
      >
        + Add Expense
      </button>

    </div>
  );
}

export default ExpenseToolbar;