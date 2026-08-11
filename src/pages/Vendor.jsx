import { useEffect, useState } from "react";
import "../styles/Vendor.css";
import { supabase } from "../lib/supabase";

import VendorToolbar from "../components/vendors/VendorToolbar";
import VendorTable from "../components/vendors/VendorTable";
import AddVendorModal from "../components/vendors/AddVendorModal";

function Vendor() {
  const [vendors, setVendors] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  useEffect(() => {
    loadVendors();
  }, []);

  async function loadVendors() {
    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("is_deleted", false)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setVendors(data || []);
  }

  async function handleSave(vendor) {
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

    setShowModal(false);
    setSelectedVendor(null);
    loadVendors();
  }

  async function handleDelete(id) {
    if (!window.confirm("Move this vendor to Recycle Bin?"))
      return;

    const vendor = vendors.find((v) => v.id === id);

    const { error: recycleError } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "vendors",
          original_id: vendor.id,
          data: vendor,
          deleted_by: "Admin",
          deleted_at: new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error(recycleError);
      alert(JSON.stringify(recycleError, null, 2));
      return;
    }

    const { error } = await supabase
      .from("vendors")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    loadVendors();
  }

  function handleEdit(vendor) {
    setSelectedVendor(vendor);
    setShowModal(true);
  }

  const filteredVendors = vendors.filter((vendor) =>
  (vendor.company || "")
    .toLowerCase()
    .includes(search.toLowerCase())
);

  return (
    <div className="vendor-page">
      <h1 className="page-title">
        🤝 Vendor Management
      </h1>

      <p className="page-subtitle">
        Manage all company vendors and suppliers.
      </p>

      <VendorToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => {
          setSelectedVendor(null);
          setShowModal(true);
        }}
      />

      <div className="summary-card">
        <h3>Total Vendors</h3>
<h1>{vendors.length}</h1>
      </div>

      <VendorTable
        vendors={filteredVendors}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showModal && (
        <AddVendorModal
          vendor={selectedVendor}
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

export default Vendor;