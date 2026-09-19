import asyncio
import hashlib
import json
import sys
import time
from datetime import datetime, timezone

from crawl4ai import AsyncWebCrawler, BrowserConfig, CacheMode, CrawlerRunConfig

URLS = [
    {
        "id": "impact-lingorm",
        "url": "https://www.impact.co.th/en/visitors/event-calendar/concert/lingorm-the-world-between-us-concert",
        "must_contain": ["LINGORM", "17-18 October 2026", "IMPACT Arena"],
    },
    {
        "id": "onebangkok-gongyoo",
        "url": "https://www.onebangkok.com/en/whats-happening/goong-yoo-fanmeeting-tour-2026/",
        "must_contain": ["GONG YOO", "10 October 2026", "One Bangkok Forum"],
    },
    {
        "id": "uoblive-tiffany",
        "url": "https://uoblive.asia/th/event/tiffany-young-edge-of-calm-tour-in-bangkok",
        "must_contain": ["Tiffany Young", "25 October 2026", "UOB LIVE"],
    },
]

def text_markdown(result):
    markdown = getattr(result, "markdown", "")
    if hasattr(markdown, "raw_markdown"):
        markdown = markdown.raw_markdown
    return str(markdown or "")

async def crawl_one(crawler, item):
    started = time.perf_counter()
    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        page_timeout=60000,
        word_count_threshold=1,
    )
    result = await crawler.arun(url=item["url"], config=config)
    elapsed_ms = round((time.perf_counter() - started) * 1000)
    markdown = text_markdown(result)
    digest = hashlib.sha256(markdown.encode("utf-8")).hexdigest() if markdown else None
    must = {needle: (needle.lower() in markdown.lower()) for needle in item["must_contain"]}
    return {
        "id": item["id"],
        "url": item["url"],
        "success": bool(getattr(result, "success", False)),
        "status_code": getattr(result, "status_code", None),
        "markdown_chars": len(markdown),
        "content_sha256": digest,
        "required_markers": must,
        "all_required_markers_found": all(must.values()),
        "elapsed_ms": elapsed_ms,
        "error_class": (
            None
            if bool(getattr(result, "success", False))
            else type(getattr(result, "error_message", None)).__name__
        ),
    }

async def main():
    browser = BrowserConfig(
        headless=True,
        java_script_enabled=True,
        verbose=False,
    )
    report = {
        "schema": "DISCOVERY_CRAWL4AI_ZERO_WRITE_UAT_V1",
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "provider": "CRAWL4AI",
        "mode": "FIXED_URL_ZERO_WRITE",
        "urls_planned": len(URLS),
        "production_writes": 0,
        "final_truth_mutation": False,
        "notification_sends": 0,
        "authoritative": False,
        "verifier_required": True,
        "results": [],
    }

    async with AsyncWebCrawler(config=browser) as crawler:
        for item in URLS:
            try:
                report["results"].append(await crawl_one(crawler, item))
            except Exception as exc:
                report["results"].append(
                    {
                        "id": item["id"],
                        "url": item["url"],
                        "success": False,
                        "status_code": None,
                        "markdown_chars": 0,
                        "content_sha256": None,
                        "required_markers": {},
                        "all_required_markers_found": False,
                        "elapsed_ms": None,
                        "error_class": type(exc).__name__,
                    }
                )

    successes = [r for r in report["results"] if r["success"]]
    complete = [r for r in successes if r["all_required_markers_found"]]
    report["urls_successful"] = len(successes)
    report["marker_complete"] = len(complete)
    report["quality_gate"] = (
        "PASS"
        if len(successes) == len(URLS)
        and len(complete) == len(URLS)
        and report["production_writes"] == 0
        and report["notification_sends"] == 0
        and report["authoritative"] is False
        and report["verifier_required"] is True
        else "FAIL"
    )

    with open("crawl4ai-uat-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["quality_gate"] == "PASS" else 1

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
