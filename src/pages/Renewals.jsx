import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { syncRenewal } from "../lib/googleSync";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import RenewalToolbar from "../components/renewals/RenewalToolbar";
import AddRenewalModal from "../components/renewals/AddRenewalModal";
import RenewalTable from "../components/renewals/RenewalTable";

function Renewals() {
  const [renewals, setRenewals] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedRenewalId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;


  useEffect(() => {
    loadRenewals();

    function handleOnline() {
      setIsOnline(true);
      loadRenewals();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedRenewals();
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
          "You are offline. Adding renewals is unavailable until you reconnect."
        );

        setSearchParams(
          {},
          { replace: true }
        );

        return;
      }

      setSelectedRenewal(null);
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
      !focusedRenewalId ||
      renewals.length === 0
    ) {
      return;
    }

    const focusedRenewal =
      renewals.find(
        (item) =>
          Number(item.id) ===
          Number(focusedRenewalId)
      );

    if (!focusedRenewal) {
      return;
    }

    setSearch(
      focusedRenewal.title || ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-renewal-id="${focusedRenewalId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedRenewalId,
    renewals,
  ]);


  async function loadCachedRenewals() {
    const cached =
      await readOfflineCache(
        "renewals"
      );

    if (!cached) {
      return false;
    }

    setRenewals(
      cached.data || []
    );

    setUsingCachedData(true);

    setCacheSavedAt(
      cached.savedAt || null
    );

    return true;
  }

  async function loadRenewals() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const foundCache =
        await loadCachedRenewals();

      if (!foundCache) {
        setRenewals([]);
        setUsingCachedData(false);
      }

      return;
    }

    setIsOnline(true);

    const { data, error } = await supabase
      .from("renewals")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);

      const foundCache =
        await loadCachedRenewals();

      if (!foundCache) {
        setRenewals([]);
      }

      return;
    }

    const freshRenewals =
      data || [];

    setRenewals(freshRenewals);
    setUsingCachedData(false);

    const savedAt =
      await saveOfflineCache(
        "renewals",
        freshRenewals
      );

    setCacheSavedAt(
      savedAt
    );
  }

  async function handleSave(renewal) {
  if (!navigator.onLine) {
    alert(
      "You are offline. Renewal changes cannot be saved until you reconnect."
    );
    return;
  }

  let error;

  if (selectedRenewal) {

    ({ error } = await supabase
      .from("renewals")
      .update(renewal)
      .eq("id", selectedRenewal.id));

    if (!error) {
      await syncRenewal("update", {
        ...renewal,
        id: selectedRenewal.id,
      });
    }

  } else {

    const {
      data,
      error: insertError,
    } = await supabase
      .from("renewals")
      .insert([renewal])
      .select()
      .single();

    error = insertError;

    if (!error && data) {
      await syncRenewal("add", data);
    }

  }

  if (error) {
    console.error(error);
    alert(JSON.stringify(error, null, 2));
    return;
  }

  await logActivity({
    module: "Renewals",
    action: selectedRenewal ? "Updated" : "Added",
    title: renewal.title || "Renewal",
    details: [
      renewal.category && `Category: ${renewal.category}`,
      renewal.vendor && `Vendor: ${renewal.vendor}`,
      renewal.renewal_date && `Due: ${renewal.renewal_date}`,
      renewal.amount && `Amount: ₹${renewal.amount}`,
    ]
      .filter(Boolean)
      .join(" · "),
  });

  setShowModal(false);
  setSelectedRenewal(null);
  loadRenewals();
}

  const filteredRenewals = focusedRenewalId
    ? renewals.filter(
        (item) =>
          Number(item.id) ===
          Number(focusedRenewalId)
      )
    : renewals.filter((item) =>
        (item.title || "")
          .toLowerCase()
          .includes(search.toLowerCase())
      );

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        🔔 Renewals
      </h1>

      <p className="page-subtitle">
        Manage all company renewals.
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
            : " — no saved Renewal data is available"}

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

      <RenewalToolbar
        search={search}
        setSearch={setSearch}
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

          setSelectedRenewal(null);
          setShowModal(true);
        }}
      />

      <div className="summary-card">
        <h3>Total Renewals</h3>
        <h1>{filteredRenewals.length}</h1>
      </div>

      <RenewalTable
        renewals={filteredRenewals}
        focusedRenewalId={focusedRenewalId}
        refresh={loadRenewals}
        isOnline={isOnline}
        onEdit={(item) => {
          if (!isOnline) {
            return;
          }

          setSelectedRenewal(item);
          setShowModal(true);
        }}
      />

      {showModal && (
        <AddRenewalModal
          item={selectedRenewal}
          onClose={() => {
            setShowModal(false);
            setSelectedRenewal(null);
          }}
          onSave={handleSave}
          isOnline={isOnline}
        />
      )}

    </div>
  );
}

export default Renewals;