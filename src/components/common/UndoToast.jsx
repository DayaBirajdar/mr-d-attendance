function UndoToast({ message, onUndo }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "15px",
        width: "100%",
      }}
    >
      <span>{message}</span>

      <button
        onClick={onUndo}
        style={{
          background: "#ffffff",
          color: "#2563eb",
          border: "none",
          borderRadius: "6px",
          padding: "6px 12px",
          cursor: "pointer",
          fontWeight: "bold",
        }}
      >
        UNDO
      </button>
    </div>
  );
}

export default UndoToast;