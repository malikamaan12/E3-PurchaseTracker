# DigitalOcean Hybrid Setup Guide

## Overview
Connect your Replit application to DigitalOcean services while keeping development in Replit.

**Setup**: App runs on Replit + DigitalOcean database + Custom domain

## Quick Setup Steps

### 1. Create DigitalOcean Database
1. Go to DigitalOcean → Databases → Create PostgreSQL Database
2. Choose: **Basic Plan ($15/month)** 
3. Region: **Closest to your users**
4. Database name: `purchase_management`

### 2. Get Connection Info
After creation, copy these details:
```
Host: your-db-host.db.ondigitalocean.com
Port: 25060
Username: doadmin  
Password: [your-generated-password]
Database: purchase_management
```

### 3. Update Replit Environment
In Replit Secrets, add:
```
PROD_DATABASE_URL=postgresql://doadmin:[password]@[host]:25060/purchase_management?sslmode=require
```

### 4. Migrate Your Data
In Replit console:
```bash
# Export current data
npm run db:export

# Import to DigitalOcean (using connection string above)
npm run db:import
```

### 5. Custom Domain Setup
**Option A**: Direct to Replit
- Set CNAME record: `www` → `your-repl.replit.dev`

**Option B**: Through DigitalOcean DNS
1. Change nameservers to DigitalOcean
2. Create DNS records pointing to Replit

## Monthly Cost: ~$15-35
- DigitalOcean Database: $15
- Replit: $0-20 (depending on usage)
- Domain: ~$10-15/year

## Benefits
✓ Professional custom domain  
✓ Reliable production database  
✓ Keep Replit development experience  
✓ Easy to scale later  
✓ Automatic backups on DigitalOcean  

Would you like me to help set up any specific part?