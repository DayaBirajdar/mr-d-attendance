import { useState } from "react";

function SearchBar() {

  const [search, setSearch] = useState("");

  function handleSearch(e) {

    if (e.key === "Enter") {

      if (!search.trim()) return;

      alert(`Searching Mr.D for:\n\n${search}`);

      setSearch("");

    }

  }

  function handleWebSearch() {

    if (!search.trim()) {
      alert("Please enter something to search.");
      return;
    }

    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(search)}`,
      "_blank"
    );

  }

  return (

    <div className="search-bar">

      <input
        type="text"
        placeholder="🔍 Search Mr.D..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={handleSearch}
      />

      <button
        className="search-btn"
        onClick={handleWebSearch}
      >
        🌐 Web
      </button>

    </div>

  );

}

export default SearchBar;