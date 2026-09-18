#!/usr/bin/env python3
"""Claude Code capture hook for the 8x assignment.

Wired in .claude/settings.json to three events:
  SessionStart     -> remembers the session's model (fallback for prompt entries)
  UserPromptSubmit -> appends a PROMPT entry with the verbatim prompt
  Stop             -> appends a RESPONSE entry with the turn's final assistant text

One markdown file per session in .agent-logs/, named
YYYY-MM-DD_HH-MM-SS_<session-id>.md. The frontmatter (total_exchanges,
last_prompt_time) is recomputed on every write; entries are append-only.

The hook must never block or break the session, so every failure is swallowed
and reported to stderr only.
"""
import fcntl
import glob
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

AUTHOR = os.environ.get("AGENT_LOG_AUTHOR", "yashg16422-design")
TOOL = "claude-code"


def now_iso():
    t = datetime.now(timezone.utc)
    return t.strftime("%Y-%m-%dT%H:%M:%S.") + f"{t.microsecond // 1000:03d}Z"


def project_dir(data):
    return os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def state_path(root, session_id):
    d = os.path.join(root, ".claude", "hooks", ".state")
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, f"{session_id}.json")


def load_state(root, session_id):
    try:
        with open(state_path(root, session_id)) as f:
            return json.load(f)
    except Exception:
        return {}


def save_state(root, session_id, state):
    with open(state_path(root, session_id), "w") as f:
        json.dump(state, f)


def read_transcript(path):
    entries = []
    if not path or not os.path.exists(path):
        return entries
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except Exception:
                pass
    return entries


def is_real_user_prompt(e):
    """A user entry typed by the human (not a tool result / meta injection)."""
    if e.get("type") != "user" or e.get("isMeta") or e.get("isSidechain"):
        return False
    c = (e.get("message") or {}).get("content")
    if isinstance(c, str):
        return True
    if isinstance(c, list):
        return any(b.get("type") == "text" for b in c) and \
            not any(b.get("type") == "tool_result" for b in c)
    return False


def latest_model(entries):
    for e in reversed(entries):
        if e.get("type") == "assistant" and not e.get("isSidechain"):
            m = (e.get("message") or {}).get("model")
            if m and m != "<synthetic>":
                return m
    return None


def final_response(entries):
    """Text of the last assistant message after the most recent human prompt.

    An assistant message is written to the transcript as one JSONL line per
    content block, all sharing message.id, so blocks are regrouped by id.
    Intermediate text between tool calls belongs to earlier message ids and is
    deliberately excluded - only the final message of the turn is kept.
    """
    start = 0
    for i, e in enumerate(entries):
        if is_real_user_prompt(e):
            start = i
    turn = [e for e in entries[start:]
            if e.get("type") == "assistant" and not e.get("isSidechain")]
    last_id = None
    for e in reversed(turn):
        blocks = (e.get("message") or {}).get("content") or []
        if any(b.get("type") == "text" and b.get("text", "").strip() for b in blocks):
            last_id = (e.get("message") or {}).get("id")
            break
    if last_id is None:
        return None, None
    texts, model = [], None
    for e in turn:
        msg = e.get("message") or {}
        if msg.get("id") != last_id:
            continue
        model = msg.get("model") or model
        for b in msg.get("content") or []:
            if b.get("type") == "text":
                texts.append(b.get("text", ""))
    return "\n\n".join(t for t in texts if t), model


def log_file(root, session_id):
    d = os.path.join(root, ".agent-logs")
    os.makedirs(d, exist_ok=True)
    existing = sorted(glob.glob(os.path.join(d, f"*_{session_id}.md")))
    if existing:
        return existing[0]
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    return os.path.join(d, f"{stamp}_{session_id}.md")


FRONT_RE = re.compile(r"\A---\n(.*?)\n---\n", re.S)


def write_entry(root, session_id, state, kind, ts, model, body):
    """Append one entry. Counters live in the session state file, not parsed
    from the log body, so prompt text containing log markers can't skew them."""
    path = state.get("log_path")
    if not path or not os.path.exists(path):
        path = log_file(root, session_id)
        state["log_path"] = path
    short = session_id[:8]
    lock = open(path + ".lock", "w")
    fcntl.flock(lock, fcntl.LOCK_EX)
    try:
        content = open(path).read() if os.path.exists(path) else ""
        m = FRONT_RE.match(content)
        if m:
            rest = content[m.end():]
        else:
            state.setdefault("date", ts[:10])
            rest = (f"\n# Session Log - {state['date']}\n\n"
                    f"Session: `{short}` | Project: `{os.path.basename(root)}` | "
                    f"Author: `{AUTHOR}`\n\n---\n")
        state.setdefault("date", ts[:10])
        prompts = state.get("prompts", 0)
        responses = state.get("responses", 0)

        if kind == "PROMPT":
            # Previous prompt never got a Stop event (user interrupted the turn).
            # Say so rather than leave a silent gap.
            if prompts > responses:
                rest += (f"\n\n[LOG_ENTRY type=RESPONSE num={prompts} session={short}]\n"
                         f"timestamp: {ts}\nmodel: {model}\n\n"
                         "[no final response captured - turn ended without a Stop "
                         "event, most likely interrupted by the user]\n")
            prompts += 1
            responses = prompts - 1
            num = prompts
            state.setdefault("first_prompt_time", ts)
            state["last_prompt_time"] = ts
        else:
            num = prompts
            responses = prompts
            # First prompt of a session: no assistant message exists yet and
            # SessionStart carries no model, so the PROMPT was logged as
            # "unknown". Resolve it from the reply of this same turn.
            if model and model != "unknown":
                pat = re.compile(
                    rf"(\[LOG_ENTRY type=PROMPT num={num} session={re.escape(short)}\]\n"
                    r"timestamp: [^\n]*\nmodel: )unknown\n")
                rest = pat.sub(lambda mm: mm.group(1) + model + "\n", rest, count=1)

        rest += (f"\n\n[LOG_ENTRY type={kind} num={num} session={short}]\n"
                 f"timestamp: {ts}\nmodel: {model}\n\n{body.rstrip()}\n")

        # header lists every model seen, so a mid-session switch is visible
        models = state.get("models", [])
        if model and model != "unknown" and model not in models:
            models.append(model)
        state.update(prompts=prompts, responses=responses, models=models)

        header = (
            "---\n"
            f"session_id: {session_id}\n"
            f"date: {state['date']}\n"
            f"author: {AUTHOR}\n"
            f"model: {', '.join(models) or 'unknown'}\n"
            f"tool: {TOOL}\n"
            f"project: {os.path.basename(root)}\n"
            f"total_exchanges: {prompts}\n"
            f"first_prompt_time: {state.get('first_prompt_time', '')}\n"
            f"last_prompt_time: {state.get('last_prompt_time', '')}\n"
            "---\n"
        )
        tmp = path + ".tmp"
        with open(tmp, "w") as f:
            f.write(header + rest)
        os.replace(tmp, path)
        save_state(root, session_id, state)
    finally:
        fcntl.flock(lock, fcntl.LOCK_UN)
        lock.close()
        try:
            os.remove(path + ".lock")
        except OSError:
            pass


def main():
    data = json.load(sys.stdin)
    event = data.get("hook_event_name") or (sys.argv[1] if len(sys.argv) > 1 else "")
    session_id = data.get("session_id") or "unknown-session"
    root = project_dir(data)
    state = load_state(root, session_id)

    if os.environ.get("AGENT_LOG_DEBUG"):
        with open(os.path.join(root, ".claude", "hooks", ".state", f"raw-{event}.json"), "w") as f:
            json.dump(data, f, indent=2)

    if event == "SessionStart":
        if data.get("model"):
            state["model"] = data["model"]
            save_state(root, session_id, state)
        return

    if event == "UserPromptSubmit":
        ts = now_iso()
        entries = read_transcript(data.get("transcript_path"))
        model = latest_model(entries) or state.get("model") or \
            os.environ.get("ANTHROPIC_MODEL") or "unknown"
        write_entry(root, session_id, state, "PROMPT", ts, model, data.get("prompt", ""))
        return

    if event == "Stop":
        ts = now_iso()
        text, model = None, None
        # The Stop hook can fire before the final message is flushed to the
        # transcript; poll briefly so we never log the previous turn's reply.
        for _ in range(20):
            entries = read_transcript(data.get("transcript_path"))
            text, model = final_response(entries)
            if text is not None:
                break
            time.sleep(0.25)
        if text is None:
            text = data.get("last_assistant_message") or \
                "[no assistant text found in transcript for this turn]"
        model = model or latest_model(read_transcript(data.get("transcript_path"))) \
            or state.get("model") or "unknown"
        write_entry(root, session_id, state, "RESPONSE", ts, model, text)
        return


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # never break the session
        print(f"capture hook error: {exc!r}", file=sys.stderr)
    sys.exit(0)
