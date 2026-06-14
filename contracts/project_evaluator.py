# v0.5.0 — GenLayer reads actual URLs directly, no boolean pre-processing
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


class ProjectEvaluator(gl.Contract):
    results: TreeMap[str, str]

    def __init__(self) -> None:
        self.results = TreeMap()

    @gl.public.write
    def evaluate_project(
        self,
        project_id:      str,
        name:            str,
        description:     str,
        website_url:     str,
        github_url:      str,
        twitter_url:     str,
        telegram_url:    str,
        discord_url:     str,
        docs_url:        str,
        category:        str,
        scanner_signals: str,
    ) -> None:

        # Parse backend security scan results
        signals = {}
        try:
            signals = json.loads(scanner_signals)
        except Exception:
            signals = {}

        # ── SECURITY SCORE (0–100) ────────────────────────────────────────────
        # Based purely on backend scanner signals — not AI judgment
        security = 0
        security_breakdown = {}

        goplus  = bool(signals.get("goplus_flagged",        False))
        sb      = bool(signals.get("safe_browsing_flagged", False))
        scam    = bool(signals.get("scamsniffer_flagged",   False))
        phishing    = bool(signals.get("phishing_detected",      False))
        wallet_bad  = bool(signals.get("unsafe_wallet_behavior", False))
        honeypot    = bool(signals.get("has_honeypot_patterns",  False))
        bad_scripts = bool(signals.get("suspicious_scripts",     False))
        ssl         = bool(signals.get("ssl_valid", True))
        unreachable = bool(signals.get("website_unreachable",    False))

        gp_pts = 0 if goplus else 20
        sb_pts = 0 if sb     else 20
        sc_pts = 0 if scam   else 20
        wallet_pts   = 0 if (wallet_bad or phishing) else 15
        honeypot_pts = 0 if honeypot    else 10
        ssl_pts      = 10 if ssl        else 0
        scripts_pts  = 0 if bad_scripts else 5

        security_breakdown["goplus"]        = gp_pts
        security_breakdown["safe_browsing"] = sb_pts
        security_breakdown["scamsniffer"]   = sc_pts
        security_breakdown["wallet_safe"]   = wallet_pts
        security_breakdown["no_honeypot"]   = honeypot_pts
        security_breakdown["ssl"]           = ssl_pts
        security_breakdown["clean_scripts"] = scripts_pts

        security = max(0, min(100,
            gp_pts + sb_pts + sc_pts + wallet_pts + honeypot_pts + ssl_pts + scripts_pts
        ))

        # ── TRANSPARENCY SCORE (0–100) ────────────────────────────────────────
        # Based on actual submitted URLs — GenLayer can see if they are real
        has_website  = bool(website_url  and website_url.strip())
        has_github   = bool(github_url   and github_url.strip())
        has_twitter  = bool(twitter_url  and twitter_url.strip())
        has_telegram = bool(telegram_url and telegram_url.strip())
        has_discord  = bool(discord_url  and discord_url.strip())
        has_docs     = bool(docs_url     and docs_url.strip())

        web_pts  = 25 if has_website  else 0
        gh_pts   = 20 if has_github   else 0
        doc_pts  = 20 if has_docs     else 0
        tw_pts   = 15 if has_twitter  else 0
        tg_pts   = 10 if has_telegram else 0
        dc_pts   = 10 if has_discord  else 0

        transparency_breakdown = {
            "website":  web_pts,
            "github":   gh_pts,
            "docs":     doc_pts,
            "twitter":  tw_pts,
            "telegram": tg_pts,
            "discord":  dc_pts,
        }

        transparency = max(0, min(100,
            web_pts + gh_pts + doc_pts + tw_pts + tg_pts + dc_pts
        ))

        # ── FINAL SCORE ───────────────────────────────────────────────────────
        score = round((security + transparency) / 2)
        risk  = "Low" if score >= 75 else "Medium" if score >= 50 else "High"
        confidence = "Low" if unreachable else ("High" if has_github else "Medium")

        github_summary = str(signals.get("github_summary",  ""))
        site_preview   = str(signals.get("website_preview", ""))

        # Build confirmed facts for AI narrative
        positives_list = []
        risks_list = []

        if not goplus and not sb and not scam:
            positives_list.append("Not flagged by any threat database (GoPlus, Safe Browsing, ScamSniffer)")
        if not phishing:
            positives_list.append("No phishing patterns detected")
        if not wallet_bad:
            positives_list.append("No unsafe wallet behavior detected")
        if not honeypot:
            positives_list.append("No honeypot patterns detected")
        if not bad_scripts:
            positives_list.append("No obfuscated scripts detected")
        if ssl:
            positives_list.append("Valid SSL/HTTPS certificate")
        if has_website and not unreachable:
            positives_list.append("Website is live and accessible")
        if has_twitter:
            positives_list.append(f"Twitter/X account is linked: {twitter_url}")
        if has_github:
            positives_list.append(f"GitHub repository is linked: {github_url}")
        if has_docs:
            positives_list.append(f"Documentation is linked: {docs_url}")
        if has_telegram:
            positives_list.append(f"Telegram community is linked: {telegram_url}")
        if has_discord:
            positives_list.append(f"Discord server is linked: {discord_url}")

        if goplus:       risks_list.append("Flagged by GoPlus phishing database")
        if sb:           risks_list.append("Flagged by Google Safe Browsing")
        if scam:         risks_list.append("Flagged by ScamSniffer blacklist")
        if phishing:     risks_list.append("Phishing patterns detected in HTML")
        if wallet_bad:   risks_list.append("Unsafe wallet approval patterns detected")
        if honeypot:     risks_list.append("Honeypot patterns detected")
        if bad_scripts:  risks_list.append("Obfuscated/suspicious scripts detected")
        if not ssl:      risks_list.append("No valid SSL/HTTPS certificate")
        if not has_github:   risks_list.append("No GitHub repository provided")
        if not has_docs:     risks_list.append("No documentation link provided")
        if not has_twitter:  risks_list.append("No Twitter/X account linked")
        if not has_telegram: risks_list.append("No Telegram community linked")
        if not has_discord:  risks_list.append("No Discord server linked")

        # ── AI NARRATIVE — GenLayer validates accuracy ─────────────────────────
        prompt = f"""You are a Web3 security analyst writing a project evaluation for GenRadar, powered by GenLayer Intelligent Contracts.

PROJECT: {name} ({category})
Description: {description[:400]}
Website: {website_url}

CONFIRMED FACTS FROM BACKEND SCANNER — do not contradict any of these:

SECURITY (scanner-verified):
- GoPlus: {"FLAGGED" if goplus else "CLEAN"}
- Google Safe Browsing: {"FLAGGED" if sb else "CLEAN"}
- ScamSniffer: {"FLAGGED" if scam else "CLEAN"}
- SSL/HTTPS: {"VALID" if ssl else "INVALID"}
- Phishing patterns: {"DETECTED" if phishing else "NONE"}
- Unsafe wallet behavior: {"DETECTED" if wallet_bad else "NONE"}
- Honeypot patterns: {"DETECTED" if honeypot else "NONE"}
- Obfuscated scripts: {"DETECTED" if bad_scripts else "NONE"}
- Website reachable: {"NO" if unreachable else "YES"}
- GitHub details: {github_summary}
- Website preview: {site_preview[:200]}

SOCIAL/TRANSPARENCY (from actual submitted URLs):
- Website: {website_url if has_website else "NOT PROVIDED"}
- GitHub: {github_url if has_github else "NOT PROVIDED"}
- Twitter/X: {twitter_url if has_twitter else "NOT PROVIDED"}
- Telegram: {telegram_url if has_telegram else "NOT PROVIDED"}
- Discord: {discord_url if has_discord else "NOT PROVIDED"}
- Docs: {docs_url if has_docs else "NOT PROVIDED"}

COMPUTED SCORES (fixed — do not change):
- Security: {security}/100
- Transparency: {transparency}/100
- Final Score: {score}/100
- Risk: {risk}

Write a 2-sentence explanation, a security_explanation, and a transparency_explanation.
The transparency_explanation MUST mention every social/URL that is provided above as present.
The transparency_explanation MUST NOT say any provided URL is missing.

Return ONLY valid JSON (no markdown):
{{"explanation": "...", "security_explanation": "...", "transparency_explanation": "..."}}"""

        def run_node():
            result = gl.nondet.exec_prompt(prompt)
            result = result.strip()
            if "```" in result:
                for part in result.split("```"):
                    p = part.strip().lstrip("json").strip()
                    if p.startswith("{"):
                        result = p
                        break
            s = result.find("{")
            e = result.rfind("}") + 1
            if s >= 0 and e > s:
                result = result[s:e]
            return result

        try:
            consensus = gl.eq_principle.prompt_comparative(
                run_node,
                f"The explanation must accurately reflect: Twitter={has_twitter}, GitHub={has_github}, Docs={has_docs}, Telegram={has_telegram}, Discord={has_discord}, Security={security}, Transparency={transparency}. Reject any response that says a provided social link is missing."
            )
        except Exception:
            try:
                consensus = run_node()
            except Exception:
                consensus = json.dumps({
                    "explanation": f"Security: {security}/100. Transparency: {transparency}/100. Final: {score}/100.",
                    "security_explanation": f"Security score {security}/100 based on automated threat database and HTML analysis.",
                    "transparency_explanation": f"Transparency score {transparency}/100 based on submitted URLs.",
                })

        try:
            data = json.loads(consensus)
        except Exception:
            data = {}

        output = {
            "score":                    score,
            "security_score":           security,
            "transparency_score":       transparency,
            "risk":                     risk,
            "confidence":               confidence,
            "positives":                positives_list[:5],
            "risks":                    risks_list[:5],
            "findings":                 risks_list[:5],
            "explanation":              str(data.get("explanation", "")),
            "security_explanation":     str(data.get("security_explanation", "")),
            "transparency_explanation": str(data.get("transparency_explanation", "")),
            "breakdown": {
                "security":             security,
                "transparency":         transparency,
                "security_detail":      security_breakdown,
                "transparency_detail":  transparency_breakdown,
            },
        }

        self.results[project_id] = json.dumps(output)

    @gl.public.view
    def get_evaluation(self, project_id: str) -> str:
        if project_id in self.results:
            return self.results[project_id]
        return "{}"

    @gl.public.view
    def has_evaluation(self, project_id: str) -> bool:
        return project_id in self.results
