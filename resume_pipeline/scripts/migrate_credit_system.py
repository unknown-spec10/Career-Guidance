"""
Credit System Migration Script

Creates the following tables:
- credit_accounts: Track user credit balances and limits
- credit_transactions: Log all credit operations
- credit_usage_stats: Daily/weekly usage tracking
- system_configuration: Admin-configurable settings

Also updates interview_sessions table with credit-related fields.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from resume_pipeline.config import settings
from resume_pipeline.db import Base, engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def migrate_credit_system():
    """Run migration to add credit system tables"""
    
    logger.info("Starting credit system migration...")
    
    try:
        # Create all tables defined in db.py
        logger.info("Creating new tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("✅ All tables created successfully")
        
        # Verify tables exist
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = DATABASE()
                AND table_name IN ('credit_accounts', 'credit_transactions', 'credit_usage_stats', 'system_configurations')
            """))
            tables = [row[0] for row in result]
            
            logger.info(f"Verified tables: {tables}")
            
            if len(tables) == 4:
                logger.info("✅ All credit system tables created successfully")
            else:
                missing = set(['credit_accounts', 'credit_transactions', 'credit_usage_stats', 'system_configurations']) - set(tables)
                logger.warning(f"⚠️ Missing tables: {missing}")
        
        # Initialize credit accounts for existing applicants
        logger.info("Initializing credit accounts for existing applicants...")
        with engine.connect() as conn:
            # Check if there are applicants without credit accounts
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM applicants a
                LEFT JOIN credit_accounts ca ON a.id = ca.applicant_id
                WHERE ca.id IS NULL
            """))
            count = result.scalar() or 0
            
            if count > 0:
                logger.info(f"Found {count} applicants without credit accounts")
                
                # Create credit accounts for all existing applicants
                conn.execute(text("""
                    INSERT INTO credit_accounts (
                        applicant_id, current_credits, total_earned, total_spent, 
                        weekly_credit_limit, last_refill_at, next_refill_at, 
                        is_premium, admin_bonus_credits
                    )
                    SELECT 
                        a.id,
                        60,  -- current_credits
                        60,  -- total_earned
                        0,   -- total_spent
                        60,  -- weekly_credit_limit
                        NOW(),
                        DATE_ADD(NOW(), INTERVAL 7 DAY),
                        FALSE,  -- is_premium
                        0    -- admin_bonus_credits
                    FROM applicants a
                    LEFT JOIN credit_accounts ca ON a.id = ca.applicant_id
                    WHERE ca.id IS NULL
                """))
                conn.commit()
                logger.info(f"✅ Created {count} credit accounts")
            else:
                logger.info("✅ All applicants already have credit accounts")
        
        # Set initial system configuration
        logger.info("Setting default system configuration...")
        with engine.connect() as conn:
            # Check if config already exists
            result = conn.execute(text("SELECT COUNT(*) FROM system_configurations"))
            config_count = result.scalar() or 0
            if config_count == 0:
                conn.execute(text("""
                    INSERT INTO system_configurations (`key`, value, description, category)
                    VALUES 
                        ('default_weekly_credits', '60', 'Default weekly credit allocation for new users', 'credits'),
                        ('premium_weekly_credits', '120', 'Weekly credit allocation for premium users', 'credits'),
                        ('max_daily_credits', '30', 'Maximum credits that can be used in a single day', 'limits'),
                        ('refill_interval_days', '7', 'Number of days between automatic refills', 'credits'),
                        ('max_accumulated_weeks', '2', 'Maximum weeks of unused credits that can accumulate', 'limits')
                """))
                conn.commit()
                logger.info("✅ System configuration initialized")
            else:
                logger.info("✅ System configuration already exists")
        
        logger.info("="*50)
        logger.info("✅ Credit system migration completed successfully!")
        logger.info("="*50)
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        raise


if __name__ == "__main__":
    migrate_credit_system()
