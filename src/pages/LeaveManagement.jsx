import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activityLog";
import {
  readOfflineCache,
  saveOfflineCache,
} from "../lib/offlineCache";


function LeaveManagement() {
  const currentYear =
    new Date().getFullYear();

  const todayString =
    new Date()
      .toISOString()
      .split("T")[0];


  const [requests, setRequests] =
    useState([]);

  const [leaveTypes, setLeaveTypes] =
    useState([]);

  const [employees, setEmployees] =
    useState([]);

  const [
    attendanceSettings,
    setAttendanceSettings,
  ] = useState({
    saturday_off: true,
    sunday_off: true,
  });

  const [selectedYear, setSelectedYear] =
    useState(currentYear);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [isOnline, setIsOnline] =
    useState(
      navigator.onLine
    );

  const [
    usingCachedData,
    setUsingCachedData,
  ] = useState(false);

  const [
    cacheSavedAt,
    setCacheSavedAt,
  ] = useState(null);

  const [showForm, setShowForm] =
    useState(false);

  const [form, setForm] =
    useState({
      employee_id: "",
      leave_type_id: "",
      start_date: "",
      end_date: "",
      reason: "",
    });


  useEffect(() => {
    loadPage();

    function handleOnline() {
      setIsOnline(true);
      loadPage();
    }

    function handleOffline() {
      setIsOnline(false);
      loadCachedLeaveData();
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


  // ---------------------------------------------------------
  // LOAD PAGE
  // ---------------------------------------------------------

  async function loadCachedLeaveData() {
    const [
      requestsCache,
      leaveTypesCache,
      employeesCache,
      settingsCache,
    ] = await Promise.all([
      readOfflineCache(
        "leave-requests"
      ),
      readOfflineCache(
        "leave-types"
      ),
      readOfflineCache(
        "leave-employees"
      ),
      readOfflineCache(
        "leave-settings"
      ),
    ]);

    let foundCache = false;

    if (requestsCache) {
      setRequests(
        requestsCache.data || []
      );
      foundCache = true;
    }

    if (leaveTypesCache) {
      setLeaveTypes(
        leaveTypesCache.data || []
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
      settingsCache?.data?.[0]
    ) {
      setAttendanceSettings(
        settingsCache.data[0]
      );
      foundCache = true;
    }

    const timestamps = [
      requestsCache?.savedAt,
      leaveTypesCache?.savedAt,
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

    setLoading(false);

    return foundCache;
  }


  async function loadPage() {
    if (!navigator.onLine) {
      setIsOnline(false);

      await loadCachedLeaveData();

      return;
    }

    setIsOnline(true);
    setLoading(true);

    const [
      requestsResult,
      leaveTypesResult,
      employeesResult,
      settingsResult,
    ] =
      await Promise.all([
        supabase
          .from("leave_requests")
          .select(`
            *,
            employees (
              id,
              employee_id,
              full_name,
              department
            ),
            leave_types (
              id,
              name,
              code,
              annual_limit,
              is_paid
            )
          `)
          .order(
            "id",
            {
              ascending: false,
            }
          ),

        supabase
          .from("leave_types")
          .select("*")
          .eq(
            "is_active",
            true
          )
          .order(
            "id",
            {
              ascending: true,
            }
          ),

        supabase
          .from("employees")
          .select(`
            id,
            employee_id,
            full_name,
            department,
            status,
            is_deleted
          `)
          .eq(
            "status",
            "Active"
          )
          .eq(
            "is_deleted",
            false
          )
          .order(
            "full_name",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "attendance_settings"
          )
          .select(`
            saturday_off,
            sunday_off
          `)
          .order(
            "id",
            {
              ascending: true,
            }
          )
          .limit(1)
          .maybeSingle(),
      ]);


    if (
      requestsResult.error
    ) {
      console.error(
        "Leave requests load error:",
        requestsResult.error
      );
    }


    if (
      leaveTypesResult.error
    ) {
      console.error(
        "Leave types load error:",
        leaveTypesResult.error
      );
    }


    if (
      employeesResult.error
    ) {
      console.error(
        "Employees load error:",
        employeesResult.error
      );
    }


    if (
      settingsResult.error
    ) {
      console.error(
        "Attendance settings load error:",
        settingsResult.error
      );
    }


    const freshRequests =
      requestsResult.data || [];

    setRequests(
      freshRequests
    );

    await saveOfflineCache(
      "leave-requests",
      freshRequests
    );

    const freshLeaveTypes =
      leaveTypesResult.data || [];

    setLeaveTypes(
      freshLeaveTypes
    );

    await saveOfflineCache(
      "leave-types",
      freshLeaveTypes
    );

    const freshEmployees =
      employeesResult.data || [];

    setEmployees(
      freshEmployees
    );

    await saveOfflineCache(
      "leave-employees",
      freshEmployees
    );


    if (
      settingsResult.data
    ) {
      const freshSettings = {
        saturday_off:
          settingsResult.data
            .saturday_off ??
          true,

        sunday_off:
          settingsResult.data
            .sunday_off ??
          true,
      };

      setAttendanceSettings(
        freshSettings
      );

      await saveOfflineCache(
        "leave-settings",
        [freshSettings]
      );
    }


    setUsingCachedData(false);

    const cacheTimes = [
      await readOfflineCache(
        "leave-requests"
      ),
      await readOfflineCache(
        "leave-types"
      ),
      await readOfflineCache(
        "leave-employees"
      ),
      await readOfflineCache(
        "leave-settings"
      ),
    ]
      .map(
        (item) =>
          item?.savedAt
      )
      .filter(Boolean)
      .sort();

    if (cacheTimes.length > 0) {
      setCacheSavedAt(
        cacheTimes[
          cacheTimes.length - 1
        ]
      );
    }

    setLoading(false);
  }


  // ---------------------------------------------------------
  // DATE HELPERS
  // ---------------------------------------------------------

  function createDate(
    value
  ) {
    if (!value) {
      return null;
    }

    return new Date(
      `${value}T00:00:00`
    );
  }


  function formatDate(
    value
  ) {
    if (!value) {
      return "-";
    }

    const date =
      createDate(
        value
      );

    if (
      !date ||
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return date
      .toLocaleDateString(
        "en-IN"
      );
  }


  function isWeeklyOff(
    date
  ) {
    const day =
      date.getDay();

    if (
      day === 6 &&
      attendanceSettings
        .saturday_off
    ) {
      return true;
    }

    if (
      day === 0 &&
      attendanceSettings
        .sunday_off
    ) {
      return true;
    }

    return false;
  }


  // ---------------------------------------------------------
  // WORKING LEAVE DAYS
  // ---------------------------------------------------------

  function calculateWorkingDays(
    startDate,
    endDate
  ) {
    const start =
      createDate(
        startDate
      );

    const end =
      createDate(
        endDate
      );


    if (
      !start ||
      !end ||
      Number.isNaN(
        start.getTime()
      ) ||
      Number.isNaN(
        end.getTime()
      ) ||
      end < start
    ) {
      return 0;
    }


    let count = 0;

    const cursor =
      new Date(start);


    while (
      cursor <= end
    ) {
      if (
        !isWeeklyOff(
          cursor
        )
      ) {
        count++;
      }

      cursor.setDate(
        cursor.getDate() +
          1
      );
    }


    return count;
  }


  // ---------------------------------------------------------
  // WORKING DAYS FOR ONE YEAR
  // ---------------------------------------------------------

  function calculateDaysForYear(
    startDate,
    endDate,
    year
  ) {
    const originalStart =
      createDate(
        startDate
      );

    const originalEnd =
      createDate(
        endDate
      );


    if (
      !originalStart ||
      !originalEnd ||
      originalEnd <
        originalStart
    ) {
      return 0;
    }


    const yearStart =
      new Date(
        year,
        0,
        1
      );

    const yearEnd =
      new Date(
        year,
        11,
        31
      );


    const start =
      originalStart >
      yearStart
        ? originalStart
        : yearStart;


    const end =
      originalEnd <
      yearEnd
        ? originalEnd
        : yearEnd;


    if (
      end < start
    ) {
      return 0;
    }


    let count = 0;

    const cursor =
      new Date(start);


    while (
      cursor <= end
    ) {
      if (
        !isWeeklyOff(
          cursor
        )
      ) {
        count++;
      }

      cursor.setDate(
        cursor.getDate() +
          1
      );
    }


    return count;
  }


  // ---------------------------------------------------------
  // YEARS INSIDE REQUEST
  // ---------------------------------------------------------

  function getRequestYears(
    startDate,
    endDate
  ) {
    const start =
      createDate(
        startDate
      );

    const end =
      createDate(
        endDate
      );


    if (
      !start ||
      !end
    ) {
      return [];
    }


    const years = [];

    for (
      let year =
        start.getFullYear();
      year <=
      end.getFullYear();
      year++
    ) {
      years.push(
        year
      );
    }


    return years;
  }


  // ---------------------------------------------------------
  // APPROVED DAYS
  // ---------------------------------------------------------

  function getApprovedDays({
    employeeId,
    leaveTypeId,
    year,
    excludeRequestId =
      null,
  }) {
    return requests
      .filter(
        (item) =>
          Number(
            item.employee_id
          ) ===
            Number(
              employeeId
            ) &&
          Number(
            item.leave_type_id
          ) ===
            Number(
              leaveTypeId
            ) &&
          item.status ===
            "Approved" &&
          (
            excludeRequestId ===
              null ||
            Number(
              item.id
            ) !==
              Number(
                excludeRequestId
              )
          )
      )
      .reduce(
        (
          total,
          item
        ) =>
          total +
          calculateDaysForYear(
            item.start_date,
            item.end_date,
            year
          ),
        0
      );
  }


  // ---------------------------------------------------------
  // PENDING DAYS
  // ---------------------------------------------------------

  function getPendingDays({
    employeeId,
    leaveTypeId,
    year,
  }) {
    return requests
      .filter(
        (item) =>
          Number(
            item.employee_id
          ) ===
            Number(
              employeeId
            ) &&
          Number(
            item.leave_type_id
          ) ===
            Number(
              leaveTypeId
            ) &&
          item.status ===
            "Pending"
      )
      .reduce(
        (
          total,
          item
        ) =>
          total +
          calculateDaysForYear(
            item.start_date,
            item.end_date,
            year
          ),
        0
      );
  }


  // ---------------------------------------------------------
  // USED DAYS
  // ---------------------------------------------------------

  function getUsedDays({
    employeeId,
    leaveTypeId,
    year,
  }) {
    return requests
      .filter(
        (item) =>
          Number(
            item.employee_id
          ) ===
            Number(
              employeeId
            ) &&
          Number(
            item.leave_type_id
          ) ===
            Number(
              leaveTypeId
            ) &&
          item.status ===
            "Approved"
      )
      .reduce(
        (
          total,
          item
        ) => {
          const start =
            createDate(
              item.start_date
            );

          const end =
            createDate(
              item.end_date
            );

          const today =
            createDate(
              todayString
            );


          if (
            !start ||
            !end ||
            !today
          ) {
            return total;
          }


          if (
            start > today
          ) {
            return total;
          }


          const usedEnd =
            end < today
              ? end
              : today;


          const usedEndString =
            `${usedEnd.getFullYear()}-${String(
              usedEnd.getMonth() +
                1
            ).padStart(
              2,
              "0"
            )}-${String(
              usedEnd.getDate()
            ).padStart(
              2,
              "0"
            )}`;


          return (
            total +
            calculateDaysForYear(
              item.start_date,
              usedEndString,
              year
            )
          );
        },
        0
      );
  }


  // ---------------------------------------------------------
  // FUTURE APPROVED DAYS
  // ---------------------------------------------------------

  function getFutureApprovedDays({
    employeeId,
    leaveTypeId,
    year,
  }) {
    const approved =
      getApprovedDays({
        employeeId,
        leaveTypeId,
        year,
      });

    const used =
      getUsedDays({
        employeeId,
        leaveTypeId,
        year,
      });

    return Math.max(
      0,
      approved -
        used
    );
  }


  // ---------------------------------------------------------
  // BALANCE ROWS
  // ---------------------------------------------------------

  const balanceRows =
    useMemo(
      () => {
        const rows = [];

        employees.forEach(
          (employee) => {
            leaveTypes.forEach(
              (type) => {
                const approved =
                  getApprovedDays({
                    employeeId:
                      employee.id,

                    leaveTypeId:
                      type.id,

                    year:
                      selectedYear,
                  });


                const used =
                  getUsedDays({
                    employeeId:
                      employee.id,

                    leaveTypeId:
                      type.id,

                    year:
                      selectedYear,
                  });


                const futureApproved =
                  Math.max(
                    0,
                    approved -
                      used
                  );


                const pending =
                  getPendingDays({
                    employeeId:
                      employee.id,

                    leaveTypeId:
                      type.id,

                    year:
                      selectedYear,
                  });


                const annualLimit =
                  Number(
                    type.annual_limit ||
                      0
                  );


                const remaining =
                  type.is_paid &&
                  annualLimit > 0
                    ? Math.max(
                        0,
                        annualLimit -
                          approved
                      )
                    : null;


                rows.push({
                  employee,
                  type,
                  annualLimit,
                  approved,
                  used,
                  futureApproved,
                  pending,
                  remaining,
                });
              }
            );
          }
        );

        return rows;
      },
      [
        employees,
        leaveTypes,
        requests,
        selectedYear,
        attendanceSettings,
      ]
    );


  // ---------------------------------------------------------
  // SUBMIT LEAVE
  // ---------------------------------------------------------

  async function submitLeave(
    e
  ) {
    e.preventDefault();

    if (!navigator.onLine) {
      alert(
        "You are offline. Leave requests cannot be submitted until you reconnect."
      );

      return;
    }


    if (
      !form.employee_id ||
      !form.leave_type_id ||
      !form.start_date ||
      !form.end_date
    ) {
      alert(
        "Please fill employee, leave type, start date and end date."
      );

      return;
    }


    const totalDays =
      calculateWorkingDays(
        form.start_date,
        form.end_date
      );


    if (
      totalDays <= 0
    ) {
      alert(
        "This leave request contains no working days, or the end date is before the start date."
      );

      return;
    }


    setSaving(
      true
    );


    const {
      error,
    } =
      await supabase
        .from(
          "leave_requests"
        )
        .insert([
          {
            employee_id:
              Number(
                form.employee_id
              ),

            leave_type_id:
              Number(
                form.leave_type_id
              ),

            start_date:
              form.start_date,

            end_date:
              form.end_date,

            total_days:
              totalDays,

            reason:
              form.reason.trim(),

            status:
              "Pending",
          },
        ]);


    if (error) {
      console.error(
        "Leave request insert error:",
        error
      );

      alert(
        JSON.stringify(
          error,
          null,
          2
        )
      );

      setSaving(
        false
      );

      return;
    }


    const activityEmployee =
      employees.find(
        (employee) =>
          Number(employee.id) ===
          Number(form.employee_id)
      );

    const activityLeaveType =
      leaveTypes.find(
        (type) =>
          Number(type.id) ===
          Number(form.leave_type_id)
      );

    await logActivity({
      module: "Leave Management",
      action: "Requested",
      title:
        activityEmployee?.full_name ||
        activityEmployee?.employee_id ||
        "Leave Request",
      details: [
        activityEmployee?.employee_id
          ? `Employee ID: ${activityEmployee.employee_id}`
          : "",
        activityLeaveType?.name
          ? `Leave Type: ${activityLeaveType.name}`
          : "",
        form.start_date
          ? `From: ${form.start_date}`
          : "",
        form.end_date
          ? `To: ${form.end_date}`
          : "",
        totalDays
          ? `Days: ${totalDays}`
          : "",
        form.reason.trim()
          ? `Reason: ${form.reason.trim()}`
          : "",
        "Status: Pending",
      ]
        .filter(Boolean)
        .join(" · "),
    });

    setForm({
      employee_id: "",
      leave_type_id: "",
      start_date: "",
      end_date: "",
      reason: "",
    });


    setShowForm(
      false
    );


    await loadPage();


    setSaving(
      false
    );
  }


  // ---------------------------------------------------------
  // CHECK BALANCE BEFORE APPROVAL
  // ---------------------------------------------------------

  function canApproveRequest(
    request
  ) {
    const type =
      leaveTypes.find(
        (item) =>
          Number(
            item.id
          ) ===
          Number(
            request.leave_type_id
          )
      );


    if (!type) {
      return {
        allowed: false,
        message:
          "Leave type could not be found.",
      };
    }


    if (
      !type.is_paid ||
      Number(
        type.annual_limit ||
          0
      ) <= 0
    ) {
      return {
        allowed: true,
      };
    }


    const annualLimit =
      Number(
        type.annual_limit
      );


    const years =
      getRequestYears(
        request.start_date,
        request.end_date
      );


    for (
      const year of years
    ) {
      const requestedDays =
        calculateDaysForYear(
          request.start_date,
          request.end_date,
          year
        );


      const existingApproved =
        getApprovedDays({
          employeeId:
            request.employee_id,

          leaveTypeId:
            request.leave_type_id,

          year,

          excludeRequestId:
            request.id,
        });


      const available =
        annualLimit -
        existingApproved;


      if (
        requestedDays >
        available
      ) {
        return {
          allowed: false,

          message:
            `${type.name} balance is insufficient for ${year}. ` +
            `Available: ${Math.max(
              0,
              available
            )} day(s). ` +
            `Requested: ${requestedDays} day(s).`,
        };
      }
    }


    return {
      allowed: true,
    };
  }


  // ---------------------------------------------------------
  // APPROVE / REJECT
  // ---------------------------------------------------------

  async function updateStatus(
    request,
    status
  ) {
    if (!navigator.onLine) {
      alert(
        "You are offline. Leave requests cannot be approved or rejected until you reconnect."
      );

      return;
    }

    const action =
      status ===
      "Approved"
        ? "approve"
        : "reject";


    if (
      status ===
      "Approved"
    ) {
      const check =
        canApproveRequest(
          request
        );


      if (
        !check.allowed
      ) {
        alert(
          check.message
        );

        return;
      }
    }


    const confirmed =
      window.confirm(
        `Are you sure you want to ${action} this leave request?`
      );


    if (
      !confirmed
    ) {
      return;
    }


    let remarks = "";


    if (
      status ===
      "Rejected"
    ) {
      remarks =
        window.prompt(
          "Reason for rejection (optional):"
        ) || "";
    }


    const recalculatedDays =
      calculateWorkingDays(
        request.start_date,
        request.end_date
      );


    const {
      error,
    } =
      await supabase
        .from(
          "leave_requests"
        )
        .update({
          status,

          total_days:
            recalculatedDays,

          admin_remarks:
            remarks,

          reviewed_at:
            new Date()
              .toISOString(),

          reviewed_by:
            "Admin",
        })
        .eq(
          "id",
          request.id
        );


    if (error) {
      console.error(
        "Leave update error:",
        error
      );

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
      request.employees ||
      employees.find(
        (employee) =>
          Number(employee.id) ===
          Number(request.employee_id)
      );

    const activityLeaveType =
      request.leave_types ||
      leaveTypes.find(
        (type) =>
          Number(type.id) ===
          Number(request.leave_type_id)
      );

    await logActivity({
      module: "Leave Management",
      action: status,
      title:
        activityEmployee?.full_name ||
        activityEmployee?.employee_id ||
        "Leave Request",
      details: [
        activityEmployee?.employee_id
          ? `Employee ID: ${activityEmployee.employee_id}`
          : "",
        activityLeaveType?.name
          ? `Leave Type: ${activityLeaveType.name}`
          : "",
        request.start_date
          ? `From: ${request.start_date}`
          : "",
        request.end_date
          ? `To: ${request.end_date}`
          : "",
        recalculatedDays
          ? `Days: ${recalculatedDays}`
          : "",
        status === "Rejected" && remarks
          ? `Remarks: ${remarks}`
          : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });

    await loadPage();
  }


  // ---------------------------------------------------------
  // SUMMARY COUNTS
  // ---------------------------------------------------------

  const yearRequests =
    useMemo(
      () =>
        requests.filter(
          (item) =>
            calculateDaysForYear(
              item.start_date,
              item.end_date,
              selectedYear
            ) > 0
        ),
      [
        requests,
        selectedYear,
        attendanceSettings,
      ]
    );


  const pendingCount =
    yearRequests.filter(
      (item) =>
        item.status ===
        "Pending"
    ).length;


  const approvedCount =
    yearRequests.filter(
      (item) =>
        item.status ===
        "Approved"
    ).length;


  const rejectedCount =
    yearRequests.filter(
      (item) =>
        item.status ===
        "Rejected"
    ).length;


  const approvedLeaveDays =
    yearRequests
      .filter(
        (item) =>
          item.status ===
          "Approved"
      )
      .reduce(
        (
          total,
          item
        ) =>
          total +
          calculateDaysForYear(
            item.start_date,
            item.end_date,
            selectedYear
          ),
        0
      );


  // ---------------------------------------------------------
  // STATUS STYLE
  // ---------------------------------------------------------

  function statusStyle(
    status
  ) {
    if (
      status ===
      "Approved"
    ) {
      return {
        background:
          "#dcfce7",

        color:
          "#166534",
      };
    }


    if (
      status ===
      "Rejected"
    ) {
      return {
        background:
          "#fee2e2",

        color:
          "#991b1b",
      };
    }


    return {
      background:
        "#fef3c7",

      color:
        "#92400e",
    };
  }


  // ---------------------------------------------------------
  // LOADING
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div>
        Loading leave management...
      </div>
    );
  }


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div className="inventory-page">

      <div
        style={{
          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "space-between",

          gap:
            "20px",

          flexWrap:
            "wrap",

          marginBottom:
            "25px",
        }}
      >

        <div>
          <h1 className="page-title">
            🏖 Leave Management
          </h1>

          <p className="page-subtitle">
            Manage employee leave
            requests, balances and
            approvals.
          </p>
        </div>


        <button
          type="button"

          disabled={!isOnline}

          title={
            !isOnline
              ? "Reconnect to add leave request"
              : undefined
          }

          onClick={() => {
            if (!isOnline) {
              return;
            }

            setShowForm(
              !showForm
            );
          }}

          style={{
            ...primaryButton,
            opacity: isOnline ? 1 : 0.5,
            cursor: isOnline
              ? "pointer"
              : "not-allowed",
          }}
        >
          {showForm
            ? "Cancel"
            : "+ Add Leave Request"}
        </button>

      </div>


      {!isOnline && (
        <div
          style={{
            marginBottom: "20px",
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
            ? " — showing last saved leave data"
            : " — no saved Leave Management data is available"}

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


      {/* YEAR FILTER */}

      <div
        style={{
          marginBottom:
            "20px",

          display:
            "flex",

          alignItems:
            "center",

          gap:
            "10px",
        }}
      >
        <strong>
          Leave Year:
        </strong>

        <select
          value={
            selectedYear
          }

          onChange={(e) =>
            setSelectedYear(
              Number(
                e.target.value
              )
            )
          }

          style={{
            ...fieldStyle,
            width:
              "140px",
          }}
        >
          {[
            currentYear - 1,
            currentYear,
            currentYear + 1,
          ].map(
            (year) => (
              <option
                key={
                  year
                }
                value={
                  year
                }
              >
                {year}
              </option>
            )
          )}
        </select>
      </div>


      {/* SUMMARY */}

      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "repeat(auto-fit,minmax(180px,1fr))",

          gap:
            "20px",

          marginBottom:
            "25px",
        }}
      >

        <div className="summary-card">
          <h3>
            Pending Requests
          </h3>

          <h1>
            {pendingCount}
          </h1>
        </div>


        <div className="summary-card">
          <h3>
            Approved Requests
          </h3>

          <h1>
            {approvedCount}
          </h1>
        </div>


        <div className="summary-card">
          <h3>
            Rejected Requests
          </h3>

          <h1>
            {rejectedCount}
          </h1>
        </div>


        <div className="summary-card">
          <h3>
            Approved Leave Days
          </h3>

          <h1>
            {approvedLeaveDays}
          </h1>
        </div>

      </div>


      {/* WEEKLY OFF INFO */}

      <div
        style={{
          padding:
            "14px 18px",

          background:
            "#eff6ff",

          borderRadius:
            "12px",

          marginBottom:
            "25px",

          color:
            "#1e40af",
        }}
      >
        <strong>
          Leave Calculation:
        </strong>{" "}

        Weekly offs are excluded.

        {" "}

        Saturday:{" "}
        <strong>
          {attendanceSettings
            .saturday_off
            ? "Off"
            : "Working"}
        </strong>

        {" • "}

        Sunday:{" "}
        <strong>
          {attendanceSettings
            .sunday_off
            ? "Off"
            : "Working"}
        </strong>
      </div>


      {/* ADD LEAVE FORM */}

      {showForm && (
        <form
          onSubmit={
            submitLeave
          }

          style={{
            background:
              "#ffffff",

            padding:
              "25px",

            borderRadius:
              "16px",

            boxShadow:
              "0 4px 18px rgba(0,0,0,.08)",

            marginBottom:
              "25px",
          }}
        >

          <h2
            style={{
              marginBottom:
                "20px",
            }}
          >
            Add Leave Request
          </h2>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",

              gap:
                "18px",
            }}
          >

            <div>
              <label style={labelStyle}>
                Employee
              </label>

              <select
                value={
                  form.employee_id
                }

                onChange={(e) =>
                  setForm({
                    ...form,

                    employee_id:
                      e.target.value,
                  })
                }

                style={fieldStyle}
              >
                <option value="">
                  Select Employee
                </option>

                {employees.map(
                  (employee) => (
                    <option
                      key={
                        employee.id
                      }

                      value={
                        employee.id
                      }
                    >
                      {
                        employee.full_name
                      }{" "}
                      (
                      {
                        employee.employee_id
                      }
                      )
                    </option>
                  )
                )}
              </select>
            </div>


            <div>
              <label style={labelStyle}>
                Leave Type
              </label>

              <select
                value={
                  form.leave_type_id
                }

                onChange={(e) =>
                  setForm({
                    ...form,

                    leave_type_id:
                      e.target.value,
                  })
                }

                style={fieldStyle}
              >
                <option value="">
                  Select Leave Type
                </option>

                {leaveTypes.map(
                  (type) => (
                    <option
                      key={
                        type.id
                      }

                      value={
                        type.id
                      }
                    >
                      {
                        type.name
                      }{" "}
                      (
                      {
                        type.code
                      }
                      )
                    </option>
                  )
                )}
              </select>
            </div>


            <div>
              <label style={labelStyle}>
                Start Date
              </label>

              <input
                type="date"

                value={
                  form.start_date
                }

                onChange={(e) =>
                  setForm({
                    ...form,

                    start_date:
                      e.target.value,
                  })
                }

                style={fieldStyle}
              />
            </div>


            <div>
              <label style={labelStyle}>
                End Date
              </label>

              <input
                type="date"

                value={
                  form.end_date
                }

                onChange={(e) =>
                  setForm({
                    ...form,

                    end_date:
                      e.target.value,
                  })
                }

                style={fieldStyle}
              />
            </div>

          </div>


          <div
            style={{
              marginTop:
                "18px",
            }}
          >
            <label style={labelStyle}>
              Reason
            </label>

            <textarea
              rows="3"

              value={
                form.reason
              }

              onChange={(e) =>
                setForm({
                  ...form,

                  reason:
                    e.target.value,
                })
              }

              placeholder="Reason for leave..."

              style={{
                ...fieldStyle,

                resize:
                  "vertical",
              }}
            />
          </div>


          <div
            style={{
              marginTop:
                "15px",

              color:
                "#475569",
            }}
          >
            Working Leave Days:{" "}

            <strong>
              {calculateWorkingDays(
                form.start_date,
                form.end_date
              )}
            </strong>
          </div>


          <button
            type="submit"

            disabled={
              saving ||
              !isOnline
            }

            title={
              !isOnline
                ? "Reconnect to submit leave request"
                : undefined
            }

            style={{
              ...successButton,

              marginTop:
                "20px",

              opacity:
                saving ||
                !isOnline
                  ? 0.7
                  : 1,

              cursor:
                saving ||
                !isOnline
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {saving
              ? "Saving..."
              : "Submit Leave Request"}
          </button>

        </form>
      )}


      {/* LEAVE BALANCE */}

      <div
        style={{
          marginTop:
            "30px",
        }}
      >
        <h2
          style={{
            marginBottom:
              "15px",
          }}
        >
          📊 Employee Leave Balance — {selectedYear}
        </h2>


        <div
          style={{
            overflowX:
              "auto",
          }}
        >
          <table className="inventory-table">

            <thead>
              <tr>
                <th>
                  Employee
                </th>

                <th>
                  Leave Type
                </th>

                <th>
                  Annual
                </th>

                <th>
                  Used
                </th>

                <th>
                  Future Approved
                </th>

                <th>
                  Pending
                </th>

                <th>
                  Remaining
                </th>
              </tr>
            </thead>


            <tbody>

              {balanceRows.map(
                (row) => (
                  <tr
                    key={
                      `${row.employee.id}-${row.type.id}`
                    }
                  >

                    <td>
                      <strong>
                        {
                          row.employee.full_name
                        }
                      </strong>

                      <div
                        style={smallText}
                      >
                        {
                          row.employee.employee_id
                        }
                      </div>
                    </td>


                    <td>
                      {
                        row.type.name
                      }

                      <div
                        style={smallText}
                      >
                        {
                          row.type.code
                        }
                      </div>
                    </td>


                    <td>
                      {row.type.is_paid
                        ? row.annualLimit
                        : "N/A"}
                    </td>


                    <td>
                      {row.used}
                    </td>


                    <td>
                      {
                        row.futureApproved
                      }
                    </td>


                    <td>
                      {
                        row.pending
                      }
                    </td>


                    <td>
                      {row.remaining ===
                      null
                        ? "N/A"
                        : row.remaining}
                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>
        </div>
      </div>


      {/* REQUEST TABLE */}

      <div
        style={{
          marginTop:
            "35px",
        }}
      >

        <h2
          style={{
            marginBottom:
              "15px",
          }}
        >
          📝 Leave Requests
        </h2>


        <div
          style={{
            overflowX:
              "auto",
          }}
        >

          <table className="inventory-table">

            <thead>
              <tr>
                <th>ID</th>

                <th>
                  Employee
                </th>

                <th>
                  Leave Type
                </th>

                <th>
                  Start Date
                </th>

                <th>
                  End Date
                </th>

                <th>
                  Working Days
                </th>

                <th>
                  Reason
                </th>

                <th>
                  Status
                </th>

                <th>
                  Actions
                </th>
              </tr>
            </thead>


            <tbody>

              {requests.length ===
              0 ? (
                <tr>
                  <td
                    colSpan="9"

                    style={{
                      textAlign:
                        "center",
                    }}
                  >
                    No leave requests found.
                  </td>
                </tr>
              ) : (

                requests.map(
                  (item) => (

                    <tr
                      key={
                        item.id
                      }
                    >

                      <td>
                        {
                          item.id
                        }
                      </td>


                      <td>
                        <strong>
                          {
                            item.employees
                              ?.full_name
                          }
                        </strong>

                        <div
                          style={smallText}
                        >
                          {
                            item.employees
                              ?.employee_id
                          }
                        </div>
                      </td>


                      <td>
                        {
                          item.leave_types
                            ?.name
                        }

                        <div
                          style={smallText}
                        >
                          {
                            item.leave_types
                              ?.code
                          }
                        </div>
                      </td>


                      <td>
                        {formatDate(
                          item.start_date
                        )}
                      </td>


                      <td>
                        {formatDate(
                          item.end_date
                        )}
                      </td>


                      <td>
                        {calculateWorkingDays(
                          item.start_date,
                          item.end_date
                        )}
                      </td>


                      <td>
                        {
                          item.reason ||
                          "-"
                        }
                      </td>


                      <td>
                        <span
                          style={{
                            ...statusStyle(
                              item.status
                            ),

                            padding:
                              "6px 10px",

                            borderRadius:
                              "999px",

                            fontWeight:
                              "700",

                            fontSize:
                              "13px",
                          }}
                        >
                          {
                            item.status
                          }
                        </span>
                      </td>


                      <td>

                        {item.status ===
                          "Pending" ? (

                          <div
                            style={{
                              display:
                                "flex",

                              gap:
                                "8px",

                              flexWrap:
                                "wrap",
                            }}
                          >

                            <button
                              type="button"

                              disabled={!isOnline}

                              title={
                                !isOnline
                                  ? "Reconnect to approve"
                                  : undefined
                              }

                              onClick={() =>
                                updateStatus(
                                  item,
                                  "Approved"
                                )
                              }

                              style={{
                                ...successButton,
                                opacity: isOnline
                                  ? 1
                                  : 0.5,
                                cursor: isOnline
                                  ? "pointer"
                                  : "not-allowed",
                              }}
                            >
                              Approve
                            </button>


                            <button
                              type="button"

                              disabled={!isOnline}

                              title={
                                !isOnline
                                  ? "Reconnect to reject"
                                  : undefined
                              }

                              onClick={() =>
                                updateStatus(
                                  item,
                                  "Rejected"
                                )
                              }

                              style={{
                                ...dangerButton,
                                opacity: isOnline
                                  ? 1
                                  : 0.5,
                                cursor: isOnline
                                  ? "pointer"
                                  : "not-allowed",
                              }}
                            >
                              Reject
                            </button>

                          </div>

                        ) : (
                          "-"
                        )}

                      </td>

                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

      </div>

    </div>
  );
}


// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------

const fieldStyle = {
  width:
    "100%",

  boxSizing:
    "border-box",

  padding:
    "11px 12px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "9px",

  background:
    "#ffffff",

  fontSize:
    "14px",
};


const labelStyle = {
  display:
    "block",

  fontWeight:
    "700",

  marginBottom:
    "7px",
};


const primaryButton = {
  border:
    "none",

  background:
    "#2563eb",

  color:
    "#ffffff",

  padding:
    "13px 20px",

  borderRadius:
    "12px",

  fontWeight:
    "700",

  cursor:
    "pointer",
};


const successButton = {
  border:
    "none",

  background:
    "#16a34a",

  color:
    "#ffffff",

  padding:
    "8px 12px",

  borderRadius:
    "8px",

  fontWeight:
    "700",

  cursor:
    "pointer",
};


const dangerButton = {
  border:
    "none",

  background:
    "#dc2626",

  color:
    "#ffffff",

  padding:
    "8px 12px",

  borderRadius:
    "8px",

  fontWeight:
    "700",

  cursor:
    "pointer",
};


const smallText = {
  fontSize:
    "12px",

  color:
    "#64748b",

  marginTop:
    "3px",
};


export default LeaveManagement;