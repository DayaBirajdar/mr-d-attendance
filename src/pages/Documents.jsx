import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

import DocumentToolbar from "../components/documents/DocumentToolbar";
import DocumentTable from "../components/documents/DocumentTable";
import AddDocumentModal from "../components/documents/AddDocumentModal";

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
const [selectedDocument, setSelectedDocument] = useState(null);

  const [searchParams] =
    useSearchParams();

  const focusedDocumentId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    if (
      !focusedDocumentId ||
      documents.length === 0
    ) {
      return;
    }

    const focusedDocument =
      documents.find(
        (doc) =>
          Number(doc.id) ===
          Number(focusedDocumentId)
      );

    if (!focusedDocument) {
      return;
    }

    setSearch(
      focusedDocument.title || ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-document-id="${focusedDocumentId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedDocumentId,
    documents,
  ]);

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
  focusedDocumentId={focusedDocumentId}
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