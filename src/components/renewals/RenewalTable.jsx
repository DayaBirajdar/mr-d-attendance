import { supabase } from "../../lib/supabase";
import { logActivity } from "../../lib/activityLog";

function RenewalTable({
  renewals,
  onEdit,
  refresh,
  focusedRenewalId,
}) {
  function getDaysLeft(date) {
    const today = new Date();
    const renewal = new Date(date);

    today.setHours(0, 0, 0, 0);
    renewal.setHours(0, 0, 0, 0);

    const diff = Math.ceil(
      (renewal - today) /
        (1000 * 60 * 60 * 24)
    );

    if (diff < 0) return "Expired";
    if (diff === 0) return "Today";

    return `${diff} Days`;
  }

  async function deleteRenewal(id) {
    const confirmDelete = window.confirm(
      "Move this renewal to Recycle Bin?"
    );

    if (!confirmDelete) return;

    const renewalToDelete = renewals.find(
      (item) => item.id === id
    );

    if (!renewalToDelete) {
      alert("Renewal not found.");
      return;
    }

    // ---------------------------------------------
    // SAVE TO RECYCLE BIN FIRST
    // ---------------------------------------------

    const {
      error: recycleError,
    } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "renewals",
          original_id: renewalToDelete.id,
          data: renewalToDelete,
          deleted_by: "Admin",
          deleted_at: new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error(
        "Recycle Bin error:",
        recycleError
      );

      alert(
        JSON.stringify(
          recycleError,
          null,
          2
        )
      );

      return;
    }

    // ---------------------------------------------
    // DELETE FROM RENEWALS ONLY AFTER RECYCLE SAVE
    // ---------------------------------------------

    const {
      error: deleteError,
    } = await supabase
      .from("renewals")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "Renewal delete error:",
        deleteError
      );

      alert(
        JSON.stringify(
          deleteError,
          null,
          2
        )
      );

      return;
    }

    await logActivity({
      module: "Renewals",
      action: "Moved to Recycle Bin",
      title: renewalToDelete.title || "Renewal",
      details: [
        renewalToDelete.vendor &&
          `Vendor: ${renewalToDelete.vendor}`,
        renewalToDelete.renewal_date &&
          `Due: ${renewalToDelete.renewal_date}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

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
              style={{
                textAlign: "center",
              }}
            >
              No Renewals Found
            </td>
          </tr>
        ) : (
          renewals.map((item) => {
            const daysLeft =
              getDaysLeft(
                item.renewal_date
              );

            let rowBackground =
              "white";

            let displayStatus =
              "Active";

            if (
              daysLeft ===
              "Expired"
            ) {
              rowBackground =
                "#ffe5e5";

              displayStatus =
                "Expired";
            } else {
              const today =
                new Date();

              const renewal =
                new Date(
                  item.renewal_date
                );

              today.setHours(
                0,
                0,
                0,
                0
              );

              renewal.setHours(
                0,
                0,
                0,
                0
              );

              const diff =
                Math.ceil(
                  (renewal -
                    today) /
                    (1000 *
                      60 *
                      60 *
                      24)
                );

              if (
                diff >= 0 &&
                diff <= 30
              ) {
                rowBackground =
                  "#fff8d6";

                displayStatus =
                  "Due Soon";
              }
            }

            return (
              <tr
                key={item.id}
                data-renewal-id={item.id}
                style={{
                  backgroundColor:
                    rowBackground,

                  boxShadow:
                    Number(item.id) ===
                    Number(focusedRenewalId)
                      ? "inset 4px 0 0 #2563eb"
                      : "none",
                }}
              >
                <td>
                  {item.id}
                </td>

                <td>
                  {item.title}
                </td>

                <td>
                  {item.category}
                </td>

                <td>
                  {item.vendor}
                </td>

                <td>
                  {item.renewal_date}
                </td>

                <td>
                  ₹ {item.amount}
                </td>

                <td>
                  {displayStatus}
                </td>

                <td>
                  {daysLeft}
                </td>

                <td>
                  <button
                    onClick={() =>
                      onEdit(item)
                    }
                  >
                    Edit
                  </button>

                  <button
                    className="delete-btn"
                    style={{
                      marginLeft:
                        "10px",
                    }}
                    onClick={() =>
                      deleteRenewal(
                        item.id
                      )
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}

export default RenewalTable;