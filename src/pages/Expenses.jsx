import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import ExpenseToolbar from "../components/expenses/ExpenseToolbar";
import ExpenseTable from "../components/expenses/ExpenseTable";
import AddExpenseModal from "../components/expenses/AddExpenseModal";
import ExpenseChart from "../components/expenses/ExpenseChart";

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedExpenseId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;


  useEffect(() => {
    loadExpenses();

    function handleOnline() {
      setIsOnline(true);
      loadExpenses();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedExpenses();
    }

    window.addEventListener(
      "online",
      handleOnline
    );

    window.addEventListener(
      "offline",
      handleOffline
    );

    return () => {
      window.removeEventListener(
        "online",
        handleOnline
      );

      window.removeEventListener(
        "offline",
        handleOffline
      );
    };
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
      if (!navigator.onLine) {
        alert(
          "You are offline. Adding expenses is unavailable until you reconnect."
        );

        setSearchParams(
          {},
          { replace: true }
        );

        return;
      }

      setSelectedExpense(null);
      setShowModal(true);

      setSearchParams(
        {},
        { replace: true }
      );
    }
  }, [
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (
      !focusedExpenseId ||
      expenses.length === 0
    ) {
      return;
    }

    const focusedExpense =
      expenses.find(
        (expense) =>
          Number(expense.id) ===
          Number(focusedExpenseId)
      );

    if (!focusedExpense) {
      return;
    }

    setSearch(
      focusedExpense.expense_name || ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-expense-id="${focusedExpenseId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedExpenseId,
    expenses,
  ]);


  async function loadCachedExpenses() {
    const cached =
      await readOfflineCache(
        "expenses"
      );

    if (!cached) {
      return false;
    }

    setExpenses(
      cached.data || []
    );

    setUsingCachedData(true);

    setCacheSavedAt(
      cached.savedAt || null
    );

    return true;
  }

  async function loadExpenses() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const foundCache =
        await loadCachedExpenses();

      if (!foundCache) {
        setExpenses([]);
        setUsingCachedData(false);
      }

      return;
    }

    setIsOnline(true);

    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .eq("is_deleted", false)
      .order("id", { ascending: false });

    if (error) {
      console.error(error);

      const foundCache =
        await loadCachedExpenses();

      if (!foundCache) {
        setExpenses([]);
      }

      return;
    }

    const freshExpenses =
      data || [];

    setExpenses(freshExpenses);
    setUsingCachedData(false);

    const savedAt =
      await saveOfflineCache(
        "expenses",
        freshExpenses
      );

    setCacheSavedAt(
      savedAt
    );
  }

  async function handleSave(expense) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Expense changes cannot be saved until you reconnect."
      );
      return;
    }

    let error;

    if (selectedExpense) {
      ({ error } = await supabase
        .from("expenses")
        .update(expense)
        .eq("id", selectedExpense.id));
    } else {
      ({ error } = await supabase
        .from("expenses")
        .insert([expense]));
    }

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await logActivity({
      module: "Expenses",
      action: selectedExpense ? "Updated" : "Added",
      title: expense.expense_name || "Expense",
      details: [
        expense.category && `Category: ${expense.category}`,
        expense.amount && `Amount: ₹${expense.amount}`,
        expense.expense_date && `Date: ${expense.expense_date}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    setShowModal(false);
    setSelectedExpense(null);
    loadExpenses();
  }

  async function handleDelete(id) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Expenses cannot be deleted until you reconnect."
      );
      return;
    }

    if (!window.confirm("Move this expense to Recycle Bin?"))
      return;

    const expense = expenses.find((e) => e.id === id);

    if (!expense) return;

    const { error: recycleError } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "expenses",
          original_id: expense.id,
          data: expense,
          deleted_by: "Admin",
          deleted_at: new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error(recycleError);
      alert(JSON.stringify(recycleError, null, 2));
      return;
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await logActivity({
      module: "Expenses",
      action: "Moved to Recycle Bin",
      title: expense.expense_name || "Expense",
      details: expense.amount
        ? `Amount: ₹${expense.amount}`
        : null,
    });

    loadExpenses();
  }

  function handleEdit(expense) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Expenses cannot be edited until you reconnect."
      );
      return;
    }

    setSelectedExpense(expense);
    setShowModal(true);
  }

  const filteredExpenses = focusedExpenseId
    ? expenses.filter(
        (expense) =>
          Number(expense.id) ===
          Number(focusedExpenseId)
      )
    : expenses.filter((expense) =>
        (expense.expense_name || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      );

  const totalAmount = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0
  );

  const thisMonthCount = filteredExpenses.filter((item) => {
    if (!item.expense_date) return false;

    const expenseDate = new Date(item.expense_date);
    const today = new Date();

    return (
      expenseDate.getMonth() === today.getMonth() &&
      expenseDate.getFullYear() === today.getFullYear()
    );
  }).length;

  const todayCount = filteredExpenses.filter((item) => {
    if (!item.expense_date) return false;

    return (
      item.expense_date ===
      new Date().toISOString().split("T")[0]
    );
  }).length;

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        💰 Expense Management
      </h1>

      <p className="page-subtitle">
        Manage all office expenses.
      </p>

      {!isOnline && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "#fff7ed",
            border: "1px solid #fdba74",
            color: "#9a3412",
            fontWeight: "600",
          }}
        >
          📡 Offline
          {usingCachedData
            ? " — showing last saved data"
            : " — no saved Expense data is available"}

          {usingCachedData &&
            cacheSavedAt && (
              <span
                style={{
                  fontWeight: "400",
                  marginLeft: "8px",
                }}
              >
                Last updated:{" "}
                {new Date(
                  cacheSavedAt
                ).toLocaleString()}
              </span>
            )}
        </div>
      )}

      <ExpenseToolbar
        search={search}
        setSearch={setSearch}
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

          setSelectedExpense(null);
          setShowModal(true);
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <div className="summary-card">
          <h3>Total Expenses</h3>
          <h1>{expenses.length}</h1>
        </div>

        <div className="summary-card">
          <h3>Total Amount</h3>
          <h1>₹ {totalAmount.toLocaleString()}</h1>
        </div>

        <div className="summary-card">
          <h3>This Month</h3>
          <h1>{thisMonthCount}</h1>
        </div>

        <div className="summary-card">
          <h3>Today's Expenses</h3>
          <h1>{todayCount}</h1>
        </div>
      </div>

      <ExpenseChart expenses={filteredExpenses} />

      <ExpenseTable
        expenses={filteredExpenses}
        focusedExpenseId={focusedExpenseId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOnline={isOnline}
      />

      {showModal && (
        <AddExpenseModal
          expense={selectedExpense}
          onClose={() => {
            setShowModal(false);
            setSelectedExpense(null);
          }}
          onSave={handleSave}
        />
      )}

    </div>
  );
}

export default Expenses;