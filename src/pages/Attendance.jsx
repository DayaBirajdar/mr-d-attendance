import { loadFaceModels } from "../utils/faceRecognition";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";

import AttendanceToolbar from "../components/attendance/AttendanceToolbar";
import AttendanceTable from "../components/attendance/AttendanceTable";
import MonthlyAttendanceTable from "../components/attendance/MonthlyAttendanceTable";
import AddAttendanceModal from "../components/attendance/AddAttendanceModal";

function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);

  const [viewMode, setViewMode] = useState("daily");

  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );

  const [attendanceSettings, setAttendanceSettings] =
    useState({
      office_start_time: "10:00",
      office_end_time: "19:00",
      grace_period_minutes: 15,
      full_day_minutes: 480,
      half_day_minutes: 240,
      saturday_off: true,
      sunday_off: true,
    });

  useEffect(() => {
    async function initialize() {
      try {
        console.log("Loading AI Models...");

        await loadFaceModels();

        console.log("✅ Face Models Loaded Successfully");

        await Promise.all([
          loadAttendance(),
          loadAttendanceSettings(),
          loadEmployees(),
        ]);
      } catch (err) {
        console.error(
          "❌ Attendance initialization error:",
          err
        );
      }
    }

    initialize();
  }, []);

  async function loadAttendanceSettings() {
    const { data, error } = await supabase
      .from("attendance_settings")
      .select(`
        office_start_time,
        office_end_time,
        grace_period_minutes,
        full_day_minutes,
        half_day_minutes,
        saturday_off,
        sunday_off
      `)
      .order("id", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "Attendance settings load error:",
        error
      );
      return;
    }

    if (!data) {
      return;
    }

    setAttendanceSettings({
      office_start_time:
        data.office_start_time?.slice(0, 5) || "10:00",

      office_end_time:
        data.office_end_time?.slice(0, 5) || "19:00",

      grace_period_minutes:
        Number(data.grace_period_minutes ?? 15),

      full_day_minutes:
        Number(data.full_day_minutes ?? 480),

      half_day_minutes:
        Number(data.half_day_minutes ?? 240),

      saturday_off:
        Boolean(data.saturday_off),

      sunday_off:
        Boolean(data.sunday_off),
    });
  }

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select(`
        id,
        employee_id,
        full_name,
        department,
        designation,
        photo_url,
        joining_date,
        status,
        is_deleted
      `)
      .eq("status", "Active")
      .eq("is_deleted", false)
      .order("full_name", {
        ascending: true,
      });

    if (error) {
      console.error(
        "Employees load error:",
        error
      );
      return;
    }

    setEmployees(data || []);
  }


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
      .order("attendance_date", {
        ascending: false,
      });

    if (error) {
      console.error(error);
      return;
    }

    setAttendance(data || []);
  }

  async function handleSave(record) {
    // Preserve existing selfie when editing.
    // Replace it only when a new verified selfie is captured.
    let selfieUrl =
      selectedAttendance?.selfie_url || "";

    if (record.selfie) {
      const file = record.selfie;

      const fileName = `${Date.now()}-${file.name}`;

      const { error: uploadError } =
        await supabase.storage
          .from("attendance-selfies")
          .upload(fileName, file);

      if (uploadError) {
        console.error(uploadError);

        alert(
          JSON.stringify(
            uploadError,
            null,
            2
          )
        );

        return;
      }

      const { data } =
        supabase.storage
          .from("attendance-selfies")
          .getPublicUrl(fileName);

      selfieUrl = data.publicUrl;

      const { compareFaces } =
        await import(
          "../utils/faceRecognition"
        );

      const result =
        await compareFaces(
          record.profilePhoto,
          selfieUrl
        );

      console.log(
        "Face Match:",
        result
      );
    }

    const attendanceData = {
      employee_id:
        record.employee_id,

      attendance_date:
        record.attendance_date,

      check_in:
        record.check_in,

      check_out:
        record.check_out,

      working_hours:
        record.working_hours,

      late_minutes:
        record.late_minutes,

      attendance_status:
        record.attendance_status,

      status:
        record.status,

      remarks:
        record.remarks,

      selfie_url:
        selfieUrl,
    };

    let error;

    if (selectedAttendance) {
      ({ error } =
        await supabase
          .from("attendance")
          .update(attendanceData)
          .eq(
            "id",
            selectedAttendance.id
          ));
    } else {
      ({ error } =
        await supabase
          .from("attendance")
          .insert([
            attendanceData,
          ]));
    }

    if (error) {
      console.error(error);

      alert(
        JSON.stringify(
          error,
          null,
          2
        )
      );

      return;
    }

    const activityEmployee =
      employees.find(
        (employee) =>
          employee.id === record.employee_id
      );

    await logActivity({
      module: "Attendance",
      action: selectedAttendance
        ? "Updated"
        : "Added",
      title:
        activityEmployee?.full_name ||
        activityEmployee?.employee_id ||
        "Attendance Record",
      details: [
        activityEmployee?.employee_id
          ? `Employee ID: ${activityEmployee.employee_id}`
          : "",
        record.attendance_date
          ? `Date: ${record.attendance_date}`
          : "",
        record.attendance_status || record.status
          ? `Status: ${
              record.attendance_status ||
              record.status
            }`
          : "",
        record.check_in
          ? `Check In: ${record.check_in}`
          : "",
        record.check_out
          ? `Check Out: ${record.check_out}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });

    setShowModal(false);
    setSelectedAttendance(null);

    loadAttendance();
  }

  async function handleDelete(id) {
    if (
      !window.confirm(
        "Move this attendance record to Recycle Bin?"
      )
    ) {
      return;
    }

    const record =
      attendance.find(
        (a) => a.id === id
      );

    if (!record) return;

    const recycleData = {
      ...record,
    };

    delete recycleData.employees;

    const {
      error: recycleError,
    } = await supabase
      .from("recycle_bin")
      .insert([
        {
          original_table:
            "attendance",

          original_id:
            record.id,

          data:
            recycleData,

          deleted_by:
            "Admin",

          deleted_at:
            new Date().toISOString(),
        },
      ]);

    if (recycleError) {
      console.error(
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

    const {
      error: deleteError,
    } = await supabase
      .from("attendance")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error(
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
      module: "Attendance",
      action: "Moved to Recycle Bin",
      title:
        record.employees?.full_name ||
        record.employees?.employee_id ||
        "Attendance Record",
      details: [
        record.employees?.employee_id
          ? `Employee ID: ${record.employees.employee_id}`
          : "",
        record.attendance_date
          ? `Date: ${record.attendance_date}`
          : "",
        record.attendance_status || record.status
          ? `Status: ${
              record.attendance_status ||
              record.status
            }`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });

    loadAttendance();
  }

  function handleEdit(record) {
    setSelectedAttendance(
      record
    );

    setShowModal(true);
  }

  // ---------------------------------------------------------
  // WEEKLY OFF
  // ---------------------------------------------------------

  function isWeeklyOff(
    dateValue
  ) {
    if (!dateValue) {
      return false;
    }

    const date =
      new Date(
        `${dateValue}T00:00:00`
      );

    const day =
      date.getDay();

    if (
      day === 6 &&
      attendanceSettings.saturday_off
    ) {
      return true;
    }

    if (
      day === 0 &&
      attendanceSettings.sunday_off
    ) {
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------
  // FULL DAY / HALF DAY / SHORT HOURS
  // ---------------------------------------------------------

  function getWorkingDayStatus(
    item
  ) {
    if (!item) {
      return "-";
    }

    const status =
      item.attendance_status ||
      item.status;

    if (
      status === "Leave"
    ) {
      return "Leave";
    }

    if (
      status === "Absent"
    ) {
      return "Absent";
    }

    if (
      item.check_in &&
      !item.check_out
    ) {
      return "Present";
    }

    const minutes =
      workingMinutes(
        item.working_hours
      );

    if (
      minutes >=
      Number(
        attendanceSettings.full_day_minutes ||
        480
      )
    ) {
      return "Full Day";
    }

    if (
      minutes >=
      Number(
        attendanceSettings.half_day_minutes ||
        240
      )
    ) {
      return "Half Day";
    }

    if (
      minutes > 0
    ) {
      return "Short Hours";
    }

    if (
      status === "Present"
    ) {
      return "Present";
    }

    return status || "-";
  }

  const today =
    new Date()
      .toISOString()
      .split("T")[0];

  const filteredAttendance =
    attendance.filter(
      (item) => {
        const employee =
          item.employees || {};

        const text =
          search.toLowerCase();

        return (
          (
            employee.full_name ||
            ""
          )
            .toLowerCase()
            .includes(text) ||
          (
            employee.employee_id ||
            ""
          )
            .toLowerCase()
            .includes(text)
        );
      }
    );

  const todayAttendance =
    filteredAttendance.filter(
      (item) =>
        item.attendance_date ===
        today
    );

  const monthlyAttendance =
    filteredAttendance.filter(
      (item) =>
        item.attendance_date?.startsWith(
          selectedMonth
        )
    );

  const totalEmployees =
    new Set(
      filteredAttendance.map(
        (a) => a.employee_id
      )
    ).size;

  const presentToday =
    todayAttendance.filter(
      (a) =>
        a.attendance_status ===
          "Present" ||
        a.status ===
          "Present"
    ).length;

  const absentToday =
    todayAttendance.filter(
      (a) =>
        a.attendance_status ===
          "Absent" ||
        a.status ===
          "Absent"
    ).length;

  const leaveToday =
    todayAttendance.filter(
      (a) =>
        a.attendance_status ===
          "Leave" ||
        a.status ===
          "Leave"
    ).length;

  const lateToday =
    todayAttendance.filter(
      (a) =>
        Number(
          a.late_minutes || 0
        ) > 0
    ).length;

  function workingMinutes(
    value
  ) {
    if (!value) return 0;

    const match =
      value.match(
        /(\d+)h\s*(\d+)m/
      );

    if (!match) return 0;

    return (
      Number(match[1]) *
        60 +
      Number(match[2])
    );
  }

  function formatMinutes(
    minutes
  ) {
    const hours =
      Math.floor(
        minutes / 60
      );

    const mins =
      Math.round(
        minutes % 60
      );

    return `${hours}h ${mins}m`;
  }

  const totalWorkingMinutesToday =
    todayAttendance.reduce(
      (total, item) =>
        total +
        workingMinutes(
          item.working_hours
        ),
      0
    );

  const monthlyPresent =
    monthlyAttendance.filter(
      (item) =>
        item.attendance_status ===
          "Present" ||
        item.status ===
          "Present"
    ).length;

  const monthlyAbsent =
    monthlyAttendance.filter(
      (item) =>
        item.attendance_status ===
          "Absent" ||
        item.status ===
          "Absent"
    ).length;

  const monthlyLeave =
    monthlyAttendance.filter(
      (item) =>
        item.attendance_status ===
          "Leave" ||
        item.status ===
          "Leave"
    ).length;

  const monthlyLate =
    monthlyAttendance.filter(
      (item) =>
        Number(
          item.late_minutes || 0
        ) > 0
    ).length;

  const monthlyWorkingMinutes =
    monthlyAttendance.reduce(
      (total, item) =>
        total +
        workingMinutes(
          item.working_hours
        ),
      0
    );

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        🕒 Attendance Management
      </h1>

      <p className="page-subtitle">
        Manage employee attendance records.
      </p>

      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "20px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setViewMode(
              "daily"
            )
          }
          style={{
            padding:
              "10px 18px",

            fontWeight:
              viewMode ===
              "daily"
                ? "700"
                : "400",
          }}
        >
          📅 Daily View
        </button>

        <button
          type="button"
          onClick={() =>
            setViewMode(
              "monthly"
            )
          }
          style={{
            padding:
              "10px 18px",

            fontWeight:
              viewMode ===
              "monthly"
                ? "700"
                : "400",
          }}
        >
          📊 Monthly View
        </button>

        {viewMode ===
          "monthly" && (
          <input
            type="month"
            value={
              selectedMonth
            }
            onChange={(e) =>
              setSelectedMonth(
                e.target.value
              )
            }
            style={{
              padding:
                "9px 12px",
            }}
          />
        )}
      </div>

      <AttendanceToolbar
        search={search}
        setSearch={setSearch}
        onAdd={() => {
          setSelectedAttendance(
            null
          );

          setShowModal(
            true
          );
        }}
      />

      {viewMode ===
        "daily" && (
        <>
          <div
            style={{
              display: "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",

              gap: "20px",

              marginBottom:
                "25px",
            }}
          >
            <div className="summary-card">
              <h3>
                Total Employees
              </h3>

              <h1>
                {
                  totalEmployees
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Present Today
              </h3>

              <h1>
                {
                  presentToday
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Absent Today
              </h3>

              <h1>
                {
                  absentToday
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Leave Today
              </h3>

              <h1>
                {
                  leaveToday
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Late Today
              </h3>

              <h1>
                {
                  lateToday
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Total Working Hours
              </h3>

              <h1>
                {formatMinutes(
                  totalWorkingMinutesToday
                )}
              </h1>
            </div>
          </div>

          <AttendanceTable
            attendance={
              todayAttendance
            }
            onEdit={
              handleEdit
            }
            onDelete={
              handleDelete
            }
          />
        </>
      )}

      {viewMode ===
        "monthly" && (
        <>
          <div
            style={{
              display: "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(200px,1fr))",

              gap: "20px",

              marginBottom:
                "25px",
            }}
          >
            <div className="summary-card">
              <h3>
                Present
              </h3>

              <h1>
                {
                  monthlyPresent
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Absent
              </h3>

              <h1>
                {
                  monthlyAbsent
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Leave
              </h3>

              <h1>
                {
                  monthlyLeave
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Late Entries
              </h3>

              <h1>
                {
                  monthlyLate
                }
              </h1>
            </div>

            <div className="summary-card">
              <h3>
                Monthly Hours
              </h3>

              <h1>
                {formatMinutes(
                  monthlyWorkingMinutes
                )}
              </h1>
            </div>
          </div>

          <MonthlyAttendanceTable
  attendance={
    monthlyAttendance
  }
  employees={
    employees
  }
  selectedMonth={
    selectedMonth
  }
  attendanceSettings={
    attendanceSettings
  }
/>
        </>
      )}

      {showModal && (
        <AddAttendanceModal
          item={
            selectedAttendance
          }
          onClose={() => {
            setShowModal(
              false
            );

            setSelectedAttendance(
              null
            );
          }}
          onSave={
            handleSave
          }
        />
      )}
    </div>
  );
}

export default Attendance;
