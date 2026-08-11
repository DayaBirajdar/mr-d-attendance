const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyzqcaQruhuq9Tzs3qx-lZxv--HbK8gRFobJLEqN-K3nSjxjxiZWdxg3Te7gdDwbL04/exec";

const SHEET_ID =
  "18SNEtvUHVf8w7GgScsRWiUzUyqNvuxLSwRtAcl1tOfA";

export async function syncRenewal(action, renewal) {
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        sheetId: SHEET_ID,
        sheetName: "Renewals",
        id: renewal.id,
        values: [
          renewal.id,
          renewal.title,
          renewal.category,
          renewal.vendor,
          renewal.renewal_date,
          renewal.amount,
          renewal.status,
        ],
      }),
    });

    const result = await response.json();
    console.log("Google Sync:", result);

  } catch (err) {
    console.error("Google Sync Error:", err);
  }
}