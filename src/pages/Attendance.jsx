import { loadFaceModels } from "../utils/faceRecognition";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";

import AttendanceToolbar from "../components/attendance/AttendanceToolbar";
import AttendanceTable from "../components/attendance/AttendanceTable";
import MonthlyAttendanceTable from "../components/attendance/MonthlyAttendanceTable";
import AddAttendanceModal from "../components/attendance/AddAttendanceModal";

const ATTENDANCE_SELFIE_BUCKET =
  "attendance-selfies";


function getAttendanceSelfiePath(
  value
) {
  if (!value) {
    return "";
  }

  // New records store only the object path.
  if (
    !value.startsWith("http://") &&
    !value.startsWith("https://")
  ) {
    return value;
  }

  // Support older rows that stored a Supabase public URL.
  const marker =
    `/storage/v1/object/public/${ATTENDANCE_SELFIE_BUCKET}/`;

  const markerIndex =
    value.indexOf(marker);

  if (markerIndex === -1) {
    return "";
  }

  const encodedPath =
    value.slice(
      markerIndex +
        marker.length
    )
      .split("?")[0];

  try {
    return decodeURIComponent(
      encodedPath
    );
  } catch {
    return encodedPath;
  }
}


async function addSignedSelfieUrls(
  rows
) {
  return Promise.all(
    (rows || []).map(
      async (item) => {
        const storagePath =
          getAttendanceSelfiePath(
            item.selfie_url
          );

        if (!storagePath) {
          return {
            ...item,
            selfie_display_url:
              "",
          };
        }

        const {
          data,
          error,
        } =
          await supabase.storage
            .from(
              ATTENDANCE_SELFIE_BUCKET
            )
            .createSignedUrl(
              storagePath,
              60 * 60
            );

        if (error) {
          console.error(
            "Attendance selfie signed URL error:",
            error
          );

          return {
            ...item,
            selfie_display_url:
              "",
          };
        }

        return {
          ...item,

          // Display-only field.
          // Never save this URL back to attendance.
          selfie_display_url:
            data?.signedUrl ||
            "",
        };
      }
    )
  );
}


function Attendance() {
  const [attendance, setAttendance] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedAttendance, setSelectedAttendance] = useState(null);

  const [isOnline, setIsOnline] = useState(
    navigator.onLine
  );

  const [usingCachedData, setUsingCachedData] =
    useState(false);

  const [cacheSavedAt, setCacheSavedAt] =
    useState(null);

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
      if (!navigator.onLine) {
        setIsOnline(false);

        await loadAllCachedAttendanceData();

        return;
      }

      setIsOnline(true);

      try {
        await Promise.all([
          loadAttendance(),
          loadAttendanceSettings(),
          loadEmployees(),
        ]);
      } catch (err) {
        console.error(
          "❌ Attendance data initialization error:",
          err
        );
      }

      try {
        console.log(
          "Loading AI Models..."
        );

        await loadFaceModels();

        console.log(
          "✅ Face Models Loaded Successfully"
        );
      } catch (err) {
        console.error(
          "❌ Face model initialization error:",
          err
        );
      }
    }

    async function handleOnline() {
      setIsOnline(true);

      try {
        await Promise.all([
          loadAttendance(),
          loadAttendanceSettings(),
          loadEmployees(),
        ]);
      } catch (err) {
        console.error(
          "Attendance online refresh error:",
          err
        );
      }

      loadFaceModels().catch(
        (err) => {
          console.error(
            "Face model reload error:",
            err
          );
        }
      );
    }

    function handleOffline() {
      setIsOnline(false);

      loadAllCachedAttendanceData();
    }

    initialize();

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

  async function loadAllCachedAttendanceData() {
    const [
      attendanceCache,
      employeesCache,
      settingsCache,
    ] = await Promise.all([
      readOfflineCache(
        "attendance"
      ),
      readOfflineCache(
        "attendance-employees"
      ),
      readOfflineCache(
        "attendance-settings"
      ),
    ]);

    let foundCache = false;

    if (attendanceCache) {
      setAttendance(
        attendanceCache.data || []
      );

      foundCache = true;
    }

    if (employeesCache) {
      setEmployees(
        employeesCache.data || []
      );

      foundCache = true;
    }

    if (
      settingsCache &&
      settingsCache.data?.[0]
    ) {
      setAttendanceSettings(
        settingsCache.data[0]
      );

      foundCache = true;
    }

    const timestamps = [
      attendanceCache?.savedAt,
      employeesCache?.savedAt,
      settingsCache?.savedAt,
    ].filter(Boolean);

    if (timestamps.length > 0) {
      timestamps.sort();

      setCacheSavedAt(
        timestamps[
          timestamps.length - 1
        ]
      );
    }

    setUsingCachedData(
      foundCache
    );

    return foundCache;
  }

  async function loadAttendanceSettings() {
    if (!navigator.onLine) {
      const cached =
        await readOfflineCache(
          "attendance-settings"
        );

      if (cached?.data?.[0]) {
        setAttendanceSettings(
          cached.data[0]
        );

        setUsingCachedData(true);

        if (cached.savedAt) {
          setCacheSavedAt(
            cached.savedAt
          );
        }
      }

      return;
    }

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

    const freshSettings = {
      office_start_time:
        data.office_start_time
          ?.slice(0, 5) ||
        "10:00",

      office_end_time:
        data.office_end_time
          ?.slice(0, 5) ||
        "19:00",

      grace_period_minutes:
        Number(
          data.grace_period_minutes ??
          15
        ),

      full_day_minutes:
        Number(
          data.full_day_minutes ??
          480
        ),

      half_day_minutes:
        Number(
          data.half_day_minutes ??
          240
        ),

      saturday_off:
        Boolean(
          data.saturday_off
        ),

      sunday_off:
        Boolean(
          data.sunday_off
        ),
    };

    setAttendanceSettings(
      freshSettings
    );

    await saveOfflineCache(
      "attendance-settings",
      [freshSettings]
    );
  }

  async function loadEmployees() {
    if (!navigator.onLine) {
      const cached =
        await readOfflineCache(
          "attendance-employees"
        );

      if (cached) {
        setEmployees(
          cached.data || []
        );

        setUsingCachedData(true);

        if (cached.savedAt) {
          setCacheSavedAt(
            cached.savedAt
          );
        }
      }

      return;
    }

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

    const freshEmployees =
      data || [];

    setEmployees(
      freshEmployees
    );

    await saveOfflineCache(
      "attendance-employees",
      freshEmployees
    );
  }


  async function loadAttendance() {
    if (!navigator.onLine) {
      setIsOnline(false);

      const cached =
        await readOfflineCache(
          "attendance"
        );

      if (cached) {
        setAttendance(
          cached.data || []
        );

        setUsingCachedData(true);

        if (cached.savedAt) {
          setCacheSavedAt(
            cached.savedAt
          );
        }
      }

      return;
    }

    setIsOnline(true);

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

      const cached =
        await readOfflineCache(
          "attendance"
        );

      if (cached) {
        setAttendance(
          cached.data || []
        );

        setUsingCachedData(true);

        if (cached.savedAt) {
          setCacheSavedAt(
            cached.savedAt
          );
        }
      }

      return;
    }

    const freshAttendance =
      data || [];

    const attendanceWithSignedSelfies =
      await addSignedSelfieUrls(
        freshAttendance
      );

    setAttendance(
      attendanceWithSignedSelfies
    );

    setUsingCachedData(false);

    // Cache raw database values rather than
    // temporary signed URLs.
    const savedAt =
      await saveOfflineCache(
        "attendance",
        freshAttendance
      );

    if (savedAt) {
      setCacheSavedAt(
        savedAt
      );
    }
  }

  async function handleSave(record) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Attendance changes cannot be saved until you reconnect."
      );

      return;
    }

    // Preserve existing selfie when editing.
    // Replace it only when a new verified selfie is captured.
    let selfiePath =
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

      selfiePath =
        fileName;

      const {
        data:
          signedData,
        error:
          signedError,
      } =
        await supabase.storage
          .from(
            "attendance-selfies"
          )
          .createSignedUrl(
            fileName,
            5 * 60
          );

      if (
        signedError ||
        !signedData?.signedUrl
      ) {
        console.error(
          "Unable to create attendance selfie signed URL:",
          signedError
        );

        alert(
          "The attendance selfie was uploaded, but its secure preview could not be created."
        );

        return;
      }

      const { compareFaces } =
        await import(
          "../utils/faceRecognition"
        );

      const result =
        await compareFaces(
          record.profilePhoto,
          signedData.signedUrl
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

      // Store only the Storage path.
      // Never save temporary signed URLs.
      selfie_url:
        selfiePath,
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
    if (!navigator.onLine) {
      alert(
        "You are offline. Attendance records cannot be deleted until you reconnect."
      );

      return;
    }

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
    if (!navigator.onLine) {
      alert(
        "You are offline. Attendance records cannot be edited until you reconnect."
      );

      return;
    }

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

      {!isOnline && (
        <div
          style={{
            marginBottom: "18px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: "#fff7ed",
            border:
              "1px solid #fdba74",
            color: "#9a3412",
            fontWeight: "600",
          }}
        >
          📡 Offline
          {usingCachedData
            ? " — showing last saved attendance data"
            : " — no saved Attendance data is available"}

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
        isOnline={isOnline}
        onAdd={() => {
          if (!isOnline) {
            return;
          }

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
            isOnline={
              isOnline
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
          isOnline={
            isOnline
          }
        />
      )}
    </div>
  );
}

export default Attendance;
