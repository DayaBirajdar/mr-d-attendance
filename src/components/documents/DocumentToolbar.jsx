function DocumentToolbar({
  search,
  setSearch,
  onAdd,
}) {
  return (
    <div className="toolbar">

      <input
        type="text"
        placeholder="Search document..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="search-box"
      />

      <button
        className="add-btn"
        onClick={onAdd}
      >
        + Upload Document
      </button>

    </div>
  );
}

export default DocumentToolbar;