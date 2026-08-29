"""
Local Microservices Process Supervisor for HistoFacts.
Launches all 6 microservice processes + API Gateway concurrently in development.
"""

import sys
import os
import subprocess
import time
import signal
import threading

# Ensure safe UTF-8 output across Windows cp1252 / PowerShell / Command Prompt
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

SERVICES = [
    ("Auth Service (:8001)", "app.auth.main:app", 8001),
    ("History Service (:8002)", "app.history.main:app", 8002),
    ("Social Service (:8003)", "app.social.main:app", 8003),
    ("Groups Service (:8004)", "app.groups.main:app", 8004),
    ("AI Notes Service (:8005)", "app.ai_notes.main:app", 8005),
    ("Quiz Service (:8006)", "app.quiz.main:app", 8006),
    ("Notification Service (:8007)", "app.notification.main:app", 8007),
    ("API Gateway (:8000)", "app.gateway.main:app", 8000),
]

processes = []
running = True


def stream_logs(name: str, proc: subprocess.Popen):
    """Stream stdout from a service process with formatted prefix."""
    for line in iter(proc.stdout.readline, b""):
        if not running:
            break
        text = line.decode("utf-8", errors="replace").rstrip()
        if text:
            try:
                print(f"[{name}] {text}")
            except Exception:
                pass


def shutdown(signum=None, frame=None):
    global running
    if not running:
        return
    running = False
    print("\n[!] Stopping all HistoFacts microservices...")
    for name, proc in processes:
        try:
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    print("[+] All microservices stopped successfully.")
    sys.exit(0)


def main():
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    python_exe = sys.executable
    print("=" * 70)
    print(">> Starting HistoFacts Microservices Architecture (8 Processes)")
    print("=" * 70)

    for name, app_module, port in SERVICES:
        cmd = [
            python_exe,
            "-m",
            "uvicorn",
            app_module,
            "--host",
            "0.0.0.0",
            "--port",
            str(port),
            "--log-level",
            "info",
        ]

        print(f"  [+] Launching {name} -> http://localhost:{port}")
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            cwd=os.path.dirname(os.path.abspath(__file__)),
        )
        processes.append((name, proc))

        # Start log reader thread
        t = threading.Thread(target=stream_logs, args=(name, proc), daemon=True)
        t.start()
        time.sleep(0.3)

    print("-" * 70)
    print("[*] All 7 microservices & API Gateway are running!")
    print("    Unified Gateway URL: http://localhost:8000")
    print("    Gateway Health:     http://localhost:8000/health")
    print("    Press Ctrl+C to stop all services.")
    print("=" * 70)

    try:
        while running:
            for name, proc in processes:
                ret = proc.poll()
                if ret is not None and running:
                    print(f"[*] Service '{name}' exited with code {ret}")
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown()


if __name__ == "__main__":
    main()
