import { supabase } from "../../lib/supabase";

function DocumentTable({
  documents,
  refresh,
  onEdit,
}) {

  async function deleteDocument(id) {

    const confirmDelete = window.confirm(
      "Delete this document?"
    );

    if (!confirmDelete) return;

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert("Unable to delete document.");
      return;
    }

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

            <tr key={doc.id}>

              <td>{doc.id}</td>

              <td>{doc.title}</td>

              <td>{doc.category}</td>

              <td>
                {new Date(doc.created_at).toLocaleDateString()}
              </td>

              <td>

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