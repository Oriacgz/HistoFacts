"""Isolated, bounded text-PDF extraction. No rendering, OCR or external tools."""
import io
import json
import sys


def main():
    import pypdf
    if not hasattr(pypdf, "overwrite_configuration"):
        raise ValueError("PDF extraction requires pypdf with resource-limit configuration")
    pypdf.overwrite_configuration(
        maximum_declared_stream_length=2_000_000, stream_decoding_work_maximum_length=4_000_000,
        zlib_maximum_output_length=2_000_000, lzw_maximum_output_length=2_000_000,
        run_length_maximum_output_length=2_000_000, image_maximum_buffer_size=2_000_000,
        page_tree_maximum_entries=100, stream_parsing_work_maximum_count=100_000,
        jbig2dec_binary=None, disable_legacy_handling=True)
    body = sys.stdin.buffer.read(1_000_001)
    if len(body) > 1_000_000:
        raise ValueError("PDF too large")
    reader = pypdf.PdfReader(io.BytesIO(body), strict=True)
    if reader.is_encrypted or len(reader.pages) > 20:
        raise ValueError("Encrypted or long PDF unsupported")
    text = "\n".join((page.extract_text() or "")[:8000] for page in reader.pages)[:60_000]
    if len(text.strip()) < 60:
        raise ValueError("Scanned or empty PDF: OCR unsupported")
    print(json.dumps({"text":text,"title":str((reader.metadata or {}).get('/Title',''))[:300],
                      "author":str((reader.metadata or {}).get('/Author',''))[:300]}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print('{"error":"PDF is scanned, encrypted, malformed, too long or exceeds extraction limits."}')
        sys.exit(1)
