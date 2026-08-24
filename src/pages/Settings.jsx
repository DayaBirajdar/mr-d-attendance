import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

function Settings() {
  const [settingsId, setSettingsId] =
    useState(null);

  const [officeStart, setOfficeStart] =
    useState("10:00");

  const [officeEnd, setOfficeEnd] =
    useState("19:00");

  const [gracePeriod, setGracePeriod] =
    useState(15);

  const [fullDayHours, setFullDayHours] =
    useState(8);

  const [halfDayHours, setHalfDayHours] =
    useState(4);

  const [saturdayOff, setSaturdayOff] =
    useState(true);

  const [sundayOff, setSundayOff] =
    useState(true);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    const { data, error } =
      await supabase
        .from("attendance_settings")
        .select("*")
        .order("id", {
          ascending: true,
        })
        .limit(1)
        .maybeSingle();

    if (error) {
      console.error(
        "Settings load error:",
        error
      );

      setMessage(
        "❌ Unable to load attendance settings."
      );

      setLoading(false);
      return;
    }

    if (data) {
      setSettingsId(data.id);

      setOfficeStart(
        data.office_start_time
          ?.slice(0, 5) || "10:00"
      );

      setOfficeEnd(
        data.office_end_time
          ?.slice(0, 5) || "19:00"
      );

      setGracePeriod(
        Number(
          data.grace_period_minutes ??
            15
        )
      );

      setFullDayHours(
        Number(
          data.full_day_minutes ??
            480
        ) / 60
      );

      setHalfDayHours(
        Number(
          data.half_day_minutes ??
            240
        ) / 60
      );

      setSaturdayOff(
        Boolean(data.saturday_off)
      );

      setSundayOff(
        Boolean(data.sunday_off)
      );
    }

    setLoading(false);
  }

  async function saveSettings(e) {
    e.preventDefault();

    if (!settingsId) {
      setMessage(
        "❌ Settings record not found."
      );
      return;
    }

    if (
      !officeStart ||
      !officeEnd
    ) {
      setMessage(
        "❌ Office start and end time are required."
      );
      return;
    }

    const grace =
      Number(gracePeriod);

    const fullHours =
      Number(fullDayHours);

    const halfHours =
      Number(halfDayHours);

    if (
      Number.isNaN(grace) ||
      grace < 0
    ) {
      setMessage(
        "❌ Grace period must be 0 or more."
      );
      return;
    }

    if (
      Number.isNaN(fullHours) ||
      fullHours <= 0
    ) {
      setMessage(
        "❌ Full day hours must be greater than 0."
      );
      return;
    }

    if (
      Number.isNaN(halfHours) ||
      halfHours <= 0
    ) {
      setMessage(
        "❌ Half day hours must be greater than 0."
      );
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } =
      await supabase
        .from("attendance_settings")
        .update({
          office_start_time:
            officeStart,

          office_end_time:
            officeEnd,

          grace_period_minutes:
            grace,

          full_day_minutes:
            Math.round(
              fullHours * 60
            ),

          half_day_minutes:
            Math.round(
              halfHours * 60
            ),

          saturday_off:
            saturdayOff,

          sunday_off:
            sundayOff,

          updated_at:
            new Date().toISOString(),
        })
        .eq("id", settingsId);

    if (error) {
      console.error(
        "Settings save error:",
        error
      );

      setMessage(
        "❌ Unable to save settings."
      );

      setSaving(false);
      return;
    }

    setMessage(
      "✅ Attendance settings saved successfully."
    );

    setSaving(false);
  }

  if (loading) {
    return (
      <div
        style={{
          padding: "10px",
        }}
      >
        Loading attendance settings...
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1000px",
      }}
    >
      <div
        style={{
          marginBottom: "30px",
        }}
      >
        <h1
          style={{
            fontSize: "34px",
            color: "#2563eb",
            marginBottom: "8px",
          }}
        >
          ⚙️ Settings
        </h1>

        <p
          style={{
            color: "#64748b",
            fontSize: "16px",
          }}
        >
          Configure attendance rules
          and office working hours.
        </p>
      </div>

      <form
        onSubmit={saveSettings}
        style={{
          background: "#ffffff",
          borderRadius: "18px",
          padding: "30px",
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.08)",
        }}
      >
        <h2
          style={{
            marginBottom: "25px",
            color: "#111827",
          }}
        >
          🕒 Attendance Settings
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Office Start Time
            </label>

            <input
              type="time"
              value={officeStart}
              onChange={(e) =>
                setOfficeStart(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Office End Time
            </label>

            <input
              type="time"
              value={officeEnd}
              onChange={(e) =>
                setOfficeEnd(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Grace Period
              (Minutes)
            </label>

            <input
              type="number"
              min="0"
              value={gracePeriod}
              onChange={(e) =>
                setGracePeriod(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Full Day Hours
            </label>

            <input
              type="number"
              min="1"
              step="0.5"
              value={fullDayHours}
              onChange={(e) =>
                setFullDayHours(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontWeight: "700",
                marginBottom: "8px",
              }}
            >
              Half Day Hours
            </label>

            <input
              type="number"
              min="1"
              step="0.5"
              value={halfDayHours}
              onChange={(e) =>
                setHalfDayHours(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "30px",
          }}
        >
          <h3
            style={{
              marginBottom: "15px",
            }}
          >
            Weekly Off
          </h3>

          <div
            style={{
              display: "flex",
              gap: "30px",
              flexWrap: "wrap",
            }}
          >
            <label
              style={checkboxStyle}
            >
              <input
                type="checkbox"
                checked={saturdayOff}
                onChange={(e) =>
                  setSaturdayOff(
                    e.target.checked
                  )
                }
              />

              Saturday
            </label>

            <label
              style={checkboxStyle}
            >
              <input
                type="checkbox"
                checked={sundayOff}
                onChange={(e) =>
                  setSundayOff(
                    e.target.checked
                  )
                }
              />

              Sunday
            </label>
          </div>
        </div>

        <div
          style={{
            marginTop: "30px",
            padding: "20px",
            background: "#eff6ff",
            borderRadius: "14px",
          }}
        >
          <strong>
            Current Attendance Rule
          </strong>

          <p
            style={{
              marginTop: "8px",
              lineHeight: "1.7",
            }}
          >
            Employees can check in
            until{" "}
            <strong>
              {formatTime(
                addMinutes(
                  officeStart,
                  Number(
                    gracePeriod ||
                      0
                  )
                )
              )}
            </strong>{" "}
            without being marked
            late.
          </p>

          <p
            style={{
              marginTop: "5px",
            }}
          >
            Office Hours:{" "}
            <strong>
              {formatTime(
                officeStart
              )}
            </strong>{" "}
            to{" "}
            <strong>
              {formatTime(
                officeEnd
              )}
            </strong>
          </p>
        </div>

        {message && (
          <div
            style={{
              marginTop: "20px",
              fontWeight: "700",
            }}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: "30px",
            border: "none",
            background: "#2563eb",
            color: "#ffffff",
            padding: "13px 24px",
            borderRadius: "12px",
            fontWeight: "700",
            fontSize: "15px",
            cursor: saving
              ? "not-allowed"
              : "pointer",
            opacity: saving
              ? 0.7
              : 1,
          }}
        >
          {saving
            ? "Saving..."
            : "Save Attendance Settings"}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "15px",
  background: "#ffffff",
};

const checkboxStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontWeight: "600",
  cursor: "pointer",
};

function addMinutes(
  timeValue,
  minutesToAdd
) {
  if (!timeValue) {
    return "";
  }

  const [hours, minutes] =
    timeValue
      .split(":")
      .map(Number);

  const totalMinutes =
    hours * 60 +
    minutes +
    minutesToAdd;

  const finalHours =
    Math.floor(
      totalMinutes / 60
    ) % 24;

  const finalMinutes =
    totalMinutes % 60;

  return `${String(
    finalHours
  ).padStart(
    2,
    "0"
  )}:${String(
    finalMinutes
  ).padStart(
    2,
    "0"
  )}`;
}

function formatTime(
  timeValue
) {
  if (!timeValue) {
    return "-";
  }

  const [hourValue, minute] =
    timeValue
      .split(":")
      .map(Number);

  const period =
    hourValue >= 12
      ? "PM"
      : "AM";

  const hour =
    hourValue % 12 || 12;

  return `${hour}:${String(
    minute
  ).padStart(
    2,
    "0"
  )} ${period}`;
}

export default Settings;