import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

function ExpenseChart({ expenses }) {
  const monthlyData = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ].map((month, index) => ({
    month,
    amount: expenses
      .filter((item) => {
        if (!item.expense_date) return false;

        return (
          new Date(item.expense_date).getMonth() === index
        );
      })
      .reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
  }));

  return (
    <div
      className="summary-card"
      style={{
        marginTop: "30px",
        padding: "20px",
      }}
    >
      <h3>Monthly Expenses</h3>

      <ResponsiveContainer
        width="100%"
        height={320}
      >
        <BarChart data={monthlyData}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="month" />

          <YAxis />

          <Tooltip />

          <Bar
            dataKey="amount"
            radius={[8, 8, 0, 0]}
            fill="#2563eb"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ExpenseChart;