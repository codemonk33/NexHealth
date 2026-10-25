"""Add wearable_devices table and priority field to reminders (Phase 2)

Revision ID: d1f5e8c2a3b4
Revises: d5aec59a4c58
Create Date: 2026-10-17 16:00:00.000000

This migration adds:
1. wearable_devices table for tracking connected health devices
2. priority field (enum) to reminders table
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd1f5e8c2a3b4'
down_revision = 'd5aec59a4c58'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create ReminderPriority enum type
    priority_enum = postgresql.ENUM('ROUTINE', 'NORMAL', 'URGENT', name='reminderpriority', schema='bionex')
    priority_enum.create(op.get_bind(), checkfirst=True)

    # Add priority column to reminders table
    op.add_column(
        'reminders',
        sa.Column(
            'priority',
            priority_enum,
            nullable=False,
            server_default='ROUTINE',
            comment='Reminder priority level for user notification urgency'
        ),
        schema='bionex'
    )

    # Create wearable_devices table
    op.create_table(
        'wearable_devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False, comment='Device type: APPLE_HEALTH, GOOGLE_HEALTH, FITBIT, SAMSUNG, GARMIN, OTHER'),
        sa.Column('connected', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('last_sync', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['bionex.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema='bionex'
    )
    
    # Create indexes
    op.create_index('ix_wearable_devices_user_id', 'wearable_devices', ['user_id'], unique=False, schema='bionex')


def downgrade() -> None:
    # Drop wearable_devices table
    op.drop_index('ix_wearable_devices_user_id', table_name='wearable_devices', schema='bionex')
    op.drop_table('wearable_devices', schema='bionex')

    # Remove priority column from reminders
    op.drop_column('reminders', 'priority', schema='bionex')

    # Drop enum type
    priority_enum = postgresql.ENUM('ROUTINE', 'NORMAL', 'URGENT', name='reminderpriority', schema='bionex')
    priority_enum.drop(op.get_bind(), checkfirst=True)
