#!/usr/bin/env bash
# Quick setup script for dual-database architecture

set -e

echo "=================================="
echo "Dual-Database Setup (MySQL + Firestore)"
echo "=================================="
echo ""

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 not found"
    exit 1
fi

echo "✅ Python found: $(python3 --version)"

# Install firebase-admin
echo ""
echo "📦 Installing firebase-admin..."
pip install firebase-admin

# Check .env
if [ -f ".env" ]; then
    if grep -q "APP_ENV" .env; then
        echo "✅ APP_ENV already in .env"
    else
        echo "📝 Adding APP_ENV=local to .env"
        echo "APP_ENV=local" >> .env
    fi
else
    echo "⚠️  .env not found, creating..."
    cat > .env << EOF
APP_ENV=local
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=Deep@123
MYSQL_DB=resumes
EOF
    echo "📝 Created .env (update with your values)"
fi

# Seed MySQL
echo ""
echo "🌱 Seeding MySQL..."
python3 scripts/seed_mysql.py 2>/dev/null && echo "✅ MySQL seeded" || echo "⚠️  MySQL seeding failed (ensure MySQL is running)"

# Summary
echo ""
echo "=================================="
echo "✅ Setup complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Review documentation:"
echo "   - DUAL_DB_SUMMARY.md (quick overview)"
echo "   - DUAL_DB_ARCHITECTURE.md (detailed design)"
echo "   - DUAL_DB_IMPLEMENTATION.md (step-by-step)"
echo ""
echo "2. Start app locally:"
echo "   uvicorn resume_pipeline.app:app --reload"
echo ""
echo "3. For cloud deployment:"
echo "   - Set APP_ENV=cloud in Cloud Run env vars"
echo "   - Run: python scripts/seed_firestore.py"
echo "   - Deploy: gcloud run deploy career-guidance-backend --source ."
echo ""
