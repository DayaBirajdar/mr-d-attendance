import { loadFaceModels } from "../utils/faceRecognition";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

import AttendanceToolbar from "../components/attendance/AttendanceToolbar";
import AttendanceTable from "../components/attendance/AttendanceTable";
import AddAttendanceModal from "../components/attendance/AddAttendanceModal";

function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);

  useEffect(() => {
  async function initialize() {
    try {
      console.log("Loading AI Models...");

      await loadFaceModels();

      console.log("✅ Face Models Loaded Successfully");

      await loadAttendance();
    } catch (err) {
      console.error("❌ Face Model Error:", err);
    }
  }

  initialize();
}, []);

  async function loadAttendance() {
    const { data, error } = await supabase
      .from("attendance")
      .select(`
  id,
  employee_id,
  attendance_date,
  check_in,
  check_out,
  working_hours,
  late_minutes,
  attendance_status,
  status,
  remarks,
  selfie_url,
  is_deleted,
  employees (
    full_name,
    employee_id,
    department,
    designation,
    photo_url
  )
`)
      .eq("is_deleted", false)
      .order("attendance_date", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setAttendance(data || []);
  }

  async function handleSave(record) {
  let selfieUrl = "";
  let faceMatched = false;

  // Upload selfie if selected
  if (record.selfie) {
    const file = record.selfie;

    const fileName = `${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("attendance-selfies")
      .upload(fileName, file);

    if (uploadError) {
      console.error(uploadError);
      alert(JSON.stringify(uploadError, null, 2));
      return;
    }

    const { data } = supabase.storage
      .from("attendance-selfies")
      .getPublicUrl(fileName);

    selfieUrl = data.publicUrl;
    const { compareFaces } = await import("../utils/faceRecognition");

const result = await compareFaces(
  record.profilePhoto,
  selfieUrl
);

faceMatched = result.matched;

console.log("Face Match:", result);
  }

  const attendanceData = {
    employee_id: record.employee_id,
    attendance_date: record.attendance_date,
    check_in: record.check_in,
    check_out: record.check_out,
    working_hours: record.working_hours,
    late_minutes: record.late_minutes,
    attendance_status: record.attendance_status,
    status: record.status,
    remarks: record.remarks,
    selfie_url: selfieUrl,
  };

  let error;

  if (selectedAttendance) {
    ({ error } = await supabase
      .from("attendance")
      .update(attendanceData)
      .eq("id", selectedAttendance.id));
  } else {
    ({ error } = await supabase
      .from("attendance")
      .insert([attendanceData]));
  }

  if (error) {
    console.error(error);
    alert(JSON.stringify(error, null, 2));
    return;
  }

  setShowModal(false);
  setSelectedAttendance(null);

  loadAttendance();
}

  async function handleDelete(id) {
    if (!window.confirm("Move this attendance record to Recycle Bin?"))
      return;

    const record = attendance.find((a) => a.id === id);

    if (!record) return;

    const recycleData = { ...record };
    delete recycleData.employees;

    const { error: recycleError } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table: "attendance",
          original_id: record.id,
          data: recycleData,
          deleted_by: "Admin",
          deleted_at: new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error(recycleError);
      alert(JSON.stringify(recycleError, null, 2));
      return;
    }

    const { error: deleteError } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(deleteError);
      alert(JSON.stringify(deleteError, null, 2));
      return;
    }

    loadAttendance();
  }

  function handleEdit(record) {
    setSelectedAttendance(record);
    setShowModal(true);
  }

  const today = new Date().toISOString().split("T")[0];

  const filteredAttendance = attendance.filter((item) => {
    const employee = item.employees || {};

    return (
      (employee.full_name || "")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (employee.employee_id || "")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  });

  const todayAttendance = filteredAttendance.filter(
    (item) => item.attendance_date === today
  );

  const totalEmployees = new Set(
    filteredAttendance.map((a) => a.employee_id)
  ).size;

  const presentToday = todayAttendance.filter(
    (a) => a.attendance_status === "Present"
  ).length;

  const absentToday = todayAttendance.filter(
    (a) => a.attendance_status === "Absent"
  ).length;

  const leaveToday = todayAttendance.filter(
    (a) => a.attendance_status === "Leave"
  ).length;

  const lateToday = todayAttendance.filter(
    (a) => (a.late_minutes || 0) > 0
  ).length;

  const totalWorkingHours = todayAttendance.reduce((total, item) => {
    if (!item.working_hours) return total;

    const match = item.working_hours.match(/(\d+)h\s*(\d+)m/);

    if (!match) return total;

    return total + Number(match[1]) + Number(match[2]) / 60;
  }, 0);

  return (
    <div className="inventory-page">
      <h1 className="page-title">
        🕒 Attendance Management
      </h1>

      <p className="page-subtitle">
        Manage employee attendance records.
      </p>

      <AttendanceToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => {
          setSelectedAttendance(null);
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
          <h1>{totalEmployees}</h1>
        </div>

        <div className="summary-card">
          <h3>Present Today</h3>
          <h1>{presentToday}</h1>
        </div>

        <div className="summary-card">
          <h3>Absent Today</h3>
          <h1>{absentToday}</h1>
        </div>

        <div className="summary-card">
          <h3>Leave Today</h3>
          <h1>{leaveToday}</h1>
        </div>

        <div className="summary-card">
          <h3>Late Today</h3>
          <h1>{lateToday}</h1>
        </div>

        <div className="summary-card">
          <h3>Total Working Hours</h3>
          <h1>{totalWorkingHours.toFixed(1)} hrs</h1>
        </div>
      </div>

      <AttendanceTable
        attendance={filteredAttendance}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {showModal && (
        <AddAttendanceModal
          item={selectedAttendance}
          onClose={() => {
            setShowModal(false);
            setSelectedAttendance(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export default Attendance;