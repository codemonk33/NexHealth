#!/usr/bin/env python3
"""Direct migration script - run from container"""
import os
import sys

os.chdir('/workspace')
sys.path.insert(0, '/workspace')
os.environ['DATABASE_URL'] = 'postgresql://bionex:bionex@postgres:5432/bionex'

try:
    from alembic.config import Config
    from alembic import command
    
    print("="*80)
    print("ALEMBIC MIGRATION: Encrypt Public Keys")
    print("="*80)
    
    config = Config('/workspace/alembic.ini')
    config.set_main_option('sqlalchemy.url', os.environ['DATABASE_URL'])
    
    print("\n[1] Current migration status:")
    try:
        command.current(config)
    except:
        print("(Unable to get current status)")
    
    print("\n[2] Upgrading database to HEAD...")
    command.upgrade(config, 'head')
    
    print("\n[3] New migration status:")
    try:
        command.current(config)
    except:
        pass
    
    print("\n" + "="*80)
    print("✓ MIGRATION SUCCESSFULLY APPLIED!")
    print("="*80)
    
except Exception as e:
    print(f"\n✗ MIGRATION FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
