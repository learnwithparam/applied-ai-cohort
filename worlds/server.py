"""The application system's HTTP API and its jobs board page. Python standard library only."""

import html
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from worlds import store

PAGE_STYLE = """
body{margin:0;background:#FAFAFA;color:#151515;font:15px/1.45 system-ui,sans-serif}
header{background:#1F1F1C;color:#FAFAFA;padding:14px 24px}
header h1{margin:0;font-size:19px}
header p{margin:2px 0 0;color:#FAFAFA;opacity:.85;font-size:13px}
main{padding:16px 24px;display:grid;grid-template-columns:2fr 1fr;gap:20px}
section{min-width:0;overflow-x:auto;background:#FFFFFF;border:1px solid #DFDFDF;
  border-radius:6px;padding:12px 16px}
h2{font-size:15px;margin:0 0 8px} table{border-collapse:collapse;width:100%;font-size:13px}
th,td{text-align:left;padding:5px 6px;border-bottom:1px solid #DFDFDF}
th{color:#606060;font-weight:600}
.over{color:#BF000F;font-weight:600} .ok{color:#008138} .wait{color:#B75000}
.empty{color:#606060}
@media(max-width:700px){main{grid-template-columns:1fr}}
"""


# Every booked job with the names a person reads: grower, field, crop, product and label.
BOOKED_JOBS = """
    select jobs.job_id, jobs.email_id, growers.name as grower, fields.name as field,
           fields.crop, products.name as product, jobs.rate_l_per_ha,
           products.max_rate_l_per_ha, products.crops
    from jobs
    join growers using (grower_id)
    join fields using (field_id)
    join products using (product_code)
    order by jobs.job_id
"""

JOB_COLUMNS = ("job_id", "email_id", "grower", "field", "crop", "product")
JOB_HEADINGS = (
    *("Job", "Email", "Grower", "Field", "Crop", "Product"),
    *("Rate (litres a hectare)", "Product label"),
)


def cell(value, css_class: str = "") -> str:
    class_attribute = f' class="{css_class}"' if css_class else ""
    return f"<td{class_attribute}>{html.escape(str(value))}</td>"


def heading_row(headings) -> str:
    return "<tr>" + "".join(f"<th>{heading}</th>" for heading in headings) + "</tr>"


def job_row(job: dict) -> str:
    """One booked job, marked as breaking the label when the rate or the crop is off the label."""
    rate_ok = job["rate_l_per_ha"] <= job["max_rate_l_per_ha"]
    crop_ok = job["crop"] in job["crops"].split(",")
    within_label = rate_ok and crop_ok
    label_cell = cell("Within the label", "ok")
    if not within_label:
        label_cell = cell("Breaks the label", "over")
    named_cells = "".join(cell(job[key]) for key in JOB_COLUMNS)
    return f"<tr>{named_cells}<td>{job['rate_l_per_ha']:.2f}</td>{label_cell}</tr>"


def review_row(item: dict) -> str:
    email_cell = cell(item["email_id"] or "")
    reason_cell = cell(item["reason"] or "", "wait")
    return f"<tr>{email_cell}{reason_cell}</tr>"


def table_or_note(headings, rows: list[str], empty_note: str) -> str:
    """A table of the rows, or a short note when there are none."""
    if not rows:
        return f'<p class="empty">{empty_note}</p>'
    return "<table>" + heading_row(headings) + "".join(rows) + "</table>"


def board_page(split: str) -> str:
    """The jobs board: every booked job and every email waiting for a person."""
    jobs = store.rows(BOOKED_JOBS)
    reviews = store.rows("select * from review_queue order by review_id")
    job_rows = [job_row(job) for job in jobs]
    review_rows = [review_row(item) for item in reviews]
    no_jobs = "No jobs booked yet. Run the desk on the inbox to book some."
    jobs_table = table_or_note(JOB_HEADINGS, job_rows, no_jobs)
    review_headings = ("Email", "Why it needs a person")
    review_table = table_or_note(review_headings, review_rows, "Nothing waits for a person.")

    head = (
        "<head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        f"<title>Spray desk</title><style>{PAGE_STYLE}</style></head>"
    )
    counts = f"{len(jobs)} jobs booked, {len(reviews)} waiting for a person."
    summary = f"<p>{counts}</p>"
    header = f"<header><h1>Tallgrass Bend Growers Co-op: spray desk</h1>{summary}</header>"
    jobs_section = f"<section><h2>Booked jobs</h2>{jobs_table}</section>"
    review_section = f"<section><h2>Review queue</h2>{review_table}</section>"
    body = f"<body>{header}<main>{jobs_section}{review_section}</main></body>"
    return f"<!doctype html><html lang='en'>{head}{body}</html>"


def read_routes(split: str) -> dict:
    """Each GET path and the function that answers it."""
    return {
        "/api/health": lambda: {"ok": True, "split": split},
        "/api/inbox": lambda: store.inbox(split),
        "/api/growers": lambda: store.rows("select * from growers order by grower_id"),
        "/api/fields": lambda: store.rows("select * from fields order by field_id"),
        "/api/products": store.products,
        "/api/jobs": lambda: store.rows("select * from jobs order by job_id"),
        "/api/review": lambda: store.rows("select * from review_queue order by review_id"),
    }


def write(path: str, payload: dict) -> tuple[int, dict]:
    """Book a job or send an email to review. Returns the status code and the answer."""
    try:
        if path == "/api/jobs":
            return 201, {"job_id": store.book_job(payload)}
        if path == "/api/review":
            return 201, {"review_id": store.send_to_review(payload)}
    except (KeyError, ValueError) as error:
        return 400, {"error": f"Not booked: {error}."}
    return 404, {"error": f"No route {path}. Post to /api/jobs or /api/review."}


def make_handler(split: str):
    routes = read_routes(split)

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            # Stay quiet: a check starts many servers and reads only their answers.
            return

        def send(self, status: int, body, content_type: str = "application/json") -> None:
            text = body if isinstance(body, str) else json.dumps(body)
            data = text.encode()
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/":
                return self.send(200, board_page(split), "text/html; charset=utf-8")
            if self.path in routes:
                return self.send(200, routes[self.path]())
            hint = "Try /api/inbox, /api/fields or /api/products."
            self.send(404, {"error": f"No route {self.path}. {hint}"})

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            try:
                payload = json.loads(self.rfile.read(length) or b"{}")
            except json.JSONDecodeError:
                return self.send(400, {"error": "The body is not JSON."})
            status, answer = write(self.path, payload)
            self.send(status, answer)

    return Handler


def serve(port: int, split: str) -> ThreadingHTTPServer:
    return ThreadingHTTPServer(("127.0.0.1", port), make_handler(split))
