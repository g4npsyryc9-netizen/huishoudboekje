import Papa from "papaparse";

export interface ParsedRow {
  date: Date;
  description: string;
  amount: number;
  direction: "IN" | "AF";
  /** false if the amount or date on this row could not be parsed */
  valid: boolean;
}

const REQUIRED_COLUMNS = [
  "Datum",
  "Naam / Omschrijving",
  "Af Bij",
  "Bedrag (EUR)",
];

export function parseIngCsv(fileContent: string): ParsedRow[] {
  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
  });

  const columns = result.meta.fields ?? [];
  const missing = REQUIRED_COLUMNS.filter((c) => !columns.includes(c));
  if (missing.length > 0) {
    throw new Error(
      `Onherkend CSV-formaat: dit lijkt geen ING-export te zijn (ontbrekende kolommen: ${missing.join(", ")}).`,
    );
  }

  return result.data.map((row) => {
    const dateStr = row["Datum"] ?? ""; // YYYYMMDD
    const year = Number(dateStr.slice(0, 4));
    const month = Number(dateStr.slice(4, 6)) - 1;
    const day = Number(dateStr.slice(6, 8));
    const date = new Date(year, month, day);

    const amountStr = (row["Bedrag (EUR)"] ?? "").replace(",", ".");
    const amount = Number(amountStr);
    const direction = row["Af Bij"] === "Bij" ? "IN" : "AF";

    const valid =
      /^\d{8}$/.test(dateStr) &&
      amountStr !== "" &&
      !Number.isNaN(amount) &&
      !Number.isNaN(date.getTime());

    return {
      date,
      description: row["Naam / Omschrijving"] ?? "",
      amount,
      direction,
      valid,
    };
  });
}
