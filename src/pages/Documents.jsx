import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import DocumentToolbar from "../components/documents/DocumentToolbar";
import DocumentTable from "../components/documents/DocumentTable";
import AddDocumentModal from "../components/documents/AddDocumentModal";

function Documents() {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

  const [searchParams] =
    useSearchParams();

  const focusedDocumentId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;

  useEffect(() => {
    loadDocuments();

    function handleOnline() {
      setIsOnline(true);
      loadDocuments();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedDocuments();
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

  async function loadCachedDocuments() {
    const cached =
      await readOfflineCache(
        "documents"
      );

    if (!cached) {
      return false;
    }

    setDocuments(
      cached.data || []
    );

    setUsingCachedData(true);

    setCacheSavedAt(
      cached.savedAt || null
    );

    return true;
  }

  async function loadDocuments() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const foundCache =
        await loadCachedDocuments();

      if (!foundCache) {
        setDocuments([]);
        setUsingCachedData(false);
      }

      return;
    }

    setIsOnline(true);

    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      console.error(error);

      const foundCache =
        await loadCachedDocuments();

      if (!foundCache) {
        setDocuments([]);
      }

      return;
    }

    const freshDocuments =
      data || [];

    setDocuments(freshDocuments);
    setUsingCachedData(false);

    const savedAt =
      await saveOfflineCache(
        "documents",
        freshDocuments
      );

    setCacheSavedAt(
      savedAt
    );
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
            : " — no saved Document data is available"}

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

      <DocumentToolbar
        search={search}
        setSearch={setSearch}
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

          setSelectedDocument(null);
          setShowModal(true);
        }}
      />

      <div className="summary-card">
        <h3>Total Documents</h3>
        <h1>{filteredDocuments.length}</h1>
      </div>

      <DocumentTable
        documents={filteredDocuments}
        focusedDocumentId={focusedDocumentId}
        refresh={loadDocuments}
        isOnline={isOnline}
        onEdit={(doc) => {
          if (!isOnline) {
            return;
          }

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
          isOnline={isOnline}
        />
      )}

    </div>
  );
}

export default Documents;