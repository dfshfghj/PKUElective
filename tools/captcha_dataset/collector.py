from __future__ import annotations

import argparse
import csv
import getpass
import hashlib
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
import urllib3


LOGIN_URL = "https://iaaa.pku.edu.cn/iaaa/oauthlogin.do"
SSO_URL = "https://elective.pku.edu.cn/elective2008/ssoLogin.do"
COURSE_HOME_URL = (
    "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/"
    "HelpController.jpf"
)
CAPTCHA_URL = "https://elective.pku.edu.cn/elective2008/DrawServlet"
CAPTCHA_VERIFY_URL = (
    "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/"
    "supplement/validate.do"
)
HELP_TITLE = "<title>帮助-总体流程</title>"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36"
)


urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


@dataclass
class Credentials:
    username: str
    password: Optional[str] = None
    channel: Optional[str] = None


class AuthError(RuntimeError):
    pass


def build_session() -> requests.Session:
    session = requests.Session()
    session.verify = False
    session.headers.update(
        {
            "Referer": COURSE_HOME_URL,
            "Cache-Control": "max-age=0",
            "User-Agent": USER_AGENT,
        }
    )
    return session


def authenticate(session: requests.Session, credentials: Credentials) -> None:
    response = session.post(
        LOGIN_URL,
        data={
            "appid": "syllabus",
            "userName": credentials.username,
            "password": credentials.password,
            "randCode": "",
            "smsCode": "",
            "otpCode": "",
            "redirUrl": "http://elective.pku.edu.cn:80/elective2008/agent4Iaaa.jsp/../ssoLogin.do",
        },
        cookies={"userName": credentials.username},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise AuthError(f"login failed: {payload}")

    token = payload.get("token")
    if not token:
        raise AuthError("login succeeded but token is missing")

    response = session.get(
        SSO_URL,
        params={"rand": "0.1", "token": token},
        timeout=20,
    )
    response.raise_for_status()
    body = response.text

    if HELP_TITLE in body:
        return

    if "/scnStAthVef.jsp/" in body:
        if not credentials.channel:
            raise AuthError("identity selection required; pass --channel bzx or --channel bfx")

        sida = body.partition("/ssoLogin.do?sida=")[2].partition("&")[0]
        if not sida.isalnum():
            raise AuthError("unable to extract sida from SSO response")

        response = session.get(
            SSO_URL,
            params={"sida": sida, "sttp": credentials.channel},
            timeout=20,
        )
        response.raise_for_status()
        body = response.text
        if HELP_TITLE in body:
            return

    raise AuthError("after login check did not reach elective home")


def verify_alive(session: requests.Session) -> bool:
    response = session.get(COURSE_HOME_URL, timeout=20)
    response.raise_for_status()
    return HELP_TITLE in response.text


def fetch_captcha_bytes(session: requests.Session) -> bytes:
    response = session.get(CAPTCHA_URL, params={"Rand": "0.1"}, timeout=20)
    response.raise_for_status()
    return response.content


def verify_captcha_label(
    session: requests.Session,
    username: str,
    label: str,
) -> bool:
    response = session.post(
        CAPTCHA_VERIFY_URL,
        data={"validCode": label, "xh": username},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    return payload.get("valid") == "2"


def load_cookie_session(cookie_path: Path) -> Optional[requests.Session]:
    if not cookie_path.exists():
        return None

    data = json.loads(cookie_path.read_text(encoding="utf-8"))
    session = build_session()
    session.cookies.update(data.get("cookies", {}))
    return session


def save_cookie_session(session: requests.Session, cookie_path: Path) -> None:
    cookie_path.write_text(
        json.dumps({"cookies": requests.utils.dict_from_cookiejar(session.cookies)}, indent=2),
        encoding="utf-8",
    )


def ensure_dirs(output_root: Path) -> tuple[Path, Path, Path]:
    raw_dir = output_root / "raw"
    labeled_dir = output_root / "labeled"
    manifest_path = output_root / "manifest.csv"
    raw_dir.mkdir(parents=True, exist_ok=True)
    labeled_dir.mkdir(parents=True, exist_ok=True)
    return raw_dir, labeled_dir, manifest_path


def write_manifest_row(manifest_path: Path, row: dict[str, str]) -> None:
    fieldnames = [
        "timestamp",
        "filename",
        "label",
        "verified",
        "sha256",
        "bytes",
    ]
    write_header = not manifest_path.exists()
    with manifest_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if write_header:
            writer.writeheader()
        writer.writerow(row)


def make_sample_name(index: int, image_bytes: bytes) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    digest = hashlib.sha256(image_bytes).hexdigest()[:12]
    return f"{stamp}_{index:05d}_{digest}.png"


def prompt_for_label(sample_path: Path) -> Optional[str]:
    print(f"saved image: {sample_path}")
    print("enter label to save as labeled sample, blank to keep unlabeled, or 'skip' to continue")
    answer = input("> ").strip()
    if not answer or answer.lower() == "skip":
        return None
    return answer


def resolve_credentials(args: argparse.Namespace) -> Credentials:
    username = args.username or os.environ.get("ELECTIVE_USERNAME", "").strip()
    if not username:
        raise AuthError("missing username; pass --username or set ELECTIVE_USERNAME")

    channel = args.channel or os.environ.get("ELECTIVE_CHANNEL")
    if channel:
        channel = channel.strip().lower()
    if channel not in (None, "", "bzx", "bfx"):
        raise AuthError("channel must be bzx or bfx")
    return Credentials(username=username, channel=channel or None)


def ensure_password(credentials: Credentials, args: argparse.Namespace) -> Credentials:
    if credentials.password:
        return credentials

    password = args.password or os.environ.get("ELECTIVE_PASSWORD")
    if not password:
        password = getpass.getpass("password: ")
    if not password:
        raise AuthError("missing password")

    credentials.password = password
    return credentials


def collect(args: argparse.Namespace) -> int:
    tool_root = Path(__file__).resolve().parent
    output_root = (tool_root / args.output_dir).resolve()
    cookie_path = (tool_root / args.cookies_file).resolve()
    raw_dir, labeled_dir, manifest_path = ensure_dirs(output_root)

    session = load_cookie_session(cookie_path) if args.reuse_cookies else None
    credentials = resolve_credentials(args)

    if session is None:
        session = build_session()
        credentials = ensure_password(credentials, args)
        authenticate(session, credentials)
        save_cookie_session(session, cookie_path)
    else:
        try:
            if not verify_alive(session):
                raise AuthError("persisted cookie session expired")
        except Exception:
            session = build_session()
            credentials = ensure_password(credentials, args)
            authenticate(session, credentials)
            save_cookie_session(session, cookie_path)

    for index in range(1, args.count + 1):
        image_bytes = fetch_captcha_bytes(session)
        sample_name = make_sample_name(index, image_bytes)
        raw_path = raw_dir / sample_name
        raw_path.write_bytes(image_bytes)

        label = args.label
        if args.prompt_label:
            label = prompt_for_label(raw_path)

        verified = False
        final_path = raw_path
        if label:
            if args.verify_label:
                verified = verify_captcha_label(session, credentials.username, label)
                if not verified:
                    print(f"[{index}/{args.count}] label verify failed for {sample_name}: {label}")
                    label = None
                else:
                    print(f"[{index}/{args.count}] label verified: {label}")

            if label:
                label_dir = labeled_dir / label
                label_dir.mkdir(parents=True, exist_ok=True)
                final_path = label_dir / sample_name
                raw_path.replace(final_path)

        write_manifest_row(
            manifest_path,
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "filename": str(final_path.relative_to(output_root)).replace("\\", "/"),
                "label": label or "",
                "verified": "true" if verified else "false",
                "sha256": hashlib.sha256(image_bytes).hexdigest(),
                "bytes": str(len(image_bytes)),
            },
        )

        print(
            f"[{index}/{args.count}] saved {final_path.relative_to(output_root)} "
            f"({len(image_bytes)} bytes)"
        )
        if index < args.count and args.delay > 0:
            time.sleep(args.delay)

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fetch and save PKU elective CAPTCHA images for dataset collection."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    fetch_parser = subparsers.add_parser("fetch", help="fetch CAPTCHA samples")
    fetch_parser.add_argument("--username")
    fetch_parser.add_argument("--password")
    fetch_parser.add_argument("--channel", choices=["bzx", "bfx"])
    fetch_parser.add_argument("--count", type=int, default=20)
    fetch_parser.add_argument("--delay", type=float, default=0.5)
    fetch_parser.add_argument("--output-dir", default="data")
    fetch_parser.add_argument("--cookies-file", default="session_cookies.json")
    fetch_parser.add_argument("--label", help="apply the same label to every fetched sample")
    fetch_parser.add_argument(
        "--prompt-label",
        action="store_true",
        help="prompt for a label after each fetched image",
    )
    fetch_parser.add_argument(
        "--verify-label",
        action="store_true",
        help="verify each provided label with the server before marking it as valid",
    )
    fetch_parser.add_argument(
        "--reuse-cookies",
        action="store_true",
        help="reuse cookies from the last successful login when possible",
    )
    fetch_parser.set_defaults(handler=collect)

    return parser


def main(argv: list[str]) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.handler(args)
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        return 130
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
