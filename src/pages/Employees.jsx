import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import EmployeeToolbar from "../components/employees/EmployeeToolbar";
import EmployeeTable from "../components/employees/EmployeeTable";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

  const [searchParams, setSearchParams] =
    useSearchParams();

  const focusedEmployeeId =
    searchParams.get("focus")
      ? Number(searchParams.get("focus"))
      : null;

  useEffect(() => {
    loadEmployees();

    function handleOnline() {
      setIsOnline(true);
      loadEmployees();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedEmployees();
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
      !focusedEmployeeId ||
      employees.length === 0
    ) {
      return;
    }

    const focusedEmployee =
      employees.find(
        (employee) =>
          Number(employee.id) ===
          Number(focusedEmployeeId)
      );

    if (!focusedEmployee) {
      return;
    }

    setSearch(
      focusedEmployee.full_name ||
      focusedEmployee.employee_id ||
      ""
    );

    setTimeout(() => {
      const row =
        document.querySelector(
          `[data-employee-id="${focusedEmployeeId}"]`
        );

      if (row) {
        row.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 150);
  }, [
    focusedEmployeeId,
    employees,
  ]);

  async function loadCachedEmployees() {
    const cached =
      await readOfflineCache(
        "employees"
      );

    if (!cached) {
      return false;
    }

    setEmployees(
      cached.data || []
    );

    setUsingCachedData(true);

    setCacheSavedAt(
      cached.savedAt || null
    );

    return true;
  }

  async function loadEmployees() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const foundCache =
        await loadCachedEmployees();

      if (!foundCache) {
        setEmployees([]);
        setUsingCachedData(false);
      }

      return;
    }

    setIsOnline(true);

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("is_deleted", false)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);

      const foundCache =
        await loadCachedEmployees();

      if (!foundCache) {
        setEmployees([]);
      }

      return;
    }

    const freshEmployees =
      data || [];

    setEmployees(freshEmployees);
    setUsingCachedData(false);

    const savedAt =
      await saveOfflineCache(
        "employees",
        freshEmployees
      );

    setCacheSavedAt(
      savedAt
    );
  }

  async function handleSave(employee) {
  if (!navigator.onLine) {
    alert(
      "You are offline. Employee changes cannot be saved until you reconnect."
    );
    return;
  }

  let photoUrl = employee.photo_url || "";

  // Upload photo if selected
  if (employee.photo) {
    const file = employee.photo;

    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("employee-photos")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      alert("Photo upload failed.");
      return;
    }

    const { data } = supabase.storage
      .from("employee-photos")
      .getPublicUrl(fileName);

    photoUrl = data.publicUrl;
  }

  const employeeData = {
    employee_id: employee.employee_id,
    full_name: employee.full_name,
    department: employee.department,
    designation: employee.designation,
    phone: employee.phone,
    email: employee.email,
    joining_date: employee.joining_date,
    status: employee.status,
    photo_url: photoUrl,
  };

  let error;

  if (selectedEmployee) {
    ({ error } = await supabase
      .from("employees")
      .update(employeeData)
      .eq("id", selectedEmployee.id));
  } else {
    ({ error } = await supabase
      .from("employees")
      .insert([employeeData]));
  }

  if (error) {
    console.error(error);
    alert(JSON.stringify(error, null, 2));
    return;
  }

  await logActivity({
    module: "Employees",
    action: selectedEmployee ? "Updated" : "Added",
    title: employee.full_name || employee.employee_id || "Employee",
    details: [
      employee.employee_id
        ? `Employee ID: ${employee.employee_id}`
        : "",
      employee.department
        ? `Department: ${employee.department}`
        : "",
      employee.designation
        ? `Designation: ${employee.designation}`
        : "",
      employee.status
        ? `Status: ${employee.status}`
        : "",
    ]
      .filter(Boolean)
      .join(" · "),
  });

  setShowModal(false);
  setSelectedEmployee(null);

  loadEmployees();
}

  async function handleDelete(id) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Employees cannot be deleted until you reconnect."
      );
      return;
    }

    if (!window.confirm("Move this employee to Recycle Bin?")) return;

    const employee = employees.find((e) => e.id === id);

    if (!employee) return;

    const { error: recycleError } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "employees",
          original_id: employee.id,
          data: employee,
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
      .from("employees")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    await logActivity({
      module: "Employees",
      action: "Moved to Recycle Bin",
      title: employee.full_name || employee.employee_id || "Employee",
      details: [
        employee.employee_id
          ? `Employee ID: ${employee.employee_id}`
          : "",
        employee.department
          ? `Department: ${employee.department}`
          : "",
        employee.designation
          ? `Designation: ${employee.designation}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });

    loadEmployees();
  }

  function handleEdit(employee) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Employees cannot be edited until you reconnect."
      );
      return;
    }

    setSelectedEmployee(employee);
    setShowModal(true);
  }

  const filteredEmployees = employees.filter((employee) =>
    (
      employee.full_name +
      " " +
      employee.employee_id +
      " " +
      employee.department +
      " " +
      employee.designation
    )
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="inventory-page">
      <h1 className="page-title">
        👨‍💼 Employee Management
      </h1>

      <p className="page-subtitle">
        Manage all employees of the organization.
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
            : " — no saved Employee data is available"}

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

      <EmployeeToolbar
        search={search}
        setSearch={setSearch}
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

          setSelectedEmployee(null);
          setShowModal(true);
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          gap: "20px",
          marginBottom: "25px",
        }}
      >
        <div className="summary-card">
          <h3>Total Employees</h3>
          <h1>{filteredEmployees.length}</h1>
        </div>

        <div className="summary-card">
          <h3>Active</h3>
          <h1>
            {
              filteredEmployees.filter(
                (e) => e.status === "Active"
              ).length
            }
          </h1>
        </div>

        <div className="summary-card">
          <h3>Inactive</h3>
          <h1>
            {
              filteredEmployees.filter(
                (e) => e.status === "Inactive"
              ).length
            }
          </h1>
        </div>
      </div>

      <EmployeeTable
        employees={filteredEmployees}
        focusedEmployeeId={focusedEmployeeId}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOnline={isOnline}
      />

      {showModal && (
        <AddEmployeeModal
          item={selectedEmployee}
          onClose={() => {
            setShowModal(false);
            setSelectedEmployee(null);
          }}
          onSave={handleSave}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}

export default Employees;