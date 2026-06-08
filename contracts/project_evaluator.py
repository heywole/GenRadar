# v0.4.0 — Two-pillar scoring: Security + Transparency
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
        category:        str,
        scanner_signals: str,
    ) -> None:

        signals = {}
        try:
            signals = json.loads(scanner_signals)
        except Exception:
            signals = {}

        # ── SECURITY SCORE (0–100) ────────────────────────────────────────────
        # Each check adds points. A clean project scores 100.
        security = 0
        security_breakdown = {}

        goplus = bool(signals.get("goplus_flagged", False))
        sb     = bool(signals.get("safe_browsing_flagged", False))
        scam   = bool(signals.get("scamsniffer_flagged", False))

        # Database checks (+20 each = 60 max)
        gp_pts = 0 if goplus else 20
        sb_pts = 0 if sb     else 20
        sc_pts = 0 if scam   else 20
        security_breakdown["goplus"]        = gp_pts
        security_breakdown["safe_browsing"] = sb_pts
        security_breakdown["scamsniffer"]   = sc_pts
        security += gp_pts + sb_pts + sc_pts

        # HTML analysis (+15 wallet, +10 honeypot, +10 ssl, +5 scripts = 40 max)
        phishing     = bool(signals.get("phishing_detected", False))
        wallet_bad   = bool(signals.get("unsafe_wallet_behavior", False))
        honeypot     = bool(signals.get("has_honeypot_patterns", False))
        bad_scripts  = bool(signals.get("suspicious_scripts", False))
        ssl          = bool(signals.get("ssl_valid", True))

        # Deduct from bonus pool: wallet -15, honeypot -10, ssl -10, scripts -5
        wallet_pts  = 0 if (wallet_bad or phishing) else 15
        honeypot_pts = 0 if honeypot   else 10
        ssl_pts      = 10 if ssl       else 0
        scripts_pts  = 0 if bad_scripts else 5
        security_breakdown["wallet_safe"]  = wallet_pts
        security_breakdown["no_honeypot"]  = honeypot_pts
        security_breakdown["ssl"]          = ssl_pts
        security_breakdown["clean_scripts"] = scripts_pts
        security += wallet_pts + honeypot_pts + ssl_pts + scripts_pts

        security = max(0, min(100, security))

        # ── TRANSPARENCY SCORE (0–100) ────────────────────────────────────────
        transparency = 0
        transparency_breakdown = {}

        has_github   = bool(signals.get("has_github",   False))
        has_docs     = bool(signals.get("has_docs",     False))
        has_twitter  = bool(signals.get("has_twitter",  False))
        has_telegram = bool(signals.get("has_telegram", False))
        has_discord  = bool(signals.get("has_discord",  False))

        # Website always present (+25) since they submitted it
        web_pts  = 25
        gh_pts   = 20 if has_github   else 0
        doc_pts  = 20 if has_docs     else 0
        tw_pts   = 15 if has_twitter  else 0
        tg_pts   = 10 if has_telegram else 0
        dc_pts   = 10 if has_discord  else 0

        transparency_breakdown["website"]   = web_pts
        transparency_breakdown["github"]    = gh_pts
        transparency_breakdown["docs"]      = doc_pts
        transparency_breakdown["twitter"]   = tw_pts
        transparency_breakdown["telegram"]  = tg_pts
        transparency_breakdown["discord"]   = dc_pts

        transparency += web_pts + gh_pts + doc_pts + tw_pts + tg_pts + dc_pts
        transparency = max(0, min(100, transparency))

        # ── FINAL SCORE = average ─────────────────────────────────────────────
        score = round((security + transparency) / 2)
        risk  = "Low" if score >= 75 else "Medium" if score >= 50 else "High"

        unreachable = bool(signals.get("website_unreachable", False))
        confidence  = "Low" if unreachable else ("High" if has_github else "Medium")

        # ── DEDUCTIONS SUMMARY (for AI narrative) ─────────────────────────────
        deductions = []
        if goplus:       deductions.append("Flagged by GoPlus database")
        if sb:           deductions.append("Flagged by Google Safe Browsing")
        if scam:         deductions.append("Flagged by ScamSniffer")
        if phishing:     deductions.append("Phishing patterns in HTML")
        if wallet_bad:   deductions.append("Unsafe wallet patterns detected")
        if honeypot:     deductions.append("Honeypot patterns detected")
        if bad_scripts:  deductions.append("Obfuscated scripts detected")
        if not ssl:      deductions.append("No SSL/HTTPS certificate")
        if not has_github:   deductions.append("No GitHub repository linked")
        if not has_docs:     deductions.append("No documentation linked")
        if not has_twitter:  deductions.append("No Twitter/X linked")
        if not has_telegram: deductions.append("No Telegram linked")
        if not has_discord:  deductions.append("No Discord linked")

        github_summary = str(signals.get("github_summary", ""))
        site_preview   = str(signals.get("website_preview", ""))
        deduction_text = "; ".join(deductions) if deductions else "No issues found"

        # ── AI NARRATIVE ──────────────────────────────────────────────────────
        prompt = f"""You are a Web3 security analyst for GenRadar, a GenLayer-powered trust platform.

A backend scanner analyzed this project. Two scores are FINAL — do not change them:
- Security Score: {security}/100
- Transparency Score: {transparency}/100
- Final Score: {score}/100

PROJECT:
Name: {name}
Category: {category}
Description: {description[:400]}
Website: {website_url}
GitHub: {github_url if github_url else "not provided"}

EXACT SCANNER RESULTS:
- GoPlus flagged: {goplus}
- Google Safe Browsing flagged: {sb}
- ScamSniffer flagged: {scam}
- Phishing patterns: {phishing}
- Unsafe wallet behavior: {wallet_bad}
- Honeypot patterns: {honeypot}
- Obfuscated scripts: {bad_scripts}
- SSL/HTTPS valid: {ssl}
- Website unreachable: {unreachable}
- GitHub confirmed: {has_github} ({github_summary})
- Documentation linked: {has_docs}
- Twitter/X linked: {has_twitter}
- Telegram linked: {has_telegram}
- Discord linked: {has_discord}
- Website preview: {site_preview[:300]}

RULES:
1. If has_twitter is True, do NOT say Twitter is missing. Same for all other socials.
2. Only mention something as missing if its value is False.
3. Be specific and accurate.
4. Do not change any scores.
5. Write security_explanation and transparency_explanation separately.

Return ONLY valid JSON:
{{"positives": ["..."], "risks": ["..."], "findings": ["..."], "explanation": "...", "security_explanation": "...", "transparency_explanation": "..."}}"""

        def run_node():
            result = gl.nondet.exec_prompt(prompt)
            result = result.strip()
            if "```" in result:
                for part in result.split("```"):
                    part = part.strip().lstrip("json").strip()
                    if part.startswith("{"):
                        result = part
                        break
            s = result.find("{")
            e = result.rfind("}") + 1
            if s >= 0 and e > s:
                result = result[s:e]
            return result

        try:
            consensus = gl.eq_principle.prompt_comparative(
                run_node,
                "Narrative must accurately reflect scanner findings. Do not mention missing socials if they were provided."
            )
        except Exception:
            try:
                consensus = run_node()
            except Exception:
                consensus = json.dumps({
                    "positives": ["Website is accessible" if not unreachable else "Project submitted for review"],
                    "risks": deductions[:3] if deductions else ["Insufficient data"],
                    "findings": [deduction_text],
                    "explanation": f"Security: {security}/100. Transparency: {transparency}/100. Final: {score}/100.",
                    "security_explanation": f"Security score {security}/100 based on threat database checks and HTML analysis.",
                    "transparency_explanation": f"Transparency score {transparency}/100 based on public presence and documentation.",
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
            "positives":                list(data.get("positives", []))[:5],
            "risks":                    list(data.get("risks", deductions[:3]))[:5],
            "findings":                 list(data.get("findings", []))[:5],
            "explanation":              str(data.get("explanation", deduction_text)),
            "security_explanation":     str(data.get("security_explanation", "")),
            "transparency_explanation": str(data.get("transparency_explanation", "")),
            "breakdown": {
                "security":      security,
                "transparency":  transparency,
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
