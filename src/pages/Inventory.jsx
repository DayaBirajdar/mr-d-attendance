import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../styles/Inventory.css";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import InventoryToolbar from "../components/inventory/InventoryToolbar";
import InventoryTable from "../components/inventory/InventoryTable";
import AddInventoryModal from "../components/inventory/AddInventoryModal";

function Inventory() {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedInventoryId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;

  useEffect(() => {
    loadInventory();

    function handleOnline() {
      setIsOnline(true);
      loadInventory();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedInventory();
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
    if (
      searchParams.get("action") ===
      "add"
    ) {
      if (!navigator.onLine) {
        alert(
          "You are offline. Adding inventory is unavailable until you reconnect."
        );

        setSearchParams(
          {},
          {
            replace: true,
          }
        );

        return;
      }

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


  async function loadCachedInventory() {
    const cached =
      await readOfflineCache(
        "inventory"
      );

    if (!cached) {
      return false;
    }

    setItems(
      cached.data || []
    );

    setUsingCachedData(true);

    setCacheSavedAt(
      cached.savedAt || null
    );

    return true;
  }

  async function loadInventory() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const foundCache =
        await loadCachedInventory();

      if (!foundCache) {
        setItems([]);
        setUsingCachedData(false);
      }

      return;
    }

    setIsOnline(true);

    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .order("id", { ascending: true });

    if (error) {
      console.error(error);

      const foundCache =
        await loadCachedInventory();

      if (!foundCache) {
        setItems([]);
      }

      return;
    }

    const freshItems =
      data || [];

    setItems(freshItems);
    setUsingCachedData(false);

    const savedAt =
      await saveOfflineCache(
        "inventory",
        freshItems
      );

    setCacheSavedAt(
      savedAt
    );
  }

  async function handleSave(item) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Inventory changes cannot be saved until you reconnect."
      );
      return;
    }

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
    if (!navigator.onLine) {
      alert(
        "You are offline. Inventory items cannot be deleted until you reconnect."
      );
      return;
    }

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
    if (!navigator.onLine) {
      alert(
        "You are offline. Inventory items cannot be edited until you reconnect."
      );
      return;
    }

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
            : " — no saved Inventory data is available"}

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

      <InventoryToolbar
        search={search}
        setSearch={setSearch}
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

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
        isOnline={isOnline}
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