# v0.2.16
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
        project_id: str,
        name: str,
        description: str,
        website_url: str,
        github_url: str,
        category: str,
        scanner_signals: str,
    ) -> None:

        # Parse scanner signals from backend
        signals = {}
        try:
            signals = json.loads(scanner_signals)
        except Exception:
            signals = {}

        # ── SCORING: Start from 100, subtract only for confirmed issues ──
        score = 100
        deductions = []

        # Security penalties — only subtract if signal is TRUE
        if bool(signals.get("phishing_detected", False)):
            score -= 25
            deductions.append("Phishing patterns detected (-25)")

        if bool(signals.get("unsafe_wallet_behavior", False)):
            score -= 23
            deductions.append("Unsafe wallet behavior detected (-23)")

        if bool(signals.get("suspicious_scripts", False)):
            score -= 15
            deductions.append("Obfuscated/suspicious scripts detected (-15)")

        if bool(signals.get("hidden_redirects", False)):
            score -= 10
            deductions.append("Hidden redirects detected (-10)")

        domain_age = signals.get("domain_age_days", None)
        if domain_age is not None and int(domain_age) < 30:
            score -= 3
            deductions.append("Domain age under 30 days (-3)")

        # Transparency penalties — only subtract if missing
        if not bool(signals.get("has_github", False)):
            score -= 10
            deductions.append("No GitHub repository (-10)")

        if not bool(signals.get("has_docs", False)):
            score -= 5
            deductions.append("No documentation provided (-5)")

        if not bool(signals.get("has_twitter", False)):
            score -= 3
            deductions.append("No Twitter/X presence (-3)")

        if not bool(signals.get("has_telegram", False)):
            score -= 3
            deductions.append("No Telegram community (-3)")

        if not bool(signals.get("has_discord", False)):
            score -= 3
            deductions.append("No Discord community (-3)")

        score = max(0, min(100, score))
        risk  = "Low" if score >= 75 else "Medium" if score >= 50 else "High"

        # Confidence based on data quality
        unreachable = bool(signals.get("website_unreachable", False))
        has_github  = bool(signals.get("has_github", False))
        if unreachable:
            confidence = "Low"
        elif has_github:
            confidence = "High"
        else:
            confidence = "Medium"

        deduction_summary = "; ".join(deductions) if deductions else "No major deductions applied"
        github_summary    = str(signals.get("github_summary", ""))
        site_preview      = str(signals.get("website_preview", ""))

        # ── AI generates ONLY the narrative text, NOT the score ──
        prompt = f"""You are a Web3 security analyst for GenScout, a GenLayer-powered trust platform.

A backend scanner has analyzed this project and the scoring rules have already been applied.
Your ONLY job is to write the narrative: positives, risks, findings, and explanation.
Do NOT change or suggest a different score. The score is {score}/100 and is final.

PROJECT:
Name: {name}
Category: {category}
Description: {description[:400]}
Website: {website_url}
GitHub: {github_url if github_url else "not provided"}

SCANNER SIGNALS (what was found):
- Website unreachable: {unreachable}
- Phishing detected: {bool(signals.get("phishing_detected", False))}
- Unsafe wallet behavior: {bool(signals.get("unsafe_wallet_behavior", False))}
- Suspicious scripts: {bool(signals.get("suspicious_scripts", False))}
- Hidden redirects: {bool(signals.get("hidden_redirects", False))}
- GitHub present: {has_github}
- GitHub summary: {github_summary}
- Has documentation: {bool(signals.get("has_docs", False))}
- Has Twitter: {bool(signals.get("has_twitter", False))}
- Has Telegram: {bool(signals.get("has_telegram", False))}
- Has Discord: {bool(signals.get("has_discord", False))}
- Website preview: {site_preview[:300]}

SCORE APPLIED: {score}/100
DEDUCTIONS APPLIED: {deduction_summary}

Write 2-4 positives (things that checked out fine), 1-3 risks (things missing or flagged),
and a 1-2 sentence explanation of the overall score.

Return ONLY valid JSON, no markdown:
{{"positives": ["..."], "risks": ["..."], "findings": ["..."], "explanation": "..."}}"""

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
                "The narrative must accurately reflect the scanner signals provided"
            )
        except Exception:
            try:
                consensus = run_node()
            except Exception:
                consensus = json.dumps({
                    "positives": ["Website accessible" if not unreachable else "Project submitted for review"],
                    "risks": deductions[:3] if deductions else ["Insufficient data"],
                    "findings": [deduction_summary],
                    "explanation": deduction_summary,
                })

        try:
            data = json.loads(consensus)
        except Exception:
            data = {}

        output = {
            "score":       score,
            "risk":        risk,
            "confidence":  confidence,
            "positives":   list(data.get("positives", []))[:5],
            "risks":       list(data.get("risks", deductions[:3]))[:5],
            "findings":    list(data.get("findings", []))[:5],
            "explanation": str(data.get("explanation", deduction_summary)),
            "breakdown": {
                "security":     100 - (25 if bool(signals.get("phishing_detected")) else 0) - (23 if bool(signals.get("unsafe_wallet_behavior")) else 0) - (15 if bool(signals.get("suspicious_scripts")) else 0) - (10 if bool(signals.get("hidden_redirects")) else 0),
                "transparency": 100 - (10 if not has_github else 0) - (5 if not bool(signals.get("has_docs")) else 0),
                "community":    100 - (3 if not bool(signals.get("has_twitter")) else 0) - (3 if not bool(signals.get("has_telegram")) else 0) - (3 if not bool(signals.get("has_discord")) else 0),
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
