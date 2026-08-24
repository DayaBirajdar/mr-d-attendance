import { supabase } from "../../lib/supabase";
import { logActivity } from "../../lib/activityLog";

function DocumentTable({
  documents,
  focusedDocumentId,
  refresh,
  onEdit,
}) {

  async function downloadDocument(doc) {
    try {
      const response = await fetch(doc.file_url);

      if (!response.ok) {
        throw new Error("Unable to download file.");
      }

      const blob = await response.blob();

      const blobUrl =
        window.URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      const urlFileName =
        decodeURIComponent(
          doc.file_url
            .split("/")
            .pop()
            .split("?")[0]
        );

      const cleanFileName =
        urlFileName.replace(
          /^\d+-/,
          ""
        );

      link.href = blobUrl;

      link.download =
        cleanFileName ||
        doc.title ||
        "document";

      document.body.appendChild(link);

      link.click();

      link.remove();

      window.URL.revokeObjectURL(
        blobUrl
      );
    } catch (error) {
      console.error(
        "Document download error:",
        error
      );

      alert(
        "Unable to download document."
      );
    }
  }

  async function deleteDocument(id) {

    const confirmDelete = window.confirm(
      "Move this document to Recycle Bin?"
    );

    if (!confirmDelete) return;

    const documentToDelete = documents.find(
      (doc) => doc.id === id
    );

    if (!documentToDelete) {
      alert("Document not found.");
      return;
    }

    const { error: recycleError } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "documents",
          original_id: documentToDelete.id,
          data: documentToDelete,
          deleted_by: "Admin",
          deleted_at: new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error(
        "Document Recycle Bin error:",
        recycleError
      );

      alert(
        JSON.stringify(
          recycleError,
          null,
          2
        )
      );

      return;
    }

    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
        "Document delete error:",
        deleteError
      );

      alert(
        JSON.stringify(
          deleteError,
          null,
          2
        )
      );

      return;
    }

    await logActivity({
      module: "Documents",
      action: "Moved to Recycle Bin",
      title:
        documentToDelete.title ||
        "Document",
      details: documentToDelete.category
        ? `Category: ${documentToDelete.category}`
        : "",
    });

    refresh();
  }

  return (

    <table className="inventory-table">

      <thead>

        <tr>

          <th>ID</th>
          <th>Title</th>
          <th>Category</th>
          <th>Uploaded</th>
          <th>Actions</th>

        </tr>

      </thead>

      <tbody>

        {documents.length === 0 ? (

          <tr>

            <td
              colSpan="5"
              style={{ textAlign: "center" }}
            >
              No Documents Found
            </td>

          </tr>

        ) : (

          documents.map((doc) => (

            <tr
              key={doc.id}
              data-document-id={doc.id}
              className={
                Number(doc.id) ===
                Number(focusedDocumentId)
                  ? "document-focus-row"
                  : ""
              }
            >

              <td>{doc.id}</td>

              <td>{doc.title}</td>

              <td>{doc.category}</td>

              <td>
                {new Date(doc.created_at).toLocaleDateString()}
              </td>

              <td>

                {doc.file_url && (
                  <>
                    {(() => {
                      const cleanUrl =
                        doc.file_url
                          .split("?")[0]
                          .toLowerCase();

                      const canPreview =
                        cleanUrl.endsWith(".pdf") ||
                        cleanUrl.endsWith(".png") ||
                        cleanUrl.endsWith(".jpg") ||
                        cleanUrl.endsWith(".jpeg") ||
                        cleanUrl.endsWith(".gif") ||
                        cleanUrl.endsWith(".webp") ||
                        cleanUrl.endsWith(".txt");

                      return canPreview ? (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="document-view-btn"
                        >
                          View
                        </a>
                      ) : null;
                    })()}

                    <button
                      type="button"
                      className="document-download-btn"
                      onClick={() =>
                        downloadDocument(doc)
                      }
                    >
                      Download
                    </button>
                  </>
                )}

                <button
                  className="edit-btn"
                  style={{ marginLeft: "10px" }}
                  onClick={() => onEdit(doc)}
                >
                  Edit
                </button>

                <button
                  className="delete-btn"
                  style={{ marginLeft: "10px" }}
                  onClick={() =>
                    deleteDocument(doc.id)
                  }
                >
                  Delete
                </button>

              </td>

            </tr>

          ))

        )}

      </tbody>

    </table>

  );

}

export default DocumentTable;