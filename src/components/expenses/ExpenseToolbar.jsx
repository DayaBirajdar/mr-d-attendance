function ExpenseToolbar({ search, setSearch, onAdd }) {
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
        onClick={onAdd}
      >
        + Add Expense
      </button>

    </div>
  );
}

export default ExpenseToolbar;