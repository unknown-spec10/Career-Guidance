# Production Deployment Guide

Complete guide for deploying the Career Guidance AI System to production.

## 📋 Pre-Deployment Checklist

### Environment Setup
- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed
- [ ] MySQL 8.0+ database server
- [ ] Valid Google Gemini API key
- [ ] Gmail account for SMTP (with app password)
- [ ] Domain name (optional)
- [ ] SSL certificate (recommended)

### Security Checklist
- [ ] Strong `SECRET_KEY` generated (use `python -c "import secrets; print(secrets.token_hex(32))"`)
- [ ] Gmail app password created (not regular password)
- [ ] Database user with appropriate permissions only
- [ ] Firewall rules configured
- [ ] `.env` file with all required variables
- [ ] `.env` NOT committed to git
- [ ] Rate limiting enabled
- [ ] CORS origins restricted to production domains

### Code Verification
- [ ] All tests passing (`pytest tests/`)
- [ ] No console errors in browser
- [ ] Email verification working
- [ ] Password reset flow working
- [ ] File uploads functional
- [ ] Database migrations applied
- [ ] Dependencies up to date

## 🔐 Environment Variables

Create a `.env` file in production with these variables:

```env
# Required - Backend Security
SECRET_KEY=your_secret_key_here_minimum_32_characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Required - Database
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=career_guidance_user
MYSQL_PASSWORD=strong_password_here
MYSQL_DB=resumes

# Required - AI Services
GEMINI_API_KEY=your_gemini_api_key_here

# Required - Email (Gmail SMTP)
GMAIL_ADDRESS=your-app-email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password

# Optional - Google Search (for enhanced features)
GOOGLE_SEARCH_API_KEY=your_search_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id

# Storage
FILE_STORAGE_PATH=./data/raw_files

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com
```

### Generating Secure Keys

```bash
# SECRET_KEY (32+ bytes)
python -c "import secrets; print(secrets.token_hex(32))"

# Gmail App Password
# 1. Go to Google Account → Security → 2-Step Verification
# 2. App passwords → Select app (Mail) → Generate
# 3. Copy the 16-character password
```

## 🗄️ Database Setup

### Create Production Database

```sql
-- Connect to MySQL
mysql -u root -p

-- Create database
CREATE DATABASE resumes CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated user
CREATE USER 'career_guidance_user'@'localhost' IDENTIFIED BY 'your_strong_password';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, INDEX, ALTER 
ON resumes.* TO 'career_guidance_user'@'localhost';

-- Apply privileges
FLUSH PRIVILEGES;

-- Verify
SHOW GRANTS FOR 'career_guidance_user'@'localhost';
```

### Initialize Tables

Tables are automatically created when the FastAPI server starts (see `db.init_db()`). To manually initialize:

```bash
cd resume_pipeline
python scripts/init_db.py
```

### Seed with Sample Data (Optional)

```bash
python scripts/seed_database.py
```

## 🐍 Backend Deployment

### Install Dependencies

```bash
# Navigate to project
cd "D:\Career Guidence"

# Create virtual environment
python -m venv venv

# Activate
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# OR
source venv/bin/activate  # Linux/Mac

# Install packages
cd resume_pipeline
pip install -r requirements.txt
```

### Run with Gunicorn (Linux/Mac)

```bash
# Install Gunicorn
pip install gunicorn

# Run with 4 workers
gunicorn resume_pipeline.app:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --timeout 120 \
  --access-logfile logs/access.log \
  --error-logfile logs/error.log
```

### Run with Uvicorn (Windows or Development)

```bash
# Production mode (no reload)
uvicorn resume_pipeline.app:app --host 0.0.0.0 --port 8000 --workers 4

# Or use a process manager like PM2
```

### Windows Service Setup

Use NSSM (Non-Sucking Service Manager) to run as Windows service:

```powershell
# Download NSSM from https://nssm.cc/download
# Install service
nssm install CareerGuidanceAPI "D:\Career Guidence\venv\Scripts\uvicorn.exe"
nssm set CareerGuidanceAPI AppParameters "resume_pipeline.app:app --host 0.0.0.0 --port 8000"
nssm set CareerGuidanceAPI AppDirectory "D:\Career Guidence\resume_pipeline"
nssm set CareerGuidanceAPI AppEnvironmentExtra "PYTHONPATH=D:\Career Guidence\resume_pipeline"

# Start service
nssm start CareerGuidanceAPI
```

## ⚛️ Frontend Deployment

### Build for Production

```bash
cd frontend

# Install dependencies
npm install

# Build optimized bundle
npm run build
```

This creates a `dist/` folder with optimized assets.

### Deploy Options

#### Option 1: Static Hosting (Netlify, Vercel, Cloudflare Pages)

```bash
# Netlify
netlify deploy --prod --dir=dist

# Vercel
vercel --prod

# Set environment variable for API URL
VITE_API_URL=https://your-api-domain.com
```

#### Option 2: Nginx (Self-hosted)

```nginx
# /etc/nginx/sites-available/career-guidance

server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /var/www/career-guidance/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and restart:
```bash
ln -s /etc/nginx/sites-available/career-guidance /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

#### Option 3: Apache

```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    DocumentRoot /var/www/career-guidance/frontend/dist

    <Directory /var/www/career-guidance/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        RewriteEngine On
        RewriteBase /
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    ProxyPass /api http://localhost:8000/api
    ProxyPassReverse /api http://localhost:8000/api
</VirtualHost>
```

## 🔒 SSL/HTTPS Setup

### Using Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo certbot renew --dry-run
```

Update CORS in `app.py`:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",
        "https://www.yourdomain.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 📊 Monitoring & Logging

### Backend Logs

```bash
# View logs
tail -f logs/access.log
tail -f logs/error.log

# Log rotation (logrotate)
# /etc/logrotate.d/career-guidance
/var/www/career-guidance/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

### Database Monitoring

```sql
-- Monitor connections
SHOW PROCESSLIST;

-- Check slow queries
SHOW VARIABLES LIKE 'slow_query_log';
SET GLOBAL slow_query_log = 'ON';

-- Optimize tables
OPTIMIZE TABLE applicants, uploads, llm_parsed_records;
```

### Health Checks

```bash
# Backend health
curl http://localhost:8000/api/stats

# Database connection
mysql -u career_guidance_user -p resumes -e "SELECT COUNT(*) FROM applicants;"
```

## 🔄 Backup & Recovery

### Database Backup

```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/mysql"
mysqldump -u career_guidance_user -p resumes > $BACKUP_DIR/resumes_$DATE.sql
gzip $BACKUP_DIR/resumes_$DATE.sql

# Keep last 30 days
find $BACKUP_DIR -name "resumes_*.sql.gz" -mtime +30 -delete
```

Add to crontab:
```bash
0 2 * * * /path/to/backup_script.sh
```

### File Storage Backup

```bash
# Backup uploaded files
rsync -av --delete /path/to/data/raw_files/ /backups/raw_files/
```

### Recovery

```bash
# Restore database
gunzip < /backups/mysql/resumes_YYYYMMDD_HHMMSS.sql.gz | mysql -u career_guidance_user -p resumes

# Restore files
rsync -av /backups/raw_files/ /path/to/data/raw_files/
```

## 🚀 Performance Optimization

### Backend
- Use Redis for caching (recommendations, stats)
- Enable database query caching
- Optimize N+1 queries with `joinedload`
- Use connection pooling

### Frontend
- Enable gzip compression in Nginx/Apache
- Use CDN for static assets
- Implement lazy loading for routes
- Optimize images

### Database
```sql
-- Add indexes for common queries
CREATE INDEX idx_applicant_location ON applicants(preferred_location);
CREATE INDEX idx_job_location ON jobs(location);
CREATE INDEX idx_job_status ON jobs(status, expires_at);
```

## 🛠️ Maintenance

### Update Dependencies

```bash
# Backend
pip list --outdated
pip install --upgrade package_name

# Frontend
npm outdated
npm update
```

### Security Updates

```bash
# Check for vulnerabilities
pip-audit  # Backend
npm audit  # Frontend

# Fix
npm audit fix
```

## 🐛 Troubleshooting

### Backend Won't Start
1. Check `.env` file exists and is valid
2. Verify MySQL is running: `systemctl status mysql`
3. Test database connection: `mysql -u career_guidance_user -p`
4. Check port 8000 is not in use: `netstat -an | grep 8000`

### Email Not Sending
1. Verify Gmail app password (not regular password)
2. Check 2-Step Verification is enabled
3. Test SMTP connection manually
4. Review error logs for SMTP errors

### High CPU Usage
1. Check number of Uvicorn workers (reduce if needed)
2. Monitor slow queries in MySQL
3. Review Gemini API call frequency
4. Check for infinite loops in code

### Database Connection Pool Exhausted
1. Increase pool size in `db.py`
2. Check for unclosed connections
3. Add connection pool monitoring

## 📞 Post-Deployment Verification

- [ ] Homepage loads correctly
- [ ] User registration works with email verification
- [ ] Login redirects to appropriate dashboard
- [ ] Password reset sends email and updates password
- [ ] Resume upload and parsing works
- [ ] Recommendations display correctly
- [ ] All API endpoints return expected data
- [ ] HTTPS is working (if configured)
- [ ] Logs are being written
- [ ] Backups are running

## 📈 Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Multiple backend instances
- Shared session storage (Redis)
- Distributed file storage (S3, NFS)

### Database Scaling
- Read replicas for reporting
- Connection pooling
- Query optimization
- Consider NoSQL for logs (MongoDB, Elasticsearch)

---

**Last Updated**: December 2, 2025

For issues, consult:
- Application logs
- MySQL slow query log
- Nginx/Apache error logs
- Browser console (F12)
