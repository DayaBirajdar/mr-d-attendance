import { useEffect, useState } from "react";
import "../styles/Inventory.css";
import { supabase } from "../lib/supabase";

import InventoryToolbar from "../components/inventory/InventoryToolbar";
import InventoryTable from "../components/inventory/InventoryTable";
import AddInventoryModal from "../components/inventory/AddInventoryModal";

function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadInventory();
  }, []);

  async function loadInventory() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setItems(data || []);
  }

  async function handleSave(item) {
    let error;

    if (selectedItem) {
      ({ error } = await supabase
        .from("inventory")
        .update(item)
        .eq("id", selectedItem.id));
    } else {
      ({ error } = await supabase
        .from("inventory")
        .insert([item]));
    }

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    setShowModal(false);
    setSelectedItem(null);
    loadInventory();
  }

  async function handleDelete(id) {
    const confirmDelete = window.confirm(
      "Move this item to Recycle Bin?"
    );

    if (!confirmDelete) return;

    const item = items.find((i) => i.id === id);

    if (!item) {
      alert("Item not found.");
      return;
    }

    console.log("Moving Item:", item);

    const { error: recycleError } = await supabase
  .from("recycle_bin")
  .insert([
    {
      original_table: "inventory",
      original_id: item.id,
      data: item,
      deleted_by: "Admin",
      deleted_at: new Date().toISOString(),
    },
  ]);

    if (recycleError) {
      console.error("Recycle Error:", recycleError);

      alert(
        JSON.stringify(recycleError, null, 2)
      );

      return;
    }

    const { error } = await supabase
      .from("inventory")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    loadInventory();
  }

  function handleEdit(item) {
    setSelectedItem(item);
    setShowModal(true);
  }

  const filteredInventory = items.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  function getStatusClass(status) {
    switch (status) {
      case "Available":
        return "status available";

      case "In Use":
        return "status inuse";

      case "Maintenance":
        return "status maintenance";

      default:
        return "status";
    }
  }

  return (
    <div className="inventory-page">
      <h1 className="page-title">
        📦 Inventory Management
      </h1>

      <p className="page-subtitle">
        Manage all company assets and equipment.
      </p>

      <InventoryToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => {
          setSelectedItem(null);
          setShowModal(true);
        }}
      />

      <div className="summary-card">
        <h3>Total Inventory</h3>
        <h1>{filteredInventory.length}</h1>
      </div>

      <InventoryTable
        items={filteredInventory}
        getStatusClass={getStatusClass}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showModal && (
        <AddInventoryModal
          item={selectedItem}
          onClose={() => {
            setShowModal(false);
            setSelectedItem(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default Inventory;