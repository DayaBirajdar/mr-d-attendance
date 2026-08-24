import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/Inventory.css";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";

import InventoryToolbar from "../components/inventory/InventoryToolbar";
import InventoryTable from "../components/inventory/InventoryTable";
import AddInventoryModal from "../components/inventory/AddInventoryModal";

function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedInventoryId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;

  useEffect(() => {
    loadInventory();
  }, []);

  useEffect(() => {
    if (
      searchParams.get("action") ===
      "add"
    ) {
      setSelectedItem(null);
      setShowModal(true);

      setSearchParams(
        {},
        {
          replace: true,
        }
      );
    }
  }, [
    searchParams,
    setSearchParams,
  ]);

  useEffect(() => {
    if (
      !focusedInventoryId ||
      items.length === 0
    ) {
      return;
    }

    const focusedItem =
      items.find(
        (item) =>
          Number(item.id) ===
          Number(focusedInventoryId)
      );

    if (!focusedItem) {
      return;
    }

    setSearch(
      focusedItem.name || ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-inventory-id="${focusedInventoryId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedInventoryId,
    items,
  ]);


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

    await logActivity({
      module: "Inventory",
      action: selectedItem ? "Updated" : "Added",
      title: item.name || "Inventory Item",
      details: [
        item.category && `Category: ${item.category}`,
        item.location && `Location: ${item.location}`,
        item.status && `Status: ${item.status}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

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

    await logActivity({
      module: "Inventory",
      action: "Moved to Recycle Bin",
      title: item.name || "Inventory Item",
      details: [
        item.category && `Category: ${item.category}`,
        item.location && `Location: ${item.location}`,
        item.status && `Status: ${item.status}`,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    loadInventory();
  }

  function handleEdit(item) {
    setSelectedItem(item);
    setShowModal(true);
  }

  const filteredInventory = focusedInventoryId
    ? items.filter(
        (item) =>
          Number(item.id) ===
          Number(focusedInventoryId)
      )
    : items.filter((item) =>
        item.name
          ?.toLowerCase()
          .includes(search.toLowerCase())
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
        focusedInventoryId={focusedInventoryId}
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