import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import DocumentToolbar from "../components/documents/DocumentToolbar";
import DocumentTable from "../components/documents/DocumentTable";
import AddDocumentModal from "../components/documents/AddDocumentModal";

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
const [selectedDocument, setSelectedDocument] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setDocuments(data || []);
  }

  const filteredDocuments = documents.filter((doc) =>
    (doc.title || "")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        📄 Documents Management
      </h1>

      <p className="page-subtitle">
        Store and manage all company documents.
      </p>

      <DocumentToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => setShowModal(true)}
      />

      <div className="summary-card">
        <h3>Total Documents</h3>
        <h1>{filteredDocuments.length}</h1>
      </div>

      <DocumentTable
  documents={filteredDocuments}
  refresh={loadDocuments}
  onEdit={(doc) => {
    setSelectedDocument(doc);
    setShowModal(true);
  }}
/>

      {showModal && (
  <AddDocumentModal
    item={selectedDocument}
    onClose={() => {
      setShowModal(false);
      setSelectedDocument(null);
    }}
    refresh={loadDocuments}
  />
)}

    </div>
  );
}

export default Documents;