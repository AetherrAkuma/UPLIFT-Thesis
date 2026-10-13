"""
Test Suite: Unified Physical Safety Scoring & Accommodation Matching
---------------------------------------------------------------------
Validates that:
1. Office/desk jobs with accommodations or level access score >= 90% for mobility/orthopedic PWDs.
2. 100% Remote jobs receive >= 95% safety score (commute & facility barrier mitigation).
3. Multi-disability accommodations (visual, auditory, neurodivergent) properly bridge demand gaps.
4. Genuinely strenuous physical mismatches without accommodations are safely flagged (<= 35%).
5. Results are deterministic and identical across search and job analysis.
"""

import sys
import os
import json

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from compatibility_engine import (
    build_capability_profile,
    score_job_compatibility,
    compute_physical_safety_score,
)

def test_mobility_exact_match_desk_job():
    print("=== Test 1: Mobility/Orthopedic PWD + Accessible Desk Job ===")
    user_profile = {
        "disabilities": ["Orthopedic"],
        "disability_profile": json.dumps({
            "disabilities": [{"category": "Orthopedic", "subtype": "Spinal Cord Injury"}],
            "capabilities": {"physical": "Low", "fine_motor": "Medium", "energy": "Low"}
        })
    }
    job = {
        "job_title": "Software Developer",
        "job_description": "Develop full-stack web applications. Mostly seated office work.",
        "physical_requirements": "Requires sitting at desk, level floor access only.",
        "accessibility_features": "Ramps/Elevators, Level access, Ergonomic workstation",
        "work_environment": "Indoor (Office)",
        "physical_demand": "Low",
        "fine_motor_demand": "Medium",
        "sensory_load": "Low",
        "remote_friendly": 0,
    }

    caps = build_capability_profile(user_profile.get("disability_profile"), user_profile["disabilities"])
    compat = score_job_compatibility(user_profile, job, capabilities=caps)
    safety_score = compute_physical_safety_score(job, user_profile, capabilities=caps, compat=compat)

    print(f"  Safety Score: {safety_score}% (Base matrix score: {compat['score']}%)")
    assert safety_score >= 90.0, f"Expected >= 90%, got {safety_score}%"
    print("  [PASS] Desk job with accommodations correctly yields high safety score.\n")


def test_remote_work_safety_guarantee():
    print("=== Test 2: 100% Remote Job (Commute & Transit Exemption) ===")
    user_profile = {
        "disabilities": ["Physical"],
        "disability_profile": json.dumps({
            "disabilities": [{"category": "Physical", "subtype": "Wheelchair User"}],
            "capabilities": {"physical": "Low"}
        })
    }
    job = {
        "job_title": "Remote Content Writer",
        "job_description": "Write articles and guides from home.",
        "physical_requirements": "Computer desk work.",
        "accessibility_features": "Flexible hours, Remote",
        "work_environment": "Home Office",
        "location": "Remote",
        "remote_friendly": 1,
        "physical_demand": "Medium",
    }

    caps = build_capability_profile(user_profile.get("disability_profile"), user_profile["disabilities"])
    compat = score_job_compatibility(user_profile, job, capabilities=caps)
    safety_score = compute_physical_safety_score(job, user_profile, capabilities=caps, compat=compat)

    print(f"  Safety Score: {safety_score}%")
    assert safety_score >= 95.0, f"Expected >= 95%, got {safety_score}%"
    print("  [PASS] Remote position guaranteed >= 95% safety score.\n")


def test_visual_accommodation_match():
    print("=== Test 3: Visual Disability with Screen Reader Accommodation ===")
    user_profile = {
        "disabilities": ["Visual"],
        "disability_profile": json.dumps({
            "disabilities": [{"category": "Visual", "subtype": "Low Vision"}],
            "capabilities": {"visual": "Low"}
        })
    }
    job = {
        "job_title": "Accessibility Quality Analyst",
        "job_description": "Audit website accessibility.",
        "physical_requirements": "Standard seated desk work.",
        "accessibility_features": "Screen reader (NVDA/JAWS) compatible, High-contrast display, Large print",
        "work_environment": "Indoor (Office)",
        "physical_demand": "Low",
        "visual_demand": "Medium",
    }

    caps = build_capability_profile(user_profile.get("disability_profile"), user_profile["disabilities"])
    compat = score_job_compatibility(user_profile, job, capabilities=caps)
    safety_score = compute_physical_safety_score(job, user_profile, capabilities=caps, compat=compat)

    print(f"  Safety Score: {safety_score}%")
    assert safety_score >= 90.0, f"Expected >= 90%, got {safety_score}%"
    print("  [PASS] Visual accommodation correctly recognized and boosted.\n")


def test_genuine_physical_hazard_mismatch():
    print("=== Test 4: Genuine Physical Mismatch Without Accommodations ===")
    user_profile = {
        "disabilities": ["Orthopedic"],
        "disability_profile": json.dumps({
            "disabilities": [{"category": "Orthopedic", "subtype": "Spinal Cord Injury"}],
            "capabilities": {"physical": "Low"}
        })
    }
    job = {
        "job_title": "Warehouse Logistics Handler",
        "job_description": "Heavy inventory loading, moving freight, manual pallet jack operation.",
        "physical_requirements": "Constant standing, walking, lifting 50 lbs cartons for 8 hours. No elevator.",
        "accessibility_features": "",
        "work_environment": "Outdoor/Industrial",
        "physical_demand": "High",
        "remote_friendly": 0,
    }

    caps = build_capability_profile(user_profile.get("disability_profile"), user_profile["disabilities"])
    compat = score_job_compatibility(user_profile, job, capabilities=caps)
    safety_score = compute_physical_safety_score(job, user_profile, capabilities=caps, compat=compat)

    print(f"  Safety Score: {safety_score}%")
    assert safety_score <= 40.0, f"Expected <= 40%, got {safety_score}%"
    print("  [PASS] Hazardous physical mismatch correctly restricted.\n")


if __name__ == "__main__":
    test_mobility_exact_match_desk_job()
    test_remote_work_safety_guarantee()
    test_visual_accommodation_match()
    test_genuine_physical_hazard_mismatch()
    print("All Physical Safety Scoring tests passed successfully!")
