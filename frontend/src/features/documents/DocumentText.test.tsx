import { act, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { documentTextApi } from "../../api/documentText";
import { ApiError } from "../../api/client";
import type {
  DocumentProcessing,
  DocumentPageText,
} from "../../types/documentText";
import DocumentTextSection from "./DocumentTextSection";
const notPrepared: DocumentProcessing = {
  document_id: "d1",
  state: "NOT_PROCESSED",
  total_pages: 0,
  pages_processed: 0,
  native_text_pages: 0,
  ocr_pages: 0,
  plain_text_pages: 0,
  pages_with_no_usable_text: 0,
  message: "",
  started_at: null,
  processed_at: null,
};
const ready: DocumentProcessing = {
  ...notPrepared,
  state: "READY",
  total_pages: 2,
  pages_processed: 2,
  native_text_pages: 1,
  ocr_pages: 1,
  message: "Document text is ready for future search.",
  started_at: "2026-10-06T12:00:00Z",
  processed_at: "2026-10-06T12:01:00Z",
};
const first: DocumentPageText = {
  id: "p1",
  document_id: "d1",
  page_number: 1,
  processing_method: "NATIVE_TEXT",
  character_count: 30,
  error_message: null,
  created_at: ready.processed_at!,
  updated_at: ready.processed_at!,
  text: "Reference page 1: G17 12.500 mm",
};
const second: DocumentPageText = {
  ...first,
  id: "p2",
  page_number: 2,
  processing_method: "OCR",
  text: "Reference page 2: local OCR fixture",
};
function open(fileType: "PDF" | "TXT" | "MD" = "PDF") {
  return render(<DocumentTextSection id="d1" fileType={fileType} />);
}
beforeEach(() => {
  vi.spyOn(documentTextApi, "status").mockResolvedValue({ ...notPrepared });
  vi.spyOn(documentTextApi, "process").mockResolvedValue({ ...ready });
  vi.spyOn(documentTextApi, "pages").mockResolvedValue([first, second]);
  vi.spyOn(documentTextApi, "page").mockImplementation(async (_id, n) =>
    n === 1 ? first : second,
  );
});
describe("Document Text preparation", () => {
  it("shows Not Prepared without processing automatically", async () => {
    open();
    await screen.findByText("Not Prepared");
    expect(
      screen.getByRole("heading", { name: "Document Text" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Prepare for Search" }),
    ).toBeEnabled();
    expect(documentTextApi.process).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "View Prepared Text" }),
    ).not.toBeInTheDocument();
  });
  it("prepares text and shows Ready with native/OCR page counts", async () => {
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "Prepare for Search" }),
    );
    await screen.findByText("Ready");
    expect(documentTextApi.process).toHaveBeenCalledWith("d1");
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    for (const label of ["Native text pages", "OCR pages", "Processed"])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reprocess" })).toBeEnabled();
  });
  it("disables duplicate preparation while the request is running", async () => {
    let resolve!: (value: DocumentProcessing) => void;
    vi.mocked(documentTextApi.process).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "Prepare for Search" }),
    );
    expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();
    await act(async () => resolve(ready));
    await screen.findByText("Ready");
    expect(documentTextApi.process).toHaveBeenCalledTimes(1);
  });
  it("loads persisted results on remount and supports Reprocess", async () => {
    vi.mocked(documentTextApi.status).mockResolvedValue(ready);
    const user = userEvent.setup();
    const view = open();
    await screen.findByText("Ready");
    view.unmount();
    open();
    await screen.findByText("Ready");
    await user.click(screen.getByRole("button", { name: "Reprocess" }));
    await waitFor(() =>
      expect(documentTextApi.process).toHaveBeenCalledWith("d1"),
    );
  });
  it("shows Partial and explains pages requiring unavailable OCR", async () => {
    vi.mocked(documentTextApi.status).mockResolvedValue({
      ...ready,
      state: "PARTIAL",
      pages_processed: 1,
      ocr_pages: 0,
      pages_with_no_usable_text: 1,
      message:
        "OCR is required for one or more pages but is not available in this development environment.",
    });
    open();
    await screen.findByText("Partial");
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getByText(/OCR is required/)).toBeInTheDocument();
    expect(screen.getByText("Pages with no usable text")).toBeInTheDocument();
  });
  it("shows Failed with a useful message and allows reprocessing", async () => {
    vi.mocked(documentTextApi.status).mockResolvedValue({
      ...notPrepared,
      state: "FAILED",
      message: "This PDF is damaged or unreadable.",
    });
    const user = userEvent.setup();
    open();
    await screen.findByText("Failed");
    expect(
      screen.getByText("This PDF is damaged or unreadable."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reprocess" }));
    await screen.findByText("Ready");
  });
  it("retries processing status failures", async () => {
    vi.mocked(documentTextApi.status).mockRejectedValueOnce(
      new ApiError("Document data unavailable", 503),
    );
    const user = userEvent.setup();
    open();
    await screen.findByText("Document data unavailable");
    await user.click(
      screen.getByRole("button", { name: "Retry document text status" }),
    );
    await screen.findByText("Not Prepared");
  });
  it("handles request failure and re-reads durable processing state", async () => {
    vi.mocked(documentTextApi.process).mockRejectedValue(
      new ApiError("Request could not be completed", 503),
    );
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "Prepare for Search" }),
    );
    await screen.findByText("Request could not be completed");
    expect(documentTextApi.status).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "Prepare for Search" }),
    ).toBeEnabled();
  });
  it("provides read-only page inspection with one-based PDF provenance", async () => {
    vi.mocked(documentTextApi.status).mockResolvedValue(ready);
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "View Prepared Text" }),
    );
    await screen.findByText(first.text);
    expect(screen.getByLabelText("PDF page")).toHaveValue("1");
    await user.selectOptions(screen.getByLabelText("PDF page"), "2");
    await screen.findByText(second.text);
    expect(documentTextApi.page).toHaveBeenCalledWith(
      "d1",
      2,
      expect.any(AbortSignal),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Hide Prepared Text" }),
    );
    expect(screen.queryByText(second.text)).not.toBeInTheDocument();
  });
  it("shows a page failure explicitly instead of empty successful text", async () => {
    const failed = {
      ...second,
      text: "",
      character_count: 0,
      error_message: "OCR could not read this page.",
    };
    vi.mocked(documentTextApi.status).mockResolvedValue({
      ...ready,
      state: "PARTIAL",
    });
    vi.mocked(documentTextApi.page).mockResolvedValue(failed);
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "View Prepared Text" }),
    );
    await screen.findByText("OCR could not read this page.");
    expect(document.querySelector("pre")).toBeNull();
  });
  it("retries page inspection errors", async () => {
    vi.mocked(documentTextApi.status).mockResolvedValue(ready);
    vi.mocked(documentTextApi.pages).mockRejectedValueOnce(
      new ApiError("Prepared text unavailable", 503),
    );
    const user = userEvent.setup();
    open();
    await user.click(
      await screen.findByRole("button", { name: "View Prepared Text" }),
    );
    await screen.findByText("Prepared text unavailable");
    await user.click(
      screen.getByRole("button", { name: "Retry prepared text" }),
    );
    await screen.findByText(first.text);
  });
  it("presents TXT/MD as a single section without rendering Markdown or HTML", async () => {
    vi.mocked(documentTextApi.status).mockResolvedValue({
      ...ready,
      total_pages: 1,
      pages_processed: 1,
      native_text_pages: 0,
      ocr_pages: 0,
      plain_text_pages: 1,
    });
    vi.mocked(documentTextApi.pages).mockResolvedValue([
      { ...first, processing_method: "PLAIN_TEXT" },
    ]);
    vi.mocked(documentTextApi.page).mockResolvedValue({
      ...first,
      processing_method: "PLAIN_TEXT",
      text: "# Manual reference\n<h1>literal text</h1>",
    });
    const user = userEvent.setup();
    open("MD");
    await user.click(
      await screen.findByRole("button", { name: "View Prepared Text" }),
    );
    await screen.findByText(/literal text/);
    expect(screen.getByLabelText("Text section")).toHaveValue("1");
    expect(
      screen.queryByRole("heading", { name: "literal text" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("OCR pages")).not.toBeInTheDocument();
  });
  it("polls an in-progress preparation after a browser reload", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(documentTextApi.status)
        .mockResolvedValueOnce({ ...notPrepared, state: "PROCESSING" })
        .mockResolvedValue(ready);
      open();
      await act(async () => {
        await Promise.resolve();
      });
      expect(screen.getByRole("button", { name: "Preparing…" })).toBeDisabled();
      await act(async () => vi.advanceTimersByTimeAsync(2000));
      expect(
        within(screen.getByRole("region", { name: "Document Text" })).getByText(
          "Ready",
        ),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
