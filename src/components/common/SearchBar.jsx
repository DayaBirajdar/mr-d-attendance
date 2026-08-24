import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  supabase,
} from "../../lib/supabase";


function SearchBar() {

  const navigate =
    useNavigate();

  const wrapperRef =
    useRef(null);

  const [search, setSearch] =
    useState("");

  const [results, setResults] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [showResults, setShowResults] =
    useState(false);


  useEffect(() => {

    function handleOutsideClick(e) {

      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          e.target
        )
      ) {
        setShowResults(false);
      }

    }


    document.addEventListener(
      "mousedown",
      handleOutsideClick
    );


    return () => {

      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );

    };

  }, []);


  useEffect(() => {

    const term =
      search.trim();

    if (
      term.length < 1
    ) {
      setResults([]);
      setShowResults(false);
      return;
    }


    const timer =
      setTimeout(
        () => {
          runGlobalSearch(term);
        },
        300
      );


    return () =>
      clearTimeout(timer);

  }, [search]);


  async function runGlobalSearch(
    term
  ) {

    setLoading(true);

    try {

      const query =
        `%${term}%`;


      const [
        employeesResult,
        inventoryResult,
        vendorsResult,
        documentsResult,
        visitorsResult,
        eventsResult,
        renewalsResult,
        expensesResult,
      ] =
        await Promise.all([

          supabase
            .from("employees")
            .select(`
              id,
              employee_id,
              full_name,
              department,
              designation
            `)
            .eq("is_deleted", false)
            .or(
              `full_name.ilike.${query},employee_id.ilike.${query},department.ilike.${query},designation.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("inventory")
            .select(`
              id,
              name,
              category,
              location,
              assigned_to,
              status
            `)
            .or(
              `name.ilike.${query},category.ilike.${query},location.ilike.${query},assigned_to.ilike.${query},status.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("vendors")
            .select(`
              id,
              company,
              contact_person,
              phone,
              email
            `)
            .or(
              `company.ilike.${query},contact_person.ilike.${query},phone.ilike.${query},email.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("documents")
            .select(`
              id,
              title,
              category
            `)
            .or(
              `title.ilike.${query},category.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("visitors")
            .select(`
              id,
              visitor_name,
              company,
              purpose,
              status
            `)
            .or(
              `visitor_name.ilike.${query},company.ilike.${query},purpose.ilike.${query},status.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("events")
            .select(`
              id,
              title,
              venue,
              owner,
              status,
              event_date
            `)
            .or(
              `title.ilike.${query},venue.ilike.${query},owner.ilike.${query},status.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("renewals")
            .select(`
              id,
              title,
              category,
              vendor,
              status
            `)
            .or(
              `title.ilike.${query},category.ilike.${query},vendor.ilike.${query},status.ilike.${query}`
            )
            .limit(5),

          supabase
            .from("expenses")
            .select(`
              id,
              expense_name,
              category,
              amount,
              expense_date
            `)
            .or(
              `expense_name.ilike.${query},category.ilike.${query}`
            )
            .limit(5),

        ]);


      const combined = [];


      (employeesResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `employee-${item.id}`,
            icon:
              "👨‍💼",
            module:
              "Employees",
            title:
              item.full_name ||
              item.employee_id,
            subtitle:
              [
                item.employee_id,
                item.department,
                item.designation,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/employees?focus=${item.id}`,
          });

        });


      (inventoryResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `inventory-${item.id}`,
            icon:
              "📦",
            module:
              "Inventory",
            title:
              item.name ||
              `Item ${item.id}`,
            subtitle:
              [
                item.category,
                item.location,
                item.assigned_to,
                item.status,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/inventory?focus=${item.id}`,
          });

        });


      (vendorsResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `vendor-${item.id}`,
            icon:
              "👥",
            module:
              "Vendors",
            title:
              item.company ||
              item.contact_person ||
              `Vendor ${item.id}`,
            subtitle:
              [
                item.contact_person,
                item.phone,
                item.email,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/vendors?focus=${item.id}`,
          });

        });


      (documentsResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `document-${item.id}`,
            icon:
              "📄",
            module:
              "Documents",
            title:
              item.title ||
              `Document ${item.id}`,
            subtitle:
              item.category || "",
            path:
              `/documents?focus=${item.id}`,
          });

        });


      (visitorsResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `visitor-${item.id}`,
            icon:
              "👤",
            module:
              "Visitors",
            title:
              item.visitor_name ||
              `Visitor ${item.id}`,
            subtitle:
              [
                item.company,
                item.purpose,
                item.status,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/visitors?focus=${item.id}`,
          });

        });


      (eventsResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `event-${item.id}`,
            icon:
              "📅",
            module:
              "Events",
            title:
              item.title ||
              `Event ${item.id}`,
            subtitle:
              [
                item.event_date,
                item.venue,
                item.owner,
                item.status,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/events?focus=${item.id}`,
          });

        });


      (renewalsResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `renewal-${item.id}`,
            icon:
              "🔔",
            module:
              "Renewals",
            title:
              item.title ||
              `Renewal ${item.id}`,
            subtitle:
              [
                item.category,
                item.vendor,
                item.status,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/renewals?focus=${item.id}`,
          });

        });


      (expensesResult.data || [])
        .forEach((item) => {

          combined.push({
            key:
              `expense-${item.id}`,
            icon:
              "💰",
            module:
              "Expenses",
            title:
              item.expense_name ||
              `Expense ${item.id}`,
            subtitle:
              [
                item.category,
                item.amount
                  ? `₹${item.amount}`
                  : "",
                item.expense_date,
              ]
                .filter(Boolean)
                .join(" · "),
            path:
              `/expenses?focus=${item.id}`,
          });

        });


      setResults(
        combined.slice(
          0,
          12
        )
      );

      setShowResults(true);

    } catch (error) {

      console.error(
        "Mr.D Global Search error:",
        error
      );

      setResults([]);

      setShowResults(true);

    } finally {

      setLoading(false);

    }

  }


  function openResult(
    result
  ) {

    navigate(
      result.path
    );

    setSearch("");

    setResults([]);

    setShowResults(false);

  }


  function handleSearch(
    e
  ) {

    if (
      e.key === "Enter" &&
      results.length > 0
    ) {

      openResult(
        results[0]
      );

    }

  }


  function handleWebSearch() {

    if (!search.trim()) {

      alert(
        "Please enter something to search."
      );

      return;

    }


    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(
        search
      )}`,
      "_blank"
    );

  }


  return (

    <div
      className="search-bar"
      ref={
        wrapperRef
      }
      style={{
        position: "relative",
      }}
    >

      <input
        type="text"
        placeholder="🔍 Search Mr.D..."
        value={
          search
        }
        onChange={
          (e) =>
            setSearch(
              e.target.value
            )
        }
        onFocus={() => {
          if (
            search.trim().length >= 2
          ) {
            setShowResults(true);
          }
        }}
        onKeyDown={
          handleSearch
        }
      />


      <button
        className="search-btn"
        onClick={
          handleWebSearch
        }
      >
        🌐 Web
      </button>


      {showResults && (
        <div
          className="mrd-global-search-results"
        >

          {loading ? (

            <div
              className="mrd-global-search-empty"
            >
              Searching Mr.D...
            </div>

          ) : results.length === 0 ? (

            <div
              className="mrd-global-search-empty"
            >
              No Mr.D records found.
            </div>

          ) : (

            results.map(
              (result) => (

                <button
                  type="button"
                  key={
                    result.key
                  }
                  className="mrd-global-search-item"
                  onClick={() =>
                    openResult(
                      result
                    )
                  }
                >

                  <span
                    className="mrd-global-search-icon"
                  >
                    {result.icon}
                  </span>


                  <span
                    className="mrd-global-search-text"
                  >

                    <strong>
                      {result.title}
                    </strong>

                    <small>
                      {result.module}
                      {result.subtitle
                        ? ` · ${result.subtitle}`
                        : ""}
                    </small>

                  </span>

                </button>

              )
            )

          )}

        </div>
      )}

    </div>

  );

}


export default SearchBar;
