import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Webcam from "react-webcam";

import { supabase } from "../lib/supabase";

import {
  compareFaces,
  loadFaceModels,
} from "../utils/faceRecognition";

import Footer from "../components/inventory/layout/Footer";


function EmployeeAttendance() {

  const webcamRef = useRef(null);

  const [employeeId, setEmployeeId] =
    useState("");

  const [employee, setEmployee] =
    useState(null);

  const [loadingEmployee, setLoadingEmployee] =
    useState(false);

  const [showCamera, setShowCamera] =
    useState(false);

  const [cameraReady, setCameraReady] =
    useState(false);

  const [cameraError, setCameraError] =
    useState("");

  const [verifying, setVerifying] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [messageType, setMessageType] =
    useState("");

  const [selfiePreview, setSelfiePreview] =
    useState("");

  const [isOnline, setIsOnline] =
    useState(
      navigator.onLine
    );

  // Attendance settings
  const [officeStartTime, setOfficeStartTime] =
    useState("10:00");

  const [
    gracePeriodMinutes,
    setGracePeriodMinutes,
  ] = useState(15);


  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);

      setShowCamera(false);
      setCameraReady(false);
      setVerifying(false);

      setMessageType(
        "error"
      );

      setMessage(
        "You are offline. Employee attendance requires an internet connection."
      );
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
  // LOAD ATTENDANCE SETTINGS
  // ---------------------------------------------------------

  async function loadAttendanceSettings() {

    const {
      data,
      error,
    } = await supabase
      .from("attendance_settings")
      .select(
        "office_start_time, grace_period_minutes"
      )
      .order(
        "id",
        {
          ascending: true,
        }
      )
      .limit(1)
      .maybeSingle();


    if (error) {

      console.error(
        "Attendance settings load error:",
        error
      );

      return {
        officeStartTime:
          "10:00",

        gracePeriodMinutes:
          15,
      };
    }


    const startTime =
      data?.office_start_time
        ?.slice(0, 5) ||
      "10:00";


    const graceMinutes =
      Number(
        data?.grace_period_minutes ??
          15
      );


    setOfficeStartTime(
      startTime
    );

    setGracePeriodMinutes(
      graceMinutes
    );


    return {
      officeStartTime:
        startTime,

      gracePeriodMinutes:
        graceMinutes,
    };

  }


  // ---------------------------------------------------------
  // LOCAL DATE
  // ---------------------------------------------------------

  function getLocalDate() {

    const now = new Date();

    const year =
      now.getFullYear();

    const month =
      String(
        now.getMonth() + 1
      ).padStart(2, "0");

    const day =
      String(
        now.getDate()
      ).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }


  // ---------------------------------------------------------
  // CURRENT TIME
  // ---------------------------------------------------------

  function getCurrentTime() {

    return new Date()
      .toTimeString()
      .slice(0, 5);
  }


  // ---------------------------------------------------------
  // FULL DATETIME
  // ---------------------------------------------------------

  function createDateTime(
    date,
    time
  ) {

    return `${date}T${time}:00`;

  }


  // ---------------------------------------------------------
  // FIND EMPLOYEE
  // ---------------------------------------------------------

  async function findEmployee(e) {

    e.preventDefault();

    if (!navigator.onLine) {

      setMessageType(
        "error"
      );

      setMessage(
        "You are offline. Employee ID verification requires an internet connection."
      );

      return;
    }

    const cleanEmployeeId =
      employeeId.trim();


    if (!cleanEmployeeId) {

      setMessageType(
        "error"
      );

      setMessage(
        "Please enter your Employee ID."
      );

      return;
    }


    setLoadingEmployee(
      true
    );

    setMessage("");

    setEmployee(null);

    setShowCamera(false);

    setSelfiePreview("");


    try {

      const {
        data,
        error,
      } = await supabase
        .from("employees")
        .select(
          "id, employee_id, full_name, department, photo_url, status, is_deleted"
        )
        .eq(
          "employee_id",
          cleanEmployeeId
        )
        .eq(
          "status",
          "Active"
        )
        .eq(
          "is_deleted",
          false
        )
        .maybeSingle();


      if (error) {
        throw error;
      }


      if (!data) {

        setMessageType(
          "error"
        );

        setMessage(
          "Employee ID not found."
        );

        return;
      }


      if (
        !data.photo_url
      ) {

        setMessageType(
          "error"
        );

        setMessage(
          "Profile photo is not available. Please contact Admin."
        );

        return;
      }


      // Load office timing + grace period
      await loadAttendanceSettings();


      setEmployee(
        data
      );

      setMessageType(
        "success"
      );

      setMessage(
        `Welcome ${data.full_name}`
      );


    } catch (error) {

      console.error(
        "Employee lookup error:",
        error
      );

      setMessageType(
        "error"
      );

      setMessage(
        "Unable to verify Employee ID."
      );

    } finally {

      setLoadingEmployee(
        false
      );

    }

  }


  // ---------------------------------------------------------
  // OPEN CAMERA
  // ---------------------------------------------------------

  async function openCamera() {

    if (!navigator.onLine) {

      setMessageType(
        "error"
      );

      setMessage(
        "You are offline. Camera attendance is unavailable until you reconnect."
      );

      return;
    }

    if (!employee) {

      setMessageType(
        "error"
      );

      setMessage(
        "Please verify your Employee ID first."
      );

      return;
    }


    setCameraError("");

    setCameraReady(
      false
    );

    setMessage("");

    setShowCamera(
      true
    );

  }


  // ---------------------------------------------------------
  // CAMERA READY
  // ---------------------------------------------------------

  function handleCameraReady() {

    setCameraReady(
      true
    );

    setCameraError("");

  }


  // ---------------------------------------------------------
  // CAMERA ERROR
  // ---------------------------------------------------------

  function handleCameraError(
    error
  ) {

    console.error(
      "Camera error:",
      error
    );

    setCameraReady(
      false
    );

    setCameraError(
      "Unable to access camera. Please allow camera permission."
    );

  }


  // ---------------------------------------------------------
  // WORKING HOURS
  // ---------------------------------------------------------

  function calculateWorkingHours(
    checkIn,
    checkOut
  ) {

    if (
      !checkIn ||
      !checkOut
    ) {
      return "";
    }


    const start =
      new Date(
        checkIn
      );

    const end =
      new Date(
        checkOut
      );


    let seconds =
      Math.floor(
        (end - start) /
          1000
      );


    if (
      !Number.isFinite(
        seconds
      ) ||
      seconds < 0
    ) {
      return "";
    }


    const hours =
      Math.floor(
        seconds / 3600
      );


    const minutes =
      Math.floor(
        (seconds % 3600) /
          60
      );


    return `${hours}h ${minutes}m`;

  }


  // ---------------------------------------------------------
  // LATE MINUTES
  // ---------------------------------------------------------

  function calculateLateMinutes(
    checkInTime,
    startTime =
      officeStartTime,
    graceMinutes =
      gracePeriodMinutes
  ) {

    if (!checkInTime) {
      return 0;
    }


    const [
      actualHour,
      actualMinute,
    ] =
      checkInTime
        .split(":")
        .map(Number);


    const [
      startHour,
      startMinute,
    ] =
      (
        startTime ||
        "10:00"
      )
        .split(":")
        .map(Number);


    const actualMinutes =
      actualHour * 60 +
      actualMinute;


    const officeStartMinutes =
      startHour * 60 +
      startMinute;


    const lateThreshold =
      officeStartMinutes +
      Number(
        graceMinutes ||
          0
      );


    return Math.max(
      0,
      actualMinutes -
        lateThreshold
    );

  }


  // ---------------------------------------------------------
  // CAPTURE + VERIFY
  // ---------------------------------------------------------

  async function captureSelfie() {

    if (!navigator.onLine) {

      setMessageType(
        "error"
      );

      setMessage(
        "You are offline. Face verification requires an internet connection."
      );

      return;
    }

    if (
      !webcamRef.current ||
      !employee
    ) {
      return;
    }


    const imageSrc =
      webcamRef.current
        .getScreenshot();


    if (!imageSrc) {

      setMessageType(
        "error"
      );

      setMessage(
        "Unable to capture selfie."
      );

      return;
    }


    setSelfiePreview(
      imageSrc
    );

    setShowCamera(
      false
    );

    setVerifying(
      true
    );

    setMessageType(
      "info"
    );

    setMessage(
      "Verifying your face..."
    );


    try {

      const response =
        await fetch(
          imageSrc
        );


      const blob =
        await response.blob();


      const file =
        new File(
          [blob],
          `attendance-${Date.now()}.jpg`,
          {
            type:
              "image/jpeg",
          }
        );


      await loadFaceModels();


      const result =
        await compareFaces(
          employee.photo_url,
          file
        );


      if (
        !result ||
        result.success !==
          true ||
        result.match !==
          true
      ) {

        setMessageType(
          "error"
        );

        setMessage(
          result?.message ||
            "Face verification failed."
        );

        return;
      }


      await markAttendance(
        file
      );


    } catch (error) {

      console.error(
        "Attendance verification error:",
        error
      );

      setMessageType(
        "error"
      );

      setMessage(
        error?.message ||
          "Attendance could not be marked."
      );

    } finally {

      setVerifying(
        false
      );

    }

  }


  // ---------------------------------------------------------
  // UPLOAD SELFIE
  // ---------------------------------------------------------

  async function uploadSelfie(
    file
  ) {

    const extension =
      file.type ===
      "image/png"
        ? "png"
        : "jpg";


    const fileName =
      `${employee.id}/${Date.now()}.${extension}`;


    const {
      error,
    } =
      await supabase.storage
        .from(
          "attendance-selfies"
        )
        .upload(
          fileName,
          file,
          {
            cacheControl:
              "3600",

            upsert:
              false,

            contentType:
              file.type ||
              "image/jpeg",
          }
        );


    if (error) {
      throw error;
    }


    const {
      data,
    } =
      supabase.storage
        .from(
          "attendance-selfies"
        )
        .getPublicUrl(
          fileName
        );


    return (
      data?.publicUrl ||
      null
    );

  }


  // ---------------------------------------------------------
  // MARK ATTENDANCE
  // ---------------------------------------------------------

  async function markAttendance(
    selfieFile
  ) {

    if (!navigator.onLine) {

      setMessageType(
        "error"
      );

      setMessage(
        "You are offline. Attendance cannot be marked until you reconnect."
      );

      return;
    }

    // Always read latest attendance settings
    // before calculating late minutes.
    const attendanceSettings =
      await loadAttendanceSettings();


    const {
      data:
        serverTime,

      error:
        serverTimeError,
    } =
      await supabase.rpc(
        "get_server_time"
      );


    if (
      serverTimeError
    ) {
      throw serverTimeError;
    }


    const serverDate =
      new Date(
        serverTime
      );


    const indiaDateParts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Kolkata",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      )
        .format(
          serverDate
        )
        .split("-");


    const today =
      `${indiaDateParts[0]}-${indiaDateParts[1]}-${indiaDateParts[2]}`;


    const time =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone:
            "Asia/Kolkata",

          hour:
            "2-digit",

          minute:
            "2-digit",

          hour12:
            false,
        }
      ).format(
        serverDate
      );


    // -----------------------------------------------------
    // CHECK TODAY'S ATTENDANCE
    // -----------------------------------------------------

    const {
      data:
        todayAttendance,

      error:
        attendanceError,
    } =
      await supabase
        .from(
          "attendance"
        )
        .select("*")
        .eq(
          "employee_id",
          employee.id
        )
        .eq(
          "attendance_date",
          today
        )
        .order(
          "id",
          {
            ascending:
              false,
          }
        )
        .limit(1)
        .maybeSingle();


    if (
      attendanceError
    ) {
      throw attendanceError;
    }


    // -----------------------------------------------------
    // CHECK IN
    // -----------------------------------------------------

    if (
      !todayAttendance
    ) {

      const selfieUrl =
        await uploadSelfie(
          selfieFile
        );


      const checkIn =
        serverTime;


      const lateMinutes =
        calculateLateMinutes(
          time,
          attendanceSettings
            .officeStartTime,
          attendanceSettings
            .gracePeriodMinutes
        );


      const {
        error,
      } =
        await supabase
          .from(
            "attendance"
          )
          .insert({
            employee_id:
              employee.id,

            attendance_date:
              today,

            check_in:
              checkIn,

            check_out:
              null,

            working_hours:
              "",

            late_minutes:
              lateMinutes,

            attendance_status:
              "Present",

            status:
              "Present",

            remarks:
              "Employee self check-in",

            selfie_url:
              selfieUrl,
          });


      if (error) {
        throw error;
      }


      setMessageType(
        "success"
      );


      if (
        lateMinutes >
        0
      ) {

        setMessage(
          `✅ Check-In successful at ${time}. Late by ${lateMinutes} minute${lateMinutes === 1 ? "" : "s"}.`
        );

      } else {

        setMessage(
          `✅ Check-In successful at ${time}. On Time.`
        );

      }


      return;

    }


    // -----------------------------------------------------
    // ALREADY CHECKED OUT
    // -----------------------------------------------------

    if (
      todayAttendance
        .check_out
    ) {

      const savedCheckout =
        new Intl.DateTimeFormat(
          "en-GB",
          {
            timeZone:
              "Asia/Kolkata",

            hour:
              "2-digit",

            minute:
              "2-digit",

            hour12:
              false,
          }
        ).format(
          new Date(
            todayAttendance
              .check_out
          )
        );


      setMessageType(
        "success"
      );

      setMessage(
        `Attendance already completed today. Check-Out: ${savedCheckout}`
      );

      return;

    }


    // -----------------------------------------------------
    // CHECK OUT
    // -----------------------------------------------------

    if (
      todayAttendance
        .check_in &&
      !todayAttendance
        .check_out
    ) {

      const selfieUrl =
        await uploadSelfie(
          selfieFile
        );


      const checkOut =
        serverTime;


      const workingHours =
        calculateWorkingHours(
          todayAttendance
            .check_in,
          checkOut
        );


      const {
        error,
      } =
        await supabase
          .from(
            "attendance"
          )
          .update({
            check_out:
              checkOut,

            working_hours:
              workingHours,

            remarks:
              "Employee self check-out",

            selfie_url:
              selfieUrl,
          })
          .eq(
            "id",
            todayAttendance
              .id
          );


      if (error) {
        throw error;
      }


      setMessageType(
        "success"
      );

      setMessage(
        `✅ Check-Out successful at ${time}. Working Hours: ${workingHours}`
      );

    }

  }


  // ---------------------------------------------------------
  // RESET EMPLOYEE
  // ---------------------------------------------------------

  function resetEmployee() {

    setEmployee(
      null
    );

    setEmployeeId("");

    setSelfiePreview("");

    setShowCamera(
      false
    );

    setCameraReady(
      false
    );

    setCameraError("");

    setMessage("");

  }


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (

    <div
      style={{
        minHeight:
          "100vh",

        background:
          "#f4f7fb",

        display:
          "flex",

        flexDirection:
          "column",
      }}
    >

      <div
        style={{
          flex:
            1,

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          padding:
            20,
        }}
      >

      <div
        style={{
          width:
            "100%",

          maxWidth:
            480,

          background:
            "#ffffff",

          borderRadius:
            20,

          padding:
            30,

          boxShadow:
            "0 15px 45px rgba(0,0,0,0.10)",
        }}
      >

        <div
          style={{
            textAlign:
              "center",

            marginBottom:
              25,
          }}
        >

          <img
            src="/mrd-ai-logo.svg"
            alt="Mr.D AI"
            style={{
              width: 58,
              height: 58,
              objectFit: "contain",
              filter:
                "drop-shadow(0 8px 14px rgba(37,99,235,0.18))",
            }}
          />


          <h1
            style={{
              margin:
                "5px 0",

              fontSize:
                28,
            }}
          >

            Mr.D Attendance

          </h1>


          <p
            style={{
              margin:
                0,

              color:
                "#64748b",
            }}
          >

            Employee Check-In & Check-Out

          </p>

        </div>


        {!isOnline && (

          <div
            style={{
              marginBottom:
                18,

              padding:
                "12px 16px",

              borderRadius:
                10,

              background:
                "#fff7ed",

              border:
                "1px solid #fdba74",

              color:
                "#9a3412",

              fontWeight:
                600,

              textAlign:
                "left",
            }}
          >

            📡 Offline — Employee attendance is unavailable until you reconnect.

          </div>

        )}


        {!employee ? (

          <form
            onSubmit={
              findEmployee
            }
          >

            <label
              style={{
                fontWeight:
                  700,

                display:
                  "block",

                marginBottom:
                  8,
              }}
            >
              Employee ID
            </label>


            <input
              type="text"

              value={
                employeeId
              }

              disabled={
                !isOnline
              }

              title={
                !isOnline
                  ? "Reconnect to verify Employee ID"
                  : undefined
              }

              onChange={(e) =>
                setEmployeeId(
                  e.target
                    .value
                )
              }

              placeholder="Example: GISB56"

              autoComplete="off"

              style={{
                width:
                  "100%",

                boxSizing:
                  "border-box",

                padding:
                  "14px 16px",

                border:
                  "1px solid #cbd5e1",

                borderRadius:
                  10,

                fontSize:
                  16,

                marginBottom:
                  15,
              }}
            />


            <button
              type="submit"

              disabled={
                loadingEmployee ||
                !isOnline
              }

              style={{
                width:
                  "100%",

                padding:
                  "14px",

                border:
                  0,

                borderRadius:
                  10,

                background:
                  "#111827",

                color:
                  "#ffffff",

                fontWeight:
                  700,

                fontSize:
                  16,

                cursor:
                  "pointer",
              }}
            >

              {loadingEmployee
                ? "Checking..."
                : "Continue"}

            </button>

          </form>

        ) : (

          <>

            <div
              style={{
                textAlign:
                  "center",

                padding:
                  15,

                background:
                  "#f8fafc",

                borderRadius:
                  12,

                marginBottom:
                  20,
              }}
            >

              <strong>
                {
                  employee
                    .full_name
                }
              </strong>


              <div
                style={{
                  marginTop:
                    4,

                  color:
                    "#64748b",
                }}
              >

                {
                  employee
                    .employee_id
                }

                {employee
                  .department
                  ? ` • ${employee.department}`
                  : ""}

              </div>

            </div>


            <div
              style={{
                background:
                  "#eff6ff",

                borderRadius:
                  10,

                padding:
                  "10px 12px",

                marginBottom:
                  15,

                fontSize:
                  13,

                color:
                  "#1e40af",

                textAlign:
                  "center",
              }}
            >
              Office Start:{" "}
              <strong>
                {
                  officeStartTime
                }
              </strong>

              {" • "}

              Grace:{" "}
              <strong>
                {
                  gracePeriodMinutes
                }{" "}
                min
              </strong>
            </div>


            {selfiePreview && (

              <div
                style={{
                  textAlign:
                    "center",

                  marginBottom:
                    15,
                }}
              >

                <img
                  src={
                    selfiePreview
                  }

                  alt="Attendance selfie"

                  style={{
                    width:
                      200,

                    height:
                      200,

                    objectFit:
                      "cover",

                    borderRadius:
                      16,
                  }}
                />

              </div>

            )}


            {!showCamera ? (

              <button
                type="button"

                onClick={
                  openCamera
                }

                disabled={
                  verifying ||
                  !isOnline
                }

                title={
                  !isOnline
                    ? "Reconnect to verify face"
                    : undefined
                }

                style={{
                  width:
                    "100%",

                  padding:
                    "15px",

                  border:
                    0,

                  borderRadius:
                    10,

                  background:
                    "#2563eb",

                  color:
                    "#ffffff",

                  fontWeight:
                    700,

                  fontSize:
                    16,

                  cursor:
                    "pointer",
                }}
              >

                {verifying
                  ? "⏳ Verifying..."
                  : "📸 Verify Face & Mark Attendance"}

              </button>

            ) : (

              <div
                style={{
                  textAlign:
                    "center",
                }}
              >

                <Webcam
                  ref={
                    webcamRef
                  }

                  audio={
                    false
                  }

                  mirrored={
                    true
                  }

                  screenshotFormat=
                    "image/jpeg"

                  screenshotQuality={
                    1
                  }

                  videoConstraints={{
                    facingMode:
                      "user",

                    width: {
                      ideal:
                        1280,
                    },

                    height: {
                      ideal:
                        720,
                    },
                  }}

                  onUserMedia={
                    handleCameraReady
                  }

                  onUserMediaError={
                    handleCameraError
                  }

                  style={{
                    width:
                      "100%",

                    maxWidth:
                      360,

                    borderRadius:
                      15,

                    background:
                      "#000000",
                  }}
                />


                {!cameraReady &&
                  !cameraError && (

                    <p>
                      ⏳ Starting camera...
                    </p>

                  )}


                {cameraError && (

                  <div
                    style={{
                      marginTop:
                        10,

                      padding:
                        10,

                      background:
                        "#fee2e2",

                      color:
                        "#991b1b",

                      borderRadius:
                        8,
                    }}
                  >

                    {
                      cameraError
                    }

                  </div>

                )}


                <button
                  type="button"

                  onClick={
                    captureSelfie
                  }

                  disabled={
                    !cameraReady ||
                    verifying ||
                    !isOnline
                  }

                  style={{
                    width:
                      "100%",

                    marginTop:
                      15,

                    padding:
                      "14px",

                    border:
                      0,

                    borderRadius:
                      10,

                    background:
                      "#16a34a",

                    color:
                      "#ffffff",

                    fontWeight:
                      700,

                    cursor:
                      "pointer",
                  }}
                >

                  📸 Capture & Verify

                </button>


                <button
                  type="button"

                  onClick={() =>
                    setShowCamera(
                      false
                    )
                  }

                  style={{
                    width:
                      "100%",

                    marginTop:
                      10,

                    padding:
                      "12px",

                    border:
                      "1px solid #cbd5e1",

                    borderRadius:
                      10,

                    background:
                      "#ffffff",

                    cursor:
                      "pointer",
                  }}
                >

                  Cancel

                </button>

              </div>

            )}


            <button
              type="button"

              onClick={
                resetEmployee
              }

              disabled={
                verifying
              }

              style={{
                width:
                  "100%",

                marginTop:
                  15,

                padding:
                  "10px",

                border:
                  0,

                background:
                  "transparent",

                color:
                  "#64748b",

                cursor:
                  "pointer",
              }}
            >

              Use another Employee ID

            </button>

          </>

        )}


        {message && (

          <div
            style={{
              marginTop:
                20,

              padding:
                14,

              borderRadius:
                10,

              textAlign:
                "center",

              fontWeight:
                700,

              background:
                messageType ===
                "success"
                  ? "#dcfce7"
                  : messageType ===
                    "error"
                  ? "#fee2e2"
                  : "#fef3c7",

              color:
                messageType ===
                "success"
                  ? "#166534"
                  : messageType ===
                    "error"
                  ? "#991b1b"
                  : "#92400e",
            }}
          >

            {message}

          </div>

        )}

      </div>

      </div>

      <Footer />

    </div>

  );

}


export default EmployeeAttendance;