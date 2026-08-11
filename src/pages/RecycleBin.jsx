import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/RecycleBin.css";

function RecycleBin() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadRecycleBin();
  }, []);

  async function loadRecycleBin() {
    const { data, error } = await supabase
      .from("recycle_bin")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
  }

  async function restoreItem(item) {
  const asset = { ...item.data };

  delete asset.id;
  delete asset.created_at;

  const { error: insertError } = await supabase
    .from(item.original_table)
    .insert([asset]);

  if (insertError) {
    console.error(insertError);
    alert(JSON.stringify(insertError, null, 2));
    return;
  }

  const { error: deleteError } = await supabase
    .from("recycle_bin")
    .delete()
    .eq("id", item.id);

  if (deleteError) {
    console.error(deleteError);
  }

  loadRecycleBin();
}

  async function deleteForever(id) {
    if (!window.confirm("Delete permanently?")) return;

    await supabase
      .from("recycle_bin")
      .delete()
      .eq("id", id);

    loadRecycleBin();
  }

  return (
    <div className="recycle-page">
      <h1>🗑 Recycle Bin</h1>

      <table className="inventory-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Item</th>
            <th>Category</th>
            <th>Location</th>
            <th>Assigned To</th>
            <th>Status</th>
            <th>Deleted At</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center" }}>
                Recycle Bin is Empty
              </td>
            </tr>
          ) : (
            items.map((item) => {
              const asset = item.data;
              console.log(item);
console.log(asset);
              console.log(asset);

              return (
                <tr key={item.id}>
                  <td>{asset?.id}</td>
                  <td>{asset?.name}</td>
                  <td>{asset?.category}</td>
                  <td>{asset?.location}</td>
                  <td>{asset?.assigned_to}</td>
                  <td>{asset?.status}</td>
                  <td>{new Date(item.deleted_at).toLocaleString()}</td>

                  <td>
                    <button onClick={() => restoreItem(item)}>
                      Restore
                    </button>

                    <button
                      style={{
                        marginLeft: 10,
                        background: "red",
                        color: "white",
                      }}
                      onClick={() => deleteForever(item.id)}
                    >
                      Delete Forever
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default RecycleBin;