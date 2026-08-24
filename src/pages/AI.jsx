import {
  useEffect,
  useRef,
  useState,
} from "react";

import * as XLSX from "xlsx";
import { supabase } from "../lib/supabase";


const MRD_DB_NAME =
  "mr-d-local-db";

const MRD_DB_VERSION =
  1;

const MRD_STORE_NAME =
  "workbook-cache";

const MRD_WORKBOOK_KEY =
  "active-workbook";

const MRD_WORKBOOK_CACHE_VERSION =
  "regression-fixed-v1";


function openMrDDatabase() {
  return new Promise(
    (resolve, reject) => {
      const request =
        indexedDB.open(
          MRD_DB_NAME,
          MRD_DB_VERSION
        );

      request.onupgradeneeded =
        () => {
          const db =
            request.result;

          if (
            !db.objectStoreNames.contains(
              MRD_STORE_NAME
            )
          ) {
            db.createObjectStore(
              MRD_STORE_NAME
            );
          }
        };

      request.onsuccess =
        () =>
          resolve(
            request.result
          );

      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


async function saveWorkbookCache(
  payload
) {
  const db =
    await openMrDDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          MRD_STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          MRD_STORE_NAME
        );

      store.put(
        payload,
        MRD_WORKBOOK_KEY
      );

      transaction.oncomplete =
        () => {
          db.close();
          resolve();
        };

      transaction.onerror =
        () => {
          const error =
            transaction.error;

          db.close();
          reject(error);
        };
    }
  );
}


async function loadWorkbookCache() {
  const db =
    await openMrDDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          MRD_STORE_NAME,
          "readonly"
        );

      const store =
        transaction.objectStore(
          MRD_STORE_NAME
        );

      const request =
        store.get(
          MRD_WORKBOOK_KEY
        );

      request.onsuccess =
        () => {
          db.close();

          resolve(
            request.result ||
              null
          );
        };

      request.onerror =
        () => {
          const error =
            request.error;

          db.close();
          reject(error);
        };
    }
  );
}


async function clearWorkbookCache() {
  const db =
    await openMrDDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        db.transaction(
          MRD_STORE_NAME,
          "readwrite"
        );

      const store =
        transaction.objectStore(
          MRD_STORE_NAME
        );

      store.delete(
        MRD_WORKBOOK_KEY
      );

      transaction.oncomplete =
        () => {
          db.close();
          resolve();
        };

      transaction.onerror =
        () => {
          const error =
            transaction.error;

          db.close();
          reject(error);
        };
    }
  );
}


function cleanDisplayFileName(name) {
  return String(name || "")
    .replace(/\.{2,}(?=[a-z0-9]+$)/i, ".")
    .replace(/\s+/g, " ")
    .trim();
}




function detectWorkbookType(workbook) {
  const normalizeDetectorText =
    (value) =>
      String(
        value ?? ""
      )
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          " "
        )
        .trim();

  const sheetNames =
    Object.keys(
      workbook || {}
    );


  /*
   * ---------------------------------------------------------
   * EXPENSE TRACKER WORKBOOK SHAPE
   * ---------------------------------------------------------
   *
   * The real expense workbook can contain category sheets such as:
   * Main Sheet
   * Stratagem & SharksDen
   * Flight & Hotels
   * Snacks
   * Medicine & Internet
   * Stationary
   * Furniture and Fixture
   * Electronics
   *
   * Because "Electronics" is also an Inventory signal, the old
   * generic scorer could incorrectly classify this workbook as
   * Inventory. Detect the overall expense-tracker sheet pattern
   * BEFORE generic scoring.
   */
  const normalizedSheetNames =
    sheetNames.map(
      (name) =>
        normalizeDetectorText(
          name
        )
    );

  /*
   * ---------------------------------------------------------
   * ATTENDANCE / EMPLOYEE WORKBOOK SHAPE
   * ---------------------------------------------------------
   *
   * The real GISB workbook can contain month-only sheet names
   * (August, September, ... Jan, Feb, Mar, Apr, May, Jun, Jul, Aug)
   * and newer rows use "Employees" rather than "Name".
   *
   * Detect that overall workbook shape BEFORE generic scoring.
   */
  const attendanceMonthSignals = [
    "january", "jan",
    "february", "feb",
    "march", "mar",
    "april", "apr",
    "may",
    "june", "jun",
    "july", "jul",
    "august", "aug",
    "september", "sep",
    "october", "oct",
    "november", "nov",
    "december", "dec",
  ];

  const attendanceMonthHits =
    normalizedSheetNames.filter(
      (sheetName) =>
        attendanceMonthSignals.includes(
          sheetName
        )
    ).length;

  const attendanceHeaderSignals = [
    "employees",
    "employee",
    "employee name",
    "employee code",
    "leaves available",
    "total leaves",
    "total lop",
    "total half days",
    "total present days",
    "travelling days",
    "traveling days",
    "wfh days",
    "present",
    "absent",
    "leave",
    "check in",
    "check out",
    "in time",
    "out time",
  ];

  const attendanceHeaderHits =
    Object.values(
      workbook || {}
    ).reduce(
      (total, rows) => {
        if (
          !Array.isArray(rows) ||
          !rows.length
        ) {
          return total;
        }

        const keys =
          new Set();

        rows
          .slice(0, 5)
          .forEach(
            (row) => {
              Object.keys(
                row || {}
              ).forEach(
                (key) =>
                  keys.add(
                    normalizeDetectorText(
                      key
                    )
                  )
              );
            }
          );

        const hits =
          attendanceHeaderSignals.filter(
            (signal) =>
              [...keys].some(
                (key) =>
                  key === signal ||
                  key.includes(
                    signal
                  )
              )
          ).length;

        return total + hits;
      },
      0
    );

  /*
   * Multiple month sheets are already strong evidence.
   * Header signals provide a second independent route.
   */
  if (
    attendanceMonthHits >= 4 &&
    attendanceHeaderHits >= 1
  ) {
    return "Attendance";
  }

  if (
    attendanceMonthHits >= 8
  ) {
    return "Attendance";
  }

  /*
   * ---------------------------------------------------------
   * DOCUMENTS WORKBOOK SHAPE
   * ---------------------------------------------------------
   * Detect Document Master before generic scoring.
   */
  const documentSheet =
    Object.entries(workbook || {}).find(([sheetName, rows]) => {
      if (normalizeDetectorText(sheetName).includes("document master")) {
        return true;
      }

      return (
        Array.isArray(rows) &&
        rows.slice(0, 5).some((row) => {
          const keys = Object.keys(row || {}).map((key) =>
            normalizeDetectorText(key)
          );

          return (
            keys.includes("document id") &&
            keys.includes("document name") &&
            keys.includes("document category") &&
            keys.includes("document status")
          );
        })
      );
    });

  if (documentSheet) {
    return "Documents";
  }

  /*
   * ---------------------------------------------------------
   * VISITORS WORKBOOK SHAPE
   * ---------------------------------------------------------
   * Detect Visitor Master before generic scoring.
   */
  const visitorSheet =
    Object.entries(
      workbook || {}
    ).find(
      ([sheetName, rows]) => {
        const normalizedName =
          normalizeDetectorText(
            sheetName
          );

        if (
          normalizedName.includes(
            "visitor master"
          )
        ) {
          return true;
        }

        return (
          Array.isArray(rows) &&
          rows
            .slice(0, 5)
            .some(
              (row) => {
                const keys =
                  Object.keys(
                    row || {}
                  ).map(
                    (key) =>
                      normalizeDetectorText(
                        key
                      )
                  );

                return (
                  keys.includes(
                    "visitor id"
                  ) &&
                  keys.includes(
                    "visitor name"
                  ) &&
                  keys.includes(
                    "visit date"
                  ) &&
                  keys.includes(
                    "visit status"
                  )
                );
              }
            )
        );
      }
    );

  if (visitorSheet) {
    return "Visitors";
  }

  /*
   * ---------------------------------------------------------
   * EVENTS WORKBOOK SHAPE
   * ---------------------------------------------------------
   * Detect Event Master before generic scoring. Event workbooks
   * also contain Vendor, Amount/Cost and Payment Status fields.
   */
  const eventSheet =
    Object.entries(
      workbook || {}
    ).find(
      ([sheetName, rows]) => {
        const normalizedName =
          normalizeDetectorText(
            sheetName
          );

        if (
          normalizedName.includes(
            "event master"
          )
        ) {
          return true;
        }

        return (
          Array.isArray(rows) &&
          rows
            .slice(0, 5)
            .some(
              (row) => {
                const keys =
                  Object.keys(
                    row || {}
                  ).map(
                    (key) =>
                      normalizeDetectorText(
                        key
                      )
                  );

                return (
                  keys.includes(
                    "event id"
                  ) &&
                  keys.includes(
                    "event name"
                  ) &&
                  keys.includes(
                    "event date"
                  ) &&
                  keys.includes(
                    "event status"
                  )
                );
              }
            )
        );
      }
    );

  if (eventSheet) {
    return "Events";
  }

  /*
   * ---------------------------------------------------------
   * RENEWAL / AMC / SUBSCRIPTION WORKBOOK SHAPE
   * ---------------------------------------------------------
   *
   * Detect the dedicated Renewal Master before generic Expense
   * scoring because the workbook also contains fields such as
   * Vendor, Amount and Payment Status.
   */
  const renewalSheet =
    Object.entries(
      workbook || {}
    ).find(
      ([sheetName, rows]) => {
        const normalizedName =
          normalizeDetectorText(
            sheetName
          );

        if (
          normalizedName.includes(
            "renewal master"
          )
        ) {
          return true;
        }

        return (
          Array.isArray(rows) &&
          rows
            .slice(0, 5)
            .some(
              (row) => {
                const keys =
                  Object.keys(
                    row || {}
                  ).map(
                    (key) =>
                      normalizeDetectorText(
                        key
                      )
                  );

                return (
                  keys.includes(
                    "renewal id"
                  ) &&
                  keys.some(
                    (key) =>
                      key.includes(
                        "renewal due date"
                      )
                  ) &&
                  keys.some(
                    (key) =>
                      key.includes(
                        "service amc"
                      )
                  )
                );
              }
            )
        );
      }
    );

  if (renewalSheet) {
    return "Renewals";
  }

  /*
   * ---------------------------------------------------------
   * VENDOR WORKBOOK SHAPE
   * ---------------------------------------------------------
   * Supports the real Vendor.xlsx structure where Sheet1 uses:
   * VENDOR, __EMPTY, __EMPTY_1, __EMPTY_2
   */
  const vendorSheet =
    Object.entries(
      workbook || {}
    ).find(
      ([sheetName, rows]) => {
        if (
          normalizeDetectorText(
            sheetName
          ).includes(
            "vendor"
          )
        ) {
          return true;
        }

        return (
          Array.isArray(rows) &&
          rows
            .slice(0, 5)
            .some(
              (row) => {
                const rawKeys =
                  Object.keys(
                    row || {}
                  );

                return (
                  rawKeys.length >= 4 &&
                  normalizeDetectorText(
                    rawKeys[0]
                  ) === "vendor" &&
                  rawKeys
                    .slice(1)
                    .some(
                      (key) =>
                        String(key)
                          .toLowerCase()
                          .startsWith(
                            "__empty"
                          )
                    )
                );
              }
            )
        );
      }
    );

  if (
    vendorSheet &&
    sheetNames.length <= 2
  ) {
    return "Vendors";
  }

  const expenseTrackerSheetSignals = [
    "main sheet",
    "stratagem sharksden",
    "flight hotels",
    "snacks",
    "medicine internet",
    "stationary",
    "stationery",
    "furniture and fixture",
    "furniture fixture",
  ];

  const expenseTrackerSheetHits =
    expenseTrackerSheetSignals.filter(
      (signal) =>
        normalizedSheetNames.some(
          (sheetName) =>
            sheetName.includes(
              signal
            )
        )
    ).length;

  /*
   * Three or more of these category-sheet signals is strong
   * evidence that the workbook is an Expense Tracker.
   *
   * This intentionally ignores "Electronics" as a deciding
   * signal because Electronics also exists in Inventory files.
   */
  if (
    expenseTrackerSheetHits >= 3
  ) {
    return "Expenses";
  }

  const monthNames =
    new Set([
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ]);

  const monthSheetCount =
    sheetNames.filter(
      (sheetName) =>
        monthNames.has(
          normalizeDetectorText(
            sheetName
          )
        )
    ).length;

  let attendanceStructureHits =
    0;

  sheetNames.forEach(
    (sheetName) => {
      const rows =
        workbook[
          sheetName
        ] || [];

      rows
        .slice(0, 10)
        .forEach(
          (row) => {
            const keys =
              Object.keys(
                row || {}
              );

            const hasNameColumn =
              keys.some(
                (key) =>
                  normalizeDetectorText(
                    key
                  ) === "name"
              );

            const dayTimeColumns =
              keys.filter(
                (key) =>
                  /^\d{1,2}\s+(in|out|w)$/i.test(
                    String(key)
                      .trim()
                  )
              );

            if (
              hasNameColumn &&
              dayTimeColumns.length >= 4
            ) {
              attendanceStructureHits +=
                1;
            }
          }
        );
    }
  );

  if (
    monthSheetCount >= 2 &&
    attendanceStructureHits >= 1
  ) {
    return "Attendance";
  }

  const allColumns = [];

  sheetNames.forEach(
    (sheetName) => {
      const rows =
        workbook[
          sheetName
        ] || [];

      rows
        .slice(0, 20)
        .forEach(
          (row) => {
            Object.keys(
              row || {}
            ).forEach(
              (column) => {
                allColumns.push(
                  String(
                    column
                  ).toLowerCase()
                );
              }
            );
          }
        );
    }
  );

  const searchable =
    [
      ...sheetNames.map(
        (name) =>
          String(name)
            .toLowerCase()
      ),
      ...allColumns,
    ].join(" ");

  const score = {
    inventory: 0,
    attendance: 0,
    expenses: 0,
    renewals: 0,
    events: 0,
    visitors: 0,
    documents: 0,
  };

  const addScore = (
    type,
    words
  ) => {
    words.forEach(
      (word) => {
        if (
          searchable.includes(
            word
          )
        ) {
          score[type] += 1;
        }
      }
    );
  };

  addScore(
    "inventory",
    [
      "electronics",
      "inventory",
      "stock",
      "stock in",
      "stock in hand",
      "old stock",
      "used by",
      "assigned",
      "asset",
      "new purchase",
      "purchase",
      "quantity",
    ]
  );

  addScore(
    "attendance",
    [
      "attendance",
      "present",
      "absent",
      "check in",
      "check out",
      "in time",
      "out time",
      "working hours",
      "employee name",
      "employee",
      "employees",
      "employee code",
      "employee id",
      "leaves available",
      "total leaves",
      "total lop",
      "total half days",
      "total present days",
      "travelling days",
      "traveling days",
      "wfh days",
      "name",
    ]
  );

  addScore(
    "documents",
    [
      "document",
      "document id",
      "document name",
      "document category",
      "document status",
      "expiry date",
      "renewal required",
      "confidentiality",
      "storage location",
      "last reviewed date",
    ]
  );

  addScore(
    "visitors",
    [
      "visitor",
      "visitor id",
      "visitor name",
      "visit date",
      "visit status",
      "visitor pass",
      "check in",
      "check out",
      "approval status",
      "expected time",
      "visit type",
    ]
  );

  addScore(
    "events",
    [
      "event",
      "event id",
      "event name",
      "event type",
      "event date",
      "event status",
      "expected attendees",
      "setup deadline",
      "actual cost",
      "event owner",
    ]
  );

  addScore(
    "renewals",
    [
      "renewal",
      "renewal id",
      "renewal due date",
      "service amc",
      "frequency",
      "days to due",
      "auto renew",
      "subscription",
      "amc",
      "due soon",
      "overdue",
    ]
  );

  addScore(
    "expenses",
    [
      "expense",
      "expenses",
      "amount",
      "vendor",
      "invoice",
      "bill",
      "payment",
      "reimbursement",
      "category",
      "gst",
      "flight",
      "hotel",
      "snacks",
      "medicine",
      "internet",
      "stationary",
      "stationery",
      "furniture",
      "fixture",
    ]
  );

  const ranked =
    Object.entries(
      score
    ).sort(
      (a, b) =>
        b[1] - a[1]
    );

  const [
    bestType,
    bestScore,
  ] =
    ranked[0];

  const secondScore =
    ranked[1]?.[1] || 0;

  if (
    bestScore < 2 ||
    bestScore ===
      secondScore
  ) {
    return "Unknown";
  }

  if (
    bestType ===
    "inventory"
  ) {
    return "Inventory";
  }

  if (
    bestType ===
    "attendance"
  ) {
    return "Attendance";
  }

  if (
    bestType ===
    "expenses"
  ) {
    return "Expenses";
  }

  if (
    bestType ===
    "renewals"
  ) {
    return "Renewals";
  }

  if (
    bestType ===
    "events"
  ) {
    return "Events";
  }

  if (
    bestType ===
    "visitors"
  ) {
    return "Visitors";
  }

  if (
    bestType ===
    "documents"
  ) {
    return "Documents";
  }

  return "Unknown";
}

function questionWorkbookType(question) {
  const q = String(question || "").toLowerCase();

  if ([
    "document", "documents", "passport", "passports",
    "expiry", "expired", "expire soon", "expiring soon",
    "renewal required", "confidentiality", "doc-"
  ].some((word) => q.includes(word))) return "Documents";

  if ([
    "visitor", "visitors", "visited", "visit", "checked in",
    "check in", "check out", "visitor pass", "host",
    "approval status", "expected visitor", "expected visitors"
  ].some((word) => q.includes(word))) return "Visitors";

  // Explicit vendor wording must win before broader expense/detail routing.
  if ([
    "vendor", "vendors", "supplier", "suppliers"
  ].some((word) => q.includes(word))) return "Vendors";

  if ([
    "event", "events", "upcoming", "completed", "cancelled",
    "canceled", "event budget", "event cost", "attendees",
    "setup deadline"
  ].some((word) => q.includes(word))) return "Events";

  if ([
    "renewal", "renewals", "renew", "amc", "subscription",
    "subscriptions", "due soon", "overdue", "auto renew",
    "days to due"
  ].some((word) => q.includes(word))) return "Renewals";

  if ([
    "stock", "inventory", "assigned", "allocated", "used by",
    "unassigned", "unused", "not being used",
    "laptop", "mobile", "printer", "hdmi", "electronics", "asset"
  ].some((word) => q.includes(word))) return "Inventory";

  if ([
  "attendance", "present", "absent", "leave",
  "week off", "weekoff", "w/off", "w off", "on time", "ontime",
  "check in", "check out", "working hours", "work hours",
  "hours worked", "worked", "most hours", "work time", "late",
  "earliest", "latest", "employee code", "employee id",
  "leaves available", "leave balance", "half day", "half days",
  "wfh", "work from home", "travelling days", "traveling days",
  "lop"
].some((word) => q.includes(word))) return "Attendance";

  if ([
    "expense", "invoice", "bill", "payment", "reimbursement",
    "vendor", "gst"
  ].some((word) => q.includes(word))) return "Expenses";

  return null;
}


function normalizeAttendanceMatrix(matrix) {
  if (
    !Array.isArray(matrix) ||
    matrix.length < 4
  ) {
    return null;
  }

  const title =
    String(
      matrix[0]?.[0] || ""
    ).toLowerCase();

  const headerName =
    String(
      matrix[1]?.[0] || ""
    ).toLowerCase();

  if (
    !title.includes("attendance register") &&
    headerName !== "name" &&
    headerName !== "employee" &&
    headerName !== "employees" &&
    headerName !== "employee name"
  ) {
    return null;
  }

  const dayRow =
    matrix[1] || [];

  const typeRow =
    matrix[2] || [];

  const normalizedRows = [];

  for (
    let rowIndex = 3;
    rowIndex < matrix.length;
    rowIndex += 1
  ) {
    const sourceRow =
      matrix[rowIndex] || [];

    const name =
      String(
        sourceRow[0] || ""
      ).trim();

    if (!name) {
      continue;
    }

    /*
     * Preserve both legacy Name and the richer Employees field.
     * More importantly, preserve non-day summary columns such as
     * Employee Code, Leaves Available, Total Leaves, LOP, Half Days,
     * Present Days, Travelling Days and WFH Days.
     */
    const record = {
      Name: name,
      Employees: name,
    };

    for (
      let col = 1;
      col < dayRow.length;
      col += 1
    ) {
      const rawHeader =
        dayRow[col];

      if (
        rawHeader === "" ||
        rawHeader === null ||
        rawHeader === undefined
      ) {
        continue;
      }

      let numericDay =
        Number(rawHeader);

      if (
        !Number.isFinite(
          numericDay
        )
      ) {
        const headerText =
          String(
            rawHeader ?? ""
          ).trim();

        const dmyMatch =
          headerText.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](?:\d{2}|\d{4})$/
          );

        const isoMatch =
          headerText.match(
            /^(?:\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/
          );

        const monthNameFirstMatch =
          headerText.match(
            /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})/i
          );

        const dayFirstMonthNameMatch =
          headerText.match(
            /^(\d{1,2})\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)/i
          );

        if (dmyMatch) {
          numericDay =
            Number(
              dmyMatch[1]
            );
        } else if (isoMatch) {
          numericDay =
            Number(
              isoMatch[2]
            );
        } else if (monthNameFirstMatch) {
          numericDay =
            Number(
              monthNameFirstMatch[1]
            );
        } else if (dayFirstMonthNameMatch) {
          numericDay =
            Number(
              dayFirstMonthNameMatch[1]
            );
        }
      }

      if (
        Number.isFinite(
          numericDay
        ) &&
        numericDay >= 1 &&
        numericDay <= 31
      ) {
        const day =
          Math.trunc(
            numericDay
          );

        const firstType =
          String(
            typeRow[col] || "In"
          ).trim();

        const firstValue =
          sourceRow[col] ?? "";

        record[
          `${day} ${firstType}`
        ] = firstValue;

        const nextDay =
          dayRow[col + 1];

        if (
          (nextDay === "" ||
            nextDay === null ||
            nextDay === undefined) &&
          col + 1 <
            sourceRow.length
        ) {
          const secondType =
            String(
              typeRow[col + 1] ||
                "Out"
            ).trim();

          record[
            `${day} ${secondType}`
          ] =
            sourceRow[
              col + 1
            ] ?? "";
        }

        continue;
      }

      /*
       * Non-numeric headers are employee summary fields.
       * Keep their exact workbook labels so the Employee + Leave
       * engine can read them later.
       */
      const summaryHeader =
        String(
          rawHeader
        ).trim();

      if (summaryHeader) {
        record[
          summaryHeader
        ] =
          sourceRow[col] ?? "";
      }
    }

    normalizedRows.push(
      record
    );
  }

  return normalizedRows;
}

function attendanceValuesForDay(
  row,
  day
) {
  const prefix =
    `${day} `;

  const monthDayPattern =
    new RegExp(
      `^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|sept(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\s+${day}$`,
      "i"
    );

  return Object.entries(
    row || {}
  )
    .filter(
      ([key]) => {
        const text =
          String(
            key
          ).trim();

        return (
          text.startsWith(
            prefix
          ) ||
          monthDayPattern.test(
            text
          )
        );
      }
    )
    .map(
      ([key, value]) => ({
        key,
        value:
          String(
            value ?? ""
          ).trim(),
      })
    );
}


function attendanceDayState(
  row,
  day
) {
  const cells =
    attendanceValuesForDay(
      row,
      day
    );

  const values =
    cells
      .map(
        (cell) =>
          cell.value
            .trim()
            .toUpperCase()
      )
      .filter(Boolean);

  if (!values.length) {
    return "no-data";
  }

  if (
    values.every(
      (value) =>
        value === "A" ||
        value === "ABSENT"
    )
  ) {
    return "absent";
  }

  if (
    values.some(
      (value) =>
        value === "L" ||
        value === "LEAVE"
    )
  ) {
    return "leave";
  }

  if (
    values.every(
      (value) =>
        value === "W" ||
        value === "OFF" ||
        value === "WEEK OFF" ||
        value === "WEEKOFF"
    )
  ) {
    return "weekoff";
  }

  if (
    values.some(
      (value) =>
        value === "P" ||
        value === "PRESENT" ||
        value === "WORK FROM HOME" ||
        value === "WFH" ||
        value === "HALF DAY"
    )
  ) {
    return "present";
  }

  if (
    values.some(
      (value) =>
        value !== "-" &&
        value !== "A" &&
        value !== "L" &&
        value !== "W" &&
        value !== "OFF"
    )
  ) {
    return "present";
  }

  return "no-data";
}


function attendanceClockMinutes(
  value,
  context = "arrival"
) {
  const textValue =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    !textValue ||
    textValue === "-" ||
    textValue === "a" ||
    textValue === "l" ||
    textValue === "w" ||
    textValue === "off" ||
    textValue === "w/off"
  ) {
    return null;
  }

  const match =
    textValue.match(
      /^(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?\s*(am|pm)?$/
    );

  if (!match) {
    return null;
  }

  let hour =
    Number(match[1]);

  const minute =
    Number(match[2] || 0);

  const meridiem =
    match[4] || "";

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  if (meridiem) {
    if (
      hour < 1 ||
      hour > 12
    ) {
      return null;
    }

    if (
      meridiem === "pm" &&
      hour !== 12
    ) {
      hour += 12;
    }

    if (
      meridiem === "am" &&
      hour === 12
    ) {
      hour = 0;
    }
  } else {
    /*
     * Attendance workbook times often omit AM/PM.
     *
     * ARRIVAL / IN:
     *   7:45  -> 7:45 AM
     *   10:05 -> 10:05 AM
     *   12:50 -> 12:50 PM
     *   2:10  -> 2:10 PM
     *
     * This office-oriented normalization treats bare 1:00–5:59
     * arrival times as afternoon. Bare 6:00–11:59 remain morning.
     *
     * SETTINGS / explicit 24-hour values such as 19:00 are preserved.
     */
    if (
      hour < 0 ||
      hour > 23
    ) {
      return null;
    }

    if (
      context === "arrival" &&
      hour >= 1 &&
      hour <= 5
    ) {
      hour += 12;
    }
  }

  return (
    hour * 60 +
    minute
  );
}

function formatAttendanceClock(minutesValue) {
  if (
    !Number.isFinite(
      minutesValue
    )
  ) {
    return "";
  }

  const normalized =
    ((Math.round(minutesValue) % 1440) + 1440) %
    1440;

  let hour24 =
    Math.floor(
      normalized / 60
    );

  const minute =
    normalized % 60;

  const meridiem =
    hour24 >= 12
      ? "PM"
      : "AM";

  let hour12 =
    hour24 % 12;

  if (hour12 === 0) {
    hour12 = 12;
  }

  return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`;
}


function AI() {
  const fileInputRef =
    useRef(null);

  const [message, setMessage] =
    useState("");

  const [messages, setMessages] =
    useState(() => {
      try {
        const saved =
          localStorage.getItem(
            "mr-d-ai-chat-history"
          );

        if (saved) {
          const parsed =
            JSON.parse(saved);

          if (
            Array.isArray(parsed) &&
            parsed.length
          ) {
            return parsed;
          }
        }
      } catch (error) {
        console.error(
          "Unable to load Mr.D chat history:",
          error
        );
      }

      return [
        {
          role: "assistant",
          source: "system",

          text:
            "Hi Daya 👋 I’m Mr.D. Upload an Excel or CSV file and I can inspect its sheets, columns and data.",
        },
      ];
    });

  const [isAiLoading, setIsAiLoading] =
    useState(false);

  const [fileName, setFileName] =
    useState("");

  const [workbookData, setWorkbookData] =
    useState({});

  const [sheetNames, setSheetNames] =
    useState([]);

  const [selectedSheet, setSelectedSheet] =
    useState("");

  const [columns, setColumns] =
    useState([]);

  const [rows, setRows] =
    useState([]);

  const [fileLoading, setFileLoading] =
    useState(false);

  const [fileError, setFileError] =
    useState("");

  const [
    workbookRestoring,
    setWorkbookRestoring,
  ] =
    useState(true);


  const [
    attendanceSettings,
    setAttendanceSettings,
  ] =
    useState({
      office_start_time:
        "10:00",

      office_end_time:
        "19:00",

      grace_period_minutes:
        15,

      full_day_minutes:
        480,

      half_day_minutes:
        240,

      saturday_off:
        true,

      sunday_off:
        true,
    });

  const [
    attendanceSettingsReady,
    setAttendanceSettingsReady,
  ] =
    useState(false);

  const [
    attendanceSettingsError,
    setAttendanceSettingsError,
  ] =
    useState("");


  // ---------------------------------------------------------
  // LOAD ATTENDANCE SETTINGS
  // Uses the same Supabase attendance_settings table as Attendance.
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled =
      false;

    async function loadAiAttendanceSettings() {
      try {
        setAttendanceSettingsError(
          ""
        );

        const {
          data,
          error,
        } =
          await supabase
            .from(
              "attendance_settings"
            )
            .select(`
              office_start_time,
              office_end_time,
              grace_period_minutes,
              full_day_minutes,
              half_day_minutes,
              saturday_off,
              sunday_off
            `)
            .order(
              "id",
              {
                ascending:
                  true,
              }
            )
            .limit(1)
            .maybeSingle();

        if (cancelled) {
          return;
        }

        if (error) {
          console.error(
            "AI attendance settings load error:",
            error
          );

          setAttendanceSettingsError(
            "Unable to load Attendance Settings."
          );

          setAttendanceSettingsReady(
            false
          );

          return;
        }

        if (data) {
          setAttendanceSettings({
            office_start_time:
              data
                .office_start_time
                ?.slice(0, 5) ||
              "10:00",

            office_end_time:
              data
                .office_end_time
                ?.slice(0, 5) ||
              "19:00",

            grace_period_minutes:
              Number(
                data
                  .grace_period_minutes ??
                  15
              ),

            full_day_minutes:
              Number(
                data
                  .full_day_minutes ??
                  480
              ),

            half_day_minutes:
              Number(
                data
                  .half_day_minutes ??
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
          });
        }

        setAttendanceSettingsReady(
          true
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error(
          "AI attendance settings load error:",
          error
        );

        setAttendanceSettingsError(
          "Unable to load Attendance Settings."
        );

        setAttendanceSettingsReady(
          false
        );
      }
    }

    loadAiAttendanceSettings();

    return () => {
      cancelled =
        true;
    };
  }, []);


  // ---------------------------------------------------------
  // RESTORE WORKBOOK FROM THIS BROWSER
  // ---------------------------------------------------------

  useEffect(() => {
    let cancelled =
      false;

    async function restoreWorkbook() {
      try {
        const cached =
          await loadWorkbookCache();

        /*
         * Version 1 cached the attendance workbook before
         * the real attendance parser existed. That stale
         * structure looks like:
         *
         * "ATTENDANCE REGISTER — MAY 2026", "__EMPTY", ...
         *
         * Never restore that old structure. Clear it once
         * and require one fresh upload so the workbook is
         * parsed with the new attendance matrix parser.
         */
        if (
          cached &&
          cached.cacheVersion !==
            MRD_WORKBOOK_CACHE_VERSION
        ) {
          await clearWorkbookCache();

          if (!cancelled) {
            setWorkbookRestoring(
              false
            );
          }

          return;
        }

        if (
          cancelled ||
          !cached ||
          !cached.workbookData ||
          !Array.isArray(
            cached.sheetNames
          ) ||
          !cached.sheetNames.length
        ) {
          return;
        }

        const restoredSheet =
          cached.selectedSheet &&
          cached.sheetNames.includes(
            cached.selectedSheet
          )
            ? cached.selectedSheet
            : cached.sheetNames[0];

        setFileName(
          cached.fileName || "Saved workbook"
        );

        setWorkbookData(
          cached.workbookData
        );

        setSheetNames(
          cached.sheetNames
        );

        setSelectedSheet(
          restoredSheet
        );

        loadSheetData(
          cached.workbookData,
          restoredSheet
        );
      } catch (error) {
        console.error(
          "Unable to restore Mr.D workbook:",
          error
        );
      } finally {
        if (!cancelled) {
          setWorkbookRestoring(
            false
          );
        }
      }
    }

    restoreWorkbook();

    return () => {
      cancelled =
        true;
    };
  }, []);


  const workbookType =
    detectWorkbookType(
      workbookData
    );

  const displayFileName =
    cleanDisplayFileName(
      fileName
    );


  // ---------------------------------------------------------
  // SAVE CHAT HISTORY
  // ---------------------------------------------------------

  useEffect(() => {
    try {
      localStorage.setItem(
        "mr-d-ai-chat-history",
        JSON.stringify(
          messages.slice(-60)
        )
      );
    } catch (error) {
      console.error(
        "Unable to save Mr.D chat history:",
        error
      );
    }
  }, [messages]);


  function clearChatHistory() {
    const starterMessage = {
      role: "assistant",
      source: "system",

      text:
        "Hi Daya 👋 I’m Mr.D. Upload an Excel or CSV file and I can inspect its sheets, columns and data.",
    };

    setMessages([
      starterMessage,
    ]);

    try {
      localStorage.removeItem(
        "mr-d-ai-chat-history"
      );
    } catch (error) {
      console.error(
        "Unable to clear Mr.D chat history:",
        error
      );
    }
  }


  // ---------------------------------------------------------
  // OPEN FILE PICKER
  // ---------------------------------------------------------

  function openExcelPicker() {
    fileInputRef.current?.click();
  }


  function changeWorkbook() {
    fileInputRef.current?.click();
  }


  // ---------------------------------------------------------
  // READ EXCEL / CSV
  // ---------------------------------------------------------

  async function handleFileChange(e) {
    const file =
      e.target.files?.[0];

    if (!file) {
      return;
    }


    setFileLoading(true);
    setFileError("");

    setFileName("");
    setWorkbookData({});
    setSheetNames([]);
    setSelectedSheet("");
    setColumns([]);
    setRows([]);


    try {
      const extension =
        file.name
          .split(".")
          .pop()
          ?.toLowerCase();


      if (
        ![
          "xlsx",
          "xls",
          "csv",
        ].includes(extension)
      ) {
        throw new Error(
          "Please select an Excel (.xlsx/.xls) or CSV file."
        );
      }


      const buffer =
        await file.arrayBuffer();


      const workbook =
        XLSX.read(
          buffer,
          {
            type: "array",

            cellDates: true,
          }
        );


      if (
        !workbook.SheetNames
          ?.length
      ) {
        throw new Error(
          "No sheets were found in this file."
        );
      }


      const parsedWorkbook = {};


      workbook.SheetNames.forEach(
        (sheetName) => {
          const worksheet =
            workbook.Sheets[
              sheetName
            ];


          /*
           * Read one raw matrix as well as the display-formatted matrix.
           *
           * Important for the GISB employee workbook:
           * Excel date headers use a display format like "mmmm d",
           * which hides the year when raw:false is used.
           * The raw Date object still contains the real year/month.
           */
          const rawMatrixRows =
            XLSX.utils.sheet_to_json(
              worksheet,
              {
                header: 1,
                defval: "",
                raw: true,
              }
            );

          const matrixRows =
            XLSX.utils.sheet_to_json(
              worksheet,
              {
                header: 1,

                defval: "",

                raw: false,

                dateNF:
                  "dd-mm-yyyy",
              }
            );

          const firstRawDate =
            rawMatrixRows
              .slice(0, 3)
              .flat()
              .find(
                (value) =>
                  value instanceof Date &&
                  !Number.isNaN(
                    value.getTime()
                  )
              );

          const headerTextForPeriod =
            rawMatrixRows
              .slice(0, 3)
              .flat()
              .map(
                (value) =>
                  String(value ?? "")
              )
              .join(" ");

          const headerYearMatch =
            headerTextForPeriod.match(
              /\b(20\d{2})\b/
            );

          const detectedSheetYear =
            firstRawDate
              ? firstRawDate.getFullYear()
              : headerYearMatch
                ? Number(
                    headerYearMatch[1]
                  )
                : null;

          const detectedSheetMonth =
            firstRawDate
              ? firstRawDate.getMonth() + 1
              : null;

          const attendanceRows =
            normalizeAttendanceMatrix(
              matrixRows
            );

          const baseJsonRows =
            attendanceRows ||
            XLSX.utils.sheet_to_json(
              worksheet,
              {
                defval: "",

                raw: false,

                dateNF:
                  "dd-mm-yyyy",
              }
            );

          /*
           * Persist lightweight period metadata with every parsed row.
           * This survives IndexedDB caching and lets Mr.D distinguish
           * August 2023 from Aug 2025 without guessing from sheet order.
           */
          const jsonRows =
            (baseJsonRows || []).map(
              (row) =>
                row &&
                typeof row === "object"
                  ? {
                      ...row,
                      __MRD_PERIOD_YEAR:
                        detectedSheetYear ?? "",
                      __MRD_PERIOD_MONTH:
                        detectedSheetMonth ?? "",
                    }
                  : row
            );


          parsedWorkbook[
            sheetName
          ] = jsonRows;
        }
      );


      const firstSheet =
        workbook.SheetNames[0];


      setFileName(
        file.name
      );

      setWorkbookData(
        parsedWorkbook
      );

      setSheetNames(
        workbook.SheetNames
      );

      setSelectedSheet(
        firstSheet
      );


      loadSheetData(
        parsedWorkbook,
        firstSheet
      );


      try {
        await saveWorkbookCache({
          cacheVersion:
            MRD_WORKBOOK_CACHE_VERSION,

          fileName:
            file.name,

          workbookData:
            parsedWorkbook,

          sheetNames:
            workbook.SheetNames,

          selectedSheet:
            firstSheet,

          savedAt:
            Date.now(),
        });
      } catch (cacheError) {
        console.error(
          "Unable to save workbook for this browser:",
          cacheError
        );
      }


      setMessages(
        (current) => [
          ...current,

          {
            role:
              "assistant",
            source:
              "system",

            text:
              `✅ File loaded: ${file.name}. I found ${workbook.SheetNames.length} sheet${workbook.SheetNames.length === 1 ? "" : "s"}: ${workbook.SheetNames.join(", ")}.`,
          },
        ]
      );

    } catch (error) {
      console.error(
        "Excel read error:",
        error
      );

      setFileError(
        error?.message ||
          "Unable to read this file."
      );

    } finally {
      setFileLoading(
        false
      );

      /*
       * Allows choosing the same
       * file again later.
       */
      e.target.value =
        "";
    }
  }


  // ---------------------------------------------------------
  // LOAD SELECTED SHEET
  // ---------------------------------------------------------

  function loadSheetData(
    workbook,
    sheetName
  ) {
    const sheetRows =
      workbook[
        sheetName
      ] || [];


    setRows(
      sheetRows
    );


    const detectedColumns =
      [];


    sheetRows.forEach(
      (row) => {
        Object.keys(
          row || {}
        ).forEach(
          (column) => {
            if (
              !detectedColumns.includes(
                column
              )
            ) {
              detectedColumns.push(
                column
              );
            }
          }
        );
      }
    );


    setColumns(
      detectedColumns
    );
  }


  // ---------------------------------------------------------
  // CHANGE SHEET
  // ---------------------------------------------------------

  function handleSheetChange(
    e
  ) {
    const sheetName =
      e.target.value;


    setSelectedSheet(
      sheetName
    );


    loadSheetData(
      workbookData,
      sheetName
    );


    saveWorkbookCache({
      cacheVersion:
        MRD_WORKBOOK_CACHE_VERSION,

      fileName,

      workbookData,

      sheetNames,

      selectedSheet:
        sheetName,

      savedAt:
        Date.now(),
    }).catch(
      (error) => {
        console.error(
          "Unable to save selected sheet:",
          error
        );
      }
    );


    setMessages(
      (current) => [
        ...current,

        {
          role:
            "assistant",
          source:
            "system",

          text:
            `Switched to sheet "${sheetName}".`,
        },
      ]
    );
  }



  // ---------------------------------------------------------
  // SPREADSHEET ANALYSIS
  // ---------------------------------------------------------

  function normalizeText(value) {
    return String(value ?? "")
      .toLowerCase()
      .trim();
  }

  function numberFromValue(value) {
    if (value === null || value === undefined || value === "") return null;
    const cleaned = String(value).replace(/,/g, "").replace(/[₹$£€]/g, "").trim();
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : null;
  }

  function getQuestionKeywords(question) {
    const stopWords = new Set([
      "how","many","much","do","does","we","have","has","the","a","an","is","are","in","our","of","please","tell","me","show","find","what","which","can","you","all","total","available","current","stock","quantity","qty","there"
    ]);
    return normalizeText(question)
      .replace(/[^\w\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !stopWords.has(word))
      .map((word) => {
        if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
        if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
        return word;
      });
  }

  function rowSearchText(row) {
    return Object.values(row || {}).map(normalizeText).join(" " );
  }

  function rowMatchesKeywords(row, keywords) {
    if (!keywords.length) return true;
    const text = rowSearchText(row);
    return keywords.every((keyword) => text.includes(keyword));
  }

  function findColumnByNames(row, names) {
    const keys = Object.keys(row || {});
    for (const name of names) {
      const exact = keys.find((key) => normalizeText(key) === name);
      if (exact) return exact;
    }
    for (const key of keys) {
      const normalized = normalizeText(key);
      const partial = names.find((name) => normalized.includes(name));
      if (partial) return key;
    }
    return null;
  }

  function findQuantityColumn(row) {
  return findColumnByNames(row, [
    "stock in hand",
    "current stock",
    "available stock",
    "stock available",
    "available quantity",
    "available qty",
    "balance stock",
    "balance quantity",
    "balance qty",
    "quantity",
    "qty",
    "unit",
    "units",
  ]);
}

  function findItemColumn(row) {
    return findColumnByNames(row, [
      "material","item","item name","product","product name","description","asset","asset name","particular","particulars"
    ]);
  }

  function findUsedByColumn(row) {
    return findColumnByNames(row, ["used by","assigned to","issued to","user","employee","holder"]);
  }

  function getItemName(row, fallback = "Item") {
    const column = findItemColumn(row);
    return column ? String(row[column] ?? fallback) : fallback;
  }

  function getAllWorkbookRows() {
    const allRows = [];
    Object.entries(workbookData).forEach(([sheetName, sheetRows]) => {
      (sheetRows || []).forEach((row, rowIndex) => {
        allRows.push({ sheetName, rowIndex: rowIndex + 2, row });
      });
    });
    return allRows;
  }

  function formatMatchLine(match) {
    const values = Object.entries(match.row || {})
      .filter(([, value]) => value !== "" && value !== null && value !== undefined)
      .slice(0, 7)
      .map(([key, value]) => `${key}: ${value}`)
      .join(" | " );
    return `${match.sheetName} → ${values}`;
  }
function getRelevantSpreadsheetData(question) {
  const normalizedQuestion =
    normalizeText(question);

  const keywords =
    getQuestionKeywords(question);

  const relevantData = {};

  // ---------------------------------------------------------
  // 1. USER EXPLICITLY MENTIONS A SHEET
  // ---------------------------------------------------------

  sheetNames.forEach((sheetName) => {
    if (
      normalizedQuestion.includes(
        normalizeText(sheetName)
      )
    ) {
      relevantData[sheetName] =
        (workbookData[sheetName] || [])
          .slice(0, 30);
    }
  });

  if (
    Object.keys(relevantData).length
  ) {
    return relevantData;
  }


  // ---------------------------------------------------------
  // 2. DETECT QUESTION INTENT
  // ---------------------------------------------------------

  const asksPurchase =
    normalizedQuestion.includes("purchase") ||
    normalizedQuestion.includes("purchased") ||
    normalizedQuestion.includes("buy") ||
    normalizedQuestion.includes("bought");

  const asksCurrentStock =
    normalizedQuestion.includes("current stock") ||
    normalizedQuestion.includes("stock in hand") ||
    normalizedQuestion.includes("available stock") ||
    normalizedQuestion.includes("currently have") ||
    normalizedQuestion.includes("currently available") ||
    normalizedQuestion.includes("in stock");

  const asksAssignment =
    normalizedQuestion.includes("used by") ||
    normalizedQuestion.includes("using") ||
    normalizedQuestion.includes("assigned") ||
    normalizedQuestion.includes("issued");


  // ---------------------------------------------------------
  // 3. PRIORITIZE SHEETS BASED ON INTENT
  // ---------------------------------------------------------

  let candidateSheets =
    Object.entries(workbookData);


  if (asksPurchase) {
    const purchaseSheets =
      candidateSheets.filter(
        ([sheetName]) => {
          const name =
            normalizeText(sheetName);

          return (
            name.includes("purchase") ||
            name.includes("purchased") ||
            name.includes("procurement")
          );
        }
      );

    if (purchaseSheets.length) {
      candidateSheets =
        purchaseSheets;
    }
  }

  else if (asksCurrentStock) {
    const inventorySheets =
      candidateSheets.filter(
        ([sheetName]) => {
          const name =
            normalizeText(sheetName);

          return (
            name.includes("electronic") ||
            name.includes("inventory") ||
            name.includes("stock")
          );
        }
      );

    if (inventorySheets.length) {
      candidateSheets =
        inventorySheets;
    }
  }

  else if (asksAssignment) {
    const assignmentSheets =
      candidateSheets.filter(
        ([sheetName]) => {
          const name =
            normalizeText(sheetName);

          return (
            name.includes("electronic") ||
            name.includes("inventory") ||
            name.includes("asset")
          );
        }
      );

    if (assignmentSheets.length) {
      candidateSheets =
        assignmentSheets;
    }
  }


  // ---------------------------------------------------------
  // 4. FIND MATCHING ROWS
  // ---------------------------------------------------------

  const intentWords =
    new Set([
      "purchase",
      "purchased",
      "buy",
      "bought",
      "currently",
      "using",
      "used",
      "assigned",
      "issued",
      "did",
      "sheet",
      "use",
      "who",
      "zero",
      "out",
    ]);

  const itemKeywords =
    keywords.filter(
      (keyword) =>
        !intentWords.has(keyword)
    );

  const searchKeywords =
    itemKeywords.length
      ? itemKeywords
      : keywords;

  candidateSheets.forEach(
    ([sheetName, sheetRows]) => {

      const matchingRows =
        (sheetRows || []).filter(
          (row) => {
            const text =
              rowSearchText(row);

            return searchKeywords.some(
              (keyword) =>
                text.includes(keyword)
            );
          }
        );


      if (matchingRows.length) {
        relevantData[sheetName] =
          matchingRows.slice(0, 30);
      }
    }
  );


  // ---------------------------------------------------------
  // 5. IF AN INTENT SHEET WAS FOUND BUT ROW MATCHING FAILED,
  //    SEND A SMALL SAMPLE OF THAT SHEET ONLY
  // ---------------------------------------------------------

  if (
    !Object.keys(relevantData).length &&
    candidateSheets.length <
      Object.keys(workbookData).length
  ) {
    candidateSheets.forEach(
      ([sheetName, sheetRows]) => {
        relevantData[sheetName] =
          (sheetRows || []).slice(0, 20);
      }
    );

    return relevantData;
  }


  // ---------------------------------------------------------
  // 6. FINAL FALLBACK
  // ---------------------------------------------------------

  if (
    !Object.keys(relevantData).length
  ) {
    Object.entries(workbookData).forEach(
      ([sheetName, sheetRows]) => {
        relevantData[sheetName] =
          (sheetRows || []).slice(0, 3);
      }
    );
  }


  return relevantData;
}


function looksLikeSpreadsheetQuestion(question) {
  if (
    !sheetNames.length ||
    !Object.keys(workbookData).length
  ) {
    return false;
  }

  const normalizedQuestion =
    normalizeText(question);

  const spreadsheetWords = [
    "stock",
    "inventory",
    "purchase",
    "purchased",
    "buy",
    "bought",
    "sheet",
    "row",
    "column",
    "assigned",
    "issued",
    "used by",
    "using",
    "zero stock",
    "out of stock",
    "how many",
    "quantity",
    "available",
    "summary",
    "difference",
    "differences",
    "conflict",
    "conflicts",
  ];

  if (
    spreadsheetWords.some(
      (word) =>
        normalizedQuestion.includes(word)
    )
  ) {
    return true;
  }

  return sheetNames.some(
    (sheetName) =>
      normalizedQuestion.includes(
        normalizeText(sheetName)
      )
  );
}



function findAttendanceEmployeeColumn(row) {
  return findColumnByNames(row, [
    "employee name",
    "employee",
    "staff name",
    "staff",
    "name",
    "user name",
    "user",
  ]);
}


function findAttendanceDateColumn(row) {
  return findColumnByNames(row, [
    "attendance date",
    "date",
    "day",
  ]);
}


function findAttendanceStatusColumn(row) {
  return findColumnByNames(row, [
    "attendance status",
    "status",
    "attendance",
    "present/absent",
  ]);
}


function findAttendanceInColumn(row) {
  return findColumnByNames(row, [
    "check in",
    "check-in",
    "in time",
    "time in",
    "login time",
    "punch in",
  ]);
}


function findAttendanceOutColumn(row) {
  return findColumnByNames(row, [
    "check out",
    "check-out",
    "out time",
    "time out",
    "logout time",
    "punch out",
  ]);
}


function findAttendanceHoursColumn(row) {
  return findColumnByNames(row, [
    "working hours",
    "work hours",
    "hours worked",
    "total hours",
    "worked hours",
    "duration",
  ]);
}


function attendanceStatusKind(value) {
  const status =
    normalizeText(value);

  if (!status) {
    return null;
  }

  if (
    status === "a" ||
    status === "absent" ||
    status.includes("absent")
  ) {
    return "absent";
  }

  if (
    status === "p" ||
    status === "present" ||
    status.includes("present")
  ) {
    return "present";
  }

  if (
    status === "l" ||
    status === "late" ||
    status.includes("late")
  ) {
    return "late";
  }

  if (
    status.includes("leave")
  ) {
    return "leave";
  }

  if (
    status.includes("wfh") ||
    status.includes("work from home")
  ) {
    return "wfh";
  }

  return null;
}


function monthNameFromDate(date) {
  return date.toLocaleString(
    "en-US",
    {
      month: "long",
    }
  );
}


function attendanceSheetEntries(question) {
  const q =
    normalizeText(question);

  const months = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
  ];

  const explicitMonth =
    months.find(
      (month) =>
        q.includes(month)
    );

  if (explicitMonth) {
    const matching =
      Object.entries(
        workbookData
      ).filter(
        ([sheetName]) =>
          normalizeText(
            sheetName
          ).includes(
            explicitMonth
          )
      );

    if (matching.length) {
      return matching;
    }
  }

  if (
    q.includes("today")
  ) {
    const currentMonth =
      normalizeText(
        monthNameFromDate(
          new Date()
        )
      );

    const matching =
      Object.entries(
        workbookData
      ).filter(
        ([sheetName]) =>
          normalizeText(
            sheetName
          ).includes(
            currentMonth
          )
      );

    if (matching.length) {
      return matching;
    }
  }

  if (
    selectedSheet &&
    workbookData[
      selectedSheet
    ]
  ) {
    return [
      [
        selectedSheet,
        workbookData[
          selectedSheet
        ],
      ],
    ];
  }

  return Object.entries(
    workbookData
  );
}


function dateCellMatchesToday(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  const today =
    new Date();

  const text =
    String(value).trim();

  const parsed =
    new Date(text);

  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {
    return (
      parsed.getFullYear() ===
        today.getFullYear() &&
      parsed.getMonth() ===
        today.getMonth() &&
      parsed.getDate() ===
        today.getDate()
    );
  }

  const dayOnly =
    Number(text);

  return (
    Number.isFinite(dayOnly) &&
    dayOnly ===
      today.getDate()
  );
}


function attendanceDateColumnForToday(row) {
  const today =
    new Date();

  const keys =
    Object.keys(
      row || {}
    );

  for (const key of keys) {
    const normalized =
      normalizeText(key);

    const dayOnly =
      Number(
        normalized
      );

    if (
      Number.isFinite(dayOnly) &&
      dayOnly >= 1 &&
      dayOnly <= 31 &&
      dayOnly ===
        today.getDate()
    ) {
      return key;
    }

    const parsed =
      new Date(key);

    if (
      !Number.isNaN(
        parsed.getTime()
      ) &&
      parsed.getMonth() ===
        today.getMonth() &&
      parsed.getDate() ===
        today.getDate()
    ) {
      return key;
    }
  }

  return null;
}


function attendanceMatrixDateColumns(row) {
  return Object.keys(
    row || {}
  ).filter(
    (key) => {
      const text =
        String(key).trim();

      const dayOnly =
        Number(text);

      if (
        Number.isFinite(dayOnly) &&
        dayOnly >= 1 &&
        dayOnly <= 31
      ) {
        return true;
      }

      const parsed =
        new Date(text);

      return !Number.isNaN(
        parsed.getTime()
      );
    }
  );
}


function tryLocalAttendanceAnswer(question) {
  if (
    workbookType !==
    "Attendance"
  ) {
    return null;
  }

  const q =
    normalizeText(question);

  /*
   * REAL MR.D ATTENDANCE FORMAT:
   * Name in column A, day numbers across row 2,
   * and In/Out (or W) across row 3.
   *
   * Attendance questions are handled locally.
   * They must never fall through to paid AI.
   */
  const realFormatIntent =
    q.includes("attendance") ||
    q.includes("absent") ||
    q.includes("present") ||
    q.includes("leave") ||
    q.includes("week off") ||
    q.includes("weekoff") ||
    q.includes("w/off") ||
    q.includes("w off") ||
    q.includes("late") ||
    q.includes("on time") ||
    q.includes("ontime") ||
    q.includes("consistent") ||
    q.includes("consistency") ||
    q.includes("earliest") ||
    q.includes("latest") ||
    q.includes("working hours") ||
    q.includes("work hours") ||
    q.includes("hours worked") ||
    q.includes("worked") ||
    q.includes("most hours") ||
    q.includes("work time") ||
    q.includes("check in") ||
    q.includes("check out") ||
    q.includes("employee") ||
    q.includes("employees") ||
    q.includes("leave balance") ||
    q.includes("leaves available") ||
    q.includes("available leave") ||
    q.includes("half day") ||
    q.includes("half days") ||
    q.includes("wfh") ||
    q.includes("work from home") ||
    q.includes("travelling days") ||
    q.includes("traveling days") ||
    q.includes("lop");

  if (realFormatIntent) {
    /*
     * =========================================================
     * EMPLOYEE + LEAVE INTELLIGENCE — LOCAL, $0 API — V1
     * =========================================================
     *
     * Supports the richer GISB attendance workbook where newer
     * sheets contain summary columns such as:
     * Employee Code, Leaves Available, Total Leaves, Total LOP,
     * Total Half Days, Total Present Days, Travelling Days, WFH Days.
     *
     * This block intentionally runs BEFORE the older month-sheet
     * attendance router so questions such as "leaves available"
     * are not swallowed by the legacy attendance logic.
     */

    const employeeSummaryColumn = (
      row,
      aliases
    ) => {
      const keys =
        Object.keys(row || {});

      return keys.find(
        (key) => {
          const normalizedKey =
            normalizeText(key);

          return aliases.some(
            (alias) =>
              normalizedKey ===
              normalizeText(alias)
          );
        }
      );
    };

    const employeeSummaryName = (row) => {
      const nameKey =
        employeeSummaryColumn(
          row,
          [
            "Name",
            "Employee Name",
            "Employee",
            "Employees",
          ]
        );

      return nameKey
        ? String(
            row[nameKey] ?? ""
          ).trim()
        : "";
    };

    const employeeSummaryValue = (
      row,
      aliases
    ) => {
      const key =
        employeeSummaryColumn(
          row,
          aliases
        );

      if (!key) {
        return "";
      }

      return String(
        row[key] ?? ""
      ).trim();
    };

    const employeeSummaryRecords =
      Object.entries(
        workbookData || {}
      ).flatMap(
        ([sheetName, rows], sheetIndex) =>
          (
            Array.isArray(rows)
              ? rows
              : []
          )
            .map(
              (row, rowIndex) => {
                const name =
                  employeeSummaryName(
                    row
                  );

                if (!name) {
                  return null;
                }

                const employeeCode =
                  employeeSummaryValue(
                    row,
                    [
                      "Employee Code",
                      "Emp Code",
                      "Employee ID",
                      "Emp ID",
                    ]
                  );

                const leavesAvailable =
                  employeeSummaryValue(
                    row,
                    [
                      "Leaves Available",
                      "Leave Available",
                      "Available Leaves",
                      "Leave Balance",
                    ]
                  );

                const totalLeaves =
                  employeeSummaryValue(
                    row,
                    [
                      "Total Leaves",
                      "Total Leave",
                      "Leaves Taken",
                      "Leave Taken",
                    ]
                  );

                const totalLop =
                  employeeSummaryValue(
                    row,
                    [
                      "Total LOP",
                      "LOP",
                      "Loss of Pay",
                    ]
                  );

                const totalHalfDays =
                  employeeSummaryValue(
                    row,
                    [
                      "Total Half Days",
                      "Total Half Day",
                      "Half Days",
                      "Half Day",
                    ]
                  );

                const totalPresentDays =
                  employeeSummaryValue(
                    row,
                    [
                      "Total Present Days",
                      "Total Present",
                      "Present Days",
                    ]
                  );

                const travellingDays =
                  employeeSummaryValue(
                    row,
                    [
                      "Travelling Days",
                      "Traveling Days",
                      "Travel Days",
                    ]
                  );

                const wfhDays =
                  employeeSummaryValue(
                    row,
                    [
                      "WFH Days",
                      "Work From Home Days",
                      "Work from Home Days",
                    ]
                  );

                const hasSummaryData =
                  [
                    employeeCode,
                    leavesAvailable,
                    totalLeaves,
                    totalLop,
                    totalHalfDays,
                    totalPresentDays,
                    travellingDays,
                    wfhDays,
                  ].some(
                    (value) =>
                      value !== ""
                  );

                if (!hasSummaryData) {
                  return null;
                }

                return {
                  name,
                  employeeCode,
                  leavesAvailable,
                  totalLeaves,
                  totalLop,
                  totalHalfDays,
                  totalPresentDays,
                  travellingDays,
                  wfhDays,
                  sheetName,
                  sheetIndex,
                  rowIndex,
                  periodYear:
                    numberFromValue(
                      row.__MRD_PERIOD_YEAR
                    ),
                  periodMonth:
                    numberFromValue(
                      row.__MRD_PERIOD_MONTH
                    ),
                };
              }
            )
            .filter(Boolean)
      );

    /*
     * ---------------------------------------------------------
     * MONTH / YEAR INTELLIGENCE FOR EMPLOYEE LEAVE
     * ---------------------------------------------------------
     *
     * Sheet names alone are not enough because this workbook
     * contains repeated month names across years. We therefore
     * inspect the sheet name AND row keys/values for year/date
     * evidence, while never inventing a year when none is found.
     */
    const monthAliases = {
      january: ["january", "jan"],
      february: ["february", "feb"],
      march: ["march", "mar"],
      april: ["april", "apr"],
      may: ["may"],
      june: ["june", "jun"],
      july: ["july", "jul"],
      august: ["august", "aug"],
      september: ["september", "sep", "sept"],
      october: ["october", "oct"],
      november: ["november", "nov"],
      december: ["december", "dec"],
    };

    const canonicalMonthFromText =
      (value) => {
        const normalized =
          normalizeText(value);

        return (
          Object.entries(
            monthAliases
          ).find(
            ([, aliases]) =>
              aliases.some(
                (alias) =>
                  normalized === alias ||
                  normalized.includes(
                    ` ${alias} `
                  ) ||
                  normalized.startsWith(
                    `${alias} `
                  ) ||
                  normalized.endsWith(
                    ` ${alias}`
                  )
              )
          )?.[0] || null
        );
      };

    const questionTokens =
      normalizeText(q)
        .split(/\s+/)
        .filter(Boolean);

    const requestedMonth =
      Object.entries(
        monthAliases
      ).find(
        ([, aliases]) =>
          aliases.some(
            (alias) =>
              questionTokens.includes(
                alias
              )
          )
      )?.[0] || null;

    const requestedYearMatch =
      q.match(
        /\b(20\d{2})\b/
      );

    const requestedYear =
      requestedYearMatch
        ? Number(
            requestedYearMatch[1]
          )
        : null;

    const extractYearEvidence =
      (record) => {
        if (
          hasGisbMixedAttendanceSignature &&
          gisBPeriodFallback[
            record.sheetName
          ]
        ) {
          return gisBPeriodFallback[
            record.sheetName
          ].year;
        }

        if (
          Number.isFinite(
            record.periodYear
          )
        ) {
          return record.periodYear;
        }

        const candidates = [
          record.sheetName,
        ];

        const sheetRows =
          workbookData[
            record.sheetName
          ] || [];

        const row =
          sheetRows[
            record.rowIndex
          ] || {};

        Object.entries(
          row
        ).forEach(
          ([key, value]) => {
            candidates.push(key);
            candidates.push(value);
          }
        );

        for (
          const candidate of candidates
        ) {
          const raw =
            String(
              candidate ?? ""
            );

          const directYear =
            raw.match(
              /\b(20\d{2})\b/
            );

          if (directYear) {
            return Number(
              directYear[1]
            );
          }
        }

        return null;
      };

    const monthNumberToName = {
      1: "january",
      2: "february",
      3: "march",
      4: "april",
      5: "may",
      6: "june",
      7: "july",
      8: "august",
      9: "september",
      10: "october",
      11: "november",
      12: "december",
    };

    const hasGisbMixedAttendanceSignature =
      [
        "August",
        "September",
        "October",
        "November",
        "December",
        "Summary",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
      ].every(
        (sheetName) =>
          Object.prototype.hasOwnProperty.call(
            workbookData || {},
            sheetName
          )
      );

    const gisBPeriodFallback = {
      August: {
        month: "august",
        year: 2023,
      },
      September: {
        month: "september",
        year: 2023,
      },
      October: {
        month: "october",
        year: 2023,
      },
      November: {
        month: "november",
        year: 2023,
      },
      December: {
        month: "december",
        year: 2023,
      },
      Jan: {
        month: "january",
        year: 2025,
      },
      Feb: {
        month: "february",
        year: 2025,
      },
      Mar: {
        month: "march",
        year: 2025,
      },
      Apr: {
        month: "april",
        year: 2025,
      },
      May: {
        month: "may",
        year: 2025,
      },
      Jun: {
        month: "june",
        year: 2025,
      },
      Jul: {
        month: "july",
        year: 2025,
      },
      Aug: {
        month: "august",
        year: 2025,
      },
    };

    const recordMonth =
      (record) => {
        if (
          hasGisbMixedAttendanceSignature &&
          gisBPeriodFallback[
            record.sheetName
          ]
        ) {
          return gisBPeriodFallback[
            record.sheetName
          ].month;
        }

        if (
          Number.isFinite(
            record.periodMonth
          ) &&
          monthNumberToName[
            record.periodMonth
          ]
        ) {
          return monthNumberToName[
            record.periodMonth
          ];
        }

        return canonicalMonthFromText(
          record.sheetName
        );
      };

    const recordsMatchingPeriod =
      (
        records,
        month,
        year
      ) =>
        records.filter(
          (record) => {
            if (
              month &&
              recordMonth(record) !==
                month
            ) {
              return false;
            }

            if (year) {
              const evidenceYear =
                extractYearEvidence(
                  record
                );

              if (
                evidenceYear !== year
              ) {
                return false;
              }
            }

            return true;
          }
        );

    const periodLabel = (
      month,
      year
    ) => {
      const monthLabel =
        month
          ? month.charAt(0).toUpperCase() +
            month.slice(1)
          : "";

      return [
        monthLabel,
        year || "",
      ]
        .filter(Boolean)
        .join(" ");
    };

    const employeeSummaryNames =
      [
        ...new Set(
          employeeSummaryRecords.map(
            (item) =>
              item.name
          )
        ),
      ];

    const mentionedSummaryEmployee =
      employeeSummaryNames.find(
        (employee) =>
          q.includes(
            normalizeText(employee)
          )
      ) ||
      (() => {
        const matches =
          employeeSummaryNames.filter(
            (employee) => {
              const first =
                normalizeText(
                  employee
                ).split(/\s+/)[0];

              return (
                first.length >= 3 &&
                q.includes(first)
              );
            }
          );

        return matches.length === 1
          ? matches[0]
          : null;
      })();

    const recordsForSummaryEmployeeBase =
      mentionedSummaryEmployee
        ? employeeSummaryRecords
            .filter(
              (item) =>
                item.name ===
                mentionedSummaryEmployee
            )
            .sort(
              (a, b) =>
                a.sheetIndex -
                  b.sheetIndex ||
                a.rowIndex -
                  b.rowIndex
            )
        : [];

    const recordsForSummaryEmployee =
      (
        requestedMonth ||
        requestedYear
      )
        ? recordsMatchingPeriod(
            recordsForSummaryEmployeeBase,
            requestedMonth,
            requestedYear
          )
        : recordsForSummaryEmployeeBase;

    /*
     * For explicit month/year questions, records are already
     * filtered using period metadata captured from real Excel Date
     * headers. For questions without a requested period, the last
     * non-blank value in workbook sheet order remains the fallback.
     */
    const latestSummaryField = (
      records,
      field
    ) => {
      const usable =
        records.filter(
          (item) =>
            String(
              item[field] ?? ""
            ).trim() !== ""
        );

      return usable.length
        ? usable[
            usable.length - 1
          ]
        : null;
    };

    const explicitEmployeePeriodRequested =
      Boolean(
        mentionedSummaryEmployee &&
        (
          requestedMonth ||
          requestedYear
        )
      );

    if (
      explicitEmployeePeriodRequested &&
      recordsForSummaryEmployee.length === 0 &&
      (
        q.includes("leave") ||
        q.includes("wfh") ||
        q.includes("half day") ||
        q.includes("employee code")
      )
    ) {
      return [
        `I could not find a matching ${periodLabel(requestedMonth, requestedYear)} employee record for ${mentionedSummaryEmployee}.`,
        "",
        "I did not substitute a different month or year.",
        "No paid API was used.",
      ].join("\n");
    }

    /*
     * COMPARE ONE EMPLOYEE'S LEAVE BALANCE BETWEEN TWO MONTHS
     * Example: Compare Dayanand's leave balance in July and August 2025.
     */
    const asksLeaveBalanceComparison =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      q.includes("compare") &&
      q.includes("leave") &&
      q.includes("balance");

    if (asksLeaveBalanceComparison) {
      const mentionedMonths =
        Object.entries(
          monthAliases
        )
          .filter(
            ([, aliases]) =>
              aliases.some(
                (alias) =>
                  questionTokens.includes(
                    alias
                  )
              )
          )
          .map(
            ([month]) =>
              month
          );

      if (
        mentionedMonths.length < 2
      ) {
        return [
          "Please include two months to compare the employee leave balance.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const comparisonYear =
        requestedYear;

      const results =
        mentionedMonths
          .slice(0, 2)
          .map(
            (month) => {
              const matching =
                recordsMatchingPeriod(
                  recordsForSummaryEmployeeBase,
                  month,
                  comparisonYear
                );

              const record =
                latestSummaryField(
                  matching,
                  "leavesAvailable"
                );

              return {
                month,
                record,
              };
            }
          );

      return [
        `${mentionedSummaryEmployee} — Leave balance comparison`,
        "",
        ...results.map(
          ({ month, record }) =>
            record
              ? `${periodLabel(month, comparisonYear)}: ${record.leavesAvailable} — Source: ${record.sheetName}`
              : `${periodLabel(month, comparisonYear)}: No matching record found`
        ),
        "",
        "No other month/year was substituted for missing data.",
      ].join("\n");
    }

    const asksPeriodNegativeLeaveBalance =
      (
        q.includes(
          "negative leave balance"
        ) ||
        q.includes(
          "negative leaves"
        )
      ) &&
      Boolean(
        requestedMonth ||
        requestedYear
      );

    if (asksPeriodNegativeLeaveBalance) {
      const periodRecords =
        recordsMatchingPeriod(
          employeeSummaryRecords,
          requestedMonth,
          requestedYear
        );

      const latestByEmployee =
        [
          ...new Set(
            periodRecords.map(
              (item) =>
                item.name
            )
          ),
        ]
          .map(
            (name) =>
              latestSummaryField(
                periodRecords.filter(
                  (item) =>
                    item.name ===
                    name
                ),
                "leavesAvailable"
              )
          )
          .filter(Boolean)
          .map(
            (record) => ({
              ...record,
              numericBalance:
                numberFromValue(
                  record.leavesAvailable
                ),
            })
          )
          .filter(
            (record) =>
              record.numericBalance !==
                null &&
              record.numericBalance < 0
          );

      if (!latestByEmployee.length) {
        return [
          `No employees have a negative recorded leave balance in ${periodLabel(requestedMonth, requestedYear)}.`,
          "",
          "No other month/year was substituted.",
        ].join("\n");
      }

      return [
        `Employees with negative leave balance in ${periodLabel(requestedMonth, requestedYear)}: ${latestByEmployee.length}`,
        "",
        ...latestByEmployee.map(
          (item) =>
            `${item.name}: ${item.leavesAvailable} — ${item.sheetName}`
        ),
      ].join("\n");
    }

    const asksPeriodLeaveBalances =
      (
        q.includes(
          "show leave balances"
        ) ||
        q.includes(
          "show employee leave balances"
        ) ||
        q.includes(
          "show all leave balances"
        ) ||
        q.includes(
          "list leave balances"
        )
      ) &&
      Boolean(
        requestedMonth ||
        requestedYear
      );

    if (asksPeriodLeaveBalances) {
      const periodRecords =
        recordsMatchingPeriod(
          employeeSummaryRecords,
          requestedMonth,
          requestedYear
        );

      const balances =
        [
          ...new Set(
            periodRecords.map(
              (item) =>
                item.name
            )
          ),
        ]
          .map(
            (name) =>
              latestSummaryField(
                periodRecords.filter(
                  (item) =>
                    item.name ===
                    name
                ),
                "leavesAvailable"
              )
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          );

      if (!balances.length) {
        return [
          `I could not find recorded employee leave balances for ${periodLabel(requestedMonth, requestedYear)}.`,
          "",
          "No other month/year was substituted.",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `Employee leave balances — ${periodLabel(requestedMonth, requestedYear)}: ${balances.length}`,
        "",
        ...balances.map(
          (item) =>
            `${item.name}: ${item.leavesAvailable} — ${item.sheetName}`
        ),
      ].join("\n");
    }

    const asksEmployeeCode =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      (
        q.includes("employee code") ||
        q.includes("emp code") ||
        q.includes("employee id") ||
        q.includes("emp id")
      );

    if (asksEmployeeCode) {
      const record =
        latestSummaryField(
          recordsForSummaryEmployee,
          "employeeCode"
        );

      if (!record) {
        return [
          `I could not find an employee code for ${mentionedSummaryEmployee}.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `${mentionedSummaryEmployee} — Employee Code: ${record.employeeCode}`,
        "",
        `Source: ${record.sheetName}`,
      ].join("\n");
    }

    const asksLeavesAvailable =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      !q.includes("compare") &&
      (
        q.includes("leaves available") ||
        q.includes("leave available") ||
        q.includes("available leaves") ||
        q.includes("available leave") ||
        q.includes("leave balance") ||
        (
          q.includes("leave") &&
          q.includes("available")
        ) ||
        (
          q.includes("leaves") &&
          q.includes("available")
        )
      );

    if (asksLeavesAvailable) {
      const record =
        latestSummaryField(
          recordsForSummaryEmployee,
          "leavesAvailable"
        );

      if (!record) {
        return [
          `I could not find a recorded leave balance for ${mentionedSummaryEmployee}.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `${mentionedSummaryEmployee} — Leaves available: ${record.leavesAvailable}`,
        "",
        `Source: ${record.sheetName}`,
      ].join("\n");
    }

    const asksEmployeeTotalLeaves =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      !asksLeavesAvailable &&
      !q.includes("available") &&
      !q.includes("balance") &&
      (
        q.includes("how many leaves") ||
        q.includes("total leaves") ||
        q.includes("leaves did") ||
        q.includes("leave did")
      );

    if (asksEmployeeTotalLeaves) {
      const record =
        latestSummaryField(
          recordsForSummaryEmployee,
          "totalLeaves"
        );

      if (!record) {
        return [
          `I could not find a recorded Total Leaves value for ${mentionedSummaryEmployee}.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `${mentionedSummaryEmployee} — Total leaves: ${record.totalLeaves}`,
        "",
        `Source: ${record.sheetName}`,
      ].join("\n");
    }

    const asksEmployeeHalfDays =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      (
        q.includes("half day") ||
        q.includes("half days")
      );

    if (asksEmployeeHalfDays) {
      const record =
        latestSummaryField(
          recordsForSummaryEmployee,
          "totalHalfDays"
        );

      if (!record) {
        return [
          `I could not find a recorded Half Days value for ${mentionedSummaryEmployee}.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `${mentionedSummaryEmployee} — Total half days: ${record.totalHalfDays}`,
        "",
        `Source: ${record.sheetName}`,
      ].join("\n");
    }

    const asksEmployeeWfh =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      (
        q.includes("wfh") ||
        q.includes("work from home")
      );

    if (asksEmployeeWfh) {
      const record =
        latestSummaryField(
          recordsForSummaryEmployee,
          "wfhDays"
        );

      if (!record) {
        return [
          `I could not find a recorded WFH Days value for ${mentionedSummaryEmployee}.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `${mentionedSummaryEmployee} — WFH days: ${record.wfhDays}`,
        "",
        `Source: ${record.sheetName}`,
      ].join("\n");
    }

    const asksEmployeeLeaveSummary =
      Boolean(
        mentionedSummaryEmployee
      ) &&
      q.includes("leave") &&
      q.includes("summary");

    if (asksEmployeeLeaveSummary) {
      const fields = [
        [
          "Leaves available",
          "leavesAvailable",
        ],
        [
          "Total leaves",
          "totalLeaves",
        ],
        [
          "Total LOP",
          "totalLop",
        ],
        [
          "Total half days",
          "totalHalfDays",
        ],
        [
          "Total present days",
          "totalPresentDays",
        ],
        [
          "Travelling days",
          "travellingDays",
        ],
        [
          "WFH days",
          "wfhDays",
        ],
      ];

      const lines = [];
      const sources = [];

      fields.forEach(
        ([label, field]) => {
          const record =
            latestSummaryField(
              recordsForSummaryEmployee,
              field
            );

          if (!record) {
            return;
          }

          lines.push(
            `${label}: ${record[field]}`
          );

          sources.push(
            record.sheetName
          );
        }
      );

      if (!lines.length) {
        return [
          `I could not find leave-summary fields for ${mentionedSummaryEmployee}.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `${mentionedSummaryEmployee} — Leave summary`,
        "",
        ...lines,
        "",
        `Source: ${[
          ...new Set(sources),
        ].join(", ")}`,
      ].join("\n");
    }

    const asksMostLeavesAvailable =
      q.includes(
        "most leaves available"
      ) ||
      q.includes(
        "highest leave balance"
      );

    if (asksMostLeavesAvailable) {
      const latestByEmployee =
        employeeSummaryNames
          .map(
            (name) => {
              const records =
                employeeSummaryRecords
                  .filter(
                    (item) =>
                      item.name ===
                      name
                  )
                  .sort(
                    (a, b) =>
                      a.sheetIndex -
                        b.sheetIndex ||
                      a.rowIndex -
                        b.rowIndex
                  );

              return latestSummaryField(
                records,
                "leavesAvailable"
              );
            }
          )
          .filter(Boolean)
          .map(
            (record) => ({
              ...record,
              numericBalance:
                numberFromValue(
                  record.leavesAvailable
                ),
            })
          )
          .filter(
            (record) =>
              record.numericBalance !==
              null
          );

      if (!latestByEmployee.length) {
        return [
          "I could not find numeric leave balances in the workbook.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const highest =
        Math.max(
          ...latestByEmployee.map(
            (item) =>
              item.numericBalance
          )
        );

      const leaders =
        latestByEmployee.filter(
          (item) =>
            item.numericBalance ===
            highest
        );

      return [
        `Highest recorded leave balance: ${highest}`,
        "",
        ...leaders.map(
          (item) =>
            `${item.name}: ${item.leavesAvailable} — ${item.sheetName}`
        ),
        "",
        leaders.length > 1
          ? "Tie shown instead of guessed."
          : "Latest non-blank balance in workbook sheet order is used for each employee.",
      ].join("\n");
    }

    const asksNegativeLeaveBalance =
      !requestedMonth &&
      !requestedYear &&
      (
        q.includes(
          "negative leave balance"
        ) ||
        q.includes(
          "negative leaves"
        )
      );

    if (asksNegativeLeaveBalance) {
      const negative =
        employeeSummaryNames
          .map(
            (name) => {
              const records =
                employeeSummaryRecords
                  .filter(
                    (item) =>
                      item.name ===
                      name
                  )
                  .sort(
                    (a, b) =>
                      a.sheetIndex -
                        b.sheetIndex ||
                      a.rowIndex -
                        b.rowIndex
                  );

              return latestSummaryField(
                records,
                "leavesAvailable"
              );
            }
          )
          .filter(Boolean)
          .map(
            (record) => ({
              ...record,
              numericBalance:
                numberFromValue(
                  record.leavesAvailable
                ),
            })
          )
          .filter(
            (record) =>
              record.numericBalance !==
                null &&
              record.numericBalance < 0
          );

      if (!negative.length) {
        return [
          "No employees have a negative recorded leave balance.",
          "",
          "Latest non-blank balance in workbook sheet order is used for each employee.",
        ].join("\n");
      }

      return [
        `Employees with negative leave balance: ${negative.length}`,
        "",
        ...negative.map(
          (item) =>
            `${item.name}: ${item.leavesAvailable} — ${item.sheetName}`
        ),
      ].join("\n");
    }

    const asksAllLeaveBalances =
      !requestedMonth &&
      !requestedYear &&
      (
        q.includes(
          "show employee leave balances"
        ) ||
        q.includes(
          "show all leave balances"
        ) ||
        q.includes(
          "list leave balances"
        )
      );

    if (asksAllLeaveBalances) {
      const balances =
        employeeSummaryNames
          .map(
            (name) => {
              const records =
                employeeSummaryRecords
                  .filter(
                    (item) =>
                      item.name ===
                      name
                  )
                  .sort(
                    (a, b) =>
                      a.sheetIndex -
                        b.sheetIndex ||
                      a.rowIndex -
                        b.rowIndex
                  );

              return latestSummaryField(
                records,
                "leavesAvailable"
              );
            }
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          );

      if (!balances.length) {
        return [
          "I could not find recorded employee leave balances.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `Employee leave balances: ${balances.length}`,
        "",
        ...balances.map(
          (item) =>
            `${item.name}: ${item.leavesAvailable} — ${item.sheetName}`
        ),
        "",
        "Latest non-blank balance in workbook sheet order is used for each employee.",
      ].join("\n");
    }

    const today =
      new Date();

    const day =
      today.getDate();

    const monthName =
      today.toLocaleString(
        "en-US",
        {
          month:
            "long",
        }
      );

    const namedMonth =
      [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ].find(
        (month) =>
          q.includes(
            month.toLowerCase()
          )
      );

    const targetMonth =
      namedMonth ||
      (q.includes("today")
        ? monthName
        : selectedSheet);

    const attendanceMonthAliases = {
      January: "Jan",
      February: "Feb",
      March: "Mar",
      April: "Apr",
      May: "May",
      June: "Jun",
      July: "Jul",
      August: "Aug",
      September: "Sep",
      October: "Oct",
      November: "Nov",
      December: "Dec",
    };

    const targetSheetName =
      Object.prototype.hasOwnProperty.call(
        workbookData,
        targetMonth
      )
        ? targetMonth
        : attendanceMonthAliases[
            targetMonth
          ] &&
          Object.prototype.hasOwnProperty.call(
            workbookData,
            attendanceMonthAliases[
              targetMonth
            ]
          )
          ? attendanceMonthAliases[
              targetMonth
            ]
          : targetMonth;

    const targetRows =
      workbookData[
        targetSheetName
      ];

    if (
      !Array.isArray(
        targetRows
      )
    ) {
      return {
        text:
          `I could not find the ${targetMonth || "requested"} attendance sheet in the active workbook. No paid API was used.`,

        action:
          "change-workbook",
      };
    }

    /*
     * EMPLOYEE DIRECTORY FROM ATTENDANCE — LOCAL, $0 API
     *
     * This is not an HR master. "Employee" means a unique Name
     * present in the attendance workbook. For count/list questions
     * without a month, use all attendance sheets so the answer is
     * not dependent on whichever month happens to be selected.
     */
    const asksEmployeeCount =
      !q.includes("active employee") &&
      !q.includes("active employees") &&
      (
        q.includes("how many employees") ||
        q.includes("employee count") ||
        q.includes("number of employees")
      );

    const asksEmployeeList =
      q.includes("show me all employees") ||
      q.includes("show all employees") ||
      q.includes("list all employees");

    if (asksEmployeeCount || asksEmployeeList) {
      const explicitMonthForEmployees =
        Boolean(namedMonth);

      const employeeRows =
        explicitMonthForEmployees
          ? [[targetMonth, targetRows]]
          : Object.entries(workbookData);

      const employeeNames =
        [
          ...new Set(
            employeeRows.flatMap(
              ([, rows]) =>
                (Array.isArray(rows) ? rows : [])
                  .map(
                    (row) =>
                      String(
                        row.Name ?? row.Employees ?? ""
                      ).trim()
                  )
                  .filter(Boolean)
            )
          ),
        ].sort(
          (a, b) =>
            a.localeCompare(b)
        );

      const employeeSource =
        explicitMonthForEmployees
          ? targetMonth
          : employeeRows
              .map(([name]) => name)
              .join(", ");

      if (asksEmployeeCount) {
        return [
          `Employees in attendance records: ${employeeNames.length}`,
          "",
          explicitMonthForEmployees
            ? `Unique employee names recorded in ${targetMonth}.`
            : "Unique employee names across the loaded attendance workbook.",
          "This is an attendance-based employee count, not an HR master headcount.",
          "",
          `Source: ${employeeSource}`,
        ].join("\n");
      }

      return [
        `Employees in attendance records: ${employeeNames.length}`,
        "",
        ...employeeNames,
        "",
        "This list comes from employee names recorded in attendance, not an HR master.",
        "",
        `Source: ${employeeSource}`,
      ].join("\n");
    }

    /*
     * Match a named employee safely.
     * Full name wins; otherwise a unique first-name match is allowed.
     * Example: "Dayanand" can match "Dayanand Birajdar" only if unique.
     */
    const attendanceEmployees =
      [
        ...new Set(
          targetRows
            .map(
              (row) =>
                String(
                  row.Name ?? row.Employees ?? ""
                ).trim()
            )
            .filter(Boolean)
        ),
      ];

    const mentionedAttendanceEmployee =
      attendanceEmployees.find(
        (employee) =>
          q.includes(
            normalizeText(employee)
          )
      ) ||
      (() => {
        const firstNameMatches =
          attendanceEmployees.filter(
            (employee) => {
              const first =
                normalizeText(employee)
                  .split(/\s+/)[0];

              return (
                first.length >= 3 &&
                q.includes(first)
              );
            }
          );

        return firstNameMatches.length === 1
          ? firstNameMatches[0]
          : null;
      })();

    /*
     * INDIVIDUAL LEAVE DAYS
     */
    const asksIndividualLeaveDays =
      Boolean(
        mentionedAttendanceEmployee
      ) &&
      q.includes("leave") &&
      (
        q.includes("how many") ||
        q.includes("leave days") ||
        q.includes("days of leave")
      );

    if (asksIndividualLeaveDays) {
      const row =
        targetRows.find(
          (item) =>
            String(
              item.Name ?? item.Employees ?? ""
            ).trim() ===
            mentionedAttendanceEmployee
        );

      let leaveDays = 0;

      if (row) {
        for (
          let attendanceDay = 1;
          attendanceDay <= 31;
          attendanceDay += 1
        ) {
          if (
            attendanceDayState(
              row,
              attendanceDay
            ) === "leave"
          ) {
            leaveDays += 1;
          }
        }
      }

      return [
        `${mentionedAttendanceEmployee} — Leave days in ${targetMonth}: ${leaveDays}`,
        "",
        "Only days explicitly marked L are counted as Leave.",
        "Absent, Week Off, blank and '-' are excluded.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * MOST LEAVE DAYS
     */
    const asksMostLeaveDays =
      q.includes("most leave") ||
      q.includes("highest leave") ||
      q.includes("maximum leave") ||
      q.includes("max leave");

    if (asksMostLeaveDays) {
      const leaveResults =
        targetRows
          .map(
            (row) => {
              const employee =
                String(
                  row.Name ?? ""
                ).trim();

              if (!employee) {
                return null;
              }

              let leaveDays = 0;

              for (
                let attendanceDay = 1;
                attendanceDay <= 31;
                attendanceDay += 1
              ) {
                if (
                  attendanceDayState(
                    row,
                    attendanceDay
                  ) === "leave"
                ) {
                  leaveDays += 1;
                }
              }

              return {
                employee,
                leaveDays,
              };
            }
          )
          .filter(Boolean);

      const maxLeave =
        leaveResults.length
          ? Math.max(
              ...leaveResults.map(
                (item) =>
                  item.leaveDays
              )
            )
          : 0;

      const leaders =
        leaveResults.filter(
          (item) =>
            item.leaveDays ===
              maxLeave &&
            maxLeave > 0
        );

      if (!leaders.length) {
        return [
          `No employees have confirmed leave days in ${targetMonth}.`,
          "",
          "Only days explicitly marked L are counted as Leave.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      return [
        `Most leave days in ${targetMonth}: ${maxLeave}`,
        "",
        ...leaders.map(
          (item) =>
            `${item.employee}: ${item.leaveDays} day${item.leaveDays === 1 ? "" : "s"}`
        ),
        "",
        leaders.length > 1
          ? "Tie shown instead of guessed."
          : "Only days explicitly marked L are counted as Leave.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * INDIVIDUAL MONTHLY ATTENDANCE
     */
    const asksIndividualAttendance =
      Boolean(
        mentionedAttendanceEmployee
      ) &&
      !q.includes("summary") &&
      !(
        q.includes("from") &&
        q.includes("to")
      ) &&
      (
        q.includes("show") ||
        q.includes("attendance for") ||
        q.includes("attendance of")
      ) &&
      q.includes("attendance");

    if (asksIndividualAttendance) {
      const row =
        targetRows.find(
          (item) =>
            String(
              item.Name ?? item.Employees ?? ""
            ).trim() ===
            mentionedAttendanceEmployee
        );

      if (!row) {
        return [
          `I could not find ${mentionedAttendanceEmployee} in ${targetMonth}.`,
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      let present = 0;
      let absent = 0;
      let leave = 0;
      let weekOff = 0;
      let noData = 0;
      const dayLines = [];

      for (
        let attendanceDay = 1;
        attendanceDay <= 31;
        attendanceDay += 1
      ) {
        const state =
          attendanceDayState(
            row,
            attendanceDay
          );

        if (state === "no-data") {
          noData += 1;
          continue;
        }

        if (state === "present") {
          present += 1;
        } else if (state === "absent") {
          absent += 1;
        } else if (state === "leave") {
          leave += 1;
        } else if (state === "weekoff") {
          weekOff += 1;
        }

        const inValue =
          String(
            row[
              `${attendanceDay} In`
            ] ?? ""
          ).trim();

        const outValue =
          String(
            row[
              `${attendanceDay} Out`
            ] ?? ""
          ).trim();

        const detail =
          state === "present"
            ? [
                inValue
                  ? `In: ${inValue}`
                  : "",
                outValue
                  ? `Out: ${outValue}`
                  : "",
              ]
                .filter(Boolean)
                .join(" | ")
            : state === "absent"
            ? "Absent"
            : state === "leave"
            ? "Leave"
            : state === "weekoff"
            ? "Week Off"
            : state;

        dayLines.push(
          `${attendanceDay} ${targetMonth}: ${detail || state}`
        );
      }

      return [
        `${mentionedAttendanceEmployee} — Attendance for ${targetMonth}`,
        "",
        `Present: ${present} | Absent: ${absent} | Leave: ${leave} | Week Off: ${weekOff}`,
        "",
        ...dayLines,
        "",
        `Blank/no-data days: ${noData}`,
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * =========================================================
     * EMPLOYEE / ATTENDANCE INSIGHTS — LOCAL, $0 API — V2
     * =========================================================
     */

    const summarizeAttendanceRow =
      (row) => {
        let present = 0;
        let absent = 0;
        let leave = 0;
        let weekOff = 0;
        let noData = 0;

        for (
          let attendanceDay = 1;
          attendanceDay <= 31;
          attendanceDay += 1
        ) {
          const state =
            attendanceDayState(
              row,
              attendanceDay
            );

          if (state === "present") {
            present += 1;
          } else if (state === "absent") {
            absent += 1;
          } else if (state === "leave") {
            leave += 1;
          } else if (state === "weekoff") {
            weekOff += 1;
          } else {
            noData += 1;
          }
        }

        const attendanceDays =
          present + absent;

        const attendanceRate =
          attendanceDays > 0
            ? (present / attendanceDays) * 100
            : null;

        return {
          present,
          absent,
          leave,
          weekOff,
          noData,
          attendanceDays,
          attendanceRate,
        };
      };

    /*
     * WHO TOOK LEAVE
     */
    const asksWhoTookLeave =
      (
        q.includes("who took leave") ||
        q.includes("who was on leave") ||
        q.includes("employees on leave")
      ) &&
      !q.includes("today");

    if (asksWhoTookLeave) {
      const leavePeople =
        targetRows
          .map(
            (row) => {
              const name =
                String(
                  row.Name ?? ""
                ).trim();

              if (!name) {
                return null;
              }

              const summary =
                summarizeAttendanceRow(
                  row
                );

              return summary.leave > 0
                ? {
                    name,
                    leave:
                      summary.leave,
                  }
                : null;
            }
          )
          .filter(Boolean);

      if (!leavePeople.length) {
        return [
          `No employees have confirmed leave days in ${targetMonth}.`,
          "",
          "Only days explicitly marked L are counted as Leave.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      return [
        `Employees who took leave in ${targetMonth}: ${leavePeople.length}`,
        "",
        ...leavePeople.map(
          (item) =>
            `${item.name}: ${item.leave} day${item.leave === 1 ? "" : "s"}`
        ),
        "",
        "Only days explicitly marked L are counted as Leave.",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * ACTIVE EMPLOYEES IN A MONTH
     *
     * Active = at least one recorded Present, Absent, Leave or Week Off
     * status in that month. Completely blank/no-data rows are excluded.
     */
    const asksActiveEmployees =
      (
        q.includes("how many employees were active") ||
        q.includes("how many active employees") ||
        q.includes("active employees")
      );

    if (asksActiveEmployees) {
      const active =
        targetRows
          .map(
            (row) => {
              const name =
                String(
                  row.Name ?? ""
                ).trim();

              if (!name) {
                return null;
              }

              const summary =
                summarizeAttendanceRow(
                  row
                );

              const recorded =
                summary.present +
                summary.absent +
                summary.leave +
                summary.weekOff;

              return recorded > 0
                ? name
                : null;
            }
          )
          .filter(Boolean);

      return [
        `Active employees in ${targetMonth}: ${active.length}`,
        "",
        ...active,
        "",
        "Active means at least one recorded attendance status in the month.",
        "Completely blank/no-data employee rows are excluded.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * BEST / LOWEST ATTENDANCE
     *
     * Rank by recorded Present days for the selected month.
     * This avoids the misleading 100% problem when a workbook has
     * no explicit A (Absent) marks. Leave remains separate.
     * Exact ties are shown instead of guessed.
     */
    const asksBestAttendance =
      q.includes("best attendance") ||
      q.includes("highest attendance");

    const asksLowestAttendance =
      q.includes("lowest attendance") ||
      q.includes("worst attendance");

    if (
      asksBestAttendance ||
      asksLowestAttendance
    ) {
      const ranked =
        targetRows
          .map(
            (row) => {
              const name =
                String(
                  row.Name ?? ""
                ).trim();

              if (!name) {
                return null;
              }

              const summary =
                summarizeAttendanceRow(
                  row
                );

              const recorded =
                summary.present +
                summary.absent +
                summary.leave +
                summary.weekOff;

              if (recorded <= 0) {
                return null;
              }

              return {
                name,
                ...summary,
              };
            }
          )
          .filter(Boolean);

      if (!ranked.length) {
        return [
          `No comparable attendance records were found in ${targetMonth}.`,
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      const targetPresent =
        asksBestAttendance
          ? Math.max(
              ...ranked.map(
                (item) =>
                  item.present
              )
            )
          : Math.min(
              ...ranked.map(
                (item) =>
                  item.present
              )
            );

      const leaders =
        ranked.filter(
          (item) =>
            item.present ===
            targetPresent
        );

      return [
        asksBestAttendance
          ? `Best recorded attendance in ${targetMonth}:`
          : `Lowest recorded attendance in ${targetMonth}:`,
        "",
        ...leaders.map(
          (item) =>
            `${item.name} — Present: ${item.present} | Absent: ${item.absent} | Leave: ${item.leave} | Week Off: ${item.weekOff}`
        ),
        "",
        "Ranking is based on recorded Present days in the selected month.",
        "Leave, Week Off and blank/no-data days are not counted as Present.",
        leaders.length > 1
          ? "Tie shown instead of guessed."
          : "No attendance percentage is inferred from blank/no-data days.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * COMPARE TWO EMPLOYEES
     */
    const asksEmployeeComparison =
      q.includes("compare") &&
      q.includes("attendance");

    if (asksEmployeeComparison) {
      const matchedEmployees =
        attendanceEmployees.filter(
          (employee) => {
            const full =
              normalizeText(
                employee
              );

            const first =
              full.split(/\s+/)[0];

            return (
              q.includes(full) ||
              (
                first.length >= 3 &&
                q.includes(first)
              )
            );
          }
        );

      const uniqueMatched =
        [
          ...new Set(
            matchedEmployees
          ),
        ];

      if (uniqueMatched.length < 2) {
        return [
          "Please include two employee names to compare attendance.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      const selected =
        uniqueMatched.slice(0, 2);

      const comparison =
        selected.map(
          (name) => {
            const row =
              targetRows.find(
                (item) =>
                  String(
                    item.Name ?? ""
                  ).trim() === name
              );

            return {
              name,
              ...summarizeAttendanceRow(
                row
              ),
            };
          }
        );

      return [
        `Attendance comparison — ${targetMonth}`,
        "",
        ...comparison.map(
          (item) =>
            `${item.name} — Present: ${item.present} | Absent: ${item.absent} | Leave: ${item.leave} | Week Off: ${item.weekOff}${item.attendanceRate === null ? "" : ` | Attendance rate: ${item.attendanceRate.toFixed(1)}%`}`
        ),
        "",
        "Attendance rate = Present / (Present + Absent).",
        "Leave, Week Off and blank/no-data days are neutral.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * INDIVIDUAL MULTI-MONTH ATTENDANCE SUMMARY
     *
     * Example:
     * "Show Dayanand's attendance summary from May to August."
     */
    const asksMultiMonthAttendanceSummary =
      q.includes("attendance") &&
      q.includes("summary") &&
      (
        q.includes("from") ||
        q.includes("to")
      );

    if (asksMultiMonthAttendanceSummary) {
      const workbookMonthNames =
        Object.keys(
          workbookData || {}
        );

      const canonicalMonthOrder = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
      ];

      const monthAliasesForSummary = {
        january: ["january", "jan"],
        february: ["february", "feb"],
        march: ["march", "mar"],
        april: ["april", "apr"],
        may: ["may"],
        june: ["june", "jun"],
        july: ["july", "jul"],
        august: ["august", "aug"],
        september: ["september", "sep", "sept"],
        october: ["october", "oct"],
        november: ["november", "nov"],
        december: ["december", "dec"],
      };

      const canonicalForSheet =
        (sheetName) => {
          const normalized =
            normalizeText(
              sheetName
            );

          return canonicalMonthOrder.find(
            (month) =>
              monthAliasesForSummary[
                month
              ].includes(
                normalized
              )
          ) || null;
        };

      const canonicalFromMonthAlias =
        (value) => {
          const normalized =
            normalizeText(
              value
            );

          return canonicalMonthOrder.find(
            (month) =>
              monthAliasesForSummary[
                month
              ].includes(
                normalized
              )
          ) || null;
        };

      const monthRangeMatch =
        q.match(
          /from\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)\s+to\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sep|sept|october|oct|november|nov|december|dec)/i
        );

      const requestedCanonicalMonths =
        monthRangeMatch
          ? [
              canonicalFromMonthAlias(
                monthRangeMatch[1]
              ),
              canonicalFromMonthAlias(
                monthRangeMatch[2]
              ),
            ].filter(Boolean)
          : [];

      let selectedMonths =
        workbookMonthNames;

      if (
        requestedCanonicalMonths.length >= 2
      ) {
        const firstCanonical =
          requestedCanonicalMonths[0];

        const lastCanonical =
          requestedCanonicalMonths[
            requestedCanonicalMonths.length - 1
          ];

        const firstIndex =
          canonicalMonthOrder.indexOf(
            firstCanonical
          );

        const lastIndex =
          canonicalMonthOrder.indexOf(
            lastCanonical
          );

        const wantedCanonicals =
          canonicalMonthOrder.slice(
            Math.min(
              firstIndex,
              lastIndex
            ),
            Math.max(
              firstIndex,
              lastIndex
            ) + 1
          );

        selectedMonths =
          wantedCanonicals
            .map(
              (canonical) => {
                const exactPreferred =
                  workbookMonthNames.find(
                    (sheetName) =>
                      normalizeText(
                        sheetName
                      ) ===
                      monthAliasesForSummary[
                        canonical
                      ][0]
                  );

                if (exactPreferred) {
                  return exactPreferred;
                }

                return workbookMonthNames.find(
                  (sheetName) =>
                    canonicalForSheet(
                      sheetName
                    ) ===
                    canonical
                );
              }
            )
            .filter(Boolean);
      }

      const allNames =
        [
          ...new Set(
            selectedMonths.flatMap(
              (monthName) =>
                (
                  workbookData[
                    monthName
                  ] || []
                )
                  .map(
                    (row) =>
                      String(
                        row.Name ?? row.Employees ?? ""
                      ).trim()
                  )
                  .filter(Boolean)
            )
          ),
        ];

      const mentionedMultiMonthEmployee =
        allNames.find(
          (employee) =>
            q.includes(
              normalizeText(
                employee
              )
            )
        ) ||
        (() => {
          const matches =
            allNames.filter(
              (employee) => {
                const first =
                  normalizeText(
                    employee
                  ).split(/\s+/)[0];

                return (
                  first.length >= 3 &&
                  q.includes(first)
                );
              }
            );

          return matches.length === 1
            ? matches[0]
            : null;
        })();

      if (!mentionedMultiMonthEmployee) {
        return [
          "I could not identify the employee for the multi-month attendance summary.",
          "",
          "Please include the employee name.",
        ].join("\n");
      }

      const monthSummaries =
        selectedMonths
          .map(
            (monthName) => {
              const row =
                (
                  workbookData[
                    monthName
                  ] || []
                ).find(
                  (item) =>
                    String(
                      item.Name ?? item.Employees ?? ""
                    ).trim() ===
                    mentionedMultiMonthEmployee
                );

              if (!row) {
                return {
                  monthName,
                  found: false,
                };
              }

              return {
                monthName,
                found: true,
                ...summarizeAttendanceRow(
                  row
                ),
              };
            }
          );

      const totals =
        monthSummaries.reduce(
          (acc, item) => {
            if (!item.found) {
              return acc;
            }

            acc.present +=
              item.present;
            acc.absent +=
              item.absent;
            acc.leave +=
              item.leave;
            acc.weekOff +=
              item.weekOff;

            return acc;
          },
          {
            present: 0,
            absent: 0,
            leave: 0,
            weekOff: 0,
          }
        );

      return [
        `${mentionedMultiMonthEmployee} — Attendance summary`,
        "",
        ...monthSummaries.map(
          (item) =>
            item.found
              ? `${item.monthName} — Present: ${item.present} | Absent: ${item.absent} | Leave: ${item.leave} | Week Off: ${item.weekOff}`
              : `${item.monthName} — No employee record found`
        ),
        "",
        `Total — Present: ${totals.present} | Absent: ${totals.absent} | Leave: ${totals.leave} | Week Off: ${totals.weekOff}`,
        "",
        `Source: ${selectedMonths.join(", ")}`,
      ].join("\n");
    }


    if (
      q.includes("today") &&
      (
        q.includes("absent") ||
        q.includes("present")
      )
    ) {
      const states =
        targetRows
          .map(
            (row) => ({
              name:
                String(
                  row.Name || ""
                ).trim(),

              state:
                attendanceDayState(
                  row,
                  day
                ),
            })
          )
          .filter(
            (item) =>
              item.name
          );

      const recorded =
        states.filter(
          (item) =>
            item.state !==
            "no-data"
        );

      if (
        !recorded.length
      ) {
        return [
          `No attendance data is recorded yet for ${day} ${targetMonth}.`,
          "",
          "Blank cells are treated as no data — not as absence.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      const targetState =
        q.includes("absent")
          ? "absent"
          : "present";

      const matches =
        states.filter(
          (item) =>
            item.state ===
            targetState
        );

      if (
        !matches.length
      ) {
        return [
          `No employees are explicitly marked ${targetState} for ${day} ${targetMonth}.`,
          "",
          `Attendance records found for ${recorded.length} employee(s).`,
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      return [
        `${targetState === "absent" ? "Absent" : "Present"} on ${day} ${targetMonth}: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            item.name
        ),
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }

    /*
     * MOST CONSISTENT EMPLOYEE — LOCAL, $0 API
     *
     * Fair comparison:
     * - Present/Absent determine attendance reliability.
     * - On-time/Late classify Present days only when a usable In time exists.
     * - Present days without a usable In time are shown as Unclassified Present.
     * - Leave, Week Off and blank/no-data days are neutral.
     *
     * Consistency rate =
     *   (Present + On-time bonus) /
     *   (Present + Absent + classified check-ins)
     *   expressed as a percentage.
     *
     * Raw score is still shown for transparency:
     * Present +2 | On-time +1 | Absent -2 | Late -1
     *
     * Winners are ranked by consistency rate first, then by evidence volume.
     * Ties are shown rather than guessed.
     */
    if (
      q.includes("consistent") ||
      q.includes("consistency")
    ) {
      if (attendanceSettingsError) {
        return [
          "I could not load Attendance Settings, so I will not guess the consistency result.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      if (!attendanceSettingsReady) {
        return [
          "Attendance Settings are still loading.",
          "",
          "Please try the consistency question again in a moment.",
          "No paid API was used.",
        ].join("\n");
      }

      const officeStartMinutes =
        attendanceClockMinutes(
          attendanceSettings.office_start_time,
          "settings"
        );

      const graceMinutes =
        Number(
          attendanceSettings.grace_period_minutes ?? 0
        );

      if (
        officeStartMinutes === null ||
        !Number.isFinite(graceMinutes)
      ) {
        return [
          "I could not calculate the attendance cutoff from Attendance Settings.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const cutoffMinutes =
        officeStartMinutes + graceMinutes;

      const results = [];

      targetRows.forEach((row) => {
        const employee =
          String(row.Name ?? row.Employees ?? "").trim();

        if (!employee) return;

        let present = 0;
        let absent = 0;
        let leave = 0;
        let weekOff = 0;
        let onTime = 0;
        let late = 0;
        let unclassifiedPresent = 0;
        let recordedDays = 0;

        for (
          let attendanceDay = 1;
          attendanceDay <= 31;
          attendanceDay += 1
        ) {
          const state =
            attendanceDayState(
              row,
              attendanceDay
            );

          if (state === "no-data") {
            continue;
          }

          recordedDays += 1;

          if (state === "absent") {
            absent += 1;
            continue;
          }

          if (state === "leave") {
            leave += 1;
            continue;
          }

          if (state === "weekoff") {
            weekOff += 1;
            continue;
          }

          if (state === "present") {
            present += 1;

            const checkInMinutes =
              attendanceClockMinutes(
                row[`${attendanceDay} In`]
              );

            if (checkInMinutes === null) {
              unclassifiedPresent += 1;
            } else if (
              checkInMinutes <= cutoffMinutes
            ) {
              onTime += 1;
            } else {
              late += 1;
            }
          }
        }

        if (recordedDays <= 0) return;

        const classifiedCheckIns =
          onTime + late;

        const reliabilityDays =
          present + absent;

        const consistencyDenominator =
          reliabilityDays + classifiedCheckIns;

        const consistencyNumerator =
          present + onTime;

        const consistencyRate =
          consistencyDenominator > 0
            ? (
                consistencyNumerator /
                consistencyDenominator
              ) * 100
            : 0;

        const rawScore =
          present * 2 +
          onTime -
          absent * 2 -
          late;

        results.push({
          employee,
          consistencyRate,
          rawScore,
          present,
          absent,
          leave,
          weekOff,
          onTime,
          late,
          unclassifiedPresent,
          classifiedCheckIns,
          recordedDays,
        });
      });

      if (!results.length) {
        return [
          `I could not find enough attendance data to calculate consistency for ${targetMonth}.`,
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      results.sort(
        (a, b) =>
          b.consistencyRate -
            a.consistencyRate ||
          b.classifiedCheckIns -
            a.classifiedCheckIns ||
          b.present -
            a.present ||
          a.absent -
            b.absent ||
          a.late -
            b.late
      );

      const bestRate =
        results[0].consistencyRate;

      const bestEvidence =
        results[0].classifiedCheckIns;

      const leaders =
        results.filter(
          (item) =>
            Math.abs(
              item.consistencyRate -
                bestRate
            ) < 0.0001 &&
            item.classifiedCheckIns ===
              bestEvidence
        );

      const formatRate =
        (value) =>
          `${Number(value.toFixed(1))}%`;

      const lines = [
        `Most consistent employee${leaders.length === 1 ? "" : "s"} — ${targetMonth}`,
        "",
      ];

      leaders.forEach((item) => {
        lines.push(
          item.employee,
          `Consistency rate: ${formatRate(item.consistencyRate)}`,
          `Present: ${item.present}`,
          `On time: ${item.onTime}`,
          `Late: ${item.late}`,
          `Absent: ${item.absent}`,
          `Leave: ${item.leave}`,
          `Week Off: ${item.weekOff}`,
          `Unclassified present: ${item.unclassifiedPresent}`,
          `Raw score: ${item.rawScore}`,
          ""
        );
      });

      const totalUnclassified =
        leaders.reduce(
          (sum, item) =>
            sum +
            item.unclassifiedPresent,
          0
        );

      if (totalUnclassified > 0) {
        lines.push(
          `Note: ${totalUnclassified} present day${totalUnclassified === 1 ? "" : "s"} had no usable check-in time, so ${totalUnclassified === 1 ? "it was" : "they were"} counted as Present but not classified as On time or Late.`,
          ""
        );
      }

      lines.push(
        "Fair comparison: consistency rate is ranked first; employees with more classified check-ins are preferred when rates are equal.",
        "Raw scoring: Present +2 | On-time bonus +1 | Absent -2 | Late -1",
        "Leave, Week Off and blank/no-data days are neutral.",
        "Ties are shown instead of guessed.",
        "",
        `Late cutoff: ${formatAttendanceClock(cutoffMinutes)}`,
        `Source: ${targetMonth} + Attendance Settings`
      );

      return lines.join("\n");
    }


    /*
     * EARLIEST ARRIVAL IN A MONTH — LOCAL, $0 API
     *
     * Example:
     * "Who arrived earliest in August?"
     *
     * Uses the earliest valid daily In time in the requested month.
     */
    if (
      q.includes("earliest") &&
      (
        q.includes("arrive") ||
        q.includes("arrival") ||
        q.includes("check in") ||
        q.includes("check-in")
      )
    ) {
      let earliestRecord =
        null;

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          for (
            let attendanceDay = 1;
            attendanceDay <= 31;
            attendanceDay += 1
          ) {
            const state =
              attendanceDayState(
                row,
                attendanceDay
              );

            if (
              state === "absent" ||
              state === "leave" ||
              state === "weekoff" ||
              state === "no-data"
            ) {
              continue;
            }

            const checkInMinutes =
              attendanceClockMinutes(
                row[
                  `${attendanceDay} In`
                ]
              );

            if (
              checkInMinutes ===
              null
            ) {
              continue;
            }

            if (
              !earliestRecord ||
              checkInMinutes <
                earliestRecord.checkInMinutes
            ) {
              earliestRecord = {
                employee,
                attendanceDay,
                checkInMinutes,
              };
            }
          }
        }
      );

      if (!earliestRecord) {
        return [
          `I could not find any valid check-in times in ${targetMonth}.`,
          "",
          "Blank, Absent, Leave and Week Off records are excluded.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      return [
        `Earliest arrival in ${targetMonth}:`,
        "",
        `${earliestRecord.employee} — ${formatAttendanceClock(earliestRecord.checkInMinutes)} on ${earliestRecord.attendanceDay} ${targetMonth}`,
        "",
        "Blank, Absent, Leave and Week Off records are excluded.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * LATEST ARRIVAL IN A MONTH — LOCAL, $0 API
     *
     * Example:
     * "Who was the latest to arrive in August?"
     *
     * This must run BEFORE the general "late" rule because
     * the word "latest" contains the substring "late".
     */
    if (
      q.includes("latest") &&
      (
        q.includes("arrive") ||
        q.includes("arrival") ||
        q.includes("check in") ||
        q.includes("check-in")
      )
    ) {
      let latestRecord =
        null;

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          for (
            let attendanceDay = 1;
            attendanceDay <= 31;
            attendanceDay += 1
          ) {
            const state =
              attendanceDayState(
                row,
                attendanceDay
              );

            if (
              state === "absent" ||
              state === "leave" ||
              state === "weekoff" ||
              state === "no-data"
            ) {
              continue;
            }

            const checkInValue =
              row[
                `${attendanceDay} In`
              ];

            const checkInMinutes =
              attendanceClockMinutes(
                checkInValue
              );

            if (
              checkInMinutes ===
              null
            ) {
              continue;
            }

            if (
              !latestRecord ||
              checkInMinutes >
                latestRecord.checkInMinutes
            ) {
              latestRecord = {
                employee,
                attendanceDay,
                checkInMinutes,
              };
            }
          }
        }
      );

      if (!latestRecord) {
        return [
          `I could not find any valid check-in times in ${targetMonth}.`,
          "",
          "Blank, Absent, Leave and Week Off records are excluded.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      return [
        `Latest arrival in ${targetMonth}:`,
        "",
        `${latestRecord.employee} — ${formatAttendanceClock(latestRecord.checkInMinutes)} on ${latestRecord.attendanceDay} ${targetMonth}`,
        "",
        "Blank, Absent, Leave and Week Off records are excluded.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * DATE-SPECIFIC ON-TIME ARRIVAL — LOCAL, $0 API
     *
     * Example:
     * "Who was on time on 3 August?"
     *
     * Uses Attendance Settings:
     * office_start_time + grace_period_minutes.
     * A valid check-in at or before the cutoff is on time.
     */
    const specificOnTimeDayMatch =
      q.match(
        /\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/
      );

    if (
      (
        q.includes("on time") ||
        q.includes("ontime")
      ) &&
      Boolean(
        specificOnTimeDayMatch
      )
    ) {
      if (
        attendanceSettingsError
      ) {
        return [
          "I could not load the Attendance Settings, so I will not guess the on-time cutoff.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      if (
        !attendanceSettingsReady
      ) {
        return [
          "Attendance Settings are still loading.",
          "",
          "Please try the on-time question again in a moment.",
          "No paid API was used.",
        ].join("\n");
      }

      const requestedDay =
        Number(
          specificOnTimeDayMatch[1]
        );

      const officeStartMinutes =
        attendanceClockMinutes(
          attendanceSettings
            .office_start_time,
          "settings"
        );

      const graceMinutes =
        Number(
          attendanceSettings
            .grace_period_minutes ??
            0
        );

      if (
        officeStartMinutes === null ||
        !Number.isFinite(
          graceMinutes
        )
      ) {
        return [
          "I could not calculate the on-time cutoff from Attendance Settings.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const cutoffMinutes =
        officeStartMinutes +
        graceMinutes;

      const onTimePeople =
        [];

      let recordedCheckIns =
        0;

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          const state =
            attendanceDayState(
              row,
              requestedDay
            );

          if (
            state === "absent" ||
            state === "leave" ||
            state === "weekoff" ||
            state === "no-data"
          ) {
            return;
          }

          const checkInMinutes =
            attendanceClockMinutes(
              row[
                `${requestedDay} In`
              ]
            );

          if (
            checkInMinutes ===
            null
          ) {
            return;
          }

          recordedCheckIns +=
            1;

          if (
            checkInMinutes <=
            cutoffMinutes
          ) {
            onTimePeople.push({
              employee,
              checkInMinutes,
            });
          }
        }
      );

      const cutoffLabel =
        formatAttendanceClock(
          cutoffMinutes
        );

      onTimePeople.sort(
        (a, b) =>
          a.checkInMinutes -
          b.checkInMinutes
      );

      if (
        !recordedCheckIns
      ) {
        return [
          `No valid check-in times are recorded for ${requestedDay} ${targetMonth}.`,
          "",
          `On-time cutoff: ${cutoffLabel}`,
          "",
          `Source: ${targetMonth} + Attendance Settings`,
        ].join("\n");
      }

      if (
        !onTimePeople.length
      ) {
        return [
          `On time on ${requestedDay} ${targetMonth}: 0`,
          "",
          `On-time cutoff: ${cutoffLabel}`,
          "",
          `Source: ${targetMonth} + Attendance Settings`,
        ].join("\n");
      }

      return [
        `On time on ${requestedDay} ${targetMonth}: ${onTimePeople.length}`,
        "",
        ...onTimePeople.map(
          (item) =>
            `${item.employee} — ${formatAttendanceClock(item.checkInMinutes)}`
        ),
        "",
        `Office start: ${formatAttendanceClock(officeStartMinutes)}`,
        `Grace period: ${graceMinutes} minute${graceMinutes === 1 ? "" : "s"}`,
        `On-time cutoff: ${cutoffLabel}`,
        "",
        "Exactly at the cutoff is treated as on time.",
        "",
        `Source: ${targetMonth} + Attendance Settings`,
      ].join("\n");
    }


    /*
     * DATE-SPECIFIC LATE ARRIVAL — LOCAL, $0 API
     *
     * Example:
     * "Who came late on 3 August?"
     *
     * Uses Attendance Settings:
     * office_start_time + grace_period_minutes.
     * Runs before the monthly late rule.
     */
    const specificLateDayMatch =
      q.match(
        /\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/
      );

    if (
      q.includes("late") &&
      !q.includes("latest") &&
      Boolean(
        specificLateDayMatch
      )
    ) {
      if (
        attendanceSettingsError
      ) {
        return [
          "I could not load the Attendance Settings, so I will not guess the late cutoff.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      if (
        !attendanceSettingsReady
      ) {
        return [
          "Attendance Settings are still loading.",
          "",
          "Please try the late-arrival question again in a moment.",
          "No paid API was used.",
        ].join("\n");
      }

      const requestedDay =
        Number(
          specificLateDayMatch[1]
        );

      const officeStartMinutes =
        attendanceClockMinutes(
          attendanceSettings
            .office_start_time,
          "settings"
        );

      const graceMinutes =
        Number(
          attendanceSettings
            .grace_period_minutes ??
            0
        );

      if (
        officeStartMinutes === null ||
        !Number.isFinite(
          graceMinutes
        )
      ) {
        return [
          "I could not calculate the late cutoff from Attendance Settings.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const lateCutoffMinutes =
        officeStartMinutes +
        graceMinutes;

      const latePeople =
        [];

      let recordedCheckIns =
        0;

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          const state =
            attendanceDayState(
              row,
              requestedDay
            );

          if (
            state === "absent" ||
            state === "leave" ||
            state === "weekoff" ||
            state === "no-data"
          ) {
            return;
          }

          const checkInMinutes =
            attendanceClockMinutes(
              row[
                `${requestedDay} In`
              ]
            );

          if (
            checkInMinutes ===
            null
          ) {
            return;
          }

          recordedCheckIns +=
            1;

          if (
            checkInMinutes >
            lateCutoffMinutes
          ) {
            latePeople.push({
              employee,
              checkInMinutes,
              minutesLate:
                checkInMinutes -
                lateCutoffMinutes,
            });
          }
        }
      );

      const cutoffLabel =
        formatAttendanceClock(
          lateCutoffMinutes
        );

      latePeople.sort(
        (a, b) =>
          b.minutesLate -
          a.minutesLate
      );

      if (
        !recordedCheckIns
      ) {
        return [
          `No valid check-in times are recorded for ${requestedDay} ${targetMonth}.`,
          "",
          `Late cutoff: ${cutoffLabel}`,
          "",
          `Source: ${targetMonth} + Attendance Settings`,
        ].join("\n");
      }

      if (
        !latePeople.length
      ) {
        return [
          `Late on ${requestedDay} ${targetMonth}: 0`,
          "",
          `Late cutoff: ${cutoffLabel}`,
          "Exactly at the cutoff is treated as on time.",
          "",
          `Source: ${targetMonth} + Attendance Settings`,
        ].join("\n");
      }

      return [
        `Late on ${requestedDay} ${targetMonth}: ${latePeople.length}`,
        "",
        ...latePeople.map(
          (item) =>
            `${item.employee} — ${formatAttendanceClock(item.checkInMinutes)} (${item.minutesLate} min late)`
        ),
        "",
        `Office start: ${formatAttendanceClock(officeStartMinutes)}`,
        `Grace period: ${graceMinutes} minute${graceMinutes === 1 ? "" : "s"}`,
        `Late cutoff: ${cutoffLabel}`,
        "",
        "Exactly at the cutoff is treated as on time.",
        "",
        `Source: ${targetMonth} + Attendance Settings`,
      ].join("\n");
    }


    /*
     * WHO CAME LATE — LOCAL, $0 API
     *
     * Late cutoff comes from Attendance Settings:
     * office_start_time + grace_period_minutes.
     *
     * Example with 10:00 + 15 minute grace:
     * 10:15 = on time
     * 10:16 = late
     */
    if (
      q.includes("late") &&
      !q.includes("latest")
    ) {
      if (
        attendanceSettingsError
      ) {
        return [
          "I could not load the Attendance Settings, so I will not guess the late cutoff.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      if (
        !attendanceSettingsReady
      ) {
        return [
          "Attendance Settings are still loading.",
          "",
          "Please try the late-arrival question again in a moment.",
          "No paid API was used.",
        ].join("\n");
      }

      const officeStartMinutes =
        attendanceClockMinutes(
          attendanceSettings
            .office_start_time,
          "settings"
        );

      const graceMinutes =
        Number(
          attendanceSettings
            .grace_period_minutes ??
            0
        );

      if (
        officeStartMinutes ===
          null ||
        !Number.isFinite(
          graceMinutes
        )
      ) {
        return [
          "I could not calculate the late cutoff from Attendance Settings.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const lateCutoffMinutes =
        officeStartMinutes +
        graceMinutes;

      const latePeople =
        [];

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          let lateDays = 0;
          let totalLateMinutes = 0;

          for (
            let attendanceDay = 1;
            attendanceDay <= 31;
            attendanceDay += 1
          ) {
            const state =
              attendanceDayState(
                row,
                attendanceDay
              );

            /*
             * Do not treat absence, leave,
             * week off or blank data as late.
             */
            if (
              state === "absent" ||
              state === "leave" ||
              state === "weekoff" ||
              state === "no-data"
            ) {
              continue;
            }

            const checkInMinutes =
              attendanceClockMinutes(
                row[
                  `${attendanceDay} In`
                ]
              );

            if (
              checkInMinutes ===
              null
            ) {
              continue;
            }

            /*
             * Exactly at the cutoff is still on time.
             * Only later than the cutoff counts as late.
             */
            if (
              checkInMinutes >
              lateCutoffMinutes
            ) {
              lateDays += 1;

              totalLateMinutes +=
                checkInMinutes -
                lateCutoffMinutes;
            }
          }

          if (
            lateDays > 0
          ) {
            latePeople.push({
              employee,
              lateDays,
              totalLateMinutes,
            });
          }
        }
      );

      latePeople.sort(
        (a, b) =>
          b.lateDays -
            a.lateDays ||
          b.totalLateMinutes -
            a.totalLateMinutes
      );

      const cutoffLabel =
        formatAttendanceClock(
          lateCutoffMinutes
        );

      if (
        !latePeople.length
      ) {
        return [
          `No employees had a confirmed check-in after ${cutoffLabel} in ${targetMonth}.`,
          "",
          `Office start: ${formatAttendanceClock(officeStartMinutes)}`,
          `Grace period: ${graceMinutes} minute${graceMinutes === 1 ? "" : "s"}`,
          `Late cutoff: ${cutoffLabel}`,
          "",
          "Blank, Absent, Leave and Week Off records are excluded.",
          "",
          `Source: ${targetMonth} + Attendance Settings`,
        ].join("\n");
      }

      const totalLateArrivals =
        latePeople.reduce(
          (total, item) =>
            total +
            item.lateDays,
          0
        );

      return [
        `Employees late in ${targetMonth}: ${latePeople.length}`,
        `Confirmed late arrivals: ${totalLateArrivals}`,
        "",
        ...latePeople.map(
          (item) =>
            `${item.employee}: ${item.lateDays} day${item.lateDays === 1 ? "" : "s"} (${item.totalLateMinutes} min after cutoff total)`
        ),
        "",
        `Office start: ${formatAttendanceClock(officeStartMinutes)}`,
        `Grace period: ${graceMinutes} minute${graceMinutes === 1 ? "" : "s"}`,
        `Late cutoff: ${cutoffLabel}`,
        "",
        "Exactly at the cutoff is treated as on time.",
        "Blank, Absent, Leave and Week Off records are excluded.",
        "",
        `Source: ${targetMonth} + Attendance Settings`,
      ].join("\n");
    }


    /*
     * DATE-SPECIFIC PRESENT / ABSENT — LOCAL, $0 API
     *
     * Examples:
     * "How many employees were present on 3 August?"
     * "Who was absent on 3 August?"
     */
    const specificDayMatch =
      q.match(
        /\b([1-9]|[12]\d|3[01])(?:st|nd|rd|th)?\b/
      );

    const asksSpecificPresent =
      q.includes("present") &&
      !q.includes("today") &&
      Boolean(
        specificDayMatch
      );

    const asksSpecificAbsent =
      q.includes("absent") &&
      !q.includes("today") &&
      !q.includes("most absent") &&
      !q.includes("most absences") &&
      !q.includes("highest absence") &&
      Boolean(
        specificDayMatch
      );

    if (
      asksSpecificPresent ||
      asksSpecificAbsent
    ) {
      const requestedDay =
        Number(
          specificDayMatch[1]
        );

      const wantedState =
        asksSpecificAbsent
          ? "absent"
          : "present";

      const matches =
        [];

      const recorded =
        [];

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          const state =
            attendanceDayState(
              row,
              requestedDay
            );

          if (
            state !== "no-data"
          ) {
            recorded.push({
              employee,
              state,
            });
          }

          if (
            state === wantedState
          ) {
            matches.push(
              employee
            );
          }
        }
      );

      const label =
        wantedState ===
        "present"
          ? "Present"
          : "Absent";

      if (
        !recorded.length
      ) {
        return [
          `No attendance data is recorded for ${requestedDay} ${targetMonth}.`,
          "",
          "Blank cells are treated as no data.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      if (
        !matches.length
      ) {
        return [
          `${label} on ${requestedDay} ${targetMonth}: 0`,
          "",
          `Attendance records found for ${recorded.length} employee(s).`,
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      return [
        `${label} on ${requestedDay} ${targetMonth}: ${matches.length}`,
        "",
        ...matches,
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * WHO WAS ABSENT IN A MONTH — LOCAL, $0 API
     *
     * Example:
     * "Who was absent in August?"
     *
     * Count absent DAYS per employee from the real
     * attendance format. A/A for one date = 1 absent day.
     */
    if (
      q.includes("absent") &&
      !q.includes("today") &&
      !q.includes("most absent") &&
      !q.includes("most absences") &&
      !q.includes("highest absence")
    ) {
      const absentPeople = [];

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          let absentDays = 0;

          for (
            let attendanceDay = 1;
            attendanceDay <= 31;
            attendanceDay += 1
          ) {
            const state =
              attendanceDayState(
                row,
                attendanceDay
              );

            if (
              state ===
              "absent"
            ) {
              absentDays += 1;
            }
          }

          if (
            absentDays > 0
          ) {
            absentPeople.push({
              employee,
              absentDays,
            });
          }
        }
      );

      absentPeople.sort(
        (a, b) =>
          b.absentDays -
          a.absentDays
      );

      if (
        !absentPeople.length
      ) {
        return [
          `No employees have confirmed absent days in ${targetMonth}.`,
          "",
          "Only days explicitly marked A are counted as absent.",
          "Blank cells, L, W/OFF and '-' are excluded.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      const totalAbsentDays =
        absentPeople.reduce(
          (total, item) =>
            total +
            item.absentDays,
          0
        );

      return [
        `Employees absent in ${targetMonth}: ${absentPeople.length}`,
        `Confirmed absent days: ${totalAbsentDays}`,
        "",
        ...absentPeople.map(
          (item) =>
            `${item.employee}: ${item.absentDays} day${item.absentDays === 1 ? "" : "s"}`
        ),
        "",
        "Only days explicitly marked A are counted as absent.",
        "Blank cells, L, W/OFF and '-' are excluded.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * WHO WAS PRESENT IN A MONTH — LOCAL, $0 API
     *
     * Example:
     * "Who was present in August?"
     *
     * A person is counted here if at least one day in the
     * requested month is classified as present.
     */
    if (
      q.includes("present") &&
      !q.includes("today")
    ) {
      const presentPeople = [];

      targetRows.forEach(
        (row) => {
          const employee =
            String(
              row.Name ?? ""
            ).trim();

          if (!employee) {
            return;
          }

          let presentDays = 0;

          for (
            let attendanceDay = 1;
            attendanceDay <= 31;
            attendanceDay += 1
          ) {
            const state =
              attendanceDayState(
                row,
                attendanceDay
              );

            if (
              state === "present"
            ) {
              presentDays += 1;
            }
          }

          if (
            presentDays > 0
          ) {
            presentPeople.push({
              employee,
              presentDays,
            });
          }
        }
      );

      presentPeople.sort(
        (a, b) =>
          b.presentDays -
          a.presentDays
      );

      if (
        !presentPeople.length
      ) {
        return [
          `No employees have confirmed present days in ${targetMonth}.`,
          "",
          "Only recorded attendance/time entries are counted as present.",
          "Blank cells, A, L, W/OFF and '-' are excluded from present days.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      const totalPresentDays =
        presentPeople.reduce(
          (total, item) =>
            total +
            item.presentDays,
          0
        );

      return [
        `Employees present in ${targetMonth}: ${presentPeople.length}`,
        `Confirmed present days: ${totalPresentDays}`,
        "",
        ...presentPeople.map(
          (item) =>
            `${item.employee}: ${item.presentDays} day${item.presentDays === 1 ? "" : "s"}`
        ),
        "",
        "Blank cells, A, L, W/OFF and '-' are not counted as present days.",
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * LEAVE / WEEK-OFF STATUS QUESTIONS — LOCAL, $0 API
     */
    const asksLeave =
      q.includes("leave") ||
      q.includes("on leave");

    const asksWeekOff =
      q.includes("week off") ||
      q.includes("weekoff") ||
      q.includes("w/off") ||
      q.includes("w off");

    if (asksLeave || asksWeekOff) {
      const wantedState = asksLeave ? "leave" : "weekoff";
      const label = asksLeave ? "leave" : "week off";
      const people = [];

      targetRows.forEach((row) => {
        const employee = String(row.Name ?? "").trim();
        if (!employee) return;

        let days = 0;
        for (let attendanceDay = 1; attendanceDay <= 31; attendanceDay += 1) {
          const state = attendanceDayState(row, attendanceDay);
          if (state === wantedState) days += 1;
        }

        if (days > 0) people.push({ employee, days });
      });

      people.sort((a, b) => b.days - a.days);

      if (!people.length) {
        return [
          `No employees were explicitly marked ${asksLeave ? "L (Leave)" : "W/OFF (Week Off)"} in ${targetMonth}.`,
          "",
          asksLeave
            ? "A (Absent) is not counted as Leave."
            : "A (Absent) and L (Leave) are not counted as Week Off.",
          "Blank cells and '-' are not treated as this status.",
          "",
          `Source: ${targetMonth}`,
        ].join("\n");
      }

      const totalDays = people.reduce((sum, item) => sum + item.days, 0);

      return [
        `Employees with ${label} in ${targetMonth}: ${people.length}`,
        `Confirmed ${label} days: ${totalDays}`,
        "",
        ...people.map((item) =>
          `${item.employee}: ${item.days} day${item.days === 1 ? "" : "s"}`
        ),
        "",
        `Source: ${targetMonth}`,
      ].join("\n");
    }


    /*
     * If this is an attendance question that the local
     * rules do not yet understand, STOP LOCALLY.
     * Never spend API credit automatically.
     */
    const supportedByOlderLocalRules =
      q.includes("most absences") ||
      q.includes("most absent") ||
      q.includes("highest absence") ||
      q.includes("working hours") ||
      q.includes("work hours") ||
      q.includes("hours worked") ||
      q.includes("worked") ||
      q.includes("most hours") ||
      q.includes("work time") ||
      q.includes("on time") ||
      q.includes("ontime") ||
      q.includes("consistent") ||
      q.includes("consistency") ||
      q.includes("earliest") ||
      q.includes("latest") ||
      q.includes("show attendance") ||
      q.includes("attendance for") ||
      q.includes("late");

    if (
      !supportedByOlderLocalRules
    ) {
      return (
        "I recognized this as an Attendance question, but I do not yet have a safe local rule for this exact request. No paid API was used."
      );
    }
  }

  const attendanceIntentWords = [
    "attendance",
    "present",
    "absent",
    "late",
    "on time",
    "ontime",
    "consistent",
    "consistency",
    "earliest",
    "latest",
    "working hours",
    "work hours",
    "hours worked",
    "worked",
    "most hours",
    "work time",
    "check in",
    "check out",
    "most absences",
  ];

  const isAttendanceQuestion =
    attendanceIntentWords.some(
      (word) =>
        q.includes(word)
    );

  if (
    !isAttendanceQuestion
  ) {
    return null;
  }

  const entries =
    attendanceSheetEntries(
      question
    );

  if (
    !entries.length
  ) {
    return {
      text:
        "I could not identify a matching attendance sheet in the active workbook.",

      action:
        "change-workbook",
    };
  }

  const asksToday =
    q.includes("today");

  const asksAbsent =
    q.includes("absent") ||
    q.includes("absence");

  const asksPresent =
    q.includes("present");

  const asksLate =
    q.includes("late") &&
    !q.includes("latest");

  const asksHours =
    q.includes("working hours") ||
    q.includes("work hours") ||
    q.includes("hours worked") ||
    q.includes("worked") ||
    q.includes("most hours") ||
    q.includes("work time") ||
    q.includes("total hours");

  const asksMostAbsences =
    q.includes("most absences") ||
    q.includes("most absent") ||
    q.includes("highest absence");

  const asksShowMonth =
    q.includes("show attendance") ||
    q.includes("attendance for");


  // ---------------------------------------------------------
  // MOST ABSENCES — LOCAL, $0 API
  // ---------------------------------------------------------

  if (asksMostAbsences) {
    const counts = {};
    const usedSheets = [];

    /*
     * REAL ATTENDANCE FORMAT:
     * Count absences by DAY, not by cell.
     *
     * Example:
     * 19 In  = A
     * 19 Out = A
     *
     * That is ONE absent day, not two.
     */
    entries.forEach(
      ([sheetName, rows]) => {
        (rows || []).forEach(
          (row) => {
            const employee =
              String(
                row.Name ?? ""
              ).trim();

            if (!employee) {
              return;
            }

            let absentDays = 0;

            for (
              let day = 1;
              day <= 31;
              day += 1
            ) {
              const state =
                attendanceDayState(
                  row,
                  day
                );

              if (
                state ===
                "absent"
              ) {
                absentDays +=
                  1;
              }
            }

            if (
              absentDays > 0
            ) {
              counts[employee] =
                (counts[employee] || 0) +
                absentDays;

              if (
                !usedSheets.includes(
                  sheetName
                )
              ) {
                usedSheets.push(
                  sheetName
                );
              }
            }
          }
        );
      }
    );

    const ranked =
      Object.entries(
        counts
      ).sort(
        (a, b) =>
          b[1] - a[1]
      );

    if (!ranked.length) {
      return [
        "I could not find any confirmed absent days in the selected attendance data.",
        "",
        "Only days explicitly marked A are counted as absent.",
        "Blank cells, L, W/OFF and '-' are not counted as absences.",
        "",
        `Source: ${entries.map(([name]) => name).join(", ")}`,
      ].join("\n");
    }

    const topCount =
      ranked[0][1];

    const leaders =
      ranked.filter(
        ([, count]) =>
          count === topCount
      );

    return [
      `Highest absence count: ${topCount} day${topCount === 1 ? "" : "s"}`,
      "",
      ...leaders.map(
        ([employee, count]) =>
          `${employee}: ${count}`
      ),
      "",
      "Counted as absent only when the day is explicitly marked A.",
      "Blank cells, L, W/OFF and '-' are excluded.",
      "",
      `Source: ${usedSheets.join(", ") || entries.map(([name]) => name).join(", ")}`,
    ].join("\n");
  }


  // ---------------------------------------------------------
  // WORKING HOURS — LOCAL, $0 API
  // Uses complete daily In + Out pairs from the real register.
  // ---------------------------------------------------------

  if (asksHours) {
    function parseTimeToMinutes(value, context = "in") {
      const textValue =
        String(value ?? "")
          .trim()
          .toLowerCase();

      if (
        !textValue ||
        textValue === "-" ||
        textValue === "a" ||
        textValue === "l" ||
        textValue === "w" ||
        textValue === "off"
      ) {
        return null;
      }

      const match =
        textValue.match(
          /^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/
        );

      if (!match) {
        return null;
      }

      let hour =
        Number(match[1]);

      const minute =
        Number(
          match[2] || 0
        );

      const meridiem =
        match[3] || "";

      if (
        !Number.isFinite(hour) ||
        !Number.isFinite(minute) ||
        minute < 0 ||
        minute > 59
      ) {
        return null;
      }

      if (meridiem) {
        if (
          hour < 1 ||
          hour > 12
        ) {
          return null;
        }

        if (
          meridiem === "pm" &&
          hour !== 12
        ) {
          hour += 12;
        }

        if (
          meridiem === "am" &&
          hour === 12
        ) {
          hour = 0;
        }
      } else {
        if (
          hour < 0 ||
          hour > 23
        ) {
          return null;
        }

        /*
         * Bare attendance times:
         * In 1:00–5:59  -> PM
         * Out 1:00–11:59 -> PM
         *
         * This matches normal office attendance and avoids treating
         * values such as 2:10 as 2:10 AM.
         */
        if (
          context === "in" &&
          hour >= 1 &&
          hour <= 5
        ) {
          hour += 12;
        } else if (
          context === "out" &&
          hour >= 1 &&
          hour <= 11
        ) {
          hour += 12;
        }
      }

      return (
        hour * 60 +
        minute
      );
    }

    const employeeTotals = [];

    entries.forEach(
      ([sheetName, rows]) => {
        (rows || []).forEach(
          (row) => {
            const employee =
              String(
                row.Name ?? ""
              ).trim();

            if (!employee) {
              return;
            }

            let totalMinutes = 0;
            let completePairs = 0;

            for (
              let attendanceDay = 1;
              attendanceDay <= 31;
              attendanceDay += 1
            ) {
              const inMinutes =
                parseTimeToMinutes(
                  row[
                    `${attendanceDay} In`
                  ],
                  "in"
                );

              const outMinutes =
                parseTimeToMinutes(
                  row[
                    `${attendanceDay} Out`
                  ],
                  "out"
                );

              if (
                inMinutes === null ||
                outMinutes === null
              ) {
                continue;
              }

              let duration =
                outMinutes -
                inMinutes;

              /*
               * The register often omits AM/PM.
               * Example: 7:45 -> 5:00 means 7:45 AM -> 5:00 PM.
               * If Out appears earlier than In, move Out forward 12 hours.
               */
              if (duration <= 0) {
                duration +=
                  12 * 60;
              }

              /*
               * Ignore impossible or unsafe durations instead of guessing.
               */
              if (
                duration <= 0 ||
                duration > 18 * 60
              ) {
                continue;
              }

              totalMinutes +=
                duration;

              completePairs +=
                1;
            }

            if (
              completePairs > 0
            ) {
              employeeTotals.push({
                employee,
                totalMinutes,
                completePairs,
              });
            }
          }
        );
      }
    );

    if (
      !employeeTotals.length
    ) {
      return [
        "I could not calculate working hours from the selected attendance data.",
        "",
        "Only complete In + Out pairs are used.",
        "Days with a missing In or Out time are excluded.",
        "",
        `Source: ${entries
          .map(([name]) => name)
          .join(", ")}`,
      ].join("\n");
    }

    employeeTotals.sort(
      (a, b) =>
        b.totalMinutes -
        a.totalMinutes
    );

    const topMinutes =
      employeeTotals[0]
        .totalMinutes;

    const leaders =
      employeeTotals.filter(
        (item) =>
          item.totalMinutes ===
          topMinutes
      );

    const formatMinutes =
      (minutesValue) => {
        const hours =
          Math.floor(
            minutesValue / 60
          );

        const minutes =
          minutesValue % 60;

        return `${hours}h ${minutes}m`;
      };

    return [
      `Most calculable working time — ${entries
        .map(([name]) => name)
        .join(", ")}`,
      "",
      ...leaders.map(
        (item) =>
          `${item.employee}: ${formatMinutes(item.totalMinutes)} (${item.completePairs} complete In/Out day${item.completePairs === 1 ? "" : "s"})`
      ),
      "",
      "Only complete In + Out pairs are included.",
      "Days with missing In or Out times are excluded.",
      "Where AM/PM is missing and Out appears earlier than In, Out is treated as 12 hours later.",
      "",
      `Source: ${entries
        .map(([name]) => name)
        .join(", ")}`,
    ].join("\n");
  }


  // ---------------------------------------------------------
  // ABSENT / PRESENT / LATE — LOCAL, $0 API
  // Supports row-based status and employee-by-date matrices.
  // ---------------------------------------------------------

  if (
    asksAbsent ||
    asksPresent ||
    asksLate
  ) {
    const targetKind =
      asksAbsent
        ? "absent"
        : asksPresent
        ? "present"
        : "late";

    const people = [];
    const usedSheets = [];

    entries.forEach(
      ([sheetName, rows]) => {
        (rows || []).forEach(
          (row) => {
            const employeeColumn =
              findAttendanceEmployeeColumn(
                row
              );

            const employee =
              employeeColumn
                ? String(
                    row[
                      employeeColumn
                    ] ?? ""
                  ).trim()
                : "";

            if (!employee) {
              return;
            }

            let matched = false;

            const statusColumn =
              findAttendanceStatusColumn(
                row
              );

            if (statusColumn) {
              let dateOkay = true;

              if (asksToday) {
                const dateColumn =
                  findAttendanceDateColumn(
                    row
                  );

                if (dateColumn) {
                  dateOkay =
                    dateCellMatchesToday(
                      row[
                        dateColumn
                      ]
                    );
                }
              }

              if (
                dateOkay &&
                attendanceStatusKind(
                  row[
                    statusColumn
                  ]
                ) === targetKind
              ) {
                matched = true;
              }
            }

            if (
              !matched &&
              asksToday
            ) {
              const todayColumn =
                attendanceDateColumnForToday(
                  row
                );

              if (
                todayColumn &&
                attendanceStatusKind(
                  row[
                    todayColumn
                  ]
                ) === targetKind
              ) {
                matched = true;
              }
            }

            if (
              !matched &&
              !asksToday
            ) {
              const matrixColumns =
                attendanceMatrixDateColumns(
                  row
                );

              if (
                matrixColumns.some(
                  (column) =>
                    attendanceStatusKind(
                      row[column]
                    ) === targetKind
                )
              ) {
                matched = true;
              }
            }

            if (matched) {
              people.push(
                employee
              );

              if (
                !usedSheets.includes(
                  sheetName
                )
              ) {
                usedSheets.push(
                  sheetName
                );
              }
            }
          }
        );
      }
    );

    const uniquePeople =
      [
        ...new Set(
          people
        ),
      ];

    if (!uniquePeople.length) {
      return (
        `I could not find any explicit ${targetKind} attendance marks` +
        `${asksToday ? " for today" : ""} in the selected attendance data. ` +
        "No paid API was used."
      );
    }

    const label =
      targetKind.charAt(0).toUpperCase() +
      targetKind.slice(1);

    return [
      `${label}${asksToday ? " today" : ""}: ${uniquePeople.length}`,
      "",
      ...uniquePeople.map(
        (employee) =>
          employee
      ),
      "",
      `Source: ${usedSheets.join(", ")}`,
    ].join("\n");
  }


  // ---------------------------------------------------------
  // SHOW MONTH ATTENDANCE — LOCAL, $0 API
  // ---------------------------------------------------------

  if (asksShowMonth) {
    const summary = [];

    entries.forEach(
      ([sheetName, rows]) => {
        (rows || []).forEach(
          (row) => {
            const employee =
              String(
                row.Name ?? ""
              ).trim();

            if (!employee) {
              return;
            }

            let present = 0;
            let absent = 0;
            let leave = 0;
            let weekoff = 0;

            for (
              let attendanceDay = 1;
              attendanceDay <= 31;
              attendanceDay += 1
            ) {
              const state =
                attendanceDayState(
                  row,
                  attendanceDay
                );

              if (
                state === "present"
              ) {
                present += 1;
              } else if (
                state === "absent"
              ) {
                absent += 1;
              } else if (
                state === "leave"
              ) {
                leave += 1;
              } else if (
                state === "weekoff"
              ) {
                weekoff += 1;
              }
            }

            summary.push({
              employee,
              present,
              absent,
              leave,
              weekoff,
            });
          }
        );
      }
    );

    if (!summary.length) {
      return [
        `No employee attendance records were found for ${entries
          .map(([name]) => name)
          .join(", ")}.`,
        "",
        `Source: ${entries
          .map(([name]) => name)
          .join(", ")}`,
      ].join("\n");
    }

    const totals =
      summary.reduce(
        (acc, item) => {
          acc.present +=
            item.present;

          acc.absent +=
            item.absent;

          acc.leave +=
            item.leave;

          acc.weekoff +=
            item.weekoff;

          return acc;
        },
        {
          present: 0,
          absent: 0,
          leave: 0,
          weekoff: 0,
        }
      );

    return [
      `Attendance Summary — ${entries
        .map(([name]) => name)
        .join(", ")}`,
      "",
      ...summary.map(
        (item) =>
          `• ${item.employee} — Present: ${item.present} | Absent: ${item.absent} | Leave: ${item.leave} | Week Off: ${item.weekoff}`
      ),
      "",
      "Overall Totals",
      `• Employees: ${summary.length}`,
      `• Present days: ${totals.present}`,
      `• Absent days: ${totals.absent}`,
      `• Leave days: ${totals.leave}`,
      `• Week Off days: ${totals.weekoff}`,
      "",
      "Note: Blank cells and '-' are treated as no data.",
      `Source: ${entries
        .map(([name]) => name)
        .join(", ")}`,
    ].join("\n");
  }

  return null;
}


function tryLocalSpreadsheetAnswer(question) {
  if (
    !sheetNames.length ||
    !Object.keys(workbookData).length
  ) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(question);

  const attendanceAnswer =
    tryLocalAttendanceAnswer(
      question
    );

  if (attendanceAnswer) {
    return attendanceAnswer;
  }

  const unassignedValues =
    new Set([
      "not using",
      "not assigned",
      "unassigned",
      "available",
      "in stock",
      "stock",
      "na",
      "n/a",
      "none",
      "nil",
      "-",
    ]);

  const inventoryEntries =
    Object.entries(workbookData).filter(
      ([sheetName]) => {
        const name =
          normalizeText(sheetName);

        return (
          name.includes("electronic") ||
          name.includes("inventory") ||
          name.includes("stock") ||
          name.includes("asset")
        );
      }
    );

  const sheetsToCheck =
    inventoryEntries.length
      ? inventoryEntries
      : Object.entries(workbookData);

  /*
   * PURCHASE INTENT MUST BE KNOWN BEFORE THE INVENTORY SAFETY GUARD.
   * Example: "How many laptops did we purchase?" contains "laptop"
   * but it is a purchase question, not a current-inventory question.
   */
  /*
   * If the user asks an inventory/assignment question
   * but the loaded workbook has no inventory-like sheet,
   * answer locally instead of spending API credit.
   */
  const inventoryQuestionWords = [
    "stock",
    "inventory",
    "assigned",
    "assignment",
    "allocated",
    "used by",
    "using",
    "issued",
    "available",
    "unassigned",
    "unused",
    "not being used",
    "laptop",
    "laptops",
    "mobile",
    "mobiles",
    "printer",
    "printers",
    "hdmi",
    "electronics",
  ];

  const isInventoryQuestion =
    inventoryQuestionWords.some(
      (word) =>
        normalizedQuestion.includes(
          word
        )
    );

  /*
   * Vendor routing intent is declared before the inventory guard
   * so words such as "Printer" inside a vendor name do not get
   * mistaken for an inventory question.
   */
  const vendorRoutingIntent =
    normalizedQuestion.includes("vendor") ||
    normalizedQuestion.includes("supplier") ||
    normalizedQuestion.includes("contact") ||
    normalizedQuestion.includes("details for") ||
    normalizedQuestion.includes("details of");

  /*
   * Purchase intent MUST be declared before the inventory guard.
   * Otherwise JavaScript throws:
   * ReferenceError: Cannot access 'asksPurchase' before initialization
   */
  const asksPurchase =
    normalizedQuestion.includes("purchase") ||
    normalizedQuestion.includes("purchased") ||
    normalizedQuestion.includes("buy") ||
    normalizedQuestion.includes("bought");

  if (
    !asksPurchase &&
    !vendorRoutingIntent &&
    workbookType !== "Documents" &&
    isInventoryQuestion &&
    !inventoryEntries.length
  ) {
    return {
      text:
        "The loaded workbook does not appear to contain an inventory sheet (such as Electronics, Inventory, Stock, or Assets). Please load the inventory workbook first.",

      action:
        "change-workbook",
    };
  }

  const asksZeroStock =
    normalizedQuestion.includes("zero stock") ||
    normalizedQuestion.includes("out of stock") ||
    normalizedQuestion.includes("no stock");

  const asksLowStock =
    isInventoryQuestion &&
    !normalizedQuestion.includes("budget") &&
    (
      normalizedQuestion.includes("less than") ||
      normalizedQuestion.includes("below") ||
      normalizedQuestion.includes("under") ||
      normalizedQuestion.includes("low stock")
    );

  const asksUnassigned =
    normalizedQuestion.includes("unassigned") ||
    normalizedQuestion.includes("not assigned") ||
    normalizedQuestion.includes("not using") ||
    normalizedQuestion.includes("not being used") ||
    normalizedQuestion.includes("unused") ||
    normalizedQuestion.includes("free items") ||
    normalizedQuestion.includes("available items");

  const asksAssignment =
    !asksUnassigned &&
    (
      normalizedQuestion.includes("using") ||
      normalizedQuestion.includes("used by") ||
      normalizedQuestion.includes("assigned") ||
      normalizedQuestion.includes("allocated") ||
      normalizedQuestion.includes("issued")
    );

  const asksTotalInventory =
    (
      normalizedQuestion.includes("total electronics stock") ||
      normalizedQuestion.includes("total electronic stock") ||
      normalizedQuestion.includes("total inventory") ||
      normalizedQuestion.includes("total stock")
    ) &&
    !asksPurchase;


  /*
   * Expense routing intent MUST be declared before inventory routing
   * because asksCurrentStock checks it.
   *
   * Otherwise JavaScript throws:
   * ReferenceError: Cannot access 'expenseRoutingIntent' before initialization
   */
  const expenseRoutingIntent =
    normalizedQuestion.includes("expense") ||
    normalizedQuestion.includes("expenses") ||
    normalizedQuestion.includes("spend") ||
    normalizedQuestion.includes("spent") ||
    normalizedQuestion.includes("pending payment") ||
    normalizedQuestion.includes("payments are pending") ||
    normalizedQuestion.includes("payment pending") ||
    normalizedQuestion.includes("travel") ||
    normalizedQuestion.includes("flight") ||
    normalizedQuestion.includes("hotel");

  const asksCurrentStock =
    !asksPurchase &&
    !expenseRoutingIntent &&
    !asksTotalInventory &&
    isInventoryQuestion &&
    (
      normalizedQuestion.includes("current stock") ||
      normalizedQuestion.includes("stock in hand") ||
      normalizedQuestion.includes("currently have") ||
      normalizedQuestion.includes("currently available") ||
      normalizedQuestion.includes("in stock") ||
      normalizedQuestion.includes("available") ||
      (
        normalizedQuestion.includes("how many") &&
        normalizedQuestion.includes("have")
      )
    );


  // ---------------------------------------------------------
  // ZERO STOCK — LOCAL, $0 API
  // ---------------------------------------------------------

  if (asksZeroStock) {
    const zeroItems = [];
    const usedSheets = [];

    sheetsToCheck.forEach(
      ([sheetName, sheetRows]) => {
        (sheetRows || []).forEach(
          (row) => {
            const itemColumn =
              findItemColumn(row);

            const quantityColumn =
              findQuantityColumn(row);

            if (
              !itemColumn ||
              !quantityColumn
            ) {
              return;
            }

            const itemName =
              String(
                row[itemColumn] ?? ""
              ).trim();

            if (!itemName) {
              return;
            }

            const quantity =
              numberFromValue(
                row[quantityColumn]
              );

            if (quantity === 0) {
              zeroItems.push(
                `${itemName}: 0`
              );

              if (
                !usedSheets.includes(
                  sheetName
                )
              ) {
                usedSheets.push(
                  sheetName
                );
              }
            }
          }
        );
      }
    );

    if (!zeroItems.length) {
      return (
        `No listed items currently have zero stock in ` +
        `${sheetsToCheck.map(([name]) => name).join(", ")}.`
      );
    }

    return [
      `I found ${zeroItems.length} item${zeroItems.length === 1 ? "" : "s"} with zero stock:`,
      "",
      ...zeroItems.slice(0, 30),
      "",
      `Source: ${usedSheets.join(", ")}`,
    ].join("\n");
  }


  // ---------------------------------------------------------
  // LOW STOCK — LOCAL, $0 API
  // Examples:
  // "Which items have less than 3 in stock?"
  // "Show items below 5 stock"
  // ---------------------------------------------------------

  if (asksLowStock) {
    const numberMatch =
      normalizedQuestion.match(
        /(?:less than|below|under)\s+(\d+(?:\.\d+)?)/
      );

    const threshold =
      numberMatch
        ? Number(numberMatch[1])
        : 3;

    const lowItems = [];
    const usedSheets = [];

    sheetsToCheck.forEach(
      ([sheetName, sheetRows]) => {
        (sheetRows || []).forEach(
          (row) => {
            const itemColumn =
              findItemColumn(row);

            const quantityColumn =
              findQuantityColumn(row);

            if (
              !itemColumn ||
              !quantityColumn
            ) {
              return;
            }

            const itemName =
              String(
                row[itemColumn] ?? ""
              ).trim();

            const quantity =
              numberFromValue(
                row[quantityColumn]
              );

            if (
              !itemName ||
              quantity === null
            ) {
              return;
            }

            if (
              quantity > 0 &&
              quantity < threshold
            ) {
              lowItems.push(
                `${itemName}: ${quantity}`
              );

              if (
                !usedSheets.includes(
                  sheetName
                )
              ) {
                usedSheets.push(
                  sheetName
                );
              }
            }
          }
        );
      }
    );

    if (!lowItems.length) {
      return (
        `No listed items have stock below ${threshold} ` +
        `while remaining above zero.`
      );
    }

    return [
      `Items with stock below ${threshold}:`,
      "",
      ...lowItems.slice(0, 30),
      "",
      `Source: ${usedSheets.join(", ")}`,
    ].join("\n");
  }


  // ---------------------------------------------------------
  // UNASSIGNED / AVAILABLE ITEMS — LOCAL, $0 API
  // ---------------------------------------------------------

  if (asksUnassigned) {
    const details = [];
    let total = 0;
    const usedSheets = [];

    sheetsToCheck.forEach(
      ([sheetName, sheetRows]) => {
        (sheetRows || []).forEach(
          (row) => {
            const itemColumn =
              findItemColumn(row);

            const usedByColumn =
              findUsedByColumn(row);

            if (
              !itemColumn ||
              !usedByColumn
            ) {
              return;
            }

            const itemName =
              String(
                row[itemColumn] ?? ""
              ).trim();

            if (!itemName) {
              return;
            }

            const usedBy =
              String(
                row[usedByColumn] ?? ""
              ).trim();

            const normalizedUsedBy =
              normalizeText(usedBy);

            const isUnassigned =
              !usedBy ||
              unassignedValues.has(
                normalizedUsedBy
              );

            if (!isUnassigned) {
              return;
            }

            const quantityColumn =
              findQuantityColumn(row);

            const quantity =
              quantityColumn
                ? numberFromValue(
                    row[quantityColumn]
                  )
                : null;

            const availableQuantity =
              quantity === null
                ? 1
                : quantity;

            if (availableQuantity <= 0) {
              return;
            }

            total +=
              availableQuantity;

            details.push(
              `${itemName}: ${availableQuantity}` +
              `${usedBy ? ` (${usedBy})` : ""}`
            );

            if (
              !usedSheets.includes(
                sheetName
              )
            ) {
              usedSheets.push(
                sheetName
              );
            }
          }
        );
      }
    );

    if (!details.length) {
      return (
        "I couldn't find any clearly unassigned items " +
        "with available stock."
      );
    }

    return [
      `${total} item${total === 1 ? "" : "s"} are currently unassigned/available:`,
      "",
      ...details.slice(0, 30),
      "",
      `Source: ${usedSheets.join(", ")}`,
    ].join("\n");
  }


  // ---------------------------------------------------------
  // ASSIGNED TO A SPECIFIC PERSON / TEAM — LOCAL, $0 API
  // Examples:
  // "Show all items assigned to Marketing."
  // "What is Academic using?"
  // ---------------------------------------------------------

  if (asksAssignment) {
    const assignmentStopWords =
      new Set([
        "who",
        "and",
        "currently",
        "using",
        "used",
        "by",
        "assigned",
        "allocated",
        "to",
        "issued",
        "items",
        "item",
        "show",
        "all",
        "what",
        "is",
        "are",
        "how",
        "many",
        "laptop",
        "laptops",
      ]);

    const targetWords =
      normalizedQuestion
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .filter(
          (word) =>
            word.length > 1 &&
            !assignmentStopWords.has(
              word
            )
        );

    const relevantData =
      getRelevantSpreadsheetData(
        question
      );

    const grouped = {};
    const details = [];
    let totalAssigned = 0;
    const usedSheets = [];

    Object.entries(
      relevantData
    ).forEach(
      ([sheetName, sheetRows]) => {
        (sheetRows || []).forEach(
          (row) => {
            const usedByColumn =
              findUsedByColumn(row);

            if (!usedByColumn) {
              return;
            }

            const usedBy =
              String(
                row[usedByColumn] ?? ""
              ).trim();

            if (!usedBy) {
              return;
            }

            const normalizedUsedBy =
              normalizeText(
                usedBy
              );

            if (
              unassignedValues.has(
                normalizedUsedBy
              )
            ) {
              return;
            }

            if (
              targetWords.length &&
              !targetWords.some(
                (word) =>
                  normalizedUsedBy.includes(
                    word
                  )
              )
            ) {
              return;
            }

            const quantityColumn =
              findQuantityColumn(row);

            const rowQuantity =
              quantityColumn
                ? numberFromValue(
                    row[quantityColumn]
                  )
                : null;

            const itemName =
              getItemName(
                row,
                "Item"
              );

            /*
             * If the user asks for a specific team/person,
             * extract only the quantity attached to that
             * team/person from text such as:
             *
             * "Academic 2, Marketing 3"
             * "Reception 1, GM 1, Marketing 1"
             *
             * Never count the entire row quantity just
             * because the target word appears somewhere.
             */
            if (targetWords.length) {
              const target =
                targetWords.join(" ");

              const escapedTarget =
                target.replace(
                  /[.*+?^${}()|[\]\\]/g,
                  "\\$&"
                );

              const quantityPattern =
                new RegExp(
                  `(?:^|[,;/|])\\s*${escapedTarget}(?:\\s+team)?\\s*[:=-]?\\s*(\\d+(?:\\.\\d+)?)\\b`,
                  "i"
                );

              const quantityMatch =
                usedBy.match(
                  quantityPattern
                );

              if (quantityMatch) {
                const targetQuantity =
                  Number(
                    quantityMatch[1]
                  );

                totalAssigned +=
                  targetQuantity;

                grouped[target] =
                  (grouped[target] || 0) +
                  targetQuantity;

                details.push(
                  `${itemName}: ${targetQuantity} → ${usedBy}`
                );

                if (
                  !usedSheets.includes(
                    sheetName
                  )
                ) {
                  usedSheets.push(
                    sheetName
                  );
                }

                return;
              }

              /*
               * A simple single assignment such as
               * "Marketing team" can safely use the
               * row quantity.
               */
              const assignmentParts =
                usedBy
                  .split(/[,;/|]/)
                  .map(
                    (part) =>
                      part.trim()
                  )
                  .filter(Boolean);

              const isSimpleTarget =
                assignmentParts.length === 1 &&
                targetWords.some(
                  (word) =>
                    normalizedUsedBy.includes(
                      word
                    )
                );

              if (isSimpleTarget) {
                const targetQuantity =
                  rowQuantity === null
                    ? 1
                    : rowQuantity;

                totalAssigned +=
                  targetQuantity;

                grouped[target] =
                  (grouped[target] || 0) +
                  targetQuantity;

                details.push(
                  `${itemName}: ${targetQuantity} → ${usedBy}`
                );

                if (
                  !usedSheets.includes(
                    sheetName
                  )
                ) {
                  usedSheets.push(
                    sheetName
                  );
                }

                return;
              }

              /*
               * Example: "Academic, Marketing, GM"
               * contains the target but gives no split.
               * Keep it visible as ambiguous, but do not
               * add any guessed quantity to the total.
               */
              details.push(
                `${itemName}: quantity unclear → ${usedBy}`
              );

              if (
                !usedSheets.includes(
                  sheetName
                )
              ) {
                usedSheets.push(
                  sheetName
                );
              }

              return;
            }

            const assignedQuantity =
              rowQuantity === null
                ? 1
                : rowQuantity;

            totalAssigned +=
              assignedQuantity;

            grouped[usedBy] =
              (grouped[usedBy] || 0) +
              assignedQuantity;

            details.push(
              `${itemName}: ${assignedQuantity} → ${usedBy}`
            );

            if (
              !usedSheets.includes(
                sheetName
              )
            ) {
              usedSheets.push(
                sheetName
              );
            }
          }
        );
      }
    );

    if (
      totalAssigned > 0 ||
      details.length
    ) {
      const heading =
        targetWords.length
          ? `${totalAssigned} confirmed item${totalAssigned === 1 ? "" : "s"} assigned to ${targetWords.join(" ")}:`
          : `${totalAssigned} item${totalAssigned === 1 ? "" : "s"} are currently assigned:`;

      const summary =
        Object.entries(grouped)
          .map(
            ([usedBy, quantity]) =>
              `${usedBy}: ${quantity}`
          )
          .join(" | ");

      return [
        heading,
        "",
        ...details.slice(0, 25),
        ...(summary
          ? [
              "",
              `Assignment summary: ${summary}`,
            ]
          : []),
        "",
        `Source: ${usedSheets.join(", ")}`,
      ].join("\n");
    }
  }


  // ---------------------------------------------------------
  // TOTAL INVENTORY — LOCAL, $0 API
  // ---------------------------------------------------------

  if (asksTotalInventory) {
    let total = 0;
    let countedRows = 0;
    const usedSheets = [];

    const explicitlyNamedSheets =
      sheetsToCheck.filter(
        ([sheetName]) =>
          normalizedQuestion.includes(
            normalizeText(sheetName)
          )
      );

    const totalSheetsToCheck =
      explicitlyNamedSheets.length
        ? explicitlyNamedSheets
        : sheetsToCheck;

    totalSheetsToCheck.forEach(
      ([sheetName, sheetRows]) => {
        (sheetRows || []).forEach(
          (row) => {
            const itemColumn =
              findItemColumn(row);

            const quantityColumn =
              findQuantityColumn(row);

            if (
              !itemColumn ||
              !quantityColumn
            ) {
              return;
            }

            const itemName =
              String(
                row[itemColumn] ?? ""
              ).trim();

            const quantity =
              numberFromValue(
                row[quantityColumn]
              );

            if (
              !itemName ||
              quantity === null
            ) {
              return;
            }

            total += quantity;
            countedRows += 1;

            if (
              !usedSheets.includes(
                sheetName
              )
            ) {
              usedSheets.push(
                sheetName
              );
            }
          }
        );
      }
    );

    if (countedRows > 0) {
      /*
       * Detect likely overlap between generic/grouped rows
       * and more specific rows, for example:
       *
       * "Laptop & Computers" + "Laptop (Samantha)"
       * "Mobile" + "Mobile (Lakshita)"
       *
       * We still show the raw Stock in Hand total, but we
       * do not claim it is a unique physical-item total.
       */
      const normalizedItems = [];

      totalSheetsToCheck.forEach(
        ([sheetName, sheetRows]) => {
          (sheetRows || []).forEach(
            (row) => {
              const itemColumn =
                findItemColumn(row);

              const quantityColumn =
                findQuantityColumn(row);

              if (
                !itemColumn ||
                !quantityColumn
              ) {
                return;
              }

              const itemName =
                String(
                  row[itemColumn] ?? ""
                ).trim();

              const quantity =
                numberFromValue(
                  row[quantityColumn]
                );

              if (
                !itemName ||
                quantity === null
              ) {
                return;
              }

              const normalizedItem =
                normalizeText(itemName);

              normalizedItems.push({
                itemName,
                normalizedItem,
                quantity,
                sheetName,
              });
            }
          );
        }
      );

      const overlapGroups = [];

      const genericPatterns = [
        {
          label:
            "Laptop",
          matches:
            (name) =>
              name.includes("laptop"),
        },
        {
          label:
            "Mobile",
          matches:
            (name) =>
              name.includes("mobile"),
        },
        {
          label:
            "Computer",
          matches:
            (name) =>
              name.includes("computer"),
        },
      ];

      genericPatterns.forEach(
        ({
          label,
          matches,
        }) => {
          const related =
            normalizedItems.filter(
              (item) =>
                matches(
                  item.normalizedItem
                )
            );

          if (
            related.length < 2
          ) {
            return;
          }

          const hasGeneric =
            related.some(
              (item) => {
                const name =
                  item.normalizedItem;

                return (
                  name ===
                    label.toLowerCase() ||
                  name.includes(
                    `${label.toLowerCase()} &`
                  ) ||
                  name.includes(
                    `& ${label.toLowerCase()}`
                  ) ||
                  name ===
                    `${label.toLowerCase()}s`
                );
              }
            );

          const hasSpecific =
            related.some(
              (item) =>
                item.normalizedItem.includes(
                  "("
                ) ||
                item.normalizedItem.includes(
                  ")"
                )
            );

          if (
            hasGeneric &&
            hasSpecific
          ) {
            overlapGroups.push({
              label,
              rows:
                related,
            });
          }
        }
      );

      if (
        overlapGroups.length
      ) {
        const warningLines = [];

        overlapGroups.forEach(
          (group) => {
            warningLines.push(
              `${group.label}:`
            );

            group.rows.forEach(
              (item) => {
                warningLines.push(
                  `- ${item.itemName}: ${item.quantity}`
                );
              }
            );
          }
        );

        return [
          `Raw Stock in Hand total: ${total}`,
          `Counted inventory rows: ${countedRows}`,
          "",
          "⚠️ Possible overlap detected:",
          ...warningLines,
          "",
          "Because grouped rows and named/specific rows may represent the same physical items, I cannot confirm the raw total as the unique physical-item total.",
          "",
          `Source: ${usedSheets.join(", ")}`,
        ].join("\n");
      }

      return [
        `Total current inventory quantity: ${total}`,
        `Counted inventory rows: ${countedRows}`,
        `Source: ${usedSheets.join(", ")}`,
      ].join("\n");
    }
  }


  // ---------------------------------------------------------
  // CURRENT STOCK / SPECIFIC ITEM — LOCAL, $0 API
  // Examples:
  // "How many mobiles do we have?"
  // "How many HDMI connectors are available?"
  // ---------------------------------------------------------

  if (asksCurrentStock) {
    /*
     * Current-stock questions must never mix
     * purchase-history rows with inventory rows.
     *
     * Search only inventory-like sheets such as
     * Electronics / Inventory / Stock / Assets.
     */
    const currentStockData = {};

    sheetsToCheck.forEach(
      ([sheetName, sheetRows]) => {
        const matchingRows =
          (sheetRows || []).filter(
            (row) =>
              rowMatchesKeywords(
                row,
                getQuestionKeywords(
                  question
                )
              )
          );

        if (matchingRows.length) {
          currentStockData[
            sheetName
          ] =
            matchingRows.slice(
              0,
              30
            );
        }
      }
    );

    /*
     * If keyword matching found nothing,
     * do not fall back to purchase sheets.
     * Use the inventory sheets only.
     */
    const relevantData =
      Object.keys(
        currentStockData
      ).length
        ? currentStockData
        : Object.fromEntries(
            sheetsToCheck.map(
              ([
                sheetName,
                sheetRows,
              ]) => [
                sheetName,
                (sheetRows || [])
                  .slice(0, 30),
              ]
            )
          );

    let total = 0;
    let quantityFound = false;
    const details = [];
    const usedSheets = [];

    Object.entries(
      relevantData
    ).forEach(
      ([sheetName, sheetRows]) => {
        (sheetRows || []).forEach(
          (row) => {
            const quantityColumn =
              findQuantityColumn(row);

            const itemColumn =
              findItemColumn(row);

            if (
              !quantityColumn ||
              !itemColumn
            ) {
              return;
            }

            const itemName =
              String(
                row[itemColumn] ?? ""
              ).trim();

            if (!itemName) {
              return;
            }

            const quantity =
              numberFromValue(
                row[quantityColumn]
              );

            if (quantity === null) {
              return;
            }

            quantityFound = true;
            total += quantity;

            if (
              !usedSheets.includes(
                sheetName
              )
            ) {
              usedSheets.push(
                sheetName
              );
            }

            details.push(
              `${itemName}: ${quantity}`
            );
          }
        );
      }
    );

    /*
     * CATEGORY-SPECIFIC CURRENT STOCK — LOCAL, $0 API
     *
     * Examples:
     * "How many laptops do we currently have in stock?"
     * "How many mobiles do we have in stock?"
     * "How many TVs do we have?"
     * "How many hard disks are in stock?"
     *
     * This runs before the generic current-stock total return.
     */
    const inventoryCategoryAliases = [
      {
        label: "Laptop",
        terms: [
          "laptop",
          "laptops",
          "computer",
          "computers",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item.includes(
              "laptop"
            ) ||
            item.includes(
              "computer"
            )
          );
        },
      },
      {
        label: "Mobile",
        terms: [
          "mobile",
          "mobiles",
          "phone",
          "phones",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item === "mobile" ||
            item.startsWith(
              "mobile "
            ) ||
            item === "phone" ||
            item.startsWith(
              "phone "
            )
          );
        },
      },
      {
        label: "TV",
        terms: [
          "tv",
          "tvs",
          "television",
          "televisions",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item === "tv" ||
            item === "television"
          );
        },
      },
      {
        label: "Hard Disk",
        terms: [
          "hard disk",
          "hard disks",
          "hard drive",
          "hard drives",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item === "hard disk" ||
            item.startsWith(
              "hard disk "
            ) ||
            item === "hard drive" ||
            item.startsWith(
              "hard drive "
            )
          );
        },
      },
      {
        label: "Printer",
        terms: [
          "printer",
          "printers",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item === "printer" ||
            item.startsWith(
              "printer "
            )
          );
        },
      },
    ];

    const requestedInventoryCategory =
      inventoryCategoryAliases.find(
        (category) =>
          category.terms.some(
            (term) =>
              normalizedQuestion.includes(
                term
              )
          )
      );

    const asksCategoryStock =
      Boolean(
        requestedInventoryCategory
      ) &&
      (
        normalizedQuestion.includes(
          "stock"
        ) ||
        normalizedQuestion.includes(
          "how many"
        ) ||
        normalizedQuestion.includes(
          "have"
        ) ||
        normalizedQuestion.includes(
          "available"
        )
      ) &&
      !normalizedQuestion.includes(
        "using"
      ) &&
      !normalizedQuestion.includes(
        "assigned"
      ) &&
      !normalizedQuestion.includes(
        "not being used"
      ) &&
      !normalizedQuestion.includes(
        "unassigned"
      );

    if (asksCategoryStock) {
      const matchingRows = [];

      sheetsToCheck.forEach(
        ([sheetName, rows]) => {
          (rows || []).forEach(
            (row) => {
              const itemColumn =
                findItemColumn(
                  row
                );

              const quantityColumn =
                findQuantityColumn(
                  row
                );

              if (
                !itemColumn ||
                !quantityColumn
              ) {
                return;
              }

              const itemName =
                String(
                  row[
                    itemColumn
                  ] ?? ""
                ).trim();

              if (!itemName) {
                return;
              }

              const matchesCategory =
                requestedInventoryCategory
                  .matchesItem(
                    itemName
                  );

              if (
                !matchesCategory
              ) {
                return;
              }

              const stock =
                numberFromValue(
                  row[
                    quantityColumn
                  ]
                );

              if (
                stock === null
              ) {
                return;
              }

              matchingRows.push({
                sheetName,
                itemName,
                stock,
              });
            }
          );
        }
      );

      if (!matchingRows.length) {
        return [
          `I could not find any ${requestedInventoryCategory.label.toLowerCase()} stock rows in the selected inventory data.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const total =
        matchingRows.reduce(
          (sum, item) =>
            sum +
            item.stock,
          0
        );

      const normalizedCategory =
        requestedInventoryCategory
          .label
          .toLowerCase();

      /*
       * Overlap warning:
       * grouped category rows + named/specific rows may represent
       * the same physical assets.
       *
       * Example:
       * Laptop & Computers: 5
       * Laptop (Samantha): 1
       * Laptop (Lakshita): 1
       *
       * In that case, show a RAW total rather than claiming a
       * confirmed unique physical-item count.
       */
      const hasGroupedRow =
        matchingRows.some(
          (item) => {
            const name =
              normalizeText(
                item.itemName
              );

            if (
              normalizedCategory ===
              "laptop"
            ) {
              return (
                name ===
                  "laptop & computers" ||
                name ===
                  "laptop and computers" ||
                name ===
                  "laptop" ||
                name ===
                  "computers"
              );
            }

            if (
              normalizedCategory ===
              "mobile"
            ) {
              return (
                name === "mobile" ||
                name === "phone"
              );
            }

            return false;
          }
        );

      const hasSpecificNamedRows =
        matchingRows.some(
          (item) => {
            const name =
              normalizeText(
                item.itemName
              );

            if (
              normalizedCategory ===
              "laptop"
            ) {
              return (
                name.startsWith(
                  "laptop ("
                ) ||
                name.startsWith(
                  "computer ("
                )
              );
            }

            if (
              normalizedCategory ===
              "mobile"
            ) {
              return (
                name.startsWith(
                  "mobile ("
                ) ||
                name.startsWith(
                  "phone ("
                )
              );
            }

            return false;
          }
        );

      const possibleOverlap =
        hasGroupedRow &&
        hasSpecificNamedRows;

      if (possibleOverlap) {
        return [
          `Raw ${normalizedCategory} stock total: ${total}`,
          "",
          ...matchingRows.map(
            (item) =>
              `${item.itemName}: ${item.stock}`
          ),
          "",
          "⚠️ Possible overlap detected:",
          "Grouped rows and named/specific rows may represent the same physical items.",
          "I cannot confirm the raw total as the unique physical-item total.",
          "",
          `Source: ${[
            ...new Set(
              matchingRows.map(
                (item) =>
                  item.sheetName
              )
            ),
          ].join(", ")}`,
        ].join("\n");
      }

      return [
        `Current ${normalizedCategory} stock total: ${total}`,
        "",
        ...matchingRows.map(
          (item) =>
            `${item.itemName}: ${item.stock}`
        ),
        "",
        `Source: ${[
          ...new Set(
            matchingRows.map(
              (item) =>
                item.sheetName
            )
          ),
        ].join(", ")}`,
      ].join("\n");
    }


    if (quantityFound) {
      return [
        `Current stock total: ${total}`,
        "",
        ...details.slice(0, 20),
        "",
        `Source: ${usedSheets.join(", ")}`,
      ].join("\n");
    }
  }


  /*
   * PURCHASES / NEW PURCHASE — LOCAL, $0 API
   *
   * Handles:
   * - What items did we purchase?
   * - How many laptops did we purchase?
   * - Show me the recent purchases.
   *
   * Purchase amount does NOT imply payment status.
   */
  const purchaseSpendCategoryIntent =
    (
      normalizedQuestion.includes("spend") ||
      normalizedQuestion.includes("spent")
    ) &&
    [
      "laptop",
      "laptops",
      "computer",
      "computers",
      "mobile",
      "mobiles",
      "phone",
      "phones",
      "tv",
      "tvs",
      "television",
      "televisions",
      "hard disk",
      "hard disks",
      "hard drive",
      "hard drives",
      "printer",
      "printers",
    ].some(
      (word) =>
        normalizedQuestion.includes(
          word
        )
    );

  const purchaseIntent =
    normalizedQuestion.includes("purchase") ||
    normalizedQuestion.includes("purchased") ||
    normalizedQuestion.includes("bought") ||
    normalizedQuestion.includes("buy") ||
    purchaseSpendCategoryIntent;

  if (purchaseIntent) {
    const allWorkbookSheets =
      Object.entries(
        workbookData || {}
      );

    const namedPurchaseSheets =
      allWorkbookSheets.filter(
        ([sheetName]) => {
          const name =
            normalizeText(
              sheetName
            );

          return (
            name.includes("new purchase") ||
            name.includes("purchase") ||
            name.includes("purchased") ||
            name.includes("procurement")
          );
        }
      );

    /*
     * Fallback: if the sheet was renamed, detect a purchase-like table
     * from its columns (for example MATERIAL + UNIT/QUANTITY + TOTAL/AMOUNT).
     */
    const structuralPurchaseSheets =
      allWorkbookSheets.filter(
        ([, sheetRows]) =>
          (sheetRows || [])
            .slice(0, 10)
            .some(
              (row) => {
                const keys =
                  Object.keys(
                    row || {}
                  ).map(
                    (key) =>
                      normalizeText(
                        key
                      )
                  );

                const hasItem =
                  keys.some(
                    (key) =>
                      key === "material" ||
                      key === "item" ||
                      key === "item name" ||
                      key === "product" ||
                      key === "description"
                  );

                const hasQuantity =
                  keys.some(
                    (key) =>
                      key === "unit" ||
                      key === "units" ||
                      key === "quantity" ||
                      key === "qty"
                  );

                const hasAmount =
                  keys.some(
                    (key) =>
                      key === "total" ||
                      key === "amount" ||
                      key.includes("total amount") ||
                      key.includes("purchase amount") ||
                      key.includes("cost") ||
                      key.includes("price")
                  );

                return (
                  hasItem &&
                  hasQuantity &&
                  hasAmount
                );
              }
            )
      );

    const purchaseSheets =
      namedPurchaseSheets.length
        ? namedPurchaseSheets
        : structuralPurchaseSheets;

    if (!purchaseSheets.length) {
      return [
        "I could not find a purchase sheet in the active workbook.",
        "",
        `Available sheets: ${Object.keys(workbookData || {}).join(", ") || "none"}`,
        "",
        "No paid API was used.",
      ].join("\n");
    }

    const purchaseRows = [];

    purchaseSheets.forEach(
      ([sheetName, rows]) => {
        (rows || []).forEach(
          (row) => {
            const itemColumn =
              findItemColumn(
                row
              );

            if (!itemColumn) {
              return;
            }

            const itemName =
              String(
                row[
                  itemColumn
                ] ?? ""
              ).trim();

            if (!itemName) {
              return;
            }

            const quantityColumn =
              findQuantityColumn(
                row
              );

            const quantity =
              quantityColumn
                ? numberFromValue(
                    row[
                      quantityColumn
                    ]
                  )
                : null;

            const rowKeys =
              Object.keys(
                row || {}
              );

            const amountColumn =
              rowKeys.find(
                (key) => {
                  const k =
                    normalizeText(
                      key
                    );

                  return (
                    k === "total" ||
                    k === "amount" ||
                    k.includes(
                      "purchase amount"
                    ) ||
                    k.includes(
                      "total amount"
                    ) ||
                    k.includes(
                      "cost"
                    ) ||
                    k.includes(
                      "price"
                    )
                  );
                }
              );

            const rawAmount =
              amountColumn
                ? row[
                    amountColumn
                  ]
                : null;

            const amount =
              numberFromValue(
                rawAmount
              );

            const dateColumn =
              rowKeys.find(
                (key) => {
                  const k =
                    normalizeText(
                      key
                    );

                  return (
                    k === "date" ||
                    k.includes(
                      "purchase date"
                    ) ||
                    k.includes(
                      "date of purchase"
                    )
                  );
                }
              );

            const dateValue =
              dateColumn
                ? row[
                    dateColumn
                  ]
                : "";

            purchaseRows.push({
              sheetName,
              itemName,
              quantity,
              amount,
              rawAmount,
              dateValue,
            });
          }
        );
      }
    );

    if (!purchaseRows.length) {
      return [
        "I found the purchase sheet but could not identify purchase rows.",
        "",
        "No paid API was used.",
      ].join("\n");
    }

    /*
     * GROUP IDENTICAL PURCHASE ITEMS FOR DISPLAY
     *
     * Example:
     * Game 1 + Game 1 + Game 1 + Game 1
     * becomes Game: 4 with the numeric TOTAL values added together.
     *
     * Named rows such as Laptop (Samantha) and Laptop (Lakshita)
     * remain separate because their item names are different.
     */
    const groupedPurchaseMap =
      new Map();

    purchaseRows.forEach(
      (item) => {
        const key =
          normalizeText(
            item.itemName
          );

        if (
          !groupedPurchaseMap.has(
            key
          )
        ) {
          groupedPurchaseMap.set(
            key,
            {
              sheetName:
                item.sheetName,

              itemName:
                item.itemName,

              quantity:
                0,

              quantityKnown:
                true,

              amount:
                0,

              numericAmountKnown:
                true,

              rawAmounts:
                [],

              dateValues:
                [],
            }
          );
        }

        const grouped =
          groupedPurchaseMap.get(
            key
          );

        if (
          item.quantity ===
          null
        ) {
          grouped.quantityKnown =
            false;
        } else {
          grouped.quantity +=
            item.quantity;
        }

        if (
          item.amount ===
          null
        ) {
          grouped.numericAmountKnown =
            false;

          const raw =
            String(
              item.rawAmount ?? ""
            ).trim();

          if (raw) {
            grouped.rawAmounts.push(
              raw
            );
          }
        } else {
          grouped.amount +=
            item.amount;
        }

        const dateText =
          String(
            item.dateValue ?? ""
          ).trim();

        if (
          dateText &&
          !grouped.dateValues.includes(
            dateText
          )
        ) {
          grouped.dateValues.push(
            dateText
          );
        }
      }
    );

    const groupedPurchaseRows =
      Array.from(
        groupedPurchaseMap.values()
      );


    const purchasedCategoryAliases = [
      {
        label: "Laptop",
        terms: [
          "laptop",
          "laptops",
          "computer",
          "computers",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item.includes(
              "laptop"
            ) ||
            item.includes(
              "computer"
            )
          );
        },
      },
      {
        label: "Mobile",
        terms: [
          "mobile",
          "mobiles",
          "phone",
          "phones",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item === "mobile" ||
            item.startsWith(
              "mobile "
            ) ||
            item === "phone" ||
            item.startsWith(
              "phone "
            )
          );
        },
      },
      {
        label: "TV",
        terms: [
          "tv",
          "tvs",
          "television",
          "televisions",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item === "tv" ||
            item ===
              "television"
          );
        },
      },
      {
        label: "Hard Disk",
        terms: [
          "hard disk",
          "hard disks",
          "hard drive",
          "hard drives",
        ],
        matchesItem: (itemName) => {
          const item =
            normalizeText(
              itemName
            );

          return (
            item.includes(
              "hard disk"
            ) ||
            item.includes(
              "hard drive"
            )
          );
        },
      },
      {
        label: "Printer",
        terms: [
          "printer",
          "printers",
        ],
        matchesItem: (itemName) =>
          normalizeText(
            itemName
          ).includes(
            "printer"
          ),
      },
    ];

    const requestedPurchaseCategory =
      purchasedCategoryAliases.find(
        (category) =>
          category.terms.some(
            (term) =>
              normalizedQuestion.includes(
                term
              )
          )
      );

    const asksPurchaseCount =
      Boolean(
        requestedPurchaseCategory
      ) &&
      (
        normalizedQuestion.includes(
          "how many"
        ) ||
        normalizedQuestion.includes(
          "count"
        ) ||
        normalizedQuestion.includes(
          "quantity"
        )
      );

    if (asksPurchaseCount) {
      const matches =
        purchaseRows.filter(
          (item) =>
            requestedPurchaseCategory
              .matchesItem(
                item.itemName
              )
        );

      if (!matches.length) {
        return [
          `No ${requestedPurchaseCategory.label.toLowerCase()} purchases were found.`,
          "",
          `Source: ${purchaseSheets
            .map(
              ([name]) =>
                name
            )
            .join(", ")}`,
        ].join("\n");
      }

      let total = 0;
      let allQuantitiesKnown =
        true;

      matches.forEach(
        (item) => {
          if (
            item.quantity ===
            null
          ) {
            allQuantitiesKnown =
              false;
          } else {
            total +=
              item.quantity;
          }
        }
      );

      return [
        allQuantitiesKnown
          ? `Purchased ${requestedPurchaseCategory.label.toLowerCase()} total: ${total}`
          : `Purchased ${requestedPurchaseCategory.label.toLowerCase()} quantity: partially known`,
        "",
        ...matches.map(
          (item) =>
            `${item.itemName}: ${item.quantity === null ? "quantity not specified" : item.quantity}`
        ),
        "",
        `Source: ${[
          ...new Set(
            matches.map(
              (item) =>
                item.sheetName
            )
          ),
        ].join(", ")}`,
      ].join("\n");
    }

    /*
     * ---------------------------------------------------------
     * CATEGORY PURCHASE SPEND — LOCAL, $0 API
     * ---------------------------------------------------------
     *
     * Examples:
     * - How much did we spend on laptops?
     * - How much did we spend on mobiles?
     *
     * Only numeric TOTAL/amount values are included.
     */
    const asksCategoryPurchaseSpend =
      Boolean(
        requestedPurchaseCategory
      ) &&
      (
        normalizedQuestion.includes(
          "how much"
        ) ||
        normalizedQuestion.includes(
          "spend"
        ) ||
        normalizedQuestion.includes(
          "spent"
        ) ||
        normalizedQuestion.includes(
          "total cost"
        ) ||
        normalizedQuestion.includes(
          "total amount"
        )
      );

    if (asksCategoryPurchaseSpend) {
      const categoryRows =
        purchaseRows.filter(
          (item) =>
            requestedPurchaseCategory
              .matchesItem(
                item.itemName
              )
        );

      if (!categoryRows.length) {
        return [
          `No ${requestedPurchaseCategory.label.toLowerCase()} purchases were found.`,
          "",
          `Source: ${purchaseSheets
            .map(
              ([name]) => name
            )
            .join(", ")}`,
        ].join("\n");
      }

      let numericTotal = 0;
      let numericRows = 0;

      const excludedRows = [];

      categoryRows.forEach(
        (item) => {
          if (
            item.amount !== null
          ) {
            numericTotal +=
              item.amount;

            numericRows += 1;
            return;
          }

          const raw =
            String(
              item.rawAmount ?? ""
            ).trim();

          if (raw) {
            excludedRows.push(
              `${item.itemName}: ${raw}`
            );
          }
        }
      );

      if (!numericRows) {
        return [
          `I found ${requestedPurchaseCategory.label.toLowerCase()} purchase records, but no numeric purchase amounts were available.`,
          "",
          "No paid API was used.",
          "",
          `Source: ${purchaseSheets
            .map(
              ([name]) => name
            )
            .join(", ")}`,
        ].join("\n");
      }

      const lines = [
        `Recorded ${requestedPurchaseCategory.label.toLowerCase()} purchase total: ₹${Number(
          numericTotal
        ).toLocaleString(
          "en-IN"
        )}`,
        "",
        ...categoryRows.map(
          (item) => {
            const amountText =
              item.amount !== null
                ? `₹${Number(
                    item.amount
                  ).toLocaleString(
                    "en-IN"
                  )}`
                : String(
                    item.rawAmount ?? ""
                  ).trim() ||
                  "amount not specified";

            return `${item.itemName}: ${amountText}`;
          }
        ),
      ];

      if (excludedRows.length) {
        lines.push(
          "",
          "Not included in the numeric total:",
          ...excludedRows
        );
      }

      lines.push(
        "",
        "Purchase amount does not confirm that payment has been completed.",
        "",
        `Source: ${purchaseSheets
          .map(
            ([name]) => name
          )
          .join(", ")}`
      );

      return lines.join("\n");
    }

    /*
     * ---------------------------------------------------------
     * MOST EXPENSIVE / HIGHEST TOTAL PURCHASE — LOCAL, $0 API
     * ---------------------------------------------------------
     *
     * Uses individual recorded purchase rows with numeric amounts.
     * Ties are shown instead of guessed.
     */
    const asksMostExpensivePurchase =
      (
        normalizedQuestion.includes(
          "most expensive"
        ) ||
        normalizedQuestion.includes(
          "highest total"
        ) ||
        normalizedQuestion.includes(
          "highest purchase"
        ) ||
        normalizedQuestion.includes(
          "largest purchase"
        ) ||
        normalizedQuestion.includes(
          "highest amount"
        )
      ) &&
      purchaseIntent;

    if (asksMostExpensivePurchase) {
      const numericPurchaseRows =
        purchaseRows.filter(
          (item) =>
            item.amount !== null
        );

      if (!numericPurchaseRows.length) {
        return [
          "I found purchase records, but no numeric purchase amounts were available.",
          "",
          "No paid API was used.",
          "",
          `Source: ${purchaseSheets
            .map(
              ([name]) => name
            )
            .join(", ")}`,
        ].join("\n");
      }

      const highestAmount =
        Math.max(
          ...numericPurchaseRows.map(
            (item) =>
              item.amount
          )
        );

      const leaders =
        numericPurchaseRows.filter(
          (item) =>
            item.amount ===
            highestAmount
        );

      return [
        leaders.length === 1
          ? "Most expensive recorded purchase:"
          : "Highest recorded purchases:",
        "",
        ...leaders.map(
          (item) =>
            `${item.itemName} — ${item.quantity === null ? "quantity not specified" : item.quantity} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )}${String(item.dateValue ?? "").trim() ? ` — ${item.dateValue}` : ""}`
        ),
        "",
        "Based on the numeric TOTAL/amount recorded in New Purchase.",
        "Purchase amount does not confirm that payment has been completed.",
        "",
        `Source: ${purchaseSheets
          .map(
            ([name]) => name
          )
          .join(", ")}`
      ].join("\n");
    }


    /*
     * ---------------------------------------------------------
     * HOW MUCH DID WE SPEND ON PURCHASES?
     * ---------------------------------------------------------
     *
     * Sums only numeric TOTAL/amount values.
     * Non-numeric notes such as "In Stationory Bill" are excluded
     * from the numeric total and reported separately.
     *
     * Purchase amount does NOT confirm payment status.
     */
    const asksPurchaseSpend =
      !requestedPurchaseCategory &&
      (
        normalizedQuestion.includes(
          "how much"
        ) ||
        normalizedQuestion.includes(
          "total spend"
        ) ||
        normalizedQuestion.includes(
          "total spent"
        ) ||
        normalizedQuestion.includes(
          "spent on purchases"
        ) ||
        normalizedQuestion.includes(
          "purchase total"
        ) ||
        normalizedQuestion.includes(
          "total purchase amount"
        )
      ) &&
      purchaseIntent;

    if (asksPurchaseSpend) {
      let numericTotal = 0;
      let numericRows = 0;

      const excludedAmountRows =
        [];

      purchaseRows.forEach(
        (item) => {
          if (
            item.amount !== null
          ) {
            numericTotal +=
              item.amount;

            numericRows += 1;
            return;
          }

          const raw =
            String(
              item.rawAmount ?? ""
            ).trim();

          if (raw) {
            excludedAmountRows.push(
              `${item.itemName}: ${raw}`
            );
          }
        }
      );

      if (!numericRows) {
        return [
          "I found purchase records, but I could not identify any numeric purchase amounts.",
          "",
          "No paid API was used.",
          "",
          `Source: ${purchaseSheets
            .map(
              ([name]) => name
            )
            .join(", ")}`,
        ].join("\n");
      }

      const lines = [
        `Recorded numeric purchase total: ₹${Number(
          numericTotal
        ).toLocaleString(
          "en-IN"
        )}`,
        "",
        `Numeric purchase rows counted: ${numericRows}`,
      ];

      if (
        excludedAmountRows.length
      ) {
        lines.push(
          "",
          "Not included in the numeric total:",
          ...excludedAmountRows
        );
      }

      lines.push(
        "",
        "Purchase amount does not confirm that payment has been completed.",
        "",
        `Source: ${purchaseSheets
          .map(
            ([name]) => name
          )
          .join(", ")}`
      );

      return lines.join("\n");
    }


    const asksRecentPurchases =
      normalizedQuestion.includes(
        "recent purchase"
      ) ||
      normalizedQuestion.includes(
        "recent purchases"
      ) ||
      (
        normalizedQuestion.includes(
          "recent"
        ) &&
        purchaseIntent
      );

    if (asksRecentPurchases) {
      const rowsWithDates =
        purchaseRows.filter(
          (item) =>
            String(
              item.dateValue ?? ""
            ).trim()
        );

      const formatGroupedAmount =
        (item) => {
          if (
            item.numericAmountKnown
          ) {
            return `₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )}`;
          }

          const uniqueRawAmounts =
            [
              ...new Set(
                item.rawAmounts
              ),
            ];

          if (
            uniqueRawAmounts.length ===
            1
          ) {
            return (
              uniqueRawAmounts[0]
            );
          }

          if (
            uniqueRawAmounts.length >
            1
          ) {
            return uniqueRawAmounts.join(
              " + "
            );
          }

          return "amount not specified";
        };

      const formatGroupedQuantity =
        (item) =>
          item.quantityKnown
            ? item.quantity
            : "quantity not specified";

      const formatGroupedDates =
        (item) =>
          item.dateValues.length
            ? ` — ${item.dateValues.join(", ")}`
            : "";

      if (
        rowsWithDates.length !==
        purchaseRows.length
      ) {
        return [
          "Purchases recorded in New Purchase:",
          "",
          ...groupedPurchaseRows.map(
            (item) =>
              `${item.itemName} — ${formatGroupedQuantity(item)} — ${formatGroupedAmount(item)}${formatGroupedDates(item)}`
          ),
          "",
          "⚠️ Exact recency cannot be confirmed because some purchase rows do not have a date.",
          "Purchase amount does not confirm that payment has been completed.",
          "",
          `Source: ${purchaseSheets
            .map(
              ([name]) =>
                name
            )
            .join(", ")}`,
        ].join("\n");
      }

      return [
        "Recent purchases:",
        "",
        ...groupedPurchaseRows.map(
          (item) =>
            `${item.itemName} — ${formatGroupedQuantity(item)} — ${formatGroupedAmount(item)}${formatGroupedDates(item)}`
        ),
        "",
        "Purchase amount does not confirm that payment has been completed.",
        "",
        `Source: ${purchaseSheets
          .map(
            ([name]) =>
              name
          )
          .join(", ")}`,
      ].join("\n");
    }

    const asksListPurchases =
      normalizedQuestion.includes(
        "what items"
      ) ||
      normalizedQuestion.includes(
        "which items"
      ) ||
      normalizedQuestion.includes(
        "items did we purchase"
      ) ||
      normalizedQuestion.includes(
        "items we purchased"
      ) ||
      normalizedQuestion.includes(
        "show purchases"
      ) ||
      normalizedQuestion.includes(
        "show me purchases"
      );

    if (asksListPurchases) {
      return [
        "Items recorded as purchased:",
        "",
        ...groupedPurchaseRows.map(
          (item) =>
            `${item.itemName}: ${item.quantityKnown ? item.quantity : "quantity not specified"}`
        ),
        "",
        `Source: ${purchaseSheets
          .map(
            ([name]) =>
              name
          )
          .join(", ")}`,
      ].join("\n");
    }
  }


  /*
   * =========================================================
   * DOCUMENTS INTELLIGENCE — LOCAL, $0 API — V1
   * =========================================================
   */
  const documentIntent =
    normalizedQuestion.includes("document") ||
    normalizedQuestion.includes("documents") ||
    normalizedQuestion.includes("passport") ||
    normalizedQuestion.includes("expired") ||
    normalizedQuestion.includes("expiry") ||
    normalizedQuestion.includes("expiring soon") ||
    normalizedQuestion.includes("renewal required") ||
    normalizedQuestion.includes("confidential") ||
    normalizedQuestion.includes("no expiry") ||
    normalizedQuestion.includes("vendor document") ||
    normalizedQuestion.includes("owned by") ||
    normalizedQuestion.includes("expires first") ||
    normalizedQuestion.includes("next expiry") ||
    normalizedQuestion.includes("reviewed recently") ||
    normalizedQuestion.includes("compliance document") ||
    normalizedQuestion.includes("doc-");

  if (
    documentIntent ||
    (
      workbookType === "Documents" &&
      (
        normalizedQuestion.includes("show") ||
        normalizedQuestion.includes("details") ||
        normalizedQuestion.includes("renewal") ||
        normalizedQuestion.includes("employee")
      )
    )
  ) {
    const documentMasterEntry =
      Object.entries(workbookData || {}).find(([sheetName, rows]) => {
        if (normalizeText(sheetName).includes("document master")) {
          return true;
        }

        return (
          Array.isArray(rows) &&
          rows.slice(0, 5).some((row) => {
            const keys = Object.keys(row || {}).map((key) =>
              normalizeText(key)
            );

            return (
              keys.includes("document id") &&
              keys.includes("document name") &&
              keys.includes("document category") &&
              keys.includes("document status")
            );
          })
        );
      });

    if (!documentMasterEntry) {
      return {
        text:
          "I could not find a Document Master sheet in the active workbook. Please load the Documents tracker first.",
        action: "change-workbook",
      };
    }

    const [documentSheetName, documentRows] = documentMasterEntry;

    const findDocumentColumn = (row, aliases) => {
      const keys = Object.keys(row || {});
      const normalizedAliases = aliases.map((alias) =>
        normalizeText(alias)
      );

      const exact = keys.find((key) =>
        normalizedAliases.includes(normalizeText(key))
      );
      if (exact) return exact;

      return keys.find((key) => {
        const nk = normalizeText(key);
        return normalizedAliases.some(
          (alias) => alias.length >= 4 && nk.includes(alias)
        );
      });
    };

    const parseDocumentDate = (value) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
      }

      const raw = String(value ?? "").trim();
      if (!raw) return null;

      const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/);
      if (dmy) {
        const parsed = new Date(
          Number(dmy[3]),
          Number(dmy[2]) - 1,
          Number(dmy[1])
        );
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDocumentDate = (value) => {
      const date = parseDocumentDate(value);
      if (!date) return "not specified";

      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const records = (documentRows || [])
      .map((row) => {
        if (!row || typeof row !== "object") return null;

        const idCol = findDocumentColumn(row, ["Document ID"]);
        const nameCol = findDocumentColumn(row, ["Document Name"]);
        if (!idCol || !nameCol) return null;

        const documentId = String(row[idCol] ?? "").trim();
        const documentName = String(row[nameCol] ?? "").trim();
        if (!documentId || !documentName) return null;

        const get = (aliases) => {
          const col = findDocumentColumn(row, aliases);
          return col ? row[col] : "";
        };

        return {
          documentId,
          documentName,
          category: String(get(["Document Category"]) ?? "").trim(),
          relatedTo: String(get(["Related To"]) ?? "").trim(),
          personEntity: String(get(["Person / Entity"]) ?? "").trim(),
          issueDate: get(["Issue / Upload Date"]),
          expiryDate: get(["Expiry Date"]),
          status: String(get(["Document Status"]) ?? "").trim(),
          owner: String(get(["Owner"]) ?? "").trim(),
          storageLocation: String(get(["Storage Location"]) ?? "").trim(),
          renewalRequired: String(get(["Renewal Required"]) ?? "").trim(),
          confidentiality: String(get(["Confidentiality"]) ?? "").trim(),
          fileReference: String(get(["File / Link Reference"]) ?? "").trim(),
          lastReviewedDate: get(["Last Reviewed Date"]),
          daysToExpiry: numberFromValue(get(["Days to Expiry"])),
          remarks: String(get(["Remarks"]) ?? "").trim(),
        };
      })
      .filter(Boolean);

    if (!records.length) {
      return [
        "I found the Document Master sheet but could not identify document records.",
        "",
        "No paid API was used.",
      ].join("\n");
    }

    const q = normalizedQuestion;

    /*
     * DOCUMENTS V2 — confidentiality / ownership / dates / categories
     */

    if (
      q.includes("confidential document") ||
      q.includes("confidential documents") ||
      (
        q.includes("document") &&
        q.includes("confidential")
      ) ||
      (
        q.includes("documents") &&
        q.includes("confidential")
      )
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.confidentiality) === "confidential"
      );

      return [
        `Confidential documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.personEntity || x.relatedTo || "entity not specified"} — ${x.status || "status not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    const knownDocumentCategories =
      [
        ...new Set(
          records
            .map(
              (x) =>
                String(
                  x.category ?? ""
                ).trim()
            )
            .filter(Boolean)
        ),
      ].sort(
        (a, b) =>
          b.length -
          a.length
      );

    const requestedDocumentCategory =
      knownDocumentCategories.find(
        (category) => {
          const normalizedCategory =
            normalizeText(
              category
            );

          const pluralizedCategory =
            `${normalizedCategory}s`;

          return (
            q.includes(
              normalizedCategory
            ) ||
            q.includes(
              pluralizedCategory
            )
          );
        }
      );

    if (
      requestedDocumentCategory &&
      (
        q.includes("show") ||
        q.includes("list") ||
        q.includes("all") ||
        q.includes("document") ||
        q.includes("documents")
      )
    ) {
      const matches =
        records.filter(
          (x) =>
            normalizeText(
              x.category
            ) ===
            normalizeText(
              requestedDocumentCategory
            )
        );

      return [
        `${requestedDocumentCategory} documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.personEntity || x.relatedTo || "entity not specified"} — ${x.status || "status not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("no expiry") ||
      q.includes("without expiry") ||
      q.includes("do not expire")
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.status) === "no expiry"
      );

      return [
        `Documents with no expiry: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.category || "category not specified"} — ${x.personEntity || "entity not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("vendor document") ||
      q.includes("vendor documents") ||
      q.includes("belong to vendors")
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.relatedTo) === "vendor"
      );

      return [
        `Vendor documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.personEntity || "vendor not specified"} — ${x.status || "status not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    const ownerNames = [
      ...new Set(records.map((x) => x.owner).filter(Boolean)),
    ].sort((a, b) => b.length - a.length);

    const mentionedOwner =
      ownerNames.find((owner) => q.includes(normalizeText(owner))) ||
      null;

    if (
      mentionedOwner &&
      (
        q.includes("owned by") ||
        q.includes("owner") ||
        q.includes("documents owned")
      )
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.owner) === normalizeText(mentionedOwner)
      );

      return [
        `Documents owned by ${mentionedOwner}: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.status || "status not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("expires first") ||
      q.includes("expire first") ||
      q.includes("next document to expire") ||
      q.includes("next expiry")
    ) {
      const dated = records
        .map((x) => ({
          ...x,
          parsedExpiry: parseDocumentDate(x.expiryDate),
        }))
        .filter(
          (x) =>
            x.parsedExpiry &&
            normalizeText(x.status) !== "expired"
        )
        .sort(
          (a, b) =>
            a.parsedExpiry.getTime() - b.parsedExpiry.getTime()
        );

      if (!dated.length) {
        return [
          "I could not find a future dated document expiry.",
          "",
          `Source: ${documentSheetName}`,
        ].join("\n");
      }

      const firstDate = dated[0].parsedExpiry.getTime();
      const matches = dated.filter(
        (x) => x.parsedExpiry.getTime() === firstDate
      );

      return [
        matches.length === 1
          ? "Next document to expire:"
          : "Next documents to expire:",
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${formatDocumentDate(x.expiryDate)}${x.daysToExpiry !== null ? ` — ${x.daysToExpiry} days` : ""}`
        ),
        "",
        matches.length > 1 ? "Tie shown instead of guessed." : "",
        `Source: ${documentSheetName}`,
      ]
        .filter((line) => line !== "")
        .join("\n");
    }

    const nextDaysMatch =
      q.match(/next\s+(\d+)\s+days?/);

    if (
      nextDaysMatch &&
      (
        q.includes("expire") ||
        q.includes("expiry")
      )
    ) {
      const days = Number(nextDaysMatch[1]);

      const matches = records
        .filter(
          (x) =>
            x.daysToExpiry !== null &&
            x.daysToExpiry >= 0 &&
            x.daysToExpiry <= days
        )
        .sort(
          (a, b) =>
            a.daysToExpiry - b.daysToExpiry
        );

      return [
        `Documents expiring in the next ${days} days: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${formatDocumentDate(x.expiryDate)} — ${x.daysToExpiry} days`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("reviewed recently") ||
      q.includes("recently reviewed") ||
      q.includes("reviewed most recently") ||
      q.includes("most recently reviewed")
    ) {
      const reviewed = records
        .map((x) => ({
          ...x,
          parsedReview: parseDocumentDate(x.lastReviewedDate),
        }))
        .filter((x) => x.parsedReview)
        .sort(
          (a, b) =>
            b.parsedReview.getTime() - a.parsedReview.getTime()
        );

      if (!reviewed.length) {
        return [
          "I could not find recorded document review dates.",
          "",
          `Source: ${documentSheetName}`,
        ].join("\n");
      }

      const latestReview = reviewed[0].parsedReview.getTime();
      const matches = reviewed.filter(
        (x) => x.parsedReview.getTime() === latestReview
      );

      return [
        `Most recently reviewed documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — Reviewed: ${formatDocumentDate(x.lastReviewedDate)}`
        ),
        "",
        matches.length > 1 ? "Tie shown instead of guessed." : "",
        `Source: ${documentSheetName}`,
      ]
        .filter((line) => line !== "")
        .join("\n");
    }

    if (
      q.includes("compliance document") ||
      q.includes("compliance documents")
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.category) === "compliance"
      );

      return [
        `Compliance documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.status || "status not specified"} — Expiry: ${formatDocumentDate(x.expiryDate)}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      (q.includes("how many") || q.includes("count")) &&
      (q.includes("document") || q.includes("documents"))
    ) {
      const active = records.filter(
        (x) => normalizeText(x.status) === "active"
      ).length;
      const expiring = records.filter(
        (x) => normalizeText(x.status) === "expiring soon"
      ).length;
      const expired = records.filter(
        (x) => normalizeText(x.status) === "expired"
      ).length;
      const noExpiry = records.filter(
        (x) => normalizeText(x.status) === "no expiry"
      ).length;

      return [
        `Total documents: ${records.length}`,
        "",
        `Active: ${active} | Expiring Soon: ${expiring} | Expired: ${expired} | No Expiry: ${noExpiry}`,
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("expire soon") ||
      q.includes("expires soon") ||
      q.includes("expiring soon")
    ) {
      const matches = records
        .filter((x) => normalizeText(x.status) === "expiring soon")
        .sort((a, b) => {
          const da = parseDocumentDate(a.expiryDate)?.getTime() ?? Infinity;
          const db = parseDocumentDate(b.expiryDate)?.getTime() ?? Infinity;
          return da - db;
        });

      return [
        `Documents expiring soon: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — Expires: ${formatDocumentDate(x.expiryDate)}${x.daysToExpiry !== null ? ` — ${x.daysToExpiry} days` : ""}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("active") &&
      (
        q.includes("document") ||
        q.includes("documents")
      )
    ) {
      const matches =
        records.filter(
          (x) =>
            normalizeText(
              x.status
            ) === "active"
        );

      return [
        `Active documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.personEntity || x.relatedTo || "entity not specified"}${x.expiryDate ? ` — Expiry: ${formatDocumentDate(x.expiryDate)}` : ""}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("expired") &&
      (q.includes("document") || q.includes("documents"))
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.status) === "expired"
      );

      return [
        `Expired documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — Expired: ${formatDocumentDate(x.expiryDate)}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("employee document") ||
      q.includes("employee documents")
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.relatedTo) === "employee"
      );

      return [
        `Employee documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.personEntity || "person not specified"} — ${x.status || "status not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("need renewal") ||
      q.includes("needs renewal") ||
      q.includes("renewal required") ||
      q.includes("require renewal")
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.renewalRequired) === "yes"
      );

      return [
        `Documents requiring renewal: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.status || "status not specified"} — Expiry: ${formatDocumentDate(x.expiryDate)}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("passport document") ||
      q.includes("passport documents") ||
      (
        q.includes("show") &&
        q.includes("passport")
      )
    ) {
      const matches = records.filter(
        (x) => normalizeText(x.category) === "passport"
      );

      return [
        `Passport documents: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.personEntity || "person not specified"} — ${x.status || "status not specified"} — Expiry: ${formatDocumentDate(x.expiryDate)}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    const knownEntities = [
      ...new Set(records.map((x) => x.personEntity).filter(Boolean)),
    ].sort((a, b) => b.length - a.length);

    const mentionedEntity =
      knownEntities.find((name) => q.includes(normalizeText(name))) ||
      (() => {
        const matches = knownEntities.filter((name) => {
          const first = normalizeText(name).split(/\s+/)[0];
          return first.length >= 3 && q.includes(first);
        });
        return matches.length === 1 ? matches[0] : null;
      })();

    if (
      mentionedEntity &&
      (q.includes("document") || q.includes("documents"))
    ) {
      const matches = records.filter(
        (x) =>
          normalizeText(x.personEntity) === normalizeText(mentionedEntity)
      );

      return [
        `Documents for ${mentionedEntity}: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.documentId} — ${x.documentName} — ${x.category || "category not specified"} — ${x.status || "status not specified"}`
        ),
        "",
        `Source: ${documentSheetName}`,
      ].join("\n");
    }

    const idMatch = q.match(/\bdoc-\d+\b/i);
    const byId = idMatch
      ? records.find(
          (x) => normalizeText(x.documentId) === normalizeText(idMatch[0])
        )
      : null;

    const byName = [...records]
      .sort((a, b) => b.documentName.length - a.documentName.length)
      .find((x) => q.includes(normalizeText(x.documentName)));

    const selected = byId || byName;

    if (
      selected &&
      (q.includes("details") || q.includes("show") || q.includes("document"))
    ) {
      return [
        `${selected.documentName}`,
        "",
        `Document ID: ${selected.documentId}`,
        `Category: ${selected.category || "not specified"}`,
        `Related to: ${selected.relatedTo || "not specified"}`,
        `Person / Entity: ${selected.personEntity || "not specified"}`,
        `Issue / Upload date: ${formatDocumentDate(selected.issueDate)}`,
        `Expiry date: ${formatDocumentDate(selected.expiryDate)}`,
        `Status: ${selected.status || "not specified"}`,
        `Owner: ${selected.owner || "not specified"}`,
        `Storage: ${selected.storageLocation || "not specified"}`,
        `Renewal required: ${selected.renewalRequired || "not specified"}`,
        `Confidentiality: ${selected.confidentiality || "not specified"}`,
        `File / Link: ${selected.fileReference || "not specified"}`,
        `Last reviewed: ${formatDocumentDate(selected.lastReviewedDate)}`,
        selected.daysToExpiry !== null
          ? `Days to expiry: ${selected.daysToExpiry}`
          : "Days to expiry: not applicable",
        selected.remarks ? `Remarks: ${selected.remarks}` : "",
        "",
        `Source: ${documentSheetName}`,
      ]
        .filter((line) => line !== "")
        .join("\n");
    }

    return [
      "I recognized this as a Documents question, but I do not yet have a safe local rule for this exact request.",
      "",
      "No paid API was used.",
      `Source: ${documentSheetName}`,
    ].join("\n");
  }


  /*
   * =========================================================
   * VISITORS INTELLIGENCE — LOCAL, $0 API — V1
   * =========================================================
   * Built for Visitor Master:
   * Visitor ID, Visitor Name, Company / Organisation, Purpose,
   * Host, Visit Date, Expected Time, Check In, Check Out,
   * Visit Type, Phone, Email, ID Type, Visitor Pass,
   * Approval Status, Visit Status, Location, Notes.
   */
  const visitorIntent =
    normalizedQuestion.includes("visitor") ||
    normalizedQuestion.includes("visitors") ||
    normalizedQuestion.includes("visited") ||
    normalizedQuestion.includes("visit") ||
    normalizedQuestion.includes("checked in") ||
    normalizedQuestion.includes("visitor pass") ||
    normalizedQuestion.includes("expected visitor") ||
    normalizedQuestion.includes("approval status") ||
    normalizedQuestion.includes("pending approval") ||
    normalizedQuestion.includes("stayed the longest") ||
    normalizedQuestion.includes("longest stay") ||
    normalizedQuestion.includes("checked in late") ||
    normalizedQuestion.includes("late check in");

  if (
    visitorIntent ||
    (
      workbookType === "Visitors" &&
      (
        normalizedQuestion.includes("show") ||
        normalizedQuestion.includes("details") ||
        normalizedQuestion.includes("today") ||
        normalizedQuestion.includes("expected") ||
        normalizedQuestion.includes("completed") ||
        normalizedQuestion.includes("cancelled") ||
        normalizedQuestion.includes("canceled") ||
        normalizedQuestion.includes("pending approval") ||
        normalizedQuestion.includes("host")
      )
    )
  ) {
    const visitorMasterEntry =
      Object.entries(
        workbookData || {}
      ).find(
        ([sheetName, rows]) => {
          if (
            normalizeText(
              sheetName
            ).includes(
              "visitor master"
            )
          ) {
            return true;
          }

          return (
            Array.isArray(rows) &&
            rows
              .slice(0, 5)
              .some(
                (row) => {
                  const keys =
                    Object.keys(
                      row || {}
                    ).map(
                      (key) =>
                        normalizeText(
                          key
                        )
                    );

                  return (
                    keys.includes(
                      "visitor id"
                    ) &&
                    keys.includes(
                      "visitor name"
                    ) &&
                    keys.includes(
                      "visit date"
                    ) &&
                    keys.includes(
                      "visit status"
                    )
                  );
                }
              )
          );
        }
      );

    if (!visitorMasterEntry) {
      return {
        text:
          "I could not find a Visitor Master sheet in the active workbook. Please load the Visitor tracker first.",
        action:
          "change-workbook",
      };
    }

    const [
      visitorSheetName,
      visitorRows,
    ] =
      visitorMasterEntry;

    const findVisitorColumn =
      (
        row,
        aliases
      ) => {
        const keys =
          Object.keys(
            row || {}
          );

        const normalizedAliases =
          aliases.map(
            (alias) =>
              normalizeText(
                alias
              )
          );

        const exact =
          keys.find(
            (key) =>
              normalizedAliases.includes(
                normalizeText(
                  key
                )
              )
          );

        if (exact) {
          return exact;
        }

        return keys.find(
          (key) => {
            const nk =
              normalizeText(
                key
              );

            return normalizedAliases.some(
              (alias) =>
                alias.length >= 4 &&
                nk.includes(
                  alias
                )
            );
          }
        );
      };

    const parseVisitorDate =
      (value) => {
        if (
          value instanceof Date &&
          !Number.isNaN(
            value.getTime()
          )
        ) {
          return value;
        }

        const raw =
          String(
            value ?? ""
          ).trim();

        if (!raw) {
          return null;
        }

        const dmy =
          raw.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/
          );

        if (dmy) {
          const parsed =
            new Date(
              Number(
                dmy[3]
              ),
              Number(
                dmy[2]
              ) - 1,
              Number(
                dmy[1]
              )
            );

          return Number.isNaN(
            parsed.getTime()
          )
            ? null
            : parsed;
        }

        const parsed =
          new Date(
            raw
          );

        return Number.isNaN(
          parsed.getTime()
        )
          ? null
          : parsed;
      };

    const formatVisitorDate =
      (value) => {
        const date =
          parseVisitorDate(
            value
          );

        if (!date) {
          return String(
            value ?? ""
          ).trim() ||
            "date not specified";
        }

        return date.toLocaleDateString(
          "en-GB",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        );
      };

    const visitorRecords =
      (visitorRows || [])
        .map(
          (row) => {
            if (
              !row ||
              typeof row !==
                "object"
            ) {
              return null;
            }

            const idCol =
              findVisitorColumn(
                row,
                [
                  "Visitor ID",
                ]
              );

            const nameCol =
              findVisitorColumn(
                row,
                [
                  "Visitor Name",
                ]
              );

            if (
              !idCol ||
              !nameCol
            ) {
              return null;
            }

            const visitorId =
              String(
                row[
                  idCol
                ] ?? ""
              ).trim();

            const visitorName =
              String(
                row[
                  nameCol
                ] ?? ""
              ).trim();

            if (
              !visitorId ||
              !visitorName
            ) {
              return null;
            }

            const get =
              (aliases) => {
                const col =
                  findVisitorColumn(
                    row,
                    aliases
                  );

                return col
                  ? row[
                      col
                    ]
                  : "";
              };

            return {
              visitorId,
              visitorName,
              company:
                String(
                  get([
                    "Company / Organisation",
                    "Company",
                    "Organisation",
                  ]) ?? ""
                ).trim(),
              purpose:
                String(
                  get([
                    "Purpose",
                  ]) ?? ""
                ).trim(),
              host:
                String(
                  get([
                    "Host",
                  ]) ?? ""
                ).trim(),
              visitDate:
                get([
                  "Visit Date",
                ]),
              expectedTime:
                String(
                  get([
                    "Expected Time",
                  ]) ?? ""
                ).trim(),
              checkIn:
                String(
                  get([
                    "Check In",
                  ]) ?? ""
                ).trim(),
              checkOut:
                String(
                  get([
                    "Check Out",
                  ]) ?? ""
                ).trim(),
              visitType:
                String(
                  get([
                    "Visit Type",
                  ]) ?? ""
                ).trim(),
              phone:
                String(
                  get([
                    "Phone",
                  ]) ?? ""
                ).trim(),
              email:
                String(
                  get([
                    "Email",
                  ]) ?? ""
                ).trim(),
              idType:
                String(
                  get([
                    "ID Type",
                  ]) ?? ""
                ).trim(),
              visitorPass:
                String(
                  get([
                    "Visitor Pass",
                  ]) ?? ""
                ).trim(),
              approvalStatus:
                String(
                  get([
                    "Approval Status",
                  ]) ?? ""
                ).trim(),
              visitStatus:
                String(
                  get([
                    "Visit Status",
                  ]) ?? ""
                ).trim(),
              location:
                String(
                  get([
                    "Location",
                  ]) ?? ""
                ).trim(),
              notes:
                String(
                  get([
                    "Notes",
                  ]) ?? ""
                ).trim(),
            };
          }
        )
        .filter(Boolean);

    if (
      !visitorRecords.length
    ) {
      return [
        "I found the Visitor Master sheet but could not identify visitor records.",
        "",
        "No paid API was used.",
      ].join("\n");
    }

    const q =
      normalizedQuestion;

    const statusCounts = {
      expected:
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitStatus
            ) === "expected"
        ).length,
      completed:
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitStatus
            ) === "completed"
        ).length,
      checkedIn:
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitStatus
            ) === "checked in"
        ).length,
      cancelled:
        visitorRecords.filter(
          (item) =>
            [
              "cancelled",
              "canceled",
            ].includes(
              normalizeText(
                item.visitStatus
              )
            )
        ).length,
    };

    if (
      !q.includes(
        "vendor visitor"
      ) &&
      !q.includes(
        "vendor visitors"
      ) &&
      (
        q.includes(
          "how many"
        ) ||
        q.includes(
          "count"
        )
      ) &&
      (
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visitors"
        )
      )
    ) {
      return [
        `Total visitor records: ${visitorRecords.length}`,
        "",
        `Expected: ${statusCounts.expected} | Completed: ${statusCounts.completed} | Checked In: ${statusCounts.checkedIn} | Cancelled: ${statusCounts.cancelled}`,
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const isSameLocalDate =
      (
        value,
        date
      ) => {
        const parsed =
          parseVisitorDate(
            value
          );

        if (!parsed) {
          return false;
        }

        return (
          parsed.getFullYear() ===
            date.getFullYear() &&
          parsed.getMonth() ===
            date.getMonth() &&
          parsed.getDate() ===
            date.getDate()
        );
      };

    if (
      q.includes(
        "today"
      ) &&
      (
        q.includes(
          "visited"
        ) ||
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visitors"
        )
      )
    ) {
      const today =
        new Date();

      const matches =
        visitorRecords.filter(
          (item) =>
            isSameLocalDate(
              item.visitDate,
              today
            )
        );

      if (
        !matches.length
      ) {
        return [
          "No visitor records are dated today.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Visitors today: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${item.visitStatus || "status not specified"} — Host: ${item.host || "not specified"}${item.checkIn ? ` — Check In: ${item.checkIn}` : ""}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    if (
      q.includes(
        "tomorrow"
      ) &&
      (
        q.includes(
          "visited"
        ) ||
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visitors"
        )
      )
    ) {
      const tomorrow =
        new Date();

      tomorrow.setDate(
        tomorrow.getDate() + 1
      );

      const matches =
        visitorRecords.filter(
          (item) =>
            isSameLocalDate(
              item.visitDate,
              tomorrow
            )
        );

      if (
        !matches.length
      ) {
        return [
          "No visitor records are dated tomorrow.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Visitors tomorrow: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${item.visitStatus || "status not specified"} — Host: ${item.host || "not specified"}${item.expectedTime ? ` — Expected: ${item.expectedTime}` : ""}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    if (
      q.includes(
        "next 7 days"
      ) &&
      (
        q.includes(
          "expected"
        ) ||
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visitors"
        )
      )
    ) {
      const start =
        new Date();

      start.setHours(
        0,
        0,
        0,
        0
      );

      const end =
        new Date(
          start
        );

      end.setDate(
        end.getDate() + 7
      );

      const matches =
        visitorRecords
          .map(
            (item) => ({
              ...item,
              parsedVisitDate:
                parseVisitorDate(
                  item.visitDate
                ),
            })
          )
          .filter(
            (item) =>
              item.parsedVisitDate &&
              item.parsedVisitDate >= start &&
              item.parsedVisitDate < end &&
              normalizeText(
                item.visitStatus
              ) === "expected"
          )
          .sort(
            (a, b) =>
              a.parsedVisitDate -
              b.parsedVisitDate
          );

      if (
        !matches.length
      ) {
        return [
          "No expected visitors are scheduled in the next 7 days.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Expected visitors in the next 7 days: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(
              item.visitDate
            )} — ${item.expectedTime || "time not specified"} — Host: ${item.host || "not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    if (
      q.includes(
        "currently checked in"
      ) ||
      q.includes(
        "checked in now"
      ) ||
      q.includes(
        "who is checked in"
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitStatus
            ) === "checked in"
        );

      if (
        !matches.length
      ) {
        return [
          "No visitors are currently marked Checked In.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Currently checked in: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${item.company || "company not specified"} — Host: ${item.host || "not specified"} — Check In: ${item.checkIn || "not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    if (
      q.includes(
        "expected visitor"
      ) ||
      q.includes(
        "expected visitors"
      ) ||
      (
        q.includes(
          "show"
        ) &&
        q.includes(
          "expected"
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitStatus
            ) === "expected"
        );

      return [
        `Expected visitors: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — ${item.expectedTime || "time not specified"} — Host: ${item.host || "not specified"} — ${item.location || "location not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    /*
     * PENDING VISITOR APPROVALS
     */
    if (
      q.includes(
        "pending visitor approval"
      ) ||
      q.includes(
        "pending visitor approvals"
      ) ||
      q.includes(
        "visitor approval pending"
      ) ||
      q.includes(
        "visitor approvals pending"
      ) ||
      (
        q.includes(
          "pending"
        ) &&
        q.includes(
          "approval"
        ) &&
        (
          q.includes(
            "visitor"
          ) ||
          q.includes(
            "visit"
          )
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.approvalStatus
            ) === "pending"
        );

      if (!matches.length) {
        return [
          "No visitor approvals are currently marked Pending.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Visitor approvals pending: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — ${item.expectedTime || "time not specified"} — Host: ${item.host || "not specified"} — ${item.purpose || "purpose not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    /*
     * VENDOR VISITOR COUNT / LIST
     */
    const asksVendorVisitors =
      (
        q.includes(
          "vendor visitor"
        ) ||
        q.includes(
          "vendor visitors"
        )
      );

    if (asksVendorVisitors) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitType
            ) === "vendor"
        );

      const asksCount =
        q.includes(
          "how many"
        ) ||
        q.includes(
          "count"
        );

      if (asksCount) {
        return [
          `Vendor visitor records: ${matches.length}`,
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Vendor visitors: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — ${item.company || "company not specified"} — ${item.visitStatus || "status not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    /*
     * LONGEST COMPLETED VISIT
     *
     * Uses only rows with both Check In and Check Out.
     */
    const parseClockMinutes =
      (value) => {
        const raw =
          String(
            value ?? ""
          ).trim();

        const match =
          raw.match(
            /^(\d{1,2}):(\d{2})$/
          );

        if (!match) {
          return null;
        }

        const hour =
          Number(
            match[1]
          );

        const minute =
          Number(
            match[2]
          );

        if (
          !Number.isFinite(hour) ||
          !Number.isFinite(minute) ||
          hour < 0 ||
          hour > 23 ||
          minute < 0 ||
          minute > 59
        ) {
          return null;
        }

        return (
          hour * 60 +
          minute
        );
      };

    const asksLongestStay =
      q.includes(
        "stayed the longest"
      ) ||
      q.includes(
        "longest stay"
      ) ||
      q.includes(
        "longest visit"
      );

    if (asksLongestStay) {
      const completedDurations =
        visitorRecords
          .map(
            (item) => {
              const checkInMinutes =
                parseClockMinutes(
                  item.checkIn
                );

              const checkOutMinutes =
                parseClockMinutes(
                  item.checkOut
                );

              if (
                checkInMinutes ===
                  null ||
                checkOutMinutes ===
                  null
              ) {
                return null;
              }

              let duration =
                checkOutMinutes -
                checkInMinutes;

              if (
                duration < 0
              ) {
                duration +=
                  24 * 60;
              }

              return {
                ...item,
                duration,
              };
            }
          )
          .filter(Boolean);

      if (
        !completedDurations.length
      ) {
        return [
          "I could not calculate visitor stay duration because no records have both Check In and Check Out times.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const longest =
        Math.max(
          ...completedDurations.map(
            (item) =>
              item.duration
          )
        );

      const leaders =
        completedDurations.filter(
          (item) =>
            item.duration ===
            longest
        );

      const formatDuration =
        (minutes) => {
          const hours =
            Math.floor(
              minutes / 60
            );

          const mins =
            minutes % 60;

          return [
            hours
              ? `${hours} hr${hours === 1 ? "" : "s"}`
              : "",
            mins
              ? `${mins} min`
              : "",
          ]
            .filter(Boolean)
            .join(" ") ||
            "0 min";
        };

      return [
        leaders.length === 1
          ? "Longest recorded visitor stay:"
          : "Longest recorded visitor stays:",
        "",
        ...leaders.map(
          (item) =>
            `${item.visitorName} — ${formatDuration(item.duration)} — ${item.checkIn} to ${item.checkOut} — ${formatVisitorDate(item.visitDate)}`
        ),
        "",
        "Only records with both Check In and Check Out are compared.",
        leaders.length > 1
          ? "Tie shown instead of guessed."
          : `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    /*
     * LATE CHECK-IN
     *
     * Late = recorded Check In is later than Expected Time.
     * Missing Expected Time or Check In is excluded.
     */
    const asksLateCheckIn =
      q.includes(
        "checked in late"
      ) ||
      q.includes(
        "late check in"
      ) ||
      q.includes(
        "late check-in"
      ) ||
      q.includes(
        "who was late"
      );

    if (asksLateCheckIn) {
      const lateVisitors =
        visitorRecords
          .map(
            (item) => {
              const expected =
                parseClockMinutes(
                  item.expectedTime
                );

              const actual =
                parseClockMinutes(
                  item.checkIn
                );

              if (
                expected === null ||
                actual === null ||
                actual <= expected
              ) {
                return null;
              }

              return {
                ...item,
                lateBy:
                  actual -
                  expected,
              };
            }
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              b.lateBy -
              a.lateBy
          );

      if (
        !lateVisitors.length
      ) {
        return [
          "No visitors with both Expected Time and Check In are recorded as late.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      return [
        `Visitors who checked in late: ${lateVisitors.length}`,
        "",
        ...lateVisitors.map(
          (item) =>
            `${item.visitorName} — ${item.lateBy} min late — Expected: ${item.expectedTime} — Check In: ${item.checkIn} — ${formatVisitorDate(item.visitDate)}`
        ),
        "",
        "Only records with both Expected Time and Check In are compared.",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }


    if (
      q.includes(
        "completed"
      ) &&
      (
        q.includes(
          "visit"
        ) ||
        q.includes(
          "visitor"
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitStatus
            ) === "completed"
        );

      return [
        `Completed visits: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — Host: ${item.host || "not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    if (
      (
        q.includes(
          "cancelled"
        ) ||
        q.includes(
          "canceled"
        )
      ) &&
      (
        q.includes(
          "visit"
        ) ||
        q.includes(
          "visitor"
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            [
              "cancelled",
              "canceled",
            ].includes(
              normalizeText(
                item.visitStatus
              )
            )
        );

      return [
        `Cancelled visits: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)}${item.notes ? ` — ${item.notes}` : ""}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    if (
      q.includes(
        "pending approval"
      ) ||
      q.includes(
        "approval pending"
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.approvalStatus
            ) === "pending"
        );

      return [
        `Visitor approvals pending: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — Host: ${item.host || "not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const knownHosts =
      [
        ...new Set(
          visitorRecords
            .map(
              (item) =>
                item.host
            )
            .filter(Boolean)
        ),
      ].sort(
        (a, b) =>
          b.length -
          a.length
      );

    const asksMostHostedVisitors =
      q.includes(
        "hosted the most visitors"
      ) ||
      q.includes(
        "most visitors"
      ) &&
      q.includes(
        "host"
      );

    if (asksMostHostedVisitors) {
      const hostCounts = {};

      visitorRecords.forEach(
        (item) => {
          const host =
            String(
              item.host ?? ""
            ).trim();

          if (!host) {
            return;
          }

          hostCounts[host] =
            (hostCounts[host] || 0) + 1;
        }
      );

      const entries =
        Object.entries(
          hostCounts
        );

      if (!entries.length) {
        return [
          "I could not find visitor host information.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      const highestCount =
        Math.max(
          ...entries.map(
            ([, count]) =>
              count
          )
        );

      const leaders =
        entries.filter(
          ([, count]) =>
            count === highestCount
        );

      return [
        leaders.length === 1
          ? "Host with the most visitors:"
          : "Hosts with the most visitors:",
        "",
        ...leaders.map(
          ([host, count]) =>
            `${host} — ${count} visitor${count === 1 ? "" : "s"}`
        ),
        ...(leaders.length > 1
          ? [
              "",
              "Tie shown instead of guessed.",
            ]
          : []),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const mentionedHost =
      knownHosts.find(
        (host) =>
          q.includes(
            normalizeText(
              host
            )
          )
      ) ||
      (() => {
        const firstMatches =
          knownHosts.filter(
            (host) => {
              const first =
                normalizeText(
                  host
                ).split(/\s+/)[0];

              return (
                first.length >= 3 &&
                q.includes(
                  first
                )
              );
            }
          );

        return firstMatches.length === 1
          ? firstMatches[0]
          : null;
      })();

    if (
      mentionedHost &&
      (
        q.includes(
          "visited"
        ) ||
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visitors"
        ) ||
        q.includes(
          "met"
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.host
            ) ===
            normalizeText(
              mentionedHost
            )
        );

      return [
        `Visitors for ${mentionedHost}: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — ${item.purpose || "purpose not specified"} — ${item.visitStatus || "status not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const locationAliases = {
      mumbai: [
        "mumbai",
      ],
      bengaluru: [
        "bengaluru",
        "bangalore",
      ],
    };

    const requestedLocation =
      Object.entries(
        locationAliases
      ).find(
        ([, aliases]) =>
          aliases.some(
            (alias) =>
              q.includes(
                alias
              )
          )
      )?.[0];

    if (
      requestedLocation &&
      (
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visit"
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.location
            ) ===
            requestedLocation
        );

      return [
        `Visitor records in ${requestedLocation === "bengaluru" ? "Bengaluru" : "Mumbai"}: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — ${item.visitStatus || "status not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const visitTypeNames =
      [
        ...new Set(
          visitorRecords
            .map(
              (item) =>
                item.visitType
            )
            .filter(Boolean)
        ),
      ];

    const requestedVisitType =
      visitTypeNames.find(
        (type) =>
          q.includes(
            normalizeText(
              type
            )
          )
      );

    if (
      requestedVisitType &&
      (
        q.includes(
          "visitor"
        ) ||
        q.includes(
          "visit"
        )
      )
    ) {
      const matches =
        visitorRecords.filter(
          (item) =>
            normalizeText(
              item.visitType
            ) ===
            normalizeText(
              requestedVisitType
            )
        );

      return [
        `${requestedVisitType} visitors: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.visitorName} — ${formatVisitorDate(item.visitDate)} — ${item.company || "company not specified"}`
        ),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const asksMostVisitorsByCompany =
      (
        q.includes(
          "company sent the most visitors"
        ) ||
        q.includes(
          "company has the most visitors"
        ) ||
        q.includes(
          "most visitors by company"
        )
      );

    if (asksMostVisitorsByCompany) {
      const companyCounts = {};

      visitorRecords.forEach(
        (item) => {
          const company =
            String(
              item.company ?? ""
            ).trim();

          if (!company) {
            return;
          }

          companyCounts[company] =
            (companyCounts[company] || 0) + 1;
        }
      );

      const entries =
        Object.entries(
          companyCounts
        );

      if (!entries.length) {
        return [
          "I could not find visitor company information.",
          "",
          `Source: ${visitorSheetName}`,
        ].join("\n");
      }

      const highestCount =
        Math.max(
          ...entries.map(
            ([, count]) =>
              count
          )
        );

      const leaders =
        entries.filter(
          ([, count]) =>
            count === highestCount
        );

      return [
        leaders.length === 1
          ? "Company with the most visitors:"
          : "Companies with the most visitors:",
        "",
        ...leaders.map(
          ([company, count]) =>
            `${company} — ${count} visitor${count === 1 ? "" : "s"}`
        ),
        ...(leaders.length > 1
          ? [
              "",
              "Tie shown instead of guessed.",
            ]
          : []),
        "",
        `Source: ${visitorSheetName}`,
      ].join("\n");
    }

    const visitorNames =
      [...visitorRecords]
        .sort(
          (a, b) =>
            b.visitorName.length -
            a.visitorName.length
        );

    const mentionedVisitor =
      visitorNames.find(
        (item) =>
          q.includes(
            normalizeText(
              item.visitorName
            )
          )
      ) ||
      (() => {
        const matches =
          visitorNames.filter(
            (item) => {
              const first =
                normalizeText(
                  item.visitorName
                ).split(/\s+/)[0];

              return (
                first.length >= 3 &&
                q.includes(
                  first
                )
              );
            }
          );

        return matches.length === 1
          ? matches[0]
          : null;
      })();

    if (
      mentionedVisitor &&
      (
        q.includes(
          "details"
        ) ||
        q.includes(
          "show"
        ) ||
        q.includes(
          "visitor"
        )
      )
    ) {
      const item =
        mentionedVisitor;

      return [
        `${item.visitorName}`,
        "",
        `Visitor ID: ${item.visitorId}`,
        `Company: ${item.company || "not specified"}`,
        `Purpose: ${item.purpose || "not specified"}`,
        `Host: ${item.host || "not specified"}`,
        `Visit date: ${formatVisitorDate(item.visitDate)}`,
        `Expected time: ${item.expectedTime || "not specified"}`,
        `Check In: ${item.checkIn || "not recorded"}`,
        `Check Out: ${item.checkOut || "not recorded"}`,
        `Visit type: ${item.visitType || "not specified"}`,
        `Phone: ${item.phone || "not specified"}`,
        `Email: ${item.email || "not specified"}`,
        `ID type: ${item.idType || "not specified"}`,
        `Visitor pass: ${item.visitorPass || "not specified"}`,
        `Approval: ${item.approvalStatus || "not specified"}`,
        `Status: ${item.visitStatus || "not specified"}`,
        `Location: ${item.location || "not specified"}`,
        item.notes
          ? `Notes: ${item.notes}`
          : "",
        "",
        `Source: ${visitorSheetName}`,
      ]
        .filter(
          (line) =>
            line !== ""
        )
        .join("\n");
    }

    return [
      "I recognized this as a Visitors question, but I do not yet have a safe local rule for this exact request.",
      "",
      "No paid API was used.",
      `Source: ${visitorSheetName}`,
    ].join("\n");
  }


  /*
   * =========================================================
   * EVENTS INTELLIGENCE — LOCAL, $0 API — V1
   * =========================================================
   * Built for Event Master:
   * Event ID, Event Name, Event Type, Event Date, City, Venue,
   * Start/End Time, Expected Attendees, Budget, Actual Cost,
   * Primary Vendor, Event Owner, Payment Status, Event Status,
   * Setup Deadline, Requirements, Remarks.
   */
  const eventIntent =
    (
      normalizedQuestion.includes("event") ||
      normalizedQuestion.includes("events") ||
      normalizedQuestion.includes("upcoming") ||
      normalizedQuestion.includes("completed") ||
      normalizedQuestion.includes("cancelled") ||
      normalizedQuestion.includes("canceled") ||
      normalizedQuestion.includes("attendees") ||
      normalizedQuestion.includes("setup deadline")
    ) ||
    (
      workbookType === "Events" &&
      (
        normalizedQuestion.includes("details") ||
        normalizedQuestion.includes("show") ||
        normalizedQuestion.includes("when") ||
        normalizedQuestion.includes("where") ||
        normalizedQuestion.includes("status") ||
        normalizedQuestion.includes("budget") ||
        normalizedQuestion.includes("cost")
      )
    );

  if (eventIntent) {
    const eventMasterEntry =
      Object.entries(workbookData || {}).find(
        ([sheetName, rows]) => {
          if (normalizeText(sheetName).includes("event master")) {
            return true;
          }

          return (
            Array.isArray(rows) &&
            rows.slice(0, 5).some((row) => {
              const keys = Object.keys(row || {}).map((key) =>
                normalizeText(key)
              );

              return (
                keys.includes("event id") &&
                keys.includes("event name") &&
                keys.includes("event date") &&
                keys.includes("event status")
              );
            })
          );
        }
      );

    if (!eventMasterEntry) {
      return {
        text:
          "I could not find an Event Master sheet in the active workbook. Please load the Events tracker first.",
        action: "change-workbook",
      };
    }

    const [eventSheetName, eventRows] = eventMasterEntry;

    const findEventColumn = (row, aliases) => {
      const keys =
        Object.keys(row || {});

      const normalizedAliases =
        aliases.map((alias) =>
          normalizeText(alias)
        );

      /*
       * Exact header matches must win first. This prevents fields such
       * as "Payment Status" from being mistaken for "Event Status".
       */
      const exactMatch =
        keys.find((key) =>
          normalizedAliases.includes(
            normalizeText(key)
          )
        );

      if (exactMatch) {
        return exactMatch;
      }

      return keys.find((key) => {
        const nk =
          normalizeText(key);

        return normalizedAliases.some(
          (alias) =>
            alias.length >= 4 &&
            nk.includes(alias)
        );
      });
    };

    const parseEventDate = (value) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value;
      }

      const raw = String(value ?? "").trim();
      if (!raw) return null;

      const dmy = raw.match(
        /^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/
      );

      if (dmy) {
        const parsed = new Date(
          Number(dmy[3]),
          Number(dmy[2]) - 1,
          Number(dmy[1])
        );
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }

      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatEventDate = (value) => {
      const date = parseEventDate(value);
      if (!date) return String(value ?? "").trim() || "date not specified";

      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    };

    const formatMoney = (value) =>
      value === null
        ? "amount not specified"
        : `₹${Number(value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`;

    const records = (eventRows || [])
      .map((row) => {
        if (!row || typeof row !== "object") return null;

        const idCol = findEventColumn(row, ["Event ID"]);
        const nameCol = findEventColumn(row, ["Event Name"]);
        if (!idCol || !nameCol) return null;

        const eventId = String(row[idCol] ?? "").trim();
        const eventName = String(row[nameCol] ?? "").trim();
        if (!eventId || !eventName) return null;

        const get = (aliases) => {
          const col = findEventColumn(row, aliases);
          return col ? row[col] : "";
        };

        const budgetRaw = get(["Budget (₹)", "Budget"]);
        const actualRaw = get(["Actual Cost (₹)", "Actual Cost"]);

        return {
          eventId,
          eventName,
          eventType: String(get(["Event Type"]) ?? "").trim(),
          eventDate: get(["Event Date"]),
          city: String(get(["City"]) ?? "").trim(),
          venue: String(get(["Venue"]) ?? "").trim(),
          startTime: String(get(["Start Time"]) ?? "").trim(),
          endTime: String(get(["End Time"]) ?? "").trim(),
          attendees: numberFromValue(get(["Expected Attendees"])),
          budget: numberFromValue(budgetRaw),
          actualCost:
            actualRaw === "" || actualRaw === null || actualRaw === undefined
              ? null
              : numberFromValue(actualRaw),
          vendor: String(get(["Primary Vendor", "Vendor"]) ?? "").trim(),
          owner: String(get(["Event Owner", "Owner"]) ?? "").trim(),
          paymentStatus: String(get(["Payment Status"]) ?? "").trim(),
          /*
           * IMPORTANT:
           * Do not use generic "Status" here. The sheet also has
           * "Payment Status", which appears before "Event Status".
           * A loose "Status" match therefore reads the wrong column.
           */
          eventStatus: String(get(["Event Status"]) ?? "").trim(),
          setupDeadline: get(["Setup Deadline"]),
          requirements: String(get(["Requirements"]) ?? "").trim(),
          remarks: String(get(["Remarks"]) ?? "").trim(),
        };
      })
      .filter(Boolean);

    if (!records.length) {
      return [
        "I found the Event Master sheet but could not identify event records.",
        "",
        "No paid API was used.",
      ].join("\n");
    }

    const q = normalizedQuestion;

    if (
      (q.includes("how many") || q.includes("count")) &&
      (q.includes("event") || q.includes("events"))
    ) {
      const upcoming = records.filter(
        (x) => normalizeText(x.eventStatus) === "upcoming"
      ).length;
      const completed = records.filter(
        (x) => normalizeText(x.eventStatus) === "completed"
      ).length;
      const cancelled = records.filter((x) =>
        ["cancelled", "canceled"].includes(normalizeText(x.eventStatus))
      ).length;

      return [
        `Total events: ${records.length}`,
        "",
        `Upcoming: ${upcoming} | Completed: ${completed} | Cancelled: ${cancelled}`,
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (q.includes("upcoming")) {
      const matches = records
        .filter((x) => normalizeText(x.eventStatus) === "upcoming")
        .sort(
          (a, b) =>
            (parseEventDate(a.eventDate)?.getTime() ?? Infinity) -
            (parseEventDate(b.eventDate)?.getTime() ?? Infinity)
        );

      return [
        `Upcoming events: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — ${formatEventDate(x.eventDate)} — ${x.city || "city not specified"} — ${x.venue || "venue not specified"}`
        ),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (q.includes("completed")) {
      const matches = records.filter(
        (x) => normalizeText(x.eventStatus) === "completed"
      );

      return [
        `Completed events: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — ${formatEventDate(x.eventDate)} — Actual cost: ${formatMoney(x.actualCost)}`
        ),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (q.includes("cancelled") || q.includes("canceled")) {
      const matches = records.filter((x) =>
        ["cancelled", "canceled"].includes(normalizeText(x.eventStatus))
      );

      return [
        `Cancelled events: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — ${formatEventDate(x.eventDate)}${x.remarks ? ` — ${x.remarks}` : ""}`
        ),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("which event is next") ||
      q.includes("next event")
    ) {
      const upcoming = records
        .filter((x) => normalizeText(x.eventStatus) === "upcoming")
        .map((x) => ({ ...x, parsedDate: parseEventDate(x.eventDate) }))
        .filter((x) => x.parsedDate)
        .sort((a, b) => a.parsedDate - b.parsedDate);

      if (!upcoming.length) {
        return [
          "I could not find a dated upcoming event.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      const next = upcoming[0];
      return [
        "Next recorded upcoming event:",
        "",
        `${next.eventName} — ${formatEventDate(next.eventDate)}`,
        `City: ${next.city || "not specified"}`,
        `Venue: ${next.venue || "not specified"}`,
        `Time: ${next.startTime || "not specified"}${next.endTime ? `–${next.endTime}` : ""}`,
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("setup deadline") &&
      (
        q.includes("coming soon") ||
        q.includes("due soon") ||
        q.includes("upcoming")
      )
    ) {
      const today =
        new Date();

      today.setHours(
        0,
        0,
        0,
        0
      );

      const thirtyDaysFromToday =
        new Date(
          today
        );

      thirtyDaysFromToday.setDate(
        thirtyDaysFromToday.getDate() + 30
      );

      const matches =
        records
          .map(
            (x) => ({
              ...x,
              parsedSetupDeadline:
                parseEventDate(
                  x.setupDeadline
                ),
            })
          )
          .filter(
            (x) =>
              normalizeText(
                x.eventStatus
              ) === "upcoming" &&
              x.parsedSetupDeadline &&
              x.parsedSetupDeadline >= today &&
              x.parsedSetupDeadline <=
                thirtyDaysFromToday
          )
          .sort(
            (a, b) =>
              a.parsedSetupDeadline -
              b.parsedSetupDeadline
          );

      if (!matches.length) {
        return [
          "No upcoming event setup deadlines fall within the next 30 days.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      return [
        `Upcoming setup deadlines: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — Setup deadline: ${formatEventDate(
              x.setupDeadline
            )} — Event: ${formatEventDate(
              x.eventDate
            )}`
        ),
        "",
        "Window: next 30 days.",
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("total event budget") ||
      q.includes("event budget total") ||
      (q.includes("how much") && q.includes("budget"))
    ) {
      const numeric = records.filter((x) => x.budget !== null);
      const total = numeric.reduce((sum, x) => sum + x.budget, 0);

      return [
        `Total recorded event budget: ${formatMoney(total)}`,
        "",
        `Event budgets counted: ${numeric.length}`,
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("how much did we spend on events") ||
      q.includes("total event spend") ||
      q.includes("total actual cost") ||
      q.includes("actual event cost")
    ) {
      const numeric = records.filter((x) => x.actualCost !== null);
      const total = numeric.reduce((sum, x) => sum + x.actualCost, 0);

      return [
        `Recorded actual event spend: ${formatMoney(total)}`,
        "",
        `Events with recorded actual cost: ${numeric.length}`,
        "",
        "Blank actual-cost cells are excluded. A recorded ₹0 remains a recorded value.",
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      (
        q.includes("highest budget") ||
        q.includes("largest budget") ||
        q.includes("biggest budget") ||
        q.includes("budget is the highest") ||
        q.includes("event has the highest budget")
      ) &&
      q.includes("event")
    ) {
      const numeric =
        records.filter(
          (x) =>
            x.budget !== null
        );

      if (!numeric.length) {
        return [
          "I could not find numeric event budgets.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      const highestBudget =
        Math.max(
          ...numeric.map(
            (x) =>
              x.budget
          )
        );

      const leaders =
        numeric.filter(
          (x) =>
            x.budget ===
            highestBudget
        );

      return [
        leaders.length === 1
          ? "Highest recorded event budget:"
          : "Highest recorded event budgets:",
        "",
        ...leaders.map(
          (x) =>
            `${x.eventName} — ${formatMoney(
              x.budget
            )} — ${formatEventDate(
              x.eventDate
            )}`
        ),
        ...(leaders.length > 1
          ? [
              "",
              "Tie shown instead of guessed.",
            ]
          : []),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      (q.includes("cost the most") ||
        q.includes("highest cost") ||
        q.includes("most expensive")) &&
      q.includes("event")
    ) {
      const numeric = records.filter((x) => x.actualCost !== null);
      if (!numeric.length) {
        return [
          "I could not find numeric actual event costs.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      const highest = Math.max(...numeric.map((x) => x.actualCost));
      const leaders = numeric.filter((x) => x.actualCost === highest);

      return [
        leaders.length === 1
          ? "Highest recorded event cost:"
          : "Highest recorded event costs:",
        "",
        ...leaders.map(
          (x) =>
            `${x.eventName} — ${formatMoney(x.actualCost)} — ${formatEventDate(x.eventDate)}`
        ),
        ...(leaders.length > 1 ? ["", "Tie shown instead of guessed."] : []),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("over budget") ||
      q.includes("went over budget") ||
      q.includes("above budget") ||
      q.includes("exceeded budget")
    ) {
      const matches =
        records.filter(
          (x) =>
            x.budget !== null &&
            x.actualCost !== null &&
            x.actualCost > x.budget
        );

      if (!matches.length) {
        return [
          "No events with recorded actual cost are over budget.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      return [
        `Events over budget: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — Budget: ${formatMoney(
              x.budget
            )} — Actual: ${formatMoney(
              x.actualCost
            )} — Over by: ${formatMoney(
              x.actualCost - x.budget
            )}`
        ),
        "",
        "Only events with both a recorded budget and actual cost are compared.",
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("under budget") ||
      q.includes("below budget") ||
      q.includes("within budget")
    ) {
      const matches =
        records.filter(
          (x) => {
            const status =
              normalizeText(
                x.eventStatus
              );

            const isCancelled =
              status === "cancelled" ||
              status === "canceled";

            return (
              !isCancelled &&
              x.budget !== null &&
              x.actualCost !== null &&
              x.actualCost < x.budget
            );
          }
        );

      if (!matches.length) {
        return [
          "No events with recorded actual cost are under budget.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      return [
        `Events under budget: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — Budget: ${formatMoney(
              x.budget
            )} — Actual: ${formatMoney(
              x.actualCost
            )} — Under by: ${formatMoney(
              x.budget - x.actualCost
            )}`
        ),
        "",
        "Only events with both a recorded budget and actual cost are compared.",
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      (
        q.includes("most attendees") ||
        q.includes("highest attendees") ||
        q.includes("largest attendance")
      ) &&
      q.includes("event")
    ) {
      const numeric =
        records.filter(
          (x) =>
            x.attendees !== null
        );

      if (!numeric.length) {
        return [
          "I could not find numeric expected attendee counts.",
          "",
          `Source: ${eventSheetName}`,
        ].join("\n");
      }

      const highest =
        Math.max(
          ...numeric.map(
            (x) =>
              x.attendees
          )
        );

      const leaders =
        numeric.filter(
          (x) =>
            x.attendees ===
            highest
        );

      return [
        leaders.length === 1
          ? "Event with the most attendees:"
          : "Events with the most attendees:",
        "",
        ...leaders.map(
          (x) =>
            `${x.eventName} — ${x.attendees} expected attendees — ${formatEventDate(
              x.eventDate
            )}`
        ),
        ...(leaders.length > 1
          ? [
              "",
              "Tie shown instead of guessed.",
            ]
          : []),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("pending payment") ||
      q.includes("payments are pending") ||
      q.includes("payment pending")
    ) {
      const matches = records.filter((x) => {
        const status = normalizeText(x.paymentStatus);
        return (
          status === "pending" ||
          status === "not paid" ||
          status === "part paid" ||
          status === "advance paid"
        );
      });

      return [
        `Events with payment not fully settled: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — ${x.paymentStatus || "status not specified"} — Budget: ${formatMoney(x.budget)}`
        ),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    const cityAliases = {
      mumbai: ["mumbai"],
      bengaluru: ["bengaluru", "bangalore"],
    };

    const requestedCity = Object.entries(cityAliases).find(
      ([, aliases]) => aliases.some((alias) => q.includes(alias))
    )?.[0];

    if (requestedCity && q.includes("event")) {
      const matches = records.filter(
        (x) => normalizeText(x.city) === requestedCity
      );

      return [
        `Events in ${requestedCity === "bengaluru" ? "Bengaluru" : "Mumbai"}: ${matches.length}`,
        "",
        ...matches.map(
          (x) =>
            `${x.eventName} — ${formatEventDate(x.eventDate)} — ${x.eventStatus || "status not specified"}`
        ),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    if (
      q.includes("show all event") ||
      q.includes("all event details") ||
      q.includes("list all event")
    ) {
      return [
        `Event details: ${records.length}`,
        "",
        ...records.map(
          (x) =>
            `${x.eventId} — ${x.eventName} — ${formatEventDate(x.eventDate)} — ${x.city || "city not specified"} — ${x.eventStatus || "status not specified"} — Budget: ${formatMoney(x.budget)}`
        ),
        "",
        `Source: ${eventSheetName}`,
      ].join("\n");
    }

    // Specific event lookup: exact/meaningful event-name token match.
    const stopTokens = new Set([
      "2026", "event", "show", "details", "for", "the", "is", "what",
      "when", "where", "status", "budget", "cost", "of", "me"
    ]);

    const mentioned = [...records]
      .sort((a, b) => b.eventName.length - a.eventName.length)
      .find((x) => {
        const full = normalizeText(x.eventName);
        if (q.includes(full)) return true;

        const tokens = full
          .split(/\s+/)
          .filter((token) => token.length >= 3 && !stopTokens.has(token));

        return (
          tokens.length >= 1 &&
          tokens.every((token) => q.includes(token))
        );
      });

    if (mentioned) {
      return [
        `${mentioned.eventName}`,
        "",
        `Event ID: ${mentioned.eventId}`,
        `Type: ${mentioned.eventType || "not specified"}`,
        `Date: ${formatEventDate(mentioned.eventDate)}`,
        `City: ${mentioned.city || "not specified"}`,
        `Venue: ${mentioned.venue || "not specified"}`,
        `Time: ${mentioned.startTime || "not specified"}${mentioned.endTime ? `–${mentioned.endTime}` : ""}`,
        `Expected attendees: ${mentioned.attendees ?? "not specified"}`,
        `Budget: ${formatMoney(mentioned.budget)}`,
        `Actual cost: ${formatMoney(mentioned.actualCost)}`,
        `Vendor: ${mentioned.vendor || "not specified"}`,
        `Owner: ${mentioned.owner || "not specified"}`,
        `Payment: ${mentioned.paymentStatus || "not specified"}`,
        `Status: ${mentioned.eventStatus || "not specified"}`,
        `Setup deadline: ${formatEventDate(mentioned.setupDeadline)}`,
        mentioned.requirements
          ? `Requirements: ${mentioned.requirements}`
          : "",
        mentioned.remarks ? `Remarks: ${mentioned.remarks}` : "",
        "",
        `Source: ${eventSheetName}`,
      ]
        .filter((line) => line !== "")
        .join("\n");
    }

    return [
      "I recognized this as an Events question, but I do not yet have a safe local rule for this exact request.",
      "",
      "No paid API was used.",
      `Source: ${eventSheetName}`,
    ].join("\n");
  }


  /*
   * =========================================================
   * RENEWALS / AMC / SUBSCRIPTIONS — LOCAL, $0 API — V1
   * =========================================================
   *
   * Built for Renewal Master columns:
   * Renewal ID, Service / AMC, Vendor, Category, Start Date,
   * Renewal / Due Date, Frequency, Amount (₹), Owner, Status,
   * Days to Due, Last Paid Date, Payment Status, Auto Renew,
   * Contact, Remarks.
   */
  const renewalIntent =
    normalizedQuestion.includes(
      "renewal"
    ) ||
    normalizedQuestion.includes(
      "renewals"
    ) ||
    normalizedQuestion.includes(
      "renew"
    ) ||
    normalizedQuestion.includes(
      "amc"
    ) ||
    normalizedQuestion.includes(
      "subscription"
    ) ||
    normalizedQuestion.includes(
      "due soon"
    ) ||
    normalizedQuestion.includes(
      "overdue"
    ) ||
    normalizedQuestion.includes(
      "auto renew"
    );

  if (renewalIntent) {
    const renewalWorkbookSheets =
      Object.entries(
        workbookData || {}
      );

    const renewalMasterEntry =
      renewalWorkbookSheets.find(
        ([sheetName, rows]) => {
          if (
            normalizeText(
              sheetName
            ).includes(
              "renewal master"
            )
          ) {
            return true;
          }

          return (
            Array.isArray(rows) &&
            rows
              .slice(0, 5)
              .some(
                (row) => {
                  const keys =
                    Object.keys(
                      row || {}
                    ).map(
                      (key) =>
                        normalizeText(
                          key
                        )
                    );

                  return (
                    keys.includes(
                      "renewal id"
                    ) &&
                    keys.some(
                      (key) =>
                        key.includes(
                          "service amc"
                        )
                    ) &&
                    keys.some(
                      (key) =>
                        key.includes(
                          "renewal due date"
                        )
                    )
                  );
                }
              )
          );
        }
      );

    if (!renewalMasterEntry) {
      return {
        text:
          "I could not find a Renewal Master sheet in the active workbook. Please load the Renewal / AMC tracker first.",
        action:
          "change-workbook",
      };
    }

    const [
      renewalSheetName,
      renewalSheetRows,
    ] =
      renewalMasterEntry;

    const findRenewalColumn =
      (
        row,
        aliases
      ) =>
        Object.keys(
          row || {}
        ).find(
          (key) => {
            const normalizedKey =
              normalizeText(
                key
              );

            return aliases.some(
              (alias) =>
                normalizedKey ===
                  normalizeText(
                    alias
                  ) ||
                normalizedKey.includes(
                  normalizeText(
                    alias
                  )
                )
            );
          }
        );

    const parseRenewalDate =
      (value) => {
        if (
          value instanceof Date &&
          !Number.isNaN(
            value.getTime()
          )
        ) {
          return value;
        }

        const raw =
          String(
            value ?? ""
          ).trim();

        if (!raw) {
          return null;
        }

        const dmy =
          raw.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})$/
          );

        if (dmy) {
          const date =
            new Date(
              Number(dmy[3]),
              Number(dmy[2]) - 1,
              Number(dmy[1])
            );

          return Number.isNaN(
            date.getTime()
          )
            ? null
            : date;
        }

        const parsed =
          new Date(raw);

        return Number.isNaN(
          parsed.getTime()
        )
          ? null
          : parsed;
      };

    const formatRenewalDate =
      (value) => {
        const date =
          parseRenewalDate(
            value
          );

        if (!date) {
          return String(
            value ?? ""
          ).trim() ||
            "date not specified";
        }

        return date.toLocaleDateString(
          "en-GB",
          {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }
        );
      };

    const renewalRecords =
      (renewalSheetRows || [])
        .map(
          (row) => {
            if (
              !row ||
              typeof row !==
                "object"
            ) {
              return null;
            }

            const idColumn =
              findRenewalColumn(
                row,
                [
                  "Renewal ID",
                ]
              );

            const serviceColumn =
              findRenewalColumn(
                row,
                [
                  "Service / AMC",
                  "Service",
                  "AMC",
                ]
              );

            if (
              !idColumn ||
              !serviceColumn
            ) {
              return null;
            }

            const renewalId =
              String(
                row[
                  idColumn
                ] ?? ""
              ).trim();

            const service =
              String(
                row[
                  serviceColumn
                ] ?? ""
              ).trim();

            if (
              !renewalId ||
              !service
            ) {
              return null;
            }

            const vendorColumn =
              findRenewalColumn(
                row,
                ["Vendor"]
              );

            const categoryColumn =
              findRenewalColumn(
                row,
                ["Category"]
              );

            const startColumn =
              findRenewalColumn(
                row,
                ["Start Date"]
              );

            const dueColumn =
              findRenewalColumn(
                row,
                [
                  "Renewal / Due Date",
                  "Renewal Due Date",
                  "Due Date",
                ]
              );

            const frequencyColumn =
              findRenewalColumn(
                row,
                ["Frequency"]
              );

            const amountColumn =
              findRenewalColumn(
                row,
                [
                  "Amount",
                  "Amount (₹)",
                  "Cost",
                ]
              );

            const ownerColumn =
              findRenewalColumn(
                row,
                ["Owner"]
              );

            const statusColumn =
              findRenewalColumn(
                row,
                ["Status"]
              );

            const daysColumn =
              findRenewalColumn(
                row,
                ["Days to Due"]
              );

            const lastPaidColumn =
              findRenewalColumn(
                row,
                ["Last Paid Date"]
              );

            const paymentColumn =
              findRenewalColumn(
                row,
                ["Payment Status"]
              );

            const autoRenewColumn =
              findRenewalColumn(
                row,
                ["Auto Renew"]
              );

            const contactColumn =
              findRenewalColumn(
                row,
                ["Contact"]
              );

            const remarksColumn =
              findRenewalColumn(
                row,
                ["Remarks"]
              );

            return {
              renewalId,
              service,
              vendor:
                vendorColumn
                  ? String(
                      row[
                        vendorColumn
                      ] ?? ""
                    ).trim()
                  : "",
              category:
                categoryColumn
                  ? String(
                      row[
                        categoryColumn
                      ] ?? ""
                    ).trim()
                  : "",
              startDate:
                startColumn
                  ? row[
                      startColumn
                    ]
                  : "",
              dueDate:
                dueColumn
                  ? row[
                      dueColumn
                    ]
                  : "",
              frequency:
                frequencyColumn
                  ? String(
                      row[
                        frequencyColumn
                      ] ?? ""
                    ).trim()
                  : "",
              amount:
                amountColumn
                  ? numberFromValue(
                      row[
                        amountColumn
                      ]
                    )
                  : null,
              owner:
                ownerColumn
                  ? String(
                      row[
                        ownerColumn
                      ] ?? ""
                    ).trim()
                  : "",
              status:
                statusColumn
                  ? String(
                      row[
                        statusColumn
                      ] ?? ""
                    ).trim()
                  : "",
              daysToDue:
                daysColumn
                  ? numberFromValue(
                      row[
                        daysColumn
                      ]
                    )
                  : null,
              lastPaidDate:
                lastPaidColumn
                  ? row[
                      lastPaidColumn
                    ]
                  : "",
              paymentStatus:
                paymentColumn
                  ? String(
                      row[
                        paymentColumn
                      ] ?? ""
                    ).trim()
                  : "",
              autoRenew:
                autoRenewColumn
                  ? String(
                      row[
                        autoRenewColumn
                      ] ?? ""
                    ).trim()
                  : "",
              contact:
                contactColumn
                  ? String(
                      row[
                        contactColumn
                      ] ?? ""
                    ).trim()
                  : "",
              remarks:
                remarksColumn
                  ? String(
                      row[
                        remarksColumn
                      ] ?? ""
                    ).trim()
                  : "",
            };
          }
        )
        .filter(Boolean);

    if (!renewalRecords.length) {
      return [
        "I found the Renewal Master sheet but could not identify renewal records.",
        "",
        "No paid API was used.",
      ].join("\n");
    }

    const asksRenewalCount =
      (
        normalizedQuestion.includes(
          "how many"
        ) ||
        normalizedQuestion.includes(
          "count"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "renewal"
        ) ||
        normalizedQuestion.includes(
          "renewals"
        )
      );

    if (asksRenewalCount) {
      return [
        `Total renewals: ${renewalRecords.length}`,
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksDueSoon =
      normalizedQuestion.includes(
        "due soon"
      );

    if (asksDueSoon) {
      const dueSoon =
        renewalRecords.filter(
          (item) =>
            normalizeText(
              item.status
            ) === "due soon" ||
            (
              item.daysToDue !==
                null &&
              item.daysToDue >= 0 &&
              item.daysToDue <= 30
            )
        );

      if (!dueSoon.length) {
        return [
          "No renewals are currently marked Due Soon.",
          "",
          `Source: ${renewalSheetName}`,
        ].join("\n");
      }

      return [
        `Renewals due soon: ${dueSoon.length}`,
        "",
        ...dueSoon.map(
          (item) =>
            `${item.service} — Due: ${formatRenewalDate(
              item.dueDate
            )}${item.daysToDue !== null ? ` — ${item.daysToDue} day${item.daysToDue === 1 ? "" : "s"} to due` : ""} — ₹${item.amount === null ? "amount not specified" : Number(item.amount).toLocaleString("en-IN")}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksDueNext =
      normalizedQuestion.includes(
        "due next"
      ) ||
      normalizedQuestion.includes(
        "next renewal"
      ) ||
      normalizedQuestion.includes(
        "renewal is next"
      ) ||
      normalizedQuestion.includes(
        "renewal comes next"
      );

    if (asksDueNext) {
      const futureRenewals =
        renewalRecords
          .map(
            (item) => ({
              ...item,
              parsedDueDate:
                parseRenewalDate(
                  item.dueDate
                ),
            })
          )
          .filter(
            (item) =>
              item.parsedDueDate &&
              (
                item.daysToDue ===
                  null ||
                item.daysToDue >= 0
              )
          )
          .sort(
            (a, b) =>
              a.parsedDueDate.getTime() -
              b.parsedDueDate.getTime()
          );

      if (!futureRenewals.length) {
        return [
          "I could not find a future renewal due date.",
          "",
          `Source: ${renewalSheetName}`,
        ].join("\n");
      }

      const firstDueTime =
        futureRenewals[0]
          .parsedDueDate
          .getTime();

      const nextRenewals =
        futureRenewals.filter(
          (item) =>
            item.parsedDueDate.getTime() ===
            firstDueTime
        );

      return [
        nextRenewals.length === 1
          ? "Next renewal due:"
          : "Next renewals due:",
        "",
        ...nextRenewals.map(
          (item) =>
            `${item.service} — Due: ${formatRenewalDate(
              item.dueDate
            )}${item.daysToDue !== null ? ` — ${item.daysToDue} day${item.daysToDue === 1 ? "" : "s"} to due` : ""} — ₹${item.amount === null ? "amount not specified" : Number(item.amount).toLocaleString("en-IN")}`
        ),
        "",
        nextRenewals.length > 1
          ? "Tie shown instead of guessed."
          : `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksDueThisMonth =
      normalizedQuestion.includes(
        "due this month"
      ) ||
      normalizedQuestion.includes(
        "renew this month"
      );

    if (asksDueThisMonth) {
      const today =
        new Date();

      const matches =
        renewalRecords.filter(
          (item) => {
            const due =
              parseRenewalDate(
                item.dueDate
              );

            return (
              due &&
              due.getFullYear() ===
                today.getFullYear() &&
              due.getMonth() ===
                today.getMonth()
            );
          }
        );

      if (!matches.length) {
        return [
          "No renewals have a due date in the current month.",
          "",
          `Source: ${renewalSheetName}`,
        ].join("\n");
      }

      return [
        `Renewals due this month: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            `${item.service} — ${formatRenewalDate(
              item.dueDate
            )} — ${item.status || "status not specified"}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksOverdue =
      normalizedQuestion.includes(
        "overdue"
      );

    if (asksOverdue) {
      const overdue =
        renewalRecords.filter(
          (item) =>
            normalizeText(
              item.status
            ) === "overdue" ||
            (
              item.daysToDue !==
                null &&
              item.daysToDue < 0
            )
        );

      if (!overdue.length) {
        return [
          "No renewals are currently overdue.",
          "",
          `Source: ${renewalSheetName}`,
        ].join("\n");
      }

      return [
        `Overdue renewals: ${overdue.length}`,
        "",
        ...overdue.map(
          (item) =>
            `${item.service} — Due: ${formatRenewalDate(
              item.dueDate
            )}${item.daysToDue !== null ? ` — ${Math.abs(item.daysToDue)} day${Math.abs(item.daysToDue) === 1 ? "" : "s"} overdue` : ""} — Payment: ${item.paymentStatus || "not specified"}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksAllRenewals =
      normalizedQuestion.includes(
        "show all renewal"
      ) ||
      normalizedQuestion.includes(
        "show me all renewal"
      ) ||
      normalizedQuestion.includes(
        "all renewal details"
      ) ||
      normalizedQuestion.includes(
        "show renewal details"
      ) ||
      normalizedQuestion.includes(
        "list all renewal"
      );

    if (asksAllRenewals) {
      return [
        `Renewal details: ${renewalRecords.length}`,
        "",
        ...renewalRecords.map(
          (item) =>
            `${item.renewalId} — ${item.service} — ${item.vendor || "vendor not specified"} — Due: ${formatRenewalDate(item.dueDate)} — ₹${item.amount === null ? "amount not specified" : Number(item.amount).toLocaleString("en-IN")} — ${item.status || "status not specified"}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksRenewalTotalCost =
      (
        normalizedQuestion.includes(
          "total renewal cost"
        ) ||
        normalizedQuestion.includes(
          "total renewal amount"
        ) ||
        normalizedQuestion.includes(
          "total cost of all renewals"
        ) ||
        normalizedQuestion.includes(
          "total cost of renewals"
        ) ||
        normalizedQuestion.includes(
          "how much do all renewals cost"
        ) ||
        (
          normalizedQuestion.includes(
            "how much"
          ) &&
          normalizedQuestion.includes(
            "renewal"
          )
        )
      );

    if (asksRenewalTotalCost) {
      const total =
        renewalRecords.reduce(
          (sum, item) =>
            sum +
            (
              item.amount ===
              null
                ? 0
                : item.amount
            ),
          0
        );

      const numericCount =
        renewalRecords.filter(
          (item) =>
            item.amount !==
            null
        ).length;

      return [
        `Recorded renewal cost total: ₹${Number(
          total
        ).toLocaleString(
          "en-IN"
        )}`,
        "",
        `Numeric renewal amounts counted: ${numericCount}`,
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksHighestRenewalCost =
      (
        normalizedQuestion.includes(
          "highest"
        ) ||
        normalizedQuestion.includes(
          "most expensive"
        ) ||
        normalizedQuestion.includes(
          "costs the most"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "renewal"
        ) ||
        normalizedQuestion.includes(
          "amc"
        ) ||
        normalizedQuestion.includes(
          "subscription"
        )
      );

    if (asksHighestRenewalCost) {
      const numeric =
        renewalRecords.filter(
          (item) =>
            item.amount !==
            null
        );

      if (!numeric.length) {
        return [
          "I could not find numeric renewal amounts.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const highest =
        Math.max(
          ...numeric.map(
            (item) =>
              item.amount
          )
        );

      const leaders =
        numeric.filter(
          (item) =>
            item.amount ===
            highest
        );

      return [
        leaders.length === 1
          ? "Highest-cost renewal:"
          : "Highest-cost renewals:",
        "",
        ...leaders.map(
          (item) =>
            `${item.service} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )} — Due: ${formatRenewalDate(
              item.dueDate
            )}`
        ),
        "",
        leaders.length > 1
          ? "Tie shown instead of guessed."
          : `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksAutoRenew =
      normalizedQuestion.includes(
        "auto renew"
      ) ||
      normalizedQuestion.includes(
        "automatic renewal"
      );

    if (asksAutoRenew) {
      const auto =
        renewalRecords.filter(
          (item) =>
            ["yes", "y", "true"]
              .includes(
                normalizeText(
                  item.autoRenew
                )
              )
        );

      if (!auto.length) {
        return [
          "No renewals are marked for auto-renewal.",
          "",
          `Source: ${renewalSheetName}`,
        ].join("\n");
      }

      return [
        `Auto-renew renewals: ${auto.length}`,
        "",
        ...auto.map(
          (item) =>
            `${item.service} — Due: ${formatRenewalDate(item.dueDate)} — ${item.vendor || "vendor not specified"}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksPendingRenewalPayments =
      (
        normalizedQuestion.includes(
          "pending payment"
        ) ||
        normalizedQuestion.includes(
          "payments are pending"
        ) ||
        normalizedQuestion.includes(
          "payment pending"
        )
      );

    if (asksPendingRenewalPayments) {
      const pending =
        renewalRecords.filter(
          (item) =>
            normalizeText(
              item.paymentStatus
            ).includes(
              "pending"
            ) ||
            normalizeText(
              item.paymentStatus
            ).includes(
              "part paid"
            )
        );

      if (!pending.length) {
        return [
          "No renewal payments are marked Pending or Part Paid.",
          "",
          `Source: ${renewalSheetName}`,
        ].join("\n");
      }

      return [
        `Renewal payments pending: ${pending.length}`,
        "",
        ...pending.map(
          (item) =>
            `${item.service} — ₹${item.amount === null ? "amount not specified" : Number(item.amount).toLocaleString("en-IN")} — ${item.paymentStatus}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    const asksByCategory =
      normalizedQuestion.includes(
        "by category"
      ) ||
      normalizedQuestion.includes(
        "category summary"
      );

    if (asksByCategory) {
      const categoryMap =
        new Map();

      renewalRecords.forEach(
        (item) => {
          const category =
            item.category ||
            "Unspecified";

          if (
            !categoryMap.has(
              category
            )
          ) {
            categoryMap.set(
              category,
              {
                count: 0,
                total: 0,
              }
            );
          }

          const bucket =
            categoryMap.get(
              category
            );

          bucket.count += 1;

          if (
            item.amount !==
            null
          ) {
            bucket.total +=
              item.amount;
          }
        }
      );

      return [
        "Renewal summary by category:",
        "",
        ...Array.from(
          categoryMap.entries()
        ).map(
          ([category, values]) =>
            `${category} — ${values.count} renewal${values.count === 1 ? "" : "s"} — ₹${Number(values.total).toLocaleString("en-IN")}`
        ),
        "",
        `Source: ${renewalSheetName}`,
      ].join("\n");
    }

    /*
     * Specific service / AMC lookup.
     * Example: "When is the AC AMC due?"
     */
    const serviceCandidates =
      [...renewalRecords]
        .sort(
          (a, b) =>
            b.service.length -
            a.service.length
        );

    const mentionedRenewal =
      serviceCandidates.find(
        (item) => {
          const full =
            normalizeText(
              item.service
            );

          if (
            normalizedQuestion.includes(
              full
            )
          ) {
            return true;
          }

          const meaningfulTokens =
            full
              .split(/\s+/)
              .filter(
                (token) =>
                  token.length >= 2 &&
                  ![
                    "annual",
                    "maintenance",
                    "service",
                    "support",
                    "contract",
                    "plan",
                    "subscription",
                  ].includes(
                    token
                  )
              );

          return (
            meaningfulTokens.length >= 1 &&
            meaningfulTokens.every(
              (token) =>
                normalizedQuestion.includes(
                  token
                )
            )
          );
        }
      );

    const asksSpecificDue =
      Boolean(
        mentionedRenewal
      ) &&
      (
        normalizedQuestion.includes(
          "when"
        ) ||
        normalizedQuestion.includes(
          "due"
        ) ||
        normalizedQuestion.includes(
          "renew"
        )
      );

    if (asksSpecificDue) {
      return [
        `${mentionedRenewal.service}`,
        "",
        `Due date: ${formatRenewalDate(
          mentionedRenewal.dueDate
        )}`,
        `Status: ${mentionedRenewal.status || "not specified"}`,
        mentionedRenewal.daysToDue !==
          null
          ? `Days to due: ${mentionedRenewal.daysToDue}`
          : "",
        mentionedRenewal.vendor
          ? `Vendor: ${mentionedRenewal.vendor}`
          : "",
        mentionedRenewal.amount !==
          null
          ? `Amount: ₹${Number(
              mentionedRenewal.amount
            ).toLocaleString(
              "en-IN"
            )}`
          : "",
        "",
        `Source: ${renewalSheetName}`,
      ]
        .filter(
          (line) =>
            line !== ""
        )
        .join("\n");
    }

    return [
      "I recognized this as a Renewal / AMC question, but I do not yet have a safe local rule for this exact request.",
      "",
      "No paid API was used.",
      `Source: ${renewalSheetName}`,
    ].join("\n");
  }


  /*
   * =========================================================
   * EXPENSES AI — LOCAL, $0 API — V1
   * =========================================================
   *
   * Built for the real "Master Sheet - Expense Tracker.xlsx".
   *
   * Transaction/detail sources:
   * - Stratagem & SharksDen
   * - Flight & Hotels
   * - Snacks, Medicine & Internet (3 side-by-side tables)
   * - Stationary (month blocks)
   *
   * Excluded from expense-entry counting:
   * - Main Sheet (summary/budget-style sheet)
   * - Furniture and Fixture (inventory)
   * - Electronics (inventory)
   *
   * This prevents expense questions from being answered with
   * Electronics stock while still allowing inventory questions
   * to use Electronics normally.
   */
  if (expenseRoutingIntent) {
    const expenseSheetEntries =
      Object.entries(
        workbookData || {}
      );

    const findExpenseSheet =
      (wantedName) =>
        expenseSheetEntries.find(
          ([sheetName]) =>
            normalizeText(
              sheetName
            ) ===
            normalizeText(
              wantedName
            )
        );

    const expenseRecords = [];

    const pushExpenseRecord =
      ({
        sheetName,
        description,
        amount,
        date = "",
        category = "",
        vendor = "",
      }) => {
        const numericAmount =
          typeof amount === "number"
            ? amount
            : Number(
                String(
                  amount ?? ""
                )
                  .replace(
                    /₹|,/g,
                    ""
                  )
                  .trim()
              );

        if (
          !description ||
          !Number.isFinite(
            numericAmount
          ) ||
          numericAmount <= 0
        ) {
          return;
        }

        expenseRecords.push({
          sheetName,
          description:
            String(
              description
            ).trim(),
          amount:
            numericAmount,
          date:
            String(
              date ?? ""
            ).trim(),
          category:
            String(
              category ?? ""
            ).trim(),
          vendor:
            String(
              vendor ?? ""
            ).trim(),
        });
      };

    /*
     * Stratagem & SharksDen
     * Expected parsed positions:
     * 0 Sr/No
     * 1 Material
     * 2 Quantity
     * 3 Rate
     * 4 Amount Day 1
     * 5 Amount Day 2
     *
     * Day 1 + Day 2 are treated as ONE expense entry for the
     * material row, because they belong to the same detail line.
     */
    const stratagemSheet =
      findExpenseSheet(
        "Stratagem & SharksDen"
      );

    if (stratagemSheet) {
      const [sheetName, rows] =
        stratagemSheet;

      (rows || []).forEach(
        (row) => {
          const values =
            Object.values(
              row || {}
            );

          const serial =
            Number(
              values[0]
            );

          const material =
            String(
              values[1] ?? ""
            ).trim();

          if (
            !Number.isFinite(
              serial
            ) ||
            !material
          ) {
            return;
          }

          const day1 =
            Number(
              values[4]
            );

          const day2 =
            Number(
              values[5]
            );

          const amount =
            (Number.isFinite(day1)
              ? day1
              : 0) +
            (Number.isFinite(day2)
              ? day2
              : 0);

          if (amount > 0) {
            pushExpenseRecord({
              sheetName,
              description:
                material,
              amount,
              category:
                "Stratagem & SharksDen",
            });
          }
        }
      );
    }

    /*
     * Flight & Hotels
     *
     * Use the real column names instead of positional Object.values().
     * XLSX may return formatted currency strings such as "7,191",
     * so use numberFromValue() rather than Number().
     */
    const travelSheet =
      findExpenseSheet(
        "Flight & Hotels"
      );

    if (travelSheet) {
      const [sheetName, rows] =
        travelSheet;

      (rows || []).forEach(
        (row) => {
          const keys =
            Object.keys(
              row || {}
            );

          const nameColumn =
            keys.find(
              (key) =>
                normalizeText(
                  key
                ) === "name"
            );

          const categoryColumn =
            keys.find(
              (key) =>
                normalizeText(
                  key
                ) === "category"
            );

          const dateColumn =
            keys.find(
              (key) =>
                normalizeText(
                  key
                ).includes(
                  "flight dates"
                )
            );

          const amountColumn =
            keys.find(
              (key) => {
                const k =
                  normalizeText(
                    key
                  );

                return (
                  k.includes(
                    "flight/hotel"
                  ) ||
                  k.includes(
                    "flight hotel"
                  ) ||
                  (
                    k.includes(
                      "flight"
                    ) &&
                    k.includes(
                      "inr"
                    )
                  )
                );
              }
            );

          const person =
            nameColumn
              ? String(
                  row[
                    nameColumn
                  ] ?? ""
                ).trim()
              : "";

          const amount =
            amountColumn
              ? numberFromValue(
                  row[
                    amountColumn
                  ]
                )
              : null;

          if (
            !person ||
            amount === null ||
            amount <= 0
          ) {
            return;
          }

          pushExpenseRecord({
            sheetName,
            description:
              person,
            amount,
            date:
              dateColumn
                ? row[
                    dateColumn
                  ]
                : "",
            category:
              categoryColumn
                ? row[
                    categoryColumn
                  ]
                : "Flight & Hotels",
          });
        }
      );
    }

    /*
     * Snacks, Medicine & Internet contains three tables:
     * Snacks   => positions 0..3
     * Medicine => positions 5..8
     * Internet => positions 10..15, with Total at 15
     */
    const smiSheet =
      findExpenseSheet(
        "Snacks, Medicine & Internet"
      );

    if (smiSheet) {
      const [sheetName, rows] =
        smiSheet;

      (rows || []).forEach(
        (row) => {
          const values =
            Object.values(
              row || {}
            );

          const blocks = [
            {
              serial: 0,
              date: 1,
              desc: 2,
              amount: 3,
              category: "Snacks",
            },
            {
              serial: 5,
              date: 6,
              desc: 7,
              amount: 8,
              category: "Medicine",
            },
            {
              serial: 10,
              date: 11,
              desc: 12,
              amount: 15,
              category: "Internet",
            },
          ];

          blocks.forEach(
            (block) => {
              const serial =
                Number(
                  values[
                    block.serial
                  ]
                );

              const desc =
                String(
                  values[
                    block.desc
                  ] ?? ""
                ).trim();

              const amount =
                Number(
                  values[
                    block.amount
                  ]
                );

              if (
                Number.isFinite(
                  serial
                ) &&
                desc &&
                Number.isFinite(
                  amount
                )
              ) {
                pushExpenseRecord({
                  sheetName,
                  description:
                    desc,
                  amount,
                  date:
                    values[
                      block.date
                    ],
                  category:
                    block.category,
                });
              }
            }
          );
        }
      );
    }

    /*
     * Stationary is a multi-month matrix. Each month block has
     * a description followed by quantity/amount fields.
     *
     * We only count rows with a non-empty description and a
     * positive numeric amount. Obvious month labels and subtotal/
     * total rows are excluded.
     */
    const stationarySheet =
      findExpenseSheet(
        "Stationary"
      );

    if (stationarySheet) {
      const [sheetName, rows] =
        stationarySheet;

      (rows || []).forEach(
        (row) => {
          const values =
            Object.values(
              row || {}
            );

          const monthBlocks = [
            {
              desc: 1,
              amount: 2,
              month: "Kutch",
            },
            {
              desc: 5,
              amount: 7,
              month: "April",
            },
            {
              desc: 10,
              amount: 12,
              month: "May",
            },
            {
              desc: 15,
              amount: 17,
              month: "June",
            },
            {
              desc: 20,
              amount: 22,
              month: "July",
            },
            {
              desc: 25,
              amount: 27,
              month: "August",
            },
          ];

          monthBlocks.forEach(
            (block) => {
              const desc =
                String(
                  values[
                    block.desc
                  ] ?? ""
                ).trim();

              const amount =
                Number(
                  values[
                    block.amount
                  ]
                );

              const d =
                normalizeText(
                  desc
                );

              const looksLikeLabel =
                [
                  "april",
                  "may",
                  "june",
                  "july",
                  "august",
                  "september",
                  "october",
                  "november",
                  "december",
                  "january",
                  "february",
                  "march",
                  "total",
                  "subtotal",
                ].includes(d);

              if (
                desc &&
                !looksLikeLabel &&
                Number.isFinite(
                  amount
                ) &&
                amount > 0
              ) {
                pushExpenseRecord({
                  sheetName,
                  description:
                    desc,
                  amount,
                  category:
                    `Stationary - ${block.month}`,
                });
              }
            }
          );
        }
      );
    }

    const expenseSourceNames =
      [
        ...new Set(
          expenseRecords.map(
            (item) =>
              item.sheetName
          )
        ),
      ];

    const asksExpenseCount =
      (
        normalizedQuestion.includes(
          "how many"
        ) ||
        normalizedQuestion.includes(
          "count"
        )
      ) &&
      normalizedQuestion.includes(
        "expense"
      );

    if (asksExpenseCount) {
      return [
        `Expense entries: ${expenseRecords.length}`,
        "",
        "Counted transaction/detail rows only.",
        "Main Sheet summary rows and Furniture/Electronics inventory rows are excluded.",
        "",
        `Source: ${expenseSourceNames.join(", ")}`,
      ].join("\n");
    }

    /*
     * ---------------------------------------------------------
     * EXPENSE SUMMARY BY CATEGORY — LOCAL, $0 API
     * ---------------------------------------------------------
     */
    const expenseSummaryCategories = [
      {
        label: "Flight & Hotels",
        matches:
          (item) =>
            item.sheetName ===
            "Flight & Hotels",
      },
      {
        label: "Snacks",
        matches:
          (item) =>
            normalizeText(
              item.category
            ) === "snacks",
      },
      {
        label: "Medicine",
        matches:
          (item) =>
            normalizeText(
              item.category
            ) === "medicine",
      },
      {
        label: "Internet",
        matches:
          (item) =>
            normalizeText(
              item.category
            ) === "internet",
      },
      {
        label: "Stationary",
        matches:
          (item) =>
            normalizeText(
              item.category
            ).startsWith(
              "stationary"
            ),
      },
      {
        label: "Stratagem & SharksDen",
        matches:
          (item) =>
            item.sheetName ===
            "Stratagem & SharksDen",
      },
    ];

    const expenseCategorySummary =
      expenseSummaryCategories.map(
        (definition) => {
          const records =
            expenseRecords.filter(
              definition.matches
            );

          return {
            label:
              definition.label,
            count:
              records.length,
            total:
              records.reduce(
                (sum, item) =>
                  sum +
                  item.amount,
                0
              ),
          };
        }
      );

    const asksExpenseSummaryByCategory =
      (
        normalizedQuestion.includes(
          "summary by category"
        ) ||
        normalizedQuestion.includes(
          "category summary"
        ) ||
        (
          normalizedQuestion.includes(
            "show"
          ) &&
          normalizedQuestion.includes(
            "category"
          ) &&
          normalizedQuestion.includes(
            "expense"
          )
        )
      );

    if (asksExpenseSummaryByCategory) {
      const grandTotal =
        expenseCategorySummary.reduce(
          (sum, item) =>
            sum +
            item.total,
          0
        );

      return [
        "Expense summary by category:",
        "",
        ...expenseCategorySummary.map(
          (item) =>
            `${item.label} — ₹${Number(
              item.total
            ).toLocaleString(
              "en-IN"
            )} — ${item.count} entr${item.count === 1 ? "y" : "ies"}`
        ),
        "",
        `Grand total: ₹${Number(
          grandTotal
        ).toLocaleString(
          "en-IN"
        )}`,
        `Total entries: ${expenseRecords.length}`,
      ].join("\n");
    }

    /*
     * ---------------------------------------------------------
     * EXPENSE CATEGORY WITH MOST ENTRIES — LOCAL, $0 API
     * ---------------------------------------------------------
     */
    const asksMostExpenseEntries =
      normalizedQuestion.includes(
        "expense category has the most entries"
      ) ||
      normalizedQuestion.includes(
        "category has the most entries"
      ) ||
      normalizedQuestion.includes(
        "most expense entries"
      ) ||
      (
        normalizedQuestion.includes(
          "category"
        ) &&
        normalizedQuestion.includes(
          "most"
        ) &&
        normalizedQuestion.includes(
          "entries"
        )
      );

    if (asksMostExpenseEntries) {
      const highestCount =
        Math.max(
          ...expenseCategorySummary.map(
            (item) =>
              item.count
          )
        );

      const leaders =
        expenseCategorySummary.filter(
          (item) =>
            item.count ===
            highestCount
        );

      return [
        leaders.length === 1
          ? "Expense category with the most entries:"
          : "Expense categories with the most entries:",
        "",
        ...leaders.map(
          (item) =>
            `${item.label} — ${item.count} entries — ₹${Number(
              item.total
            ).toLocaleString(
              "en-IN"
            )}`
        ),
        "",
        leaders.length > 1
          ? "Tie shown instead of guessed."
          : "Source: Expense Tracker",
      ].join("\n");
    }

    /*
     * ---------------------------------------------------------
     * HIGHEST EXPENSE CATEGORY — LOCAL, $0 API
     * ---------------------------------------------------------
     */
    const asksHighestExpenseCategory =
      normalizedQuestion.includes(
        "highest expense category"
      ) ||
      normalizedQuestion.includes(
        "category has the highest expense"
      ) ||
      normalizedQuestion.includes(
        "category had the highest expense"
      ) ||
      normalizedQuestion.includes(
        "expense category costs the most"
      ) ||
      normalizedQuestion.includes(
        "expense category cost the most"
      ) ||
      normalizedQuestion.includes(
        "category costs the most"
      ) ||
      (
        normalizedQuestion.includes(
          "category"
        ) &&
        normalizedQuestion.includes(
          "highest"
        ) &&
        normalizedQuestion.includes(
          "expense"
        )
      );

    if (asksHighestExpenseCategory) {
      const highestTotal =
        Math.max(
          ...expenseCategorySummary.map(
            (item) =>
              item.total
          )
        );

      const leaders =
        expenseCategorySummary.filter(
          (item) =>
            item.total ===
            highestTotal
        );

      return [
        leaders.length === 1
          ? "Highest expense category:"
          : "Highest expense categories:",
        "",
        ...leaders.map(
          (item) =>
            `${item.label} — ₹${Number(
              item.total
            ).toLocaleString(
              "en-IN"
            )} — ${item.count} entr${item.count === 1 ? "y" : "ies"}`
        ),
        "",
        "Source: Expense Tracker",
      ].join("\n");
    }

    /*
     * ---------------------------------------------------------
     * PERSON-SPECIFIC FLIGHT & HOTEL SPEND — LOCAL, $0 API
     * ---------------------------------------------------------
     *
     * Matches a person's name from Flight & Hotels against
     * the user's question. Multiple rows are summed.
     */
    const travelRecordsAll =
      expenseRecords.filter(
        (item) =>
          item.sheetName ===
          "Flight & Hotels"
      );

    const travelPeople =
      [
        ...new Set(
          travelRecordsAll.map(
            (item) =>
              item.description
          )
        ),
      ]
        .filter(Boolean)
        .sort(
          (a, b) =>
            b.length -
            a.length
        );

    const mentionedTravelPerson =
      travelPeople.find(
        (person) => {
          const full =
            normalizeText(
              person
            );

          const firstName =
            full.split(
              /\s+/
            )[0];

          return (
            normalizedQuestion.includes(
              full
            ) ||
            (
              firstName.length >= 3 &&
              normalizedQuestion.includes(
                firstName
              )
            )
          );
        }
      );

    const asksPersonTravelSpend =
      Boolean(
        mentionedTravelPerson
      ) &&
      (
        normalizedQuestion.includes(
          "flight"
        ) ||
        normalizedQuestion.includes(
          "hotel"
        ) ||
        normalizedQuestion.includes(
          "travel"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "how much"
        ) ||
        normalizedQuestion.includes(
          "spend"
        ) ||
        normalizedQuestion.includes(
          "spent"
        ) ||
        normalizedQuestion.includes(
          "total"
        )
      );

    if (asksPersonTravelSpend) {
      const personRecords =
        travelRecordsAll.filter(
          (item) =>
            normalizeText(
              item.description
            ) ===
            normalizeText(
              mentionedTravelPerson
            )
        );

      const personTotal =
        personRecords.reduce(
          (sum, item) =>
            sum +
            item.amount,
          0
        );

      return [
        `${mentionedTravelPerson} — Flight & Hotels total: ₹${Number(
          personTotal
        ).toLocaleString(
          "en-IN"
        )}`,
        "",
        `Entries counted: ${personRecords.length}`,
        "",
        ...personRecords.map(
          (item) =>
            `${item.date || "Date not specified"} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )}${item.category ? ` — ${item.category}` : ""}`
        ),
        "",
        "Source: Flight & Hotels",
      ].join("\n");
    }

    /*
     * ---------------------------------------------------------
     * HIGHEST FLIGHT / HOTEL EXPENSE — LOCAL, $0 API
     * ---------------------------------------------------------
     */
    const asksHighestTravelExpense =
      (
        normalizedQuestion.includes(
          "highest"
        ) ||
        normalizedQuestion.includes(
          "largest"
        ) ||
        normalizedQuestion.includes(
          "most expensive"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "flight"
        ) ||
        normalizedQuestion.includes(
          "hotel"
        ) ||
        normalizedQuestion.includes(
          "travel"
        )
      );

    if (asksHighestTravelExpense) {
      if (!travelRecordsAll.length) {
        return [
          "No Flight & Hotels expense rows were found.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const highestTravelAmount =
        Math.max(
          ...travelRecordsAll.map(
            (item) =>
              item.amount
          )
        );

      const travelLeaders =
        travelRecordsAll.filter(
          (item) =>
            item.amount ===
            highestTravelAmount
        );

      return [
        travelLeaders.length === 1
          ? "Highest Flight & Hotels expense:"
          : "Highest Flight & Hotels expenses:",
        "",
        ...travelLeaders.map(
          (item) =>
            `${item.description} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )}${item.category ? ` — ${item.category}` : ""}${item.date ? ` — ${item.date}` : ""}`
        ),
        "",
        "Source: Flight & Hotels",
      ].join("\n");
    }


    const asksFlightHotelTotal =
      (
        normalizedQuestion.includes(
          "flight"
        ) ||
        normalizedQuestion.includes(
          "hotel"
        ) ||
        normalizedQuestion.includes(
          "travel"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "how much"
        ) ||
        normalizedQuestion.includes(
          "spend"
        ) ||
        normalizedQuestion.includes(
          "spent"
        ) ||
        normalizedQuestion.includes(
          "total"
        )
      );

    if (asksFlightHotelTotal) {
      const monthNamesForTravel = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      };

      const requestedTravelMonthEntry =
        Object.entries(
          monthNamesForTravel
        ).find(
          ([monthName]) =>
            normalizedQuestion.includes(
              monthName
            )
        );

      const requestedTravelYearMatch =
        normalizedQuestion.match(
          /\b(20\d{2})\b/
        );

      const requestedTravelMonth =
        requestedTravelMonthEntry
          ? requestedTravelMonthEntry[1]
          : null;

      const requestedTravelYear =
        requestedTravelYearMatch
          ? Number(
              requestedTravelYearMatch[1]
            )
          : null;

      const parseTravelDate =
        (value) => {
          const raw =
            String(
              value ?? ""
            ).trim();

          if (!raw) {
            return null;
          }

          const dmy =
            raw.match(
              /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
            );

          if (dmy) {
            return {
              month: Number(dmy[2]),
              year: Number(dmy[3]),
            };
          }

          const parsed =
            new Date(
              raw
            );

          if (
            Number.isNaN(
              parsed.getTime()
            )
          ) {
            return null;
          }

          return {
            month: parsed.getMonth() + 1,
            year: parsed.getFullYear(),
          };
        };

      const travelRecords =
        expenseRecords
          .filter(
            (item) =>
              item.sheetName ===
              "Flight & Hotels"
          )
          .filter(
            (item) => {
              if (
                !requestedTravelMonth &&
                !requestedTravelYear
              ) {
                return true;
              }

              const parsed =
                parseTravelDate(
                  item.date
                );

              if (!parsed) {
                return false;
              }

              if (
                requestedTravelMonth &&
                parsed.month !==
                  requestedTravelMonth
              ) {
                return false;
              }

              if (
                requestedTravelYear &&
                parsed.year !==
                  requestedTravelYear
              ) {
                return false;
              }

              return true;
            }
          );

      if (!travelRecords.length) {
        return [
          "I could not find valid Flight & Hotels expense rows for the requested period.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const travelTotal =
        travelRecords.reduce(
          (sum, item) =>
            sum +
            item.amount,
          0
        );

      const periodLabel =
        requestedTravelMonthEntry ||
        requestedTravelYear
          ? [
              requestedTravelMonthEntry
                ? requestedTravelMonthEntry[0]
                    .charAt(0)
                    .toUpperCase() +
                  requestedTravelMonthEntry[0]
                    .slice(1)
                : "",
              requestedTravelYear || "",
            ]
              .filter(Boolean)
              .join(" ")
          : null;

      return [
        periodLabel
          ? `Flight & Hotels expense total for ${periodLabel}: ₹${Number(
              travelTotal
            ).toLocaleString(
              "en-IN"
            )}`
          : `Flight & Hotels expense total: ₹${Number(
              travelTotal
            ).toLocaleString(
              "en-IN"
            )}`,
        "",
        `Entries counted: ${travelRecords.length}`,
        "",
        `Source: Flight & Hotels`,
      ].join("\n");
    }

    const asksShowFlightHotelExpenses =
      (
        normalizedQuestion.includes(
          "show"
        ) ||
        normalizedQuestion.includes(
          "list"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "flight"
        ) ||
        normalizedQuestion.includes(
          "hotel"
        ) ||
        normalizedQuestion.includes(
          "travel"
        )
      ) &&
      normalizedQuestion.includes(
        "expense"
      );

    if (asksShowFlightHotelExpenses) {
      const travelRecords =
        expenseRecords.filter(
          (item) =>
            item.sheetName ===
            "Flight & Hotels"
        );

      if (!travelRecords.length) {
        return [
          "No Flight & Hotels expense rows were found.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `Flight & Hotels expenses: ${travelRecords.length}`,
        "",
        ...travelRecords.map(
          (item) =>
            `${item.description} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )}${item.category ? ` — ${item.category}` : ""}${item.date ? ` — ${item.date}` : ""}`
        ),
        "",
        "Source: Flight & Hotels",
      ].join("\n");
    }


    /*
     * CATEGORY-SPECIFIC EXPENSE TOTALS — LOCAL, $0 API
     * Must run before the generic total-expense rule.
     */
    const expenseCategoryDefinitions = [
      {
        label: "Snacks",
        matchesQuestion:
          normalizedQuestion.includes("snack"),
        matchesRecord:
          (item) =>
            normalizeText(item.category) === "snacks",
      },
      {
        label: "Medicine",
        matchesQuestion:
          normalizedQuestion.includes("medicine"),
        matchesRecord:
          (item) =>
            normalizeText(item.category) === "medicine",
      },
      {
        label: "Internet",
        matchesQuestion:
          normalizedQuestion.includes("internet"),
        matchesRecord:
          (item) =>
            normalizeText(item.category) === "internet",
      },
      {
        label: "Stationary",
        matchesQuestion:
          normalizedQuestion.includes("stationary") ||
          normalizedQuestion.includes("stationery"),
        matchesRecord:
          (item) =>
            normalizeText(item.category).startsWith("stationary"),
      },
      {
        label: "Stratagem & SharksDen",
        matchesQuestion:
          normalizedQuestion.includes("stratagem") ||
          normalizedQuestion.includes("sharksden") ||
          normalizedQuestion.includes("sharks den"),
        matchesRecord:
          (item) =>
            normalizeText(item.sheetName) ===
            normalizeText("Stratagem & SharksDen"),
      },
    ];

    const requestedExpenseCategory =
      expenseCategoryDefinitions.find(
        (definition) =>
          definition.matchesQuestion
      );

    const asksCategoryExpenseTotal =
      Boolean(requestedExpenseCategory) &&
      (
        normalizedQuestion.includes("how much") ||
        normalizedQuestion.includes("spend") ||
        normalizedQuestion.includes("spent") ||
        normalizedQuestion.includes("total")
      );

    if (
      asksCategoryExpenseTotal &&
      requestedExpenseCategory
    ) {
      const categoryMonthNames = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      };

      const requestedCategoryMonthEntry =
        Object.entries(
          categoryMonthNames
        ).find(
          ([monthName]) =>
            normalizedQuestion.includes(
              monthName
            )
        );

      const requestedCategoryYearMatch =
        normalizedQuestion.match(
          /\b(20\d{2})\b/
        );

      const requestedCategoryMonth =
        requestedCategoryMonthEntry
          ? requestedCategoryMonthEntry[1]
          : null;

      const requestedCategoryYear =
        requestedCategoryYearMatch
          ? Number(
              requestedCategoryYearMatch[1]
            )
          : null;

      const parseCategoryExpenseDate =
        (value) => {
          const raw =
            String(
              value ?? ""
            ).trim();

          if (!raw) {
            return null;
          }

          const dmy =
            raw.match(
              /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
            );

          if (dmy) {
            return {
              month: Number(dmy[2]),
              year: Number(dmy[3]),
            };
          }

          const parsed =
            new Date(
              raw
            );

          if (
            Number.isNaN(
              parsed.getTime()
            )
          ) {
            return null;
          }

          return {
            month: parsed.getMonth() + 1,
            year: parsed.getFullYear(),
          };
        };

      const categoryRecords =
        expenseRecords
          .filter(
            requestedExpenseCategory.matchesRecord
          )
          .filter(
            (item) => {
              if (
                !requestedCategoryMonth &&
                !requestedCategoryYear
              ) {
                return true;
              }

              const parsed =
                parseCategoryExpenseDate(
                  item.date
                );

              if (!parsed) {
                return false;
              }

              if (
                requestedCategoryMonth &&
                parsed.month !==
                  requestedCategoryMonth
              ) {
                return false;
              }

              if (
                requestedCategoryYear &&
                parsed.year !==
                  requestedCategoryYear
              ) {
                return false;
              }

              return true;
            }
          );

      if (
        (
          requestedCategoryMonth ||
          requestedCategoryYear
        ) &&
        !categoryRecords.length
      ) {
        return [
          `No ${requestedExpenseCategory.label} expense entries were found for the requested period.`,
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const categoryTotal =
        categoryRecords.reduce(
          (sum, item) =>
            sum + item.amount,
          0
        );

      const categorySources = [
        ...new Set(
          categoryRecords.map(
            (item) => item.sheetName
          )
        ),
      ];

      const periodLabel =
        requestedCategoryMonthEntry ||
        requestedCategoryYear
          ? [
              requestedCategoryMonthEntry
                ? requestedCategoryMonthEntry[0]
                    .charAt(0)
                    .toUpperCase() +
                  requestedCategoryMonthEntry[0]
                    .slice(1)
                : "",
              requestedCategoryYear || "",
            ]
              .filter(Boolean)
              .join(" ")
          : null;

      return [
        periodLabel
          ? `${requestedExpenseCategory.label} expense total for ${periodLabel}: ₹${Number(
              categoryTotal
            ).toLocaleString("en-IN")}`
          : `${requestedExpenseCategory.label} expense total: ₹${Number(
              categoryTotal
            ).toLocaleString("en-IN")}`,
        "",
        `Entries counted: ${categoryRecords.length}`,
        "",
        `Source: ${
          categorySources.length
            ? categorySources.join(", ")
            : "No matching expense rows"
        }`,
      ].join("\n");
    }


    const asksTotalExpense =
      !requestedExpenseCategory &&
      !normalizedQuestion.includes(
        "flight"
      ) &&
      !normalizedQuestion.includes(
        "hotel"
      ) &&
      (
        normalizedQuestion.includes(
          "total expense"
        ) ||
        normalizedQuestion.includes(
          "total expenses"
        ) ||
        normalizedQuestion.includes(
          "expense amount"
        ) ||
        normalizedQuestion.includes(
          "how much did we spend"
        )
      ) &&
      !normalizedQuestion.includes(
        "purchase"
      );

    if (asksTotalExpense) {
      const monthNamesForExpense = {
        january: 1,
        february: 2,
        march: 3,
        april: 4,
        may: 5,
        june: 6,
        july: 7,
        august: 8,
        september: 9,
        october: 10,
        november: 11,
        december: 12,
      };

      const requestedMonthEntry =
        Object.entries(
          monthNamesForExpense
        ).find(
          ([monthName]) =>
            normalizedQuestion.includes(
              monthName
            )
        );

      const requestedYearMatch =
        normalizedQuestion.match(
          /\b(20\d{2})\b/
        );

      const requestedMonth =
        requestedMonthEntry
          ? requestedMonthEntry[1]
          : null;

      const requestedYear =
        requestedYearMatch
          ? Number(
              requestedYearMatch[1]
            )
          : null;

      const parseExpenseDate =
        (value) => {
          const raw =
            String(
              value ?? ""
            ).trim();

          if (!raw) {
            return null;
          }

          const dmy =
            raw.match(
              /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
            );

          if (dmy) {
            return {
              day: Number(dmy[1]),
              month: Number(dmy[2]),
              year: Number(dmy[3]),
            };
          }

          const parsed =
            new Date(
              raw
            );

          if (
            Number.isNaN(
              parsed.getTime()
            )
          ) {
            return null;
          }

          return {
            day: parsed.getDate(),
            month: parsed.getMonth() + 1,
            year: parsed.getFullYear(),
          };
        };

      const filteredExpenseRecords =
        requestedMonth || requestedYear
          ? expenseRecords.filter(
              (item) => {
                const parsed =
                  parseExpenseDate(
                    item.date
                  );

                if (!parsed) {
                  return false;
                }

                if (
                  requestedMonth &&
                  parsed.month !==
                    requestedMonth
                ) {
                  return false;
                }

                if (
                  requestedYear &&
                  parsed.year !==
                    requestedYear
                ) {
                  return false;
                }

                return true;
              }
            )
          : expenseRecords;

      const total =
        filteredExpenseRecords.reduce(
          (sum, item) =>
            sum +
            item.amount,
          0
        );

      const filteredSources =
        [
          ...new Set(
            filteredExpenseRecords.map(
              (item) =>
                item.sheetName
            )
          ),
        ];

      if (
        (requestedMonth || requestedYear) &&
        !filteredExpenseRecords.length
      ) {
        return [
          "No matching expense entries were found for the requested period.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const periodLabel =
        requestedMonthEntry || requestedYear
          ? [
              requestedMonthEntry
                ? requestedMonthEntry[0]
                    .charAt(0)
                    .toUpperCase() +
                  requestedMonthEntry[0]
                    .slice(1)
                : "",
              requestedYear || "",
            ]
              .filter(Boolean)
              .join(" ")
          : null;

      return [
        periodLabel
          ? `Recorded expense total for ${periodLabel}: ₹${Number(
              total
            ).toLocaleString(
              "en-IN"
            )}`
          : `Recorded expense total: ₹${Number(
              total
            ).toLocaleString(
              "en-IN"
            )}`,
        "",
        `Expense entries counted: ${filteredExpenseRecords.length}`,
        "Main Sheet summary rows and Furniture/Electronics inventory rows are excluded to avoid double-counting.",
        "",
        `Source: ${
          filteredSources.length
            ? filteredSources.join(", ")
            : expenseSourceNames.join(", ")
        }`,
      ].join("\n");
    }

    const asksHighestExpense =
      !asksHighestExpenseCategory &&
      !asksHighestTravelExpense &&
      (
      normalizedQuestion.includes(
        "highest expense"
      ) ||
      normalizedQuestion.includes(
        "expense is the highest"
      ) ||
      normalizedQuestion.includes(
        "expense was the highest"
      ) ||
      normalizedQuestion.includes(
        "largest expense"
      ) ||
      normalizedQuestion.includes(
        "most expensive expense"
      ) ||
      (
        normalizedQuestion.includes(
          "expense"
        ) &&
        normalizedQuestion.includes(
          "highest"
        )
      )
      );

    if (asksHighestExpense) {
      if (!expenseRecords.length) {
        return [
          "No numeric expense entries were found.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      const highestAmount =
        Math.max(
          ...expenseRecords.map(
            (item) =>
              item.amount
          )
        );

      const highest =
        expenseRecords.filter(
          (item) =>
            item.amount ===
            highestAmount
        );

      return [
        highest.length === 1
          ? "Highest recorded expense:"
          : "Highest recorded expenses:",
        "",
        ...highest.map(
          (item) =>
            `${item.description} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )} — ${item.category}`
        ),
        "",
        `Source: ${[
          ...new Set(
            highest.map(
              (item) =>
                item.sheetName
            )
          ),
        ].join(", ")}`,
      ].join("\n");
    }

    const asksAllExpenses =
      normalizedQuestion.includes(
        "show me all expenses"
      ) ||
      normalizedQuestion.includes(
        "show all expenses"
      ) ||
      normalizedQuestion.includes(
        "list all expenses"
      );

    if (asksAllExpenses) {
      if (!expenseRecords.length) {
        return [
          "No expense entries were found.",
          "",
          "No paid API was used.",
        ].join("\n");
      }

      return [
        `Expense entries: ${expenseRecords.length}`,
        "",
        ...expenseRecords.map(
          (item) =>
            `${item.description} — ₹${Number(
              item.amount
            ).toLocaleString(
              "en-IN"
            )} — ${item.category}`
        ),
        "",
        `Source: ${expenseSourceNames.join(", ")}`,
      ].join("\n");
    }

    const asksGenericPendingPayments =
      normalizedQuestion.includes(
        "pending payment"
      ) ||
      normalizedQuestion.includes(
        "pending payments"
      ) ||
      normalizedQuestion.includes(
        "payments are pending"
      ) ||
      normalizedQuestion.includes(
        "payment pending"
      );

    if (
      asksGenericPendingPayments &&
      !normalizedQuestion.includes(
        "vendor"
      )
    ) {
      return [
        "The current Expense Tracker does not contain a reliable payment-status field, so I cannot determine which payments are pending safely.",
        "",
        "Expense amounts are available, but payment completion/status is not recorded consistently enough for a confirmed pending-payment list.",
        "",
        "No paid API was used.",
        `Source: ${expenseSourceNames.join(", ")}`,
      ].join("\n");
    }

    const asksPendingVendorPayments =
      normalizedQuestion.includes(
        "pending payment"
      ) &&
      normalizedQuestion.includes(
        "vendor"
      );

    if (asksPendingVendorPayments) {
      return [
        "I cannot confirm vendor pending payments from the current Expense Tracker structure.",
        "",
        "A reliable vendor/payment-status field is required before Mr.D should calculate this.",
        "",
        "No paid API was used.",
      ].join("\n");
    }
  }


  /*
   * =========================================================
   * VENDOR AI — LOCAL, $0 API
   * =========================================================
   *
   * Supports the current Vendor workbook structure:
   * - vendor/service name
   * - DB / RB marker
   * - contact details
   *
   * Handles:
   * - How many vendors do we have?
   * - Show me all vendors.
   * - Show me vendor details.
   * - Who is the contact for Six5Six?
   * - What is the contact number for <vendor>?
   * - Which vendors are marked DB / RB?
   *
   * It does NOT infer payment/pending amounts when those
   * columns are absent.
   */
  const vendorQuestion =
    vendorRoutingIntent &&
    workbookType !== "Events";

  if (vendorQuestion) {
    const vendorSheets =
      Object.entries(
        workbookData || {}
      ).filter(
        ([sheetName, rows]) => {
          const name =
            normalizeText(
              sheetName
            );

          if (
            name.includes("vendor") ||
            name.includes("supplier")
          ) {
            return true;
          }

          const sampleRows =
            (rows || []).slice(
              0,
              5
            );

          return sampleRows.some(
            (row) => {
              const rawKeys =
                Object.keys(
                  row || {}
                );

              const keys =
                rawKeys.map(
                  (key) =>
                    normalizeText(
                      key
                    )
                );

              const hasNamedVendorShape =
                keys.some(
                  (key) =>
                    key.includes("vendor") ||
                    key.includes("supplier")
                );

              const hasContactShape =
                keys.some(
                  (key) =>
                    key.includes("contact") ||
                    key.includes("mobile") ||
                    key.includes("phone")
                );

              /*
               * Actual Vendor.xlsx structure:
               * first worksheet row contains only "VENDOR".
               * XLSX therefore creates columns:
               * VENDOR, __EMPTY, __EMPTY_1, __EMPTY_2
               *
               * Detect that shape safely even when the sheet name is "Sheet1".
               */
              const hasSimpleVendorMatrixShape =
                rawKeys.length >= 4 &&
                normalizeText(
                  rawKeys[0]
                ) === "vendor" &&
                rawKeys
                  .slice(1)
                  .some(
                    (key) =>
                      String(key)
                        .toLowerCase()
                        .startsWith(
                          "__empty"
                        )
                  );

              return (
                (
                  hasNamedVendorShape &&
                  hasContactShape
                ) ||
                hasSimpleVendorMatrixShape
              );
            }
          );
        }
      );

    if (!vendorSheets.length) {
      return {
        text:
          "I could not find a vendor sheet in the active workbook. Please load the Vendor workbook first.",

        action:
          "change-workbook",
      };
    }

    const vendorRows = [];

    vendorSheets.forEach(
      ([sheetName, rows]) => {
        (rows || []).forEach(
          (row) => {
            if (
              !row ||
              typeof row !== "object"
            ) {
              return;
            }

            const keys =
              Object.keys(row);

            const normalizedKeys =
              keys.map(
                (key) =>
                  normalizeText(
                    key
                  )
              );

            const isSimpleVendorMatrix =
              keys.length >= 4 &&
              normalizedKeys[0] ===
                "vendor" &&
              keys
                .slice(1)
                .some(
                  (key) =>
                    String(key)
                      .toLowerCase()
                      .startsWith(
                        "__empty"
                      )
                );

            /*
             * Actual Vendor.xlsx:
             * VENDOR      -> serial number
             * __EMPTY     -> vendor/service name
             * __EMPTY_1   -> DB/RB
             * __EMPTY_2   -> contact
             */
            if (isSimpleVendorMatrix) {
              const vendorName =
                String(
                  row[
                    keys[1]
                  ] ?? ""
                ).trim();

              if (!vendorName) {
                return;
              }

              vendorRows.push({
                sheetName,
                vendorName,
                marker:
                  String(
                    row[
                      keys[2]
                    ] ?? ""
                  ).trim(),
                contact:
                  String(
                    row[
                      keys[3]
                    ] ?? ""
                  ).trim(),
              });

              return;
            }

            const vendorColumn =
              keys.find(
                (key) => {
                  const k =
                    normalizeText(
                      key
                    );

                  return (
                    k.includes("vendor") ||
                    k.includes("supplier") ||
                    k === "service" ||
                    k.includes("vendor service")
                  );
                }
              ) ||
              keys.find(
                (key) => {
                  const k =
                    normalizeText(
                      key
                    );

                  return (
                    k === "material" ||
                    k === "name"
                  );
                }
              );

            if (!vendorColumn) {
              return;
            }

            const vendorName =
              String(
                row[
                  vendorColumn
                ] ?? ""
              ).trim();

            if (!vendorName) {
              return;
            }

            const markerColumn =
              keys.find(
                (key) => {
                  const k =
                    normalizeText(
                      key
                    );

                  return (
                    k === "db rb" ||
                    k.includes("db rb") ||
                    k.includes("db/rb") ||
                    k === "type" ||
                    k === "category"
                  );
                }
              );

            const contactColumn =
              keys.find(
                (key) => {
                  const k =
                    normalizeText(
                      key
                    );

                  return (
                    k.includes("contact") ||
                    k.includes("mobile") ||
                    k.includes("phone") ||
                    k.includes("email")
                  );
                }
              );

            vendorRows.push({
              sheetName,
              vendorName,
              marker:
                markerColumn
                  ? String(
                      row[
                        markerColumn
                      ] ?? ""
                    ).trim()
                  : "",
              contact:
                contactColumn
                  ? String(
                      row[
                        contactColumn
                      ] ?? ""
                    ).trim()
                  : "",
            });
          }
        );
      }
    );

    /*
     * Remove duplicate vendor names while preserving
     * first workbook order.
     */
    const uniqueVendorMap =
      new Map();

    vendorRows.forEach(
      (item) => {
        const key =
          normalizeText(
            item.vendorName
          );

        if (
          key &&
          !uniqueVendorMap.has(
            key
          )
        ) {
          uniqueVendorMap.set(
            key,
            item
          );
        }
      }
    );

    const uniqueVendors =
      Array.from(
        uniqueVendorMap.values()
      );

    if (!uniqueVendors.length) {
      return [
        "I found the vendor sheet but could not identify vendor rows.",
        "",
        "No paid API was used.",
      ].join("\n");
    }

    const vendorSource =
      [
        ...new Set(
          uniqueVendors.map(
            (item) =>
              item.sheetName
          )
        ),
      ].join(", ");

    const asksVendorCount =
      (
        normalizedQuestion.includes(
          "how many"
        ) ||
        normalizedQuestion.includes(
          "count"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "vendor"
        ) ||
        normalizedQuestion.includes(
          "supplier"
        )
      );

    if (asksVendorCount) {
      return [
        `Total vendors/services: ${uniqueVendors.length}`,
        "",
        `Source: ${vendorSource}`,
      ].join("\n");
    }

    const asksAllVendors =
      normalizedQuestion.includes(
        "show me all vendors"
      ) ||
      normalizedQuestion.includes(
        "show all vendors"
      ) ||
      normalizedQuestion.includes(
        "list all vendors"
      ) ||
      normalizedQuestion.includes(
        "all vendors"
      );

    if (asksAllVendors) {
      return [
        `Vendors/services: ${uniqueVendors.length}`,
        "",
        ...uniqueVendors.map(
          (item) =>
            item.vendorName
        ),
        "",
        `Source: ${vendorSource}`,
      ].join("\n");
    }

    const asksVendorActiveStatus =
      (
        normalizedQuestion.includes(
          "active vendor"
        ) ||
        normalizedQuestion.includes(
          "active vendors"
        ) ||
        normalizedQuestion.includes(
          "vendors are active"
        ) ||
        normalizedQuestion.includes(
          "vendor is active"
        ) ||
        normalizedQuestion.includes(
          "inactive vendor"
        ) ||
        normalizedQuestion.includes(
          "inactive vendors"
        )
      );

    if (asksVendorActiveStatus) {
      return [
        "The current Vendor workbook does not contain an Active/Inactive status field, so I cannot determine vendor status safely.",
        "",
        "Available vendor data includes vendor/service name, DB/RB marker, and contact details.",
        "",
        "No paid API was used.",
        `Source: ${vendorSource}`,
      ].join("\n");
    }

    const requestedMarker =
      normalizedQuestion.includes(
        "marked db"
      ) ||
      normalizedQuestion.includes(
        "vendors db"
      )
        ? "DB"
        : normalizedQuestion.includes(
            "marked rb"
          ) ||
          normalizedQuestion.includes(
            "vendors rb"
          )
        ? "RB"
        : null;

    if (requestedMarker) {
      const matches =
        uniqueVendors.filter(
          (item) =>
            normalizeText(
              item.marker
            ) ===
            normalizeText(
              requestedMarker
            )
        );

      if (!matches.length) {
        return [
          `No vendors were found with the ${requestedMarker} marker.`,
          "",
          `Source: ${vendorSource}`,
        ].join("\n");
      }

      return [
        `Vendors marked ${requestedMarker}: ${matches.length}`,
        "",
        ...matches.map(
          (item) =>
            item.vendorName
        ),
        "",
        `Source: ${vendorSource}`,
      ].join("\n");
    }

    /*
     * Match a vendor name mentioned anywhere in the question.
     * Longest names first to reduce partial-name collisions.
     */
    const mentionedVendor =
      [...uniqueVendors]
        .sort(
          (a, b) =>
            b.vendorName.length -
            a.vendorName.length
        )
        .find(
          (item) => {
            const fullName =
              normalizeText(
                item.vendorName
              );

            /*
             * Allow a natural shortened lookup when the workbook
             * name contains a descriptive suffix in parentheses.
             *
             * Example:
             * Workbook: "GISB Merchandise (Black Silver)"
             * Question: "Show me details for GISB Merchandise"
             */
            const baseName =
              fullName
                .replace(
                  /\s*\([^)]*\)\s*/g,
                  " "
                )
                .replace(
                  /\s+/g,
                  " "
                )
                .trim();

            return (
              normalizedQuestion.includes(
                fullName
              ) ||
              (
                baseName.length >= 4 &&
                normalizedQuestion.includes(
                  baseName
                )
              )
            );
          }
        );

    const asksContact =
      normalizedQuestion.includes(
        "contact"
      ) ||
      normalizedQuestion.includes(
        "phone"
      ) ||
      normalizedQuestion.includes(
        "mobile"
      );

    const asksMissingContactNumber =
      (
        normalizedQuestion.includes(
          "do not have"
        ) ||
        normalizedQuestion.includes(
          "don't have"
        ) ||
        normalizedQuestion.includes(
          "without"
        ) ||
        normalizedQuestion.includes(
          "missing"
        ) ||
        normalizedQuestion.includes(
          "no contact"
        )
      ) &&
      (
        normalizedQuestion.includes(
          "contact"
        ) ||
        normalizedQuestion.includes(
          "phone"
        ) ||
        normalizedQuestion.includes(
          "mobile"
        ) ||
        normalizedQuestion.includes(
          "number"
        )
      );

    if (asksMissingContactNumber) {
      /*
       * A contact entry counts as having a phone number only when
       * it contains at least 7 digits after punctuation/spaces are removed.
       * This lets text-only entries such as labour descriptions be reported.
       */
      const withoutPhoneNumber =
        uniqueVendors.filter(
          (item) => {
            const digits =
              String(
                item.contact || ""
              ).replace(
                /\D/g,
                ""
              );

            return digits.length < 7;
          }
        );

      if (!withoutPhoneNumber.length) {
        return [
          "All listed vendors/services have a recorded contact number.",
          "",
          `Source: ${vendorSource}`,
        ].join("\n");
      }

      return [
        `Vendors/services without a recorded contact number: ${withoutPhoneNumber.length}`,
        "",
        ...withoutPhoneNumber.map(
          (item) =>
            item.contact
              ? `${item.vendorName} — ${item.contact}`
              : `${item.vendorName} — contact not specified`
        ),
        "",
        `Source: ${vendorSource}`,
      ].join("\n");
    }

    if (
      mentionedVendor &&
      asksContact
    ) {
      return [
        mentionedVendor.contact
          ? `${mentionedVendor.vendorName} — Contact: ${mentionedVendor.contact}`
          : `${mentionedVendor.vendorName} is listed, but no contact detail is recorded.`,
        mentionedVendor.marker
          ? `Marker: ${mentionedVendor.marker}`
          : "",
        "",
        `Source: ${mentionedVendor.sheetName}`,
      ]
        .filter(
          (line) =>
            line !== ""
        )
        .join("\n");
    }

    const asksVendorDetails =
      normalizedQuestion.includes(
        "vendor details"
      ) ||
      normalizedQuestion.includes(
        "vendor detail"
      ) ||
      normalizedQuestion.includes(
        "details of vendor"
      ) ||
      normalizedQuestion.includes(
        "details for"
      ) ||
      normalizedQuestion.includes(
        "details of"
      );

    if (asksVendorDetails) {
      if (mentionedVendor) {
        return [
          `${mentionedVendor.vendorName}`,
          mentionedVendor.marker
            ? `Marker: ${mentionedVendor.marker}`
            : "Marker: not specified",
          mentionedVendor.contact
            ? `Contact: ${mentionedVendor.contact}`
            : "Contact: not specified",
          "",
          `Source: ${mentionedVendor.sheetName}`,
        ].join("\n");
      }

      return [
        `Vendor details: ${uniqueVendors.length}`,
        "",
        ...uniqueVendors.map(
          (item) => {
            const details = [
              item.marker
                ? `Marker: ${item.marker}`
                : "",
              item.contact
                ? `Contact: ${item.contact}`
                : "",
            ]
              .filter(Boolean)
              .join(" | ");

            return details
              ? `${item.vendorName} — ${details}`
              : item.vendorName;
          }
        ),
        "",
        `Source: ${vendorSource}`,
      ].join("\n");
    }

    /*
     * Payment questions are intentionally NOT guessed.
     */
    const asksVendorPayment =
      normalizedQuestion.includes(
        "pending payment"
      ) ||
      normalizedQuestion.includes(
        "payment pending"
      ) ||
      normalizedQuestion.includes(
        "highest payment"
      ) ||
      normalizedQuestion.includes(
        "highest amount"
      ) ||
      normalizedQuestion.includes(
        "paid vendor"
      );

    if (asksVendorPayment) {
      return [
        "The current Vendor workbook does not provide enough payment/amount fields for me to answer this safely.",
        "",
        "Add fields such as Amount, Paid Amount, Pending Amount or Payment Status to enable this locally.",
        "",
        "No paid API was used.",
        "",
        `Source: ${vendorSource}`,
      ].join("\n");
    }
  }


  /*
   * Purchases, summaries, comparisons, conflicts,
   * drafting and unusual questions still go to AI.
   */
  return null;
}

  function analyzeSpreadsheetQuestion(question) {
    if (!sheetNames.length || !Object.keys(workbookData).length) {
      return "Please upload an Excel or CSV file first.";
    }

    const normalizedQuestion = normalizeText(question);
    const allRows = getAllWorkbookRows();
    const keywords = getQuestionKeywords(question);

    const asksTotalStock = (
      normalizedQuestion.includes("total stock") ||
      normalizedQuestion.includes("total quantity") ||
      normalizedQuestion.includes("total qty")
    ) && keywords.length === 0;

    if (asksTotalStock) {
      let total = 0;
      let countedRows = 0;
      allRows.forEach((match) => {
        const quantityColumn = findQuantityColumn(match.row);
        if (!quantityColumn) return;
        const quantity = numberFromValue(match.row[quantityColumn]);
        if (quantity === null) return;
        total += quantity;
        countedRows++;
      });
      if (countedRows > 0) {
        return `Across all ${sheetNames.length} sheets, I found ${countedRows} rows with a usable stock/quantity column.\n\nTotal stock in hand: ${total}`;
      }
    }

    const asksZeroStock = normalizedQuestion.includes("zero stock") || normalizedQuestion.includes("out of stock") || normalizedQuestion.includes("no stock");
    if (asksZeroStock) {
      const zeroRows = allRows.filter((match) => {
        const quantityColumn = findQuantityColumn(match.row);
        if (!quantityColumn) return false;
        return numberFromValue(match.row[quantityColumn]) === 0;
      });
      if (!zeroRows.length) return "I couldn't find any rows with zero stock in the workbook.";
      return [`I found ${zeroRows.length} row${zeroRows.length === 1 ? "" : "s"} with zero stock:`, "", ...zeroRows.slice(0, 20).map(formatMatchLine)].join("\n");
    }

    const matches = allRows.filter((match) => rowMatchesKeywords(match.row, keywords));
    if (!matches.length) {
      const label = keywords.length ? keywords.join(" " ) : question;
      return `I searched all ${sheetNames.length} sheet${sheetNames.length === 1 ? "" : "s"}, but I couldn't find a row matching "${label}".`;
    }

    const asksWho = normalizedQuestion.includes("who") && (normalizedQuestion.includes("using") || normalizedQuestion.includes("used by") || normalizedQuestion.includes("assigned") || normalizedQuestion.includes("issued"));
    if (asksWho) {
      const details = [];
      matches.forEach((match) => {
        const usedByColumn = findUsedByColumn(match.row);
        if (!usedByColumn) return;
        const usedBy = String(match.row[usedByColumn] ?? "").trim();
        if (!usedBy) return;
        details.push(`${getItemName(match.row, keywords.join(" " ))}: ${usedBy} (${match.sheetName})`);
      });
      if (details.length) {
        return [`I found ${details.length} matching assignment${details.length === 1 ? "" : "s"}:`, "", ...details.slice(0, 20)].join("\n");
      }
      return `I found ${matches.length} matching row${matches.length === 1 ? "" : "s"}, but I couldn't find a clear "Used By / Assigned To" value in those rows.`;
    }

    const wantsQuantity = normalizedQuestion.includes("how many") || normalizedQuestion.includes("quantity") || normalizedQuestion.includes("qty") || normalizedQuestion.includes("stock") || normalizedQuestion.includes("available");
    if (wantsQuantity) {
      let total = 0;
      let quantityFound = false;
      const details = [];
      matches.forEach((match) => {
        const quantityColumn = findQuantityColumn(match.row);
        if (!quantityColumn) return;
        const quantity = numberFromValue(match.row[quantityColumn]);
        if (quantity === null) return;
        quantityFound = true;
        total += quantity;
        details.push(`${getItemName(match.row, keywords.join(" " ))}: ${quantity} (${match.sheetName})`);
      });
      if (quantityFound) {
        return [`I found ${matches.length} matching row${matches.length === 1 ? "" : "s"} across the workbook.`, "", `Total available quantity: ${total}`, "", ...details.slice(0, 15)].join("\n");
      }
      return [`I found ${matches.length} matching row${matches.length === 1 ? "" : "s"}, but I couldn't identify a numeric stock/quantity column for those rows.`, "", ...matches.slice(0, 10).map(formatMatchLine)].join("\n");
    }

    return [`I found ${matches.length} matching row${matches.length === 1 ? "" : "s"} across ${sheetNames.length} sheet${sheetNames.length === 1 ? "" : "s"}.`, "", ...matches.slice(0, 15).map(formatMatchLine)].join("\n");
  }

  // ---------------------------------------------------------
  // CHAT
  // ---------------------------------------------------------

  async function handleSubmit(e) {
    e.preventDefault();

    if (isAiLoading) {
      return;
    }

    const cleanMessage =
      message.trim();

    if (!cleanMessage) {
      return;
    }

    const requestedWorkbookType =
      questionWorkbookType(
        cleanMessage
      );

    if (
      fileName &&
      requestedWorkbookType &&
      workbookType !== "Unknown" &&
      requestedWorkbookType !== workbookType
    ) {
      setMessages(
        (current) => [
          ...current,
          {
            role: "user",
            text: cleanMessage,
          },
          {
            role: "assistant",
            source: "local",
            action:
              "change-workbook",

            text:
              `This question looks like ${requestedWorkbookType}, but your active workbook is ${workbookType}: ${displayFileName}. Please switch to the correct workbook before continuing.`,
          },
        ]
      );

      setMessage("");
      return;
    }

    const userMessage = {
      role: "user",
      text: cleanMessage,
    };

    setMessages(
      (current) => [
        ...current,
        userMessage,
      ]
    );

    setMessage("");


    // ---------------------------------------------------------
    // LOCAL-FIRST ANSWER
    // ---------------------------------------------------------

    const localAnswer =
      tryLocalSpreadsheetAnswer(
        cleanMessage
      );

    if (localAnswer) {
      const localText =
        typeof localAnswer ===
        "string"
          ? localAnswer
          : localAnswer.text;

      const localAction =
        typeof localAnswer ===
        "object"
          ? localAnswer.action
          : null;

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            source:
              "local",

            action:
              localAction,

            text:
              localText,
          },
        ]
      );

      return;
    }

    // ---------------------------------------------------------
    // DOCUMENTS SAFETY LOCK
    // ---------------------------------------------------------
    // Documents questions stay local when a Documents workbook is active.
    // Unsupported wording must not consume paid API.
    // ---------------------------------------------------------

    const documentQuestion =
      questionWorkbookType(cleanMessage) === "Documents" ||
      [
        "document",
        "documents",
        "passport",
        "passports",
        "expired",
        "expiry",
        "expiring soon",
        "renewal required",
        "confidential",
        "no expiry",
        "vendor document",
        "owned by",
        "expires first",
        "next expiry",
        "reviewed recently",
        "compliance document",
        "doc-",
      ].some((word) =>
        normalizeText(cleanMessage).includes(word)
      );

    if (
      workbookType === "Documents" &&
      documentQuestion
    ) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          source: "local",
          text:
            "I recognized this as a Documents question, but I do not yet have a safe local rule for this exact request. No paid API was used.",
        },
      ]);

      return;
    }


    // ---------------------------------------------------------
    // VISITORS SAFETY LOCK
    // ---------------------------------------------------------
    // Visitor questions stay local when a Visitors workbook is active.
    // Unsupported wording must not consume paid API.
    // ---------------------------------------------------------

    const visitorQuestion =
      questionWorkbookType(
        cleanMessage
      ) === "Visitors" ||
      [
        "visitor",
        "visitors",
        "visited",
        "visit",
        "checked in",
        "visitor pass",
        "expected visitor",
        "approval status",
        "pending approval",
        "longest stay",
        "stayed the longest",
        "checked in late",
        "late check in",
        "vendor visitor",
      ].some(
        (word) =>
          normalizeText(
            cleanMessage
          ).includes(
            word
          )
      );

    if (
      workbookType ===
        "Visitors" &&
      visitorQuestion
    ) {
      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            source:
              "local",
            text:
              "I recognized this as a Visitors question, but I do not yet have a safe local rule for this exact request. No paid API was used.",
          },
        ]
      );

      return;
    }


    // ---------------------------------------------------------
    // EVENTS SAFETY LOCK
    // ---------------------------------------------------------
    // Event questions stay local when an Events workbook is active.
    // Unsupported wording must not consume paid API.
    // ---------------------------------------------------------

    const eventQuestion =
      questionWorkbookType(cleanMessage) === "Events" ||
      [
        "event",
        "events",
        "upcoming",
        "completed",
        "cancelled",
        "canceled",
        "attendees",
        "setup deadline",
      ].some((word) =>
        normalizeText(cleanMessage).includes(word)
      );

    if (
      workbookType === "Events" &&
      eventQuestion
    ) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          source: "local",
          text:
            "I recognized this as an Events question, but I do not yet have a safe local rule for this exact request. No paid API was used.",
        },
      ]);

      return;
    }


    // ---------------------------------------------------------
    // RENEWAL / AMC SAFETY LOCK
    // ---------------------------------------------------------
    // Renewal questions should remain local when a Renewal workbook
    // is active. Unsupported wording must not consume paid API.
    // ---------------------------------------------------------

    const renewalQuestion =
      questionWorkbookType(
        cleanMessage
      ) === "Renewals" ||
      [
        "renewal",
        "renewals",
        "renew",
        "amc",
        "subscription",
        "due soon",
        "overdue",
        "auto renew",
        "days to due",
      ].some(
        (word) =>
          normalizeText(
            cleanMessage
          ).includes(
            word
          )
      );

    if (
      workbookType ===
        "Renewals" &&
      renewalQuestion
    ) {
      setMessages(
        (current) => [
          ...current,
          {
            role: "assistant",
            source: "local",
            text:
              "I recognized this as a Renewal / AMC question, but I do not yet have a safe local rule for this exact request. No paid API was used.",
          },
        ]
      );

      return;
    }


    // ---------------------------------------------------------
    // ATTENDANCE SAFETY LOCK
    // ---------------------------------------------------------
    // If an Attendance workbook is active, attendance-related
    // questions must NEVER automatically fall through to paid AI.
    // Unsupported attendance questions stay local at $0.
    // ---------------------------------------------------------

    const attendanceQuestion =
      questionWorkbookType(cleanMessage) === "Attendance" ||
      [
        "attendance",
        "absent",
        "absence",
        "present",
        "leave",
        "week off",
        "weekoff",
        "w/off",
        "w off",
        "late",
        "check in",
        "check out",
        "working hours",
        "work hours",
        "hours worked",
        "worked",
        "most hours",
        "work time",
        "employee code",
        "employee id",
        "leave balance",
        "leaves available",
        "half day",
        "half days",
        "wfh",
        "work from home",
        "travelling days",
        "traveling days",
        "lop",
      ].some((word) =>
        normalizeText(cleanMessage).includes(word)
      );

    if (
      workbookType === "Attendance" &&
      attendanceQuestion
    ) {
      setMessages(
        (current) => [
          ...current,
          {
            role: "assistant",
            source: "local",
            text:
              "I recognized this as an Attendance question, but I do not yet have a safe local rule for this exact request. No paid API was used.",
          },
        ]
      );

      return;
    }

    // ---------------------------------------------------------
    // GENERAL UTILITIES — LOCAL / NON-AI
    // ---------------------------------------------------------
    // Time/date stay fully local at $0.
    // Weather is intercepted here so it does not consume
    // OpenAI credit. Live weather service integration comes next.
    // ---------------------------------------------------------

    const normalizedUtilityQuestion =
      normalizeText(
        cleanMessage
      );

    const asksCurrentTime =
      normalizedUtilityQuestion.includes(
        "what time"
      ) ||
      normalizedUtilityQuestion.includes(
        "current time"
      ) ||
      normalizedUtilityQuestion.includes(
        "time now"
      );

    if (asksCurrentTime) {
      const now =
        new Date();

      const formattedTime =
        now.toLocaleTimeString(
          "en-IN",
          {
            hour:
              "2-digit",
            minute:
              "2-digit",
            second:
              "2-digit",
          }
        );

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            source:
              "local",

            text:
              `Current time: ${formattedTime}\n\nSource: Device clock`,
          },
        ]
      );

      return;
    }

    const asksCurrentDate =
      normalizedUtilityQuestion.includes(
        "what date"
      ) ||
      normalizedUtilityQuestion.includes(
        "today's date"
      ) ||
      normalizedUtilityQuestion.includes(
        "todays date"
      ) ||
      normalizedUtilityQuestion.includes(
        "current date"
      );

    if (asksCurrentDate) {
      const now =
        new Date();

      const formattedDate =
        now.toLocaleDateString(
          "en-IN",
          {
            weekday:
              "long",
            day:
              "2-digit",
            month:
              "long",
            year:
              "numeric",
          }
        );

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            source:
              "local",

            text:
              `Today is ${formattedDate}.\n\nSource: Device clock`,
          },
        ]
      );

      return;
    }

    const asksWeather =
      normalizedUtilityQuestion.includes(
        "weather"
      ) ||
      normalizedUtilityQuestion.includes(
        "temperature"
      ) ||
      normalizedUtilityQuestion.includes(
        "forecast"
      );

    if (asksWeather) {
      setIsAiLoading(true);

      try {
        /*
         * Mumbai default weather.
         * Open-Meteo does not use OpenAI credit.
         */
        const weatherResponse =
          await fetch(
            "https://api.open-meteo.com/v1/forecast?latitude=19.0760&longitude=72.8777&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=1"
          );

        if (!weatherResponse.ok) {
          throw new Error(
            "Weather service request failed."
          );
        }

        const weatherData =
          await weatherResponse.json();

        const current =
          weatherData.current || {};

        const daily =
          weatherData.daily || {};

        const weatherCode =
          Number(
            current.weather_code
          );

        const weatherDescription =
          (() => {
            if (weatherCode === 0) {
              return "Clear sky";
            }

            if (weatherCode === 1) {
              return "Mostly clear";
            }

            if (weatherCode === 2) {
              return "Partly cloudy";
            }

            if (weatherCode === 3) {
              return "Overcast";
            }

            if (
              weatherCode === 45 ||
              weatherCode === 48
            ) {
              return "Fog";
            }

            if (
              [51, 53, 55].includes(
                weatherCode
              )
            ) {
              return "Drizzle";
            }

            if (
              [56, 57].includes(
                weatherCode
              )
            ) {
              return "Freezing drizzle";
            }

            if (
              [61, 63, 65].includes(
                weatherCode
              )
            ) {
              return "Rain";
            }

            if (
              [66, 67].includes(
                weatherCode
              )
            ) {
              return "Freezing rain";
            }

            if (
              [71, 73, 75, 77].includes(
                weatherCode
              )
            ) {
              return "Snow";
            }

            if (
              [80, 81, 82].includes(
                weatherCode
              )
            ) {
              return "Rain showers";
            }

            if (
              [85, 86].includes(
                weatherCode
              )
            ) {
              return "Snow showers";
            }

            if (
              [95, 96, 99].includes(
                weatherCode
              )
            ) {
              return "Thunderstorm";
            }

            return "Weather condition unavailable";
          })();

        const temperature =
          current.temperature_2m;

        const feelsLike =
          current.apparent_temperature;

        const humidity =
          current.relative_humidity_2m;

        const windSpeed =
          current.wind_speed_10m;

        const precipitation =
          current.precipitation;

        const high =
          daily.temperature_2m_max?.[0];

        const low =
          daily.temperature_2m_min?.[0];

        const rainChance =
          daily.precipitation_probability_max?.[0];

        const lines = [
          "Mumbai — Live Weather",
          "",
          `${weatherDescription}${temperature !== undefined ? ` — ${temperature}°C` : ""}`,
          feelsLike !== undefined
            ? `Feels like: ${feelsLike}°C`
            : "",
          humidity !== undefined
            ? `Humidity: ${humidity}%`
            : "",
          windSpeed !== undefined
            ? `Wind: ${windSpeed} km/h`
            : "",
          precipitation !== undefined
            ? `Current precipitation: ${precipitation} mm`
            : "",
          high !== undefined &&
          low !== undefined
            ? `Today: ${low}°C – ${high}°C`
            : "",
          rainChance !== undefined
            ? `Rain chance today: ${rainChance}%`
            : "",
          "",
          "Source: Open-Meteo",
          "No OpenAI credit was used.",
        ].filter(
          (line) =>
            line !== ""
        );

        setMessages(
          (currentMessages) => [
            ...currentMessages,
            {
              role:
                "assistant",
              source:
                "local",
              text:
                lines.join("\n"),
            },
          ]
        );
      } catch (error) {
        console.error(
          "Mr.D weather error:",
          error
        );

        setMessages(
          (currentMessages) => [
            ...currentMessages,
            {
              role:
                "assistant",
              source:
                "local",
              text:
                "I could not load live weather right now. No OpenAI credit was used.",
            },
          ]
        );
      } finally {
        setIsAiLoading(false);
      }

      return;
    }

    // ---------------------------------------------------------
    // PREPARE SMALL AI PAYLOAD
    // ---------------------------------------------------------

    const spreadsheetDataForAI =
      looksLikeSpreadsheetQuestion(
        cleanMessage
      )
        ? getRelevantSpreadsheetData(
            cleanMessage
          )
        : {};

    const spreadsheetJson =
      JSON.stringify(
        spreadsheetDataForAI
      );

    const sheetsSent =
      Object.keys(
        spreadsheetDataForAI
      );

    const rowsSent =
      Object.values(
        spreadsheetDataForAI
      ).reduce(
        (total, sheetRows) =>
          total +
          (
            Array.isArray(
              sheetRows
            )
              ? sheetRows.length
              : 0
          ),
        0
      );

    const charactersSent =
      spreadsheetJson.length;

    const approxTokens =
      Math.ceil(
        charactersSent / 4
      );

    console.log(
      "Mr.D API payload:",
      {
        sheets:
          sheetsSent,

        sheetCount:
          sheetsSent.length,

        rows:
          rowsSent,

        characters:
          charactersSent,

        approxSpreadsheetTokens:
          approxTokens,
      }
    );


    // ---------------------------------------------------------
    // PAID AI FALLBACK
    // ---------------------------------------------------------

    setIsAiLoading(true);

    try {
      const response =
        await fetch(
          "http://localhost:3001/api/ai",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                message:
                  cleanMessage,

                spreadsheetData:
                  spreadsheetDataForAI,

                /*
                 * Keep only recent chat context
                 * to control token usage.
                 */
                conversation:
                  messages.slice(-6),
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Mr.D AI request failed."
        );
      }

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            source:
              "ai",

            text:
              data.answer ||
              "I couldn't generate an answer.",
          },
        ]
      );
    } catch (error) {
      console.error(
        "Mr.D AI client error:",
        error
      );

      setMessages(
        (current) => [
          ...current,
          {
            role:
              "assistant",
            source:
              "system",

            text:
              `❌ ${
                error?.message ||
                "Unable to connect to Mr.D AI."
              }`,
          },
        ]
      );
    } finally {
      setIsAiLoading(false);
    }
  }


  // ---------------------------------------------------------
  // REMOVE FILE
  // ---------------------------------------------------------

  async function clearFile() {
    setFileName("");

    setWorkbookData({});

    setSheetNames([]);

    setSelectedSheet("");

    setColumns([]);

    setRows([]);

    setFileError("");


    try {
      await clearWorkbookCache();
    } catch (error) {
      console.error(
        "Unable to clear saved workbook:",
        error
      );
    }


    setMessages(
      (current) => [
        ...current,

        {
          role:
            "assistant",
          source:
            "system",

          text:
            "The spreadsheet has been cleared.",
        },
      ]
    );
  }


  // ---------------------------------------------------------
  // UI
  // ---------------------------------------------------------

  return (
    <div className="inventory-page">

      <h1 className="page-title">
        🤖 Mr.D AI Assistant
      </h1>


      <p className="page-subtitle">
        Work with operations data,
        Excel files, attendance,
        leave, expenses and more.
      </p>


      <input
        ref={
          fileInputRef
        }

        type="file"

        accept=".xlsx,.xls,.csv"

        onChange={
          handleFileChange
        }

        style={{
          display:
            "none",
        }}
      />


      {fileName && (
        <div
          style={{
            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            gap:
              "14px",

            flexWrap:
              "wrap",

            marginBottom:
              "18px",

            padding:
              "14px 16px",

            background:
              "#ecfdf5",

            border:
              "1px solid #a7f3d0",

            borderRadius:
              "14px",
          }}
        >
          <div>
            <div
              style={{
                fontSize:
                  "12px",

                fontWeight:
                  "800",

                color:
                  "#047857",

                textTransform:
                  "uppercase",

                letterSpacing:
                  ".03em",
              }}
            >
              📊 Active Workbook
            </div>

            <div
              style={{
                marginTop:
                  "4px",

                fontWeight:
                  "800",

                color:
                  "#064e3b",
              }}
            >
              {displayFileName}
            </div>

            <div
              style={{
                marginTop:
                  "3px",

                fontSize:
                  "12px",

                color:
                  "#047857",
              }}
            >
              {sheetNames.length} sheet
              {sheetNames.length === 1
                ? ""
                : "s"}
              {selectedSheet
                ? ` · Current: ${selectedSheet}`
                : ""}
            </div>

            <div
              style={{
                marginTop: "5px",
                fontSize: "12px",
                fontWeight: "800",
                color:
                  workbookType === "Unknown"
                    ? "#92400e"
                    : "#047857",
              }}
            >
              Workbook Type: {workbookType}
            </div>
          </div>

          <button
            type="button"

            onClick={
              changeWorkbook
            }

            disabled={
              fileLoading ||
              workbookRestoring ||
              isAiLoading
            }

            style={{
              border:
                "1px solid #059669",

              background:
                "#ffffff",

              color:
                "#047857",

              padding:
                "9px 12px",

              borderRadius:
                "10px",

              cursor:
                fileLoading ||
                workbookRestoring ||
                isAiLoading
                  ? "not-allowed"
                  : "pointer",

              opacity:
                fileLoading ||
                workbookRestoring ||
                isAiLoading
                  ? 0.5
                  : 1,

              fontWeight:
                "800",

              fontSize:
                "13px",
            }}
          >
            Change Workbook
          </button>
        </div>
      )}


      <div
        style={{
          display:
            "grid",

          gridTemplateColumns:
            "minmax(0,1fr) 300px",

          gap:
            "24px",

          alignItems:
            "start",
        }}
      >

        {/* ============================================= */}
        {/* LEFT SIDE */}
        {/* ============================================= */}

        <div>

          {/* CHAT */}

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "18px",

              boxShadow:
                "0 8px 25px rgba(0,0,0,.08)",

              minHeight:
                "480px",

              display:
                "flex",

              flexDirection:
                "column",

              overflow:
                "hidden",

              marginBottom:
                "24px",
            }}
          >

            <div
              style={{
                padding:
                  "18px 22px",

                borderBottom:
                  "1px solid #e2e8f0",

                background:
                  "#f8fafc",
              }}
            >

              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "space-between",

                  gap:
                    "12px",
                }}
              >
                <div>
                  <strong>
                    Mr.D Assistant
                  </strong>

                  <div
                    style={{
                      fontSize:
                        "13px",

                      color:
                        "#64748b",

                      marginTop:
                        "4px",
                    }}
                  >
                    Operations Intelligence
                  </div>
                </div>

                <button
                  type="button"
                  onClick={
                    clearChatHistory
                  }
                  disabled={
                    isAiLoading
                  }
                  style={{
                    border:
                      "1px solid #cbd5e1",

                    background:
                      "#ffffff",

                    color:
                      "#475569",

                    padding:
                      "7px 10px",

                    borderRadius:
                      "9px",

                    cursor:
                      isAiLoading
                        ? "not-allowed"
                        : "pointer",

                    opacity:
                      isAiLoading
                        ? 0.5
                        : 1,

                    fontSize:
                      "12px",

                    fontWeight:
                      "700",
                  }}
                >
                  Clear Chat
                </button>
              </div>

            </div>


            <div
              style={{
                flex:
                  1,

                padding:
                  "22px",

                overflowY:
                  "auto",

                maxHeight:
                  "380px",
              }}
            >

              {messages.map(
                (
                  item,
                  index
                ) => (

                  <div
                    key={
                      index
                    }

                    style={{
                      display:
                        "flex",

                      justifyContent:
                        item.role ===
                        "user"
                          ? "flex-end"
                          : "flex-start",

                      marginBottom:
                        "16px",
                    }}
                  >

                    <div
                      style={{
                        maxWidth:
                          "80%",

                        padding:
                          "12px 15px",

                        borderRadius:
                          "14px",

                        lineHeight:
                          1.5,

                        background:
                          item.role ===
                          "user"
                            ? "#2563eb"
                            : "#f1f5f9",

                        color:
                          item.role ===
                          "user"
                            ? "#ffffff"
                            : "#0f172a",
                      }}
                    >
                      {item.role === "assistant" &&
                        item.source &&
                        item.source !== "system" && (
                          <div
                            style={{
                              display:
                                "inline-flex",

                              alignItems:
                                "center",

                              gap:
                                "6px",

                              marginBottom:
                                "8px",

                              padding:
                                "3px 8px",

                              borderRadius:
                                "999px",

                              fontSize:
                                "11px",

                              fontWeight:
                                "800",

                              background:
                                item.source ===
                                "local"
                                  ? "#dcfce7"
                                  : "#ede9fe",

                              color:
                                item.source ===
                                "local"
                                  ? "#166534"
                                  : "#6d28d9",
                            }}
                          >
                            {item.source ===
                            "local"
                              ? "⚡ Local · $0 API"
                              : "🤖 AI · API used"}
                          </div>
                        )}

                      <div
                        style={{
                          whiteSpace:
                            "pre-wrap",
                        }}
                      >
                        {
                          item.text
                        }
                      </div>

                      {item.role ===
                        "assistant" &&
                        item.action ===
                          "change-workbook" && (
                          <button
                            type="button"

                            onClick={
                              changeWorkbook
                            }

                            disabled={
                              fileLoading ||
                              workbookRestoring ||
                              isAiLoading
                            }

                            style={{
                              marginTop:
                                "10px",

                              border:
                                "1px solid #059669",

                              background:
                                "#ffffff",

                              color:
                                "#047857",

                              padding:
                                "8px 11px",

                              borderRadius:
                                "9px",

                              cursor:
                                fileLoading ||
                                workbookRestoring ||
                                isAiLoading
                                  ? "not-allowed"
                                  : "pointer",

                              opacity:
                                fileLoading ||
                                workbookRestoring ||
                                isAiLoading
                                  ? 0.5
                                  : 1,

                              fontWeight:
                                "800",

                              fontSize:
                                "12px",
                            }}
                          >
                            Change Workbook
                          </button>
                        )}
                    </div>

                  </div>

                )
              )}

              {isAiLoading && (
                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "flex-start",

                    marginBottom:
                      "16px",
                  }}
                >
                  <div
                    style={{
                      padding:
                        "10px 14px",

                      borderRadius:
                        "14px",

                      background:
                        "#f1f5f9",

                      color:
                        "#475569",

                      fontSize:
                        "13px",

                      fontWeight:
                        "700",
                    }}
                  >
                    🤖 Mr.D is thinking...
                  </div>
                </div>
              )}

            </div>


            <div
              style={{
                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "space-between",

                gap:
                  "10px",

                flexWrap:
                  "wrap",

                padding:
                  "10px 18px",

                borderTop:
                  "1px solid #e2e8f0",

                background:
                  "#f8fafc",
              }}
            >
              <div
                style={{
                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    "8px",

                  flexWrap:
                    "wrap",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "12px",

                    color:
                      "#64748b",

                    fontWeight:
                      "700",
                  }}
                >
                  Active context:
                </span>

                <span
                  style={{
                    padding:
                      "4px 8px",

                    borderRadius:
                      "999px",

                    fontSize:
                      "11px",

                    fontWeight:
                      "800",

                    background:
                      workbookType === "Inventory"
                        ? "#dcfce7"
                        : workbookType === "Attendance"
                        ? "#dbeafe"
                        : workbookType === "Expenses"
                        ? "#fef3c7"
                        : "#f1f5f9",

                    color:
                      workbookType === "Inventory"
                        ? "#166534"
                        : workbookType === "Attendance"
                        ? "#1d4ed8"
                        : workbookType === "Expenses"
                        ? "#92400e"
                        : "#64748b",
                  }}
                >
                  {fileName
                    ? `📘 ${workbookType}`
                    : "No workbook"}
                </span>

                {fileName && (
                  <span
                    style={{
                      fontSize:
                        "11px",

                      color:
                        "#64748b",

                      maxWidth:
                        "260px",

                      overflow:
                        "hidden",

                      textOverflow:
                        "ellipsis",

                      whiteSpace:
                        "nowrap",
                    }}
                    title={
                      displayFileName
                    }
                  >
                    {displayFileName}
                  </span>
                )}
              </div>

              {fileName && (
                <button
                  type="button"

                  onClick={
                    changeWorkbook
                  }

                  disabled={
                    fileLoading ||
                    workbookRestoring ||
                    isAiLoading
                  }

                  style={{
                    border:
                      "none",

                    background:
                      "transparent",

                    color:
                      "#2563eb",

                    padding:
                      "4px 0",

                    cursor:
                      fileLoading ||
                      workbookRestoring ||
                      isAiLoading
                        ? "not-allowed"
                        : "pointer",

                    opacity:
                      fileLoading ||
                      workbookRestoring ||
                      isAiLoading
                        ? 0.5
                        : 1,

                    fontSize:
                      "12px",

                    fontWeight:
                      "800",
                  }}
                >
                  Change
                </button>
              )}
            </div>


            <form
              onSubmit={
                handleSubmit
              }

              style={{
                padding:
                  "18px",

                borderTop:
                  "1px solid #e2e8f0",

                display:
                  "flex",

                gap:
                  "10px",

                background:
                  "#ffffff",
              }}
            >

              <input
                type="text"

                value={
                  message
                }

                onChange={(e) =>
                  setMessage(
                    e.target.value
                  )
                }

                disabled={
                  isAiLoading
                }

                placeholder={
                  isAiLoading
                    ? "Mr.D is thinking..."
                    : rows.length
                    ? "Ask about this spreadsheet..."
                    : "Ask Mr.D anything..."
                }

                style={{
                  flex:
                    1,

                  padding:
                    "13px 15px",

                  border:
                    "1px solid #cbd5e1",

                  borderRadius:
                    "12px",

                  fontSize:
                    "15px",
                }}
              />


              <button
                type="submit"

                disabled={
                  isAiLoading ||
                  !message.trim()
                }

                style={{
                  border:
                    "none",

                  background:
                    "#2563eb",

                  color:
                    "#ffffff",

                  padding:
                    "12px 20px",

                  borderRadius:
                    "12px",

                  fontWeight:
                    "700",

                  cursor:
                    isAiLoading ||
                    !message.trim()
                      ? "not-allowed"
                      : "pointer",

                  opacity:
                    isAiLoading ||
                    !message.trim()
                      ? 0.6
                      : 1,
                }}
              >
                {isAiLoading
                  ? "Thinking..."
                  : "Send"}
              </button>

            </form>

          </div>


          {/* ============================================= */}
          {/* FILE DETAILS */}
          {/* ============================================= */}

          {fileName && (

            <div
              style={{
                background:
                  "#ffffff",

                borderRadius:
                  "18px",

                padding:
                  "22px",

                boxShadow:
                  "0 8px 25px rgba(0,0,0,.08)",
              }}
            >

              <div
                style={{
                  display:
                    "flex",

                  justifyContent:
                    "space-between",

                  alignItems:
                    "center",

                  gap:
                    "15px",

                  flexWrap:
                    "wrap",

                  marginBottom:
                    "18px",
                }}
              >

                <div>
                  <h2
                    style={{
                      margin:
                        0,
                    }}
                  >
                    📊 Spreadsheet
                  </h2>


                  <div
                    style={{
                      marginTop:
                        "5px",

                      color:
                        "#64748b",
                    }}
                  >
                    {
                      fileName
                    }
                  </div>
                </div>


                <button
                  type="button"

                  onClick={
                    clearFile
                  }

                  style={{
                    border:
                      "1px solid #fecaca",

                    background:
                      "#fff",

                    color:
                      "#dc2626",

                    padding:
                      "8px 12px",

                    borderRadius:
                      "9px",

                    cursor:
                      "pointer",

                    fontWeight:
                      "700",
                  }}
                >
                  Remove File
                </button>

              </div>


              {/* SUMMARY */}

              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit,minmax(150px,1fr))",

                  gap:
                    "14px",

                  marginBottom:
                    "20px",
                }}
              >

                <div style={statCard}>
                  <div style={statLabel}>
                    Sheets
                  </div>

                  <div style={statValue}>
                    {
                      sheetNames.length
                    }
                  </div>
                </div>


                <div style={statCard}>
                  <div style={statLabel}>
                    Rows
                  </div>

                  <div style={statValue}>
                    {
                      rows.length
                    }
                  </div>
                </div>


                <div style={statCard}>
                  <div style={statLabel}>
                    Columns
                  </div>

                  <div style={statValue}>
                    {
                      columns.length
                    }
                  </div>
                </div>

              </div>


              {/* SHEET */}

              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >

                <label
                  style={{
                    display:
                      "block",

                    fontWeight:
                      "700",

                    marginBottom:
                      "7px",
                  }}
                >
                  Sheet
                </label>


                <select
                  value={
                    selectedSheet
                  }

                  onChange={
                    handleSheetChange
                  }

                  style={{
                    width:
                      "100%",

                    maxWidth:
                      "350px",

                    padding:
                      "10px 12px",

                    border:
                      "1px solid #cbd5e1",

                    borderRadius:
                      "9px",

                    background:
                      "#fff",
                  }}
                >

                  {sheetNames.map(
                    (
                      sheet
                    ) => (

                      <option
                        key={
                          sheet
                        }

                        value={
                          sheet
                        }
                      >
                        {
                          sheet
                        }
                      </option>

                    )
                  )}

                </select>

              </div>


              {/* COLUMN NAMES */}

              <div
                style={{
                  marginBottom:
                    "18px",
                }}
              >

                <strong>
                  Detected Columns
                </strong>


                <div
                  style={{
                    display:
                      "flex",

                    flexWrap:
                      "wrap",

                    gap:
                      "8px",

                    marginTop:
                      "10px",
                  }}
                >

                  {columns.length ===
                  0 ? (

                    <span
                      style={{
                        color:
                          "#64748b",
                      }}
                    >
                      No column headers detected.
                    </span>

                  ) : (

                    columns.map(
                      (
                        column
                      ) => (

                        <span
                          key={
                            column
                          }

                          style={{
                            background:
                              "#eff6ff",

                            color:
                              "#1d4ed8",

                            padding:
                              "5px 9px",

                            borderRadius:
                              "999px",

                            fontSize:
                              "12px",

                            fontWeight:
                              "700",
                          }}
                        >
                          {
                            column
                          }
                        </span>

                      )
                    )

                  )}

                </div>

              </div>


              {/* PREVIEW */}

              <h3>
                Data Preview
              </h3>


              <p
                style={{
                  color:
                    "#64748b",

                  fontSize:
                    "13px",
                }}
              >
                Showing the first 20 rows.
              </p>


              <div
                style={{
                  width:
                    "100%",

                  overflowX:
                    "auto",

                  marginTop:
                    "12px",
                }}
              >

                {columns.length >
                  0 ? (

                  <table
                    className=
                      "inventory-table"

                    style={{
                      minWidth:
                        "900px",
                    }}
                  >

                    <thead>
                      <tr>

                        {columns.map(
                          (
                            column
                          ) => (

                            <th
                              key={
                                column
                              }
                            >
                              {
                                column
                              }
                            </th>

                          )
                        )}

                      </tr>
                    </thead>


                    <tbody>

                      {rows
                        .slice(
                          0,
                          20
                        )
                        .map(
                          (
                            row,
                            rowIndex
                          ) => (

                            <tr
                              key={
                                rowIndex
                              }
                            >

                              {columns.map(
                                (
                                  column
                                ) => (

                                  <td
                                    key={
                                      column
                                    }
                                  >
                                    {String(
                                      row[
                                        column
                                      ] ??
                                        ""
                                    )}
                                  </td>

                                )
                              )}

                            </tr>

                          )
                        )}

                    </tbody>

                  </table>

                ) : (

                  <div
                    style={{
                      padding:
                        "20px",

                      background:
                        "#f8fafc",

                      borderRadius:
                        "10px",

                      color:
                        "#64748b",
                    }}
                  >
                    This sheet contains no tabular data.
                  </div>

                )}

              </div>

            </div>

          )}

        </div>


        {/* ============================================= */}
        {/* RIGHT PANEL */}
        {/* ============================================= */}

        <div>

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "18px",

              padding:
                "20px",

              boxShadow:
                "0 8px 25px rgba(0,0,0,.08)",

              marginBottom:
                "20px",
            }}
          >

            <h3
              style={{
                marginBottom:
                  "15px",
              }}
            >
              📂 Work with Files
            </h3>


            <button
              type="button"

              onClick={
                openExcelPicker
              }

              disabled={
                fileLoading ||
                workbookRestoring
              }

              style={{
                ...toolButton,

                opacity:
                  fileLoading
                    ? 0.6
                    : 1,
              }}
            >
              {workbookRestoring
                ? "⏳ Restoring Workbook..."
                : fileLoading
                ? "⏳ Reading File..."
                : fileName
                ? "📊 Change Excel / CSV"
                : "📊 Excel / CSV"}
            </button>


            <button
              type="button"

              style={
                disabledToolButton
              }

              disabled
            >
              📄 Documents
            </button>


            <button
              type="button"

              style={
                disabledToolButton
              }

              disabled
            >
              📑 PDF Reports
            </button>


            {fileError && (

              <div
                style={{
                  marginTop:
                    "10px",

                  background:
                    "#fee2e2",

                  color:
                    "#991b1b",

                  borderRadius:
                    "9px",

                  padding:
                    "10px",

                  fontSize:
                    "13px",
                }}
              >
                {
                  fileError
                }
              </div>

            )}

          </div>


          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "18px",

              padding:
                "20px",

              boxShadow:
                "0 8px 25px rgba(0,0,0,.08)",
            }}
          >

            <h3
              style={{
                marginBottom:
                  "15px",
              }}
            >
              🔌 Integrations
            </h3>


            <div style={integrationRow}>
              Google Sheets

              <span style={nextBadge}>
                Next
              </span>
            </div>


            <div style={integrationRow}>
              Google Drive

              <span style={nextBadge}>
                Next
              </span>
            </div>


            <div style={integrationRow}>
              Gmail

              <span style={laterBadge}>
                Later
              </span>
            </div>


            <div style={integrationRow}>
              Mac Files

              <span style={laterBadge}>
                Later
              </span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}


// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------

const toolButton = {
  width:
    "100%",

  padding:
    "11px 12px",

  marginBottom:
    "10px",

  border:
    "1px solid #cbd5e1",

  borderRadius:
    "10px",

  background:
    "#ffffff",

  textAlign:
    "left",

  cursor:
    "pointer",

  fontWeight:
    "600",
};


const disabledToolButton = {
  ...toolButton,

  cursor:
    "not-allowed",

  opacity:
    0.5,
};


const integrationRow = {
  display:
    "flex",

  alignItems:
    "center",

  justifyContent:
    "space-between",

  padding:
    "10px 0",

  borderBottom:
    "1px solid #e2e8f0",
};


const nextBadge = {
  fontSize:
    "12px",

  background:
    "#dcfce7",

  color:
    "#166534",

  padding:
    "4px 8px",

  borderRadius:
    "999px",

  fontWeight:
    "700",
};


const laterBadge = {
  fontSize:
    "12px",

  background:
    "#f1f5f9",

  color:
    "#64748b",

  padding:
    "4px 8px",

  borderRadius:
    "999px",

  fontWeight:
    "700",
};


const statCard = {
  background:
    "#f8fafc",

  padding:
    "14px",

  borderRadius:
    "12px",

  border:
    "1px solid #e2e8f0",
};


const statLabel = {
  color:
    "#64748b",

  fontSize:
    "12px",

  fontWeight:
    "700",

  textTransform:
    "uppercase",
};


const statValue = {
  marginTop:
    "5px",

  fontSize:
    "24px",

  fontWeight:
    "800",

  color:
    "#0f172a",
};


export default AI;