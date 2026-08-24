import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { syncRenewal } from "../lib/googleSync";
import { logActivity } from "../lib/activityLog";

import RenewalToolbar from "../components/renewals/RenewalToolbar";
import AddRenewalModal from "../components/renewals/AddRenewalModal";
import RenewalTable from "../components/renewals/RenewalTable";

function Renewals() {
  const [renewals, setRenewals] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedRenewalId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;


  useEffect(() => {
    loadRenewals();
  }, []);

  useEffect(() => {
    if (searchParams.get("action") === "add") {
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


  async function loadRenewals() {
    const { data, error } = await supabase
      .from("renewals")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setRenewals(data || []);
  }

  async function handleSave(renewal) {
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

      <RenewalToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => {
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
  onEdit={(item) => {
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
        />
      )}

    </div>
  );
}

export default Renewals;