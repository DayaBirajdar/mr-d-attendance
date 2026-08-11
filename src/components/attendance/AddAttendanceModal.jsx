import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Webcam from "react-webcam";

import {
  compareFaces,
  loadFaceModels,
} from "../../utils/faceRecognition";

import { supabase } from "../../lib/supabase";


function AddAttendanceModal({
  item,
  onClose,
  onSave,
}) {

  // ---------------------------------------------------------
  // CAMERA
  // ---------------------------------------------------------

  const webcamRef = useRef(null);


  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------

  const [employees, setEmployees] = useState([]);

  const [showCamera, setShowCamera] = useState(false);

  const [selfiePreview, setSelfiePreview] = useState("");

  const [selfieFile, setSelfieFile] = useState(null);

  const [selectedEmployee, setSelectedEmployee] = useState(null);

  const [faceMatched, setFaceMatched] = useState(false);

  const [matchMessage, setMatchMessage] = useState("");

  const [isVerifying, setIsVerifying] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);

  const [cameraError, setCameraError] = useState("");


  // ---------------------------------------------------------
  // FORM
  // ---------------------------------------------------------

  const [form, setForm] = useState({
    employee_id: "",

    attendance_date:
      new Date()
        .toISOString()
        .split("T")[0],

    check_in: "",

    check_out: "",

    status: "Present",

    remarks: "",
  });


  // ---------------------------------------------------------
  // INITIAL LOAD
  // ---------------------------------------------------------

  useEffect(() => {

    loadEmployees();

    if (item) {

      setForm({
        employee_id:
          item.employee_id || "",

        attendance_date:
          item.attendance_date ||
          new Date()
            .toISOString()
            .split("T")[0],

        check_in:
          item.check_in
            ? item.check_in.slice(11, 16)
            : "",

        check_out:
          item.check_out
            ? item.check_out.slice(11, 16)
            : "",

        status:
          item.attendance_status ||
          item.status ||
          "Present",

        remarks:
          item.remarks || "",
      });

      if (item.selfie_url) {
        setSelfiePreview(item.selfie_url);
      }

    }

  }, [item]);
  useEffect(() => {
  if (
    item &&
    employees.length > 0
  ) {
    const employee =
      employees.find(
        (employee) =>
          String(employee.id) ===
          String(item.employee_id)
      );

    if (employee) {
      setSelectedEmployee(employee);
    }
  }
}, [item, employees]);


  // ---------------------------------------------------------
  // LOAD EMPLOYEES
  // ---------------------------------------------------------

  async function loadEmployees() {

    try {

      const {
        data,
        error,
      } = await supabase
        .from("employees")
        .select("*")
        .eq("is_deleted", false)
        .eq("status", "Active")
        .order("full_name");


      if (error) {

        console.error(
          "Employee loading error:",
          error
        );

        return;
      }


      setEmployees(data || []);

    } catch (error) {

      console.error(
        "Employee loading failed:",
        error
      );

    }

  }


  // ---------------------------------------------------------
  // SELECT EMPLOYEE
  // ---------------------------------------------------------

  function handleChange(e) {

    const {
      name,
      value,
    } = e.target;


    setForm(
      (previous) => ({
        ...previous,
        [name]: value,
      })
    );


    if (name === "employee_id") {

      const employee =
        employees.find(
          (employee) =>
            String(employee.id) ===
            String(value)
        );


      setSelectedEmployee(
        employee || null
      );


      // Reset previous verification

      setFaceMatched(false);

      setMatchMessage("");

      setSelfieFile(null);

      setSelfiePreview("");

    }

  }


  // ---------------------------------------------------------
  // OPEN CAMERA
  // ---------------------------------------------------------

  async function openCamera() {

    setCameraError("");

    setCameraReady(false);

    setFaceMatched(false);

    setMatchMessage("");


    // Employee required

    if (!selectedEmployee) {

      alert(
        "Please select employee first."
      );

      return;
    }


    // Employee profile photo required

    if (!selectedEmployee.photo_url) {

      alert(
        "Employee profile photo not found."
      );

      return;
    }


    // Check camera

    setShowCamera(true);
  }


  // ---------------------------------------------------------
  // CAMERA READY
  // ---------------------------------------------------------

  function handleCameraReady() {

    console.log(
      "✅ Camera is ready"
    );

    setCameraReady(true);

    setCameraError("");

  }


  // ---------------------------------------------------------
  // CAMERA ERROR
  // ---------------------------------------------------------

  function handleCameraError(error) {

    console.error(
      "❌ Camera error:",
      error
    );

    setCameraReady(false);

    setCameraError(
      "Unable to access camera. Please allow camera permission in Chrome."
    );

  }


  // ---------------------------------------------------------
  // CAPTURE SELFIE
  // ---------------------------------------------------------

  async function captureSelfie() {

    console.log(
      "================================="
    );

    console.log(
      "📸 CAPTURING SELFIE"
    );

    console.log(
      "================================="
    );


    if (!webcamRef.current) {

      setMatchMessage(
        "Camera is not ready."
      );

      return;

    }


    const imageSrc =
      webcamRef.current.getScreenshot();


    if (!imageSrc) {

      console.error(
        "❌ Screenshot failed"
      );

      setMatchMessage(
        "Unable to capture selfie."
      );

      return;

    }


    console.log(
      "✅ Selfie captured."
    );


    setSelfiePreview(
      imageSrc
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


      console.log(
        "Selfie file:",
        file
      );


      setSelfieFile(file);


      setShowCamera(false);


      // ---------------------------------------------------
      // VERIFY FACE
      // ---------------------------------------------------

      await verifyFace(file);


    } catch (error) {

      console.error(
        "Selfie capture failed:",
        error
      );

      setIsVerifying(false);

      setFaceMatched(false);

      setMatchMessage(
        "❌ Unable to process selfie."
      );

    }

  }


  // ---------------------------------------------------------
  // VERIFY FACE
  // ---------------------------------------------------------

  async function verifyFace(file) {

    setIsVerifying(true);

    setFaceMatched(false);

    setMatchMessage(
      "⏳ Verifying Face..."
    );


    try {

      if (!selectedEmployee) {

        throw new Error(
          "Please select employee."
        );

      }


      if (!selectedEmployee.photo_url) {

        throw new Error(
          "Employee profile photo not found."
        );

      }


      if (!file) {

        throw new Error(
          "Selfie file not found."
        );

      }


      console.log(
        "================================="
      );

      console.log(
        "🔍 STARTING ATTENDANCE FACE VERIFICATION"
      );

      console.log(
        "================================="
      );


      // ---------------------------------------------------
      // LOAD FACE MODELS
      // ---------------------------------------------------

      console.log(
        "STEP 1: Loading face recognition models..."
      );


      await loadFaceModels();


      console.log(
        "✅ Face models ready"
      );


      // ---------------------------------------------------
      // COMPARE FACES
      // ---------------------------------------------------

      console.log(
        "STEP 2: Comparing employee profile with selfie..."
      );


      const result =
        await compareFaces(
          selectedEmployee.photo_url,
          file
        );


      console.log(
        "Face verification result:",
        result
      );


      // ---------------------------------------------------
      // IMPORTANT FIX
      // ---------------------------------------------------
      //
      // compareFaces() returns:
      //
      // {
      //   success: true,
      //   match: true,
      //   distance: ...,
      //   threshold: ...,
      //   message: ...
      // }
      //
      // It DOES NOT return:
      //
      // result.matched
      //
      // Therefore use:
      //
      // result.match
      //
      // ---------------------------------------------------

      if (
  result &&
  result.success === true &&
  result.match === true
) {

  setFaceMatched(true);

  const currentTime =
    new Date()
      .toTimeString()
      .slice(0, 5);

  setForm((previous) => ({
  ...previous,

  ...(item
    ? {
        check_out: currentTime,
      }
    : {
        check_in:
          previous.check_in ||
          currentTime,
      }),
}));

  setMatchMessage(
    result.message ||
    "✅ Face verified successfully."
  );

  return;
}
setFaceMatched(false);

setMatchMessage(
  result?.message ||
  "❌ Face Not Matched"
);


      // ---------------------------------------------------
      // FACE NOT MATCHED
      // ---------------------------------------------------

      setFaceMatched(false);


      setMatchMessage(
        result?.message ||
        "❌ Face Not Matched"
      );


      console.log(
        "================================="
      );

      console.log(
        "❌ FACE DID NOT MATCH"
      );

      console.log(
        "================================="
      );

    } catch (error) {

      console.error(
        "❌ Face verification failed:",
        error
      );


      setFaceMatched(false);


      setMatchMessage(
        `❌ ${
          error?.message ||
          "Face verification failed."
        }`
      );

    } finally {

      // VERY IMPORTANT

      setIsVerifying(false);

    }

  }


  // ---------------------------------------------------------
  // CALCULATE HOURS
  // ---------------------------------------------------------

  function calculateHours() {

    if (
      !form.check_in ||
      !form.check_out
    ) {

      return {
        hours: "",
        lateMinutes: 0,
      };

    }


    const start =
      new Date(
        `2000-01-01 ${form.check_in}`
      );


    const end =
      new Date(
        `2000-01-01 ${form.check_out}`
      );


    let diff =
      Math.floor(
        (end - start) /
          1000
      );


    // Overnight shift

    if (diff < 0) {

      diff +=
        24 * 60 * 60;

    }


    const hrs =
      Math.floor(
        diff / 3600
      );


    const mins =
      Math.floor(
        (diff % 3600) /
          60
      );


    const officeStart =
      new Date(
        "2000-01-01 09:30"
      );


    let lateMinutes = 0;


    if (start > officeStart) {

      lateMinutes =
        Math.floor(
          (start -
            officeStart) /
            60000
        );

    }


    return {

      hours:
        `${hrs}h ${mins}m`,

      lateMinutes,

    };

  }


  // ---------------------------------------------------------
  // SUBMIT
  // ---------------------------------------------------------

  function handleSubmit(e) {

    e.preventDefault();


    // Cannot submit while verifying

    if (isVerifying) {

      alert(
        "Please wait until face verification is complete."
      );

      return;

    }


    // Face must match

    if (!faceMatched) {

      alert(
        "Face verification failed. Please capture the selfie again."
      );

      return;

    }


    const result =
      calculateHours();


    onSave({

      employee_id:
        Number(
          form.employee_id
        ),

      attendance_date:
        form.attendance_date,

      check_in:
        form.check_in
          ? `${form.attendance_date}T${form.check_in}:00`
          : null,

      check_out:
        form.check_out
          ? `${form.attendance_date}T${form.check_out}:00`
          : null,

      working_hours:
        result.hours,

      late_minutes:
        result.lateMinutes,

      attendance_status:
        form.status,

      status:
        form.status,

      remarks:
        form.remarks,

      selfie:
        selfieFile,

      profilePhoto:
        selectedEmployee?.photo_url ||
        employees.find(
          (employee) =>
            employee.id ===
            Number(
              form.employee_id
            )
        )?.photo_url,

    });

  }


  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (

    <div
      className="modal-overlay"
    >

      <div
        className="modal"
      >

        <h2>

          {item
            ? "✏️ Edit Attendance"
            : "🕒 Add Attendance"}

        </h2>


        <form
          onSubmit={
            handleSubmit
          }
        >

          {/* -------------------------------------------------
              EMPLOYEE
          -------------------------------------------------- */}

          <select
            name="employee_id"
            value={
              form.employee_id
            }
            onChange={
              handleChange
            }
            required
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
                    employee.employee_id
                  }

                  {" - "}

                  {
                    employee.full_name
                  }

                </option>

              )
            )}

          </select>


          {/* -------------------------------------------------
              DATE
          -------------------------------------------------- */}

          <input
            type="date"
            name="attendance_date"
            value={
              form.attendance_date
            }
            onChange={
              handleChange
            }
            required
          />


          {/* -------------------------------------------------
              CHECK IN
          -------------------------------------------------- */}

          <input
            type="time"
            name="check_in"
            value={
              form.check_in
            }
            onChange={
              handleChange
            }
          />


          {/* -------------------------------------------------
              CHECK OUT
          -------------------------------------------------- */}

          <input
            type="time"
            name="check_out"
            value={
              form.check_out
            }
            onChange={
              handleChange
            }
          />


          {/* -------------------------------------------------
              STATUS
          -------------------------------------------------- */}

          <select
            name="status"
            value={
              form.status
            }
            onChange={
              handleChange
            }
          >

            <option value="Present">
              Present
            </option>

            <option value="Absent">
              Absent
            </option>

            <option value="Leave">
              Leave
            </option>

            <option value="Half Day">
              Half Day
            </option>

          </select>


          {/* -------------------------------------------------
              SELFIE
          -------------------------------------------------- */}

          <h3
            style={{
              marginTop: 20,
            }}
          >
            Attendance Selfie
          </h3>


          {!showCamera ? (

            <div
              style={{
                textAlign: "center",
              }}
            >

              {selfiePreview ? (

                <img
                  src={
                    selfiePreview
                  }
                  alt="Attendance selfie"
                  style={{
                    width: 220,
                    height: 220,
                    objectFit: "cover",
                    borderRadius: 12,
                    border:
                      faceMatched
                        ? "3px solid #22c55e"
                        : "2px solid #ddd",
                    marginBottom: 15,
                  }}
                />

              ) : (

                <div
                  style={{
                    width: 220,
                    height: 220,
                    margin: "0 auto",
                    borderRadius: 12,
                    background: "#f1f5f9",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 60,
                  }}
                >
                  📷
                </div>

              )}


              <br />


              <button
                type="button"
                className="add-btn"
                onClick={
                  openCamera
                }
                disabled={
                  isVerifying
                }
              >

                📸 Open Camera

              </button>

            </div>

          ) : (

            <div
              style={{
                textAlign: "center",
              }}
            >

              <Webcam

                ref={
                  webcamRef
                }

                audio={false}

                screenshotFormat={
                  "image/jpeg"
                }

                screenshotQuality={1}

                mirrored={true}

                videoConstraints={{
                  facingMode: "user",

                  width: {
                    ideal: 1280,
                  },

                  height: {
                    ideal: 720,
                  },
                }}

                onUserMedia={
                  handleCameraReady
                }

                onUserMediaError={
                  handleCameraError
                }

                style={{
                  width: 320,
                  height: 240,
                  objectFit: "cover",
                  borderRadius: 12,
                  background: "#000",
                }}

              />


              {!cameraReady &&
                !cameraError && (

                  <div
                    style={{
                      marginTop: 10,
                      fontWeight: "bold",
                    }}
                  >

                    ⏳ Starting camera...

                  </div>

                )}


              {cameraError && (

                <div
                  style={{
                    marginTop: 15,
                    padding: 12,
                    borderRadius: 10,
                    background: "#fee2e2",
                    color: "#991b1b",
                    fontWeight: "bold",
                  }}
                >

                  ❌ {cameraError}

                </div>

              )}


              <div
                style={{
                  marginTop: 15,
                }}
              >

                <button
                  type="button"
                  className="add-btn"
                  onClick={
                    captureSelfie
                  }
                  disabled={
                    !cameraReady ||
                    isVerifying
                  }
                >

                  📸 Capture Selfie

                </button>


                <button
                  type="button"
                  className="delete-btn"
                  style={{
                    marginLeft: 10,
                  }}
                  onClick={() => {

                    setShowCamera(false);

                    setCameraReady(false);

                    setCameraError("");

                  }}
                  disabled={
                    isVerifying
                  }
                >

                  Cancel

                </button>

              </div>

            </div>

          )}


          {/* -------------------------------------------------
              VERIFICATION MESSAGE
          -------------------------------------------------- */}

          {matchMessage && (

            <div
              style={{
                marginTop: 15,
                padding: 12,
                borderRadius: 10,

                background:
                  isVerifying
                    ? "#fef3c7"
                    : faceMatched
                    ? "#dcfce7"
                    : "#fee2e2",

                color:
                  isVerifying
                    ? "#92400e"
                    : faceMatched
                    ? "#166534"
                    : "#991b1b",

                fontWeight: "bold",

                textAlign: "center",
              }}
            >

              {isVerifying
                ? "⏳ Verifying Face..."
                : matchMessage}

            </div>

          )}


          {/* -------------------------------------------------
              REMARKS
          -------------------------------------------------- */}

          <textarea
            rows="3"
            name="remarks"
            placeholder="Remarks"
            value={
              form.remarks
            }
            onChange={
              handleChange
            }
          />


          {/* -------------------------------------------------
              BUTTONS
          -------------------------------------------------- */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              marginTop: 20,
            }}
          >

            <button
              type="submit"
              className="add-btn"
              disabled={
                isVerifying ||
                !faceMatched
              }
            >

              {isVerifying
                ? "⏳ Verifying..."
                : item
                ? "Update Attendance"
                : "Save Attendance"}

            </button>


            <button
              type="button"
              className="delete-btn"
              onClick={
                onClose
              }
              disabled={
                isVerifying
              }
            >

              Cancel

            </button>

          </div>

        </form>

      </div>

    </div>

  );

}


export default AddAttendanceModal;