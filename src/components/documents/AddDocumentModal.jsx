import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { logActivity } from "../../lib/activityLog";

function AddDocumentModal({
  item,
  onClose,
  refresh,
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (item) {
      setTitle(item.title || "");
      setCategory(item.category || "");
    } else {
      setTitle("");
      setCategory("");
      setFile(null);
    }
  }, [item]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!file && !item) {
      alert("Please choose a file.");
      return;
    }

    setUploading(true);

    try {
      // Keep existing file when editing
      let publicUrl = item?.file_url || "";

      // Upload only if a new file is selected
      if (file) {
        const fileName = `${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, file);

        if (uploadError) {
          console.error(uploadError);
          alert(JSON.stringify(uploadError, null, 2));
          setUploading(false);
          return;
        }

        const { data } = supabase.storage
          .from("documents")
          .getPublicUrl(fileName);

        publicUrl = data.publicUrl;
      }

      let error;

      if (item) {
        ({ error } = await supabase
          .from("documents")
          .update({
            title,
            category,
            file_url: publicUrl,
          })
          .eq("id", item.id));
      } else {
        ({ error } = await supabase
          .from("documents")
          .insert([
            {
              title,
              category,
              file_url: publicUrl,
            },
          ]));
      }

      if (error) {
        console.error(error);
        alert(JSON.stringify(error, null, 2));
        setUploading(false);
        return;
      }

      await logActivity({
        module: "Documents",
        action: item ? "Updated" : "Uploaded",
        title: title || "Document",
        details: [
          category && `Category: ${category}`,
          file?.name && `File: ${file.name}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });

      setUploading(false);
      refresh();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.message || JSON.stringify(err, null, 2));
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>
          {item ? "✏️ Edit Document" : "📄 Upload Document"}
        </h2>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Document Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />

          <input
            type="file"
            onChange={(e) => setFile(e.target.files[0])}
            required={!item}
          />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "20px",
            }}
          >
            <button
              type="submit"
              disabled={uploading}
            >
              {uploading
                ? "Saving..."
                : item
                ? "Update"
                : "Upload"}
            </button>

            <button
              type="button"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddDocumentModal;