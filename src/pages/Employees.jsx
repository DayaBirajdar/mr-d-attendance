import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import EmployeeToolbar from "../components/employees/EmployeeToolbar";
import EmployeeTable from "../components/employees/EmployeeTable";
import AddEmployeeModal from "../components/employees/AddEmployeeModal";

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("is_deleted", false)
      .order("id", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    setEmployees(data || []);
  }

  async function handleSave(employee) {
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

  setShowModal(false);
  setSelectedEmployee(null);

  loadEmployees();
}

  async function handleDelete(id) {
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

    loadEmployees();
  }

  function handleEdit(employee) {
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

      <EmployeeToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => {
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
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showModal && (
        <AddEmployeeModal
          item={selectedEmployee}
          onClose={() => {
            setShowModal(false);
            setSelectedEmployee(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default Employees;