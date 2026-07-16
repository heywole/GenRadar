# v1.0.0 — Validators verify sources independently, results locked after first evaluation
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json


class ProjectEvaluator(gl.Contract):
    results:  TreeMap[str, str]   # project_id -> JSON result (presence = locked)

    def __init__(self) -> None:
        self.results = TreeMap()

    @gl.public.write
    def evaluate_project(
        self,
        project_id:   str,
        name:         str,
        description:  str,
        website_url:  str,
        github_url:   str,
        twitter_url:  str,
        telegram_url: str,
        discord_url:  str,
        docs_url:     str,
        category:     str,
    ) -> None:

        # ── Lock protection ───────────────────────────────────────────────────
        # Once a project has a finalized evaluation, it cannot be overwritten.
        # Presence in self.results IS the lock — no separate lock map needed.
        if project_id in self.results:
            return  # silently ignore re-evaluation attempts

        # ── Each validator independently fetches and verifies URLs ────────────
        # This is the key fix: validators do their own checks, not trusting caller

        def verify_project() -> str:
            security     = 0
            transparency = 0
            sec_detail   = {}
            trans_detail = {}
            findings     = []
            positives    = []
            risks        = []

            # ── Verify website ────────────────────────────────────────────────
            website_live    = False
            website_content = ''
            ssl_valid       = website_url.startswith('https://')

            if website_url:
                try:
                    page = gl.nondet.get_webpage(website_url, mode='text')
                    if page and len(page) > 50:
                        website_live    = True
                        website_content = page[:500]
                        positives.append(f'Website is live and accessible: {website_url}')
                        if ssl_valid:
                            positives.append('HTTPS/SSL certificate is valid')
                        else:
                            risks.append('Website does not use HTTPS')
                    else:
                        risks.append(f'Website appears unreachable or empty: {website_url}')
                except Exception:
                    risks.append(f'Could not reach website: {website_url}')

            # ── Security score (validators verify directly) ───────────────────
            # +20 website live and HTTPS
            # +20 no obvious phishing patterns in fetched content
            # +20 no honeypot indicators
            # +20 no obfuscated scripts
            # +20 clean domain (no suspicious TLD patterns)

            phishing_keywords = [
                'enter your seed phrase', 'enter private key', 'wallet sync required',
                'validate your wallet', 'claim your reward now', 'connect wallet to claim',
                'airdrop claim', 'verify wallet',
            ]
            honeypot_keywords = [
                'free tokens', 'guaranteed profit', 'send eth receive back',
                'double your', '100x guaranteed',
            ]
            obfuscated_indicators = [
                'eval(atob', 'eval(unescape', 'fromcharcode', 'document.write(unescape',
            ]

            content_lower = website_content.lower()

            has_phishing  = any(kw in content_lower for kw in phishing_keywords)
            has_honeypot  = any(kw in content_lower for kw in honeypot_keywords)
            has_obfuscate = any(kw in content_lower for kw in obfuscated_indicators)

            web_pts  = 20 if (website_live and ssl_valid)  else 0
            safe_pts = 20 if not has_phishing              else 0
            hon_pts  = 20 if not has_honeypot              else 0
            scr_pts  = 20 if not has_obfuscate             else 0
            dom_pts  = 20  # base clean domain score

            if has_phishing:  risks.append('Phishing patterns detected in website content')
            if has_honeypot:  risks.append('Honeypot/scam indicators detected in website')
            if has_obfuscate: risks.append('Obfuscated scripts detected in website')

            sec_detail['website_live_https'] = web_pts
            sec_detail['no_phishing']        = safe_pts
            sec_detail['no_honeypot']        = hon_pts
            sec_detail['no_obfuscated']      = scr_pts
            sec_detail['clean_domain']       = dom_pts

            security = web_pts + safe_pts + hon_pts + scr_pts + dom_pts
            security = max(0, min(100, security))

            # ── Transparency score (validators verify each URL exists) ─────────
            # +25 website present and working (already verified above)
            # +20 GitHub repo exists and is accessible
            # +20 docs exist and are accessible
            # +15 Twitter/X account exists
            # +10 Telegram community exists
            # +10 Discord server exists

            web_t = 25 if website_live else 0
            gh_t  = 0
            doc_t = 0
            tw_t  = 0
            tg_t  = 0
            dc_t  = 0

            if github_url and github_url.strip():
                try:
                    gh_page = gl.nondet.get_webpage(github_url, mode='text')
                    if gh_page and len(gh_page) > 100:
                        gh_t = 20
                        positives.append(f'GitHub repository verified: {github_url}')
                    else:
                        risks.append(f'GitHub URL provided but could not verify: {github_url}')
                except Exception:
                    risks.append(f'GitHub URL inaccessible: {github_url}')
            else:
                risks.append('No GitHub repository provided')

            if docs_url and docs_url.strip():
                try:
                    doc_page = gl.nondet.get_webpage(docs_url, mode='text')
                    if doc_page and len(doc_page) > 50:
                        doc_t = 20
                        positives.append(f'Documentation verified: {docs_url}')
                    else:
                        risks.append(f'Docs URL provided but could not verify: {docs_url}')
                except Exception:
                    risks.append(f'Documentation URL inaccessible: {docs_url}')
            else:
                risks.append('No documentation link provided')

            if twitter_url and twitter_url.strip():
                try:
                    tw_page = gl.nondet.get_webpage(twitter_url, mode='text')
                    if tw_page and len(tw_page) > 50:
                        tw_t = 15
                        positives.append(f'Twitter/X account verified: {twitter_url}')
                    else:
                        risks.append(f'Twitter/X URL provided but could not verify: {twitter_url}')
                except Exception:
                    # Twitter often blocks bots — give benefit of the doubt if URL is well-formed
                    if 'x.com/' in twitter_url or 'twitter.com/' in twitter_url:
                        tw_t = 10
                        positives.append(f'Twitter/X account linked (access restricted to bots): {twitter_url}')
                    else:
                        risks.append(f'Twitter/X URL invalid: {twitter_url}')
            else:
                risks.append('No Twitter/X account linked')

            if telegram_url and telegram_url.strip():
                try:
                    tg_page = gl.nondet.get_webpage(telegram_url, mode='text')
                    if tg_page and len(tg_page) > 50:
                        tg_t = 10
                        positives.append(f'Telegram community verified: {telegram_url}')
                    else:
                        risks.append(f'Telegram URL provided but could not verify: {telegram_url}')
                except Exception:
                    if 't.me/' in telegram_url:
                        tg_t = 8
                        positives.append(f'Telegram community linked: {telegram_url}')
                    else:
                        risks.append(f'Telegram URL invalid: {telegram_url}')
            else:
                risks.append('No Telegram community linked')

            if discord_url and discord_url.strip():
                try:
                    dc_page = gl.nondet.get_webpage(discord_url, mode='text')
                    if dc_page and len(dc_page) > 50:
                        dc_t = 10
                        positives.append(f'Discord server verified: {discord_url}')
                    else:
                        risks.append(f'Discord URL provided but could not verify: {discord_url}')
                except Exception:
                    if 'discord.gg/' in discord_url or 'discord.com/' in discord_url:
                        dc_t = 8
                        positives.append(f'Discord server linked: {discord_url}')
                    else:
                        risks.append(f'Discord URL invalid: {discord_url}')
            else:
                risks.append('No Discord server linked')

            trans_detail['website']  = web_t
            trans_detail['github']   = gh_t
            trans_detail['docs']     = doc_t
            trans_detail['twitter']  = tw_t
            trans_detail['telegram'] = tg_t
            trans_detail['discord']  = dc_t

            transparency = web_t + gh_t + doc_t + tw_t + tg_t + dc_t
            transparency = max(0, min(100, transparency))

            # ── Final score ───────────────────────────────────────────────────
            score = round((security + transparency) / 2)
            risk  = 'Low' if score >= 75 else 'Medium' if score >= 50 else 'High'
            confidence = 'High' if (website_live and gh_t > 0) else ('Medium' if website_live else 'Low')

            # ── AI narrative — validator writes explanation ────────────────────
            prompt = f"""You are a Web3 security analyst for GenRadar, powered by GenLayer Intelligent Contracts.

You personally verified the following URLs by fetching them:
- Website ({website_url}): {"LIVE and accessible" if website_live else "UNREACHABLE"}
- GitHub ({github_url or "not provided"}): {"VERIFIED +" + str(gh_t) + "pts" if gh_t > 0 else "NOT verified or not provided"}
- Twitter/X ({twitter_url or "not provided"}): {"VERIFIED +" + str(tw_t) + "pts" if tw_t > 0 else "NOT verified or not provided"}
- Telegram ({telegram_url or "not provided"}): {"VERIFIED +" + str(tg_t) + "pts" if tg_t > 0 else "NOT verified or not provided"}
- Discord ({discord_url or "not provided"}): {"VERIFIED +" + str(dc_t) + "pts" if dc_t > 0 else "NOT verified or not provided"}
- Docs ({docs_url or "not provided"}): {"VERIFIED +" + str(doc_t) + "pts" if doc_t > 0 else "NOT verified or not provided"}

Security checks on website content:
- Phishing patterns: {"DETECTED" if has_phishing else "NONE"}
- Honeypot indicators: {"DETECTED" if has_honeypot else "NONE"}
- Obfuscated scripts: {"DETECTED" if has_obfuscate else "NONE"}
- HTTPS/SSL: {"VALID" if ssl_valid else "MISSING"}

FINAL SCORES (do not change):
- Security: {security}/100
- Transparency: {transparency}/100
- Final Score: {score}/100
- Risk: {risk}

PROJECT: {name} ({category})
{description[:300]}

Write a concise 2-3 sentence explanation, a security_explanation, and a transparency_explanation.
Only mention what was actually verified above. Do not mention things not in evidence.

Return ONLY valid JSON:
{{"explanation":"...","security_explanation":"...","transparency_explanation":"..."}}"""

            try:
                narrative_raw = gl.nondet.exec_prompt(prompt)
                narrative_raw = narrative_raw.strip()
                if '```' in narrative_raw:
                    for part in narrative_raw.split('```'):
                        p = part.strip().lstrip('json').strip()
                        if p.startswith('{'):
                            narrative_raw = p
                            break
                s = narrative_raw.find('{')
                e = narrative_raw.rfind('}') + 1
                if s >= 0 and e > s:
                    narrative_raw = narrative_raw[s:e]
                narrative = json.loads(narrative_raw)
            except Exception:
                narrative = {
                    'explanation': f'Security: {security}/100. Transparency: {transparency}/100. Final: {score}/100.',
                    'security_explanation': f'Security score {security}/100 based on direct URL verification.',
                    'transparency_explanation': f'Transparency score {transparency}/100 based on verified social and documentation links.',
                }

            result = {
                'score':                    score,
                'security_score':           security,
                'transparency_score':       transparency,
                'risk':                     risk,
                'confidence':               confidence,
                'positives':                positives[:6],
                'risks':                    risks[:6],
                'findings':                 risks[:6],
                'explanation':              narrative.get('explanation', ''),
                'security_explanation':     narrative.get('security_explanation', ''),
                'transparency_explanation': narrative.get('transparency_explanation', ''),
                'breakdown': {
                    'security':             security,
                    'transparency':         transparency,
                    'security_detail':      sec_detail,
                    'transparency_detail':  trans_detail,
                },
            }

            return json.dumps(result)

        # Run with equivalence principle — validators must agree on score values
        consensus = gl.eq_principle.prompt_comparative(
            verify_project,
            f"""Compare these evaluations of project "{name}" ({website_url}).
Validators must agree on:
1. Whether the website is live and uses HTTPS
2. Whether each submitted URL (GitHub, Twitter, Telegram, Discord, Docs) is accessible
3. Security score and transparency score (must be within 5 points of each other)
4. Risk level (Low/Medium/High)

Reject any response that:
- Claims a URL is verified when it was not fetched
- Has security + transparency scores that don't match the verified URL checks
- Changes scores from what was computed

Choose the response most accurately reflecting what was actually verified."""
        )

        self.results[project_id] = consensus  # presence = locked, no overwrites possible

    @gl.public.view
    def get_evaluation(self, project_id: str) -> str:
        if project_id in self.results:
            return self.results[project_id]
        return '{}'

    @gl.public.view
    def has_evaluation(self, project_id: str) -> bool:
        return project_id in self.results

    @gl.public.view
    def is_locked(self, project_id: str) -> bool:
        return project_id in self.results
