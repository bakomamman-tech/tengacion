const {
  ACCOUNT_DATA_EXPORT_RECORD_LIMIT,
  buildBoundedSection,
} = require("../services/accountDataExportService");

describe("accountDataExportService limits", () => {
  test("marks a section complete when it is within the on-demand limit", () => {
    const records = Array.from(
      { length: ACCOUNT_DATA_EXPORT_RECORD_LIMIT },
      (_, index) => ({ index })
    );

    expect(buildBoundedSection(records)).toMatchObject({
      exportedCount: ACCOUNT_DATA_EXPORT_RECORD_LIMIT,
      recordLimit: ACCOUNT_DATA_EXPORT_RECORD_LIMIT,
      complete: true,
    });
  });

  test("caps oversized sections and marks the manifest incomplete", () => {
    const records = Array.from(
      { length: ACCOUNT_DATA_EXPORT_RECORD_LIMIT + 1 },
      (_, index) => ({ index })
    );
    const section = buildBoundedSection(records);

    expect(section).toMatchObject({
      exportedCount: ACCOUNT_DATA_EXPORT_RECORD_LIMIT,
      recordLimit: ACCOUNT_DATA_EXPORT_RECORD_LIMIT,
      complete: false,
    });
    expect(section.records).toHaveLength(ACCOUNT_DATA_EXPORT_RECORD_LIMIT);
    expect(section.records.at(-1)).toEqual({
      index: ACCOUNT_DATA_EXPORT_RECORD_LIMIT - 1,
    });
  });
});
