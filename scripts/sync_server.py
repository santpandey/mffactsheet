"""
Simple HTTP server to handle sync requests from the UI
Runs sync_all_funds.py when requested
"""

import sys
import subprocess
import json
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.parse

class SyncHandler(SimpleHTTPRequestHandler):
    """Custom handler for sync requests"""
    
    def do_POST(self):
        """Handle POST requests for sync"""
        if self.path == '/api/sync':
            self.handle_sync()
        else:
            self.send_error(404, "Not Found")
    
    def handle_sync(self):
        """Execute sync_all_funds.py script"""
        try:
            # Get the project root directory
            project_root = Path(__file__).parent.parent
            sync_script = project_root / "scripts" / "sync_all_funds.py"
            
            # Run the sync script
            result = subprocess.run(
                [sys.executable, str(sync_script)],
                cwd=str(project_root),
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            # Prepare response
            response = {
                "success": result.returncode == 0,
                "message": "Sync completed successfully" if result.returncode == 0 else "Sync completed with warnings",
                "stdout": result.stdout[-1000:] if result.stdout else "",  # Last 1000 chars
                "stderr": result.stderr[-500:] if result.stderr else ""
            }
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
            
        except subprocess.TimeoutExpired:
            self.send_error(504, "Sync timeout - operation took too long")
        except Exception as e:
            self.send_error(500, f"Sync failed: {str(e)}")
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        """Custom logging"""
        if self.path.startswith('/api/'):
            print(f"[API] {format % args}")
        # Suppress other logs for cleaner output


def run_server(port=8001):
    """Run the sync server"""
    server_address = ('', port)
    httpd = HTTPServer(server_address, SyncHandler)
    print(f"Sync API server running on http://localhost:{port}")
    print(f"POST to http://localhost:{port}/api/sync to trigger sync")
    print("Press Ctrl+C to stop")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down sync server...")
        httpd.shutdown()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Run sync API server')
    parser.add_argument('--port', type=int, default=8001, help='Port to run on (default: 8001)')
    args = parser.parse_args()
    
    run_server(args.port)
