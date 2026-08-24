import { useRef } from "react";

function MonthlyAttendanceTable({
  attendance,
  employees,
  selectedMonth,
  attendanceSettings,
}) {
  const scrollRef = useRef(null);

  const [year, month] =
    selectedMonth
      .split("-")
      .map(Number);

  const daysInMonth =
    new Date(
      year,
      month,
      0
    ).getDate();

  const today =
    new Date();

  const todayDateOnly =
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

  // ---------------------------------------------------------
  // EMPLOYEE MAP
  // ---------------------------------------------------------

  const employeeMap = {};

  employees.forEach((employee) => {
    employeeMap[employee.id] = {
      employeeId:
        employee.id,

      employeeCode:
        employee.employee_id ||
        "-",

      name:
        employee.full_name ||
        "-",

      department:
        employee.department ||
        "-",

      joiningDate:
        employee.joining_date ||
        null,

      records: {},
    };
  });

  attendance.forEach((item) => {
    const employee =
      item.employees || {};

    const employeeId =
      item.employee_id;

    if (!employeeMap[employeeId]) {
      employeeMap[employeeId] = {
        employeeId,

        employeeCode:
          employee.employee_id ||
          "-",

        name:
          employee.full_name ||
          "-",

        department:
          employee.department ||
          "-",

        joiningDate:
          null,

        records: {},
      };
    }

    const day =
      Number(
        item.attendance_date
          ?.split("-")[2]
      );

    if (day) {
      employeeMap[
        employeeId
      ].records[day] =
        item;
    }
  });

  const monthlyEmployees =
    Object.values(
      employeeMap
    );

  // ---------------------------------------------------------
  // WORKING MINUTES
  // ---------------------------------------------------------

  function workingMinutes(
    value
  ) {
    if (!value) {
      return 0;
    }

    const match =
      value.match(
        /(\d+)h\s*(\d+)m/
      );

    if (!match) {
      return 0;
    }

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
      minutes % 60;

    return `${hours}h ${mins}m`;
  }

  // ---------------------------------------------------------
  // DATE HELPERS
  // ---------------------------------------------------------

  function getDateForDay(
    day
  ) {
    return new Date(
      year,
      month - 1,
      day
    );
  }

  function isWeeklyOff(
    day
  ) {
    if (!day) {
      return false;
    }

    const date =
      getDateForDay(
        day
      );

    const weekDay =
      date.getDay();

    if (
      weekDay === 6 &&
      attendanceSettings
        ?.saturday_off
    ) {
      return true;
    }

    if (
      weekDay === 0 &&
      attendanceSettings
        ?.sunday_off
    ) {
      return true;
    }

    return false;
  }

  function isBeforeJoining(
    employee,
    day
  ) {
    if (
      !employee.joiningDate
    ) {
      return false;
    }

    const currentDate =
      getDateForDay(
        day
      );

    const joiningDate =
      new Date(
        `${employee.joiningDate}T00:00:00`
      );

    return (
      currentDate <
      joiningDate
    );
  }

  function isFutureDate(
    day
  ) {
    const currentDate =
      getDateForDay(
        day
      );

    return (
      currentDate >
      todayDateOnly
    );
  }

  function isToday(
    day
  ) {
    const currentDate =
      getDateForDay(
        day
      );

    return (
      currentDate.getTime() ===
      todayDateOnly.getTime()
    );
  }

  // ---------------------------------------------------------
  // DAY CODE
  // ---------------------------------------------------------

  function getDayCode(
    employee,
    record,
    day
  ) {
    if (
      isBeforeJoining(
        employee,
        day
      )
    ) {
      return "-";
    }

    if (!record) {
      if (
        isWeeklyOff(day)
      ) {
        return "WO";
      }

      if (
        isFutureDate(day) ||
        isToday(day)
      ) {
        return "-";
      }

      return "A";
    }

    const status =
      record.attendance_status ||
      record.status;

    if (
      status ===
      "Leave"
    ) {
      return "L";
    }

    if (
      status ===
      "Absent"
    ) {
      return "A";
    }

    if (
      record.check_in &&
      !record.check_out
    ) {
      return "P";
    }

    const minutes =
      workingMinutes(
        record.working_hours
      );

    const fullDayMinutes =
      Number(
        attendanceSettings
          ?.full_day_minutes ??
        480
      );

    const halfDayMinutes =
      Number(
        attendanceSettings
          ?.half_day_minutes ??
        240
      );

    if (
      minutes >=
      fullDayMinutes
    ) {
      return "FD";
    }

    if (
      minutes >=
      halfDayMinutes
    ) {
      return "HD";
    }

    if (
      minutes > 0
    ) {
      return "SH";
    }

    if (
      status ===
      "Present"
    ) {
      return "P";
    }

    return status
      ? status.substring(
          0,
          2
        )
      : "-";
  }

  // ---------------------------------------------------------
  // SCROLL
  // ---------------------------------------------------------

  function scrollLeft() {
    if (
      !scrollRef.current
    ) {
      return;
    }

    scrollRef.current
      .scrollBy({
        left: -650,
        behavior:
          "smooth",
      });
  }

  function scrollRight() {
    if (
      !scrollRef.current
    ) {
      return;
    }

    scrollRef.current
      .scrollBy({
        left: 650,
        behavior:
          "smooth",
      });
  }

  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div
      style={{
        width:
          "100%",

        maxWidth:
          "100%",

        minWidth:
          0,

        boxSizing:
          "border-box",
      }}
    >
      <div
        style={{
          display:
            "flex",

          flexWrap:
            "wrap",

          gap:
            "12px",

          marginBottom:
            "15px",

          fontSize:
            "13px",

          fontWeight:
            "600",

          color:
            "#475569",
        }}
      >
        <span>
          FD = Full Day
        </span>

        <span>
          HD = Half Day
        </span>

        <span>
          SH = Short Hours
        </span>

        <span>
          P = Present / In Progress
        </span>

        <span>
          L = Leave
        </span>

        <span>
          A = Absent
        </span>

        <span>
          WO = Weekly Off
        </span>
      </div>

      <div
        style={{
          width:
            "100%",

          maxWidth:
            "100%",

          display:
            "flex",

          justifyContent:
            "flex-start",

          alignItems:
            "center",

          gap:
            "10px",

          marginBottom:
            "15px",

          position:
            "relative",

          zIndex:
            10,
        }}
      >
        <button
          type="button"

          onClick={
            scrollLeft
          }

          style={{
            padding:
              "10px 18px",

            cursor:
              "pointer",

            fontWeight:
              "700",

            background:
              "#2563eb",

            color:
              "white",

            border:
              "none",

            borderRadius:
              "8px",
          }}
        >
          ← Previous Dates
        </button>

        <button
          type="button"

          onClick={
            scrollRight
          }

          style={{
            padding:
              "10px 18px",

            cursor:
              "pointer",

            fontWeight:
              "700",

            background:
              "#2563eb",

            color:
              "white",

            border:
              "none",

            borderRadius:
              "8px",
          }}
        >
          Next Dates →
        </button>
      </div>

      <div
        ref={
          scrollRef
        }

        style={{
          display:
            "block",

          width:
            "100%",

          maxWidth:
            "100%",

          minWidth:
            0,

          overflowX:
            "scroll",

          overflowY:
            "hidden",

          WebkitOverflowScrolling:
            "touch",

          paddingBottom:
            "18px",

          borderBottom:
            "2px solid #cbd5e1",

          boxSizing:
            "border-box",
        }}
      >
        <table
          className=
            "inventory-table"

          style={{
            width:
              "max-content",

            minWidth:
              "2500px",

            marginTop:
              "0",
          }}
        >
          <thead>
            <tr>
              <th>
                Employee
              </th>

              <th>
                Employee ID
              </th>

              <th>
                Department
              </th>

              {Array.from(
                {
                  length:
                    daysInMonth,
                },
                (
                  _,
                  index
                ) => {
                  const day =
                    index +
                    1;

                  return (
                    <th
                      key={
                        day
                      }

                      style={{
                        minWidth:
                          "50px",

                        textAlign:
                          "center",

                        background:
                          isWeeklyOff(
                            day
                          )
                            ? "#f8fafc"
                            : undefined,
                      }}
                    >
                      {day}
                    </th>
                  );
                }
              )}

              <th>
                Full Day
              </th>

              <th>
                Half Day
              </th>

              <th>
                Short Hours
              </th>

              <th>
                Present
              </th>

              <th>
                Absent
              </th>

              <th>
                Leave
              </th>

              <th>
                Weekly Off
              </th>

              <th>
                Late
              </th>

              <th>
                Total Hours
              </th>
            </tr>
          </thead>

          <tbody>
            {monthlyEmployees
              .length ===
            0 ? (
              <tr>
                <td
                  colSpan={
                    daysInMonth +
                    12
                  }

                  style={{
                    textAlign:
                      "center",
                  }}
                >
                  No employees
                  found.
                </td>
              </tr>
            ) : (
              monthlyEmployees
                .map(
                  (
                    employee
                  ) => {
                    let fullDay =
                      0;

                    let halfDay =
                      0;

                    let shortHours =
                      0;

                    let present =
                      0;

                    let absent =
                      0;

                    let leave =
                      0;

                    let weeklyOff =
                      0;

                    let late =
                      0;

                    let totalMinutes =
                      0;

                    for (
                      let day =
                        1;
                      day <=
                      daysInMonth;
                      day++
                    ) {
                      const record =
                        employee
                          .records[
                            day
                          ];

                      const code =
                        getDayCode(
                          employee,
                          record,
                          day
                        );

                      if (
                        code ===
                        "FD"
                      ) {
                        fullDay++;
                      }

                      if (
                        code ===
                        "HD"
                      ) {
                        halfDay++;
                      }

                      if (
                        code ===
                        "SH"
                      ) {
                        shortHours++;
                      }

                      if (
                        code ===
                        "P"
                      ) {
                        present++;
                      }

                      if (
                        code ===
                        "A"
                      ) {
                        absent++;
                      }

                      if (
                        code ===
                        "L"
                      ) {
                        leave++;
                      }

                      if (
                        code ===
                        "WO"
                      ) {
                        weeklyOff++;
                      }

                      if (
                        Number(
                          record
                            ?.late_minutes ||
                            0
                        ) > 0
                      ) {
                        late++;
                      }

                      if (
                        record
                      ) {
                        totalMinutes +=
                          workingMinutes(
                            record
                              .working_hours
                          );
                      }
                    }

                    return (
                      <tr
                        key={
                          employee
                            .employeeId
                        }
                      >
                        <td>
                          <strong>
                            {
                              employee
                                .name
                            }
                          </strong>
                        </td>

                        <td>
                          {
                            employee
                              .employeeCode
                          }
                        </td>

                        <td>
                          {
                            employee
                              .department
                          }
                        </td>

                        {Array.from(
                          {
                            length:
                              daysInMonth,
                          },
                          (
                            _,
                            index
                          ) => {
                            const day =
                              index +
                              1;

                            const record =
                              employee
                                .records[
                                  day
                                ];

                            const code =
                              getDayCode(
                                employee,
                                record,
                                day
                              );

                            return (
                              <td
                                key={
                                  day
                                }

                                style={{
                                  textAlign:
                                    "center",

                                  fontWeight:
                                    "700",

                                  background:
                                    code ===
                                    "WO"
                                      ? "#f8fafc"
                                      : undefined,
                                }}
                              >
                                {
                                  code
                                }
                              </td>
                            );
                          }
                        )}

                        <td>
                          {
                            fullDay
                          }
                        </td>

                        <td>
                          {
                            halfDay
                          }
                        </td>

                        <td>
                          {
                            shortHours
                          }
                        </td>

                        <td>
                          {
                            present
                          }
                        </td>

                        <td>
                          {
                            absent
                          }
                        </td>

                        <td>
                          {
                            leave
                          }
                        </td>

                        <td>
                          {
                            weeklyOff
                          }
                        </td>

                        <td>
                          {
                            late
                          }
                        </td>

                        <td>
                          {formatMinutes(
                            totalMinutes
                          )}
                        </td>
                      </tr>
                    );
                  }
                )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MonthlyAttendanceTable;