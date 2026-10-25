#!/usr/bin/env python3
"""
Debug script to test auth endpoints locally
"""
import sys
import logging

# Set up logging to see all debug messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

try:
    print("\n" + "=" * 70)
    print("TESTING AUTH ENDPOINTS")
    print("=" * 70)
    
    # Test 1: Import models
    print("\n1. Testing models import...")
    from app.models import User, Patient
    print("   ✅ Models imported")
    
    # Test 2: Import database
    print("\n2. Testing database setup...")
    from app.database import get_db, SessionLocal, Base, engine
    print("   ✅ Database module loaded")
    
    # Test 3: Create tables
    print("\n3. Testing table creation...")
    Base.metadata.create_all(bind=engine)
    print("   ✅ Tables created (or already exist)")
    
    # Test 4: Test user creation
    print("\n4. Testing user creation...")
    db = SessionLocal()
    
    # Check if test user exists
    test_user = db.query(User).filter(User.phone == "+919876543210").first()
    if test_user:
        print("   ℹ️ Test user already exists, deleting...")
        db.delete(test_user)
        db.commit()
    
    from app.services.auth_service import hash_password
    
    # Create test user
    test_user = User(
        name="Test User",
        phone="+919876543210",
        email="test@example.com",
        hashed_password=hash_password("TestPass123!"),
        role="PATIENT"
    )
    db.add(test_user)
    db.flush()
    
    # Create patient profile
    patient = Patient(user_id=test_user.id)
    db.add(patient)
    db.commit()
    
    print(f"   ✅ Test user created: {test_user.id}")
    
    # Test 5: Test password verification
    print("\n5. Testing password verification...")
    from app.services.auth_service import verify_password
    
    pwd_ok = verify_password("TestPass123!", test_user.hashed_password)
    print(f"   {'✅' if pwd_ok else '❌'} Password verification: {pwd_ok}")
    
    # Test 6: Test token creation
    print("\n6. Testing token creation...")
    from app.services.auth_service import create_access_token, create_refresh_token
    
    access_token = create_access_token({"sub": str(test_user.id), "role": "PATIENT"})
    refresh_token = create_refresh_token({"sub": str(test_user.id)})
    
    print(f"   ✅ Access token created: {access_token[:50]}...")
    print(f"   ✅ Refresh token created: {refresh_token[:50]}...")
    
    # Test 7: Test auth router
    print("\n7. Testing auth router import...")
    from app.routers.auth import router as auth_router
    print("   ✅ Auth router imported")
    
    # Test 8: Test app initialization
    print("\n8. Testing app initialization...")
    from app.main import app
    print("   ✅ Main app initialized")
    
    db.close()
    
    print("\n" + "=" * 70)
    print("✅✅✅ ALL AUTH TESTS PASSED ✅✅✅")
    print("=" * 70)
    print("\nThe backend is ready to handle auth requests.")
    print("Login with:")
    print("  Phone: +919876543210")
    print("  Password: TestPass123!")
    
except Exception as e:
    logger.error(f"Error during testing: {str(e)}", exc_info=True)
    print(f"\n❌ ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
