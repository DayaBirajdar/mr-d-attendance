import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { syncRenewal } from "../lib/googleSync";

import RenewalToolbar from "../components/renewals/RenewalToolbar";
import AddRenewalModal from "../components/renewals/AddRenewalModal";
import RenewalTable from "../components/renewals/RenewalTable";

function Renewals() {
  const [renewals, setRenewals] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState(null);

  useEffect(() => {
    loadRenewals();
  }, []);

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

  setShowModal(false);
  setSelectedRenewal(null);
  loadRenewals();
}

  const filteredRenewals = renewals.filter((item) =>
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