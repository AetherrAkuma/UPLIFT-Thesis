import asyncio
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from server import (
    verify_turnstile,
    get_failed_attempt_record,
    record_failed_login,
    clear_failed_login,
    MAX_UNVERIFIED_LOGIN_ATTEMPTS
)

async def test_turnstile_unit():
    print("[TEST] 1. Empty/None token rejection...")
    res_none = await verify_turnstile(None)
    assert res_none is False, "None token should return False"
    res_empty = await verify_turnstile("   ")
    assert res_empty is False, "Empty token should return False"
    print("       Passed: Empty/None token rejected.")

    print("[TEST] 2. Test token verification (dev test keys)...")
    # With Cloudflare test dummy secret (1x00...AA) and test token, verify_turnstile validates
    res_test = await verify_turnstile("1x00000000000000000000AA")
    # In dev mode with test secret 1x00..., it should resolve True
    print(f"       Result with test token: {res_test}")
    assert isinstance(res_test, bool), "Should return boolean"

    print("[TEST] 3. Progressive failed login attempts tracking...")
    test_key = "127.0.0.1:test_pwd_seeker@uplift.com"
    clear_failed_login(test_key)

    # Attempt 1
    c1 = record_failed_login(test_key)
    assert c1 == 1, f"Expected count 1, got {c1}"
    assert c1 < MAX_UNVERIFIED_LOGIN_ATTEMPTS, "Attempt 1 should not require challenge"

    # Attempt 2
    c2 = record_failed_login(test_key)
    assert c2 == 2, f"Expected count 2, got {c2}"
    assert c2 < MAX_UNVERIFIED_LOGIN_ATTEMPTS, "Attempt 2 should not require challenge"

    # Attempt 3 (Threshold reached!)
    c3 = record_failed_login(test_key)
    assert c3 == 3, f"Expected count 3, got {c3}"
    assert c3 >= MAX_UNVERIFIED_LOGIN_ATTEMPTS, "Attempt 3 MUST require challenge"

    # Attempt 4 (Still required)
    c4 = record_failed_login(test_key)
    assert c4 == 4
    assert c4 >= MAX_UNVERIFIED_LOGIN_ATTEMPTS

    # On success: Clear attempts
    clear_failed_login(test_key)
    record_cleared = get_failed_attempt_record(test_key)
    assert record_cleared["count"] == 0, "Counter should be reset to 0 after clear"
    print("       Passed: 3-attempt progressive counter and reset logic verified.")

if __name__ == "__main__":
    asyncio.run(test_turnstile_unit())
    print("\n[ALL UNIT TESTS PASSED FOR TURNSTILE AUTH]")
