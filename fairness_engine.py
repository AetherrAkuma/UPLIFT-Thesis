"""
AI Fairness 360 integration for UPLIFT.
Provides fairness auditing, per-group metrics, and explainability.
"""
import json
import logging
from collections import defaultdict
from datetime import datetime

import numpy as np

try:
    from aif360.datasets import BinaryLabelDataset
    from aif360.metrics import BinaryLabelDatasetMetric
    from aif360.algorithms.preprocessing import Reweighing
    AIF360_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] AIF360 import failed: {e}")
    AIF360_AVAILABLE = False

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fairness_engine")

DISABILITY_CATEGORIES = [
    "Physical", "Visual", "Hearing", "Learning",
    "Intellectual", "Psychosocial", "Mental", "Orthopedic",
    "Speech and Language Impairment", "Cancer", "Rare Disease"
]


def categorize_disability(disabilities):
    if not disabilities:
        return "Unknown"
    first = disabilities[0] if isinstance(disabilities, list) else str(disabilities)
    first_lower = first.lower()
    # Priority mapping for overlapping terms to align with NCDA AO No. 001 s.2021
    PRIORITY_MAP = {
        "speech": "Speech and Language Impairment",
        "language": "Speech and Language Impairment",
        "cancer": "Cancer",
        "rare disease": "Rare Disease",
        "mental": "Mental",
        "orthopedic": "Orthopedic",
        "deaf": "Hearing",
        "hard of hearing": "Hearing",
    }
    for key, cat in PRIORITY_MAP.items():
        if key in first_lower:
            return cat
    for cat in DISABILITY_CATEGORIES:
        if cat.lower() in first_lower:
            return cat
    return "Other"


def log_match(user_id, disabilities, scores, job_id=None, cursor=None):
    """Log a single match result to the match_logs table."""
    cat = categorize_disability(disabilities)
    score = scores.get("final_accessibility_percentage", 0)
    if score is None or (isinstance(score, float) and (np.isnan(score) or np.isinf(score))):
        score = 0
    if cursor is None:
        return cat
    # Dedupe: keep only the latest result per (user, job) so repeated match runs
    # cannot inflate one user's disability group in the fairness statistics.
    if job_id:
        cursor.execute(
            "DELETE FROM match_logs WHERE user_id = %s AND job_id = %s",
            (user_id, job_id)
        )
    cursor.execute(
        """INSERT INTO match_logs (user_id, disability, score, safety_score, skill_score, stamina_score, job_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (user_id, cat, score,
         scores.get("safety_score", 0),
         scores.get("skill_score", 0),
         scores.get("stamina_score", 0),
         job_id)
    )
    return cat


def prune_match_logs(cursor, days=30):
    """
    Bounded retention: delete match_logs rows older than `days` so the table
    (and the fairness statistics it feeds) stays current and small.
    """
    if cursor is None:
        return 0
    cursor.execute(
        "DELETE FROM match_logs WHERE created_at < NOW() - INTERVAL %s",
        (f"{days} days",)
    )
    return cursor.rowcount


def compute_group_report(matches, user_disability_cat, cursor=None):
    """
    Compare the user's match scores against historical averages per disability group.
    Returns a dict with per-group comparison for explainability.
    """
    your_scores = [m["metrics"]["final_accessibility_percentage"] for m in matches]

    if not your_scores:
        return None

    your_avg = float(np.mean(your_scores))

    # Compute historical group averages from DB
    group_stats = {}
    if cursor is not None:
        cursor.execute("SELECT disability, score FROM match_logs")
        for row in cursor.fetchall():
            disability = row.get("disability") or "Unknown"
            score = row.get("score")
            if score is None:
                score = 0.0
            else:
                try:
                    score = float(score)
                except (ValueError, TypeError):
                    score = 0.0
            if disability not in group_stats:
                group_stats[disability] = []
            group_stats[disability].append(score)

    group_averages = {}
    for cat, scores in group_stats.items():
        if len(scores) >= 3:
            group_averages[cat] = {
                "avg": round(float(np.mean(scores)), 1),
                "count": len(scores)
            }

    # Compute disparity: how far user's average is from each group
    disparities = {}
    for cat, stats in group_averages.items():
        if cat != user_disability_cat:
            disparities[cat] = round(your_avg - stats["avg"], 1)

    return {
        "your_disability": user_disability_cat,
        "your_avg": round(your_avg, 1),
        "your_scores": [round(s, 1) for s in your_scores],
        "system_group_averages": group_averages,
        "disparity_vs_other_groups": disparities
    }


def compute_admin_fairness_report(cursor=None):
    """
    Full fairness audit across all historical match data using AIF360.
    Returns metrics including demographic parity ratio, disparate impact, etc.
    """
    if not AIF360_AVAILABLE:
        return {"error": "AIF360 not installed. Run: pip install aif360"}

    import pandas as pd

    if cursor is None:
        return {"error": "Insufficient data (0 records). Need at least 10.", "record_count": 0}

    cursor.execute("SELECT disability, score FROM match_logs")
    rows = cursor.fetchall()

    if len(rows) < 10:
        return {
            "error": f"Insufficient data ({len(rows)} records). Need at least 10.",
            "record_count": len(rows)
        }

    df = pd.DataFrame(rows, columns=["disability", "score"])

    # Binarize: score >= 70 is "favorable" (good match)
    df["favorable"] = (df["score"] >= 70).astype(int)

    # Identify the most populous group as privileged
    privileged_group = df["disability"].value_counts().idxmax()
    unprivileged_groups = [g for g in DISABILITY_CATEGORIES
                           if g in df["disability"].values and g != privileged_group]

    try:
        # One-hot encode disability categories (AIF360 requires numerical data)
        for cat in DISABILITY_CATEGORIES:
            df[f"dis_{cat}"] = (df["disability"] == cat).astype(int)

        protected_attrs = [f"dis_{cat}" for cat in DISABILITY_CATEGORIES
                           if f"dis_{cat}" in df.columns]

        bld = BinaryLabelDataset(
            df=df[protected_attrs + ["favorable"]].copy(),
            label_names=["favorable"],
            protected_attribute_names=protected_attrs,
            favorable_label=1,
            unfavorable_label=0
        )

        privileged = [{f"dis_{cat}": 1} for cat in DISABILITY_CATEGORIES
                      if cat == privileged_group]
        unprivileged = [{f"dis_{cat}": 1} for cat in DISABILITY_CATEGORIES
                        if cat in unprivileged_groups]

        metric = BinaryLabelDatasetMetric(bld,
            privileged_groups=privileged,
            unprivileged_groups=unprivileged
        )

        group_stats = df.groupby("disability").agg(
            avg_score=("score", "mean"),
            count=("score", "count"),
            favorable_rate=("favorable", "mean")
        ).round(3).to_dict("index")

        def safe_float(v, default=0.0):
            """Convert to float, replacing NaN/inf with default."""
            try:
                f = float(v)
                if np.isnan(f) or np.isinf(f):
                    return default
                return round(f, 4)
            except (TypeError, ValueError):
                return default

        return {
            "status": "ok",
            "total_records": len(df),
            "privileged_group": privileged_group,
            "unprivileged_groups": unprivileged_groups,
            "group_stats": {
                cat: {
                    "avg_score": round(float(stats["avg_score"]), 1),
                    "count": int(stats["count"]),
                    "favorable_rate": round(float(stats["favorable_rate"]), 3)
                }
                for cat, stats in group_stats.items()
            },
            "fairness_metrics": {
                "demographic_parity_ratio": safe_float(metric.disparate_impact()),
                "statistical_parity_difference": safe_float(metric.statistical_parity_difference()),
                "disparate_impact": safe_float(metric.disparate_impact()),
                "consistency": safe_float(metric.consistency()[0]) if hasattr(metric, 'consistency') else 0.0
            }
        }
    except Exception as e:
        logger.error(f"AIF360 computation failed: {e}")
        return {"error": f"AIF360 computation failed: {str(e)}"}


def apply_reweighing(matches, user_disability_cat, cursor=None):
    """
    Phase 3: Apply Reweighing to adjust match scores for fairness.
    Returns corrected matches with original vs adjusted scores.
    """
    if not AIF360_AVAILABLE:
        return matches, None

    if cursor is not None:
        cursor.execute("SELECT disability, score FROM match_logs")
        rows = cursor.fetchall()
    else:
        rows = []

    import pandas as pd

    df = pd.DataFrame(rows, columns=["disability", "score"]) if rows else pd.DataFrame(columns=["disability", "score"])
    if len(df) < 10:
        return matches, None

    # Skip if user's category isn't in our known list
    if user_disability_cat not in DISABILITY_CATEGORIES:
        return matches, None

    # Need at least one record of the user's group for meaningful reweighing
    if user_disability_cat not in df["disability"].values:
        return matches, None

    df["favorable"] = (df["score"] >= 70).astype(int)

    try:
        # One-hot encode
        for cat in DISABILITY_CATEGORIES:
            df[f"dis_{cat}"] = (df["disability"] == cat).astype(int)

        bld = BinaryLabelDataset(
            df=df[["favorable"] + [f"dis_{cat}" for cat in DISABILITY_CATEGORIES]].copy(),
            label_names=["favorable"],
            protected_attribute_names=[f"dis_{cat}" for cat in DISABILITY_CATEGORIES],
            favorable_label=1,
            unfavorable_label=0
        )

        unpriv = [{f"dis_{cat}": 1} for cat in DISABILITY_CATEGORIES
                   if cat == user_disability_cat]
        priv = [{f"dis_{cat}": 1} for cat in DISABILITY_CATEGORIES
                 if cat != user_disability_cat and cat in df["disability"].values]

        rw = Reweighing(unprivileged_groups=unpriv, privileged_groups=priv)
        rw.fit(bld)
        instance_weights = rw.instance_weights_

        avg_weight = float(np.mean(instance_weights))
        correction = min(15.0, max(-15.0, (1.0 - avg_weight) * 50))

        corrected = []
        for m in matches:
            orig = m["metrics"]["final_accessibility_percentage"]
            adjusted = min(100.0, max(0.0, orig + correction))
            m["metrics"]["original_score"] = round(orig, 1)
            m["metrics"]["final_accessibility_percentage"] = round(adjusted, 1)
            m["metrics"]["fairness_adjustment"] = round(correction, 1)
            corrected.append(m)

        return corrected, {
            "correction_applied": round(correction, 1),
            "method": "Reweighing",
            "your_group": user_disability_cat
        }

    except Exception as e:
        logger.error(f"Reweighing failed: {e}")
        return matches, None
