"""The application system's HTTP API and its jobs board page. Python standard library only."""

import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from worlds import store

PAGE_STYLE = """
body{margin:0;background:#FAFAFA;color:#151515;font:15px/1.45 system-ui,sans-serif}
header{background:#1F1F1C;color:#FAFAFA;padding:14px 24px}
header h1{margin:0;font-size:19px} header p{margin:2px 0 0;color:#FAFAFA;opacity:.85;font-size:13px}
main{padding:16px 24px;display:grid;grid-template-columns:2fr 1fr;gap:20px}
section{background:#FFFFFF;border:1px solid #DFDFDF;border-radius:6px;padding:12px 16px}
h2{font-size:15px;margin:0 0 8px} table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #DFDFDF} th{color:#606060;font-weight:600}
.over{color:#BF000F;font-weight:600} .ok{color:#008138} .wait{color:#B75000}
.empty{color:#606060}
"""


def board_page(split: str) -> str:
    jobs = store.rows(
        """select jobs.job_id, jobs.email_id, growers.name as grower, fields.name as field, fields.crop,
                  products.name as product, jobs.rate_l_per_ha, products.max_rate_l_per_ha, products.crops
           from jobs join growers using (grower_id) join fields using (field_id) join products using (product_code)
           order by jobs.job_id"""
    )
    reviews = store.rows("select * from review_queue order by review_id")
    job_rows = []
    for job in jobs:
        within_label = job["rate_l_per_ha"] <= job["max_rate_l_per_ha"] and job["crop"] in job[
            "crops"
        ].split(",")
        label_cell = (
            '<td class="ok">within label</td>'
            if within_label
            else '<td class="over">OFF LABEL</td>'
        )
        job_rows.append(
            "<tr>"
            + "".join(
                f"<td>{html.escape(str(job[key]))}</td>"
                for key in ("job_id", "email_id", "grower", "field", "crop", "product")
            )
            + f"<td>{job['rate_l_per_ha']:.2f}</td>{label_cell}</tr>"
        )
    review_rows = [
        f'<tr><td>{html.escape(item["email_id"] or "")}</td><td class="wait">{html.escape(item["reason"] or "")}</td></tr>'
        for item in reviews
    ]
    jobs_table = (
        "<table><tr><th>Job</th><th>Email</th><th>Grower</th><th>Field</th><th>Crop</th><th>Product</th>"
        "<th>L/ha</th><th>Label</th></tr>" + "".join(job_rows) + "</table>"
        if job_rows
        else '<p class="empty">No jobs booked yet.</p>'
    )
    review_table = (
        "<table><tr><th>Email</th><th>Why a person</th></tr>" + "".join(review_rows) + "</table>"
        if review_rows
        else '<p class="empty">Nothing waiting for a person.</p>'
    )
    return (
        f"<!doctype html><html><head><meta charset='utf-8'><title>Spray desk</title><style>{PAGE_STYLE}</style></head>"
        f"<body><header><h1>Tallgrass Bend Growers Co-op: spray desk</h1>"
        f"<p>Application system. Inbox split: {html.escape(split)}. {len(jobs)} jobs booked, {len(reviews)} waiting for a person.</p></header>"
        f"<main><section><h2>Booked jobs</h2>{jobs_table}</section>"
        f"<section><h2>Review queue</h2>{review_table}</section></main></body></html>"
    )


def make_handler(split: str):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            return

        def send(self, status: int, body, content_type: str = "application/json") -> None:
            data = body.encode() if isinstance(body, str) else json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            routes = {
                "/api/health": lambda: {"ok": True, "split": split},
                "/api/inbox": lambda: store.inbox(split),
                "/api/growers": lambda: store.rows("select * from growers order by grower_id"),
                "/api/fields": lambda: store.rows("select * from fields order by field_id"),
                "/api/products": store.products,
                "/api/jobs": lambda: store.rows("select * from jobs order by job_id"),
                "/api/review": lambda: store.rows("select * from review_queue order by review_id"),
            }
            if self.path == "/":
                return self.send(200, board_page(split), "text/html; charset=utf-8")
            if self.path in routes:
                return self.send(200, routes[self.path]())
            self.send(
                404,
                {"error": f"No route {self.path}. Try /api/inbox, /api/fields or /api/products."},
            )

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                return self.send(400, {"error": "The body is not JSON."})
            try:
                if self.path == "/api/jobs":
                    return self.send(201, {"job_id": store.book_job(payload)})
                if self.path == "/api/review":
                    return self.send(201, {"review_id": store.send_to_review(payload)})
            except (KeyError, ValueError) as error:
                return self.send(400, {"error": f"Not booked: {error}."})
            self.send(404, {"error": f"No route {self.path}. Post to /api/jobs or /api/review."})

    return Handler


def serve(port: int, split: str) -> ThreadingHTTPServer:
    return ThreadingHTTPServer(("127.0.0.1", port), make_handler(split))
