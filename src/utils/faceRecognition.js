// client/src/utils/faceRecognition.js

import * as faceapi from "face-api.js";
async function prepareFaceApi() {
  try {
    console.log("🧠 Preparing face-api backend...");

    await faceapi.tf.setBackend("cpu");
    await faceapi.tf.ready();

    console.log(
      "✅ Face-api backend:",
      faceapi.tf.getBackend()
    );
  } catch (error) {
    console.error(
      "❌ Failed to prepare face-api backend:",
      error
    );

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| MODEL STATE
|--------------------------------------------------------------------------
*/

let modelsLoaded = false;
let modelsLoading = null;

const MODEL_URL = "/models";

/*
|--------------------------------------------------------------------------
| CAMERA CHECK
|--------------------------------------------------------------------------
| Used by AddAttendanceModal.jsx before opening the webcam.
|--------------------------------------------------------------------------
*/

export async function checkCamera() {
  try {
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      return {
        available: false,
        message:
          "Camera access is not supported by this browser.",
      };
    }

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

    /*
     * We only needed the permission/check.
     * Stop the temporary camera stream immediately.
     */

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    return {
      available: true,
      message: "Camera is available.",
    };
  } catch (error) {
    console.error(
      "❌ Camera check failed:",
      error
    );

    return {
      available: false,
      message:
        "Unable to access camera. Please allow camera permission.",
      error,
    };
  }
}

/*
|--------------------------------------------------------------------------
| LOAD FACE MODELS
|--------------------------------------------------------------------------
*/

export async function loadFaceModels() {
  if (modelsLoaded) {
    return true;
  }

  if (modelsLoading) {
    return modelsLoading;
  }

  modelsLoading = (async () => {
    try {
      console.log(
        "================================="
      );

      console.log(
        "🤖 FACE RECOGNITION INITIALIZING"
      );

      console.log(
        "================================="
      );

      console.log(
        "📦 Model path:",
        MODEL_URL
      );
      await prepareFaceApi();

      /*
       * Tiny Face Detector
       */

      console.log(
        "1️⃣ Loading Tiny Face Detector..."
      );

      await faceapi.nets.tinyFaceDetector.loadFromUri(
        MODEL_URL
      );

      console.log(
        "✅ Tiny Face Detector Loaded"
      );

      /*
       * Face Landmark Model
       */

      console.log(
        "2️⃣ Loading Face Landmark Model..."
      );

      await faceapi.nets.faceLandmark68Net.loadFromUri(
        MODEL_URL
      );

      console.log(
        "✅ Face Landmark Model Loaded"
      );

      /*
       * Face Recognition Model
       */

      console.log(
        "3️⃣ Loading Face Recognition Model..."
      );

      await faceapi.nets.faceRecognitionNet.loadFromUri(
        MODEL_URL
      );

      console.log(
        "✅ Face Recognition Model Loaded"
      );

      modelsLoaded = true;

      console.log(
        "================================="
      );

      console.log(
        "✅ ALL FACE MODELS LOADED"
      );

      console.log(
        "================================="
      );

      return true;
    } catch (error) {
      modelsLoaded = false;
      modelsLoading = null;

      console.error(
        "❌ Failed to load face-api models:",
        error
      );

      throw new Error(
        "Face recognition models could not be loaded. Please check the /models folder."
      );
    }
  })();

  return modelsLoading;
}

/*
|--------------------------------------------------------------------------
| LOAD IMAGE SAFELY
|--------------------------------------------------------------------------
|
| Supports:
|
| 1. URL
| 2. File
| 3. Blob
| 4. HTMLImageElement
|
|--------------------------------------------------------------------------
*/

async function loadImage(
  input,
  label = "image"
) {
  if (!input) {
    throw new Error(
      `${label} is missing.`
    );
  }

  /*
   * Already an HTMLImageElement
   */

  if (
    typeof HTMLImageElement !==
      "undefined" &&
    input instanceof HTMLImageElement
  ) {
    if (!input.complete) {
      await new Promise(
        (resolve, reject) => {
          input.onload = resolve;
          input.onerror = reject;
        }
      );
    }

    if (
      !input.naturalWidth ||
      !input.naturalHeight
    ) {
      throw new Error(
        `${label} has invalid dimensions.`
      );
    }

    return input;
  }

  /*
   * Convert File / Blob to object URL.
   */

  if (
    typeof Blob !== "undefined" &&
    input instanceof Blob
  ) {
    const objectUrl =
      URL.createObjectURL(input);

    try {
      return await loadImage(
        objectUrl,
        label
      );
    } finally {
      URL.revokeObjectURL(
        objectUrl
      );
    }
  }

  /*
   * URL string
   */

  if (
    typeof input === "string"
  ) {
    return new Promise(
      (resolve, reject) => {
        const img =
          new Image();

        /*
         * Important for Supabase
         * storage images.
         */

        img.crossOrigin =
          "anonymous";

        img.onload = () => {
          if (
            !img.naturalWidth ||
            !img.naturalHeight
          ) {
            reject(
              new Error(
                `${label} has invalid image dimensions.`
              )
            );

            return;
          }

          resolve(img);
        };

        img.onerror = () => {
          reject(
            new Error(
              `Unable to load ${label}. Please check the image URL and CORS settings.`
            )
          );
        };

        img.src = input;
      }
    );
  }

  throw new Error(
    `${label} has an unsupported image format.`
  );
}

/*
|--------------------------------------------------------------------------
| VALIDATE IMAGE
|--------------------------------------------------------------------------
*/

function isValidImage(
  image
) {
  if (!image) {
    return false;
  }

  const width =
    image.naturalWidth ||
    image.videoWidth ||
    image.width ||
    0;

  const height =
    image.naturalHeight ||
    image.videoHeight ||
    image.height ||
    0;

  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  );
}

/*
|--------------------------------------------------------------------------
| DETECT FACE
|--------------------------------------------------------------------------
*/

async function detectFace(
  image,
  label = "image"
) {
  try {
    console.log(
      `🔎 Detecting face in ${label}...`
    );

    /*
     * Convert input into a real
     * HTMLImageElement.
     */

    const loadedImage =
      await loadImage(
        image,
        label
      );

    /*
     * Validate dimensions BEFORE
     * sending the image to face-api.
     */

    if (
      !isValidImage(
        loadedImage
      )
    ) {
      console.error(
        `❌ Invalid image dimensions for ${label}`,
        {
          width:
            loadedImage?.naturalWidth,
          height:
            loadedImage?.naturalHeight,
        }
      );

      return null;
    }

    console.log(
      `🖼️ ${label} dimensions:`,
      loadedImage.naturalWidth,
      "x",
      loadedImage.naturalHeight
    );

    /*
     * Tiny Face Detector options.
     */

    const options =
      new faceapi.TinyFaceDetectorOptions(
        {
          inputSize: 160,
          scoreThreshold: 0.45,
        }
      );

    /*
     * Detect one face.
     */

    const detection =
  await faceapi
    .detectSingleFace(
      loadedImage,
      options
    )
    .withFaceLandmarks()
    .withFaceDescriptor();

if (!detection) {
  console.warn(
    `❌ No face detected in ${label}`
  );

  return null;
}

console.log(
  `✅ Tiny Face Detector detected face in ${label}:`,
  detection.box
);

const result = detection;

    /*
     * No face.
     */

    if (!result) {
      console.warn(
        `❌ No face detected in ${label}`
      );

      return null;
    }

    /*
     * Validate detection.
     */

    if (
      !result.detection
    ) {
      console.error(
        `❌ Detection object missing in ${label}`
      );

      return null;
    }

    /*
     * IMPORTANT:
     *
     * Do not manually construct
     * face-api Box objects.
     *
     * We simply read the detection
     * returned by face-api.
     */

    const box =
      result.detection.box;

    if (!box) {
      console.error(
        `❌ Bounding box missing in ${label}`
      );

      return null;
    }

    /*
     * Validate bounding box values.
     */

    const values = [
      box.x,
      box.y,
      box.width,
      box.height,
    ];

    const invalidBox =
      values.some(
        (value) =>
          typeof value !==
            "number" ||
          !Number.isFinite(
            value
          )
      );

    if (invalidBox) {
      console.error(
        `❌ Invalid bounding box returned for ${label}:`,
        box
      );

      return null;
    }

    if (
      box.width <= 0 ||
      box.height <= 0
    ) {
      console.error(
        `❌ Bounding box has invalid size for ${label}:`,
        box
      );

      return null;
    }

    /*
     * Validate descriptor.
     */

    if (
      !result.descriptor
    ) {
      console.error(
        `❌ Face descriptor missing for ${label}`
      );

      return null;
    }

    console.log(
      `✅ Face detected successfully in ${label}`,
      {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        score:
          result.detection
            .score,
      }
    );

    return result;
  } catch (error) {
    console.error(
      `❌ Face detection failed for ${label}:`,
      error
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| GET FACE DESCRIPTOR
|--------------------------------------------------------------------------
*/

export async function getFaceDescriptor(
  image,
  label = "image"
) {
  try {
    await loadFaceModels();

    const result =
      await detectFace(
        image,
        label
      );

    if (!result) {
      return null;
    }

    if (
      !result.descriptor
    ) {
      console.warn(
        `❌ Descriptor missing for ${label}`
      );

      return null;
    }

    return result.descriptor;
  } catch (error) {
    console.error(
      `❌ Could not generate descriptor for ${label}:`,
      error
    );

    return null;
  }
}

/*
|--------------------------------------------------------------------------
| COMPARE TWO FACES
|--------------------------------------------------------------------------
*/

export async function compareFaces(
  profileImage,
  selfieImage
) {
  console.log(
    "================================="
  );

  console.log(
    "🔍 STARTING FACE VERIFICATION"
  );

  console.log(
    "================================="
  );

  try {
    /*
     * STEP 1
     * Make sure models are loaded.
     */

    console.log(
      "STEP 1: Loading face recognition models..."
    );

    await loadFaceModels();

    console.log(
      "✅ Models ready"
    );

    /*
     * STEP 2
     * Validate inputs.
     */

    console.log(
      "STEP 2: Checking input images..."
    );

    if (!profileImage) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "Employee profile photo is missing.",
      };
    }

    if (!selfieImage) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "Attendance selfie is missing.",
      };
    }

    /*
     * STEP 3
     * Detect employee face.
     */

    console.log(
      "STEP 3: Detecting employee face..."
    );

    const profileResult =
      await detectFace(
        profileImage,
        "employee profile photo"
      );

    if (!profileResult) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "No clear face detected in the employee profile photo.",
      };
    }

    console.log(
      "✅ Employee profile face detected"
    );

    /*
     * STEP 4
     * Detect selfie face.
     */

    console.log(
      "STEP 4: Detecting attendance selfie face..."
    );

    const selfieResult =
      await detectFace(
        selfieImage,
        "attendance selfie"
      );

    if (!selfieResult) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "No clear face detected in the attendance selfie.",
      };
    }

    console.log(
      "✅ Attendance selfie face detected"
    );

    /*
     * STEP 5
     * Get descriptors.
     */

    console.log(
      "STEP 5: Getting face descriptors..."
    );

    const profileDescriptor =
      profileResult.descriptor;

    const selfieDescriptor =
      selfieResult.descriptor;

    if (
      !profileDescriptor
    ) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "Could not generate employee face descriptor.",
      };
    }

    if (
      !selfieDescriptor
    ) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "Could not generate selfie face descriptor.",
      };
    }

    /*
     * STEP 6
     * Compare descriptors.
     */

    console.log(
      "STEP 6: Comparing face descriptors..."
    );

    const distance =
      faceapi.euclideanDistance(
        profileDescriptor,
        selfieDescriptor
      );

    console.log(
      "📏 Face distance:",
      distance
    );

    /*
     * Validate distance.
     */

    if (
      !Number.isFinite(
        distance
      )
    ) {
      return {
        success: false,
        match: false,
        distance: null,
        threshold: 0.60,
        message:
          "Face comparison returned an invalid distance.",
      };
    }

    /*
     * FACE MATCH THRESHOLD
     *
     * 0.60 is a reasonable
     * starting point.
     *
     * Lower = stricter.
     */

    const threshold = 0.60;

    const match =
      distance <= threshold;

    console.log(
      "🎯 Face threshold:",
      threshold
    );

    console.log(
      "📏 Face distance:",
      distance
    );

    console.log(
      match
        ? "✅ FACE MATCHED"
        : "❌ FACE DID NOT MATCH"
    );

    console.log(
      "================================="
    );

    /*
     * Return EXACTLY the fields
     * AddAttendanceModal expects.
     */

    return {
      success: true,
      match,
      distance,
      threshold,
      message: match
        ? "Face verified successfully."
        : "Face does not match the employee profile.",
    };
  } catch (error) {
    console.error(
      "❌ FACE VERIFICATION ERROR:",
      error
    );

    return {
      success: false,
      match: false,
      distance: null,
      threshold: 0.60,
      message:
        error?.message ||
        "Face verification failed. Please capture the photo again.",
      error,
    };
  }
}

/*
|--------------------------------------------------------------------------
| CHECK WHETHER IMAGE CONTAINS A FACE
|--------------------------------------------------------------------------
*/

export async function hasFace(
  image
) {
  try {
    await loadFaceModels();

    const result =
      await detectFace(
        image,
        "face check"
      );

    return !!result;
  } catch (error) {
    console.error(
      "❌ Face check failed:",
      error
    );

    return false;
  }
}

/*
|--------------------------------------------------------------------------
| RESET MODEL STATE
|--------------------------------------------------------------------------
*/

export function resetFaceModels() {
  modelsLoaded = false;
  modelsLoading = null;

  console.log(
    "🔄 Face recognition model state reset."
  );
}