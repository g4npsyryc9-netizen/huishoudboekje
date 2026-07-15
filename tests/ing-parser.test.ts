import { describe, it, expect } from "vitest";
import { parseIngCsv } from "@/lib/csv/ing-parser";

const sampleCsv =
  '"Datum","Naam / Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag (EUR)","Mutatiesoort","Mededelingen"\n' +
  '"20260115","ALBERT HEIJN 1234","NL01INGB0001234567","NL02ABNA0009876543","BA","Af","25,50","Betaalautomaat","Pasvolgnr: 001"\n' +
  '"20260201","WERKGEVER BV","NL01INGB0001234567","NL03RABO0001112223","OV","Bij","2500,00","Overschrijving","Salaris januari"\n';

const sampleCsvWithInvalidRow =
  '"Datum","Naam / Omschrijving","Rekening","Tegenrekening","Code","Af Bij","Bedrag (EUR)","Mutatiesoort","Mededelingen"\n' +
  '"20260115","ALBERT HEIJN 1234","NL01INGB0001234567","NL02ABNA0009876543","BA","Af","25,50","Betaalautomaat","Pasvolgnr: 001"\n' +
  '"20260116","KAPOTTE RIJ","NL01INGB0001234567","NL02ABNA0009876543","BA","Af","","Betaalautomaat","geen bedrag"\n';

describe("parseIngCsv", () => {
  it("parses ING rows into structured transactions", () => {
    const rows = parseIngCsv(sampleCsv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      date: new Date(2026, 0, 15),
      description: "ALBERT HEIJN 1234",
      amount: 25.5,
      direction: "AF",
      valid: true,
    });
    expect(rows[1]).toEqual({
      date: new Date(2026, 1, 1),
      description: "WERKGEVER BV",
      amount: 2500,
      direction: "IN",
      valid: true,
    });
  });

  it("throws a clear error for an unrecognized format", () => {
    expect(() => parseIngCsv("kolom1,kolom2\nwaarde1,waarde2\n")).toThrow(
      /ING/,
    );
  });

  it("marks a row with an unparseable amount as invalid instead of crashing", () => {
    const rows = parseIngCsv(sampleCsvWithInvalidRow);
    expect(rows).toHaveLength(2);
    expect(rows[0].valid).toBe(true);
    expect(rows[1].valid).toBe(false);
    expect(rows[1].description).toBe("KAPOTTE RIJ");
  });
});
