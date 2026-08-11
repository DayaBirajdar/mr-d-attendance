import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import VendorToolbar from "../components/vendors/VendorToolbar";
import VendorTable from "../components/vendors/VendorTable";
import AddVendorModal from "../components/vendors/AddVendorModal";

function Vendors() {
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
      .order("id", { ascending: false });

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
    const confirmDelete = window.confirm(
      "Delete this vendor?"
    );

    if (!confirmDelete) return;

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
    <div className="inventory-page">

      <h1 className="page-title">
        👥 Vendor Management
      </h1>

      <p className="page-subtitle">
        Manage all company vendors.
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
        <h1>{filteredVendors.length}</h1>
      </div>

      <VendorTable
        vendors={filteredVendors}
        onEdit={handleEdit}
        onDelete={handleDelete}
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