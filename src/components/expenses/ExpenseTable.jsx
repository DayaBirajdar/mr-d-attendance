function ExpenseTable({
  expenses,
  focusedExpenseId,
  onEdit,
  onDelete,
  isOnline = true,
}) {
  return (
    <table className="inventory-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Expense</th>
          <th>Category</th>
          <th>Vendor</th>
          <th>Amount</th>
          <th>Payment</th>
          <th>Invoice</th>
          <th>Status</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {expenses.length === 0 ? (
          <tr>
            <td colSpan="10" style={{ textAlign: "center" }}>
              No Expenses Found
            </td>
          </tr>
        ) : (
          expenses.map((expense) => (
            <tr
              key={expense.id}
              data-expense-id={expense.id}
              className={
                Number(expense.id) ===
                Number(focusedExpenseId)
                  ? "expense-focus-row"
                  : ""
              }
            >
              <td>{expense.id}</td>

              <td>{expense.expense_name}</td>

              <td>{expense.category}</td>

              <td>{expense.vendor_name || "-"}</td>

              <td>
                ₹ {Number(expense.amount || 0).toLocaleString()}
              </td>

              <td>{expense.payment_mode}</td>

              <td>{expense.invoice_no || "-"}</td>

              <td>
                <span
                  className={`status ${(
                    expense.status || "Paid"
                  )
                    .toLowerCase()
                    .replace(" ", "")}`}
                >
                  {expense.status || "Paid"}
                </span>
              </td>

              <td>{expense.expense_date}</td>

              <td>
                <button
                  className="edit-btn"
                  disabled={!isOnline}
                  title={
                    !isOnline
                      ? "Reconnect to edit"
                      : "Edit"
                  }
                  style={{
                    opacity: isOnline
                      ? 1
                      : 0.5,
                    cursor: isOnline
                      ? "pointer"
                      : "not-allowed",
                  }}
                  onClick={() => onEdit(expense)}
                >
                  ✏️
                </button>

                <button
                  className="delete-btn"
                  disabled={!isOnline}
                  title={
                    !isOnline
                      ? "Reconnect to delete"
                      : "Delete"
                  }
                  onClick={() => onDelete(expense.id)}
                  style={{
                    marginLeft: "10px",
                    opacity: isOnline
                      ? 1
                      : 0.5,
                    cursor: isOnline
                      ? "pointer"
                      : "not-allowed",
                  }}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default ExpenseTable;