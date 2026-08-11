import { supabase } from "../../lib/supabase";

function RenewalTable({
  renewals,
  onEdit,
  refresh,
}) {
  function getDaysLeft(date) {
  const today = new Date();
  const renewal = new Date(date);

  today.setHours(0, 0, 0, 0);
  renewal.setHours(0, 0, 0, 0);

  const diff =
    Math.ceil(
      (renewal - today) /
      (1000 * 60 * 60 * 24)
    );

  if (diff < 0) return "Expired";
  if (diff === 0) return "Today";

  return `${diff} Days`;
}

  async function deleteRenewal(id) {

    const confirmDelete = window.confirm(
      "Delete this renewal?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("renewals")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Unable to delete renewal.");
      return;
    }

    refresh();

  }

  return (

    <table className="inventory-table">

      <thead>

        <tr>

          <th>ID</th>
          <th>Title</th>
          <th>Category</th>
          <th>Vendor</th>
          <th>Renewal Date</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Days Left</th>
          <th>Actions</th>

        </tr>

      </thead>

      <tbody>

        {renewals.length === 0 ? (

          <tr>

            <td
              colSpan="9"
              style={{ textAlign: "center" }}
            >
              No Renewals Found
            </td>

          </tr>

        ) : (

          renewals.map((item) => (

            <tr
  style={{
  backgroundColor:
    getDaysLeft(item.renewal_date) === "Expired"
      ? "#ffe5e5"
      : (() => {
          const today = new Date();
          const renewal = new Date(item.renewal_date);

          today.setHours(0, 0, 0, 0);
          renewal.setHours(0, 0, 0, 0);

          const diff = Math.ceil(
            (renewal - today) /
              (1000 * 60 * 60 * 24)
          );

          return diff >= 0 && diff <= 30
            ? "#fff8d6"
            : "white";
        })(),
}}
>

              <td>{item.id}</td>
              <td>{item.title}</td>
              <td>{item.category}</td>
              <td>{item.vendor}</td>
              <td>{item.renewal_date}</td>
              <td>₹ {item.amount}</td>
              <td>{item.status}</td>
<td>{getDaysLeft(item.renewal_date)}</td>
              <td>

                <button
                  onClick={() => onEdit(item)}
                >
                  Edit
                </button>

                <button
                  className="delete-btn"
                  style={{ marginLeft: "10px" }}
                  onClick={() =>
                    deleteRenewal(item.id)
                  }
                >
                  Delete
                </button>

              </td>

            </tr>

          ))

        )}

      </tbody>

    </table>

  );

}

export default RenewalTable;