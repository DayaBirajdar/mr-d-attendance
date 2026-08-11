import { useEffect, useState } from "react";

function AddExpenseModal({
  expense,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    expense_name: "",
    expense_date: "",
    category: "",
    vendor_name: "",
    amount: "",
    payment_mode: "",
    invoice_no: "",
    status: "Paid",
    remarks: "",
  });

  useEffect(() => {
    if (expense) {
      setForm({
        expense_name: expense.expense_name || "",
        expense_date: expense.expense_date || "",
        category: expense.category || "",
        vendor_name: expense.vendor_name || "",
        amount: expense.amount || "",
        payment_mode: expense.payment_mode || "",
        invoice_no: expense.invoice_no || "",
        status: expense.status || "Paid",
        remarks: expense.remarks || "",
      });
    }
  }, [expense]);

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave(form);
  }

  return (
    <div className="modal-overlay">
      <div className="modal">

        <h2>
          {expense ? "Edit Expense" : "Add Expense"}
        </h2>

        <form onSubmit={handleSubmit}>

          <input
            type="text"
            name="expense_name"
            placeholder="Expense Name"
            value={form.expense_name}
            onChange={handleChange}
            required
          />

          <input
            type="date"
            name="expense_date"
            value={form.expense_date}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="category"
            placeholder="Category"
            value={form.category}
            onChange={handleChange}
            required
          />

          <input
            type="text"
            name="vendor_name"
            placeholder="Vendor Name"
            value={form.vendor_name}
            onChange={handleChange}
          />

          <input
            type="number"
            name="amount"
            placeholder="Amount"
            value={form.amount}
            onChange={handleChange}
            required
          />

          <select
            name="payment_mode"
            value={form.payment_mode}
            onChange={handleChange}
            required
          >
            <option value="">Payment Mode</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Cheque">Cheque</option>
          </select>

          <input
            type="text"
            name="invoice_no"
            placeholder="Invoice Number"
            value={form.invoice_no}
            onChange={handleChange}
          />

          <select
            name="status"
            value={form.status}
            onChange={handleChange}
          >
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <textarea
            name="remarks"
            placeholder="Remarks"
            rows="3"
            value={form.remarks}
            onChange={handleChange}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button type="submit">
              💾 Save Expense
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

export default AddExpenseModal;