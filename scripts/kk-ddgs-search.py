#!/usr/bin/env python3
import argparse
import json
import sys
from urllib.parse import urlparse

from ddgs import DDGS


def https_only(value):
    try:
        value = str(value or "").strip()
        parsed = urlparse(value)
        return value if parsed.scheme == "https" and parsed.netloc else ""
    except Exception:
        return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--max-results", type=int, default=10)
    parser.add_argument("--region", default="th-th")
    parser.add_argument("--backend", default="auto")
    parser.add_argument("--timeout", type=int, default=8)
    args = parser.parse_args()

    limit = max(1, min(int(args.max_results), 25))
    try:
        rows = DDGS(timeout=max(2, min(int(args.timeout), 15))).text(
            args.query,
            region=args.region,
            safesearch="moderate",
            max_results=limit,
            backend=args.backend,
        )
        out = []
        seen = set()
        for row in rows or []:
            url = https_only(row.get("href") or row.get("url"))
            if not url or url in seen:
                continue
            seen.add(url)
            out.append(
                {
                    "title": str(row.get("title") or args.query).strip(),
                    "source_url": url,
                    "body": str(row.get("body") or "")[:1000],
                }
            )
            if len(out) >= limit:
                break
        json.dump(out, sys.stdout, ensure_ascii=False)
    except Exception as exc:
        sys.stderr.write(
            json.dumps(
                {
                    "error_class": exc.__class__.__name__,
                    "message": str(exc)[:300],
                },
                ensure_ascii=False,
            )
            + "\n"
        )
        raise SystemExit(2)


if __name__ == "__main__":
    main()
