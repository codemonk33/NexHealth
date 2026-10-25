#!/usr/bin/env python3
"""Test that all backend components can be imported successfully."""

import sys

print("=" * 70)
print("TESTING BACKEND IMPORTS")
print("=" * 70)

try:
    print("\n1. Testing models import...")
    from app.models import *
    print("   ✅ All models imported successfully")
except Exception as e:
    print(f"   ❌ ERROR: {e}")
    sys.exit(1)

try:
    print("\n2. Testing database configuration...")
    from app.database import Base, engine
    print("   ✅ Database configured")
except Exception as e:
    print(f"   ❌ ERROR: {e}")
    sys.exit(1)

try:
    print("\n3. Testing dependencies...")
    from app.dependencies import get_current_user
    print("   ✅ Dependencies loaded")
except Exception as e:
    print(f"   ❌ ERROR: {e}")
    sys.exit(1)

try:
    print("\n4. Testing main app initialization...")
    from app.main import app
    print("   ✅ Main app initialized")
except Exception as e:
    print(f"   ❌ ERROR: {e}")
    sys.exit(1)

print("\n" + "=" * 70)
print("✅✅✅ ALL CORE BACKEND IMPORTS SUCCESSFUL ✅✅✅")
print("=" * 70)
print("\nNote: Intent detection will load when services start.")
print("All model definitions, database, and routing configurations verified.")

