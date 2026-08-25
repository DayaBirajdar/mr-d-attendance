import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import VendorToolbar from "../components/vendors/VendorToolbar";
import VendorTable from "../components/vendors/VendorTable";
import AddVendorModal from "../components/vendors/AddVendorModal";

function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

  const [searchParams] =
    useSearchParams();

  const focusedVendorId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;

  useEffect(() => {
    loadVendors();

    function handleOnline() {
      setIsOnline(true);
      loadVendors();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedVendors();
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
      !focusedVendorId ||
      vendors.length === 0
    ) {
      return;
    }

    const focusedVendor =
      vendors.find(
        (vendor) =>
          Number(vendor.id) ===
          Number(focusedVendorId)
      );

    if (!focusedVendor) {
      return;
    }

    setSearch(
      focusedVendor.company ||
      focusedVendor.contact_person ||
      ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-vendor-id="${focusedVendorId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedVendorId,
    vendors,
  ]);

  async function loadCachedVendors() {
    const cached =
      await readOfflineCache(
        "vendors"
      );

    if (!cached) {
      return false;
    }

    setVendors(
      cached.data || []
    );

    setUsingCachedData(true);

    setCacheSavedAt(
      cached.savedAt || null
    );

    return true;
  }

  async function loadVendors() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const foundCache =
        await loadCachedVendors();

      if (!foundCache) {
        setVendors([]);
        setUsingCachedData(false);
      }

      return;
    }

    setIsOnline(true);

    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);

      const foundCache =
        await loadCachedVendors();

      if (!foundCache) {
        setVendors([]);
      }

      return;
    }

    const freshVendors =
      data || [];

    setVendors(freshVendors);
    setUsingCachedData(false);

    const savedAt =
      await saveOfflineCache(
        "vendors",
        freshVendors
      );

    setCacheSavedAt(
      savedAt
    );
  }

  async function handleSave(vendor) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Vendor changes cannot be saved until you reconnect."
      );
      return;
    }

    let error;

    if (selectedVendor) {
      ({ error } = await supabase
        .from("vendors")
        .update(vendor)
        .eq("id", selectedVendor.id));
    } else {
      ({ error } = await supabase
        .from("vendors")
        .insert([vendor]));
    }

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await logActivity({
      module: "Vendors",
      action: selectedVendor ? "Updated" : "Added",
      title:
        vendor.company ||
        vendor.name ||
        "Vendor",
      details: [
        vendor.contact_person
          ? `Contact: ${vendor.contact_person}`
          : null,
        vendor.phone
          ? `Phone: ${vendor.phone}`
          : null,
        vendor.email
          ? `Email: ${vendor.email}`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    setShowModal(false);
    setSelectedVendor(null);
    loadVendors();
  }

  async function handleDelete(id) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Vendors cannot be deleted until you reconnect."
      );
      return;
    }

    const confirmDelete = window.confirm(
      "Move this vendor to Recycle Bin?"
    );

    if (!confirmDelete) return;

    const vendorToDelete = vendors.find(
      (vendor) => vendor.id === id
    );

    if (!vendorToDelete) {
      alert("Vendor not found.");
      return;
    }

    const { error: recycleError } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "vendors",
          original_id: vendorToDelete.id,
          data: vendorToDelete,
          deleted_by: "Admin",
          deleted_at: new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error("Recycle Bin error:", recycleError);
      alert(JSON.stringify(recycleError, null, 2));
      return;
    }

    const { error: deleteError } = await supabase
      .from("vendors")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Vendor delete error:", deleteError);
      alert(JSON.stringify(deleteError, null, 2));
      return;
    }

    await logActivity({
      module: "Vendors",
      action: "Moved to Recycle Bin",
      title:
        vendorToDelete.company ||
        vendorToDelete.name ||
        "Vendor",
      details: vendorToDelete.contact_person
        ? `Contact: ${vendorToDelete.contact_person}`
        : "",
    });

    loadVendors();
  }

  function handleEdit(vendor) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Vendors cannot be edited until you reconnect."
      );
      return;
    }

    setSelectedVendor(vendor);
    setShowModal(true);
  }

  const filteredVendors = vendors.filter((vendor) =>
    (vendor.company || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        👥 Vendor Management
      </h1>

      <p className="page-subtitle">
        Manage all company vendors.
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
            : " — no saved Vendor data is available"}

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

      <VendorToolbar
        search={search}
        setSearch={setSearch}
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

          setSelectedVendor(null);
          setShowModal(true);
        }}
      />

      <div className="summary-card">
        <h3>Total Vendors</h3>
        <h1>{filteredVendors.length}</h1>
      </div>

      <VendorTable
        vendors={filteredVendors}
        focusedVendorId={focusedVendorId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOnline={isOnline}
      />

      {showModal && (
        <AddVendorModal
          item={selectedVendor}
          onClose={() => {
            setShowModal(false);
            setSelectedVendor(null);
          }}
          onSave={handleSave}
        />
      )}

    </div>
  );
}

export default Vendors;