function InventoryTable({
  items,
  getStatusClass,
  onEdit,
  onDelete,
}) {
  return (
    <table className="inventory-table">

      <thead>

        <tr>
          <th>ID</th>
          <th>Item Name</th>
          <th>Category</th>
          <th>Location</th>
          <th>Assigned To</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>

      </thead>

      <tbody>

        {items.map((item) => (

          <tr key={item.id}>

            <td>{item.id}</td>

            <td>{item.name}</td>

            <td>{item.category}</td>

            <td>{item.location}</td>

            <td>{item.assigned_to}</td>

            <td>
              <span className={getStatusClass(item.status)}>
                {item.status}
              </span>
            </td>

            <td>

              <button
                className="action-btn edit-btn"
                onClick={() => onEdit(item)}
              >
                ✏️
              </button>

              <button
                className="action-btn delete-btn"
                onClick={() => onDelete(item.id)}
              >
                🗑️
              </button>

            </td>

          </tr>

        ))}

      </tbody>

    </table>
  );
}

export default InventoryTable;