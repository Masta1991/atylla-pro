from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import smtplib, io, base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from config import SMTP_EMAIL, SMTP_PASSWORD

router = APIRouter(prefix="/email", tags=["email"])

class WeeklySession(BaseModel):
    week: str
    count: int

class StrengthPoint(BaseModel):
    week: str
    exercise: str
    weight: float

class EmailReportRequest(BaseModel):
    recipient: str
    client_name: str
    months: int
    sessions: int
    top_body_parts: List[str]
    weight_start: Optional[float] = None
    weight_end: Optional[float] = None
    fat_start: Optional[float] = None
    fat_end: Optional[float] = None
    muscle_start: Optional[float] = None
    muscle_end: Optional[float] = None
    top_strength: List[dict]
    weekly_sessions: List[WeeklySession] = []
    strength_data: List[StrengthPoint] = []

class EmailPlanRequest(BaseModel):
    recipient: str
    client_name: str
    plans: List[dict]


def make_bar_chart(weekly_sessions: list) -> str:
    if not weekly_sessions:
        return ""
    weeks = []
    values = []
    for w in weekly_sessions:
        if isinstance(w, dict):
            wk = w.get('week', '')
            val = w.get('count', 0)
        elif hasattr(w, 'week'):
            wk = w.week
            val = w.count
        else:
            continue
        vals = wk.split('-W')
        weeks.append(vals[1] if len(vals) > 1 else wk)
        values.append(int(val))

    fig, ax = plt.subplots(figsize=(8, 3), dpi=80)
    fig.patch.set_facecolor('#0d1117')
    ax.set_facecolor('#0d1117')

    colors = ['#31d5f2' if v >= 3 else '#1a7090' if v >= 2 else '#1a4060' for v in values]
    bars = ax.bar(range(len(weeks)), values, color=colors, width=0.6)

    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.15,
                str(val), ha='center', va='bottom', fontsize=9, color='#31d5f2', fontweight='bold')

    ax.set_xticks(range(len(weeks)))
    ax.set_xticklabels(weeks, rotation=-45, ha='left', fontsize=8, color='#8b949e')
    ax.set_ylabel('Treningi', fontsize=9, color='#8b949e')
    ax.set_ylim(0, max(values) + 1)
    ax.yaxis.set_major_locator(plt.MaxNLocator(integer=True))
    ax.tick_params(axis='y', colors='#8b949e', labelsize=8)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_color('#30363d')
    ax.spines['left'].set_color('#30363d')
    ax.tick_params(axis='x', colors='#8b949e')
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=80, facecolor='#0d1117', edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


def make_line_chart(strength_data: list) -> str:
    if not strength_data:
        return ""

    exercises = {}
    for s in strength_data:
        if isinstance(s, dict):
            ex = s.get('exercise', '')
            wk = s.get('week', '')
            w = float(s.get('weight', 0))
        elif hasattr(s, 'exercise'):
            ex = s.exercise
            wk = s.week
            w = float(s.weight)
        else:
            continue
        if not ex or not wk:
            continue
        if ex not in exercises:
            exercises[ex] = []
        exercises[ex].append((wk, w))

    if not exercises:
        return ""

    colors = ['#31d5f2', '#2196F3', '#1dd1a1', '#ff6b6b', '#d29922', '#8b5cf6', '#f59e0b', '#ec4899']
    all_weeks = sorted(set(p[0] for pts in exercises.values() for p in pts))

    fig, ax = plt.subplots(figsize=(8, 4), dpi=80)
    fig.patch.set_facecolor('#0d1117')
    ax.set_facecolor('#0d1117')

    for i, (ex_name, points) in enumerate(exercises.items()):
        color = colors[i % len(colors)]
        sorted_pts = sorted(points, key=lambda p: p[0])
        xs = [all_weeks.index(p[0]) for p in sorted_pts]
        ys = [p[1] for p in sorted_pts]
        ax.plot(xs, ys, color=color, linewidth=2, marker='o', markersize=3, label=ex_name)
        for xi, yi in zip(xs, ys):
            ax.text(xi, yi + 0.3, str(yi), ha='center', fontsize=7, color=color, fontweight='bold')

    ax.set_xticks(range(len(all_weeks)))
    labels = [w.split('-W')[1] if '-W' in w else w for w in all_weeks]
    ax.set_xticklabels(labels, rotation=-45, ha='left', fontsize=7, color='#8b949e')
    ax.set_ylabel('kg', fontsize=9, color='#8b949e')
    ax.tick_params(axis='y', colors='#8b949e', labelsize=8)
    ax.spines['top'].set_visible(False)
    ax.spines['right'].set_visible(False)
    ax.spines['bottom'].set_color('#30363d')
    ax.spines['left'].set_color('#30363d')
    ax.legend(loc='upper left', fontsize=8, facecolor='#161b22', edgecolor='#30363d', labelcolor='#e6edf3')
    plt.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format='png', dpi=80, facecolor='#0d1117', edgecolor='none', bbox_inches='tight')
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode()


@router.post("/send-report")
def send_report(data: EmailReportRequest):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise HTTPException(500, "SMTP not configured")

    delta_weight = round(data.weight_end - data.weight_start, 1) if data.weight_start is not None and data.weight_end is not None else None
    delta_fat = round(data.fat_end - data.fat_start, 1) if data.fat_start is not None and data.fat_end is not None else None
    delta_muscle = round(data.muscle_end - data.muscle_start, 1) if data.muscle_start is not None and data.muscle_end is not None else None

    body_parts_str = ", ".join(data.top_body_parts) if data.top_body_parts else "Brak danych"
    strength_rows = ""
    for s in (data.top_strength or [])[:3]:
        d = s.get("delta", 0) or 0
        strength_rows += f'<tr><td style="padding:4px">{s.get("name","")}</td><td style="padding:4px">{s.get("first","")} kg</td><td style="padding:4px">{s.get("last","")} kg</td><td style="padding:4px;color:{"#1dd1a1" if d >= 0 else "#ff6b6b"}">{("+" if d >= 0 else "")}{d} kg</td></tr>'

    bar_img = make_bar_chart(data.weekly_sessions)
    line_img = make_line_chart(data.strength_data)

    html = f"""
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:24px;border-radius:16px">
      <h1 style="color:#31d5f2;text-align:center;letter-spacing:2px;margin-top:0">ATYLLA PRO</h1>
      <p style="text-align:center;color:#8b949e">Raport treningowy dla <b style="color:#e6edf3">{data.client_name}</b></p>
      <p style="text-align:center;color:#8b949e">Ostatnie {data.months} mies.</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr>
          <td style="background:#161b22;padding:16px;border-radius:12px;text-align:center">
            <div style="font-size:28px;font-weight:800;color:#31d5f2">{data.sessions}</div>
            <div style="font-size:11px;color:#8b949e">Sesji treningowych</div>
          </td>
          <td style="width:8px"></td>
          <td style="background:#161b22;padding:16px;border-radius:12px;text-align:center">
            <div style="font-size:14px;font-weight:700;color:#e6edf3">{body_parts_str}</div>
            <div style="font-size:11px;color:#8b949e">Top partie</div>
          </td>
        </tr>
      </table>

      <div style="background:#161b22;padding:14px;border-radius:12px;margin-bottom:10px">
        <h3 style="color:#31d5f2;margin:0 0 10px 0;font-size:14px">Sklad ciala</h3>
        <table style="width:100%;color:#e6edf3;font-size:12px">
          <tr><td style="padding:3px">Waga</td><td style="padding:3px">{data.weight_start or "-"} kg</td><td style="padding:3px">{data.weight_end or "-"} kg</td>
              <td style="padding:3px;color:{'#1dd1a1' if (delta_weight or 0) <= 0 else '#ff6b6b'}">{delta_weight if delta_weight is not None else ''}</td></tr>
          <tr><td style="padding:3px">Tluszcz</td><td style="padding:3px">{data.fat_start or "-"}%</td><td style="padding:3px">{data.fat_end or "-"}%</td>
              <td style="padding:3px;color:{'#1dd1a1' if (delta_fat or 0) <= 0 else '#ff6b6b'}">{delta_fat if delta_fat is not None else ''}</td></tr>
          <tr><td style="padding:3px">Miesnie</td><td style="padding:3px">{data.muscle_start or "-"}%</td><td style="padding:3px">{data.muscle_end or "-"}%</td>
              <td style="padding:3px;color:{'#1dd1a1' if (delta_muscle or 0) >= 0 else '#ff6b6b'}">{delta_muscle if delta_muscle is not None else ''}</td></tr>
        </table>
      </div>

      <div style="background:#161b22;padding:14px;border-radius:12px;margin-bottom:10px">
        <h3 style="color:#31d5f2;margin:0 0 10px 0;font-size:14px">Top 3 sila</h3>
        <table style="width:100%;color:#e6edf3;font-size:12px;border-collapse:collapse">
          <tr style="color:#8b949e"><th style="padding:3px;text-align:left">Cwiczenie</th><th style="padding:3px">Start</th><th style="padding:3px">Koniec</th><th style="padding:3px">Delta</th></tr>
          {strength_rows}
        </table>
      </div>
    """

    if bar_img:
        html += f'<div style="background:#161b22;padding:12px;border-radius:12px;margin-bottom:10px"><h3 style="color:#31d5f2;margin:0 0 8px 0;font-size:14px">Treningi tygodniowo</h3><img src="cid:bar_chart" style="max-width:100%;height:auto"/></div>'

    if line_img:
        html += f'<div style="background:#161b22;padding:12px;border-radius:12px;margin-bottom:10px"><h3 style="color:#31d5f2;margin:0 0 8px 0;font-size:14px">Progresja silowa</h3><img src="cid:line_chart" style="max-width:100%;height:auto"/></div>'

    html += f"""
      <p style="margin-top:20px;text-align:center;color:#484f58;font-size:11px">
        Wygenerowane przez <b style="color:#31d5f2">Atylla Pro</b>
      </p>
    </div>
    """

    msg = MIMEMultipart("related")
    msg["Subject"] = f"Raport treningowy - {data.client_name}"
    msg["From"] = SMTP_EMAIL
    msg["To"] = data.recipient

    alt = MIMEMultipart("alternative")
    msg.attach(alt)
    alt.attach(MIMEText(html, "html", "utf-8"))

    if bar_img:
        img = MIMEImage(base64.b64decode(bar_img), _subtype="png")
        img.add_header("Content-ID", "<bar_chart>")
        img.add_header("Content-Disposition", "inline", filename="bar_chart.png")
        msg.attach(img)

    if line_img:
        img = MIMEImage(base64.b64decode(line_img), _subtype="png")
        img.add_header("Content-ID", "<line_chart>")
        img.add_header("Content-Disposition", "inline", filename="line_chart.png")
        msg.attach(img)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, data.recipient, msg.as_string())
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(500, f"Email error: {str(e)}")


@router.post("/send-plan")
def send_plan(data: EmailPlanRequest):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        raise HTTPException(500, "SMTP not configured")

    plans_html = ""
    for p in (data.plans or []):
        name = p.get("name", "")
        exercises = p.get("exercises", [])
        rows = ""
        for ex in exercises:
            rows += f'<tr><td style="padding:6px;border-bottom:1px solid #30363d">🏋️ {ex}</td></tr>'
        plans_html += f"""
        <div style="background:#161b22;padding:14px;border-radius:12px;margin-bottom:10px">
          <h3 style="color:#31d5f2;margin:0 0 10px 0;font-size:14px;text-transform:uppercase">{name}</h3>
          <table style="width:100%;color:#e6edf3;font-size:13px">{rows}</table>
        </div>"""

    html = f"""
    <div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;background:#0d1117;color:#e6edf3;padding:24px;border-radius:16px">
      <h1 style="color:#31d5f2;text-align:center;letter-spacing:2px;margin-top:0">ATYLLA PRO</h1>
      <p style="text-align:center;color:#8b949e">Plan treningowy dla <b style="color:#e6edf3">{data.client_name}</b></p>
      {plans_html}
      <p style="margin-top:20px;text-align:center;color:#484f58;font-size:11px">
        Wygenerowane przez <b style="color:#31d5f2">Atylla Pro</b>
      </p>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Plan treningowy - {data.client_name}"
    msg["From"] = SMTP_EMAIL
    msg["To"] = data.recipient
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, data.recipient, msg.as_string())
        return {"status": "sent"}
    except Exception as e:
        raise HTTPException(500, f"Email error: {str(e)}")
