function DocumentToolbar({
  search,
  setSearch,
  onAdd,
  isOnline = true,
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
        disabled={!isOnline}
        title={
          !isOnline
            ? "Reconnect to upload a document"
            : "Upload Document"
        }
        style={{
          opacity: isOnline ? 1 : 0.5,
          cursor: isOnline
            ? "pointer"
            : "not-allowed",
        }}
        onClick={onAdd}
      >
        + Upload Document
      </button>

    </div>
  );
}

export default DocumentToolbar;