"""Redis protocol emulator for isolated browser tests, not production Redis."""
from fakeredis import TcpFakeServer

if __name__ == "__main__":
    with TcpFakeServer(("127.0.0.1", 6389), server_type="redis") as server:
        print("Quiz Redis test fixture ready on 127.0.0.1:6389", flush=True)
        server.serve_forever()
