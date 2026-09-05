"""
Standalone Fairness Engine & AIF360 Audit Test Suite
----------------------------------------------------
This test suite is decoupled from the runtime production system.
It evaluates group disparity, disparate impact, and AIF360 reweighing
for academic and offline evaluation purposes without altering live matching queries.
"""

import sys
import os
import json

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fairness_engine import (
    categorize_disability,
    compute_group_report,
    apply_reweighing,
    DISABILITY_CATEGORIES,
)

def test_categorization():
    print("=== 1. Testing Disability Categorization ===")
    test_cases = [
        (["Visual Impairment (Low Vision)"], "Visual"),
        (["Hearing Impairment", "Deaf"], "Hearing"),
        (["Physical / Mobility Impairment"], "Physical"),
        (["Learning Disability"], "Learning"),
        (["Chronic_Illness", "Fatigue"], "Chronic_Illness"),
        (["Psychosocial Disability"], "Psychosocial"),
        ([], "Unknown"),
    ]
    for disabilities, expected in test_cases:
        cat = categorize_disability(disabilities)
        assert cat == expected, f"Expected {expected}, got {cat} for {disabilities}"
        print(f"  [PASS] {disabilities} -> '{cat}'")
    print("All disability categories mapped accurately.\n")


def test_offline_fairness_audit():
    print("=== 2. Testing Offline Fairness Audit & Disparities ===")
    # Simulated matches across different candidate disability categories
    mock_matches = [
        {"job_id": "job-1", "match_score": 88.0, "metrics": {"final_accessibility_percentage": 88.0}},
        {"job_id": "job-2", "match_score": 82.5, "metrics": {"final_accessibility_percentage": 82.5}},
        {"job_id": "job-3", "match_score": 79.0, "metrics": {"final_accessibility_percentage": 79.0}},
    ]

    report = compute_group_report(mock_matches, "visual", cursor=None)
    print("  Generated Offline Group Report:")
    print(f"    - User Disability Category: {report.get('your_disability')}")
    print(f"    - Candidate Average Score: {report.get('your_avg')}%")
    print(f"    - Baseline Groups Tracked: {list(report.get('system_group_averages', {}).keys())}")
    assert "your_avg" in report
    print("  [PASS] Group disparity reporting works as an independent evaluation tool.\n")


def test_reweighing_simulation():
    print("=== 3. Testing Offline Reweighing (AIF360 Simulation) ===")
    mock_matches = [
        {"job_id": "job-1", "match_score": 70.0, "metrics": {"final_accessibility_percentage": 70.0}},
        {"job_id": "job-2", "match_score": 65.0, "metrics": {"final_accessibility_percentage": 65.0}},
    ]
    reweighed_matches, reweigh_info = apply_reweighing(mock_matches, "physical", cursor=None)
    print("  Reweighing Info:", json.dumps(reweigh_info, indent=2))
    print(f"  Simulated adjusted score for job-1: {reweighed_matches[0]['match_score']}")
    print("  [PASS] Reweighing simulation executes independently of server.py.\n")


if __name__ == "__main__":
    print("Starting Offline Fairness Audit Evaluation...\n")
    test_categorization()
    test_offline_fairness_audit()
    test_reweighing_simulation()
    print("All Fairness Audit tests completed successfully!")
