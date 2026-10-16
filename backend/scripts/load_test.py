"""Concurrent GET load test for the API (standard library only).

Measures latency percentiles and throughput for a mix of read endpoints at several
concurrency levels, so server changes (worker counts, query fixes) can be compared
before and after. GET requests only.

Usage (token: an access JWT for a user who can see the campaign):

    MORDHEIM_TOKEN=... python scripts/load_test.py --base http://localhost:8000 \\
        --campaign 1 --warband 2 --clients 1,5,20 --seconds 15

Only point this at production deliberately: it generates real load on a small instance.
"""

import argparse
import os
import statistics
import threading
import time
import urllib.error
import urllib.request

PATHS = [
    "/api/campaigns/{campaign}/",
    "/api/campaigns/{campaign}/players/",
    "/api/campaigns/{campaign}/battles/?open=1",
    "/api/warbands/{warband}/summary/",
    "/api/warbands/{warband}/heroes/detail/",
    "/api/items/?campaign_id={campaign}",
]


def run_level(base: str, paths: list[str], token: str, clients: int, seconds: float) -> dict[str, float]:
    latencies: list[float] = []
    errors = 0
    lock = threading.Lock()
    deadline = time.monotonic() + seconds

    def worker(offset: int) -> None:
        nonlocal errors
        index = offset
        while time.monotonic() < deadline:
            request = urllib.request.Request(base + paths[index % len(paths)])
            request.add_header("Authorization", f"Bearer {token}")
            started = time.perf_counter()
            try:
                with urllib.request.urlopen(request, timeout=30) as response:
                    response.read()
                ok = True
            except (urllib.error.URLError, TimeoutError):
                ok = False
            elapsed_ms = (time.perf_counter() - started) * 1000
            with lock:
                if ok:
                    latencies.append(elapsed_ms)
                else:
                    errors += 1
            index += 1

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(clients)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    latencies.sort()
    count = len(latencies)
    return {
        "requests": count,
        "errors": errors,
        "rps": count / seconds,
        "p50": statistics.median(latencies) if latencies else 0.0,
        "p95": latencies[int(count * 0.95) - 1] if count else 0.0,
        "max": latencies[-1] if latencies else 0.0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base", default="http://localhost:8000")
    parser.add_argument("--campaign", type=int, required=True)
    parser.add_argument("--warband", type=int, required=True)
    parser.add_argument("--clients", default="1,5,20", help="comma-separated concurrency levels")
    parser.add_argument("--seconds", type=float, default=15.0)
    args = parser.parse_args()

    token = os.environ.get("MORDHEIM_TOKEN")
    if not token:
        parser.error("set MORDHEIM_TOKEN to an access token")

    paths = [path.format(campaign=args.campaign, warband=args.warband) for path in PATHS]
    print(f"{'clients':>7} {'req':>6} {'err':>4} {'req/s':>7} {'p50 ms':>8} {'p95 ms':>8} {'max ms':>8}")
    for clients in (int(level) for level in args.clients.split(",")):
        result = run_level(args.base.rstrip("/"), paths, token, clients, args.seconds)
        print(
            f"{clients:>7} {result['requests']:>6.0f} {result['errors']:>4.0f} {result['rps']:>7.1f} "
            f"{result['p50']:>8.0f} {result['p95']:>8.0f} {result['max']:>8.0f}"
        )


if __name__ == "__main__":
    main()
