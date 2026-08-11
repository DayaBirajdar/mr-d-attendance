import React, {
  useRef,
  useState,
} from "react";

import Webcam from "react-webcam";

import { supabase } from "../lib/supabase";

import {
  compareFaces,
  loadFaceModels,
} from "../utils/faceRecognition";


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

    const cleanEmployeeId =
      employeeId.trim();

    if (!cleanEmployeeId) {

      setMessageType("error");

      setMessage(
        "Please enter your Employee ID."
      );

      return;
    }


    setLoadingEmployee(true);

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

        setMessageType("error");

        setMessage(
          "Employee ID not found."
        );

        return;
      }


      if (!data.photo_url) {

        setMessageType("error");

        setMessage(
          "Profile photo is not available. Please contact Admin."
        );

        return;
      }


      setEmployee(data);

      setMessageType("success");

      setMessage(
        `Welcome ${data.full_name}`
      );


    } catch (error) {

      console.error(
        "Employee lookup error:",
        error
      );

      setMessageType("error");

      setMessage(
        "Unable to verify Employee ID."
      );

    } finally {

      setLoadingEmployee(false);

    }

  }


  // ---------------------------------------------------------
  // OPEN CAMERA
  // ---------------------------------------------------------

  async function openCamera() {

    if (!employee) {

      setMessageType("error");

      setMessage(
        "Please verify your Employee ID first."
      );

      return;
    }


    setCameraError("");

    setCameraReady(false);

    setMessage("");

    setShowCamera(true);

  }


  // ---------------------------------------------------------
  // CAMERA READY
  // ---------------------------------------------------------

  function handleCameraReady() {

    setCameraReady(true);

    setCameraError("");

  }


  // ---------------------------------------------------------
  // CAMERA ERROR
  // ---------------------------------------------------------

  function handleCameraError(error) {

    console.error(
      "Camera error:",
      error
    );

    setCameraReady(false);

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
      new Date(checkIn);

    const end =
      new Date(checkOut);


    let seconds =
      Math.floor(
        (end - start) / 1000
      );


    if (
      !Number.isFinite(seconds) ||
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
        (seconds % 3600) / 60
      );


    return `${hours}h ${minutes}m`;
  }


  // ---------------------------------------------------------
  // LATE MINUTES
  // ---------------------------------------------------------

  function calculateLateMinutes(
    checkInTime
  ) {

    if (!checkInTime) {
      return 0;
    }


    const [
      hour,
      minute,
    ] =
      checkInTime
        .split(":")
        .map(Number);


    const actualMinutes =
      hour * 60 +
      minute;


    const officeStart =
      9 * 60 + 30;


    return Math.max(
      0,
      actualMinutes -
        officeStart
    );
  }


  // ---------------------------------------------------------
  // CAPTURE + VERIFY
  // ---------------------------------------------------------

  async function captureSelfie() {

    if (
      !webcamRef.current ||
      !employee
    ) {
      return;
    }


    const imageSrc =
      webcamRef.current.getScreenshot();


    if (!imageSrc) {

      setMessageType("error");

      setMessage(
        "Unable to capture selfie."
      );

      return;
    }


    setSelfiePreview(
      imageSrc
    );

    setShowCamera(false);

    setVerifying(true);

    setMessageType("info");

    setMessage(
      "Verifying your face..."
    );


    try {

      const response =
        await fetch(imageSrc);

      const blob =
        await response.blob();

      const file =
        new File(
          [blob],
          `attendance-${Date.now()}.jpg`,
          {
            type: "image/jpeg",
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
        result.success !== true ||
        result.match !== true
      ) {

        setMessageType("error");

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

      setMessageType("error");

      setMessage(
        error?.message ||
        "Attendance could not be marked."
      );

    } finally {

      setVerifying(false);

    }

  }


  // ---------------------------------------------------------
  // UPLOAD SELFIE
  // ---------------------------------------------------------

  async function uploadSelfie(
    file
  ) {

    const extension =
      file.type === "image/png"
        ? "png"
        : "jpg";


    const fileName =
      `${employee.id}/${Date.now()}.${extension}`;


    const {
      error,
    } = await supabase.storage
      .from(
        "attendance-selfies"
      )
      .upload(
        fileName,
        file,
        {
          cacheControl: "3600",
          upsert: false,
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
    } = supabase.storage
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

    const today =
      getLocalDate();

    const time =
      getCurrentTime();


    // Check today's attendance

    const {
      data: todayAttendance,
      error: attendanceError,
    } = await supabase
      .from("attendance")
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
          ascending: false,
        }
      )
      .limit(1)
      .maybeSingle();


    if (attendanceError) {
      throw attendanceError;
    }


    // -----------------------------------------------------
    // CHECK IN
    // -----------------------------------------------------

    if (!todayAttendance) {

      const selfieUrl =
        await uploadSelfie(
          selfieFile
        );


      const checkIn =
        createDateTime(
          today,
          time
        );


      const lateMinutes =
        calculateLateMinutes(
          time
        );


      const {
        error,
      } = await supabase
        .from("attendance")
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

      setMessage(
        `✅ Check-In successful at ${time}`
      );

      return;
    }


    // -----------------------------------------------------
    // ALREADY CHECKED OUT
    // -----------------------------------------------------

    if (
      todayAttendance.check_out
    ) {

      const savedCheckout =
        todayAttendance.check_out
          .slice(11, 16);


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
      todayAttendance.check_in &&
      !todayAttendance.check_out
    ) {

      const selfieUrl =
        await uploadSelfie(
          selfieFile
        );


      const checkOut =
        createDateTime(
          today,
          time
        );


      const workingHours =
        calculateWorkingHours(
          todayAttendance.check_in,
          checkOut
        );


      const {
        error,
      } = await supabase
        .from("attendance")
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
          todayAttendance.id
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

    setEmployee(null);

    setEmployeeId("");

    setSelfiePreview("");

    setShowCamera(false);

    setCameraReady(false);

    setCameraError("");

    setMessage("");

  }


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (

    <div
      style={{
        minHeight: "100vh",

        background:
          "#f4f7fb",

        display: "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding: 20,
      }}
    >

      <div
        style={{
          width: "100%",

          maxWidth: 480,

          background:
            "#ffffff",

          borderRadius: 20,

          padding: 30,

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

          <div
            style={{
              fontSize: 50,
            }}
          >
            🤖
          </div>


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
              margin: 0,

              color:
                "#64748b",
            }}
          >

            Employee Check-In & Check-Out

          </p>

        </div>


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
              onChange={(e) =>
                setEmployeeId(
                  e.target.value
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
                loadingEmployee
              }
              style={{
                width:
                  "100%",

                padding:
                  "14px",

                border: 0,

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
                {employee.full_name}
              </strong>

              <div
                style={{
                  marginTop:
                    4,

                  color:
                    "#64748b",
                }}
              >

                {employee.employee_id}

                {employee.department
                  ? ` • ${employee.department}`
                  : ""}

              </div>

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
                  verifying
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

                    {cameraError}

                  </div>

                )}


                <button
                  type="button"
                  onClick={
                    captureSelfie
                  }
                  disabled={
                    !cameraReady ||
                    verifying
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

  );

}


export default EmployeeAttendance;